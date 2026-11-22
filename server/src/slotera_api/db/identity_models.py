# ruff: noqa: E501
"""Users, workspaces, sign-in, settings, audit, notifications and platform inquiries."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
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
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from slotera_api.db.base import Base
from slotera_api.db.enums import (
    MembershipRole,
    NotificationKind,
    PlatformRole,
    WorkspaceOperationalStatus,
    _enum_values,
)
from slotera_api.db.versioning import Versioned


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("email = lower(btrim(email))", name="email_normalized"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    preferred_language: Mapped[str] = mapped_column(String(2), server_default="en")
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
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
    timezone: Mapped[str] = mapped_column(String(64), server_default=text("'Europe/Berlin'"))
    operational_status: Mapped[WorkspaceOperationalStatus] = mapped_column(
        Enum(
            WorkspaceOperationalStatus,
            name="workspace_operational_status",
            values_callable=_enum_values,
        ),
        server_default=text("'active'"),
    )
    # Platform plan and manual-billing facts; changed only by the audited superadmin
    # database command (slotera_platform_set_workspace_billing).
    plan: Mapped[str] = mapped_column(String(16), server_default=text("'essentials'"))
    plan_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    billing_version: Mapped[int] = mapped_column(BigInteger, server_default=text("1"))
    billing_interval: Mapped[str] = mapped_column(String(16), server_default=text("'monthly'"))
    trial_ends_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now() + interval '30 days'")
    )
    paid_through: Mapped[date | None] = mapped_column(Date)
    # Set when the operator closes the workspace; the data is deleted 30 days later.
    closure_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class WorkspaceMembership(Base):
    __tablename__ = "workspace_memberships"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[MembershipRole] = mapped_column(
        Enum(
            MembershipRole,
            name="membership_role",
            values_callable=_enum_values,
        ),
        server_default=text("'operator_admin'"),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        CheckConstraint("octet_length(token_hash) = 32", name="token_hash_sha256"),
        CheckConstraint("octet_length(csrf_token_hash) = 32", name="csrf_token_hash_sha256"),
        CheckConstraint("expires_at > created_at", name="expires_after_creation"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    active_workspace_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, unique=True)
    csrf_token_hash: Mapped[bytes] = mapped_column(LargeBinary)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    __table_args__ = (CheckConstraint("octet_length(token_hash) = 32", name="token_hash_sha256"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RequestRateLimit(Base):
    __tablename__ = "request_rate_limits"
    __table_args__ = (
        CheckConstraint("octet_length(key_hash) = 32", name="key_hash_sha256"),
        CheckConstraint("request_count > 0", name="request_count_positive"),
    )

    scope: Mapped[str] = mapped_column(String(64), primary_key=True)
    key_hash: Mapped[bytes] = mapped_column(LargeBinary, primary_key=True)
    window_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    request_count: Mapped[int] = mapped_column(Integer)


class EmailOutbox(Base):
    __tablename__ = "email_outbox"
    __table_args__ = (
        CheckConstraint("attempt_count >= 0", name="attempt_count_nonnegative"),
        Index(
            "ix_email_outbox_client_context",
            text("(template_data->>'workspaceId')"),
            text("(template_data->>'clientId')"),
        ),
        Index(
            "ix_email_outbox_pending",
            "available_at",
            "created_at",
            postgresql_where=text(
                "sent_at IS NULL AND suppressed_at IS NULL AND attempt_count < 10"
            ),
        ),
        Index(
            "ix_email_outbox_expired_claim",
            "claimed_at",
            "id",
            postgresql_where=text(
                "sent_at IS NULL AND suppressed_at IS NULL "
                "AND attempt_count >= 10 AND claimed_at IS NOT NULL"
            ),
        ),
        Index("ix_email_outbox_booking_created", "related_booking_id", "created_at", "id"),
        UniqueConstraint(
            "kind", "related_booking_id", "event_key", name="uq_email_outbox_booking_event"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    kind: Mapped[str] = mapped_column(String(80))
    recipient_email: Mapped[str] = mapped_column(String(320))
    subject: Mapped[str] = mapped_column(String(300))
    text_body: Mapped[str] = mapped_column(Text)
    template_data: Mapped[dict[str, object]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )
    related_workspace_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE")
    )
    related_password_reset_token_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("password_reset_tokens.id", ondelete="SET NULL")
    )
    related_booking_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("bookings.id", ondelete="SET NULL")
    )
    # Empty for events that happen once per booking; a fresh value for repeatable ones.
    event_key: Mapped[str] = mapped_column(Text, server_default=text("''"))
    attempt_count: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suppressed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    provider_message_id: Mapped[str | None] = mapped_column(String(255))
    last_error: Mapped[str | None] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WorkspaceSlugHistory(Base):
    __tablename__ = "workspace_slug_history"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    retired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


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
    details: Mapped[dict[str, object]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class WorkspaceBusinessProfile(Versioned, Base):
    __tablename__ = "workspace_business_profiles"

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    display_name: Mapped[str] = mapped_column(String(160))
    bio: Mapped[str] = mapped_column(String(4000), server_default=text("''"))
    brand_accent: Mapped[str] = mapped_column(String(7), server_default="#3d5a3d")
    brand_font: Mapped[str] = mapped_column(String(5), server_default="serif")
    email: Mapped[str] = mapped_column(String(320))
    phone: Mapped[str] = mapped_column(String(40), server_default=text("''"))
    address: Mapped[str] = mapped_column(String(500), server_default=text("''"))
    booking_page_enabled: Mapped[bool] = mapped_column(server_default=text("true"))
    # Emails to the owner about what a client did (see booking_access.notify_operator).
    notify_operator_messages: Mapped[bool] = mapped_column(server_default=text("true"))
    notify_operator_new: Mapped[bool] = mapped_column(server_default=text("true"))
    notify_operator_cancelled: Mapped[bool] = mapped_column(server_default=text("true"))
    notify_operator_rescheduled: Mapped[bool] = mapped_column(server_default=text("true"))
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class WorkspacePaymentSettings(Base):
    __tablename__ = "workspace_payment_settings"
    __table_args__ = (
        CheckConstraint("tax_treatment IN ('none', 'fixed')", name="tax_treatment"),
        CheckConstraint("tax_rate_bps BETWEEN 0 AND 10000", name="tax_rate_bps"),
        CheckConstraint(
            "(tax_treatment = 'none' AND tax_rate_bps = 0) OR "
            "(tax_treatment = 'fixed' AND tax_rate_bps > 0)",
            name="tax_treatment_rate",
        ),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    manual_payment_enabled: Mapped[bool] = mapped_column(server_default=text("true"))
    manual_payment_instructions: Mapped[str] = mapped_column(
        String(4000), server_default=text("''")
    )
    booking_terms_enabled: Mapped[bool] = mapped_column(server_default=text("false"))
    booking_terms_content: Mapped[str] = mapped_column(String(10000), server_default=text("''"))
    tax_treatment: Mapped[str] = mapped_column(String(16), server_default=text("'none'"))
    tax_rate_bps: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    tax_label: Mapped[str] = mapped_column(String(40), server_default=text("'Tax'"))
    tax_jurisdiction: Mapped[str | None] = mapped_column(String(2))
    seller_tax_number: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class WorkspaceLocation(Versioned, Base):
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
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
        UniqueConstraint(
            "workspace_id",
            "recipient_user_id",
            "kind",
            "resource_type",
            "resource_id",
            name="uq_notifications_resource_event",
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


class PlatformInquiry(Base):
    """Metadata for the staff inbox; runtime access remains through fixed capabilities."""

    __tablename__ = "platform_inquiries"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(320))
    company: Mapped[str | None] = mapped_column(String(160))
    reason: Mapped[str] = mapped_column(String(32))
    message: Mapped[str] = mapped_column(String(4000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
