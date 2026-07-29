from datetime import datetime
from typing import Literal
from uuid import UUID

from slotera_api.schemas.base import ApiModel


class BookingResponse(ApiModel):
    id: UUID
    session_id: UUID
    client_id: UUID
    status: Literal["pending", "confirmed", "completed", "cancelled", "noshow"]
    payment_status: Literal["paid", "pending", "refunded", "free", "overdue"]
    amount_cents: int
    currency: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


class BookingListResponse(ApiModel):
    items: list[BookingResponse]
    total: int
    limit: int
    offset: int
