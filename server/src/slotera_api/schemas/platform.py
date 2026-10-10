from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import EmailStr, Field, field_validator

from slotera_api.schemas.base import ApiModel, WorkspaceCurrency
from slotera_api.schemas.operator_resources import NonBlank, StrictApiModel

PlanLiteral = Literal["essentials", "professional"]
BillingIntervalLiteral = Literal["monthly", "yearly"]


class PlatformWorkspaceSummary(ApiModel):
    id: UUID
    name: str
    slug: str
    owner_name: str | None
    owner_email: str | None
    created_at: datetime
    operational_status: Literal["active", "suspended"]
    plan: PlanLiteral
    billing_interval: BillingIntervalLiteral
    trial_ends_at: datetime
    paid_through: date | None
    services_count: int
    clients_count: int
    bookings_count: int
    sessions_count: int


class PlatformWorkspaceDetail(PlatformWorkspaceSummary):
    currency: str
    timezone: str


class PlatformWorkspaceListResponse(ApiModel):
    items: list[PlatformWorkspaceSummary]
    limit: int
    offset: int


class PlatformWorkspaceProvision(StrictApiModel):
    name: Annotated[NonBlank, Field(max_length=160)]
    slug: Annotated[
        str,
        Field(
            min_length=3,
            max_length=80,
            pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        ),
    ]
    owner_first_names: Annotated[NonBlank, Field(max_length=160)]
    owner_last_name: Annotated[NonBlank, Field(max_length=160)]
    owner_email: EmailStr
    timezone: Annotated[NonBlank, Field(max_length=64)] = "Europe/Berlin"
    currency: WorkspaceCurrency = "GBP"

    @field_validator("owner_email")
    @classmethod
    def normalize_owner_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("timezone")
    @classmethod
    def timezone_must_exist(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("timezone must be an IANA timezone") from exc
        return value


class PlatformBillingChange(StrictApiModel):
    plan: PlanLiteral
    billing_interval: BillingIntervalLiteral
    trial_ends_at: datetime
    paid_through: date | None = None


InquiryReason = Literal["business", "pilot", "development", "feature", "general"]


class PlatformInquiryResponse(ApiModel):
    id: UUID
    name: str
    email: str
    company: str | None
    reason: str
    message: str
    created_at: datetime
    read_at: datetime | None


class PlatformInquiryListResponse(ApiModel):
    items: list[PlatformInquiryResponse]


class PublicInquiryCreate(StrictApiModel):
    name: Annotated[NonBlank, Field(max_length=160)]
    email: EmailStr
    company: Annotated[str | None, Field(max_length=160)] = None
    reason: InquiryReason = "business"
    message: Annotated[NonBlank, Field(max_length=4000)]


PilotBusinessType = Literal["coaching", "consulting", "fitness", "workshops", "other"]
PilotBookingVolume = Literal["under_20", "20_50", "50_150", "over_150"]


class PublicPilotApplication(StrictApiModel):
    """The pilot waitlist form. Stored as a `pilot` inquiry for staff to review."""

    name: Annotated[NonBlank, Field(max_length=160)]
    email: EmailStr
    business_name: Annotated[NonBlank, Field(max_length=160)]
    business_type: PilotBusinessType
    country: Annotated[NonBlank, Field(max_length=80)]
    bookings_per_month: PilotBookingVolume
    whatsapp_interest: bool = False
    message: Annotated[str, Field(max_length=2000)] = ""
    consent: Literal[True]


class PlatformInquiryReadChange(StrictApiModel):
    read: bool


class PublicInquiryAccepted(ApiModel):
    accepted: bool = True


class PlatformOverviewResponse(ApiModel):
    workspaces_total: int
    workspaces_active: int
    workspaces_suspended: int
    workspaces_essentials: int
    workspaces_professional: int
    workspaces_on_trial: int
    signups_30d: int
    bookings_30d: int
    inquiries_unread: int


class PlanResponse(ApiModel):
    id: PlanLiteral
    name: str
    monthly_price_cents: int
    yearly_price_cents: int
    currency: str
    card_fee_bps: int


class WorkspaceBillingResponse(ApiModel):
    """The operator's own plan plus the full price list, for Settings → Billing."""

    plan: PlanLiteral
    plan_changed_at: datetime | None
    billing_interval: BillingIntervalLiteral
    trial_ends_at: datetime
    paid_through: date | None
    plans: list[PlanResponse]
