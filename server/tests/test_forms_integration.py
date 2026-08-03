# ruff: noqa: E501
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


def _csrf(client: AsyncClient) -> dict[str, str]:
    return {"Origin": "http://localhost:3344", "X-CSRF-Token": client.cookies["slotera_csrf"]}


@pytest.mark.integration
async def test_operator_can_create_and_read_form_template() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    payload = {
        "name": "Discovery prep",
        "description": "A few questions before we meet.",
        "status": "active",
        "fields": [
            {"id": "focus", "label": "What should we cover?", "type": "long_text", "required": True}
        ],
        "attachedServiceIds": [],
        "requiredBeforePayment": True,
    }
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            created = await client.post("/forms", headers=_csrf(client), json=payload)
            form_id = created.json()["id"]
            updated = await client.patch(
                f"/forms/{form_id}",
                headers=_csrf(client),
                json={"status": "inactive"},
            )
            removed = await client.delete(f"/forms/{form_id}", headers=_csrf(client))
            listed = await client.get("/forms")
    finally:
        await application.dispose()
        await owner.dispose()

    assert created.status_code == 201
    assert created.json()["fields"][0]["id"] == "focus"
    assert updated.status_code == 200
    assert updated.json()["status"] == "inactive"
    assert removed.status_code == 204
    assert not any(item["id"] == form_id for item in listed.json()["items"])
