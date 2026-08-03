from uuid import uuid4

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
async def test_operator_manages_session_action_items_without_public_visibility() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            sessions = await client.get("/sessions", params={"limit": 1})
            session_id = sessions.json()["items"][0]["id"]
            created = await client.post(
                f"/sessions/{session_id}/action-items",
                headers=_csrf_headers(client),
                json={
                    "title": "Send follow-up",
                    "description": "Include the workshop summary.",
                    "dueDate": "2026-08-01",
                    "clientVisible": True,
                },
            )
            action_id = created.json()["id"]
            changed = await client.patch(
                f"/session-action-items/{action_id}",
                headers=_csrf_headers(client),
                json={"status": "done"},
            )
            listed = await client.get(f"/sessions/{session_id}/action-items")
            missing_session = await client.post(
                f"/sessions/{uuid4()}/action-items",
                headers=_csrf_headers(client),
                json={"title": "Never created"},
            )
            csrf_rejected = await client.post(
                f"/sessions/{session_id}/action-items",
                json={"title": "No CSRF"},
            )
            removed = await client.delete(
                f"/session-action-items/{action_id}", headers=_csrf_headers(client)
            )
            remaining = await client.get(f"/sessions/{session_id}/action-items")
    finally:
        await application.dispose()
        await owner.dispose()

    assert created.status_code == 201
    assert created.headers["Cache-Control"] == "no-store"
    assert created.json()["clientVisible"] is True
    assert changed.status_code == 200
    assert changed.json()["status"] == "done"
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()["items"]] == [action_id]
    assert missing_session.status_code == 404
    assert missing_session.json()["error"]["code"] == "session_not_found"
    assert csrf_rejected.status_code == 403
    assert removed.status_code == 204
    assert remaining.json() == {"items": [], "total": 0}
