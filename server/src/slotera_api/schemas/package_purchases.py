from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from slotera_api.schemas.base import ApiModel
from slotera_api.schemas.operator_resources import StrictApiModel


class PackagePurchaseCreate(StrictApiModel):
    package_id: UUID
    payment_received: bool = False
    notes: str | None = Field(default=None, max_length=2000)


class PackagePurchaseItemBooking(ApiModel):
    id: UUID
    status: Literal["pending", "confirmed", "completed", "noshow"]
    start_at: datetime


class PackagePurchaseItemView(ApiModel):
    position: int
    service_id: UUID
    title: str
    # The live booking holding this session; a cancelled booking gives it back.
    booking: PackagePurchaseItemBooking | None


class PackagePurchaseView(ApiModel):
    id: UUID
    version: int
    client_id: UUID
    package_id: UUID
    package_name: str
    price_cents: int
    currency: str
    payment_status: Literal["pending", "paid"]
    payment_received_at: datetime | None
    status: Literal["active", "voided"]
    voided_at: datetime | None
    notes: str | None
    items: list[PackagePurchaseItemView]
    used_count: int
    remaining_count: int
    created_at: datetime


class PackagePurchaseList(ApiModel):
    items: list[PackagePurchaseView]
