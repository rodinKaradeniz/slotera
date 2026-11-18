from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Query, Request, Response
from pydantic import Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
    SettingsDependency,
)
from slotera_api.client_access.api import (
    SESSION_COOKIE,
    ClientDependency,
    ClientWriteDependency,
)
from slotera_api.errors import ApiError
from slotera_api.identity import hash_opaque_token, issue_opaque_token
from slotera_api.schemas.operator_resources import NonBlank, StrictApiModel

router = APIRouter(tags=["conversations"])


class Message(StrictApiModel):
    id: UUID
    sequence: int
    sender_kind: Literal["client", "operator"]
    body: str
    created_at: datetime


class MessagePage(StrictApiModel):
    items: list[Message]
    latest_sequence: int
    read_through: int
    limit: int


class MessageSend(StrictApiModel):
    submission_id: UUID
    body: NonBlank = Field(max_length=4000)


class ReadThrough(StrictApiModel):
    sequence: int = Field(ge=0)


class ConversationSummary(StrictApiModel):
    client_id: UUID
    client_name: str
    last_sequence: int
    unread_count: int
    # The newest message, shortened for the list: who sent it, when, and its first words.
    last_message_preview: str
    last_message_at: datetime
    last_message_from: Literal["client", "operator"]


class ConversationPage(StrictApiModel):
    items: list[ConversationSummary]
    total: int
    limit: int
    offset: int


async def read_messages(
    session: AsyncSession,
    token: bytes | None,
    client_id: UUID | None,
    before: int | None,
    after: int | None,
    limit: int,
) -> MessagePage:
    value = await session.scalar(
        text("SELECT public.slotera_conversation_messages(:token,:client,:before,:after,:limit)"),
        {"token": token, "client": client_id, "before": before, "after": after, "limit": limit},
    )
    if value is None:
        raise ApiError(
            status_code=404, code="conversation_not_found", message="Conversation was not found."
        )
    return MessagePage.model_validate(value)


async def send_message(
    session: AsyncSession,
    token: bytes | None,
    client_id: UUID | None,
    payload: MessageSend,
) -> Message:
    value = await session.scalar(
        text("SELECT public.slotera_conversation_send(:token,:client,:submission,:body)"),
        {
            "token": token,
            "client": client_id,
            "submission": payload.submission_id,
            "body": payload.body,
        },
    )
    if value is None:
        raise ApiError(
            status_code=404, code="conversation_not_found", message="Conversation was not found."
        )
    if "error" in value:
        code = value["error"]
        raise ApiError(
            status_code=429 if code == "rate_limit_exceeded" else 409,
            code=code,
            message="Wait and try again."
            if code == "rate_limit_exceeded"
            else "This submission changed; review and retry.",
        )
    return Message.model_validate(value)


async def mark_read(
    session: AsyncSession, token: bytes | None, client_id: UUID | None, sequence: int
) -> None:
    value = await session.scalar(
        text("SELECT public.slotera_conversation_mark_read(:token,:client,:sequence)"),
        {"token": token, "client": client_id, "sequence": sequence},
    )
    if not value:
        raise ApiError(
            status_code=404, code="conversation_not_found", message="Conversation was not found."
        )


@router.get("/conversations", response_model=ConversationPage, operation_id="listConversations")
async def conversations(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ConversationPage:
    async with database.principal_transaction(operator.workspace_id, operator.user_id) as session:
        total = await session.scalar(
            text("SELECT count(*) FROM client_conversations WHERE workspace_id=:wid"),
            {"wid": operator.workspace_id},
        )
        rows = (
            (
                await session.execute(
                    text("""
          SELECT c.client_id AS "clientId",cl.name AS "clientName",c.last_sequence AS 
"lastSequence",
            left(regexp_replace(latest.body, '\\s+', ' ', 'g'), 140) AS "lastMessagePreview",
            latest.created_at AS "lastMessageAt",latest.sender_kind AS "lastMessageFrom",
            (SELECT count(*) FROM conversation_messages m WHERE m.workspace_id=c.workspace_id
             AND m.conversation_id=c.id AND m.sender_kind='client' AND 
m.sequence>coalesce(r.last_read,0)) AS "unreadCount"
          FROM client_conversations c JOIN clients cl ON cl.workspace_id=c.workspace_id 
AND cl.id=c.client_id
          JOIN conversation_messages latest ON latest.workspace_id=c.workspace_id
            AND latest.conversation_id=c.id AND latest.sequence=c.last_sequence
          LEFT JOIN conversation_reads r ON r.workspace_id=c.workspace_id AND 
r.conversation_id=c.id AND r.actor_key=:actor
          WHERE c.workspace_id=:wid AND cl.erased_at IS NULL
          ORDER BY latest.created_at DESC,c.id LIMIT :limit OFFSET :offset
        """),
                    {
                        "wid": operator.workspace_id,
                        "actor": f"operator:{operator.user_id}",
                        "limit": limit,
                        "offset": offset,
                    },
                )
            )
            .mappings()
            .all()
        )
    response.headers["Cache-Control"] = "no-store"
    return ConversationPage(
        items=[ConversationSummary.model_validate(dict(row)) for row in rows],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/clients/{client_id}/conversation/messages",
    response_model=MessagePage,
    operation_id="listOperatorMessages",
)
async def operator_messages(
    client_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    before: Annotated[int | None, Query(ge=1)] = None,
    after: Annotated[int | None, Query(ge=0)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> MessagePage:
    async with database.principal_transaction(operator.workspace_id, operator.user_id) as session:
        result = await read_messages(session, None, client_id, before, after, limit)
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post(
    "/clients/{client_id}/conversation/messages",
    response_model=Message,
    operation_id="sendOperatorMessage",
)
async def operator_send(
    client_id: UUID,
    payload: MessageSend,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> Message:
    async with database.principal_transaction(operator.workspace_id, operator.user_id) as session:
        result = await send_message(session, None, client_id, payload)
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post(
    "/clients/{client_id}/conversation/read", status_code=204, operation_id="readOperatorMessages"
)
async def operator_read(
    client_id: UUID,
    payload: ReadThrough,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> None:
    async with database.principal_transaction(operator.workspace_id, operator.user_id) as session:
        await mark_read(session, None, client_id, payload.sequence)


@router.get(
    "/client/conversation/messages", response_model=MessagePage, operation_id="listClientMessages"
)
async def client_messages(
    request: Request,
    response: Response,
    client: ClientDependency,
    database: DatabaseDependency,
    before: Annotated[int | None, Query(ge=1)] = None,
    after: Annotated[int | None, Query(ge=0)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> MessagePage:
    async with database.transaction() as session:
        result = await read_messages(
            session, hash_opaque_token(request.cookies[SESSION_COOKIE]), None, before, after, limit
        )
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post(
    "/client/conversation/messages", response_model=Message, operation_id="sendClientMessage"
)
async def client_send(
    payload: MessageSend,
    request: Request,
    response: Response,
    client: ClientWriteDependency,
    database: DatabaseDependency,
) -> Message:
    async with database.transaction() as session:
        result = await send_message(
            session, hash_opaque_token(request.cookies[SESSION_COOKIE]), None, payload
        )
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post("/client/conversation/read", status_code=204, operation_id="readClientMessages")
async def client_read(
    payload: ReadThrough,
    request: Request,
    client: ClientWriteDependency,
    database: DatabaseDependency,
) -> None:
    async with database.transaction() as session:
        await mark_read(
            session, hash_opaque_token(request.cookies[SESSION_COOKIE]), None, payload.sequence
        )


class ManagementAccess(StrictApiModel):
    url: str


@router.post(
    "/client/bookings/{booking_id}/management-access",
    response_model=ManagementAccess,
    operation_id="clientBookingManagementAccess",
)
async def management_access(
    booking_id: UUID,
    request: Request,
    response: Response,
    client: ClientWriteDependency,
    database: DatabaseDependency,
    settings: SettingsDependency,
) -> ManagementAccess:
    token = issue_opaque_token()
    async with database.transaction() as session:
        accepted = await session.scalar(
            text("SELECT public.slotera_client_booking_access(:session,:booking,:token)"),
            {
                "session": hash_opaque_token(request.cookies[SESSION_COOKIE]),
                "booking": booking_id,
                "token": hash_opaque_token(token),
            },
        )
    if not accepted:
        raise ApiError(status_code=404, code="booking_not_found", message="Booking was not found.")
    response.headers["Cache-Control"] = "no-store"
    return ManagementAccess(url=f"{settings.public_web_base_url}/booking/manage#{token}")


class DigestPreference(StrictApiModel):
    version: int
    enabled: bool


@router.get(
    "/settings/message-digest",
    response_model=DigestPreference,
    operation_id="getMessageDigestPreference",
)
async def get_digest_preference(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> DigestPreference:
    from slotera_api.db.models import WorkspaceBusinessProfile

    async with database.tenant_transaction(operator.workspace_id) as session:
        profile = await session.get(WorkspaceBusinessProfile, operator.workspace_id)
        assert profile is not None
        result = DigestPreference(version=profile.version, enabled=profile.notify_operator_messages)
    response.headers["Cache-Control"] = "no-store"
    return result


@router.patch(
    "/settings/message-digest",
    response_model=DigestPreference,
    operation_id="setMessageDigestPreference",
)
async def set_digest_preference(
    payload: DigestPreference,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> DigestPreference:
    from slotera_api.editing import lock_settings_revision

    async with database.tenant_transaction(operator.workspace_id) as session:
        profile = await lock_settings_revision(session, operator.workspace_id, payload.version)
        profile.notify_operator_messages = payload.enabled
        await session.flush()
        result = DigestPreference(version=profile.version, enabled=profile.notify_operator_messages)
    response.headers["Cache-Control"] = "no-store"
    return result
