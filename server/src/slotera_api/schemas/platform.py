from datetime import datetime
from typing import Annotated
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
