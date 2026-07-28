import asyncio
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid5

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from slotera_api.config import get_migration_settings
from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    MembershipRole,
    PlatformRole,
    ReservedWorkspaceSlug,
    User,
    Workspace,
    WorkspaceMembership,
)

SEED_NAMESPACE = UUID("7d4fc57d-793e-4de1-82f0-950f27f1b1e8")
RESERVED_WORKSPACE_SLUGS = (
    "admin",
    "api",
    "app",
    "booking",
    "help",
    "login",
    "register",
    "settings",
    "superadmin",
    "support",
    "www",
)


def _seed_id(name: str) -> UUID:
    return uuid5(SEED_NAMESPACE, name)


@dataclass(frozen=True)
class UserSeed:
    id: UUID
    email: str
    title: str | None
    first_names: str
    last_name: str
    platform_role: str | None
    created_at: datetime


@dataclass(frozen=True)
class WorkspaceSeed:
    id: UUID
    name: str
    slug: str
    currency: str
    timezone: str
    created_at: datetime


@dataclass(frozen=True)
class MembershipSeed:
    id: UUID
    role: str


@dataclass(frozen=True)
class DemoSeed:
    operator: UserSeed
    superadmin: UserSeed
    workspace: WorkspaceSeed
    operator_membership: MembershipSeed


@dataclass(frozen=True)
class SeedSummary:
    users_inserted: int
    workspaces_inserted: int
    memberships_inserted: int
    audit_events_inserted: int
    reserved_slugs_inserted: int

    @property
    def total_inserted(self) -> int:
        return sum(asdict(self).values())


DEMO_SEED = DemoSeed(
    operator=UserSeed(
        id=_seed_id("user:operator:lena"),
        email="hello@slotera.app",
        title="Dr.",
        first_names="Lena Maria",
        last_name="Hartmann",
        platform_role=None,
        created_at=datetime(2025, 9, 1, 10, tzinfo=UTC),
    ),
    superadmin=UserSeed(
        id=_seed_id("user:superadmin:avery"),
        email="admin@slotera.app",
        title=None,
        first_names="Avery",
        last_name="Quinn",
        platform_role=PlatformRole.SUPERADMIN.value,
        created_at=datetime(2025, 5, 1, 10, tzinfo=UTC),
    ),
    workspace=WorkspaceSeed(
        id=_seed_id("workspace:hartmann-strategy"),
        name="Hartmann Strategy",
        slug="lena",
        currency="EUR",
        timezone="Europe/Berlin",
        created_at=datetime(2025, 9, 1, 10, tzinfo=UTC),
    ),
    operator_membership=MembershipSeed(
        id=_seed_id("membership:hartmann-strategy:lena"),
        role=MembershipRole.OPERATOR_ADMIN.value,
    ),
)


async def import_demo_seed(database: Database) -> SeedSummary:
    async with database.transaction() as session:
        inserted_users = 0
        for user in (DEMO_SEED.operator, DEMO_SEED.superadmin):
            inserted_users += len(
                (
                    await session.scalars(
                        insert(User)
                        .values(
                            id=user.id,
                            email=user.email,
                            title=user.title,
                            first_names=user.first_names,
                            last_name=user.last_name,
                            platform_role=user.platform_role,
                            created_at=user.created_at,
                            updated_at=user.created_at,
                        )
                        .on_conflict_do_nothing()
                        .returning(User.id)
                    )
                ).all()
            )

        workspace = DEMO_SEED.workspace
        inserted_workspaces = len(
            (
                await session.scalars(
                    insert(Workspace)
                    .values(
                        id=workspace.id,
                        name=workspace.name,
                        slug=workspace.slug,
                        currency=workspace.currency,
                        timezone=workspace.timezone,
                        created_at=workspace.created_at,
                        updated_at=workspace.created_at,
                    )
                    .on_conflict_do_nothing()
                    .returning(Workspace.id)
                )
            ).all()
        )

        operator_id = await session.scalar(
            select(User.id).where(User.email == DEMO_SEED.operator.email)
        )
        workspace_id = await session.scalar(
            select(Workspace.id).where(Workspace.slug == workspace.slug)
        )
        if operator_id is None or workspace_id is None:
            raise RuntimeError("demo identity seed could not resolve its natural keys")

        membership = DEMO_SEED.operator_membership
        inserted_memberships = len(
            (
                await session.scalars(
                    insert(WorkspaceMembership)
                    .values(
                        id=membership.id,
                        workspace_id=workspace_id,
                        user_id=operator_id,
                        role=membership.role,
                        created_at=workspace.created_at,
                        updated_at=workspace.created_at,
                    )
                    .on_conflict_do_nothing()
                    .returning(WorkspaceMembership.id)
                )
            ).all()
        )

        inserted_audit_events = len(
            (
                await session.scalars(
                    insert(AuditEvent)
                    .values(
                        id=_seed_id("audit:hartmann-strategy:provisioned"),
                        workspace_id=workspace_id,
                        actor_user_id=operator_id,
                        action="workspace.provisioned",
                        resource_type="workspace",
                        resource_id=workspace_id,
                        details={"source": "demo_seed"},
                        occurred_at=workspace.created_at,
                    )
                    .on_conflict_do_nothing()
                    .returning(AuditEvent.id)
                )
            ).all()
        )

        inserted_reserved_slugs = len(
            (
                await session.scalars(
                    insert(ReservedWorkspaceSlug)
                    .values(
                        [
                            {"slug": slug, "reason": "platform route"}
                            for slug in RESERVED_WORKSPACE_SLUGS
                        ]
                    )
                    .on_conflict_do_nothing()
                    .returning(ReservedWorkspaceSlug.slug)
                )
            ).all()
        )

    return SeedSummary(
        users_inserted=inserted_users,
        workspaces_inserted=inserted_workspaces,
        memberships_inserted=inserted_memberships,
        audit_events_inserted=inserted_audit_events,
        reserved_slugs_inserted=inserted_reserved_slugs,
    )


async def _run_seed() -> SeedSummary:
    settings = get_migration_settings()
    if settings.environment == "production":
        raise RuntimeError("the demo seed importer is disabled in production")

    database = Database(settings.migration_database_url)
    try:
        return await import_demo_seed(database)
    finally:
        await database.dispose()


def main() -> None:
    summary = asyncio.run(_run_seed())
    print(json.dumps({**asdict(summary), "total_inserted": summary.total_inserted}))


if __name__ == "__main__":
    main()
