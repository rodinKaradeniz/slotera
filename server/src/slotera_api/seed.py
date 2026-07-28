import asyncio
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid5

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

from slotera_api.auth.passwords import PasswordHasher, create_password_hasher
from slotera_api.config import get_migration_settings
from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    MembershipRole,
    Notification,
    PlatformRole,
    ReservedWorkspaceSlug,
    Service,
    User,
    Workspace,
    WorkspaceBusinessProfile,
    WorkspaceLocation,
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
    passwords_set: int
    workspaces_inserted: int
    memberships_inserted: int
    audit_events_inserted: int
    reserved_slugs_inserted: int
    business_profiles_inserted: int
    locations_inserted: int
    services_inserted: int
    notifications_inserted: int

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

DEMO_LOCATIONS = (
    {
        "id": _seed_id("location:hartmann-strategy:mitte"),
        "label": "Mitte Studio",
        "street": "Rosenthaler Straße 40",
        "street2": "2nd floor",
        "city": "Berlin",
        "region": "Berlin",
        "postal_code": "10178",
        "country": "DE",
        "notes": "Buzzer for 'Hartmann Strategy' — second floor, glass door on the left.",
    },
    {
        "id": _seed_id("location:hartmann-strategy:kreuzberg"),
        "label": "Kreuzberg Studio",
        "street": "Oranienstraße 17",
        "street2": "",
        "city": "Berlin",
        "region": "Berlin",
        "postal_code": "10999",
        "country": "DE",
        "notes": "Mats and props provided. Please arrive 10 minutes early for class.",
    },
)

DEMO_SERVICES = (
    {
        "key": "discovery",
        "name": "Discovery Call",
        "description": "Quick intro chat to understand your goals and see if we're a fit.",
        "duration_min": 30,
        "price_cents": 0,
        "capacity": 1,
        "location_type": "online",
        "location": "Zoom · link sent on booking",
        "address": None,
        "booking_mode": "open",
        "cancellation_rule": (
            "Free reschedule up to 12h before. Free cancellation up to 2h before."
        ),
        "active": True,
        "notes": None,
        "created_at": datetime(2026, 1, 12, 10, tzinfo=UTC),
    },
    {
        "key": "strategy",
        "name": "Strategy Session",
        "description": (
            "Focused 90-minute working session on a specific decision, plan or initiative."
        ),
        "duration_min": 90,
        "price_cents": 38000,
        "capacity": 1,
        "location_type": "online",
        "location": "Zoom · link sent on confirmation",
        "address": None,
        "booking_mode": "open",
        "cancellation_rule": "Refundable up to 24h before. After that 50% refund.",
        "active": True,
        "notes": None,
        "created_at": datetime(2026, 1, 12, 10, tzinfo=UTC),
    },
    {
        "key": "coaching",
        "name": "Coaching Session",
        "description": (
            "A 60-minute 1:1 coaching session to work through a specific goal or challenge."
        ),
        "duration_min": 60,
        "price_cents": 24000,
        "capacity": 1,
        "location_type": "hybrid",
        "location": "Zoom or Berlin office · your choice",
        "address": None,
        "booking_mode": "open",
        "cancellation_rule": "Refundable up to 48h before.",
        "active": True,
        "notes": None,
        "created_at": datetime(2026, 1, 14, 10, tzinfo=UTC),
    },
    {
        "key": "workshop",
        "name": "Group Workshop",
        "description": (
            "Small-group, expert-led workshop — hands-on and capped for real interaction."
        ),
        "duration_min": 120,
        "price_cents": 18000,
        "capacity": 6,
        "location_type": "physical",
        "location": "Berlin · Mitte studio",
        "address": {
            "street": "Rosenthaler Straße 40",
            "street2": "2nd floor",
            "city": "Berlin",
            "region": "Berlin",
            "postal_code": "10178",
            "country": "DE",
            "notes": "Buzzer for the studio — second floor, glass door on the left.",
        },
        "booking_mode": "scheduled",
        "cancellation_rule": "Reschedule up to 5 days before. No refunds within 48h.",
        "active": True,
        "notes": (
            "Confirm projector + whiteboard markers the day before. Bring printed handouts "
            "(10 copies)."
        ),
        "created_at": datetime(2026, 2, 2, 10, tzinfo=UTC),
    },
    {
        "key": "office-hours",
        "name": "Monthly Office Hours",
        "description": (
            "A standing 45-minute slot for quick questions and follow-ups between sessions."
        ),
        "duration_min": 45,
        "price_cents": 9000,
        "capacity": 1,
        "location_type": "online",
        "location": "Zoom · link sent on confirmation",
        "address": None,
        "booking_mode": "open",
        "cancellation_rule": "Free reschedule up to 24h before.",
        "active": False,
        "notes": ("Currently paused — re-enable when there's capacity for retainer clients."),
        "created_at": datetime(2026, 2, 20, 10, tzinfo=UTC),
    },
)

DEMO_NOTIFICATIONS = (
    {
        "key": "booking-confirmed",
        "kind": "booking_confirmed",
        "payload": {
            "clientName": "Sofia Marin",
            "serviceName": "Strategy Session",
            "startsAt": "2026-07-28T14:00:00Z",
        },
        "resource_type": None,
        "resource_id": None,
        "occurred_at": datetime(2026, 7, 28, 10, tzinfo=UTC),
        "read_at": None,
    },
    {
        "key": "payment-pending",
        "kind": "payment_pending",
        "payload": {
            "clientName": "Helena Kreutzer",
            "serviceName": "Group Workshop",
            "amountCents": 18000,
            "currency": "EUR",
        },
        "resource_type": None,
        "resource_id": None,
        "occurred_at": datetime(2026, 7, 28, 9, tzinfo=UTC),
        "read_at": None,
    },
    {
        "key": "session-starting",
        "kind": "session_starting",
        "payload": {
            "clientName": "Mila Ozawa",
            "serviceName": "Strategy Session",
            "startsAt": "2026-07-28T12:14:00Z",
        },
        "resource_type": None,
        "resource_id": None,
        "occurred_at": datetime(2026, 7, 28, 8, tzinfo=UTC),
        "read_at": datetime(2026, 7, 28, 8, 10, tzinfo=UTC),
    },
    {
        "key": "reschedule-requested",
        "kind": "reschedule_requested",
        "payload": {
            "clientName": "Tariq Hassan",
            "serviceName": "Discovery Call",
            "requestedFor": "2026-07-30T09:00:00Z",
        },
        "resource_type": None,
        "resource_id": None,
        "occurred_at": datetime(2026, 7, 28, 7, tzinfo=UTC),
        "read_at": datetime(2026, 7, 28, 7, 15, tzinfo=UTC),
    },
)


async def import_demo_seed(
    database: Database,
    *,
    demo_password: str | None = None,
    password_hasher: PasswordHasher | None = None,
) -> SeedSummary:
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

        passwords_set = 0
        if demo_password is not None:
            hasher = password_hasher or create_password_hasher()
            for user in (DEMO_SEED.operator, DEMO_SEED.superadmin):
                passwords_set += len(
                    (
                        await session.scalars(
                            update(User)
                            .where(User.email == user.email, User.password_hash.is_(None))
                            .values(password_hash=hasher.hash(demo_password))
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

        inserted_business_profiles = len(
            (
                await session.scalars(
                    insert(WorkspaceBusinessProfile)
                    .values(
                        workspace_id=workspace_id,
                        display_name="Dr. Lena Hartmann",
                        bio=(
                            "Strategy advisor for early-stage founders. Berlin-based, working "
                            "with teams across Europe and the US."
                        ),
                        email="lena@hartmannstrategy.com",
                        phone="+49 30 12345678",
                        address="Mitte, Berlin · 10115",
                        booking_page_enabled=True,
                        created_at=workspace.created_at,
                        updated_at=workspace.created_at,
                    )
                    .on_conflict_do_nothing()
                    .returning(WorkspaceBusinessProfile.workspace_id)
                )
            ).all()
        )

        inserted_locations = len(
            (
                await session.scalars(
                    insert(WorkspaceLocation)
                    .values(
                        [
                            {
                                **location,
                                "workspace_id": workspace_id,
                                "created_at": workspace.created_at,
                                "updated_at": workspace.created_at,
                            }
                            for location in DEMO_LOCATIONS
                        ]
                    )
                    .on_conflict_do_nothing()
                    .returning(WorkspaceLocation.id)
                )
            ).all()
        )

        inserted_services = 0
        for service in DEMO_SERVICES:
            key = str(service["key"])
            values = {field: value for field, value in service.items() if field != "key"}
            inserted_services += len(
                (
                    await session.scalars(
                        insert(Service)
                        .values(
                            id=_seed_id(f"service:hartmann-strategy:{key}"),
                            workspace_id=workspace_id,
                            **values,
                            updated_at=values["created_at"],
                        )
                        .on_conflict_do_nothing()
                        .returning(Service.id)
                    )
                ).all()
            )

        inserted_notifications = 0
        for notification in DEMO_NOTIFICATIONS:
            key = str(notification["key"])
            values = {
                field: value
                for field, value in notification.items()
                if field != "key"
            }
            inserted_notifications += len(
                (
                    await session.scalars(
                        insert(Notification)
                        .values(
                            id=_seed_id(f"notification:hartmann-strategy:{key}"),
                            workspace_id=workspace_id,
                            recipient_user_id=operator_id,
                            **values,
                        )
                        .on_conflict_do_nothing()
                        .returning(Notification.id)
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
        passwords_set=passwords_set,
        workspaces_inserted=inserted_workspaces,
        memberships_inserted=inserted_memberships,
        audit_events_inserted=inserted_audit_events,
        reserved_slugs_inserted=inserted_reserved_slugs,
        business_profiles_inserted=inserted_business_profiles,
        locations_inserted=inserted_locations,
        services_inserted=inserted_services,
        notifications_inserted=inserted_notifications,
    )


async def _run_seed() -> SeedSummary:
    settings = get_migration_settings()
    if settings.environment == "production":
        raise RuntimeError("the demo seed importer is disabled in production")

    database = Database(settings.migration_database_url)
    try:
        configured_password = (
            settings.demo_seed_password.get_secret_value()
            if settings.demo_seed_password is not None
            else "slotera-local-only"
        )
        return await import_demo_seed(database, demo_password=configured_password)
    finally:
        await database.dispose()


def main() -> None:
    summary = asyncio.run(_run_seed())
    print(json.dumps({**asdict(summary), "total_inserted": summary.total_inserted}))


if __name__ == "__main__":
    main()
