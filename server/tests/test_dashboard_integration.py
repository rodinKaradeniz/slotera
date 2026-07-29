import pytest
from httpx import ASGITransport, AsyncClient

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import import_demo_seed

DEMO_PASSWORD = "slotera-local-only"


async def _login(client: AsyncClient) -> None:
    response = await client.post(
        "/auth/login",
        headers={"Origin": "http://localhost:3344"},
        json={"email": "hello@slotera.app", "password": DEMO_PASSWORD},
    )
    assert response.status_code == 200


def _csrf_headers(client: AsyncClient) -> dict[str, str]:
    return {
        "Origin": "http://localhost:3344",
        "X-CSRF-Token": client.cookies["slotera_csrf"],
    }


@pytest.mark.integration
async def test_dashboard_summary_is_private_and_aggregates_open_action_items() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as anonymous:
            denied = await anonymous.get("/dashboard/summary")
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            await _login(client)
            before = await client.get("/dashboard/summary")
            sessions = await client.get("/sessions", params={"limit": 1})
            session_id = sessions.json()["items"][0]["id"]
            action = await client.post(
                f"/sessions/{session_id}/action-items",
                headers=_csrf_headers(client),
                json={"title": "Review dashboard summary"},
            )
            summary = await client.get("/dashboard/summary")
            await client.delete(
                f"/session-action-items/{action.json()['id']}",
                headers=_csrf_headers(client),
            )
    finally:
        await application.dispose()
        await owner.dispose()

    assert denied.status_code == 401
    assert before.status_code == 200
    assert action.status_code == 201
    assert summary.status_code == 200
    assert summary.headers["Cache-Control"] == "no-store"
    assert summary.json()["currency"] == "EUR"
    assert len(summary.json()["trend30d"]) == 30
    assert summary.json()["openActionItemsCount"] == before.json()["openActionItemsCount"] + 1
    assert "revenueThisMonthCents" in summary.json()
