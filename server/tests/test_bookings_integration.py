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


@pytest.mark.integration
async def test_operator_can_read_seeded_booking_ledger() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            listed = await client.get("/bookings")
            missing = await client.get(f"/bookings/{uuid4()}")
    finally:
        await application.dispose()
        await owner.dispose()

    assert listed.status_code == 200
    payload = listed.json()
    assert payload["total"] >= 2
    assert {item["currency"] for item in payload["items"]} == {"EUR"}
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "booking_not_found"
