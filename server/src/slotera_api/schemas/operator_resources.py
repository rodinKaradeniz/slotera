from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import (
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)
from pydantic.alias_generators import to_camel

from slotera_api.schemas.base import ApiModel

NonBlank = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
CountryCode = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Za-z]{2}$")]


class StrictApiModel(ApiModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class BusinessSettingsResponse(ApiModel):
    workspace_id: UUID
    name: str
    slug: str
    currency: str
    timezone: str
    display_name: str
    bio: str
    email: EmailStr
    phone: str
    address: str
    booking_page_enabled: bool
    updated_at: datetime


class BusinessSettingsPatch(StrictApiModel):
    name: Annotated[NonBlank | None, Field(max_length=160)] = None
    timezone: Annotated[NonBlank | None, Field(max_length=64)] = None
    display_name: Annotated[NonBlank | None, Field(max_length=160)] = None
    bio: Annotated[str | None, Field(max_length=4000)] = None
    email: EmailStr | None = None
    phone: Annotated[str | None, Field(max_length=40)] = None
    address: Annotated[str | None, Field(max_length=500)] = None
    booking_page_enabled: bool | None = None

    @field_validator("timezone")
    @classmethod
    def timezone_must_exist(cls, value: str | None) -> str | None:
        if value is not None:
            try:
                ZoneInfo(value)
            except ZoneInfoNotFoundError as exc:
                raise ValueError("timezone must be an IANA timezone") from exc
        return value

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> "BusinessSettingsPatch":
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{to_camel(field)} cannot be null")
        return self


class PaymentSettingsResponse(ApiModel):
    manual_payment_enabled: bool
    manual_payment_instructions: str
    booking_terms_enabled: bool
    booking_terms_content: str
    tax_treatment: Literal["none", "fixed"]
    tax_rate_bps: int
    tax_label: str
    tax_jurisdiction: str | None
    seller_tax_number: str | None
    updated_at: datetime


class PaymentSettingsPatch(StrictApiModel):
    manual_payment_enabled: bool | None = None
    manual_payment_instructions: Annotated[str | None, Field(max_length=4000)] = None
    booking_terms_enabled: bool | None = None
    booking_terms_content: Annotated[str | None, Field(max_length=10000)] = None
    tax_treatment: Literal["none", "fixed"] | None = None
    tax_rate_bps: int | None = Field(default=None, ge=0, le=10000)
    tax_label: Annotated[NonBlank | None, Field(max_length=40)] = None
    tax_jurisdiction: CountryCode | None = None
    seller_tax_number: Annotated[str | None, Field(max_length=80)] = None

    @field_validator("tax_jurisdiction")
    @classmethod
    def uppercase_tax_jurisdiction(cls, value: str | None) -> str | None:
        return value.upper() if value else None

    @model_validator(mode="after")
    def reject_invalid_nulls(self) -> "PaymentSettingsPatch":
        nullable = {"tax_jurisdiction", "seller_tax_number"}
        for field in self.model_fields_set - nullable:
            if getattr(self, field) is None:
                raise ValueError(f"{to_camel(field)} cannot be null")
        return self


class Address(StrictApiModel):
    street: Annotated[NonBlank, Field(max_length=200)]
    street2: Annotated[str | None, Field(max_length=200)] = None
    city: Annotated[NonBlank, Field(max_length=120)]
    region: Annotated[str | None, Field(max_length=120)] = None
    postal_code: Annotated[NonBlank, Field(max_length=32)]
    country: CountryCode
    notes: Annotated[str | None, Field(max_length=500)] = None

    @field_validator("country")
    @classmethod
    def uppercase_country(cls, value: str) -> str:
        return value.upper()


class WorkspaceLocationCreate(StrictApiModel):
    label: Annotated[NonBlank, Field(max_length=160)]
    address: Address


class WorkspaceLocationPatch(StrictApiModel):
    label: Annotated[NonBlank | None, Field(max_length=160)] = None
    address: Address | None = None

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> "WorkspaceLocationPatch":
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{to_camel(field)} cannot be null")
        return self


class WorkspaceLocationResponse(ApiModel):
    id: UUID
    label: str
    address: Address
    created_at: datetime
    updated_at: datetime


class WorkspaceLocationListResponse(ApiModel):
    items: list[WorkspaceLocationResponse]


class ServiceCreate(StrictApiModel):
    name: Annotated[NonBlank, Field(max_length=160)]
    description: Annotated[str, Field(max_length=4000)] = ""
    duration_min: int = Field(ge=5, le=1440)
    price_cents: int = Field(ge=0)
    capacity: int = Field(ge=1, le=10000)
    location_type: Literal["online", "physical", "hybrid"]
    location: Annotated[NonBlank, Field(max_length=240)]
    address: Address | None = None
    booking_mode: Literal["open", "scheduled"]
    cancellation_rule: Annotated[str, Field(max_length=1000)] = ""
    active: bool = True
    notes: Annotated[str | None, Field(max_length=2000)] = None


class ServicePatch(StrictApiModel):
    name: Annotated[NonBlank | None, Field(max_length=160)] = None
    description: Annotated[str | None, Field(max_length=4000)] = None
    duration_min: int | None = Field(default=None, ge=5, le=1440)
    price_cents: int | None = Field(default=None, ge=0)
    capacity: int | None = Field(default=None, ge=1, le=10000)
    location_type: Literal["online", "physical", "hybrid"] | None = None
    location: Annotated[NonBlank | None, Field(max_length=240)] = None
    address: Address | None = None
    booking_mode: Literal["open", "scheduled"] | None = None
    cancellation_rule: Annotated[str | None, Field(max_length=1000)] = None
    active: bool | None = None
    notes: Annotated[str | None, Field(max_length=2000)] = None

    @model_validator(mode="after")
    def reject_invalid_nulls(self) -> "ServicePatch":
        for field in self.model_fields_set - {"address", "notes"}:
            if getattr(self, field) is None:
                raise ValueError(f"{to_camel(field)} cannot be null")
        return self


class ServiceResponse(ApiModel):
    id: UUID
    name: str
    description: str
    duration_min: int
    price_cents: int
    currency: str
    capacity: int
    location_type: Literal["online", "physical", "hybrid"]
    location: str
    address: Address | None
    booking_mode: Literal["open", "scheduled"]
    cancellation_rule: str
    active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


class ServiceListResponse(ApiModel):
    items: list[ServiceResponse]
    total: int
    limit: int
    offset: int
