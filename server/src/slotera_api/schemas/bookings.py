from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field

from slotera_api.schemas.base import ApiModel
from slotera_api.schemas.operator_resources import NonBlank, StrictApiModel


class OperatorBookingCreate(StrictApiModel):
    client_id: UUID
    session_id: UUID
    notes: Annotated[str | None, Field(max_length=2000)] = None
    audit_reason: Annotated[NonBlank, Field(max_length=500)]


class BookingAttendanceCommand(StrictApiModel):
    attendance: Literal["present", "late", "absent"]


class BookingResponse(ApiModel):
    id: UUID
    session_id: UUID
    client_id: UUID
    status: Literal["pending", "confirmed", "completed", "cancelled", "noshow"]
    payment_status: Literal["paid", "pending", "refunded", "free", "overdue"]
    attendance: Literal["present", "late", "absent"] | None
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
