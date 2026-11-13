"""Manual billing requests go to the existing staff inbox; no billing mutation."""

from typing import Literal

from fastapi import APIRouter

from slotera_api.auth.dependencies import CsrfOperatorWorkspaceDependency, DatabaseDependency
from slotera_api.platform.repository import PlatformRepository
from slotera_api.schemas.operator_resources import StrictApiModel

router = APIRouter(prefix="/settings/billing", tags=["settings"])


class BillingChangeRequest(StrictApiModel):
    plan: Literal["essentials", "professional"]
    billing_interval: Literal["monthly", "yearly"]


@router.post("/change-request", status_code=202, operation_id="requestBillingChange")
async def request_billing_change(
    payload: BillingChangeRequest,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> dict[str, bool]:
    actor = operator.authenticated.session
    await PlatformRepository(database).create_inquiry(
        name=" ".join((actor.first_names, actor.last_name)),
        email=actor.email,
        company=actor.workspace_name,
        reason="business",
        message=f"Billing change request\nWorkspace: {operator.workspace_id}\n"
        f"Booking page: {actor.workspace_slug}\n"
        f"Requested plan: {payload.plan}\nBilling interval: {payload.billing_interval}",
    )
    return {"accepted": True}
