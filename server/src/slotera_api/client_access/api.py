from datetime import datetime
from hashlib import sha256
from hmac import compare_digest
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import EmailStr, Field
from sqlalchemy import text

from slotera_api.auth.dependencies import (
    DatabaseDependency,
    SettingsDependency,
    require_trusted_origin,
)
from slotera_api.auth.repository import AuthRepository
from slotera_api.email.locales import COMMUNICATION_COPY
from slotera_api.errors import ApiError
from slotera_api.identity import hash_opaque_token, issue_opaque_token
from slotera_api.request_context import operation_context
from slotera_api.schemas.operator_resources import StrictApiModel

router = APIRouter(tags=["client access"])
SESSION_COOKIE = "slotera_client_session"
CSRF_COOKIE = "slotera_client_csrf"


class ClientIdentity(StrictApiModel):
    client_id: UUID
    workspace_id: UUID
    workspace_name: str
    slug: str
    name: str
    email: EmailStr
    language: Literal["en", "tr", "de"]
    message_digest_enabled: bool
    automatic_followup_enabled: bool
    expires_at: datetime


class ClientSignIn(StrictApiModel):
    email: EmailStr
    language: Literal["en", "tr", "de"] = "en"


class ClientLink(StrictApiModel):
    token: str = Field(min_length=32, max_length=1024)


class ClientPreference(StrictApiModel):
    language: Literal["en", "tr", "de"] | None = None
    message_digest_enabled: bool | None = None
    automatic_followup_enabled: bool | None = None


class Accepted(StrictApiModel):
    accepted: bool = True


def invalid_session() -> ApiError:
    return ApiError(
        status_code=401,
        code="client_authentication_required",
        message="Sign in to your client workspace.",
    )


def identity_response(value: dict[str, object] | None) -> ClientIdentity:
    if value is None:
        raise invalid_session()
    return ClientIdentity.model_validate({k: v for k, v in value.items() if not k.startswith("_")})


async def require_client(request: Request, database: DatabaseDependency) -> ClientIdentity:
    token = request.cookies.get(SESSION_COOKIE, "")
    if not token:
        raise invalid_session()
    async with database.transaction() as session:
        value = await session.scalar(
            text("SELECT public.slotera_client_identity(:token)"),
            {"token": hash_opaque_token(token)},
        )
    identity = identity_response(value)
    context = operation_context.get()
    if context:
        context.actor_id = str(identity.client_id)
        context.workspace_id = str(identity.workspace_id)
    return identity


ClientDependency = Annotated[ClientIdentity, Depends(require_client)]


async def require_client_write(
    request: Request,
    database: DatabaseDependency,
    settings: SettingsDependency,
    client: ClientDependency,
) -> ClientIdentity:
    require_trusted_origin(request, settings)
    cookie = request.cookies.get(CSRF_COOKIE, "")
    header = request.headers.get("x-csrf-token", "")
    if not cookie or not header or not compare_digest(cookie, header):
        raise ApiError(
            status_code=403, code="csrf_validation_failed", message="Session verification failed."
        )
    async with database.transaction() as session:
        value = await session.scalar(
            text("SELECT public.slotera_client_identity(:token)"),
            {"token": hash_opaque_token(request.cookies[SESSION_COOKIE])},
        )
    if value is None:
        raise invalid_session()
    if not compare_digest(str(value["_csrfHash"]), hash_opaque_token(cookie).hex()):
        raise ApiError(
            status_code=403, code="csrf_validation_failed", message="Session verification failed."
        )
    return client


ClientWriteDependency = Annotated[ClientIdentity, Depends(require_client_write)]


@router.post(
    "/public/workspaces/{slug}/client-sign-in",
    response_model=Accepted,
    operation_id="requestClientSignIn",
)
async def request_sign_in(
    slug: str,
    payload: ClientSignIn,
    request: Request,
    database: DatabaseDependency,
    settings: SettingsDependency,
) -> Accepted:
    require_trusted_origin(request, settings)
    repository = AuthRepository(database)
    keys = [
        ("client_sign_in_ip", request.client.host if request.client else "unknown", 10, 900),
        ("client_sign_in_email", f"{slug}:{str(payload.email).strip().lower()}", 5, 3600),
    ]
    for scope, key, limit, window in keys:
        allowed = await repository.consume_rate_limit(
            scope=scope, key_hash=sha256(key.encode()).digest(), limit=limit, window_seconds=window
        )
        if not allowed:
            return Accepted()
    token = issue_opaque_token()
    url = f"{settings.public_web_base_url}/client/{slug}/sign-in#{token}"
    copy = COMMUNICATION_COPY[payload.language]["client_sign_in"]
    async with database.transaction() as session:
        await session.execute(
            text(
                "SELECT "
                "public.slotera_client_login_issue(:slug,:email,:hash,:url,:language,:subject,:body)"
            ),
            {
                "slug": slug,
                "email": str(payload.email).strip().lower(),
                "hash": hash_opaque_token(token),
                "url": url,
                "language": payload.language,
                "subject": copy[0],
                "body": copy[1],
            },
        )
    return Accepted()


@router.post(
    "/client/auth/consume", response_model=ClientIdentity, operation_id="consumeClientSignIn"
)
async def consume_sign_in(
    payload: ClientLink,
    request: Request,
    response: Response,
    database: DatabaseDependency,
    settings: SettingsDependency,
) -> ClientIdentity:
    require_trusted_origin(request, settings)
    allowed = await AuthRepository(database).consume_rate_limit(
        scope="client_link_consume",
        key_hash=sha256((request.client.host if request.client else "unknown").encode()).digest(),
        limit=30,
        window_seconds=60,
    )
    if not allowed:
        raise invalid_session()
    token, csrf = issue_opaque_token(), issue_opaque_token()
    async with database.transaction() as session:
        value = await session.scalar(
            text("SELECT public.slotera_client_login_consume(:link,:token,:csrf)"),
            {
                "link": hash_opaque_token(payload.token),
                "token": hash_opaque_token(token),
                "csrf": hash_opaque_token(csrf),
            },
        )
    result = identity_response(value)
    context = operation_context.get()
    if context:
        context.actor_id = str(result.client_id)
        context.workspace_id = str(result.workspace_id)
    response.headers["Cache-Control"] = "no-store"
    for name, value, httponly in [(SESSION_COOKIE, token, True), (CSRF_COOKIE, csrf, False)]:
        response.set_cookie(
            name,
            value,
            max_age=43200,
            path="/",
            httponly=httponly,
            secure=settings.secure_cookies,
            samesite="lax",
            domain=None if httponly else settings.csrf_cookie_domain,
        )
    return result


@router.get("/client/auth/session", response_model=ClientIdentity, operation_id="getClientSession")
async def get_session(response: Response, client: ClientDependency) -> ClientIdentity:
    response.headers["Cache-Control"] = "no-store"
    return client


@router.post("/client/auth/logout", status_code=204, operation_id="logoutClient")
async def logout(
    request: Request,
    response: Response,
    client: ClientWriteDependency,
    database: DatabaseDependency,
    settings: SettingsDependency,
) -> None:
    async with database.transaction() as session:
        await session.execute(
            text("SELECT public.slotera_client_logout(:token)"),
            {"token": hash_opaque_token(request.cookies[SESSION_COOKIE])},
        )
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/", domain=settings.csrf_cookie_domain)


@router.patch(
    "/client/preferences", response_model=ClientIdentity, operation_id="updateClientPreferences"
)
async def preferences(
    payload: ClientPreference,
    request: Request,
    response: Response,
    client: ClientWriteDependency,
    database: DatabaseDependency,
) -> ClientIdentity:
    async with database.transaction() as session:
        value = await session.scalar(
            text("SELECT public.slotera_client_preferences(:token,:language,:digest,:followup)"),
            {
                "token": hash_opaque_token(request.cookies[SESSION_COOKIE]),
                "language": payload.language,
                "digest": payload.message_digest_enabled,
                "followup": payload.automatic_followup_enabled,
            },
        )
    response.headers["Cache-Control"] = "no-store"
    return identity_response(value)


class ClientBooking(StrictApiModel):
    id: UUID
    reference: str
    status: Literal["pending", "confirmed", "completed", "cancelled", "noshow"]
    payment_status: Literal["pending", "paid", "refunded", "free", "overdue"]
    # "package": a session of the client's package covers it.
    payment_method: Literal["free", "manual", "package"]
    amount_cents: int
    refunded_cents: int
    currency: str
    start_at: datetime
    end_at: datetime
    service_name: str


class ClientBookings(StrictApiModel):
    items: list[ClientBooking]
    total: int
    limit: int
    offset: int


@router.get("/client/bookings", response_model=ClientBookings, operation_id="listClientBookings")
async def bookings(
    request: Request,
    response: Response,
    client: ClientDependency,
    database: DatabaseDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ClientBookings:
    async with database.transaction() as session:
        value = await session.scalar(
            text("SELECT public.slotera_client_bookings(:token,:limit,:offset)"),
            {
                "token": hash_opaque_token(request.cookies[SESSION_COOKIE]),
                "limit": limit,
                "offset": offset,
            },
        )
    if value is None:
        raise invalid_session()
    response.headers["Cache-Control"] = "no-store"
    return ClientBookings.model_validate(value)
