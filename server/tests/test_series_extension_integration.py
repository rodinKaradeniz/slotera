from datetime import UTC, date, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.maintenance import extend_series_horizons
from slotera_api.scheduling.repository import SchedulingRepository
from slotera_api.seed import DEMO_SEED, import_demo_seed

DEMO_PASSWORD = "slotera-local-only"
ORIGIN = "http://localhost:3344"
WORKSPACE_ID = DEMO_SEED.workspace.id


def _csrf(client: AsyncClient) -> dict[str, str]:
    return {"Origin": ORIGIN, "X-CSRF-Token": client.cookies["slotera_csrf"]}


async def _clear_sessions(owner: Database) -> None:
    async with owner.transaction() as session:
        for table in ("bookings", "sessions", "session_series"):
            await session.execute(
                text(f"DELETE FROM {table} WHERE workspace_id = :id"), {"id": WORKSPACE_ID}
            )


@pytest.mark.integration
async def test_maintenance_tops_up_recurring_series() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        await _clear_sessions(owner)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            login = await client.post(
                "/auth/login",
                headers={"Origin": ORIGIN},
                json={"email": "hello@slotera.app", "password": DEMO_PASSWORD},
            )
            assert login.status_code == 200
            service_id = (await client.get("/services", params={"limit": 1})).json()["items"][0][
                "id"
            ]
            start = datetime.now(UTC).replace(microsecond=0, second=0) + timedelta(days=1)

            async def create(recurrence: dict[str, object] | None, at: datetime) -> str:
                body: dict[str, object] = {
                    "serviceId": service_id,
                    "calendarOwnerId": str(DEMO_SEED.operator.id),
                    "startAt": at.isoformat(),
                    "endAt": (at + timedelta(hours=1)).isoformat(),
                    "capacity": 1,
                    "locationType": "online",
                    "location": "Zoom",
                }
                if recurrence is not None:
                    body["recurrence"] = recurrence
                response = await client.post("/sessions", headers=_csrf(client), json=body)
                assert response.status_code == 201, response.text
                return str(response.json()["seriesId"] or response.json()["id"])

            weekday = [start.isoweekday()]
            open_ended = await create({"intervalWeeks": 1, "weekdays": weekday}, start)
            bounded = await create(
                {
                    "intervalWeeks": 1,
                    "weekdays": weekday,
                    "endsOn": (start.date() + timedelta(days=30)).isoformat(),
                },
                start + timedelta(hours=3),
            )

        # Pretend the open-ended series was created 8 weeks ago: drop its last 8 weeks
        # and wind its horizon back. Then change the latest remaining occurrence, as a
        # "this and following" edit would, and book over one slot that will be re-created.
        async with owner.transaction() as session:
            through = await session.scalar(
                text("SELECT horizon_through FROM session_series WHERE id = :id"),
                {"id": open_ended},
            )
            assert isinstance(through, date)
            wound_back = through - timedelta(weeks=8)
            await session.execute(
                text(
                    "DELETE FROM sessions USING session_series AS series "
                    "WHERE sessions.series_id = :id AND series.id = sessions.series_id "
                    "AND (sessions.start_at AT TIME ZONE series.timezone)::date > :cutoff"
                ),
                {"id": open_ended, "cutoff": wound_back},
            )
            await session.execute(
                text("UPDATE session_series SET horizon_through = :d WHERE id = :id"),
                {"d": wound_back, "id": open_ended},
            )
            latest_start = await session.scalar(
                text("SELECT max(start_at) FROM sessions WHERE series_id = :id"),
                {"id": open_ended},
            )
            await session.execute(
                text(
                    "UPDATE sessions SET location = 'Google Meet' "
                    "WHERE series_id = :id AND start_at = :at"
                ),
                {"id": open_ended, "at": latest_start},
            )
            before = await session.scalar(
                text("SELECT count(*) FROM sessions WHERE series_id = :id"), {"id": open_ended}
            )

        assert isinstance(latest_start, datetime)
        clash_at = latest_start + timedelta(weeks=2)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post(
                "/auth/login",
                headers={"Origin": ORIGIN},
                json={"email": "hello@slotera.app", "password": DEMO_PASSWORD},
            )
            await create(None, clash_at)

        await extend_series_horizons(application)
        second_run = await SchedulingRepository(application).extend_series(WORKSPACE_ID, open_ended)
        bounded_run = await SchedulingRepository(application).extend_series(WORKSPACE_ID, bounded)

        async with owner.transaction() as session:
            after = await session.scalar(
                text("SELECT count(*) FROM sessions WHERE series_id = :id"), {"id": open_ended}
            )
            new_locations = set(
                await session.scalars(
                    text("SELECT location FROM sessions WHERE series_id = :id AND start_at > :at"),
                    {"id": open_ended, "at": latest_start},
                )
            )
            clashed = await session.scalar(
                text("SELECT count(*) FROM sessions WHERE series_id = :id AND start_at = :at"),
                {"id": open_ended, "at": clash_at},
            )
            horizon = await session.scalar(
                text("SELECT horizon_through FROM session_series WHERE id = :id"),
                {"id": open_ended},
            )
            audit = await session.scalar(
                text(
                    "SELECT count(*) FROM audit_events WHERE resource_id = :id "
                    "AND action = 'session.series_extended'"
                ),
                {"id": open_ended},
            )
    finally:
        await _clear_sessions(owner)
        await application.dispose()
        await owner.dispose()

    assert isinstance(before, int) and isinstance(after, int)
    # Eight weeks come back, minus the one slot that clashes with a one-off session.
    assert after - before == 7
    assert clashed == 0
    assert new_locations == {"Google Meet"}
    # The horizon is measured from today rather than from the first session's date.
    assert isinstance(horizon, date) and horizon >= through - timedelta(days=1)
    assert audit == 1
    assert second_run == 0
    assert bounded_run == 0
