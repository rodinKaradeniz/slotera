import asyncio
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, time, timedelta
from uuid import UUID, uuid5
from zoneinfo import ZoneInfo

from sqlalchemy import Connection, delete, literal, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session as OrmSession

from slotera_api.auth.passwords import PasswordHasher, create_password_hasher
from slotera_api.config import get_migration_settings
from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    AvailabilityPolicy,
    AvailabilityWindow,
    Base,
    Booking,
    BookingApprovalStatus,
    BookingFormResponse,
    BookingFormSnapshot,
    BookingStatus,
    Client,
    ClientNote,
    ConfirmationPolicy,
    FormStatus,
    FormTemplate,
    FormTemplateService,
    MembershipRole,
    Notification,
    PaymentStatus,
    PlatformRole,
    RequestRateLimit,
    ReservedWorkspaceSlug,
    Service,
    ServicePackage,
    ServicePackageItem,
    Session,
    SessionActionItem,
    SessionActionItemStatus,
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
    forms_inserted: int
    package_offers_inserted: int
    context_rows_inserted: int

    @property
    def total_inserted(self) -> int:
        return sum(asdict(self).values())


DEMO_SEED = DemoSeed(
    operator=UserSeed(
        id=_seed_id("user:operator:lena"),
        email="hello@slotera.io",
        title="Dr.",
        first_names="Lena Maria",
        last_name="Hartmann",
        platform_role=None,
        created_at=datetime(2025, 9, 1, 10, tzinfo=UTC),
    ),
    superadmin=UserSeed(
        id=_seed_id("user:superadmin:avery"),
        email="admin@slotera.io",
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
        currency="GBP",
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
)

DEMO_CLIENTS: tuple[dict[str, object], ...] = (
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
DEMO_CLIENTS += tuple(
    {
        "key": key,
        "name": name,
        "email": f"{key}@example.com",
        "phone": None,
        "company": company,
        "role": "Consultant",
        "timezone": "Europe/Berlin",
        "address": None,
        "vat_id": None,
        "created_at": datetime(2026, 2, 20, 10, tzinfo=UTC),
    }
    for key, name, company in (
        ("amara-bello", "Amara Bello", "Studio ARC"),
        ("jonas-weber", "Jonas Weber", "Weber Works"),
        ("nina-keller", "Nina Keller", "Keller Design"),
        ("emre-yilmaz", "Emre Yilmaz", "Yilmaz Advisory"),
    )
)


def _showcase_sessions(now: datetime) -> list[dict[str, object]]:
    today = now.astimezone(ZoneInfo(DEMO_SEED.workspace.timezone)).date()
    examples = [
        ("completed", "strategy", -5, 10, 90, 1, SessionStatus.DONE),
        ("upcoming", "discovery", 1, 10, 30, 1, SessionStatus.SCHEDULED),
        ("pending", "strategy", 2, 13, 90, 1, SessionStatus.SCHEDULED),
        ("workshop", "workshop", 3, 10, 120, 6, SessionStatus.SCHEDULED),
        ("cancelled", "discovery", 4, 10, 30, 1, SessionStatus.CANCELLED),
        ("rescheduled", "strategy", 5, 10, 90, 1, SessionStatus.SCHEDULED),
        ("no-show", "workshop", -2, 10, 120, 6, SessionStatus.DONE),
        ("available", "discovery", 6, 10, 30, 1, SessionStatus.SCHEDULED),
    ]
    result = []
    for key, service_key, offset, hour, minutes, capacity, status in examples:
        service = next(item for item in DEMO_SERVICES if item["key"] == service_key)
        start = datetime.combine(
            today + timedelta(days=offset),
            time(hour),
            tzinfo=ZoneInfo(DEMO_SEED.workspace.timezone),
        ).astimezone(UTC)
        result.append(
            {
                "key": key,
                "service_key": service_key,
                "start_at": start,
                "end_at": start + timedelta(minutes=minutes),
                "capacity": capacity,
                "status": status,
                "location_type": service["location_type"],
                "location": service["location"],
                "address": service["address"],
                "notes": None,
            }
        )
    return result


DEMO_BOOKINGS = (
    {
        "key": "completed",
        "client_key": "sofia-marin",
        "session_key": "completed",
        "status": BookingStatus.COMPLETED,
        "payment_status": PaymentStatus.PAID,
        "amount_cents": 38000,
    },
    {
        "key": "upcoming",
        "client_key": "amara-bello",
        "session_key": "upcoming",
        "status": BookingStatus.CONFIRMED,
        "payment_status": PaymentStatus.FREE,
        "amount_cents": 0,
    },
    {
        "key": "pending",
        "client_key": "mila-ozawa",
        "session_key": "pending",
        "status": BookingStatus.PENDING,
        "payment_status": PaymentStatus.PENDING,
        "amount_cents": 38000,
    },
    {
        "key": "workshop-paid",
        "client_key": "jonas-weber",
        "session_key": "workshop",
        "status": BookingStatus.CONFIRMED,
        "payment_status": PaymentStatus.PAID,
        "amount_cents": 18000,
    },
    {
        "key": "workshop-pending",
        "client_key": "nina-keller",
        "session_key": "workshop",
        "status": BookingStatus.PENDING,
        "payment_status": PaymentStatus.PENDING,
        "amount_cents": 18000,
    },
    {
        "key": "cancelled",
        "client_key": "emre-yilmaz",
        "session_key": "cancelled",
        "status": BookingStatus.CANCELLED,
        "payment_status": PaymentStatus.FREE,
        "amount_cents": 0,
    },
    {
        "key": "rescheduled",
        "client_key": "sofia-marin",
        "session_key": "rescheduled",
        "status": BookingStatus.CONFIRMED,
        "payment_status": PaymentStatus.PAID,
        "amount_cents": 38000,
    },
    {
        "key": "no-show",
        "client_key": "nina-keller",
        "session_key": "no-show",
        "status": BookingStatus.NOSHOW,
        "payment_status": PaymentStatus.PAID,
        "amount_cents": 18000,
    },
)

DEMO_FORMS = (
    {
        "key": "intake",
        "name": "Session intake",
        "description": "A little context before we meet.",
        "required_before_payment": True,
        "fields": [
            {
                "id": "goal",
                "type": "short_text",
                "label": "What would you like to achieve?",
                "required": True,
            },
            {
                "id": "context",
                "type": "long_text",
                "label": "What context would help?",
                "required": False,
            },
            {
                "id": "focus",
                "type": "single_select",
                "label": "Choose your focus",
                "required": True,
                "options": ["Strategy", "Coaching", "Planning"],
            },
            {
                "id": "agreement",
                "type": "consent_checkbox",
                "label": "I have read the session preparation notes",
                "required": True,
            },
        ],
    },
    {
        "key": "preparation",
        "name": "Session preparation",
        "description": "Optional preparation after booking.",
        "required_before_payment": False,
        "fields": [
            {
                "id": "ready",
                "type": "yes_no",
                "label": "Have you prepared your questions?",
                "required": True,
            },
            {
                "id": "deadline",
                "type": "date",
                "label": "Is there a deadline we should know about?",
                "required": False,
            },
            {
                "id": "topics",
                "type": "multi_select",
                "label": "What should we cover?",
                "required": False,
                "options": ["Goals", "Priorities", "Next steps"],
            },
        ],
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


def _showcase_notifications(now: datetime) -> list[dict[str, object]]:
    return [
        {
            "key": "payment-pending",
            "kind": "payment_pending",
            "payload": {"amountCents": 38000, "currency": "GBP"},
            "resource_type": "booking",
            "resource_id": _seed_id("booking:hartmann-strategy:pending"),
            "occurred_at": now - timedelta(hours=2),
            "read_at": None,
        },
        {
            "key": "booking-confirmed",
            "kind": "booking_confirmed",
            "payload": {"startsAt": (now + timedelta(days=1)).isoformat()},
            "resource_type": "booking",
            "resource_id": _seed_id("booking:hartmann-strategy:upcoming"),
            "occurred_at": now - timedelta(hours=3),
            "read_at": None,
        },
        {
            "key": "reschedule-requested",
            "kind": "reschedule_requested",
            "payload": {"requestedFor": (now + timedelta(days=5)).isoformat()},
            "resource_type": "booking",
            "resource_id": _seed_id("booking:hartmann-strategy:rescheduled"),
            "occurred_at": now - timedelta(days=1),
            "read_at": now,
        },
    ]


def _seed_showcase_context(
    session: OrmSession, workspace_id: UUID, now: datetime
) -> tuple[int, int, int]:
    def put(model: type[Base], values: dict[str, object]) -> int:
        return len(
            session.scalars(
                insert(model).values(**values).on_conflict_do_nothing().returning(literal(1))
            ).all()
        )

    forms_count = offers_count = context_count = 0
    for form in DEMO_FORMS:
        form_id = _seed_id(f"form:hartmann-strategy:{form['key']}")
        forms_count += put(
            FormTemplate,
            {
                "id": form_id,
                "workspace_id": workspace_id,
                **{key: value for key, value in form.items() if key != "key"},
                "status": FormStatus.ACTIVE,
                "created_at": now,
                "updated_at": now,
            },
        )
        for service_key in ("strategy",) if form["key"] == "intake" else ("discovery", "strategy"):
            context_count += put(
                FormTemplateService,
                {
                    "workspace_id": workspace_id,
                    "form_template_id": form_id,
                    "service_id": _seed_id(f"service:hartmann-strategy:{service_key}"),
                },
            )
    for key, name, status, price, service_keys in (
        ("starter", "Strategy starter", "active", 70000, ("discovery", "strategy", "strategy")),
        ("follow-up", "Workshop follow-up", "inactive", 48000, ("workshop", "strategy")),
    ):
        package_id = _seed_id(f"package:hartmann-strategy:{key}")
        offers_count += put(
            ServicePackage,
            {
                "id": package_id,
                "workspace_id": workspace_id,
                "name": name,
                "description": "Contact me to arrange these sessions together.",
                "status": status,
                "price_cents": price,
                "featured": key == "starter",
                "notes": "Internal delivery notes; never shown to clients.",
                "created_at": now,
                "updated_at": now,
            },
        )
        for position, service_key in enumerate(service_keys):
            context_count += put(
                ServicePackageItem,
                {
                    "id": _seed_id(f"package-item:{key}:{position}"),
                    "workspace_id": workspace_id,
                    "package_id": package_id,
                    "service_id": _seed_id(f"service:hartmann-strategy:{service_key}"),
                    "position": position,
                    "title": None,
                    "description": None,
                },
            )
    for example in DEMO_BOOKINGS:
        booking_id = _seed_id(f"booking:hartmann-strategy:{example['key']}")
        booking = session.get(Booking, booking_id)
        if booking is None or example["session_key"] in {"workshop", "no-show"}:
            continue
        client = session.get(Client, booking.client_id)
        if client is None or client.email.startswith("erased+"):
            continue
        for form in DEMO_FORMS:
            if form["key"] == "intake" and example["session_key"] in {"upcoming", "cancelled"}:
                continue
            form_id = _seed_id(f"form:hartmann-strategy:{form['key']}")
            context_count += put(
                BookingFormSnapshot,
                {
                    "id": _seed_id(f"form-snapshot:{example['key']}:{form['key']}"),
                    "workspace_id": workspace_id,
                    "booking_id": booking_id,
                    "form_template_id": form_id,
                    **{key: value for key, value in form.items() if key != "key"},
                    "created_at": booking.created_at,
                },
            )
            if form["key"] == "intake" or example["key"] == "completed":
                answers = (
                    [
                        {"field_id": "goal", "value": "Clarify the next business priority."},
                        {"field_id": "focus", "value": "Strategy"},
                        {"field_id": "agreement", "value": True},
                    ]
                    if form["key"] == "intake"
                    else [{"field_id": "ready", "value": False}]
                )
                context_count += put(
                    BookingFormResponse,
                    {
                        "id": _seed_id(f"form-response:{example['key']}:{form['key']}"),
                        "workspace_id": workspace_id,
                        "booking_id": booking_id,
                        "form_template_id": form_id,
                        "form_name": form["name"],
                        "answers": answers,
                        "submitted_at": booking.created_at,
                    },
                )
    for key, client_key, title, body in (
        (
            "strategy-context",
            "sofia-marin",
            "Session context",
            "<p>Preparing the next funding narrative.</p>",
        ),
        (
            "discovery-context",
            "amara-bello",
            "First conversation",
            "<p>Interested in setting clear quarterly priorities.</p>",
        ),
    ):
        client_id = _seed_id(f"client:hartmann-strategy:{client_key}")
        client = session.get(Client, client_id)
        if client and not client.email.startswith("erased+"):
            context_count += put(
                ClientNote,
                {
                    "id": _seed_id(f"note:hartmann-strategy:{key}"),
                    "workspace_id": workspace_id,
                    "client_id": client_id,
                    "title": title,
                    "body": body,
                    "created_at": now,
                    "updated_at": now,
                },
            )
    for key, session_key, title, status in (
        ("prepare", "upcoming", "Review the client's intake answers", SessionActionItemStatus.TODO),
        ("follow-up", "completed", "Record session summary", SessionActionItemStatus.DONE),
    ):
        context_count += put(
            SessionActionItem,
            {
                "id": _seed_id(f"action:hartmann-strategy:{key}"),
                "workspace_id": workspace_id,
                "session_id": _seed_id(f"session:hartmann-strategy:{session_key}"),
                "title": title,
                "description": "Private consultant preparation.",
                "status": status,
                "client_visible": False,
                "due_date": None,
                "created_at": now,
                "updated_at": now,
            },
        )
    return forms_count, offers_count, context_count


def seed_on_connection(
    connection: Connection,
    *,
    demo_password: str | None = None,
    password_hasher: PasswordHasher | None = None,
) -> SeedSummary:
    now = datetime.now(UTC)
    with (
        OrmSession(bind=connection, join_transaction_mode="create_savepoint") as session,
        session.begin(),
    ):
        # Local seed imports are deterministic development/test resets. Do not let
        # authentication attempts from an earlier run throttle the next seeded run.
        session.execute(delete(RequestRateLimit))
        inserted_users = 0
        for user in (DEMO_SEED.operator, DEMO_SEED.superadmin):
            inserted_users += len(
                (
                    session.scalars(
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
                        session.scalars(
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
                session.scalars(
                    insert(Workspace)
                    .values(
                        id=workspace.id,
                        name=workspace.name,
                        slug=workspace.slug,
                        currency=workspace.currency,
                        timezone=workspace.timezone,
                        trial_ends_at=now + timedelta(days=30),
                        created_at=workspace.created_at,
                        updated_at=workspace.created_at,
                    )
                    .on_conflict_do_nothing()
                    .returning(Workspace.id)
                )
            ).all()
        )

        operator_id = session.scalar(select(User.id).where(User.email == DEMO_SEED.operator.email))
        workspace_id = session.scalar(select(Workspace.id).where(Workspace.slug == workspace.slug))
        if operator_id is None or workspace_id is None:
            raise RuntimeError("demo identity seed could not resolve its natural keys")

        membership = DEMO_SEED.operator_membership
        inserted_memberships = len(
            (
                session.scalars(
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
                session.scalars(
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
                        onboarding_completed_at=workspace.created_at,
                        created_at=workspace.created_at,
                        updated_at=workspace.created_at,
                    )
                    .on_conflict_do_nothing()
                    .returning(WorkspaceBusinessProfile.workspace_id)
                )
            ).all()
        )

        session.execute(
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
                session.scalars(
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
                    session.scalars(
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
                    session.scalars(
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
        for demo_session in _showcase_sessions(now):
            key = str(demo_session["key"])
            session_id = _seed_id(f"session:hartmann-strategy:{key}")
            existing_session = session.scalar(select(Session.id).where(Session.id == session_id))
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
        session.flush()

        inserted_bookings = 0
        for booking in DEMO_BOOKINGS:
            key = str(booking["key"])
            booking_id = _seed_id(f"booking:hartmann-strategy:{key}")
            values = {
                field: value
                for field, value in booking.items()
                if field not in {"key", "client_key", "session_key"}
            }
            customer = next(c for c in DEMO_CLIENTS if c["key"] == booking["client_key"])
            first_name, last_name = str(customer["name"]).split(" ", 1)
            created = now - timedelta(days=8 if key == "completed" else 1)
            paid = booking["payment_status"] == PaymentStatus.PAID
            needs_approval = booking["session_key"] not in {"upcoming", "cancelled", "available"}
            policy = (
                ConfirmationPolicy.OPERATOR_APPROVAL
                if needs_approval
                else ConfirmationPolicy.AUTOMATIC
            )
            approval = (
                BookingApprovalStatus.PENDING
                if booking["status"] == BookingStatus.PENDING
                else (
                    BookingApprovalStatus.APPROVED
                    if needs_approval
                    else BookingApprovalStatus.NOT_REQUIRED
                )
            )
            inserted_bookings += len(
                (
                    session.scalars(
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
                            payment_due_at=(
                                now + timedelta(hours=24)
                                if booking["status"] == BookingStatus.PENDING
                                else None
                            ),
                            customer_first_name=first_name,
                            customer_last_name=last_name,
                            customer_email=customer["email"],
                            currency=workspace.currency,
                            confirmation_policy_snapshot=policy,
                            approval_status=approval,
                            payment_received_at=(created if paid else None),
                            approved_at=(
                                created if approval == BookingApprovalStatus.APPROVED else None
                            ),
                            customer_rescheduled_at=(
                                now - timedelta(hours=4) if key == "rescheduled" else None
                            ),
                            notes=(
                                "Moved from the original time at the client's request."
                                if key == "rescheduled"
                                else None
                            ),
                            created_at=created,
                            **values,
                            updated_at=created,
                        )
                        .on_conflict_do_nothing()
                        .returning(Booking.id)
                    )
                ).all()
            )

        inserted_availability_policies = len(
            (
                session.scalars(
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
                session.scalars(
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
        for notification in _showcase_notifications(now):
            key = str(notification["key"])
            values = {field: value for field, value in notification.items() if field != "key"}
            inserted_notifications += len(
                (
                    session.scalars(
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

        forms_count, offers_count, context_count = _seed_showcase_context(
            session, workspace_id, now
        )

        inserted_audit_events = len(
            (
                session.scalars(
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
                session.scalars(
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
        forms_inserted=forms_count,
        package_offers_inserted=offers_count,
        context_rows_inserted=context_count,
    )


async def import_demo_seed(
    database: Database,
    *,
    demo_password: str | None = None,
    password_hasher: PasswordHasher | None = None,
) -> SeedSummary:
    async with database.engine.begin() as connection:
        return await connection.run_sync(
            lambda sync: seed_on_connection(
                sync, demo_password=demo_password, password_hasher=password_hasher
            )
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
