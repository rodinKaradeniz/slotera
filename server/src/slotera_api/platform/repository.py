from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text

from slotera_api.database import Database


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
        services_count=int(row["services_count"]),
        clients_count=int(row["clients_count"]),
        bookings_count=int(row["bookings_count"]),
        sessions_count=int(row["sessions_count"]),
    )


class PlatformRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def list_workspaces(
        self, *, limit: int, offset: int
    ) -> list[PlatformWorkspace]:
        async with self.database.transaction() as session:
            rows = (
                await session.execute(
                    text(
                        "SELECT * FROM public.slotera_platform_list_workspaces("
                        ":limit, :offset)"
                    ),
                    {"limit": limit, "offset": offset},
                )
            ).mappings()
            return [_workspace(row) for row in rows]

    async def get_workspace(self, workspace_id: UUID) -> PlatformWorkspace | None:
        async with self.database.transaction() as session:
            row = (
                await session.execute(
                    text(
                        "SELECT * FROM public.slotera_platform_get_workspace("
                        ":workspace_id)"
                    ),
                    {"workspace_id": workspace_id},
                )
            ).mappings().one_or_none()
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
        return str(result_code), workspace_id
