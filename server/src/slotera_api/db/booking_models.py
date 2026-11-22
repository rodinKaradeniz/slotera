# ruff: noqa: E501
"""Clients, bookings, their access tokens and forms, and package sales."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from slotera_api.db.base import Base
from slotera_api.db.enums import (
    BookingApprovalStatus,
    BookingAttendance,
    BookingOrigin,
    BookingStatus,
    ConfirmationPolicy,
    PaymentStatus,
    _enum_values,
)
from slotera_api.db.versioning import Versioned


class Client(Versioned, Base):
    __tablename__ = "clients"
    __table_args__ = (
        UniqueConstraint("workspace_id", "email", name="uq_clients_workspace_id_email"),
        Index("ix_clients_workspace_id_name", "workspace_id", "name"),
        UniqueConstraint("workspace_id", "id", name="uq_clients_workspace_id_id"),
        CheckConstraint("email = lower(btrim(email))", name="email_normalized"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    erased_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    preferred_language: Mapped[str] = mapped_column(String(2), server_default="en")
    message_digest_enabled: Mapped[bool] = mapped_column(server_default=text("true"))
    automatic_followup_enabled: Mapped[bool] = mapped_column(server_default=text("true"))
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(40))
    company: Mapped[str | None] = mapped_column(String(160))
    role: Mapped[str | None] = mapped_column(String(160))
    timezone: Mapped[str | None] = mapped_column(String(64))
    address: Mapped[str | None] = mapped_column(String(500))
    vat_id: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        Index(
            "ix_bookings_workspace_status_created",
            "workspace_id",
            "status",
            text("created_at DESC"),
            "id",
        ),
        Index(
            "ix_bookings_workspace_client_created",
            "workspace_id",
            "client_id",
            text("created_at DESC"),
            "id",
        ),
        CheckConstraint("amount_cents >= 0", name="amount_nonnegative"),
        CheckConstraint("char_length(currency) = 3", name="currency_iso_length"),
        UniqueConstraint("workspace_id", "id", name="uq_bookings_workspace_id_id"),
        UniqueConstraint("workspace_id", "reference", name="uq_bookings_workspace_reference"),
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
    origin: Mapped[BookingOrigin] = mapped_column(
        Enum(BookingOrigin, name="booking_origin", values_callable=_enum_values),
        server_default=text("'operator'"),
    )
    confirmation_policy_snapshot: Mapped[ConfirmationPolicy] = mapped_column(
        Enum(ConfirmationPolicy, name="confirmation_policy", values_callable=_enum_values),
        server_default=text("'automatic'"),
    )
    approval_status: Mapped[BookingApprovalStatus] = mapped_column(
        Enum(
            BookingApprovalStatus,
            name="booking_approval_status",
            values_callable=_enum_values,
        ),
        server_default=text("'not_required'"),
    )
    delivery_email_override: Mapped[str | None] = mapped_column(String(320))
    language: Mapped[str] = mapped_column(String(2), server_default="en")
    reference: Mapped[str] = mapped_column(String(32))
    payment_method: Mapped[str] = mapped_column(String(16))
    attendance: Mapped[BookingAttendance | None] = mapped_column(
        Enum(
            BookingAttendance,
            name="booking_attendance",
            values_callable=_enum_values,
        )
    )
    amount_cents: Mapped[int] = mapped_column(Integer)
    net_amount_cents: Mapped[int] = mapped_column(Integer)
    tax_amount_cents: Mapped[int] = mapped_column(Integer)
    tax_treatment: Mapped[str] = mapped_column(String(16))
    tax_rate_bps: Mapped[int] = mapped_column(Integer)
    tax_label: Mapped[str | None] = mapped_column(String(40))
    tax_jurisdiction: Mapped[str | None] = mapped_column(String(2))
    seller_tax_number: Mapped[str | None] = mapped_column(String(80))
    currency: Mapped[str] = mapped_column(String(3))
    billing_address: Mapped[dict[str, object]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )
    payment_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payment_received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    refunded_cents: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    declined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Set when the customer moved the booking themselves (allowed once).
    customer_rescheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    customer_first_name: Mapped[str] = mapped_column(String(80), server_default=text("''"))
    customer_last_name: Mapped[str] = mapped_column(String(80), server_default=text("''"))
    customer_email: Mapped[str] = mapped_column(String(320), server_default=text("''"))
    customer_phone: Mapped[str | None] = mapped_column(String(40))
    customer_company: Mapped[str | None] = mapped_column(String(160))
    provider_terms_snapshot: Mapped[str] = mapped_column(Text, server_default=text("''"))
    platform_terms_version: Mapped[str] = mapped_column(String(80), server_default=text("''"))
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    manual_payment_instructions_snapshot: Mapped[str] = mapped_column(
        Text, server_default=text("''")
    )
    notes: Mapped[str | None] = mapped_column(String(2000))
    # Set together when a package item covers the booking (payment_method "package").
    package_purchase_id: Mapped[UUID | None] = mapped_column()
    package_position: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BookingAccessToken(Base):
    """A customer's link to one booking. Only the SHA-256 of the token is stored."""

    __tablename__ = "booking_access_tokens"
    __table_args__ = (
        Index("ix_booking_access_tokens_booking", "workspace_id", "booking_id"),
        ForeignKeyConstraint(
            ["workspace_id", "booking_id"],
            ["bookings.workspace_id", "bookings.id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    booking_id: Mapped[UUID]
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CalendarFeedToken(Base):
    """An operator's private calendar subscribe link. Only the token's SHA-256 is stored."""

    __tablename__ = "calendar_feed_tokens"

    __table_args__ = (Index("ix_calendar_feed_tokens_owner", "workspace_id", "user_id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PublicBookingIdempotency(Base):
    __tablename__ = "public_booking_idempotency"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "booking_id"],
            ["bookings.workspace_id", "bookings.id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "workspace_id", "idempotency_key", name="uq_public_booking_idempotency_key"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(255))
    request_fingerprint: Mapped[str] = mapped_column(String(64))
    booking_id: Mapped[UUID]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BookingFormResponse(Base):
    __tablename__ = "booking_form_responses"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "booking_id", "snapshot_id"],
            [
                "booking_form_snapshots.workspace_id",
                "booking_form_snapshots.booking_id",
                "booking_form_snapshots.id",
            ],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["workspace_id", "booking_id"],
            ["bookings.workspace_id", "bookings.id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "workspace_id",
            "booking_id",
            "snapshot_id",
            name="uq_booking_form_response",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    booking_id: Mapped[UUID]
    snapshot_id: Mapped[UUID]
    form_template_id: Mapped[UUID]
    form_name: Mapped[str] = mapped_column(String(160))
    answers: Mapped[list[dict[str, object]]] = mapped_column(JSONB)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ClientNote(Versioned, Base):
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class BookingFormSnapshot(Base):
    __tablename__ = "booking_form_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "workspace_id", "booking_id", "id", name="uq_booking_form_snapshots_assignment"
        ),
        CheckConstraint("assignment_kind IN ('preparation','followup')", name="assignment_kind"),
        ForeignKeyConstraint(
            ["workspace_id", "booking_id"],
            ["bookings.workspace_id", "bookings.id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "workspace_id",
            "booking_id",
            "form_template_id",
            "assignment_kind",
            name="booking_form_snapshots_workspace_id_booking_id_form_templat_key",
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    booking_id: Mapped[UUID]
    form_template_id: Mapped[UUID]
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(String(1000))
    fields: Mapped[list[dict[str, object]]] = mapped_column(JSONB)
    required_before_payment: Mapped[bool] = mapped_column(Boolean)
    assignment_kind: Mapped[str] = mapped_column(String(20), server_default=text("'preparation'"))
    response_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PackagePurchase(Versioned, Base):
    """A package the operator sold to a client; the client paid outside Slotera."""

    __tablename__ = "package_purchases"
    __table_args__ = (
        UniqueConstraint("workspace_id", "id", name="package_purchases_workspace_id_id_key"),
        CheckConstraint("price_cents >= 0", name="package_purchases_price_check"),
        CheckConstraint(
            "payment_status IN ('pending', 'paid')", name="package_purchases_payment_status_check"
        ),
        CheckConstraint("status IN ('active', 'voided')", name="package_purchases_status_check"),
        ForeignKeyConstraint(
            ["workspace_id", "client_id"],
            ["clients.workspace_id", "clients.id"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["workspace_id", "package_id"],
            ["service_packages.workspace_id", "service_packages.id"],
            ondelete="RESTRICT",
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[UUID]
    package_id: Mapped[UUID]
    package_name_snapshot: Mapped[str] = mapped_column(String(160))
    price_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3))
    payment_status: Mapped[str] = mapped_column(String(8))
    payment_received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(8))
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(String(2000))
    refunded_cents: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    provider_terms_snapshot: Mapped[str | None] = mapped_column(Text)
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PackagePurchaseItem(Base):
    """One session of a purchase: the service it is for, snapshotted at the sale."""

    __tablename__ = "package_purchase_items"
    __table_args__ = (
        UniqueConstraint(
            "workspace_id", "purchase_id", "position", name="package_purchase_items_position_key"
        ),
        CheckConstraint("position >= 0", name="package_purchase_items_position_check"),
        ForeignKeyConstraint(
            ["workspace_id", "purchase_id"],
            ["package_purchases.workspace_id", "package_purchases.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["workspace_id", "service_id"],
            ["services.workspace_id", "services.id"],
            ondelete="RESTRICT",
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    purchase_id: Mapped[UUID]
    service_id: Mapped[UUID]
    position: Mapped[int] = mapped_column(Integer)
    title_snapshot: Mapped[str] = mapped_column(String(160))
