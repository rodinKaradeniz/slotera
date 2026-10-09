from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import EmailStr, Field, field_validator

from slotera_api.schemas.base import ApiModel, WorkspaceCurrency
from slotera_api.schemas.operator_resources import NonBlank, StrictApiModel


class LoginRequest(ApiModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)
    remember_me: bool = False
    workspace_id: UUID | None = None


class SessionUser(ApiModel):
    id: UUID
    email: EmailStr
    title: str | None
    first_names: str
    last_name: str
    name: str
    role: Literal["operator_admin", "superadmin"]


class SessionWorkspace(ApiModel):
    id: UUID
    name: str
    slug: str


class SessionResponse(ApiModel):
    user: SessionUser
    workspace: SessionWorkspace | None
    expires_at: datetime


class PasswordResetRequest(ApiModel):
    email: EmailStr


class PasswordResetAccepted(ApiModel):
    accepted: bool = True


class PasswordResetConsume(ApiModel):
    token: str = Field(min_length=32, max_length=1024)
    new_password: str = Field(min_length=10, max_length=1024)


WorkspaceSlug = Annotated[
    str,
    Field(min_length=3, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"),
]


class SignupRequest(StrictApiModel):
    workspace_name: Annotated[NonBlank, Field(max_length=160)]
    slug: WorkspaceSlug
    first_names: Annotated[NonBlank, Field(max_length=160)]
    last_name: Annotated[NonBlank, Field(max_length=160)]
    email: EmailStr
    timezone: Annotated[NonBlank, Field(max_length=64)] = "Europe/Berlin"
    currency: WorkspaceCurrency = "GBP"

    @field_validator("timezone")
    @classmethod
    def timezone_must_exist(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("timezone must be an IANA timezone") from exc
        return value


class PasswordChange(ApiModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=10, max_length=1024)


class SignupAccepted(ApiModel):
    accepted: bool = True


class SlugAvailability(ApiModel):
    slug: str
    available: bool
