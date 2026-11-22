# ruff: noqa: E501
"""Availability, session series, sessions and their tasks."""

from datetime import date, datetime, time
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    Time,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from slotera_api.db.base import Base
from slotera_api.db.enums import (
    LocationType,
    SessionActionItemStatus,
    SessionOrigin,
    SessionStatus,
    _enum_values,
)
from slotera_api.db.versioning import Versioned


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
    # Customers may cancel/reschedule themselves until this many hours before start.
    customer_change_notice_hours: Mapped[int] = mapped_column(Integer, server_default=text("24"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
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


class SessionSeries(Versioned, Base):
    __tablename__ = "session_series"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "service_id"],
            ["services.workspace_id", "services.id"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["workspace_id", "calendar_owner_id"],
            ["workspace_memberships.workspace_id", "workspace_memberships.user_id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint("duration_min >= 1", name="template_duration"),
        CheckConstraint("capacity BETWEEN 1 AND 10000", name="template_capacity"),
        CheckConstraint("interval_weeks BETWEEN 1 AND 52", name="interval_weeks"),
        CheckConstraint("starts_on <= ends_on OR ends_on IS NULL", name="date_order"),
        UniqueConstraint("workspace_id", "id", name="uq_session_series_workspace_id_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    service_id: Mapped[UUID]
    calendar_owner_id: Mapped[UUID]
    start_local: Mapped[time] = mapped_column(Time(timezone=False))
    duration_min: Mapped[int] = mapped_column(Integer)
    capacity: Mapped[int] = mapped_column(Integer)
    location_type: Mapped[LocationType] = mapped_column(
        Enum(LocationType, name="location_type", values_callable=_enum_values)
    )
    location: Mapped[str] = mapped_column(String(240))
    address: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(String(2000))
    interval_weeks: Mapped[int] = mapped_column(Integer)
    weekdays: Mapped[list[int]] = mapped_column(JSONB)
    timezone: Mapped[str] = mapped_column(String(64))
    starts_on: Mapped[date]
    ends_on: Mapped[date | None]
    horizon_through: Mapped[date]
    cancelled_from: Mapped[date | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Session(Versioned, Base):
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
    origin: Mapped[SessionOrigin] = mapped_column(
        Enum(SessionOrigin, name="session_origin", values_callable=_enum_values),
        server_default=text("'operator'"),
    )
    location_type: Mapped[LocationType] = mapped_column(
        Enum(LocationType, name="location_type", values_callable=_enum_values)
    )
    location: Mapped[str] = mapped_column(String(240))
    address: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SessionCommandIdempotency(Base):
    __tablename__ = "session_command_idempotency"
    __table_args__ = (
        UniqueConstraint("workspace_id", "actor_user_id", "idempotency_key"),
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
    actor_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    session_id: Mapped[UUID]
    idempotency_key: Mapped[str] = mapped_column(String(255))
    request_fingerprint: Mapped[str] = mapped_column(String(64))
    outcome: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SessionActionItem(Versioned, Base):
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
    session_id: Mapped[UUID | None] = mapped_column(index=True)
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
