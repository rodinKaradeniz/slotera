from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import DEMO_SEED, import_demo_seed

DEMO_PASSWORD = "slotera-local-only"
ORIGIN = "http://localhost:3344"


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login", headers={"Origin": ORIGIN}, json={"email": email, "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200


def _csrf(client: AsyncClient) -> dict[str, str]:
    token = client.cookies.get("slotera_csrf")
    assert token is not None
    return {"Origin": ORIGIN, "X-CSRF-Token": token}


@pytest.mark.integration
async def test_plans_inquiries_and_overview_are_superadmin_controlled() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    workspace_id = DEMO_SEED.workspace.id
    marker = f"inquiry-{uuid4().hex[:8]}"
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM request_rate_limits"))
        app = create_app(database=application)
        transport = ASGITransport(app=app)
        async with (
            AsyncClient(transport=transport, base_url="http://test") as operator,
            AsyncClient(transport=transport, base_url="http://test") as staff,
            AsyncClient(transport=transport, base_url="http://test") as visitor,
        ):
            await _login(operator, "hello@slotera.app")
            await _login(staff, "admin@slotera.app")
            billing_before = await operator.get("/settings/billing")
            branding_before = await visitor.get("/public/workspaces/lena")
            change = {
                "plan": "professional",
                "billingInterval": "yearly",
                "trialEndsAt": billing_before.json()["trialEndsAt"],
                "paidThrough": "2027-10-31",
            }
            operator_set_plan = await operator.post(
                f"/platform/workspaces/{workspace_id}/billing",
                headers=_csrf(operator),
                json=change,
            )
            set_pro = await staff.post(
                f"/platform/workspaces/{workspace_id}/billing",
                headers=_csrf(staff),
                json=change,
            )
            unchanged = await staff.post(
                f"/platform/workspaces/{workspace_id}/billing",
                headers=_csrf(staff),
                json=change,
            )
            billing_after = await operator.get("/settings/billing")
            branding_after = await visitor.get("/public/workspaces/lena")

            inquiry = await visitor.post(
                "/public/inquiries",
                headers={"Origin": ORIGIN},
                json={
                    "name": "Prospect",
                    "email": "Prospect@Example.com",
                    "reason": "business",
                    "message": marker,
                },
            )
            operator_inquiries = await operator.get("/platform/inquiries")
            listed = await staff.get("/platform/inquiries")
            created = next(item for item in listed.json()["items"] if item["message"] == marker)
            overview_unread = (await staff.get("/platform/overview")).json()["inquiriesUnread"]
            marked = await staff.post(
                f"/platform/inquiries/{created['id']}/read",
                headers=_csrf(staff),
                json={"read": True},
            )
            overview = await staff.get("/platform/overview")
            operator_overview = await operator.get("/platform/overview")

        async with owner.transaction() as session:
            audit = await session.scalar(
                text(
                    "SELECT details FROM audit_events WHERE workspace_id = :id "
                    "AND action = 'platform.workspace_billing_changed' "
                    "ORDER BY occurred_at DESC LIMIT 1"
                ),
                {"id": workspace_id},
            )
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text(
                    "UPDATE workspaces SET plan = 'essentials', plan_changed_at = NULL, "
                    "billing_interval = 'monthly', paid_through = NULL WHERE id = :id"
                ),
                {"id": workspace_id},
            )
            await session.execute(
                text("DELETE FROM platform_inquiries WHERE message = :marker"), {"marker": marker}
            )
            await session.execute(text("DELETE FROM request_rate_limits"))
        await application.dispose()
        await owner.dispose()

    before = billing_before.json()
    assert before["plan"] == "essentials" and before["billingInterval"] == "monthly"
    assert before["paidThrough"] is None
    assert {
        plan["id"]: (plan["monthlyPriceCents"], plan["yearlyPriceCents"], plan["cardFeeBps"])
        for plan in before["plans"]
    } == {"essentials": (1900, 19000, 200), "professional": (3900, 39000, 100)}
    assert branding_before.json()["showPlatformBranding"] is True
    assert operator_set_plan.status_code == 403
    assert set_pro.status_code == 200 and set_pro.json()["plan"] == "professional"
    assert unchanged.status_code == 200
    after = billing_after.json()
    assert after["plan"] == "professional" and after["billingInterval"] == "yearly"
    assert after["paidThrough"] == "2027-10-31"
    assert branding_after.json()["showPlatformBranding"] is False
    assert audit is not None
    assert audit["from"]["plan"] == "essentials" and audit["to"]["plan"] == "professional"
    assert inquiry.status_code == 202
    assert operator_inquiries.status_code == 403
    assert created["email"] == "prospect@example.com" and created["readAt"] is None
    assert marked.status_code == 204
    assert overview.status_code == 200
    assert overview.json()["inquiriesUnread"] == overview_unread - 1
    assert overview.json()["workspacesProfessional"] >= 1
    assert operator_overview.status_code == 403
