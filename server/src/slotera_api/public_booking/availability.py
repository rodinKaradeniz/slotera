"""Bookable slots: open-mode times from availability windows, and seats in scheduled sessions."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.db.models import (
    AvailabilityBlackout,
    AvailabilityPolicy,
    AvailabilityWindow,
    Booking,
    BookingStatus,
    Service,
    Session,
    SessionStatus,
)


class PublicSlotUnavailableError(Exception):
    pass


@dataclass(frozen=True)
class AvailabilitySlot:
    start_at: datetime
    end_at: datetime
    # Scheduled services only: seats still free in that existing session.
    spots_left: int | None = None


_CAPACITY_CONSUMING = (BookingStatus.PENDING, BookingStatus.CONFIRMED)


def _overlaps(
    left_start: datetime,
    left_end: datetime,
    right_start: datetime,
    right_end: datetime,
) -> bool:
    return left_start < right_end and right_start < left_end


async def scheduled_slots(
    session: AsyncSession,
    workspace_id: UUID,
    service: Service,
    timezone_name: str,
    starts_on: date,
    ends_on: date,
    now: datetime,
) -> list[AvailabilitySlot]:
    policy = await session.get(AvailabilityPolicy, workspace_id)
    if policy is None:
        return []
    timezone = ZoneInfo(timezone_name)
    range_start = datetime.combine(starts_on, time.min, timezone).astimezone(UTC)
    range_end = datetime.combine(ends_on + timedelta(days=1), time.min, timezone).astimezone(UTC)
    earliest = max(range_start, now + timedelta(minutes=policy.minimum_notice_min))
    latest = min(range_end, now + timedelta(days=policy.maximum_advance_days))
    consumed = (
        select(func.count(Booking.id))
        .where(
            Booking.workspace_id == Session.workspace_id,
            Booking.session_id == Session.id,
            Booking.status.in_(_CAPACITY_CONSUMING),
        )
        .scalar_subquery()
    )
    rows = (
        await session.execute(
            select(Session, consumed)
            .where(
                Session.workspace_id == workspace_id,
                Session.service_id == service.id,
                Session.status == SessionStatus.SCHEDULED,
                Session.start_at >= earliest,
                Session.start_at < latest,
            )
            .order_by(Session.start_at)
        )
    ).all()
    return [
        AvailabilitySlot(
            start_at=item.start_at,
            end_at=item.end_at,
            spots_left=item.capacity - int(taken or 0),
        )
        for item, taken in rows
        if int(taken or 0) < item.capacity
    ]


async def lock_scheduled_session(
    session: AsyncSession,
    workspace_id: UUID,
    service: Service,
    start_at: datetime,
    now: datetime,
) -> Session:
    """Lock the operator's session at `start_at` and confirm a seat is free."""
    policy = await session.get(AvailabilityPolicy, workspace_id)
    scheduled_session = await session.scalar(
        select(Session)
        .where(
            Session.workspace_id == workspace_id,
            Session.service_id == service.id,
            Session.status == SessionStatus.SCHEDULED,
            Session.start_at == start_at,
        )
        .with_for_update()
    )
    if scheduled_session is None or policy is None:
        raise PublicSlotUnavailableError
    if not (
        now + timedelta(minutes=policy.minimum_notice_min)
        <= scheduled_session.start_at
        <= now + timedelta(days=policy.maximum_advance_days)
    ):
        raise PublicSlotUnavailableError
    taken = await session.scalar(
        select(func.count(Booking.id)).where(
            Booking.workspace_id == workspace_id,
            Booking.session_id == scheduled_session.id,
            Booking.status.in_(_CAPACITY_CONSUMING),
        )
    )
    if int(taken or 0) >= scheduled_session.capacity:
        raise PublicSlotUnavailableError
    return scheduled_session


async def available_slots(
    session: AsyncSession,
    workspace_id: UUID,
    service: Service,
    timezone_name: str,
    starts_on: date,
    ends_on: date,
    now: datetime,
) -> list[AvailabilitySlot]:
    policy = await session.get(AvailabilityPolicy, workspace_id)
    if policy is None:
        return []
    windows = list(
        (
            await session.scalars(
                select(AvailabilityWindow).where(AvailabilityWindow.workspace_id == workspace_id)
            )
        ).all()
    )
    timezone = ZoneInfo(timezone_name)
    range_start = datetime.combine(starts_on, time.min, timezone).astimezone(UTC)
    range_end = datetime.combine(ends_on + timedelta(days=1), time.min, timezone).astimezone(UTC)
    blackouts = list(
        (
            await session.scalars(
                select(AvailabilityBlackout).where(
                    AvailabilityBlackout.workspace_id == workspace_id,
                    AvailabilityBlackout.starts_at < range_end,
                    AvailabilityBlackout.ends_at > range_start,
                )
            )
        ).all()
    )
    sessions = list(
        (
            await session.scalars(
                select(Session).where(
                    Session.workspace_id == workspace_id,
                    Session.status != SessionStatus.CANCELLED,
                    Session.start_at < range_end + timedelta(minutes=policy.buffer_before_min),
                    Session.end_at > range_start - timedelta(minutes=policy.buffer_after_min),
                )
            )
        ).all()
    )
    earliest = now + timedelta(minutes=policy.minimum_notice_min)
    latest = now + timedelta(days=policy.maximum_advance_days)
    duration = timedelta(minutes=service.duration_min)
    interval = timedelta(minutes=policy.slot_interval_min)
    buffer_before = timedelta(minutes=policy.buffer_before_min)
    buffer_after = timedelta(minutes=policy.buffer_after_min)
    by_day: dict[int, list[AvailabilityWindow]] = {}
    for window in windows:
        by_day.setdefault(window.day_of_week, []).append(window)

    slots: list[AvailabilitySlot] = []
    current_day = starts_on
    while current_day <= ends_on:
        for window in by_day.get(current_day.isoweekday(), []):
            cursor = datetime.combine(current_day, window.start_local, timezone)
            window_end = datetime.combine(current_day, window.end_local, timezone)
            while cursor + duration <= window_end:
                start_at = cursor.astimezone(UTC)
                end_at = (cursor + duration).astimezone(UTC)
                blocked_start = start_at - buffer_before
                blocked_end = end_at + buffer_after
                if (
                    start_at >= earliest
                    and start_at <= latest
                    and not any(
                        _overlaps(
                            blocked_start,
                            blocked_end,
                            item.starts_at,
                            item.ends_at,
                        )
                        for item in blackouts
                    )
                    and not any(
                        _overlaps(
                            blocked_start,
                            blocked_end,
                            item.start_at,
                            item.end_at,
                        )
                        for item in sessions
                    )
                ):
                    slots.append(AvailabilitySlot(start_at=start_at, end_at=end_at))
                cursor += interval
        current_day += timedelta(days=1)
    return slots
