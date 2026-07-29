import pytest
from httpx import ASGITransport, AsyncClient

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import _seed_id, import_demo_seed

DEMO_PASSWORD = "slotera-local-only"
CLIENT_ID = _seed_id("client:hartmann-strategy:sofia-marin")


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
async def test_operator_can_manage_sanitized_client_notes() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            await _login(client)
            created = await client.post(
                f"/clients/{CLIENT_ID}/notes",
                headers=_csrf_headers(client),
                json={
                    "title": "Session preference",
                    "body": "<p>Prefers <strong>morning</strong> sessions.</p>"
                    "<script>alert('no')</script>",
                },
            )
            note_id = created.json()["id"]
            changed = await client.patch(
                f"/client-notes/{note_id}",
                headers=_csrf_headers(client),
                json={"body": "<img src=x onerror=alert(1)><p>Changed</p>"},
            )
            listed = await client.get(f"/clients/{CLIENT_ID}/notes")
            removed = await client.delete(
                f"/client-notes/{note_id}", headers=_csrf_headers(client)
            )
            remaining = await client.get(f"/clients/{CLIENT_ID}/notes")
    finally:
        await application.dispose()
        await owner.dispose()

    assert created.status_code == 201
    assert created.headers["Cache-Control"] == "no-store"
    assert created.json()["body"] == "<p>Prefers <strong>morning</strong> sessions.</p>"
    assert changed.status_code == 200
    assert changed.json()["body"] == "<p>Changed</p>"
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()["items"]] == [note_id]
    assert removed.status_code == 204
    assert remaining.json() == {"items": [], "total": 0}
