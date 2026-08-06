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


class BookingCustomerSnapshot(ApiModel):
    first_name: str
    last_name: str
    email: str
    phone: str | None
    company: str | None


class BookingResponse(ApiModel):
    id: UUID
    session_id: UUID
    client_id: UUID
    reference: str
    status: Literal["pending", "confirmed", "completed", "cancelled", "noshow"]
    payment_status: Literal["paid", "pending", "refunded", "free", "overdue"]
    payment_method: Literal["free", "manual"]
    confirmation_policy: Literal["automatic", "operator_approval"]
    approval_status: Literal["not_required", "pending", "approved", "declined"]
    pending_reasons: list[Literal["approval", "payment"]]
    attendance: Literal["present", "late", "absent"] | None
    amount_cents: int
    net_amount_cents: int
    tax_amount_cents: int
    tax_treatment: Literal["none", "fixed"]
    tax_rate_bps: int
    tax_label: str | None
    tax_jurisdiction: str | None
    seller_tax_number: str | None
    currency: str
    payment_due_at: datetime | None
    payment_received_at: datetime | None
    approved_at: datetime | None
    declined_at: datetime | None
    customer: BookingCustomerSnapshot
    provider_terms_snapshot: str
    platform_terms_version: str
    terms_accepted_at: datetime | None
    manual_payment_instructions_snapshot: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


class BookingListResponse(ApiModel):
    items: list[BookingResponse]
    total: int
    limit: int
    offset: int
