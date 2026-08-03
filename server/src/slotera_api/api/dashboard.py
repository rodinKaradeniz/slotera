from fastapi import APIRouter, Response

from slotera_api.auth.dependencies import DatabaseDependency, OperatorWorkspaceDependency
from slotera_api.dashboard.repository import DashboardRepository, DashboardSession, DashboardSummary
from slotera_api.schemas.dashboard import (
    DashboardSessionSummary,
    DashboardSummaryResponse,
    DashboardTrendPoint,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _session_response(item: DashboardSession) -> DashboardSessionSummary:
    return DashboardSessionSummary(
        id=item.id,
        booking_id=item.booking_id,
        start_at=item.start_at,
        end_at=item.end_at,
        service_name=item.service_name,
        client_name=item.client_name,
        client_company=item.client_company,
        client_email=item.client_email,
    )


def _response(summary: DashboardSummary) -> DashboardSummaryResponse:
    return DashboardSummaryResponse(
        currency=summary.currency,
        timezone=summary.timezone,
        today=summary.today,
        next_session=(
            _session_response(summary.next_session) if summary.next_session is not None else None
        ),
        today_sessions=[_session_response(item) for item in summary.today_sessions],
        week_session_count=summary.week_session_count,
        revenue_this_month_cents=summary.revenue_this_month_cents,
        revenue_previous_month_cents=summary.revenue_previous_month_cents,
        bookings_this_month=summary.bookings_this_month,
        bookings_previous_month=summary.bookings_previous_month,
        average_booking_value_this_month_cents=(summary.average_booking_value_this_month_cents),
        average_booking_value_previous_month_cents=(
            summary.average_booking_value_previous_month_cents
        ),
        trend30d=[
            DashboardTrendPoint(
                day=item.day,
                revenue_cents=item.revenue_cents,
                bookings=item.bookings,
            )
            for item in summary.trend_30d
        ],
        unread_notifications_count=summary.unread_notifications_count,
        open_action_items_count=summary.open_action_items_count,
    )


@router.get("/summary", response_model=DashboardSummaryResponse, operation_id="getDashboardSummary")
async def get_dashboard_summary(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> DashboardSummaryResponse:
    summary = await DashboardRepository(database).get_summary(
        operator.workspace_id, operator.user_id
    )
    if summary is None:
        raise RuntimeError("authenticated workspace no longer exists")
    response.headers["Cache-Control"] = "no-store"
    return _response(summary)
