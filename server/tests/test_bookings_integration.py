import asyncio
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

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


def _csrf_headers(client: AsyncClient, *, idempotency_key: str) -> dict[str, str]:
    return {
        "Origin": "http://localhost:3344",
        "X-CSRF-Token": client.cookies["slotera_csrf"],
        "Idempotency-Key": idempotency_key,
    }


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


@pytest.mark.integration
async def test_operator_can_create_an_idempotent_capacity_consuming_booking() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    idempotency_key = f"booking-command-{uuid4()}"
    booking_id: UUID | None = None
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            sessions = await client.get("/sessions")
            workshop = next(item for item in sessions.json()["items"] if item["capacity"] > 1)
            clients = await client.get("/clients")
            created = await client.post(
                "/bookings",
                headers=_csrf_headers(client, idempotency_key=idempotency_key),
                json={
                    "clientId": clients.json()["items"][0]["id"],
                    "sessionId": workshop["id"],
                    "auditReason": "Recorded an operator-arranged manual booking.",
                },
            )
            repeated = await client.post(
                "/bookings",
                headers=_csrf_headers(client, idempotency_key=idempotency_key),
                json={
                    "clientId": clients.json()["items"][0]["id"],
                    "sessionId": workshop["id"],
                    "auditReason": "Recorded an operator-arranged manual booking.",
                },
            )
            if created.status_code == 201:
                booking_id = UUID(created.json()["id"])
    finally:
        if booking_id is not None:
            async with owner.transaction() as session:
                await session.execute(
                    text("DELETE FROM booking_command_idempotency WHERE booking_id = :booking_id"),
                    {"booking_id": booking_id},
                )
                await session.execute(
                    text("DELETE FROM audit_events WHERE resource_id = :booking_id"),
                    {"booking_id": booking_id},
                )
                await session.execute(
                    text("DELETE FROM bookings WHERE id = :booking_id"),
                    {"booking_id": booking_id},
                )
        await application.dispose()
        await owner.dispose()

    assert created.status_code == 201
    assert created.json()["status"] == "pending"
    assert created.json()["paymentStatus"] == "pending"
    assert repeated.status_code == 201
    assert repeated.json()["id"] == created.json()["id"]


@pytest.mark.integration
async def test_booking_status_commands_preserve_payment_state_and_reject_invalid_transitions(
) -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    booking_id: UUID | None = None
    audit_rows: list[tuple[str, str | None]] = []
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            sessions = await client.get("/sessions")
            workshop = next(item for item in sessions.json()["items"] if item["capacity"] > 1)
            clients = await client.get("/clients")
            created = await client.post(
                "/bookings",
                headers=_csrf_headers(client, idempotency_key=f"create-{uuid4()}"),
                json={
                    "clientId": clients.json()["items"][0]["id"],
                    "sessionId": workshop["id"],
                    "auditReason": "Operator arranged this pending manual payment booking.",
                },
            )
            booking_id = UUID(created.json()["id"])
            confirm_key = f"confirm-{uuid4()}"
            confirmed = await client.post(
                f"/bookings/{booking_id}/confirm",
                headers=_csrf_headers(client, idempotency_key=confirm_key),
            )
            repeated_confirm = await client.post(
                f"/bookings/{booking_id}/confirm",
                headers=_csrf_headers(client, idempotency_key=confirm_key),
            )
            cancelled = await client.post(
                f"/bookings/{booking_id}/cancel",
                headers=_csrf_headers(client, idempotency_key=f"cancel-{uuid4()}"),
            )
            invalid = await client.post(
                f"/bookings/{booking_id}/complete",
                headers=_csrf_headers(client, idempotency_key=f"complete-{uuid4()}"),
            )
            reused_key = await client.post(
                f"/bookings/{booking_id}/complete",
                headers=_csrf_headers(client, idempotency_key=confirm_key),
            )
            csrf_rejected = await client.post(
                f"/bookings/{booking_id}/confirm",
                headers={"Origin": "http://localhost:3344", "Idempotency-Key": str(uuid4())},
            )
            async with owner.transaction() as session:
                audit_rows = [
                    (str(row.action), row.audit_reason)
                    for row in (
                        await session.execute(
                            text(
                                """
                                SELECT action, details ->> 'audit_reason' AS audit_reason
                                FROM audit_events
                                WHERE resource_id = :booking_id
                                ORDER BY occurred_at, id
                                """
                            ),
                            {"booking_id": booking_id},
                        )
                    ).all()
                ]
    finally:
        if booking_id is not None:
            async with owner.transaction() as session:
                await session.execute(
                    text("DELETE FROM booking_command_idempotency WHERE booking_id = :booking_id"),
                    {"booking_id": booking_id},
                )
                await session.execute(
                    text("DELETE FROM audit_events WHERE resource_id = :booking_id"),
                    {"booking_id": booking_id},
                )
                await session.execute(
                    text("DELETE FROM bookings WHERE id = :booking_id"),
                    {"booking_id": booking_id},
                )
        await application.dispose()
        await owner.dispose()

    assert created.status_code == 201
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmed"
    assert confirmed.json()["paymentStatus"] == "pending"
    assert repeated_confirm.status_code == 200
    assert repeated_confirm.json()["id"] == str(booking_id)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["paymentStatus"] == "pending"
    assert invalid.status_code == 409
    assert invalid.json()["error"]["code"] == "booking_transition_invalid"
    assert reused_key.status_code == 409
    assert reused_key.json()["error"]["code"] == "idempotency_key_reused"
    assert csrf_rejected.status_code == 403
    assert csrf_rejected.json()["error"]["code"] == "csrf_validation_failed"
    assert [action for action, _ in audit_rows] == [
        "booking.created",
        "booking.confirmed",
        "booking.cancelled",
    ]
    assert audit_rows[0][1] == "Operator arranged this pending manual payment booking."


@pytest.mark.integration
async def test_confirmed_bookings_can_complete_or_end_as_noshow() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    booking_ids: list[UUID] = []
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            sessions = await client.get("/sessions")
            workshop = next(item for item in sessions.json()["items"] if item["capacity"] > 1)
            clients = await client.get("/clients")
            final_responses = []
            for command in ("complete", "noshow"):
                created = await client.post(
                    "/bookings",
                    headers=_csrf_headers(client, idempotency_key=f"create-{command}-{uuid4()}"),
                    json={
                        "clientId": clients.json()["items"][0]["id"],
                        "sessionId": workshop["id"],
                        "auditReason": "Operator recorded a booking for a completed session test.",
                    },
                )
                booking_id = UUID(created.json()["id"])
                booking_ids.append(booking_id)
                confirmed = await client.post(
                    f"/bookings/{booking_id}/confirm",
                    headers=_csrf_headers(client, idempotency_key=f"confirm-{command}-{uuid4()}"),
                )
                final_responses.append(
                    await client.post(
                        f"/bookings/{booking_id}/{command}",
                        headers=_csrf_headers(client, idempotency_key=f"{command}-{uuid4()}"),
                    )
                )
                assert confirmed.status_code == 200
    finally:
        async with owner.transaction() as session:
            for booking_id in booking_ids:
                await session.execute(
                    text("DELETE FROM booking_command_idempotency WHERE booking_id = :booking_id"),
                    {"booking_id": booking_id},
                )
                await session.execute(
                    text("DELETE FROM audit_events WHERE resource_id = :booking_id"),
                    {"booking_id": booking_id},
                )
                await session.execute(
                    text("DELETE FROM bookings WHERE id = :booking_id"),
                    {"booking_id": booking_id},
                )
        await application.dispose()
        await owner.dispose()

    assert [response.status_code for response in final_responses] == [200, 200]
    assert [response.json()["status"] for response in final_responses] == ["completed", "noshow"]
    assert all(response.json()["paymentStatus"] == "pending" for response in final_responses)


@pytest.mark.integration
async def test_group_attendance_completes_a_booking_and_supports_safe_correction() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    booking_id: UUID | None = None
    audit_actions: list[str] = []
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            sessions = await client.get("/sessions")
            workshop = next(item for item in sessions.json()["items"] if item["capacity"] > 1)
            clients = await client.get("/clients")
            created = await client.post(
                "/bookings",
                headers=_csrf_headers(client, idempotency_key=f"create-attendance-{uuid4()}"),
                json={
                    "clientId": clients.json()["items"][0]["id"],
                    "sessionId": workshop["id"],
                    "auditReason": "Recorded a group booking for attendance testing.",
                },
            )
            booking_id = UUID(created.json()["id"])
            confirmed = await client.post(
                f"/bookings/{booking_id}/confirm",
                headers=_csrf_headers(client, idempotency_key=f"confirm-attendance-{uuid4()}"),
            )
            attendance_key = f"attendance-{uuid4()}"
            recorded = await client.post(
                f"/bookings/{booking_id}/attendance",
                headers=_csrf_headers(client, idempotency_key=attendance_key),
                json={"attendance": "late"},
            )
            replayed = await client.post(
                f"/bookings/{booking_id}/attendance",
                headers=_csrf_headers(client, idempotency_key=attendance_key),
                json={"attendance": "late"},
            )
            corrected = await client.post(
                f"/bookings/{booking_id}/attendance",
                headers=_csrf_headers(client, idempotency_key=f"correct-attendance-{uuid4()}"),
                json={"attendance": "absent"},
            )
            roster = await client.get(f"/bookings?sessionId={workshop['id']}")
            async with owner.transaction() as session:
                audit_actions = [
                    str(row.action)
                    for row in (
                        await session.execute(
                            text(
                                "SELECT action FROM audit_events "
                                "WHERE resource_id = :booking_id ORDER BY occurred_at, id"
                            ),
                            {"booking_id": booking_id},
                        )
                    ).all()
                ]
    finally:
        if booking_id is not None:
            async with owner.transaction() as session:
                await session.execute(
                    text("DELETE FROM audit_events WHERE resource_id = :booking_id"),
                    {"booking_id": booking_id},
                )
                await session.execute(
                    text("DELETE FROM bookings WHERE id = :booking_id"),
                    {"booking_id": booking_id},
                )
        await application.dispose()
        await owner.dispose()

    assert created.status_code == 201
    assert confirmed.status_code == 200
    assert recorded.status_code == 200
    assert recorded.json()["status"] == "completed"
    assert recorded.json()["attendance"] == "late"
    assert recorded.json()["paymentStatus"] == "pending"
    assert replayed.status_code == 200
    assert replayed.json()["attendance"] == "late"
    assert corrected.status_code == 200
    assert corrected.json()["status"] == "completed"
    assert corrected.json()["attendance"] == "absent"
    assert roster.status_code == 200
    assert all(item["sessionId"] == workshop["id"] for item in roster.json()["items"])
    recorded_roster_booking = next(
        item for item in roster.json()["items"] if item["id"] == str(booking_id)
    )
    assert recorded_roster_booking["attendance"] == "absent"
    assert audit_actions == [
        "booking.created",
        "booking.confirmed",
        "booking.attendance_recorded",
        "booking.attendance_recorded",
    ]


@pytest.mark.integration
async def test_attendance_rejects_a_confirmed_one_to_one_booking() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            sessions = await client.get("/sessions")
            appointment = next(item for item in sessions.json()["items"] if item["capacity"] == 1)
            bookings = await client.get(f"/bookings?sessionId={appointment['id']}")
            booking_id = bookings.json()["items"][0]["id"]
            rejected = await client.post(
                f"/bookings/{booking_id}/attendance",
                headers=_csrf_headers(client, idempotency_key=f"one-to-one-attendance-{uuid4()}"),
                json={"attendance": "present"},
            )
    finally:
        await application.dispose()
        await owner.dispose()

    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "booking_attendance_invalid"


@pytest.mark.integration
async def test_concurrent_booking_commands_cannot_overfill_a_session() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    session_id: UUID | None = None
    client_ids: list[UUID] = []
    booking_ids: list[UUID] = []
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            services = await client.get("/services")
            created_session = await client.post(
                "/sessions",
                headers=_csrf_headers(client, idempotency_key=str(uuid4())),
                json={
                    "serviceId": services.json()["items"][0]["id"],
                    "startAt": "2030-01-02T09:00:00Z",
                    "endAt": "2030-01-02T10:00:00Z",
                    "capacity": 1,
                    "locationType": "online",
                    "location": "Private video call",
                },
            )
            session_id = UUID(created_session.json()["id"])
            for label in ("First", "Second"):
                created_client = await client.post(
                    "/clients",
                    headers=_csrf_headers(client, idempotency_key=str(uuid4())),
                    json={"name": f"{label} Capacity", "email": f"{uuid4()}@example.com"},
                )
                client_ids.append(UUID(created_client.json()["id"]))

            async def create_for(client_id: UUID):
                return await client.post(
                    "/bookings",
                    headers=_csrf_headers(client, idempotency_key=f"capacity-{uuid4()}"),
                    json={
                        "clientId": str(client_id),
                        "sessionId": str(session_id),
                        "auditReason": "Testing concurrent capacity enforcement.",
                    },
                )

            first, second = await asyncio.gather(
                *(create_for(client_id) for client_id in client_ids)
            )
            for response in (first, second):
                if response.status_code == 201:
                    booking_ids.append(UUID(response.json()["id"]))
    finally:
        async with owner.transaction() as session:
            if booking_ids:
                for booking_id in booking_ids:
                    await session.execute(
                        text(
                            "DELETE FROM booking_command_idempotency WHERE booking_id = :booking_id"
                        ),
                        {"booking_id": booking_id},
                    )
                    await session.execute(
                        text("DELETE FROM audit_events WHERE resource_id = :booking_id"),
                        {"booking_id": booking_id},
                    )
                    await session.execute(
                        text("DELETE FROM bookings WHERE id = :booking_id"),
                        {"booking_id": booking_id},
                    )
            if session_id is not None:
                await session.execute(
                    text("DELETE FROM audit_events WHERE resource_id = :session_id"),
                    {"session_id": session_id},
                )
                await session.execute(
                    text("DELETE FROM sessions WHERE id = :session_id"),
                    {"session_id": session_id},
                )
            if client_ids:
                await session.execute(
                    text("DELETE FROM audit_events WHERE resource_id = ANY(:client_ids)"),
                    {"client_ids": client_ids},
                )
                await session.execute(
                    text("DELETE FROM clients WHERE id = ANY(:client_ids)"),
                    {"client_ids": client_ids},
                )
        await application.dispose()
        await owner.dispose()

    assert created_session.status_code == 201
    assert sorted([first.status_code, second.status_code]) == [201, 409]
    rejected = first if first.status_code == 409 else second
    assert rejected.json()["error"]["code"] == "booking_capacity_exceeded"
