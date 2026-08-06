import asyncio
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, time
from uuid import UUID, uuid5

from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert

from slotera_api.auth.passwords import PasswordHasher, create_password_hasher
from slotera_api.config import get_migration_settings
from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    AvailabilityPolicy,
    AvailabilityWindow,
    Booking,
    BookingStatus,
    Client,
    LocationType,
    MembershipRole,
    Notification,
    PaymentStatus,
    PlatformRole,
    RequestRateLimit,
    ReservedWorkspaceSlug,
    Service,
    Session,
    SessionStatus,
    User,
    Workspace,
    WorkspaceBusinessProfile,
    WorkspaceLocation,
    WorkspaceMembership,
    WorkspacePaymentSettings,
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
    clients_inserted: int
    sessions_inserted: int
    bookings_inserted: int
    notifications_inserted: int
    availability_policies_inserted: int
    availability_windows_inserted: int

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
        "confirmation_policy": "automatic",
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
        "confirmation_policy": "operator_approval",
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
        "confirmation_policy": "automatic",
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
        "confirmation_policy": "operator_approval",
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
        "confirmation_policy": "automatic",
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
            "requestedFor": "2026-07-30T09:00:00Z",
        },
        "resource_type": None,
        "resource_id": None,
        "occurred_at": datetime(2026, 7, 28, 7, tzinfo=UTC),
        "read_at": datetime(2026, 7, 28, 7, 15, tzinfo=UTC),
    },
)

DEMO_CLIENTS = (
    {
        "key": "sofia-marin",
        "name": "Sofia Marin",
        "email": "sofia.marin@example.com",
        "phone": "+49 30 5550101",
        "company": "Northstar Ventures",
        "role": "Founder",
        "timezone": "Europe/Berlin",
        "address": None,
        "vat_id": None,
        "created_at": datetime(2026, 2, 4, 10, tzinfo=UTC),
    },
    {
        "key": "mila-ozawa",
        "name": "Mila Ozawa",
        "email": "mila.ozawa@example.com",
        "phone": None,
        "company": "Studio Altair",
        "role": "Creative Director",
        "timezone": "Europe/London",
        "address": None,
        "vat_id": None,
        "created_at": datetime(2026, 2, 18, 10, tzinfo=UTC),
    },
)

DEMO_SESSIONS = (
    {
        "key": "strategy-july-31",
        "service_key": "strategy",
        "start_at": datetime(2026, 7, 31, 13, tzinfo=UTC),
        "end_at": datetime(2026, 7, 31, 14, 30, tzinfo=UTC),
        "capacity": 1,
        "status": SessionStatus.SCHEDULED,
        "location_type": LocationType.ONLINE,
        "location": "Zoom · link sent on confirmation",
        "address": None,
        "notes": None,
    },
    {
        "key": "workshop-august-3",
        "service_key": "workshop",
        "start_at": datetime(2026, 8, 3, 9, tzinfo=UTC),
        "end_at": datetime(2026, 8, 3, 11, tzinfo=UTC),
        "capacity": 6,
        "status": SessionStatus.SCHEDULED,
        "location_type": LocationType.PHYSICAL,
        "location": "Berlin · Mitte studio",
        "address": DEMO_SERVICES[3]["address"],
        "notes": None,
    },
)

DEMO_BOOKINGS = (
    {
        "key": "sofia-strategy-july-31",
        "client_key": "sofia-marin",
        "session_key": "strategy-july-31",
        "status": BookingStatus.CONFIRMED,
        "payment_status": PaymentStatus.PAID,
        "amount_cents": 38000,
        "currency": "EUR",
        "notes": "Focus the working session on the fundraising narrative.",
        "created_at": datetime(2026, 7, 20, 10, tzinfo=UTC),
    },
    {
        "key": "mila-workshop-august-3",
        "client_key": "mila-ozawa",
        "session_key": "workshop-august-3",
        "status": BookingStatus.PENDING,
        "payment_status": PaymentStatus.PENDING,
        "amount_cents": 18000,
        "currency": "EUR",
        "notes": None,
        "created_at": datetime(2026, 7, 22, 10, tzinfo=UTC),
    },
)

DEMO_AVAILABILITY_WINDOWS = tuple(
    {
        "id": _seed_id(f"availability-window:hartmann-strategy:{day}"),
        "day_of_week": day,
        "start_local": time(9),
        "end_local": time(17),
    }
    for day in range(1, 6)
)


async def import_demo_seed(
    database: Database,
    *,
    demo_password: str | None = None,
    password_hasher: PasswordHasher | None = None,
) -> SeedSummary:
    async with database.transaction() as session:
        # Local seed imports are deterministic development/test resets. Do not let
        # authentication attempts from an earlier run throttle the next seeded run.
        await session.execute(delete(RequestRateLimit))
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

        await session.execute(
            insert(WorkspacePaymentSettings)
            .values(
                workspace_id=workspace_id,
                manual_payment_enabled=True,
                manual_payment_instructions=(
                    "Please use the booking reference when making your bank transfer."
                ),
                booking_terms_enabled=True,
                booking_terms_content=(
                    "Payment is due before the session. The service cancellation rule applies."
                ),
                tax_treatment="none",
                tax_rate_bps=0,
                tax_label="Tax",
                tax_jurisdiction=None,
                seller_tax_number=None,
                created_at=workspace.created_at,
                updated_at=workspace.created_at,
            )
            .on_conflict_do_nothing()
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

        inserted_clients = 0
        for client in DEMO_CLIENTS:
            key = str(client["key"])
            values = {field: value for field, value in client.items() if field != "key"}
            inserted_clients += len(
                (
                    await session.scalars(
                        insert(Client)
                        .values(
                            id=_seed_id(f"client:hartmann-strategy:{key}"),
                            workspace_id=workspace_id,
                            **values,
                            updated_at=values["created_at"],
                        )
                        .on_conflict_do_nothing()
                        .returning(Client.id)
                    )
                ).all()
            )

        inserted_sessions = 0
        for demo_session in DEMO_SESSIONS:
            key = str(demo_session["key"])
            session_id = _seed_id(f"session:hartmann-strategy:{key}")
            existing_session = await session.scalar(
                select(Session.id).where(Session.id == session_id)
            )
            if existing_session is not None:
                continue
            values = {
                field: value
                for field, value in demo_session.items()
                if field not in {"key", "service_key"}
            }
            session.add(
                Session(
                    id=session_id,
                    workspace_id=workspace_id,
                    series_id=None,
                    service_id=_seed_id(f"service:hartmann-strategy:{demo_session['service_key']}"),
                    calendar_owner_id=operator_id,
                    **values,
                    created_at=values["start_at"],
                    updated_at=values["start_at"],
                )
            )
            inserted_sessions += 1
        await session.flush()

        inserted_bookings = 0
        for booking in DEMO_BOOKINGS:
            key = str(booking["key"])
            booking_id = _seed_id(f"booking:hartmann-strategy:{key}")
            values = {
                field: value
                for field, value in booking.items()
                if field not in {"key", "client_key", "session_key"}
            }
            inserted_bookings += len(
                (
                    await session.scalars(
                        insert(Booking)
                        .values(
                            id=booking_id,
                            workspace_id=workspace_id,
                            client_id=_seed_id(f"client:hartmann-strategy:{booking['client_key']}"),
                            session_id=_seed_id(
                                f"session:hartmann-strategy:{booking['session_key']}"
                            ),
                            reference=f"SLT-{booking_id.hex[:12].upper()}",
                            payment_method=("free" if values["amount_cents"] == 0 else "manual"),
                            net_amount_cents=values["amount_cents"],
                            tax_amount_cents=0,
                            tax_treatment="none",
                            tax_rate_bps=0,
                            tax_label=None,
                            tax_jurisdiction=None,
                            seller_tax_number=None,
                            billing_address={},
                            payment_due_at=None,
                            **values,
                            updated_at=values["created_at"],
                        )
                        .on_conflict_do_nothing()
                        .returning(Booking.id)
                    )
                ).all()
            )

        inserted_availability_policies = len(
            (
                await session.scalars(
                    insert(AvailabilityPolicy)
                    .values(
                        workspace_id=workspace_id,
                        slot_interval_min=30,
                        buffer_before_min=0,
                        buffer_after_min=0,
                        minimum_notice_min=1440,
                        maximum_advance_days=90,
                        created_at=workspace.created_at,
                        updated_at=workspace.created_at,
                    )
                    .on_conflict_do_nothing()
                    .returning(AvailabilityPolicy.workspace_id)
                )
            ).all()
        )
        inserted_availability_windows = len(
            (
                await session.scalars(
                    insert(AvailabilityWindow)
                    .values(
                        [
                            {**window, "workspace_id": workspace_id}
                            for window in DEMO_AVAILABILITY_WINDOWS
                        ]
                    )
                    .on_conflict_do_nothing()
                    .returning(AvailabilityWindow.id)
                )
            ).all()
        )

        inserted_notifications = 0
        for notification in DEMO_NOTIFICATIONS:
            key = str(notification["key"])
            values = {field: value for field, value in notification.items() if field != "key"}
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
        clients_inserted=inserted_clients,
        sessions_inserted=inserted_sessions,
        bookings_inserted=inserted_bookings,
        notifications_inserted=inserted_notifications,
        availability_policies_inserted=inserted_availability_policies,
        availability_windows_inserted=inserted_availability_windows,
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
