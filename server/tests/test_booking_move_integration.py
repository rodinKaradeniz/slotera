from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import DEMO_SEED, import_demo_seed

DEMO_PASSWORD = "slotera-local-only"
ORIGIN = {"Origin": "http://localhost:3344"}


async def _login(client: AsyncClient) -> None:
    response = await client.post(
        "/auth/login",
        headers=ORIGIN,
        json={"email": "hello@slotera.io", "password": DEMO_PASSWORD},
    )
    assert response.status_code == 200


def _csrf(client: AsyncClient, key: str | None = None) -> dict[str, str]:
    headers = {**ORIGIN, "X-CSRF-Token": client.cookies["slotera_csrf"]}
    return {**headers, "Idempotency-Key": key} if key else headers


async def _discovery_slots(client: AsyncClient) -> tuple[str, list[str]]:
    services = await client.get("/public/workspaces/lena/services")
    service = next(item for item in services.json()["items"] if item["name"] == "Discovery Call")
    starts_on = date.today() + timedelta(days=9)
    availability = await client.get(
        f"/public/workspaces/lena/services/{service['id']}/availability",
        params={"from": starts_on.isoformat(), "to": (starts_on + timedelta(days=6)).isoformat()},
    )
    return service["id"], [item["startAt"] for item in availability.json()["items"]]


async def _public_booking(client: AsyncClient, service_id: str, start_at: str) -> str:
    created = await client.post(
        "/public/workspaces/lena/bookings",
        headers={**ORIGIN, "Idempotency-Key": f"move-{uuid4()}"},
        json={
            "serviceId": service_id,
            "startAt": start_at,
            "customer": {
                "firstName": "Move",
                "lastName": "Customer",
                "email": f"move-{uuid4().hex[:8]}@customer.example",
            },
            "billingAddress": {
                "street": "Test Street 1",
                "city": "Berlin",
                "postalCode": "10115",
                "country": "DE",
            },
            "paymentMethod": "free",
            "termsAccepted": True,
        },
    )
    assert created.status_code == 201, created.text
    return str(created.json()["id"])


async def _clean_up(owner: Database, booking_ids: list[str], session_ids: list[str]) -> None:
    async with owner.transaction() as session:
        for booking_id in booking_ids:
            moved_from = (
                await session.execute(
                    text(
                        "SELECT details->>'from_session_id' FROM audit_events "
                        "WHERE resource_id = :id AND action = 'booking.moved'"
                    ),
                    {"id": booking_id},
                )
            ).scalars()
            session_ids.extend(item for item in moved_from if item)
            current = await session.scalar(
                text("SELECT session_id::text FROM bookings WHERE id = :id"), {"id": booking_id}
            )
            if current:
                session_ids.append(current)
            for statement in (
                "DELETE FROM email_outbox WHERE related_booking_id = :id",
                "DELETE FROM notifications WHERE resource_id = :id",
                "DELETE FROM public_booking_idempotency WHERE booking_id = :id",
                "DELETE FROM booking_command_idempotency WHERE booking_id = :id",
                "DELETE FROM audit_events WHERE resource_id = :id",
                "DELETE FROM bookings WHERE id = :id",
            ):
                await session.execute(text(statement), {"id": booking_id})
        for session_id in set(session_ids):
            await session.execute(text("DELETE FROM sessions WHERE id = :id"), {"id": session_id})
        await session.execute(text("DELETE FROM request_rate_limits"))


@pytest.mark.integration
async def test_operator_moves_a_booking_to_another_session_and_the_client_is_told() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    booking_ids: list[str] = []
    session_ids: list[str] = []
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM request_rate_limits"))
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            service_id, slots = await _discovery_slots(client)
            first = await _public_booking(client, service_id, slots[0])
            second = await _public_booking(client, service_id, slots[-1])
            booking_ids.extend([first, second])

            await _login(client)
            services = await client.get("/services", params={"limit": 200})
            other_service = next(
                item["id"] for item in services.json()["items"] if item["id"] != service_id
            )
            base = datetime.now(UTC).replace(hour=3, minute=0, second=0, microsecond=0)

            async def new_session(days: int, service: str) -> str:
                start = base + timedelta(days=days)
                created = await client.post(
                    "/sessions",
                    headers=_csrf(client),
                    json={
                        "serviceId": service,
                        "calendarOwnerId": str(DEMO_SEED.operator.id),
                        "startAt": start.isoformat(),
                        "endAt": (start + timedelta(minutes=30)).isoformat(),
                        "capacity": 1,
                        "locationType": "online",
                        "location": "Zoom",
                    },
                )
                assert created.status_code == 201, created.text
                session_ids.append(created.json()["id"])
                return str(created.json()["id"])

            target = await new_session(40, service_id)
            later = await new_session(41, service_id)
            elsewhere = await new_session(42, other_service)

            async def move(booking: str, session: str, key: str) -> Response:
                return await client.post(
                    f"/bookings/{booking}/move",
                    headers=_csrf(client, key),
                    json={"sessionId": session, "auditReason": "Provider asked to move it."},
                )

            key = f"move-{uuid4()}"
            moved = await move(first, target, key)
            replayed = await move(first, target, key)
            full = await move(second, target, f"move-{uuid4()}")
            wrong_service = await move(second, elsewhere, f"move-{uuid4()}")
            same = await move(first, target, f"move-{uuid4()}")
            moved_again = await move(first, later, f"move-{uuid4()}")

        async with owner.transaction() as session:
            client_emails = await session.scalar(
                text(
                    "SELECT count(*) FROM email_outbox WHERE related_booking_id = :id "
                    "AND kind = 'booking_rescheduled' AND event_key <> ''"
                ),
                {"id": first},
            )
            operator_emails = await session.scalar(
                text(
                    "SELECT count(*) FROM email_outbox "
                    "WHERE related_booking_id = :id AND kind LIKE 'operator%rescheduled'"
                ),
                {"id": first},
            )
            old_sessions = (
                (
                    await session.execute(
                        text(
                            "SELECT s.status::text FROM audit_events a "
                            "JOIN sessions s ON s.id::text = a.details->>'from_session_id' "
                            "WHERE a.resource_id = :id AND a.action = 'booking.moved' "
                            "AND s.origin::text = 'public_open'"
                        ),
                        {"id": first},
                    )
                )
                .scalars()
                .all()
            )
    finally:
        await _clean_up(owner, booking_ids, session_ids)
        await application.dispose()
        await owner.dispose()

    assert moved.status_code == 200 and moved.json()["sessionId"] == target
    assert replayed.status_code == 200 and replayed.json()["sessionId"] == target
    assert full.status_code == 409
    assert full.json()["error"]["code"] == "booking_capacity_exceeded"
    for refused in (wrong_service, same):
        assert refused.status_code == 409
        assert refused.json()["error"]["code"] == "booking_move_target_invalid"
    assert moved_again.status_code == 200 and moved_again.json()["sessionId"] == later
    # One email per actual move (the replay sends nothing), and none to the operator.
    assert client_emails == 2
    assert operator_emails == 0
    assert old_sessions == ["cancelled"]


@pytest.mark.integration
async def test_operator_can_switch_off_the_email_about_new_bookings() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    booking_ids: list[str] = []
    counts: list[int] = []
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM request_rate_limits"))
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            service_id, slots = await _discovery_slots(client)
            await _login(client)
            for index, enabled in enumerate((False, True)):
                saved = await client.patch(
                    "/settings/business",
                    headers=_csrf(client),
                    json={"notifyOperatorNew": enabled},
                )
                assert saved.status_code == 200
                assert saved.json()["notifyOperatorNew"] is enabled
                slot = slots[0 if index == 0 else -1]
                booking_id = await _public_booking(client, service_id, slot)
                booking_ids.append(booking_id)
                async with owner.transaction() as session:
                    counts.append(
                        int(
                            await session.scalar(
                                text(
                                    "SELECT count(*) FROM email_outbox "
                                    "WHERE related_booking_id = :id "
                                    "AND kind = 'operator_booking_new'"
                                ),
                                {"id": booking_id},
                            )
                            or 0
                        )
                    )
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text(
                    "UPDATE workspace_business_profiles SET notify_operator_new = true "
                    "WHERE workspace_id = :id"
                ),
                {"id": DEMO_SEED.workspace.id},
            )
        await _clean_up(owner, booking_ids, [])
        await application.dispose()
        await owner.dispose()

    assert counts == [0, 1]
