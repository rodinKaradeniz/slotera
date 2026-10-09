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
            operator_set_plan = await operator.post(
                f"/platform/workspaces/{workspace_id}/plan",
                headers=_csrf(operator),
                json={"plan": "pro"},
            )
            set_pro = await staff.post(
                f"/platform/workspaces/{workspace_id}/plan",
                headers=_csrf(staff),
                json={"plan": "pro"},
            )
            billing_after = await operator.get("/settings/billing")

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
            audit_count = await session.scalar(
                text(
                    "SELECT count(*) FROM audit_events WHERE workspace_id = :id "
                    "AND action = 'platform.workspace_plan_changed'"
                ),
                {"id": workspace_id},
            )
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text("UPDATE workspaces SET plan = 'free', plan_changed_at = NULL WHERE id = :id"),
                {"id": workspace_id},
            )
            await session.execute(
                text("DELETE FROM platform_inquiries WHERE message = :marker"), {"marker": marker}
            )
            await session.execute(text("DELETE FROM request_rate_limits"))
        await application.dispose()
        await owner.dispose()

    assert billing_before.json()["plan"] == "free"
    assert {plan["id"]: plan["cardFeeBps"] for plan in billing_before.json()["plans"]} == {
        "free": 300,
        "pro": 100,
    }
    assert operator_set_plan.status_code == 403
    assert set_pro.status_code == 200 and set_pro.json()["plan"] == "pro"
    assert billing_after.json()["plan"] == "pro"
    assert audit_count is not None and audit_count >= 1
    assert inquiry.status_code == 202
    assert operator_inquiries.status_code == 403
    assert created["email"] == "prospect@example.com" and created["readAt"] is None
    assert marked.status_code == 204
    assert overview.status_code == 200
    assert overview.json()["inquiriesUnread"] == overview_unread - 1
    assert overview.json()["workspacesPro"] >= 1
    assert operator_overview.status_code == 403
