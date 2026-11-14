from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from slotera_api.schemas.base import ApiModel
from slotera_api.schemas.operator_resources import NonBlank, StrictApiModel


class PackageItemInput(StrictApiModel):
    service_id: UUID
    title: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=1000)


class PackageInput(StrictApiModel):
    name: NonBlank = Field(max_length=160)
    description: str = Field(default="", max_length=4000)
    status: Literal["active", "inactive"]
    price_cents: int = Field(ge=0, le=2147483647)
    items: list[PackageItemInput] = Field(min_length=1, max_length=100)
    notes: str | None = Field(default=None, max_length=4000)
    featured: bool = False


class PackageItemView(PackageItemInput):
    id: UUID
    order: int


class PublicPackageView(ApiModel):
    id: UUID
    name: str
    description: str
    price_cents: int
    currency: str
    items: list[PackageItemView]
    featured: bool


class PackageView(PublicPackageView):
    version: int
    status: Literal["active", "inactive"]
    notes: str | None
    created_at: datetime
    updated_at: datetime


class PackageList(ApiModel):
    total: int
    limit: int
    offset: int
    items: list[PackageView]


class PublicPackageList(ApiModel):
    items: list[PublicPackageView]


class PackageSummary(ApiModel):
    id: UUID
    name: str
    description: str
    price_cents: int
    currency: str
    featured: bool
    status: Literal["active", "inactive"]
    item_count: int


class PackageSummaryPage(ApiModel):
    items: list[PackageSummary]
    total: int
    limit: int
    offset: int
