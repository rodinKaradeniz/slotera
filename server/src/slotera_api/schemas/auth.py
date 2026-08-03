from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import EmailStr, Field

from slotera_api.schemas.base import ApiModel


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
