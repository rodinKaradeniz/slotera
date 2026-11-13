"""Small, validated client-page theme; no user CSS."""

from fastapi import APIRouter, Response
from sqlalchemy import select

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.db.models import AuditEvent, WorkspaceBusinessProfile
from slotera_api.schemas.branding import Branding

router = APIRouter(prefix="/settings/branding", tags=["settings"])


@router.get("", response_model=Branding, operation_id="getBranding")
async def get_branding(
    response: Response, operator: OperatorWorkspaceDependency, database: DatabaseDependency
) -> Branding:
    response.headers["Cache-Control"] = "no-store"
    async with database.tenant_transaction(operator.workspace_id) as session:
        profile = (
            await session.scalars(
                select(WorkspaceBusinessProfile).where(
                    WorkspaceBusinessProfile.workspace_id == operator.workspace_id
                )
            )
        ).one()
        return Branding.model_validate(
            {"accent": profile.brand_accent, "fontFamily": profile.brand_font}
        )


@router.patch("", response_model=Branding, operation_id="updateBranding")
async def update_branding(
    payload: Branding,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> Branding:
    async with database.tenant_transaction(operator.workspace_id) as session:
        profile = (
            await session.scalars(
                select(WorkspaceBusinessProfile)
                .where(WorkspaceBusinessProfile.workspace_id == operator.workspace_id)
                .with_for_update()
            )
        ).one()
        profile.brand_accent = payload.accent
        profile.brand_font = payload.font_family
        session.add(
            AuditEvent(
                workspace_id=operator.workspace_id,
                actor_user_id=operator.user_id,
                action="branding.updated",
                resource_type="workspace",
                resource_id=operator.workspace_id,
                details={},
            )
        )
    response.headers["Cache-Control"] = "no-store"
    return payload
