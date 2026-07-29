from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import DEMO_SEED, import_demo_seed

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


async def _clear_demo_sessions(owner: Database) -> None:
    async with owner.transaction() as session:
        await session.execute(
            text("DELETE FROM bookings WHERE workspace_id = :workspace_id"),
            {"workspace_id": DEMO_SEED.workspace.id},
        )
        await session.execute(
            text("DELETE FROM sessions WHERE workspace_id = :workspace_id"),
            {"workspace_id": DEMO_SEED.workspace.id},
        )
        await session.execute(
            text("DELETE FROM session_series WHERE workspace_id = :workspace_id"),
            {"workspace_id": DEMO_SEED.workspace.id},
        )


@pytest.mark.integration
async def test_availability_round_trip_preserves_split_working_days() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    payload = {
        "timezone": "Europe/Berlin",
        "weeklyHours": [
            {"dayOfWeek": 1, "startLocal": "09:00", "endLocal": "12:00"},
            {"dayOfWeek": 1, "startLocal": "13:00", "endLocal": "17:00"},
        ],
        "slotIntervalMin": 30,
        "bufferBeforeMin": 10,
        "bufferAfterMin": 15,
        "minimumNoticeMin": 1440,
        "maximumAdvanceDays": 90,
        "blackouts": [
            {
                "startsAt": "2026-12-24T00:00:00Z",
                "endsAt": "2026-12-27T00:00:00Z",
                "reason": "Winter break",
            }
        ],
    }
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        await _clear_demo_sessions(owner)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            changed = await client.put(
                "/availability", headers=_csrf_headers(client), json=payload
            )
            fetched = await client.get("/availability")
    finally:
        await application.dispose()
        await owner.dispose()

    assert changed.status_code == 200
    assert fetched.status_code == 200
    assert fetched.json()["weeklyHours"] == payload["weeklyHours"]
    assert fetched.json()["blackouts"][0]["reason"] == "Winter break"


@pytest.mark.integration
async def test_database_rejects_overlap_but_allows_adjacent_sessions() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        await _clear_demo_sessions(owner)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            services = await client.get("/services", params={"limit": 1})
            service_id = services.json()["items"][0]["id"]
            start = datetime.now(UTC).replace(microsecond=0) + timedelta(days=30)

            def payload(offset: int, duration: int = 60) -> dict[str, object]:
                session_start = start + timedelta(minutes=offset)
                return {
                    "serviceId": service_id,
                    "calendarOwnerId": str(DEMO_SEED.operator.id),
                    "startAt": session_start.isoformat(),
                    "endAt": (session_start + timedelta(minutes=duration)).isoformat(),
                    "capacity": 1,
                    "locationType": "online",
                    "location": "Zoom",
                }

            first = await client.post(
                "/sessions", headers=_csrf_headers(client), json=payload(0)
            )
            adjacent = await client.post(
                "/sessions", headers=_csrf_headers(client), json=payload(60)
            )
            overlapping = await client.post(
                "/sessions", headers=_csrf_headers(client), json=payload(30)
            )
            cancelled = await client.patch(
                f"/sessions/{first.json()['id']}",
                headers=_csrf_headers(client),
                json={"status": "cancelled"},
            )
            replacement = await client.post(
                "/sessions", headers=_csrf_headers(client), json=payload(0)
            )
    finally:
        await application.dispose()
        await owner.dispose()

    assert first.status_code == 201
    assert adjacent.status_code == 201
    assert overlapping.status_code == 409
    assert overlapping.json()["error"]["code"] == "session_conflict"
    assert cancelled.status_code == 200
    assert replacement.status_code == 201


@pytest.mark.integration
async def test_recurring_session_materialises_the_six_month_horizon() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        await _clear_demo_sessions(owner)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            services = await client.get("/services", params={"limit": 1})
            service_id = services.json()["items"][0]["id"]
            start = datetime.now(UTC).replace(microsecond=0) + timedelta(days=35)
            created = await client.post(
                "/sessions",
                headers=_csrf_headers(client),
                json={
                    "serviceId": service_id,
                    "calendarOwnerId": str(DEMO_SEED.operator.id),
                    "startAt": start.isoformat(),
                    "endAt": (start + timedelta(hours=1)).isoformat(),
                    "capacity": 1,
                    "locationType": "online",
                    "location": "Zoom",
                    "recurrence": {"intervalWeeks": 2, "weekdays": [start.isoweekday()]},
                },
            )
            series_id = created.json()["seriesId"]
            listing = await client.get("/sessions", params={"seriesId": series_id})
            second_id = listing.json()["items"][1]["id"]
            changed = await client.patch(
                f"/sessions/{second_id}",
                params={"scope": "this_and_following"},
                headers=_csrf_headers(client),
                json={"location": "Google Meet"},
            )
            changed_listing = await client.get(
                "/sessions", params={"seriesId": series_id}
            )
    finally:
        await application.dispose()
        await owner.dispose()

    assert created.status_code == 201
    assert created.json()["recurring"] == "custom"
    assert 12 <= listing.json()["total"] <= 14
    assert {item["seriesId"] for item in listing.json()["items"]} == {series_id}
    assert changed.status_code == 200
    assert changed_listing.json()["items"][0]["location"] == "Zoom"
    assert {
        item["location"] for item in changed_listing.json()["items"][1:]
    } == {"Google Meet"}
