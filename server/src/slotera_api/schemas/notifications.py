from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field

from slotera_api.schemas.base import ApiModel


class BookingConfirmedPayload(ApiModel):
    client_name: str
    service_name: str
    starts_at: datetime


class PaymentPendingPayload(ApiModel):
    client_name: str
    service_name: str
    amount_cents: int
    currency: str


class SessionStartingPayload(ApiModel):
    client_name: str
    service_name: str
    starts_at: datetime


class RescheduleRequestedPayload(ApiModel):
    client_name: str
    service_name: str
    requested_for: datetime


class NotificationBase(ApiModel):
    id: UUID
    resource_type: str | None
    resource_id: UUID | None
    occurred_at: datetime
    read_at: datetime | None


class BookingConfirmedNotification(NotificationBase):
    kind: Literal["booking_confirmed"]
    payload: BookingConfirmedPayload


class PaymentPendingNotification(NotificationBase):
    kind: Literal["payment_pending"]
    payload: PaymentPendingPayload


class SessionStartingNotification(NotificationBase):
    kind: Literal["session_starting"]
    payload: SessionStartingPayload


class RescheduleRequestedNotification(NotificationBase):
    kind: Literal["reschedule_requested"]
    payload: RescheduleRequestedPayload


NotificationItem = Annotated[
    BookingConfirmedNotification
    | PaymentPendingNotification
    | SessionStartingNotification
    | RescheduleRequestedNotification,
    Field(discriminator="kind"),
]


class NotificationListResponse(ApiModel):
    items: list[NotificationItem]
    unread_count: int
