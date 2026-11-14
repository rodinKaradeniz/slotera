from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import EmailStr, Field, field_validator, model_validator

from slotera_api.schemas.base import ApiModel
from slotera_api.schemas.clients import ClientIdentityCreate
from slotera_api.schemas.operator_resources import Address, NonBlank, StrictApiModel


class OperatorBookingCreate(StrictApiModel):
    client_id: UUID | None = None
    new_client: ClientIdentityCreate | None = None
    send_email: bool = True
    language: Literal["en", "tr", "de"] = "en"
    session_id: UUID
    notes: Annotated[str | None, Field(max_length=2000)] = None
    audit_reason: Annotated[NonBlank, Field(max_length=500)]

    @model_validator(mode="after")
    def one_client(self) -> "OperatorBookingCreate":
        if (self.client_id is None) == (self.new_client is None):
            raise ValueError("Choose an existing client or provide a new client")
        return self


class BookingEmailSend(StrictApiModel):
    recipient_email: EmailStr
    expected_recipient_email: EmailStr

    @field_validator("recipient_email", "expected_recipient_email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class BookingEmailResponse(ApiModel):
    id: UUID
    kind: str
    recipient_email: str
    status: Literal["queued", "sending", "retrying", "failed", "sent", "superseded"]
    created_at: datetime
    sent_at: datetime | None
    available_at: datetime
    attempt_count: int
    simulated: bool


class BookingEmailListResponse(ApiModel):
    items: list[BookingEmailResponse]
    total: int
    limit: int
    offset: int


class BookingMoveCommand(StrictApiModel):
    session_id: UUID
    audit_reason: Annotated[NonBlank, Field(max_length=500)]


class BookingAttendanceCommand(StrictApiModel):
    attendance: Literal["present", "late", "absent"]


class BookingCustomerSnapshot(ApiModel):
    first_name: str
    last_name: str
    email: str
    phone: str | None
    company: str | None


class BookingDisplayContext(ApiModel):
    client_name: str
    client_email: str
    service_id: UUID
    service_name: str
    start_at: datetime
    end_at: datetime
    capacity: int
    booked_count: int
    session_status: Literal["scheduled", "live", "done", "cancelled"]
    location_type: Literal["online", "physical", "hybrid"]
    location: str
    address: Address | None
    recurring: Literal["one-off", "weekly", "custom"]


class BookingResponse(ApiModel):
    context: BookingDisplayContext | None = None
    email_contact: str
    language: Literal["en", "tr", "de"]
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


class BookingSummary(ApiModel):
    attendance: Literal["present", "late", "absent"] | None = None
    id: UUID
    client_id: UUID
    session_id: UUID
    service_id: UUID
    reference: str
    client_name: str
    client_company: str | None
    service_name: str
    start_at: datetime
    status: Literal["pending", "confirmed", "completed", "noshow", "cancelled"]
    payment_status: Literal["pending", "paid", "free", "refunded", "overdue"]
    amount_cents: int
    currency: str
    created_at: datetime


class BookingSummaryPage(ApiModel):
    items: list[BookingSummary]
    total: int
    limit: int
    offset: int
    status_counts: dict[str, int]
    status_previews: dict[str, list[BookingSummary]]
    pending_payment_count: int
