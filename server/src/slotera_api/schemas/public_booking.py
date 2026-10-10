from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from slotera_api.schemas.base import ApiModel
from slotera_api.schemas.forms import FormFieldInput
from slotera_api.schemas.operator_resources import Address, CountryCode, NonBlank, StrictApiModel


class PublicTaxQuote(ApiModel):
    treatment: Literal["none", "fixed"]
    rate_bps: int
    label: str | None
    jurisdiction: str | None
    gross_amount_cents: int
    net_amount_cents: int
    tax_amount_cents: int
    currency: str


class PublicWorkspaceResponse(ApiModel):
    slug: str
    display_name: str
    bio: str
    email: EmailStr
    address: str
    currency: str
    timezone: str
    manual_payment_enabled: bool
    manual_payment_instructions: str
    booking_terms_enabled: bool
    booking_terms_content: str
    # False on Professional: client pages drop "Powered by Slotera".
    show_platform_branding: bool


class PublicServiceResponse(ApiModel):
    id: UUID
    name: str
    description: str
    duration_min: int
    capacity: int
    location_type: Literal["online", "physical", "hybrid"]
    location: str
    confirmation_policy: Literal["automatic", "operator_approval"]
    booking_mode: Literal["open", "scheduled"]
    cancellation_rule: str
    quote: PublicTaxQuote


class PublicServiceListResponse(ApiModel):
    items: list[PublicServiceResponse]


class PublicFormResponse(ApiModel):
    id: UUID
    name: str
    description: str
    fields: list[FormFieldInput]
    required_before_payment: bool


class PublicFormListResponse(ApiModel):
    items: list[PublicFormResponse]


class PublicAvailabilitySlot(ApiModel):
    start_at: datetime
    end_at: datetime
    spots_left: int | None = None


class PublicAvailabilityResponse(ApiModel):
    timezone: str
    items: list[PublicAvailabilitySlot]


class PublicBookingCustomer(StrictApiModel):
    first_name: Annotated[NonBlank, Field(max_length=80)]
    last_name: Annotated[NonBlank, Field(max_length=80)]
    email: EmailStr
    phone: Annotated[str | None, Field(max_length=40)] = None
    company: Annotated[str | None, Field(max_length=160)] = None
    notes: Annotated[str | None, Field(max_length=2000)] = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class PublicBookingBillingAddress(StrictApiModel):
    street: Annotated[NonBlank, Field(max_length=200)]
    street2: Annotated[str | None, Field(max_length=200)] = None
    city: Annotated[NonBlank, Field(max_length=120)]
    region: Annotated[str | None, Field(max_length=120)] = None
    postal_code: Annotated[NonBlank, Field(max_length=32)]
    country: CountryCode

    @field_validator("country")
    @classmethod
    def uppercase_country(cls, value: str) -> str:
        return value.upper()


class PublicFormAnswer(StrictApiModel):
    field_id: Annotated[NonBlank, Field(max_length=160)]
    value: str | list[str] | bool


class PublicFormSubmission(StrictApiModel):
    form_template_id: UUID
    answers: list[PublicFormAnswer] = Field(max_length=100)


class PublicBookingCreate(StrictApiModel):
    service_id: UUID
    start_at: datetime
    customer: PublicBookingCustomer
    billing_address: PublicBookingBillingAddress
    payment_method: Literal["free", "manual"]
    form_responses: list[PublicFormSubmission] = Field(default_factory=list, max_length=50)
    terms_accepted: Literal[True]

    @field_validator("start_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("startAt must include a timezone")
        return value


class PublicBookingResponse(ApiModel):
    id: UUID
    reference: str
    status: Literal["pending", "confirmed", "completed", "cancelled", "noshow"]
    payment_status: Literal["pending", "paid", "free", "overdue"]
    payment_method: Literal["free", "manual"]
    confirmation_policy: Literal["automatic", "operator_approval"]
    approval_status: Literal["not_required", "pending", "approved", "declined"]
    pending_reasons: list[Literal["approval", "payment"]]
    session_start_at: datetime
    session_end_at: datetime
    # Where the session happens: online/physical/hybrid, the location line, and the
    # street address when the session has one.
    session_location_type: Literal["online", "physical", "hybrid"]
    session_location: str
    session_address: Address | None
    # Only once the booking is confirmed (pending bookings may still be declined).
    meeting_url: str | None
    payment_due_at: datetime | None
    quote: PublicTaxQuote


class ManagedBookingResponse(ApiModel):
    """What a customer sees through their booking link: an allow-list, never notes."""

    reference: str
    status: Literal["pending", "confirmed", "completed", "cancelled", "noshow"]
    payment_status: Literal["pending", "paid", "refunded", "free", "overdue"]
    payment_method: Literal["free", "manual"]
    approval_status: Literal["not_required", "pending", "approved", "declined"]
    pending_reasons: list[Literal["approval", "payment"]]
    amount_cents: int
    currency: str
    payment_due_at: datetime | None
    manual_payment_instructions: str
    service_id: UUID
    service_name: str
    cancellation_rule: str
    provider_name: str
    provider_email: str
    provider_phone: str
    workspace_slug: str
    timezone: str
    session_start_at: datetime
    session_end_at: datetime
    session_location_type: Literal["online", "physical", "hybrid"]
    session_location: str
    session_address: Address | None
    change_deadline: datetime
    can_cancel: bool
    can_reschedule: bool
    meeting_url: str | None
    rescheduled: bool
    show_platform_branding: bool


class ManagedBookingReschedule(StrictApiModel):
    start_at: datetime

    @field_validator("start_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("startAt must include a timezone")
        return value
