from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from itertools import count
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.booking_emails import email_history
from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import import_demo_seed

pytestmark = pytest.mark.integration
_dates = count(1)
_base = datetime.now(UTC)


@pytest_asyncio.fixture
async def setup() -> AsyncIterator[tuple[AsyncClient, Database, Database]]:
    owner = Database(get_migration_settings().migration_database_url)
    app_db = Database(get_settings().database_url)
    await import_demo_seed(owner, demo_password="slotera-local-only")
    global _base
    async with owner.transaction() as session:
        latest = await session.scalar(text("SELECT max(end_at) FROM sessions"))
        _base = max(datetime.now(UTC), latest or datetime.now(UTC))
        await session.execute(
            text(
                "DELETE FROM request_rate_limits WHERE scope IN "
                "('workspace_email_send','booking_email_send')"
            )
        )
    try:
        async with AsyncClient(
            transport=ASGITransport(app=create_app(database=app_db)), base_url="http://test"
        ) as client:
            response = await client.post(
                "/auth/login",
                headers={"Origin": "http://localhost:3344"},
                json={"email": "hello@slotera.io", "password": "slotera-local-only"},
            )
            assert response.status_code == 200
            yield client, owner, app_db
    finally:
        await app_db.dispose()
        await owner.dispose()


def headers(client: AsyncClient, key: str | None = None) -> dict[str, str]:
    return {
        "Origin": "http://localhost:3344",
        "X-CSRF-Token": client.cookies["slotera_csrf"],
        "Idempotency-Key": key or str(uuid4()),
    }


async def occurrence(client: AsyncClient, service_name: str = "Discovery Call") -> str:
    services = (await client.get("/services")).json()["items"]
    service = next(item for item in services if item["name"] == service_name)
    start = (_base + timedelta(days=next(_dates))).replace(
        hour=10, minute=0, second=0, microsecond=0
    )
    response = await client.post(
        "/sessions",
        headers=headers(client),
        json={
            "serviceId": service["id"],
            "startAt": start.isoformat(),
            "endAt": (start + timedelta(minutes=service["durationMin"])).isoformat(),
            "capacity": 1,
            "locationType": "online",
            "location": "Test call",
        },
    )
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


async def book(
    client: AsyncClient, *, service: str = "Discovery Call", send: bool = True, language: str = "en"
) -> dict[str, object]:
    response = await client.post(
        "/bookings",
        headers=headers(client),
        json={
            "newClient": {"name": "Everyday client", "email": f"{uuid4()}@example.com"},
            "sessionId": await occurrence(client, service),
            "auditReason": "Test booking",
            "sendEmail": send,
            "language": language,
        },
    )
    assert response.status_code == 201, response.text
    return dict(response.json())


async def queued(owner: Database, booking_id: object) -> list[dict[str, object]]:
    async with owner.transaction() as session:
        rows = (
            (
                await session.execute(
                    text(
                        "SELECT * FROM email_outbox WHERE related_booking_id=:id "
                        "ORDER BY created_at,id"
                    ),
                    {"id": UUID(str(booking_id))},
                )
            )
            .mappings()
            .all()
        )
        return [dict(row) for row in rows]


async def test_atomic_new_client_free_booking_and_explicit_existing_client(setup) -> None:
    client, owner, _ = setup
    key = str(uuid4())
    email = f"{uuid4()}@example.com"
    payload = {
        "newClient": {"name": "Atomic client", "email": email.upper()},
        "sessionId": await occurrence(client),
        "auditReason": "Phone booking",
        "language": "de",
    }
    created = await client.post("/bookings", headers=headers(client, key), json=payload)
    assert created.status_code == 201, created.text
    booking = created.json()
    assert booking["status"] == "confirmed"
    assert (await client.get(f"/sessions/{booking['sessionId']}")).json()["bookedCount"] == 1
    assert booking["sessionId"] not in {
        s["id"] for s in (await client.get("/sessions?bookable=true&limit=500")).json()["items"]
    }
    assert booking["customer"]["email"] == email
    assert booking["termsAcceptedAt"] is None
    assert booking["language"] == "de"
    replay = await client.post("/bookings", headers=headers(client, key), json=payload)
    assert replay.json()["id"] == booking["id"]
    messages = await queued(owner, booking["id"])
    assert len(messages) == 1
    assert messages[0]["kind"] == "booking_confirmed"
    assert messages[0]["template_data"]["language"] == "de"
    payload["sessionId"] = await occurrence(client)
    duplicate = await client.post("/bookings", headers=headers(client), json=payload)
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "client_email_conflict"
    async with owner.transaction() as session:
        assert (
            await session.scalar(
                text("SELECT count(*) FROM clients WHERE email=:email"), {"email": email}
            )
            == 1
        )
    payload.pop("newClient")
    payload["clientId"] = booking["clientId"]
    payload["sendEmail"] = False
    selected = await client.post("/bookings", headers=headers(client), json=payload)
    assert selected.status_code == 201
    assert await queued(owner, selected.json()["id"]) == []


async def test_last_seat_race_rolls_back_losing_client_and_email(setup) -> None:
    import asyncio

    client, owner, _ = setup
    session_id = await occurrence(client, "Strategy Session")
    emails = [f"{uuid4()}@example.com", f"{uuid4()}@example.com"]
    responses = await asyncio.gather(
        *[
            client.post(
                "/bookings",
                headers=headers(client),
                json={
                    "newClient": {"name": "Racing client", "email": email},
                    "sessionId": session_id,
                    "auditReason": "Seat race",
                },
            )
            for email in emails
        ]
    )
    assert sorted(response.status_code for response in responses) == [201, 409]
    async with owner.transaction() as session:
        assert (
            await session.scalar(
                text("SELECT count(*) FROM clients WHERE email=ANY(:emails)"), {"emails": emails}
            )
            == 1
        )
        assert (
            await session.scalar(
                text("SELECT count(*) FROM bookings WHERE session_id=:id"), {"id": UUID(session_id)}
            )
            == 1
        )

        assert (
            await session.scalar(
                text("SELECT count(*) FROM email_outbox WHERE recipient_email=ANY(:emails)"),
                {"emails": emails},
            )
            == 1
        )


async def test_operator_tax_and_required_form_management(setup) -> None:
    client, owner, _ = setup
    await client.patch(
        "/settings/payments",
        headers={
            **headers(client),
            "If-Match": '"v'
            + str((await client.get("/settings/payments")).json().get("version", 1))
            + '"',
        },
        json={
            "taxTreatment": "fixed",
            "taxRateBps": 1900,
            "taxLabel": "VAT",
            "taxJurisdiction": "DE",
        },
    )
    booking = await book(client, service="Strategy Session", language="tr")
    assert booking["status"] == "pending"
    assert booking["taxRateBps"] == 1900
    assert booking["netAmountCents"] + booking["taxAmountCents"] == booking["amountCents"]
    token = (await queued(owner, booking["id"]))[0]["template_data"]["manageUrl"].split("#")[1]
    token_headers = {"X-Booking-Token": token, "Origin": "http://localhost:3344"}
    forms = (await client.get("/public/bookings/manage/forms", headers=token_headers)).json()[
        "items"
    ]
    required = next(form for form in forms if form["requiredBeforePayment"])
    assert required["canSubmit"] is True
    answers = []
    for field in required["fields"]:
        value = (
            True
            if field["type"] == "consent_checkbox"
            else (field["options"][0] if field["type"] == "single_select" else "Preparation")
        )
        answers.append({"fieldId": field["id"], "value": value})
    submitted = await client.post(
        f"/public/bookings/manage/forms/{required['id']}/submit",
        headers=token_headers,
        json={"answers": answers},
    )
    assert submitted.status_code == 200, submitted.text
    assert (await client.get(f"/bookings/{booking['id']}")).json()["status"] == "pending"
    await client.post(f"/bookings/{booking['id']}/mark-payment-received", headers=headers(client))
    messages = await queued(owner, booking["id"])
    assert [message["kind"] for message in messages] == ["booking_received", "booking_confirmed"]


async def test_correction_revokes_links_supersedes_queue_and_preserves_snapshots(setup) -> None:
    client, owner, app_db = setup
    booking = await book(client, service="Strategy Session", language="tr")
    original = (await queued(owner, booking["id"]))[0]
    old_token = original["template_data"]["manageUrl"].split("#")[1]
    corrected = f"corrected-{uuid4()}@example.com"
    key = str(uuid4())
    url = f"/bookings/{booking['id']}/send-details"
    changed = await client.post(
        url,
        headers=headers(client, key),
        json={"expectedRecipientEmail": booking["customer"]["email"], "recipientEmail": corrected},
    )
    assert changed.status_code == 202, changed.text
    assert changed.json()["emailContact"] == corrected
    assert changed.json()["customer"]["email"] == booking["customer"]["email"]
    assert (await client.get(f"/clients/{booking['clientId']}")).json()["email"] == booking[
        "customer"
    ]["email"]
    repeat = await client.post(
        url,
        headers=headers(client, key),
        json={"expectedRecipientEmail": booking["customer"]["email"], "recipientEmail": corrected},
    )
    assert repeat.status_code == 202
    rows = await queued(owner, booking["id"])
    assert len(rows) == 2
    old = next(row for row in rows if row["id"] == original["id"])
    assert old["suppressed_at"] is not None
    latest = next(row for row in rows if row["kind"] == "booking_details")
    token = latest["template_data"]["manageUrl"].split("#")[1]
    assert (
        await client.get("/public/bookings/manage", headers={"X-Booking-Token": old_token})
    ).status_code == 404
    assert (
        await client.get("/public/bookings/manage", headers={"X-Booking-Token": token})
    ).status_code == 200
    history = (await client.get(f"/bookings/{booking['id']}/emails")).json()
    assert history["total"] == 2
    assert {row["status"] for row in history["items"]} == {"queued", "superseded"}
    assert not (
        {"templateData", "textBody", "lastError", "providerMessageId"} & history["items"][0].keys()
    )
    async with app_db.tenant_transaction(uuid4()) as session:
        foreign = await email_history(session, booking_id=UUID(str(booking["id"])))
        assert foreign["items"] == []
        assert (
            await session.scalar(
                text("SELECT slotera_booking_prepare_email_send(:id)"),
                {"id": UUID(str(booking["id"]))},
            )
            is False
        )
    await client.post(f"/bookings/{booking['id']}/mark-payment-received", headers=headers(client))
    assert (await queued(owner, booking["id"]))[-1]["recipient_email"] == corrected
    exported = (await client.get(f"/clients/{booking['clientId']}/export")).json()
    assert exported["bookingEmails"][0]["recipient_email"] == corrected
    assert exported["bookings"][0]["emailContact"] == corrected
    erased = await client.post(
        f"/clients/{booking['clientId']}/erase",
        headers={
            **headers(client),
            "If-Match": '"v'
            + str((await client.get(f"/clients/{booking['clientId']}")).json().get("version", 1))
            + '"',
        },
        json={"confirmEmail": booking["customer"]["email"]},
    )
    assert erased.status_code == 204, erased.text
    assert (
        await client.post(
            url,
            headers=headers(client),
            json={
                "expectedRecipientEmail": booking["customer"]["email"],
                "recipientEmail": corrected,
            },
        )
    ).status_code == 409
    assert (await client.get(f"/bookings/{booking['id']}/emails")).json()["items"] == []


async def test_claimed_messages_block_correction_and_successful_send_limits(setup) -> None:
    client, owner, _ = setup
    booking = await book(client)
    current = booking["customer"]["email"]
    url = f"/bookings/{booking['id']}/send-details"
    async with owner.transaction() as session:
        await session.execute(
            text("UPDATE email_outbox SET claimed_at=now() WHERE related_booking_id=:id"),
            {"id": UUID(str(booking["id"]))},
        )
    busy = await client.post(
        url,
        headers=headers(client),
        json={
            "expectedRecipientEmail": booking["customer"]["email"],
            "recipientEmail": "wrong@example.com",
        },
    )
    assert busy.status_code == 409
    assert busy.json()["error"]["code"] == "booking_email_sending"
    assert (await client.get(f"/bookings/{booking['id']}")).json()["emailContact"] == current
    async with owner.transaction() as session:
        await session.execute(
            text("UPDATE email_outbox SET claimed_at=NULL WHERE related_booking_id=:id"),
            {"id": UUID(str(booking["id"]))},
        )
    key = ""
    for _ in range(5):
        key = str(uuid4())
        sent = await client.post(
            url,
            headers=headers(client, key),
            json={
                "expectedRecipientEmail": booking["customer"]["email"],
                "recipientEmail": current,
            },
        )
        assert sent.status_code == 202, sent.text
    assert (
        await client.post(
            url,
            headers=headers(client),
            json={
                "expectedRecipientEmail": booking["customer"]["email"],
                "recipientEmail": current,
            },
        )
    ).status_code == 429
    assert (
        await client.post(
            url,
            headers=headers(client, key),
            json={
                "expectedRecipientEmail": booking["customer"]["email"],
                "recipientEmail": current,
            },
        )
    ).status_code == 202
    assert (
        await client.post(
            url,
            headers=headers(client, key),
            json={
                "expectedRecipientEmail": booking["customer"]["email"],
                "recipientEmail": "changed@example.com",
            },
        )
    ).status_code == 409


async def test_duplicate_email_race_and_ineligible_sessions_leave_no_client(setup) -> None:
    import asyncio

    client, owner, _ = setup
    email = f"duplicate-{uuid4()}@example.com"
    sessions = [await occurrence(client), await occurrence(client)]
    results = await asyncio.gather(
        *[
            client.post(
                "/bookings",
                headers=headers(client),
                json={
                    "sessionId": session_id,
                    "newClient": {"name": "Same client", "email": email},
                    "auditReason": "Concurrent duplicate",
                    "sendEmail": False,
                },
            )
            for session_id in sessions
        ]
    )
    assert sorted(item.status_code for item in results) == [201, 409]
    assert (
        next(item for item in results if item.status_code == 409).json()["error"]["code"]
        == "client_email_conflict"
    )
    async with owner.transaction() as session:
        assert (
            await session.scalar(
                text("SELECT count(*) FROM clients WHERE email=:email"), {"email": email}
            )
            == 1
        )
    for state in ("cancelled", "past"):
        session_id = await occurrence(client)
        async with owner.transaction() as session:
            if state == "cancelled":
                await session.execute(
                    text("UPDATE sessions SET status='cancelled' WHERE id=:id"),
                    {"id": UUID(session_id)},
                )
            else:
                await session.execute(
                    text(
                        "UPDATE sessions SET start_at=start_at-interval '1000 years', "
                        "end_at=end_at-interval '1000 years' WHERE id=:id"
                    ),
                    {"id": UUID(session_id)},
                )
        orphan = f"orphan-{uuid4()}@example.com"
        result = await client.post(
            "/bookings",
            headers=headers(client),
            json={
                "sessionId": session_id,
                "newClient": {"name": "Invalid session", "email": orphan},
                "auditReason": "Invalid session",
                "sendEmail": True,
            },
        )
        assert result.status_code == 404
        async with owner.transaction() as session:
            assert (
                await session.scalar(
                    text("SELECT count(*) FROM clients WHERE email=:email"), {"email": orphan}
                )
                == 0
            )


async def test_cancelled_summary_and_safe_delivery_states(setup) -> None:
    client, owner, app_db = setup
    booking = await book(client)
    booking_id = UUID(str(booking["id"]))
    original = (await queued(owner, booking_id))[0]
    async with owner.transaction() as session:
        await session.execute(
            text("UPDATE email_outbox SET claimed_at=now(),attempt_count=1 WHERE id=:id"),
            {"id": original["id"]},
        )
    path = f"/bookings/{booking_id}/emails"
    assert (await client.get(path)).json()["items"][0]["status"] == "sending"
    from slotera_api.email.repository import EmailOutboxRepository

    outbox = EmailOutboxRepository(app_db)
    await outbox.mark_failed(original["id"], "Private provider detail")
    safe = (await client.get(path)).json()["items"][0]
    assert safe["status"] == "retrying"
    assert "Private provider detail" not in str(safe)
    async with owner.transaction() as session:
        await session.execute(
            text("UPDATE email_outbox SET attempt_count=10 WHERE id=:id"), {"id": original["id"]}
        )
    assert (await client.get(path)).json()["items"][0]["status"] == "failed"
    await outbox.mark_sent(original["id"], "console:local-test")
    safe = (await client.get(path)).json()["items"][0]
    assert safe["status"] == "sent" and safe["simulated"] is True
    await client.post(f"/bookings/{booking_id}/cancel", headers=headers(client))
    result = await client.post(
        f"/bookings/{booking_id}/send-details",
        headers=headers(client),
        json={
            "expectedRecipientEmail": booking["customer"]["email"],
            "recipientEmail": booking["customer"]["email"],
        },
    )
    assert result.status_code == 202
    rows = await queued(owner, booking_id)
    details = next(row for row in rows if row["kind"] == "booking_details")
    assert details["template_data"]["bookingStatus"] == "cancelled"
    assert details["template_data"]["manageUrl"] is None
    cancelled = next(row for row in rows if row["kind"] == "booking_cancelled")
    assert cancelled["suppressed_at"] is not None
    assert not await outbox.mark_sent(cancelled["id"], "should-not-send")
    foreign = uuid4()
    assert (await client.get(f"/bookings/{foreign}/emails")).status_code == 404
    assert (
        await client.post(
            f"/bookings/{foreign}/send-details",
            headers=headers(client),
            json={
                "expectedRecipientEmail": booking["customer"]["email"],
                "recipientEmail": "test@example.com",
            },
        )
    ).status_code == 404
    assert (
        await client.post(
            f"/bookings/{booking_id}/send-details",
            json={
                "expectedRecipientEmail": booking["customer"]["email"],
                "recipientEmail": "test@example.com",
            },
        )
    ).status_code == 403


async def test_workspace_limit_counts_successes_but_not_replays(setup) -> None:
    client, owner, _ = setup
    async with owner.transaction() as session:
        await session.execute(
            text(
                "DELETE FROM request_rate_limits WHERE scope IN "
                "('workspace_email_send','booking_email_send')"
            )
        )
    bookings = [await book(client, send=False) for _ in range(7)]
    for booking in bookings[:6]:
        for _ in range(5):
            key = str(uuid4())
            path = f"/bookings/{booking['id']}/send-details"
            payload = {
                "expectedRecipientEmail": booking["customer"]["email"],
                "recipientEmail": booking["customer"]["email"],
            }
            assert (
                await client.post(path, headers=headers(client, key), json=payload)
            ).status_code == 202
            assert (
                await client.post(path, headers=headers(client, key), json=payload)
            ).status_code == 202
    booking = bookings[-1]
    result = await client.post(
        f"/bookings/{booking['id']}/send-details",
        headers=headers(client),
        json={
            "expectedRecipientEmail": booking["customer"]["email"],
            "recipientEmail": booking["customer"]["email"],
        },
    )
    assert result.status_code == 429
    assert await queued(owner, booking["id"]) == []


async def test_initial_email_failure_rolls_back_every_created_record(setup, monkeypatch) -> None:
    client, owner, _ = setup
    session_id = await occurrence(client)
    email = f"rollback-{uuid4()}@example.com"

    async def fail_queue(*args, **kwargs):
        return False

    monkeypatch.setattr("slotera_api.bookings.repository.emit_booking_event", fail_queue)
    # The unexpected-error envelope is verified elsewhere; this boundary must roll back.
    with pytest.raises(RuntimeError, match="initial booking email"):
        await client.post(
            "/bookings",
            headers=headers(client),
            json={
                "sessionId": session_id,
                "newClient": {"name": "Rollback client", "email": email},
                "auditReason": "Transaction rollback",
            },
        )
    async with owner.transaction() as session:
        assert (
            await session.scalar(
                text("SELECT count(*) FROM clients WHERE email=:email"), {"email": email}
            )
            == 0
        )
        assert (
            await session.scalar(
                text("SELECT count(*) FROM bookings WHERE session_id=:id"), {"id": UUID(session_id)}
            )
            == 0
        )
        assert (
            await session.scalar(
                text("SELECT count(*) FROM email_outbox WHERE recipient_email=:email"),
                {"email": email},
            )
            == 0
        )


async def test_existing_client_redaction_cannot_race_a_new_booking(setup) -> None:
    import asyncio

    client, owner, _ = setup
    identity = await client.post(
        "/clients",
        headers=headers(client),
        json={"name": "Concurrent erasure", "email": f"erasure-{uuid4()}@example.com"},
    )
    assert identity.status_code == 201
    client_id = UUID(identity.json()["id"])
    session_id = await occurrence(client)
    task = None
    try:
        async with owner.transaction() as session:
            blocker = await session.scalar(text("SELECT pg_backend_pid()"))
            await session.execute(
                text("SELECT id FROM clients WHERE id=:id FOR UPDATE"), {"id": client_id}
            )
            task = asyncio.create_task(
                client.post(
                    "/bookings",
                    headers=headers(client),
                    json={
                        "clientId": str(client_id),
                        "sessionId": session_id,
                        "auditReason": "Concurrent erasure",
                        "sendEmail": True,
                    },
                )
            )
            for _ in range(200):
                waiting = await session.scalar(
                    text(
                        "SELECT EXISTS (SELECT 1 FROM pg_stat_activity "
                        "WHERE datname=current_database() AND :blocker=ANY(pg_blocking_pids(pid)))"
                    ),
                    {"blocker": blocker},
                )
                if waiting:
                    break
                await asyncio.sleep(0.01)
            assert waiting, "Booking did not reach the locked client boundary"
            await session.execute(
                text(
                    "UPDATE clients SET name='Erased client',email=:email,"
                    "erased_at=now() WHERE id=:id"
                ),
                {"id": client_id, "email": f"erased+{client_id}@invalid"},
            )
        result = await asyncio.wait_for(task, timeout=10)
        assert result.status_code == 404, result.text
        async with owner.transaction() as session:
            assert (
                await session.scalar(
                    text("SELECT count(*) FROM bookings WHERE client_id=:id"), {"id": client_id}
                )
                == 0
            )
    finally:
        if task and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)


async def test_expired_final_worker_attempt_becomes_recoverable_failure(setup) -> None:
    client, owner, app_db = setup
    booking = await book(client)
    original = (await queued(owner, booking["id"]))[0]
    async with owner.transaction() as session:
        await session.execute(
            text(
                "UPDATE email_outbox SET attempt_count=10, "
                "claimed_at=now()-interval '6 minutes' WHERE id=:id"
            ),
            {"id": original["id"]},
        )
    from slotera_api.email.repository import EmailOutboxRepository

    repository = EmailOutboxRepository(app_db)
    other = await repository.claim()
    if other:
        assert other.id != original["id"]
        await repository.mark_failed(other.id, "Disposable test release")
    history = (await client.get(f"/bookings/{booking['id']}/emails")).json()
    assert history["items"][0]["status"] == "failed"
    recovered = await client.post(
        f"/bookings/{booking['id']}/send-details",
        headers=headers(client),
        json={
            "expectedRecipientEmail": booking["customer"]["email"],
            "recipientEmail": booking["customer"]["email"],
        },
    )
    assert recovered.status_code == 202, recovered.text
    rows = await queued(owner, booking["id"])
    assert next(row for row in rows if row["id"] == original["id"])["suppressed_at"] is not None
    assert len(rows) == 2
