from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import DEMO_SEED, import_demo_seed

ORIGIN = "http://localhost:3344"


def _payload(service_id: str, start_at: str, email: str) -> dict[str, object]:
    return {
        "serviceId": service_id,
        "startAt": start_at,
        "customer": {"firstName": "Group", "lastName": "Guest", "email": email},
        "billingAddress": {
            "street": "Test Street 1",
            "city": "Berlin",
            "postalCode": "10115",
            "country": "DE",
        },
        "paymentMethod": "manual",
        "termsAccepted": True,
    }


@pytest.mark.integration
async def test_scheduled_group_session_takes_public_bookings_until_full() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    session_id = uuid4()
    starts_at = (datetime.now(UTC) + timedelta(days=10)).replace(
        hour=9, minute=0, second=0, microsecond=0
    )
    try:
        await import_demo_seed(owner, demo_password="slotera-local-only")
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM request_rate_limits"))
            # A capacity-2 workshop the operator scheduled; clients join it publicly.
            await session.execute(
                text(
                    """
                    INSERT INTO sessions (
                      id, workspace_id, series_id, service_id, calendar_owner_id,
                      start_at, end_at, capacity, status, origin,
                      location_type, location, address, notes
                    )
                    SELECT :id, s.workspace_id, NULL, s.id, :owner_id,
                           :start_at, :end_at, 2, 'scheduled', 'operator',
                           s.location_type, s.location, s.address, NULL
                    FROM services s
                    WHERE s.workspace_id = :workspace_id AND s.name = 'Group Workshop'
                    """
                ),
                {
                    "id": session_id,
                    "owner_id": DEMO_SEED.operator.id,
                    "workspace_id": DEMO_SEED.workspace.id,
                    "start_at": starts_at,
                    "end_at": starts_at + timedelta(hours=2),
                },
            )

        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            services = await client.get("/public/workspaces/lena/services")
            workshop = next(
                item for item in services.json()["items"] if item["name"] == "Group Workshop"
            )
            day = starts_at.date()
            window = {"from": (day - timedelta(days=1)).isoformat(), "to": day.isoformat()}
            availability_path = f"/public/workspaces/lena/services/{workshop['id']}/availability"
            before = await client.get(availability_path, params=window)
            slot = next(
                item
                for item in before.json()["items"]
                if datetime.fromisoformat(item["startAt"]) == starts_at
            )
            responses = []
            for index in range(3):
                responses.append(
                    await client.post(
                        "/public/workspaces/lena/bookings",
                        headers={"Origin": ORIGIN, "Idempotency-Key": f"group-{uuid4()}"},
                        json=_payload(
                            workshop["id"], slot["startAt"], f"guest{index}@group.example"
                        ),
                    )
                )
            after = await client.get(availability_path, params=window)

        async with owner.transaction() as session:
            stored = (
                (
                    await session.execute(
                        text(
                            """
                            SELECT s.status::text AS status, s.origin::text AS origin,
                                   count(b.id) AS bookings
                            FROM sessions s
                            LEFT JOIN bookings b ON b.session_id = s.id
                            WHERE s.id = :id
                            GROUP BY s.status, s.origin
                            """
                        ),
                        {"id": session_id},
                    )
                )
                .mappings()
                .one()
            )
    finally:
        async with owner.transaction() as session:
            booking_ids = "SELECT id FROM bookings WHERE session_id = :id"
            for statement in (
                f"DELETE FROM email_outbox WHERE related_booking_id IN ({booking_ids})",
                f"DELETE FROM notifications WHERE resource_id IN ({booking_ids})",
                f"DELETE FROM public_booking_idempotency WHERE booking_id IN ({booking_ids})",
                "DELETE FROM bookings WHERE session_id = :id",
                "DELETE FROM sessions WHERE id = :id",
            ):
                await session.execute(text(statement), {"id": session_id})
        await application.dispose()
        await owner.dispose()

    assert workshop["bookingMode"] == "scheduled"
    assert workshop["capacity"] == 6
    assert slot["spotsLeft"] == 2
    first, second, third = responses
    assert first.status_code == 201
    assert first.json()["sessionLocationType"] == "physical"
    assert first.json()["sessionAddress"]["city"] == "Berlin"
    assert second.status_code == 201
    assert third.status_code == 409
    assert slot["startAt"] not in {item["startAt"] for item in after.json()["items"]}
    # Joining never creates or cancels a session: the operator's session holds both seats.
    assert stored == {"status": "scheduled", "origin": "operator", "bookings": 2}
