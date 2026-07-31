# ruff: noqa: E501
from datetime import date, datetime, time
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    LargeBinary,
    String,
    Time,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from slotera_api.db.base import Base

TENANT_TABLES = frozenset(
    {
        "audit_events",
        "workspace_memberships",
        "workspace_slug_history",
        "workspaces",
        "workspace_business_profiles",
        "workspace_locations",
        "services",
        "notifications",
        "availability_policies",
        "availability_windows",
        "availability_blackouts",
        "session_series",
        "sessions",
        "clients",
        "bookings",
        "booking_command_idempotency",
        "form_templates",
        "form_template_services",
        "client_notes",
        "session_action_items",
    }
)


class PlatformRole(StrEnum):
    SUPERADMIN = "superadmin"


class MembershipRole(StrEnum):
    OPERATOR_ADMIN = "operator_admin"


class LocationType(StrEnum):
    ONLINE = "online"
    PHYSICAL = "physical"
    HYBRID = "hybrid"


class ServiceBookingMode(StrEnum):
    OPEN = "open"
    SCHEDULED = "scheduled"


class NotificationKind(StrEnum):
    BOOKING_CONFIRMED = "booking_confirmed"
    PAYMENT_PENDING = "payment_pending"
    SESSION_STARTING = "session_starting"
    RESCHEDULE_REQUESTED = "reschedule_requested"


class SessionStatus(StrEnum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    DONE = "done"
    CANCELLED = "cancelled"


class BookingStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NOSHOW = "noshow"


class BookingAttendance(StrEnum):
    PRESENT = "present"
    LATE = "late"
    ABSENT = "absent"


class PaymentStatus(StrEnum):
    PAID = "paid"
    PENDING = "pending"
    REFUNDED = "refunded"
    FREE = "free"
    OVERDUE = "overdue"


class FormStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class SessionActionItemStatus(StrEnum):
    TODO = "todo"
    DONE = "done"


def _enum_values(enum_type: type[StrEnum]) -> list[str]:
    return [member.value for member in enum_type]


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("email = lower(btrim(email))", name="email_normalized"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    title: Mapped[str | None] = mapped_column(String(32))
    first_names: Mapped[str] = mapped_column(String(160))
    last_name: Mapped[str] = mapped_column(String(160))
    password_hash: Mapped[str | None] = mapped_column(String(255))
    platform_role: Mapped[PlatformRole | None] = mapped_column(
        Enum(
            PlatformRole,
            name="platform_role",
            values_callable=_enum_values,
        )
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Workspace(Base):
    __tablename__ = "workspaces"
    __table_args__ = (
        CheckConstraint(
            "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'",
            name="slug_format",
        ),
        CheckConstraint("char_length(currency) = 3", name="currency_iso_length"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    currency: Mapped[str] = mapped_column(String(3), server_default=text("'EUR'"))
    timezone: Mapped[str] = mapped_column(
        String(64), server_default=text("'Europe/Berlin'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class WorkspaceMembership(Base):
    __tablename__ = "workspace_memberships"
    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[MembershipRole] = mapped_column(
        Enum(
            MembershipRole,
            name="membership_role",
            values_callable=_enum_values,
        ),
        server_default=text("'operator_admin'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        CheckConstraint("octet_length(token_hash) = 32", name="token_hash_sha256"),
        CheckConstraint(
            "octet_length(csrf_token_hash) = 32", name="csrf_token_hash_sha256"
        ),
        CheckConstraint("expires_at > created_at", name="expires_after_creation"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    active_workspace_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, unique=True)
    csrf_token_hash: Mapped[bytes] = mapped_column(LargeBinary)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    __table_args__ = (
        CheckConstraint("octet_length(token_hash) = 32", name="token_hash_sha256"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class WorkspaceSlugHistory(Base):
    __tablename__ = "workspace_slug_history"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    retired_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ReservedWorkspaceSlug(Base):
    __tablename__ = "reserved_workspace_slugs"
    __table_args__ = (
        CheckConstraint(
            "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'",
            name="slug_format",
        ),
    )

    slug: Mapped[str] = mapped_column(String(80), primary_key=True)
    reason: Mapped[str] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    action: Mapped[str] = mapped_column(String(120), index=True)
    resource_type: Mapped[str] = mapped_column(String(80))
    resource_id: Mapped[UUID | None]
    details: Mapped[dict[str, object]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class WorkspaceBusinessProfile(Base):
    __tablename__ = "workspace_business_profiles"

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    display_name: Mapped[str] = mapped_column(String(160))
    bio: Mapped[str] = mapped_column(String(4000), server_default=text("''"))
    email: Mapped[str] = mapped_column(String(320))
    phone: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    address: Mapped[str] = mapped_column(String(500), server_default=text("''"))
    booking_page_enabled: Mapped[bool] = mapped_column(server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class WorkspaceLocation(Base):
    __tablename__ = "workspace_locations"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(160))
    street: Mapped[str] = mapped_column(String(200))
    street2: Mapped[str | None] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(120))
    region: Mapped[str | None] = mapped_column(String(120))
    postal_code: Mapped[str] = mapped_column(String(32))
    country: Mapped[str] = mapped_column(String(2))
    notes: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Service(Base):
    __tablename__ = "services"
    __table_args__ = (
        UniqueConstraint("workspace_id", "id", name="uq_services_workspace_id_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(String(4000), server_default=text("''"))
    duration_min: Mapped[int] = mapped_column(Integer)
    price_cents: Mapped[int] = mapped_column(Integer)
    capacity: Mapped[int] = mapped_column(Integer)
    location_type: Mapped[LocationType] = mapped_column(
        Enum(LocationType, name="location_type", values_callable=_enum_values)
    )
    location: Mapped[str] = mapped_column(String(240))
    address: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    booking_mode: Mapped[ServiceBookingMode] = mapped_column(
        Enum(ServiceBookingMode, name="service_booking_mode", values_callable=_enum_values)
    )
    cancellation_rule: Mapped[str] = mapped_column(
        String(1000), server_default=text("''")
    )
    active: Mapped[bool] = mapped_column(server_default=text("true"))
    notes: Mapped[str | None] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Client(Base):
    __tablename__ = "clients"
    __table_args__ = (
        UniqueConstraint("workspace_id", "email"),
        UniqueConstraint("workspace_id", "id", name="uq_clients_workspace_id_id"),
        CheckConstraint("email = lower(btrim(email))", name="email_normalized"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(40))
    company: Mapped[str | None] = mapped_column(String(160))
    role: Mapped[str | None] = mapped_column(String(160))
    timezone: Mapped[str | None] = mapped_column(String(64))
    address: Mapped[str | None] = mapped_column(String(500))
    vat_id: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AvailabilityPolicy(Base):
    __tablename__ = "availability_policies"
    __table_args__ = (
        CheckConstraint("slot_interval_min BETWEEN 5 AND 1440", name="slot_interval"),
        CheckConstraint("buffer_before_min BETWEEN 0 AND 1440", name="buffer_before"),
        CheckConstraint("buffer_after_min BETWEEN 0 AND 1440", name="buffer_after"),
        CheckConstraint("minimum_notice_min BETWEEN 0 AND 525600", name="minimum_notice"),
        CheckConstraint("maximum_advance_days BETWEEN 1 AND 730", name="maximum_advance"),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    slot_interval_min: Mapped[int] = mapped_column(Integer, server_default=text("30"))
    buffer_before_min: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    buffer_after_min: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    minimum_notice_min: Mapped[int] = mapped_column(Integer, server_default=text("1440"))
    maximum_advance_days: Mapped[int] = mapped_column(Integer, server_default=text("90"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AvailabilityWindow(Base):
    __tablename__ = "availability_windows"
    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 1 AND 7", name="day_of_week"),
        CheckConstraint("start_local < end_local", name="ordered"),
        UniqueConstraint("workspace_id", "day_of_week", "start_local", "end_local"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    day_of_week: Mapped[int] = mapped_column(Integer)
    start_local: Mapped[time] = mapped_column(Time(timezone=False))
    end_local: Mapped[time] = mapped_column(Time(timezone=False))


class AvailabilityBlackout(Base):
    __tablename__ = "availability_blackouts"
    __table_args__ = (CheckConstraint("starts_at < ends_at", name="ordered"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(String(240))


class SessionSeries(Base):
    __tablename__ = "session_series"
    __table_args__ = (
        CheckConstraint("interval_weeks BETWEEN 1 AND 52", name="interval_weeks"),
        CheckConstraint("starts_on <= ends_on OR ends_on IS NULL", name="date_order"),
        UniqueConstraint("workspace_id", "id", name="uq_session_series_workspace_id_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    interval_weeks: Mapped[int] = mapped_column(Integer)
    weekdays: Mapped[list[int]] = mapped_column(JSONB)
    timezone: Mapped[str] = mapped_column(String(64))
    starts_on: Mapped[date]
    ends_on: Mapped[date | None]
    horizon_through: Mapped[date]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Session(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        CheckConstraint("start_at < end_at", name="ordered"),
        CheckConstraint("capacity BETWEEN 1 AND 10000", name="capacity"),
        ForeignKeyConstraint(
            ["workspace_id", "calendar_owner_id"],
            ["workspace_memberships.workspace_id", "workspace_memberships.user_id"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["workspace_id", "service_id"],
            ["services.workspace_id", "services.id"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["workspace_id", "series_id"],
            ["session_series.workspace_id", "session_series.id"],
            ondelete="RESTRICT",
        ),
        UniqueConstraint("series_id", "start_at"),
        UniqueConstraint("workspace_id", "id", name="uq_sessions_workspace_id_id"),
        ExcludeConstraint(
            ("calendar_owner_id", "="),
            (func.tstzrange(text("start_at"), text("end_at"), "[)"), "&&"),
            where=text("status <> 'cancelled'"),
            using="gist",
            name="ex_sessions_owner_time",
            deferrable=True,
            initially="IMMEDIATE",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    series_id: Mapped[UUID | None] = mapped_column(index=True)
    service_id: Mapped[UUID] = mapped_column(index=True)
    calendar_owner_id: Mapped[UUID]
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    capacity: Mapped[int] = mapped_column(Integer)
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status", values_callable=_enum_values),
        server_default=text("'scheduled'"),
    )
    location_type: Mapped[LocationType] = mapped_column(
        Enum(LocationType, name="location_type", values_callable=_enum_values)
    )
    location: Mapped[str] = mapped_column(String(240))
    address: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("amount_cents >= 0", name="amount_nonnegative"),
        CheckConstraint("char_length(currency) = 3", name="currency_iso_length"),
        UniqueConstraint("workspace_id", "id", name="uq_bookings_workspace_id_id"),
        ForeignKeyConstraint(
            ["workspace_id", "client_id"],
            ["clients.workspace_id", "clients.id"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["workspace_id", "session_id"],
            ["sessions.workspace_id", "sessions.id"],
            ondelete="RESTRICT",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    session_id: Mapped[UUID] = mapped_column(index=True)
    client_id: Mapped[UUID] = mapped_column(index=True)
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name="booking_status", values_callable=_enum_values)
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status", values_callable=_enum_values)
    )
    attendance: Mapped[BookingAttendance | None] = mapped_column(
        Enum(
            BookingAttendance,
            name="booking_attendance",
            values_callable=_enum_values,
        )
    )
    amount_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3))
    notes: Mapped[str | None] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class BookingCommandIdempotency(Base):
    __tablename__ = "booking_command_idempotency"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "booking_id"],
            ["bookings.workspace_id", "bookings.id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "workspace_id",
            "actor_user_id",
            "idempotency_key",
            name="uq_booking_command_idempotency_actor_key",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    actor_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(255))
    command: Mapped[str] = mapped_column(String(64))
    request_fingerprint: Mapped[str] = mapped_column(String(64))
    booking_id: Mapped[UUID]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class FormTemplate(Base):
    __tablename__ = "form_templates"
    __table_args__ = (UniqueConstraint("workspace_id", "id", name="uq_form_templates_workspace_id_id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(String(1000), server_default=text("''"))
    status: Mapped[FormStatus] = mapped_column(Enum(FormStatus, name="form_status", values_callable=_enum_values))
    fields: Mapped[list[dict[str, object]]] = mapped_column(JSONB)
    required_before_payment: Mapped[bool] = mapped_column(server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class FormTemplateService(Base):
    __tablename__ = "form_template_services"
    __table_args__ = (
        ForeignKeyConstraint(["workspace_id", "form_template_id"], ["form_templates.workspace_id", "form_templates.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["workspace_id", "service_id"], ["services.workspace_id", "services.id"], ondelete="RESTRICT"),
    )

    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True)
    form_template_id: Mapped[UUID] = mapped_column(primary_key=True)
    service_id: Mapped[UUID] = mapped_column(primary_key=True)


class ClientNote(Base):
    __tablename__ = "client_notes"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "client_id"],
            ["clients.workspace_id", "clients.id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[UUID] = mapped_column(index=True)
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(String(20000))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SessionActionItem(Base):
    __tablename__ = "session_action_items"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "session_id"],
            ["sessions.workspace_id", "sessions.id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    session_id: Mapped[UUID] = mapped_column(index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[SessionActionItemStatus] = mapped_column(
        Enum(
            SessionActionItemStatus,
            name="session_action_item_status",
            values_callable=_enum_values,
        ),
        server_default=text("'todo'"),
    )
    due_date: Mapped[date | None] = mapped_column(Date)
    client_visible: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "recipient_user_id"],
            [
                "workspace_memberships.workspace_id",
                "workspace_memberships.user_id",
            ],
            ondelete="CASCADE",
        ),
        Index(
            "ix_notifications_principal_occurred_at",
            "workspace_id",
            "recipient_user_id",
            "occurred_at",
        ),
        Index(
            "ix_notifications_principal_unread",
            "workspace_id",
            "recipient_user_id",
            postgresql_where=text("read_at IS NULL"),
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID]
    recipient_user_id: Mapped[UUID]
    kind: Mapped[NotificationKind] = mapped_column(
        Enum(NotificationKind, name="notification_kind", values_callable=_enum_values)
    )
    payload: Mapped[dict[str, object]] = mapped_column(JSONB)
    resource_type: Mapped[str | None] = mapped_column(String(80))
    resource_id: Mapped[UUID | None]
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


__all__ = [
    "TENANT_TABLES",
    "AuditEvent",
    "AvailabilityBlackout",
    "AvailabilityPolicy",
    "AvailabilityWindow",
    "Booking",
    "BookingCommandIdempotency",
    "BookingStatus",
    "BookingAttendance",
    "Client",
    "ClientNote",
    "FormStatus",
    "FormTemplate",
    "FormTemplateService",
    "AuthSession",
    "Base",
    "MembershipRole",
    "LocationType",
    "Notification",
    "NotificationKind",
    "PasswordResetToken",
    "PlatformRole",
    "PaymentStatus",
    "ReservedWorkspaceSlug",
    "Service",
    "ServiceBookingMode",
    "Session",
    "SessionActionItem",
    "SessionActionItemStatus",
    "SessionSeries",
    "SessionStatus",
    "User",
    "Workspace",
    "WorkspaceMembership",
    "WorkspaceBusinessProfile",
    "WorkspaceLocation",
    "WorkspaceSlugHistory",
]
