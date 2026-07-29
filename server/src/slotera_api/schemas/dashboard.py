from datetime import date, datetime
from uuid import UUID

from pydantic import Field

from slotera_api.schemas.base import ApiModel


class DashboardTrendPoint(ApiModel):
    day: date
    revenue_cents: int
    bookings: int


class DashboardSessionSummary(ApiModel):
    id: UUID
    booking_id: UUID | None
    start_at: datetime
    end_at: datetime
    service_name: str
    client_name: str | None
    client_company: str | None
    client_email: str | None


class DashboardSummaryResponse(ApiModel):
    currency: str
    timezone: str
    today: date
    next_session: DashboardSessionSummary | None
    today_sessions: list[DashboardSessionSummary]
    week_session_count: int
    revenue_this_month_cents: int
    revenue_previous_month_cents: int
    bookings_this_month: int
    bookings_previous_month: int
    average_booking_value_this_month_cents: int
    average_booking_value_previous_month_cents: int
    trend_30d: list[DashboardTrendPoint] = Field(alias="trend30d")
    unread_notifications_count: int
    open_action_items_count: int
