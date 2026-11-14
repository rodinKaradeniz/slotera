"""Reviewed edit preconditions, distinct from idempotent booking state commands."""

from typing import Annotated, Protocol
from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.db.models import WorkspaceBusinessProfile
from slotera_api.errors import ApiError


class VersionedRecord(Protocol):
    version: int


def ensure_version(record: VersionedRecord, expected: int | None) -> None:
    if expected is not None and record.version != expected:
        raise ApiError(
            status_code=409,
            code="resource_stale",
            message=(
                "This item changed elsewhere. Your draft is kept; "
                "review the latest version before saving."
            ),
        )


def reviewed_version(
    value: Annotated[str, Header(alias="If-Match", pattern=r'^"v[1-9][0-9]*"$')],
) -> int:
    return int(value[2:-1])


ExpectedVersionDependency = Annotated[int, Depends(reviewed_version)]


async def lock_settings_revision(
    session: "AsyncSession", workspace_id: "UUID", expected: int | None
) -> "WorkspaceBusinessProfile":
    """Serialize all settings sections through their shared aggregate root."""
    profile = (
        await session.scalars(
            select(WorkspaceBusinessProfile)
            .where(WorkspaceBusinessProfile.workspace_id == workspace_id)
            .with_for_update()
        )
    ).one()
    ensure_version(profile, expected)
    profile.version += 1
    return profile
