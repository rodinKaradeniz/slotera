"""A signed-in client's own packages: sessions left, booked dates and how to pay a pending one."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Response
from sqlalchemy import select

from slotera_api.auth.dependencies import DatabaseDependency
from slotera_api.client_access.api import ClientDependency
from slotera_api.db.models import WorkspacePaymentSettings
from slotera_api.packages import purchases
from slotera_api.schemas.operator_resources import StrictApiModel

router = APIRouter(tags=["client access"])


class ClientPackageSession(StrictApiModel):
    position: int
    service_id: UUID
    title: str
    # When the session is booked; None while it is still free to book.
    booked_for: datetime | None


class ClientPackage(StrictApiModel):
    id: UUID
    package_name: str
    price_cents: int
    currency: str
    payment_status: Literal["pending", "paid"]
    status: Literal["active", "voided"]
    refunded_cents: int
    sessions: list[ClientPackageSession]
    used_count: int
    remaining_count: int
    created_at: datetime


class ClientPackages(StrictApiModel):
    items: list[ClientPackage]
    # The consultant's current bank details, shown while a package awaits payment.
    manual_payment_instructions: str


@router.get(
    "/client/package-purchases", response_model=ClientPackages, operation_id="listClientPackages"
)
async def client_packages(
    response: Response, client: ClientDependency, database: DatabaseDependency
) -> ClientPackages:
    async with database.tenant_transaction(client.workspace_id) as session:
        views = await purchases.list_for_client(session, client.workspace_id, client.client_id)
        instructions = await session.scalar(
            select(WorkspacePaymentSettings.manual_payment_instructions).where(
                WorkspacePaymentSettings.workspace_id == client.workspace_id,
                WorkspacePaymentSettings.manual_payment_enabled.is_(True),
            )
        )
    response.headers["Cache-Control"] = "no-store"
    return ClientPackages(
        items=[
            ClientPackage(
                id=view.id,
                package_name=view.package_name,
                price_cents=view.price_cents,
                currency=view.currency,
                payment_status=view.payment_status,
                status=view.status,
                refunded_cents=view.refunded_cents,
                sessions=[
                    ClientPackageSession(
                        position=item.position,
                        service_id=item.service_id,
                        title=item.title,
                        booked_for=item.booking.start_at if item.booking else None,
                    )
                    for item in view.items
                ],
                used_count=view.used_count,
                remaining_count=view.remaining_count,
                created_at=view.created_at,
            )
            for view in views
        ],
        manual_payment_instructions=instructions or "",
    )
