"""Package sales the operator records for a client; the client pays outside Slotera."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, Response

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.editing import ExpectedVersionDependency
from slotera_api.packages import purchases
from slotera_api.schemas.bookings import RefundCreate
from slotera_api.schemas.package_purchases import (
    PackagePurchaseCreate,
    PackagePurchaseList,
    PackagePurchaseView,
)

router = APIRouter(tags=["package-purchases"])

IdempotencyKey = Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=255)]


@router.get(
    "/clients/{client_id}/package-purchases",
    response_model=PackagePurchaseList,
    operation_id="listClientPackagePurchases",
)
async def list_client_purchases(
    client_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> PackagePurchaseList:
    response.headers["Cache-Control"] = "no-store"
    async with database.tenant_transaction(operator.workspace_id, repeatable_read=True) as session:
        items = await purchases.list_for_client(session, operator.workspace_id, client_id)
    return PackagePurchaseList(items=items)


@router.post(
    "/clients/{client_id}/package-purchases",
    response_model=PackagePurchaseView,
    status_code=201,
    operation_id="recordPackagePurchase",
)
async def record_purchase(
    client_id: UUID,
    payload: PackagePurchaseCreate,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: IdempotencyKey,
) -> PackagePurchaseView:
    async with database.tenant_transaction(operator.workspace_id) as session:
        view, created = await purchases.record_sale(
            session, operator.workspace_id, operator.user_id, client_id, payload, idempotency_key
        )
    response.headers["Cache-Control"] = "no-store"
    if not created:
        response.status_code = 200
    return view


@router.post(
    "/package-purchases/{purchase_id}/payment-received",
    response_model=PackagePurchaseView,
    operation_id="markPackagePurchasePaid",
)
async def mark_paid(
    purchase_id: UUID,
    expected_version: ExpectedVersionDependency,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> PackagePurchaseView:
    async with database.tenant_transaction(operator.workspace_id) as session:
        return await purchases.mark_paid(
            session, operator.workspace_id, operator.user_id, purchase_id, expected_version
        )


@router.post(
    "/package-purchases/{purchase_id}/void",
    response_model=PackagePurchaseView,
    operation_id="voidPackagePurchase",
)
async def void_purchase(
    purchase_id: UUID,
    expected_version: ExpectedVersionDependency,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> PackagePurchaseView:
    # A scheduling write: voiding must not interleave with a booking claiming an item.
    async with database.tenant_transaction(operator.workspace_id, scheduling_write=True) as session:
        return await purchases.void(
            session, operator.workspace_id, operator.user_id, purchase_id, expected_version
        )


@router.post(
    "/package-purchases/{purchase_id}/refund",
    response_model=PackagePurchaseView,
    operation_id="refundPackagePurchase",
)
async def refund_purchase(
    purchase_id: UUID,
    payload: RefundCreate,
    expected_version: ExpectedVersionDependency,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> PackagePurchaseView:
    async with database.tenant_transaction(operator.workspace_id) as session:
        return await purchases.refund(
            session,
            operator.workspace_id,
            operator.user_id,
            purchase_id,
            expected_version,
            payload.amount_cents,
        )
