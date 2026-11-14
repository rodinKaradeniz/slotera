"""Small, validated client-page theme; no user CSS."""

from fastapi import APIRouter, Response
from sqlalchemy import select

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.db.models import AuditEvent, WorkspaceBusinessProfile
from slotera_api.editing import ExpectedVersionDependency, lock_settings_revision
from slotera_api.schemas.branding import Branding, BrandingSettings

router = APIRouter(prefix="/settings/branding", tags=["settings"])


@router.get("", response_model=BrandingSettings, operation_id="getBranding")
async def get_branding(
    response: Response, operator: OperatorWorkspaceDependency, database: DatabaseDependency
) -> BrandingSettings:
    response.headers["Cache-Control"] = "no-store"
    async with database.tenant_transaction(operator.workspace_id) as session:
        profile = (
            await session.scalars(
                select(WorkspaceBusinessProfile).where(
                    WorkspaceBusinessProfile.workspace_id == operator.workspace_id
                )
            )
        ).one()
        return BrandingSettings.model_validate(
            {
                "accent": profile.brand_accent,
                "fontFamily": profile.brand_font,
                "version": profile.version,
            }
        )


@router.patch("", response_model=BrandingSettings, operation_id="updateBranding")
async def update_branding(
    expected_version: ExpectedVersionDependency,
    payload: Branding,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> BrandingSettings:
    async with database.tenant_transaction(operator.workspace_id) as session:
        profile = await lock_settings_revision(session, operator.workspace_id, expected_version)
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
    return BrandingSettings(
        accent=profile.brand_accent, font_family=profile.brand_font, version=profile.version
    )
