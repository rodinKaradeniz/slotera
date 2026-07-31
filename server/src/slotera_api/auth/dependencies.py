from dataclasses import dataclass
from hmac import compare_digest
from http import HTTPStatus
from typing import Annotated, cast
from uuid import UUID

from fastapi import Depends, Request

from slotera_api.auth.service import AuthServiceProtocol, AuthSession
from slotera_api.config import Settings
from slotera_api.database import Database
from slotera_api.errors import ApiError


@dataclass(frozen=True)
class AuthenticatedRequest:
    session_token: str
    session: AuthSession


@dataclass(frozen=True)
class OperatorWorkspaceRequest:
    authenticated: AuthenticatedRequest
    workspace_id: UUID

    @property
    def user_id(self) -> UUID:
        return self.authenticated.session.user_id


@dataclass(frozen=True)
class PlatformSuperadminRequest:
    authenticated: AuthenticatedRequest

    @property
    def user_id(self) -> UUID:
        return self.authenticated.session.user_id


def get_auth_service(request: Request) -> AuthServiceProtocol:
    return cast(AuthServiceProtocol, request.app.state.auth_service)


def get_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


def get_database(request: Request) -> Database:
    return cast(Database, request.app.state.database)


AuthServiceDependency = Annotated[AuthServiceProtocol, Depends(get_auth_service)]
SettingsDependency = Annotated[Settings, Depends(get_settings)]
DatabaseDependency = Annotated[Database, Depends(get_database)]


def require_trusted_origin(request: Request, settings: Settings) -> None:
    if request.headers.get("origin") not in settings.cors_origins:
        raise ApiError(
            status_code=HTTPStatus.FORBIDDEN,
            code="untrusted_origin",
            message="Request origin is not allowed",
        )


def authentication_required() -> ApiError:
    return ApiError(
        status_code=HTTPStatus.UNAUTHORIZED,
        code="authentication_required",
        message="Authentication is required",
    )


async def require_authenticated_request(
    request: Request,
    service: AuthServiceDependency,
    settings: SettingsDependency,
) -> AuthenticatedRequest:
    session_token = request.cookies.get(settings.session_cookie_name, "")
    if not session_token:
        raise authentication_required()
    session = await service.authenticate(session_token)
    if session is None:
        raise authentication_required()
    return AuthenticatedRequest(session_token=session_token, session=session)


AuthenticatedRequestDependency = Annotated[
    AuthenticatedRequest, Depends(require_authenticated_request)
]


async def require_csrf_protected_request(
    request: Request,
    authenticated: AuthenticatedRequestDependency,
    service: AuthServiceDependency,
    settings: SettingsDependency,
) -> AuthenticatedRequest:
    require_trusted_origin(request, settings)
    csrf_cookie = request.cookies.get(settings.csrf_cookie_name, "")
    csrf_header = request.headers.get("x-csrf-token", "")
    if (
        not csrf_cookie
        or not csrf_header
        or not compare_digest(csrf_cookie, csrf_header)
        or not service.csrf_matches(authenticated.session, csrf_cookie)
    ):
        raise ApiError(
            status_code=HTTPStatus.FORBIDDEN,
            code="csrf_validation_failed",
            message="CSRF validation failed",
        )
    return authenticated


CsrfProtectedRequestDependency = Annotated[
    AuthenticatedRequest, Depends(require_csrf_protected_request)
]


def _operator_workspace(authenticated: AuthenticatedRequest) -> OperatorWorkspaceRequest:
    session = authenticated.session
    if session.role != "operator_admin" or session.workspace_id is None:
        raise ApiError(
            status_code=HTTPStatus.FORBIDDEN,
            code="operator_workspace_required",
            message="An operator workspace is required",
        )
    return OperatorWorkspaceRequest(
        authenticated=authenticated,
        workspace_id=session.workspace_id,
    )


async def require_operator_workspace(
    authenticated: AuthenticatedRequestDependency,
) -> OperatorWorkspaceRequest:
    return _operator_workspace(authenticated)


async def require_csrf_operator_workspace(
    authenticated: CsrfProtectedRequestDependency,
) -> OperatorWorkspaceRequest:
    return _operator_workspace(authenticated)


OperatorWorkspaceDependency = Annotated[
    OperatorWorkspaceRequest, Depends(require_operator_workspace)
]
CsrfOperatorWorkspaceDependency = Annotated[
    OperatorWorkspaceRequest, Depends(require_csrf_operator_workspace)
]


async def require_platform_superadmin(
    authenticated: AuthenticatedRequestDependency,
) -> PlatformSuperadminRequest:
    return _platform_superadmin(authenticated)


def _platform_superadmin(authenticated: AuthenticatedRequest) -> PlatformSuperadminRequest:
    if authenticated.session.role != "superadmin":
        raise ApiError(
            status_code=HTTPStatus.FORBIDDEN,
            code="platform_superadmin_required",
            message="A platform superadmin is required",
        )
    return PlatformSuperadminRequest(authenticated=authenticated)


PlatformSuperadminDependency = Annotated[
    PlatformSuperadminRequest, Depends(require_platform_superadmin)
]


async def require_csrf_platform_superadmin(
    authenticated: CsrfProtectedRequestDependency,
) -> PlatformSuperadminRequest:
    return _platform_superadmin(authenticated)


CsrfPlatformSuperadminDependency = Annotated[
    PlatformSuperadminRequest, Depends(require_csrf_platform_superadmin)
]
