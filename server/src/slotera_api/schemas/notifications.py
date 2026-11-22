from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field

from slotera_api.schemas.base import ApiModel


class BookingPendingPayload(ApiModel):
    approval_status: Literal["not_required", "pending", "approved", "declined"]
    payment_status: Literal["paid", "pending", "refunded", "free", "overdue"]
    amount_cents: int
    currency: str
    starts_at: datetime


class BookingConfirmedPayload(ApiModel):
    starts_at: datetime


class PaymentPendingPayload(ApiModel):
    amount_cents: int
    currency: str


class SessionStartingPayload(ApiModel):
    starts_at: datetime


class RescheduleRequestedPayload(ApiModel):
    requested_for: datetime


class BookingCancelledPayload(ApiModel):
    starts_at: datetime


class PackageRequestedPayload(ApiModel):
    # No client name: notifications outlive a client's erasure; the item links to the client.
    client_id: UUID
    package_name: str
    price_cents: int
    currency: str


class NotificationBase(ApiModel):
    id: UUID
    resource_type: str | None
    resource_id: UUID | None
    occurred_at: datetime
    read_at: datetime | None


class BookingConfirmedNotification(NotificationBase):
    kind: Literal["booking_confirmed"]
    payload: BookingConfirmedPayload


class BookingPendingNotification(NotificationBase):
    kind: Literal["booking_pending"]
    payload: BookingPendingPayload


class PaymentPendingNotification(NotificationBase):
    kind: Literal["payment_pending"]
    payload: PaymentPendingPayload


class SessionStartingNotification(NotificationBase):
    kind: Literal["session_starting"]
    payload: SessionStartingPayload


class RescheduleRequestedNotification(NotificationBase):
    kind: Literal["reschedule_requested"]
    payload: RescheduleRequestedPayload


class BookingCancelledNotification(NotificationBase):
    kind: Literal["booking_cancelled"]
    payload: BookingCancelledPayload


class PackageRequestedNotification(NotificationBase):
    kind: Literal["package_requested"]
    payload: PackageRequestedPayload


NotificationItem = Annotated[
    BookingPendingNotification
    | BookingConfirmedNotification
    | PaymentPendingNotification
    | SessionStartingNotification
    | RescheduleRequestedNotification
    | BookingCancelledNotification
    | PackageRequestedNotification,
    Field(discriminator="kind"),
]


class NotificationListResponse(ApiModel):
    items: list[NotificationItem]
    unread_count: int
    # More (older) notifications exist after the last item; ask again with
    # `before`/`beforeId` set to that item's `occurredAt`/`id`.
    has_more: bool
