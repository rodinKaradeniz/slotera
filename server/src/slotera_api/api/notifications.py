from datetime import datetime
from http import HTTPStatus
from typing import Annotated, TypedDict
from uuid import UUID

from fastapi import APIRouter, Query, Response

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.db.models import Notification, NotificationKind
from slotera_api.operator_resources.notifications_repository import NotificationsRepository
from slotera_api.schemas.notifications import (
    BookingConfirmedNotification,
    BookingConfirmedPayload,
    NotificationItem,
    NotificationListResponse,
    PaymentPendingNotification,
    PaymentPendingPayload,
    RescheduleRequestedNotification,
    RescheduleRequestedPayload,
    SessionStartingNotification,
    SessionStartingPayload,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


class _NotificationFields(TypedDict):
    id: UUID
    resource_type: str | None
    resource_id: UUID | None
    occurred_at: datetime
    read_at: datetime | None


def _common(notification: Notification) -> _NotificationFields:
    return {
        "id": notification.id,
        "resource_type": notification.resource_type,
        "resource_id": notification.resource_id,
        "occurred_at": notification.occurred_at,
        "read_at": notification.read_at,
    }


def _notification_response(notification: Notification) -> NotificationItem:
    common = _common(notification)
    if notification.kind == NotificationKind.BOOKING_CONFIRMED:
        return BookingConfirmedNotification(
            **common,
            kind="booking_confirmed",
            payload=BookingConfirmedPayload.model_validate(notification.payload),
        )
    if notification.kind == NotificationKind.PAYMENT_PENDING:
        return PaymentPendingNotification(
            **common,
            kind="payment_pending",
            payload=PaymentPendingPayload.model_validate(notification.payload),
        )
    if notification.kind == NotificationKind.SESSION_STARTING:
        return SessionStartingNotification(
            **common,
            kind="session_starting",
            payload=SessionStartingPayload.model_validate(notification.payload),
        )
    return RescheduleRequestedNotification(
        **common,
        kind="reschedule_requested",
        payload=RescheduleRequestedPayload.model_validate(notification.payload),
    )


@router.get("", response_model=NotificationListResponse, operation_id="listNotifications")
async def list_notifications(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> NotificationListResponse:
    notifications, unread_count = await NotificationsRepository(database).list_for_principal(
        operator.workspace_id,
        operator.user_id,
        limit=limit,
    )
    response.headers["Cache-Control"] = "no-store"
    return NotificationListResponse(
        items=[_notification_response(notification) for notification in notifications],
        unread_count=unread_count,
    )


@router.post(
    "/mark-all-read",
    status_code=HTTPStatus.NO_CONTENT,
    response_class=Response,
    operation_id="markAllNotificationsRead",
)
async def mark_all_notifications_read(
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> Response:
    await NotificationsRepository(database).mark_all_read(
        operator.workspace_id,
        operator.user_id,
    )
    return Response(status_code=HTTPStatus.NO_CONTENT, headers={"Cache-Control": "no-store"})
