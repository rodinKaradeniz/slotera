"""Client access, conversations and follow-up persistence."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    LargeBinary,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from slotera_api.db.base import Base
from slotera_api.db.versioning import Versioned


class ClientLoginToken(Base):
    __tablename__ = "client_login_tokens"
    __table_args__ = (
        Index("ix_client_login_tokens_client", "workspace_id", "client_id"),
        ForeignKeyConstraint(
            ["workspace_id", "client_id"],
            ["clients.workspace_id", "clients.id"],
            ondelete="CASCADE",
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    client_id: Mapped[UUID]
    language: Mapped[str] = mapped_column(String(2), server_default="en")
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClientAuthSession(Base):
    __tablename__ = "client_auth_sessions"
    __table_args__ = (
        Index("ix_client_auth_sessions_client", "workspace_id", "client_id"),
        ForeignKeyConstraint(
            ["workspace_id", "client_id"],
            ["clients.workspace_id", "clients.id"],
            ondelete="CASCADE",
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    client_id: Mapped[UUID]
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, unique=True)
    csrf_hash: Mapped[bytes] = mapped_column(LargeBinary)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClientConversation(Base):
    __tablename__ = "client_conversations"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "client_id"],
            ["clients.workspace_id", "clients.id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("workspace_id", "id"),
        UniqueConstraint(
            "workspace_id", "client_id", name="uq_client_conversations_workspace_id_client"
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    client_id: Mapped[UUID]
    last_sequence: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "conversation_id"],
            ["client_conversations.workspace_id", "client_conversations.id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "workspace_id", "conversation_id", "sequence", name="uq_conversation_messages_sequence"
        ),
        UniqueConstraint(
            "workspace_id",
            "conversation_id",
            "sender_key",
            "submission_id",
            name="uq_conversation_messages_submission",
        ),
        Index(
            "ix_conversation_messages_tail",
            "workspace_id",
            "conversation_id",
            text("sequence DESC"),
        ),
        CheckConstraint("char_length(btrim(body)) BETWEEN 1 AND 4000", name="body"),
        CheckConstraint("sender_kind IN ('client','operator')", name="sender_kind"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    conversation_id: Mapped[UUID]
    sequence: Mapped[int] = mapped_column(BigInteger)
    sender_key: Mapped[str] = mapped_column(String(80))
    sender_kind: Mapped[str] = mapped_column(String(10))
    submission_id: Mapped[UUID]
    body: Mapped[str] = mapped_column(String(4000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ConversationRead(Base):
    __tablename__ = "conversation_reads"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "conversation_id"],
            ["client_conversations.workspace_id", "client_conversations.id"],
            ondelete="CASCADE",
        ),
    )
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    conversation_id: Mapped[UUID] = mapped_column(primary_key=True)
    actor_key: Mapped[str] = mapped_column(String(80), primary_key=True)
    last_read: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))
    last_digest: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))


class ServiceFollowupRule(Base):
    __tablename__ = "service_followup_rules"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "service_id"],
            ["services.workspace_id", "services.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["workspace_id", "form_template_id"],
            ["form_templates.workspace_id", "form_templates.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint("delay_hours BETWEEN 0 AND 720", name="delay"),
    )
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    service_id: Mapped[UUID] = mapped_column(primary_key=True)
    enabled: Mapped[bool] = mapped_column(server_default=text("false"))
    delay_hours: Mapped[int] = mapped_column(server_default=text("24"))
    message: Mapped[str] = mapped_column(String(5000), server_default=text("''"))
    form_template_id: Mapped[UUID | None]


class BookingFollowup(Versioned, Base):
    __tablename__ = "booking_followups"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "booking_id", "form_snapshot_id"],
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
        UniqueConstraint("workspace_id", "booking_id"),
        Index("ix_booking_followups_due", "state", "due_at"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    booking_id: Mapped[UUID]
    state: Mapped[str] = mapped_column(String(16))
    message: Mapped[str] = mapped_column(String(5000))
    delay_hours: Mapped[int] = mapped_column(server_default=text("24"))
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    form_snapshot_id: Mapped[UUID | None]
    queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    commands: Mapped[dict[str, object]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClientEmailCommand(Base):
    __tablename__ = "client_email_commands"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "client_id"],
            ["clients.workspace_id", "clients.id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "workspace_id", "actor_user_id", "idempotency_key", name="uq_client_email_commands_key"
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    actor_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    client_id: Mapped[UUID]
    idempotency_key: Mapped[str] = mapped_column(String(255))
    fingerprint: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MessageDigestRun(Base):
    __tablename__ = "message_digest_runs"
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    actor_key: Mapped[str] = mapped_column(String(80), primary_key=True)
    digest_day: Mapped[date] = mapped_column(Date, primary_key=True)
