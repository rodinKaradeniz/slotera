from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.database import Database
from slotera_api.db.models import (
    Booking,
    BookingStatus,
    Client,
    Notification,
    PaymentStatus,
    Service,
    Session,
    SessionActionItem,
    SessionActionItemStatus,
    SessionStatus,
    Workspace,
)


@dataclass(frozen=True)
class DashboardSession:
    id: UUID
    booking_id: UUID | None
    start_at: datetime
    end_at: datetime
    service_name: str
    client_name: str | None
    client_company: str | None
    client_email: str | None


@dataclass(frozen=True)
class DashboardTrend:
    day: date
    revenue_cents: int
    bookings: int


@dataclass(frozen=True)
class DashboardSummary:
    currency: str
    timezone: str
    today: date
    next_session: DashboardSession | None
    today_sessions: list[DashboardSession]
    week_session_count: int
    revenue_this_month_cents: int
    revenue_previous_month_cents: int
    bookings_this_month: int
    bookings_previous_month: int
    average_booking_value_this_month_cents: int
    average_booking_value_previous_month_cents: int
    trend_30d: list[DashboardTrend]
    unread_notifications_count: int
    open_action_items_count: int


def _start_of_day(day: date, timezone: ZoneInfo) -> datetime:
    return datetime.combine(day, time.min, tzinfo=timezone).astimezone(UTC)


def _previous_month_start(day: date) -> date:
    return (day.replace(day=1) - timedelta(days=1)).replace(day=1)


class DashboardRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def get_summary(
        self, workspace_id: UUID, user_id: UUID
    ) -> DashboardSummary | None:
        async with self.database.principal_transaction(workspace_id, user_id) as session:
            workspace = await session.get(Workspace, workspace_id)
            if workspace is None:
                return None
            timezone = ZoneInfo(workspace.timezone)
            now = datetime.now(UTC)
            today = now.astimezone(timezone).date()
            tomorrow_start = _start_of_day(today + timedelta(days=1), timezone)
            today_start = _start_of_day(today, timezone)
            week_start_day = today - timedelta(days=today.weekday())
            week_start = _start_of_day(week_start_day, timezone)
            week_end = _start_of_day(week_start_day + timedelta(days=7), timezone)
            month_start_day = today.replace(day=1)
            month_start = _start_of_day(month_start_day, timezone)
            previous_month_start = _start_of_day(_previous_month_start(today), timezone)
            trend_start_day = today - timedelta(days=29)
            trend_start = _start_of_day(trend_start_day, timezone)

            (
                revenue_this_month,
                bookings_this_month,
                average_this_month,
            ) = await self._booking_metrics(session, workspace_id, month_start, now)
            (
                revenue_previous_month,
                bookings_previous_month,
                average_previous_month,
            ) = await self._booking_metrics(
                session, workspace_id, previous_month_start, month_start
            )
            trend_30d = await self._trend(
                session, workspace_id, trend_start, now, trend_start_day, timezone
            )
            next_session = await self._next_session(session, workspace_id, now)
            today_sessions = await self._sessions_between(
                session, workspace_id, today_start, tomorrow_start
            )
            week_session_count = await session.scalar(
                select(func.count(Session.id)).where(
                    Session.workspace_id == workspace_id,
                    Session.status != SessionStatus.CANCELLED,
                    Session.start_at >= week_start,
                    Session.start_at < week_end,
                )
            )
            unread_notifications_count = await session.scalar(
                select(func.count(Notification.id)).where(
                    Notification.workspace_id == workspace_id,
                    Notification.recipient_user_id == user_id,
                    Notification.read_at.is_(None),
                )
            )
            open_action_items_count = await session.scalar(
                select(func.count(SessionActionItem.id)).where(
                    SessionActionItem.workspace_id == workspace_id,
                    SessionActionItem.status == SessionActionItemStatus.TODO,
                )
            )
            return DashboardSummary(
                currency=workspace.currency,
                timezone=workspace.timezone,
                today=today,
                next_session=next_session,
                today_sessions=today_sessions,
                week_session_count=int(week_session_count or 0),
                revenue_this_month_cents=revenue_this_month,
                revenue_previous_month_cents=revenue_previous_month,
                bookings_this_month=bookings_this_month,
                bookings_previous_month=bookings_previous_month,
                average_booking_value_this_month_cents=average_this_month,
                average_booking_value_previous_month_cents=average_previous_month,
                trend_30d=trend_30d,
                unread_notifications_count=int(unread_notifications_count or 0),
                open_action_items_count=int(open_action_items_count or 0),
            )

    async def _booking_metrics(
        self,
        session: AsyncSession,
        workspace_id: UUID,
        starts_at: datetime,
        ends_at: datetime,
    ) -> tuple[int, int, int]:
        active = and_(
            Booking.workspace_id == workspace_id,
            Booking.status != BookingStatus.CANCELLED,
            Booking.created_at >= starts_at,
            Booking.created_at < ends_at,
        )
        result = (
            await session.execute(
                select(
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    Booking.payment_status == PaymentStatus.PAID,
                                    Booking.amount_cents,
                                ),
                                else_=0,
                            )
                        ),
                        0,
                    ),
                    func.count(Booking.id),
                    func.coalesce(func.avg(Booking.amount_cents), 0),
                ).where(active)
            )
        ).one()
        return int(result[0] or 0), int(result[1] or 0), int(round(float(result[2] or 0)))

    async def _trend(
        self,
        session: AsyncSession,
        workspace_id: UUID,
        starts_at: datetime,
        ends_at: datetime,
        first_day: date,
        timezone: ZoneInfo,
    ) -> list[DashboardTrend]:
        bookings = list(
            (
                await session.scalars(
                    select(Booking).where(
                        Booking.workspace_id == workspace_id,
                        Booking.created_at >= starts_at,
                        Booking.created_at < ends_at,
                    )
                )
            ).all()
        )
        values = {
            first_day + timedelta(days=offset): {"bookings": 0, "revenue_cents": 0}
            for offset in range(30)
        }
        for booking in bookings:
            if booking.status == BookingStatus.CANCELLED:
                continue
            day = booking.created_at.astimezone(timezone).date()
            value = values.get(day)
            if value is None:
                continue
            value["bookings"] += 1
            if booking.payment_status == PaymentStatus.PAID:
                value["revenue_cents"] += booking.amount_cents
        return [
            DashboardTrend(
                day=day,
                revenue_cents=value["revenue_cents"],
                bookings=value["bookings"],
            )
            for day, value in values.items()
        ]

    async def _next_session(
        self, session: AsyncSession, workspace_id: UUID, now: datetime
    ) -> DashboardSession | None:
        rows = await self._session_rows(
            session,
            workspace_id,
            Session.start_at >= now,
            Session.status == SessionStatus.SCHEDULED,
            limit=1,
        )
        return rows[0] if rows else None

    async def _sessions_between(
        self,
        session: AsyncSession,
        workspace_id: UUID,
        starts_at: datetime,
        ends_at: datetime,
    ) -> list[DashboardSession]:
        return await self._session_rows(
            session,
            workspace_id,
            Session.start_at >= starts_at,
            Session.start_at < ends_at,
            Session.status != SessionStatus.CANCELLED,
        )

    async def _session_rows(
        self,
        session: AsyncSession,
        workspace_id: UUID,
        *predicates: Any,
        limit: int | None = None,
    ) -> list[DashboardSession]:
        statement = (
            select(Session, Service.name)
            .join(
                Service,
                and_(
                    Service.workspace_id == Session.workspace_id,
                    Service.id == Session.service_id,
                ),
            )
            .where(Session.workspace_id == workspace_id, *predicates)
            .order_by(Session.start_at, Session.id)
        )
        if limit is not None:
            statement = statement.limit(limit)
        rows = list((await session.execute(statement)).all())
        session_ids = [row[0].id for row in rows]
        if not session_ids:
            return []
        bookings = list(
            (
                await session.scalars(
                    select(Booking).where(
                        Booking.workspace_id == workspace_id,
                        Booking.session_id.in_(session_ids),
                        Booking.status != BookingStatus.CANCELLED,
                    )
                )
            ).all()
        )
        bookings_by_session: dict[UUID, list[Booking]] = defaultdict(list)
        for booking in bookings:
            bookings_by_session[booking.session_id].append(booking)
        client_ids = {booking.client_id for booking in bookings}
        clients = list(
            (
                await session.scalars(
                    select(Client).where(
                        Client.workspace_id == workspace_id,
                        Client.id.in_(client_ids),
                    )
                )
            ).all()
        ) if client_ids else []
        clients_by_id = {client.id: client for client in clients}
        summaries: list[DashboardSession] = []
        for item, service_name in rows:
            item_bookings = bookings_by_session[item.id]
            booking_id: UUID | None = None
            client_name: str | None = None
            client_company: str | None = None
            client_email: str | None = None
            if len(item_bookings) == 1:
                booking = item_bookings[0]
                client = clients_by_id.get(booking.client_id)
                booking_id = booking.id
                if client is not None:
                    client_name = client.name
                    client_company = client.company
                    client_email = client.email
            elif len(item_bookings) > 1:
                client_name = f"{len(item_bookings)} clients booked"
            summaries.append(
                DashboardSession(
                    id=item.id,
                    booking_id=booking_id,
                    start_at=item.start_at,
                    end_at=item.end_at,
                    service_name=service_name,
                    client_name=client_name,
                    client_company=client_company,
                    client_email=client_email,
                )
            )
        return summaries
