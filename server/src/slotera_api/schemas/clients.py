from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from slotera_api.schemas.base import ApiModel
from slotera_api.schemas.operator_resources import NonBlank, StrictApiModel


class ClientCreate(StrictApiModel):
    name: Annotated[NonBlank, Field(max_length=160)]
    email: EmailStr
    phone: Annotated[str | None, Field(max_length=40)] = None
    company: Annotated[str | None, Field(max_length=160)] = None
    role: Annotated[str | None, Field(max_length=160)] = None
    timezone: Annotated[str | None, Field(max_length=64)] = None
    address: Annotated[str | None, Field(max_length=500)] = None
    vat_id: Annotated[str | None, Field(max_length=80)] = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class ClientPatch(StrictApiModel):
    name: Annotated[NonBlank | None, Field(max_length=160)] = None
    email: EmailStr | None = None
    phone: Annotated[str | None, Field(max_length=40)] = None
    company: Annotated[str | None, Field(max_length=160)] = None
    role: Annotated[str | None, Field(max_length=160)] = None
    timezone: Annotated[str | None, Field(max_length=64)] = None
    address: Annotated[str | None, Field(max_length=500)] = None
    vat_id: Annotated[str | None, Field(max_length=80)] = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr | None) -> str | None:
        return str(value).strip().lower() if value is not None else None


class ClientResponse(ApiModel):
    id: UUID
    name: str
    email: str
    phone: str | None
    company: str | None
    role: str | None
    timezone: str | None
    address: str | None
    vat_id: str | None
    created_at: datetime
    updated_at: datetime


class ClientListResponse(ApiModel):
    items: list[ClientResponse]
    total: int
    limit: int
    offset: int
