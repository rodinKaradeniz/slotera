from datetime import UTC, datetime
from http import HTTPStatus

from fastapi import APIRouter, Request, Response

from slotera_api.auth.dependencies import (
    AuthenticatedRequestDependency,
    AuthServiceDependency,
    CsrfProtectedRequestDependency,
    SettingsDependency,
    require_trusted_origin,
)
from slotera_api.auth.service import (
    AccountUnavailable,
    AuthResult,
    AuthSession,
    InvalidCredentials,
    WorkspaceSelectionRequired,
)
from slotera_api.config import Settings
from slotera_api.errors import ApiError
from slotera_api.schemas.auth import (
    LoginRequest,
    SessionResponse,
    SessionUser,
    SessionWorkspace,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _session_response(session: AuthSession) -> SessionResponse:
    name = " ".join(
        part for part in (session.title, session.first_names, session.last_name) if part
    )
    workspace = None
    if (
        session.workspace_id is not None
        and session.workspace_name is not None
        and session.workspace_slug is not None
    ):
        workspace = SessionWorkspace(
            id=session.workspace_id,
            name=session.workspace_name,
            slug=session.workspace_slug,
        )
    return SessionResponse(
        user=SessionUser(
            id=session.user_id,
            email=session.email,
            title=session.title,
            first_names=session.first_names,
            last_name=session.last_name,
            name=name,
            role=session.role,
        ),
        workspace=workspace,
        expires_at=session.expires_at,
    )


def _set_auth_cookies(
    response: Response,
    result: AuthResult,
    settings: Settings,
) -> None:
    max_age = max(
        0,
        int((result.session.expires_at - datetime.now(UTC)).total_seconds()),
    )
    response.set_cookie(
        key=settings.session_cookie_name,
        value=result.session_token,
        max_age=max_age,
        path="/",
        secure=settings.secure_cookies,
        httponly=True,
        samesite="lax",
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=result.csrf_token,
        max_age=max_age,
        path="/",
        domain=settings.csrf_cookie_domain,
        secure=settings.secure_cookies,
        httponly=False,
        samesite="lax",
    )


def _clear_auth_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        settings.session_cookie_name,
        path="/",
        secure=settings.secure_cookies,
        httponly=True,
        samesite="lax",
    )
    response.delete_cookie(
        settings.csrf_cookie_name,
        path="/",
        domain=settings.csrf_cookie_domain,
        secure=settings.secure_cookies,
        httponly=False,
        samesite="lax",
    )


@router.post("/login", response_model=SessionResponse, operation_id="login")
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    service: AuthServiceDependency,
    settings: SettingsDependency,
) -> SessionResponse:
    require_trusted_origin(request, settings)
    try:
        result = await service.login(
            email=str(payload.email),
            password=payload.password,
            remember_me=payload.remember_me,
            workspace_id=payload.workspace_id,
        )
    except InvalidCredentials as exc:
        raise ApiError(
            status_code=HTTPStatus.UNAUTHORIZED,
            code="invalid_credentials",
            message="Email or password is incorrect",
        ) from exc
    except WorkspaceSelectionRequired as exc:
        raise ApiError(
            status_code=HTTPStatus.CONFLICT,
            code="workspace_selection_required",
            message="Choose a workspace to continue",
        ) from exc
    except AccountUnavailable as exc:
        raise ApiError(
            status_code=HTTPStatus.FORBIDDEN,
            code="account_unavailable",
            message="This account is not available",
        ) from exc
    _set_auth_cookies(response, result, settings)
    response.headers["Cache-Control"] = "no-store"
    return _session_response(result.session)


@router.get("/session", response_model=SessionResponse, operation_id="getCurrentSession")
async def get_current_session(
    response: Response,
    authenticated: AuthenticatedRequestDependency,
) -> SessionResponse:
    response.headers["Cache-Control"] = "no-store"
    return _session_response(authenticated.session)


@router.post(
    "/logout",
    status_code=HTTPStatus.NO_CONTENT,
    response_class=Response,
    operation_id="logout",
)
async def logout(
    authenticated: CsrfProtectedRequestDependency,
    service: AuthServiceDependency,
    settings: SettingsDependency,
) -> Response:
    await service.revoke(authenticated.session_token)
    response = Response(status_code=HTTPStatus.NO_CONTENT)
    response.headers["Cache-Control"] = "no-store"
    _clear_auth_cookies(response, settings)
    return response
