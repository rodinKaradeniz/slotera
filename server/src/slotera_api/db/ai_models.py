"""Tenant-owned assistant state; provider credentials never enter these tables."""

from datetime import date, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql.base import ischema_names
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import UserDefinedType

from slotera_api.db.base import Base


class Embedding(UserDefinedType[list[float]]):
    cache_ok = True

    def __init__(self, dimensions: int = 1536) -> None:
        self.dimensions = dimensions

    def get_col_spec(self, **kw: Any) -> str:
        return f"VECTOR({self.dimensions})"


ischema_names["vector"] = Embedding


class AIState(Base):
    __tablename__ = "ai_states"
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    revision: Mapped[int] = mapped_column(BigInteger, server_default=text("1"))
    privacy_epoch: Mapped[int] = mapped_column(BigInteger, server_default=text("1"))


class AIDocument(Base):
    __tablename__ = "ai_documents"
    __table_args__ = (
        UniqueConstraint("workspace_id", "kind", "source_id", "position"),
        ForeignKeyConstraint(
            ["workspace_id", "client_id"],
            ["clients.workspace_id", "clients.id"],
            ondelete="CASCADE",
        ),
        Index("ix_ai_documents_workspace_id", "workspace_id"),
        Index(
            "ix_ai_documents_words", text("to_tsvector('simple', content)"), postgresql_using="gin"
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    client_id: Mapped[UUID | None]
    kind: Mapped[str] = mapped_column(String(40))
    source_id: Mapped[UUID]
    position: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    href: Mapped[str] = mapped_column(String(300))
    embedding: Mapped[list[float]] = mapped_column(Embedding())


class AIJob(Base):
    __tablename__ = "ai_jobs"
    __table_args__ = (
        UniqueConstraint("workspace_id", "kind", "source_id"),
        Index("ix_ai_jobs_due_at", "due_at"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(40))
    source_id: Mapped[UUID]
    revision: Mapped[int] = mapped_column(BigInteger, server_default=text("1"))
    attempts: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AIThread(Base):
    __tablename__ = "ai_threads"
    __table_args__ = (
        Index("ix_ai_threads_owner", "workspace_id", "actor_id", "created_at"),
        UniqueConstraint("workspace_id", "id", name="uq_ai_threads_tenant_id"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AITurn(Base):
    __tablename__ = "ai_turns"
    __table_args__ = (
        UniqueConstraint("workspace_id", "actor_id", "key"),
        UniqueConstraint("workspace_id", "id", name="uq_ai_turns_tenant_id"),
        ForeignKeyConstraint(
            ["workspace_id", "thread_id"],
            ["ai_threads.workspace_id", "ai_threads.id"],
            ondelete="CASCADE",
        ),
        Index("ix_ai_turns_thread", "workspace_id", "thread_id", "created_at"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    thread_id: Mapped[UUID]
    key: Mapped[str] = mapped_column(String(255))
    fingerprint: Mapped[str] = mapped_column(String(64))
    prompt: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text, server_default="")
    language: Mapped[str] = mapped_column(String(2))
    status: Mapped[str] = mapped_column(String(20), server_default="pending")
    privacy_epoch: Mapped[int] = mapped_column(BigInteger)
    citations: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb")
    )
    proposal: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    error_code: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AIBriefing(Base):
    __tablename__ = "ai_briefings"
    __table_args__ = (
        UniqueConstraint("workspace_id", "actor_id", "scope"),
        ForeignKeyConstraint(
            ["workspace_id", "turn_id"],
            ["ai_turns.workspace_id", "ai_turns.id"],
            ondelete="CASCADE",
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    scope: Mapped[str] = mapped_column(String(80))
    cycle: Mapped[str] = mapped_column(String(40))
    language: Mapped[str] = mapped_column(String(2))
    turn_id: Mapped[UUID]
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AIUsage(Base):
    __tablename__ = "ai_usage"
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    day: Mapped[date] = mapped_column(primary_key=True)
    answers: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    tokens: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    indexing_tokens: Mapped[int] = mapped_column(Integer, server_default=text("0"))


class AISourceRevision(Base):
    __tablename__ = "ai_source_revisions"
    __table_args__ = (Index("ix_ai_source_revisions_workspace_id", "workspace_id", "id"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    transaction_id: Mapped[int] = mapped_column(BigInteger, server_default=text("txid_current()"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("clock_timestamp()")
    )
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
