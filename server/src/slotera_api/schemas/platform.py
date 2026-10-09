from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import EmailStr, Field, field_validator

from slotera_api.schemas.base import ApiModel
from slotera_api.schemas.operator_resources import NonBlank, StrictApiModel


class PlatformWorkspaceSummary(ApiModel):
    id: UUID
    name: str
    slug: str
    owner_name: str | None
    owner_email: str | None
    created_at: datetime
    operational_status: Literal["active", "suspended"]
    plan: Literal["free", "pro"]
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


class PlatformPlanChange(StrictApiModel):
    plan: Literal["free", "pro"]


InquiryReason = Literal["business", "development", "feature", "general"]


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


class PlatformInquiryReadChange(StrictApiModel):
    read: bool


class PublicInquiryAccepted(ApiModel):
    accepted: bool = True


class PlatformOverviewResponse(ApiModel):
    workspaces_total: int
    workspaces_active: int
    workspaces_suspended: int
    workspaces_free: int
    workspaces_pro: int
    signups_30d: int
    bookings_30d: int
    inquiries_unread: int


class PlanResponse(ApiModel):
    id: Literal["free", "pro"]
    name: str
    monthly_price_cents: int
    currency: str
    card_fee_bps: int


class WorkspaceBillingResponse(ApiModel):
    """The operator's own plan plus the full price list, for Settings → Billing."""

    plan: Literal["free", "pro"]
    plan_changed_at: datetime | None
    plans: list[PlanResponse]
