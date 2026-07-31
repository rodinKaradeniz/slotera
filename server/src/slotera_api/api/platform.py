from http import HTTPStatus
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response

from slotera_api.auth.dependencies import (
    CsrfPlatformSuperadminDependency,
    DatabaseDependency,
    PlatformSuperadminDependency,
)
from slotera_api.errors import ApiError
from slotera_api.platform.repository import PlatformRepository, PlatformWorkspace
from slotera_api.schemas.platform import (
    PlatformWorkspaceDetail,
    PlatformWorkspaceListResponse,
    PlatformWorkspaceProvision,
    PlatformWorkspaceSummary,
)

router = APIRouter(prefix="/platform/workspaces", tags=["platform"])


def _summary(workspace: PlatformWorkspace) -> PlatformWorkspaceSummary:
    return PlatformWorkspaceSummary(
        id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        owner_name=workspace.owner_name,
        owner_email=workspace.owner_email,
        created_at=workspace.created_at,
        services_count=workspace.services_count,
        clients_count=workspace.clients_count,
        bookings_count=workspace.bookings_count,
        sessions_count=workspace.sessions_count,
    )


def _detail(workspace: PlatformWorkspace) -> PlatformWorkspaceDetail:
    return PlatformWorkspaceDetail(
        **_summary(workspace).model_dump(),
        currency=workspace.currency,
        timezone=workspace.timezone,
    )


@router.get("", response_model=PlatformWorkspaceListResponse, operation_id="listPlatformWorkspaces")
async def list_platform_workspaces(
    response: Response,
    _superadmin: PlatformSuperadminDependency,
    database: DatabaseDependency,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PlatformWorkspaceListResponse:
    items = await PlatformRepository(database).list_workspaces(limit=limit, offset=offset)
    response.headers["Cache-Control"] = "no-store"
    return PlatformWorkspaceListResponse(
        items=[_summary(item) for item in items], limit=limit, offset=offset
    )


@router.post(
    "",
    response_model=PlatformWorkspaceDetail,
    status_code=HTTPStatus.CREATED,
    operation_id="provisionPlatformWorkspace",
)
async def provision_platform_workspace(
    payload: PlatformWorkspaceProvision,
    response: Response,
    superadmin: CsrfPlatformSuperadminDependency,
    database: DatabaseDependency,
) -> PlatformWorkspaceDetail:
    repository = PlatformRepository(database)
    result_code, workspace_id = await repository.provision_workspace(
        actor_user_id=superadmin.user_id,
        **payload.model_dump(),
    )
    conflicts = {
        "workspace_slug_reserved": (
            "workspace_slug_reserved",
            "Workspace slug is reserved",
        ),
        "workspace_slug_taken": (
            "workspace_slug_taken",
            "Workspace slug is already in use",
        ),
        "workspace_owner_email_taken": (
            "workspace_owner_email_taken",
            "Owner email is already in use",
        ),
    }
    if result_code in conflicts:
        code, message = conflicts[result_code]
        raise ApiError(status_code=HTTPStatus.CONFLICT, code=code, message=message)
    if result_code == "actor_not_superadmin":
        raise ApiError(
            status_code=HTTPStatus.FORBIDDEN,
            code="platform_superadmin_required",
            message="A platform superadmin is required",
        )
    if result_code != "created":
        raise RuntimeError(f"unexpected platform provisioning result: {result_code}")
    workspace = await repository.get_workspace(workspace_id)
    if workspace is None:
        raise RuntimeError("provisioned workspace was not readable")
    response.headers["Cache-Control"] = "no-store"
    return _detail(workspace)


@router.get(
    "/{workspace_id}",
    response_model=PlatformWorkspaceDetail,
    operation_id="getPlatformWorkspace",
)
async def get_platform_workspace(
    workspace_id: UUID,
    response: Response,
    _superadmin: PlatformSuperadminDependency,
    database: DatabaseDependency,
) -> PlatformWorkspaceDetail:
    workspace = await PlatformRepository(database).get_workspace(workspace_id)
    if workspace is None:
        raise ApiError(
            status_code=HTTPStatus.NOT_FOUND,
            code="platform_workspace_not_found",
            message="Workspace was not found",
        )
    response.headers["Cache-Control"] = "no-store"
    return _detail(workspace)
