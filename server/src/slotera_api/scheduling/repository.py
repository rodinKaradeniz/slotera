from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError

from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    AvailabilityBlackout,
    AvailabilityPolicy,
    AvailabilityWindow,
    Service,
    Session,
    SessionSeries,
    Workspace,
    WorkspaceMembership,
)
from slotera_api.scheduling.recurrence import expand_weekly_occurrences


class SessionConflictError(Exception):
    pass


class PastSessionImmutableError(Exception):
    pass


AvailabilityRecord = tuple[
    Workspace,
    AvailabilityPolicy,
    list[AvailabilityWindow],
    list[AvailabilityBlackout],
]
SessionRecord = tuple[Session, SessionSeries | None]


def _is_exclusion_violation(exc: IntegrityError) -> bool:
    original = exc.orig
    return getattr(original, "sqlstate", None) == "23P01" or "ex_sessions_owner_time" in str(
        original
    )


class SchedulingRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def get_availability(self, workspace_id: UUID) -> AvailabilityRecord | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            workspace = await session.get(Workspace, workspace_id)
            policy = await session.get(AvailabilityPolicy, workspace_id)
            if workspace is None or policy is None:
                return None
            windows = list(
                (
                    await session.scalars(
                        select(AvailabilityWindow)
                        .where(AvailabilityWindow.workspace_id == workspace_id)
                        .order_by(
                            AvailabilityWindow.day_of_week,
                            AvailabilityWindow.start_local,
                        )
                    )
                ).all()
            )
            blackouts = list(
                (
                    await session.scalars(
                        select(AvailabilityBlackout)
                        .where(AvailabilityBlackout.workspace_id == workspace_id)
                        .order_by(AvailabilityBlackout.starts_at, AvailabilityBlackout.id)
                    )
                ).all()
            )
            return workspace, policy, windows, blackouts

    async def replace_availability(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        *,
        timezone: str,
        policy_values: Mapping[str, Any],
        windows: list[Mapping[str, Any]],
        blackouts: list[Mapping[str, Any]],
    ) -> AvailabilityRecord:
        async with self.database.tenant_transaction(workspace_id) as session:
            workspace = await session.get(Workspace, workspace_id)
            if workspace is None:
                raise RuntimeError("authenticated workspace no longer exists")
            workspace.timezone = timezone
            policy = await session.get(AvailabilityPolicy, workspace_id)
            if policy is None:
                policy = AvailabilityPolicy(workspace_id=workspace_id, **policy_values)
                session.add(policy)
            else:
                for key, value in policy_values.items():
                    setattr(policy, key, value)
            await session.execute(
                delete(AvailabilityWindow).where(AvailabilityWindow.workspace_id == workspace_id)
            )
            await session.execute(
                delete(AvailabilityBlackout).where(
                    AvailabilityBlackout.workspace_id == workspace_id
                )
            )
            created_windows = [
                AvailabilityWindow(id=uuid4(), workspace_id=workspace_id, **values)
                for values in windows
            ]
            created_blackouts = [
                AvailabilityBlackout(id=uuid4(), workspace_id=workspace_id, **values)
                for values in blackouts
            ]
            session.add_all([*created_windows, *created_blackouts])
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="availability.updated",
                    resource_type="availability_policy",
                    resource_id=workspace_id,
                    details={
                        "weekly_window_count": len(created_windows),
                        "blackout_count": len(created_blackouts),
                    },
                )
            )
            await session.flush()
            await session.refresh(workspace)
            await session.refresh(policy)
            return workspace, policy, created_windows, created_blackouts

    async def list_sessions(
        self,
        workspace_id: UUID,
        *,
        starts_from: datetime | None,
        starts_before: datetime | None,
        service_id: UUID | None,
        calendar_owner_id: UUID | None,
        series_id: UUID | None,
        limit: int,
        offset: int,
    ) -> tuple[list[SessionRecord], int]:
        filters: list[Any] = [Session.workspace_id == workspace_id]
        if starts_from is not None:
            filters.append(Session.end_at > starts_from)
        if starts_before is not None:
            filters.append(Session.start_at < starts_before)
        if service_id is not None:
            filters.append(Session.service_id == service_id)
        if calendar_owner_id is not None:
            filters.append(Session.calendar_owner_id == calendar_owner_id)
        if series_id is not None:
            filters.append(Session.series_id == series_id)
        async with self.database.tenant_transaction(workspace_id) as session:
            total = await session.scalar(select(func.count(Session.id)).where(*filters))
            rows = (
                await session.execute(
                    select(Session, SessionSeries)
                    .outerjoin(SessionSeries, SessionSeries.id == Session.series_id)
                    .where(*filters)
                    .order_by(Session.start_at, Session.id)
                    .limit(limit)
                    .offset(offset)
                )
            ).all()
            return [(row[0], row[1]) for row in rows], int(total or 0)

    async def get_session(self, workspace_id: UUID, session_id: UUID) -> SessionRecord | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            row = (
                await session.execute(
                    select(Session, SessionSeries)
                    .outerjoin(SessionSeries, SessionSeries.id == Session.series_id)
                    .where(Session.workspace_id == workspace_id, Session.id == session_id)
                )
            ).one_or_none()
            return None if row is None else (row[0], row[1])

    async def create_session(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        values: Mapping[str, Any],
        recurrence: Mapping[str, Any] | None,
    ) -> SessionRecord | None:
        try:
            async with self.database.tenant_transaction(workspace_id) as session:
                service_exists = await session.scalar(
                    select(Service.id).where(
                        Service.workspace_id == workspace_id,
                        Service.id == values["service_id"],
                    )
                )
                owner_exists = await session.scalar(
                    select(WorkspaceMembership.id).where(
                        WorkspaceMembership.workspace_id == workspace_id,
                        WorkspaceMembership.user_id == values["calendar_owner_id"],
                    )
                )
                if service_exists is None or owner_exists is None:
                    return None

                series: SessionSeries | None = None
                occurrence_ranges = [(values["start_at"], values["end_at"])]
                if recurrence is not None:
                    timezone = await session.scalar(
                        select(Workspace.timezone).where(Workspace.id == workspace_id)
                    )
                    if timezone is None:
                        raise RuntimeError("authenticated workspace no longer exists")
                    local_start = values["start_at"].astimezone(ZoneInfo(timezone))
                    requested_end = recurrence.get("ends_on")
                    rolling_end = local_start.date() + timedelta(days=183)
                    horizon_end = min(requested_end, rolling_end) if requested_end else rolling_end
                    duration_minutes = int(
                        (values["end_at"] - values["start_at"]).total_seconds() // 60
                    )
                    occurrence_ranges = expand_weekly_occurrences(
                        first_start=values["start_at"],
                        duration_minutes=duration_minutes,
                        timezone=timezone,
                        interval_weeks=recurrence["interval_weeks"],
                        weekdays=tuple(recurrence["weekdays"]),
                        horizon_end=horizon_end,
                    )
                    series = SessionSeries(
                        id=uuid4(),
                        workspace_id=workspace_id,
                        interval_weeks=recurrence["interval_weeks"],
                        weekdays=recurrence["weekdays"],
                        timezone=timezone,
                        starts_on=local_start.date(),
                        ends_on=requested_end,
                        horizon_through=horizon_end,
                    )
                    session.add(series)
                    await session.flush()

                occurrences = [
                    Session(
                        id=uuid4(),
                        workspace_id=workspace_id,
                        series_id=series.id if series else None,
                        **{**values, "start_at": starts_at, "end_at": ends_at},
                    )
                    for starts_at, ends_at in occurrence_ranges
                ]
                session.add_all(occurrences)
                session.add(
                    AuditEvent(
                        workspace_id=workspace_id,
                        actor_user_id=actor_user_id,
                        action="session.created",
                        resource_type="session_series" if series else "session",
                        resource_id=series.id if series else occurrences[0].id,
                        details={"occurrence_count": len(occurrences)},
                    )
                )
                await session.flush()
                await session.refresh(occurrences[0])
                return occurrences[0], series
        except IntegrityError as exc:
            if _is_exclusion_violation(exc):
                raise SessionConflictError from exc
            raise

    async def update_session(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        session_id: UUID,
        changes: Mapping[str, Any],
        scope: Literal["this", "this_and_following"],
    ) -> SessionRecord | None:
        try:
            async with self.database.tenant_transaction(workspace_id) as session:
                target = await session.scalar(
                    select(Session).where(
                        Session.workspace_id == workspace_id, Session.id == session_id
                    )
                )
                if target is None:
                    return None
                schedule_fields = {
                    "service_id",
                    "calendar_owner_id",
                    "start_at",
                    "end_at",
                    "capacity",
                    "location_type",
                    "location",
                    "address",
                }
                target_is_past = target.start_at < datetime.now(UTC)
                if target_is_past and (
                    scope == "this_and_following" or schedule_fields.intersection(changes)
                ):
                    raise PastSessionImmutableError
                if "service_id" in changes:
                    exists = await session.scalar(
                        select(Service.id).where(
                            Service.workspace_id == workspace_id,
                            Service.id == changes["service_id"],
                        )
                    )
                    if exists is None:
                        return None
                if "calendar_owner_id" in changes:
                    exists = await session.scalar(
                        select(WorkspaceMembership.id).where(
                            WorkspaceMembership.workspace_id == workspace_id,
                            WorkspaceMembership.user_id == changes["calendar_owner_id"],
                        )
                    )
                    if exists is None:
                        return None

                affected = [target]
                if scope == "this_and_following" and target.series_id is not None:
                    affected = list(
                        (
                            await session.scalars(
                                select(Session).where(
                                    Session.workspace_id == workspace_id,
                                    Session.series_id == target.series_id,
                                    Session.start_at >= target.start_at,
                                )
                            )
                        ).all()
                    )
                    await session.execute(text("SET CONSTRAINTS ex_sessions_owner_time DEFERRED"))

                start_delta = (
                    changes["start_at"] - target.start_at if "start_at" in changes else None
                )
                end_delta = changes["end_at"] - target.end_at if "end_at" in changes else None
                ordinary = {
                    key: value
                    for key, value in changes.items()
                    if key not in {"start_at", "end_at"}
                }
                for occurrence in affected:
                    if start_delta is not None and end_delta is not None:
                        occurrence.start_at += start_delta
                        occurrence.end_at += end_delta
                    for key, value in ordinary.items():
                        setattr(occurrence, key, value)
                session.add(
                    AuditEvent(
                        workspace_id=workspace_id,
                        actor_user_id=actor_user_id,
                        action="session.updated",
                        resource_type="session",
                        resource_id=session_id,
                        details={"fields": sorted(changes), "scope": scope},
                    )
                )
                await session.flush()
                await session.refresh(target)
                series = (
                    await session.get(SessionSeries, target.series_id)
                    if target.series_id is not None
                    else None
                )
                return target, series
        except IntegrityError as exc:
            if _is_exclusion_violation(exc):
                raise SessionConflictError from exc
            raise
