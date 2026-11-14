from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from slotera_api.bookings.repository import BookingsRepository
from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import import_demo_seed


@pytest.mark.integration
async def test_booking_summary_paging_filters_privacy_and_tenant_scope() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    database = Database(get_settings().database_url)
    try:
        await import_demo_seed(owner, demo_password="slotera-local-only")
        async with AsyncClient(
            transport=ASGITransport(app=create_app(database=database)), base_url="http://test"
        ) as client:
            assert (await client.get("/bookings/summaries")).status_code == 401
            login = await client.post(
                "/auth/login",
                headers={"Origin": "http://localhost:3344"},
                json={"email": "hello@slotera.io", "password": "slotera-local-only"},
            )
            assert login.status_code == 200
            first = await client.get("/bookings/summaries?limit=1")
            assert first.status_code == 200, first.text
            payload = first.json()
            assert payload["total"] >= 2
            assert sum(payload["statusCounts"].values()) == payload["total"]
            assert len(payload["items"]) == 1
            row = payload["items"][0]
            assert row["clientName"] and row["serviceName"] and row["startAt"]
            assert not {"notes", "customer", "emailContact", "providerTermsSnapshot"} & row.keys()
            exported = await client.get("/bookings/export.csv")
            assert exported.status_code == 200
            assert len(exported.text.splitlines()) == payload["total"] + 1
            assert exported.headers["cache-control"] == "no-store"
            empty_export = await client.get(
                "/bookings/export.csv", params={"clientId": str(uuid4())}
            )
            assert len(empty_export.text.splitlines()) == 1
            second = (await client.get("/bookings/summaries?limit=1&offset=1")).json()
            assert second["items"][0]["id"] != row["id"]
            filtered = (
                await client.get("/bookings/summaries", params={"status": row["status"]})
            ).json()
            assert filtered["total"] == payload["statusCounts"][row["status"]]
            assert all(item["status"] == row["status"] for item in filtered["items"])
            for filters in (
                {"clientId": str(uuid4())},
                {"search": "%_!"},
                {"serviceId": str(uuid4())},
            ):
                empty = (await client.get("/bookings/summaries", params=filters)).json()
                assert empty["items"] == [] and empty["total"] == 0
            assert (await client.get("/bookings/summaries?limit=101")).status_code == 422
            assert (await client.get("/bookings/summaries?status=unknown")).status_code == 422
            assert first.headers["cache-control"] == "no-store"
            other, total, counts, previews, pending = await BookingsRepository(
                database
            ).list_summaries(UUID(str(uuid4())), limit=25, offset=0)
            assert other == [] and total == 0 and counts == {} and previews == {} and pending == 0
    finally:
        await database.dispose()
        await owner.dispose()
