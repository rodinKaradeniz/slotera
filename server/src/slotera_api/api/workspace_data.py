"""Settings → Account: export all workspace data, and close the workspace."""

from datetime import UTC, datetime
from http import HTTPStatus
from typing import Any

from fastapi import APIRouter, Response
from pydantic import Field

from slotera_api.api.auth import _clear_auth_cookies
from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
    SettingsDependency,
)
from slotera_api.errors import ApiError
from slotera_api.schemas.base import ApiModel
from slotera_api.workspace_data import CLOSURE_GRACE_DAYS, WorkspaceDataRepository

router = APIRouter(prefix="/settings", tags=["settings"])


class WorkspaceExportResponse(ApiModel):
    exported_at: datetime
    # Table name → rows, as stored. Hash columns are never included.
    tables: dict[str, list[dict[str, Any]]]


class WorkspaceClose(ApiModel):
    # Typing the booking page address confirms the operator means it.
    confirm_slug: str = Field(min_length=1, max_length=100)


class WorkspaceClosed(ApiModel):
    deleted_after_days: int


@router.get(
    "/workspace-export",
    response_model=WorkspaceExportResponse,
    operation_id="exportWorkspace",
)
async def export_workspace(
    response: Response, operator: OperatorWorkspaceDependency, database: DatabaseDependency
) -> WorkspaceExportResponse:
    tables = await WorkspaceDataRepository(database).export(operator.workspace_id)
    response.headers["Cache-Control"] = "no-store"
    return WorkspaceExportResponse(exported_at=datetime.now(UTC), tables=tables)


@router.post(
    "/close-workspace",
    response_model=WorkspaceClosed,
    operation_id="closeWorkspace",
)
async def close_workspace(
    payload: WorkspaceClose,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    settings: SettingsDependency,
) -> WorkspaceClosed:
    repository = WorkspaceDataRepository(database)
    slug = await repository.slug(operator.workspace_id)
    if slug is None or payload.confirm_slug.strip().lower() != slug:
        raise ApiError(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            code="workspace_close_confirmation_mismatch",
            message="Type your booking page address exactly to confirm",
        )
    result_code = await repository.request_closure(
        workspace_id=operator.workspace_id, actor_user_id=operator.user_id
    )
    if result_code != "closing":
        raise ApiError(
            status_code=HTTPStatus.CONFLICT,
            code="workspace_close_unavailable",
            message="This workspace can't be closed right now",
        )
    # Every session of this workspace is revoked, including this one.
    _clear_auth_cookies(response, settings)
    response.headers["Cache-Control"] = "no-store"
    return WorkspaceClosed(deleted_after_days=CLOSURE_GRACE_DAYS)
