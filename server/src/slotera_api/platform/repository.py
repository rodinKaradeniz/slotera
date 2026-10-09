from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal, cast
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.database import Database
from slotera_api.plans import PlanId

WorkspaceOperationalStatus = Literal["active", "suspended"]


async def initialise_workspace_settings(session: AsyncSession, workspace_id: UUID) -> None:
    """Create a new workspace's tenant-owned defaults inside its own RLS context.

    Shared by superadmin provisioning and self-serve sign-up, in the same transaction
    that created the workspace.
    """
    await session.execute(
        text("SELECT set_config('app.current_workspace_id', :workspace_id, true)"),
        {"workspace_id": str(workspace_id)},
    )
    for table in ("workspace_payment_settings", "availability_policies"):
        await session.execute(
            text(f"INSERT INTO {table} (workspace_id) VALUES (:workspace_id)"),
            {"workspace_id": workspace_id},
        )


@dataclass(frozen=True)
class PlatformWorkspace:
    id: UUID
    name: str
    slug: str
    owner_name: str | None
    owner_email: str | None
    created_at: datetime
    currency: str
    timezone: str
    operational_status: WorkspaceOperationalStatus
    plan: PlanId
    services_count: int
    clients_count: int
    bookings_count: int
    sessions_count: int


def _workspace(row: Any) -> PlatformWorkspace:
    return PlatformWorkspace(
        id=row["id"],
        name=row["name"],
        slug=row["slug"],
        owner_name=row["owner_name"],
        owner_email=row["owner_email"],
        created_at=row["created_at"],
        currency=row["currency"],
        timezone=row["timezone"],
        operational_status=cast(WorkspaceOperationalStatus, row["operational_status"]),
        plan=cast(PlanId, row["plan"]),
        services_count=int(row["services_count"]),
        clients_count=int(row["clients_count"]),
        bookings_count=int(row["bookings_count"]),
        sessions_count=int(row["sessions_count"]),
    )


@dataclass(frozen=True)
class PlatformInquiry:
    id: UUID
    name: str
    email: str
    company: str | None
    reason: str
    message: str
    created_at: datetime
    read_at: datetime | None


@dataclass(frozen=True)
class PlatformOverview:
    workspaces_total: int
    workspaces_active: int
    workspaces_suspended: int
    workspaces_free: int
    workspaces_pro: int
    signups_30d: int
    bookings_30d: int
    inquiries_unread: int


class PlatformRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def list_workspaces(self, *, limit: int, offset: int) -> list[PlatformWorkspace]:
        async with self.database.transaction() as session:
            rows = (
                await session.execute(
                    text("SELECT * FROM public.slotera_platform_list_workspaces(:limit, :offset)"),
                    {"limit": limit, "offset": offset},
                )
            ).mappings()
            return [_workspace(row) for row in rows]

    async def get_workspace(self, workspace_id: UUID) -> PlatformWorkspace | None:
        async with self.database.transaction() as session:
            row = (
                (
                    await session.execute(
                        text("SELECT * FROM public.slotera_platform_get_workspace(:workspace_id)"),
                        {"workspace_id": workspace_id},
                    )
                )
                .mappings()
                .one_or_none()
            )
            return _workspace(row) if row is not None else None

    async def provision_workspace(
        self,
        *,
        actor_user_id: UUID,
        name: str,
        slug: str,
        owner_first_names: str,
        owner_last_name: str,
        owner_email: str,
        timezone: str,
    ) -> tuple[str, UUID]:
        workspace_id = uuid4()
        async with self.database.transaction() as session:
            result_code = await session.scalar(
                text(
                    """
                    SELECT public.slotera_platform_provision_workspace(
                      :workspace_id,
                      :owner_user_id,
                      :membership_id,
                      :audit_event_id,
                      :actor_user_id,
                      :name,
                      :slug,
                      :owner_first_names,
                      :owner_last_name,
                      :owner_email,
                      :timezone
                    )
                    """
                ),
                {
                    "workspace_id": workspace_id,
                    "owner_user_id": uuid4(),
                    "membership_id": uuid4(),
                    "audit_event_id": uuid4(),
                    "actor_user_id": actor_user_id,
                    "name": name,
                    "slug": slug,
                    "owner_first_names": owner_first_names,
                    "owner_last_name": owner_last_name,
                    "owner_email": owner_email,
                    "timezone": timezone,
                },
            )
            if result_code == "created":
                await initialise_workspace_settings(session, workspace_id)
        return str(result_code), workspace_id

    async def set_operational_status(
        self,
        *,
        workspace_id: UUID,
        actor_user_id: UUID,
        operational_status: str,
    ) -> str:
        async with self.database.transaction() as session:
            result_code = await session.scalar(
                text(
                    """
                    SELECT public.slotera_platform_set_workspace_operational_status(
                      :workspace_id,
                      :actor_user_id,
                      :operational_status,
                      :audit_event_id
                    )
                    """
                ),
                {
                    "workspace_id": workspace_id,
                    "actor_user_id": actor_user_id,
                    "operational_status": operational_status,
                    "audit_event_id": uuid4(),
                },
            )
        return str(result_code)

    async def set_plan(self, *, workspace_id: UUID, actor_user_id: UUID, plan: PlanId) -> str:
        async with self.database.transaction() as session:
            result_code = await session.scalar(
                text(
                    "SELECT public.slotera_platform_set_workspace_plan("
                    ":workspace_id, :actor_user_id, :plan, :audit_event_id)"
                ),
                {
                    "workspace_id": workspace_id,
                    "actor_user_id": actor_user_id,
                    "plan": plan,
                    "audit_event_id": uuid4(),
                },
            )
        return str(result_code)

    async def create_inquiry(
        self, *, name: str, email: str, company: str | None, reason: str, message: str
    ) -> None:
        async with self.database.transaction() as session:
            await session.execute(
                text(
                    "SELECT public.slotera_public_create_inquiry("
                    ":id, :name, :email, :company, :reason, :message)"
                ),
                {
                    "id": uuid4(),
                    "name": name,
                    "email": email,
                    "company": company or "",
                    "reason": reason,
                    "message": message,
                },
            )

    async def list_inquiries(self, actor_user_id: UUID) -> list[PlatformInquiry]:
        async with self.database.transaction() as session:
            rows = (
                await session.execute(
                    text("SELECT * FROM public.slotera_platform_list_inquiries(:actor)"),
                    {"actor": actor_user_id},
                )
            ).mappings()
            return [PlatformInquiry(**row) for row in rows]

    async def set_inquiry_read(
        self, *, actor_user_id: UUID, inquiry_id: UUID, read: bool
    ) -> str:
        async with self.database.transaction() as session:
            result_code = await session.scalar(
                text(
                    "SELECT public.slotera_platform_mark_inquiry_read("
                    ":actor, :inquiry_id, :read)"
                ),
                {"actor": actor_user_id, "inquiry_id": inquiry_id, "read": read},
            )
        return str(result_code)

    async def overview(self, actor_user_id: UUID) -> PlatformOverview | None:
        async with self.database.transaction() as session:
            row = (
                (
                    await session.execute(
                        text("SELECT * FROM public.slotera_platform_overview(:actor)"),
                        {"actor": actor_user_id},
                    )
                )
                .mappings()
                .one_or_none()
            )
        return PlatformOverview(**row) if row is not None else None
