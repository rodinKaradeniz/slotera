"""Client credentials and communication contracts exercised through restricted runtime SQL."""

from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import import_demo_seed

pytestmark = pytest.mark.integration
ORIGIN = {"Origin": "http://localhost:3344"}


@pytest_asyncio.fixture
async def communication() -> AsyncIterator[tuple[AsyncClient, AsyncClient, Database]]:
    owner = Database(get_migration_settings().migration_database_url)
    database = Database(get_settings().database_url)
    await import_demo_seed(owner, demo_password="slotera-local-only")
    app = create_app(database=database)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as operator:
        result = await operator.post(
            "/auth/login",
            headers=ORIGIN,
            json={"email": "hello@slotera.io", "password": "slotera-local-only"},
        )
        assert result.status_code == 200
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as customer:
            yield operator, customer, owner
    await database.dispose()
    await owner.dispose()


def staff_headers(operator: AsyncClient) -> dict[str, str]:
    return {**ORIGIN, "X-CSRF-Token": operator.cookies["slotera_csrf"]}


def client_headers(customer: AsyncClient) -> dict[str, str]:
    return {**ORIGIN, "X-CSRF-Token": customer.cookies["slotera_client_csrf"]}


async def sign_in(operator: AsyncClient, customer: AsyncClient, owner: Database) -> tuple[str, str]:
    email = f"synthetic-{uuid4()}@example.com"
    created = await operator.post(
        "/clients",
        headers=staff_headers(operator),
        json={"name": "Synthetic client", "email": email},
    )
    assert created.status_code == 201
    client_id = created.json()["id"]
    accepted = await customer.post(
        "/public/workspaces/lena/client-sign-in",
        headers=ORIGIN,
        json={"email": email, "language": "de"},
    )
    assert accepted.status_code == 200
    async with owner.transaction() as session:
        body = await session.scalar(
            text(
                "SELECT text_body FROM email_outbox WHERE kind='client_sign_in' "
                "AND recipient_email=:email ORDER BY created_at DESC LIMIT 1"
            ),
            {"email": email},
        )
    token = body.rsplit("#", 1)[1]
    consumed = await customer.post("/client/auth/consume", headers=ORIGIN, json={"token": token})
    assert consumed.status_code == 200
    replay = await customer.post("/client/auth/consume", headers=ORIGIN, json={"token": token})
    assert replay.status_code == 401
    return client_id, email


async def test_client_messages_are_private_immutable_idempotent_and_revocable(communication):
    operator, customer, owner = communication
    assert (await customer.get("/client/auth/session")).status_code == 401
    client_id, email = await sign_in(operator, customer, owner)
    assert (await customer.get("/clients")).status_code == 401
    assert (await customer.get("/client/bookings")).json()["total"] == 0
    key = str(uuid4())
    message = {"submissionId": key, "body": "Synthetic private message"}
    sent = await customer.post(
        "/client/conversation/messages", headers=client_headers(customer), json=message
    )
    assert sent.status_code == 200
    again = await customer.post(
        "/client/conversation/messages", headers=client_headers(customer), json=message
    )
    assert again.json()["id"] == sent.json()["id"]
    changed = await customer.post(
        "/client/conversation/messages",
        headers=client_headers(customer),
        json={**message, "body": "Changed"},
    )
    assert changed.status_code == 409
    assert (await customer.post("/client/conversation/messages", json=message)).status_code == 403
    page = (await operator.get(f"/clients/{client_id}/conversation/messages")).json()
    assert len(page["items"]) == 1
    assert page["latestSequence"] == 1
    other = (await operator.get("/clients")).json()["items"]
    other_id = next(item["id"] for item in other if item["id"] != client_id)
    assert (await customer.get(f"/clients/{other_id}/conversation/messages")).status_code == 401
    reply = await operator.post(
        f"/clients/{client_id}/conversation/messages",
        headers=staff_headers(operator),
        json={"submissionId": str(uuid4()), "body": "Synthetic reply"},
    )
    assert reply.status_code == 200
    assert (await customer.get("/client/conversation/messages?after=1")).json()["items"][0][
        "sequence"
    ] == 2
    read = await customer.post(
        "/client/conversation/read", headers=client_headers(customer), json={"sequence": 2}
    )
    assert read.status_code == 204
    assert (await customer.get("/client/conversation/messages")).json()["readThrough"] == 2
    original = (await operator.get(f"/clients/{client_id}")).json()
    transfer_key = str(uuid4())
    headers = {
        **staff_headers(operator),
        "If-Match": f'"v{original["version"]}"',
        "Idempotency-Key": transfer_key,
    }
    patch = {"email": f"corrected-{uuid4()}@example.com", "emailTransferConfirmed": True}
    transferred = await operator.patch(f"/clients/{client_id}", headers=headers, json=patch)
    assert transferred.status_code == 200
    replayed = await operator.patch(f"/clients/{client_id}", headers=headers, json=patch)
    assert replayed.status_code == 200
    assert (await customer.get("/client/auth/session")).status_code == 401
    erased = await operator.post(
        f"/clients/{client_id}/erase",
        headers={**staff_headers(operator), "If-Match": f'"v{transferred.json()["version"]}"'},
        json={"confirmEmail": patch["email"]},
    )
    assert erased.status_code in {200, 204}
    async with owner.transaction() as session:
        remaining = await session.scalar(
            text("SELECT count(*) FROM conversation_messages WHERE conversation_id=:id"),
            {"id": client_id},
        )
        assert remaining == 0


async def completed_followup(
    operator: AsyncClient, owner: Database, client_id: str
) -> tuple[str, str]:
    from datetime import UTC, datetime, timedelta

    service_response = await operator.post(
        "/services",
        headers=staff_headers(operator),
        json={
            "name": f"Synthetic follow-up {uuid4()}",
            "durationMin": 30,
            "priceCents": 0,
            "capacity": 1,
            "locationType": "online",
            "location": "Synthetic room",
            "bookingMode": "scheduled",
        },
    )
    assert service_response.status_code == 201
    service = service_response.json()
    form_response = await operator.post(
        "/forms",
        headers=staff_headers(operator),
        json={
            "name": "Synthetic shared form",
            "description": "Consultant content",
            "status": "active",
            "fields": [
                {"id": "answer", "label": "Original yes/no", "type": "yes_no", "required": True}
            ],
            "attachedServiceIds": [service["id"]],
            "requiredBeforePayment": False,
        },
    )
    assert form_response.status_code == 201
    form = form_response.json()
    rule_response = await operator.patch(
        f"/services/{service['id']}/follow-up",
        headers={**staff_headers(operator), "If-Match": f'"v{service["version"]}"'},
        json={
            "enabled": True,
            "delayHours": 0,
            "message": "Consultant-written follow-up",
            "formTemplateId": form["id"],
        },
    )
    assert rule_response.status_code == 200
    async with owner.transaction() as session:
        last = await session.scalar(text("SELECT max(end_at) FROM sessions"))
    start = max(last, datetime.now(UTC)) + timedelta(days=1)
    occurrence = await operator.post(
        "/sessions",
        headers=staff_headers(operator),
        json={
            "serviceId": service["id"],
            "startAt": start.isoformat(),
            "endAt": (start + timedelta(minutes=30)).isoformat(),
            "capacity": 1,
            "locationType": "online",
            "location": "Synthetic room",
        },
    )
    assert occurrence.status_code == 201
    occurrence_id = occurrence.json()["id"]
    booking_response = await operator.post(
        "/bookings",
        headers={**staff_headers(operator), "Idempotency-Key": str(uuid4())},
        json={
            "clientId": client_id,
            "sessionId": occurrence_id,
            "auditReason": "Synthetic check",
            "sendEmail": False,
            "language": "tr",
        },
    )
    assert booking_response.status_code == 201
    booking_id = booking_response.json()["id"]
    async with owner.transaction() as session:
        # A unique historical time avoids altering showcase records or real clocks.
        old = (await session.scalar(text("SELECT min(start_at) FROM sessions"))) - timedelta(days=1)
        await session.execute(
            text("UPDATE sessions SET start_at=:start,end_at=:end WHERE id=:id"),
            {"start": old, "end": old + timedelta(minutes=30), "id": occurrence_id},
        )
    completed = await operator.post(
        f"/bookings/{booking_id}/complete",
        headers={**staff_headers(operator), "Idempotency-Key": str(uuid4())},
        json={"auditReason": "Synthetic completion"},
    )
    assert completed.status_code == 200
    return booking_id, form["id"]


async def test_followup_assignments_are_immutable_and_address_conflicts_roll_back(communication):
    from slotera_api.followups import queue_due_followups

    operator, customer, owner = communication
    client_id, email = await sign_in(operator, customer, owner)
    booking_id, form_id = await completed_followup(operator, owner, client_id)
    before = (await operator.get(f"/bookings/{booking_id}")).json()
    scheduled = (await operator.get(f"/bookings/{booking_id}/follow-up")).json()
    assert scheduled["state"] == "scheduled"
    runtime = Database(get_settings().database_url)
    try:
        await queue_due_followups(runtime)
        await queue_due_followups(runtime)
    finally:
        await runtime.dispose()
    history = (await operator.get(f"/bookings/{booking_id}/emails")).json()
    assert len([item for item in history["items"] if item["kind"] == "booking_followup"]) == 1
    link = await customer.post(
        f"/client/bookings/{booking_id}/management-access", headers=client_headers(customer)
    )
    assert link.status_code == 200
    token = link.json()["url"].rsplit("#", 1)[1]
    forms = (
        await customer.get("/public/bookings/manage/forms", headers={"X-Booking-Token": token})
    ).json()["items"]
    assert len(forms) == 2
    preparation = next(item for item in forms if item["assignmentKind"] == "preparation")
    followup = next(item for item in forms if item["assignmentKind"] == "followup")
    assert not preparation["canSubmit"]
    assert followup["canSubmit"]
    answered = await customer.post(
        f"/public/bookings/manage/forms/{followup['id']}/submit",
        headers={**ORIGIN, "X-Booking-Token": token},
        json={"answers": [{"fieldId": "answer", "value": False}]},
    )
    assert answered.status_code == 200
    again = await customer.post(
        f"/public/bookings/manage/forms/{followup['id']}/submit",
        headers={**ORIGIN, "X-Booking-Token": token},
        json={"answers": [{"fieldId": "answer", "value": False}]},
    )
    assert again.status_code == 200
    replace = await customer.post(
        f"/public/bookings/manage/forms/{followup['id']}/submit",
        headers={**ORIGIN, "X-Booking-Token": token},
        json={"answers": [{"fieldId": "answer", "value": True}]},
    )
    assert replace.status_code == 409
    template = (await operator.get(f"/forms/{form_id}")).json()
    edited = await operator.patch(
        f"/forms/{form_id}",
        headers={**staff_headers(operator), "If-Match": f'"v{template["version"]}"'},
        json={
            "fields": [
                {"id": "answer", "label": "Edited label", "type": "yes_no", "required": True}
            ]
        },
    )
    assert edited.status_code == 200
    original = (await operator.get(f"/clients/{client_id}")).json()
    corrected = f"corrected-followup-{uuid4()}@example.com"
    transfer_headers = {
        **staff_headers(operator),
        "If-Match": f'"v{original["version"]}"',
        "Idempotency-Key": str(uuid4()),
    }
    async with owner.transaction() as session:
        await session.execute(
            text(
                "UPDATE email_outbox SET claimed_at=now() WHERE related_booking_id=:id "
                "AND kind='booking_followup'"
            ),
            {"id": booking_id},
        )
    conflict = await operator.patch(
        f"/clients/{client_id}",
        headers=transfer_headers,
        json={"email": corrected, "emailTransferConfirmed": True},
    )
    assert conflict.status_code == 409
    assert (await customer.get("/client/auth/session")).status_code == 200
    assert (await operator.get(f"/clients/{client_id}")).json()["email"] == email
    async with owner.transaction() as session:
        await session.execute(
            text("UPDATE email_outbox SET claimed_at=NULL WHERE related_booking_id=:id"),
            {"id": booking_id},
        )
    changed = await operator.patch(
        f"/clients/{client_id}",
        headers=transfer_headers,
        json={"email": corrected, "emailTransferConfirmed": True},
    )
    assert changed.status_code == 200
    assert (
        await customer.get("/public/bookings/manage/forms", headers={"X-Booking-Token": token})
    ).status_code == 404
    after = (await operator.get(f"/bookings/{booking_id}")).json()
    assert after["customer"] == before["customer"]
    assert after["amountCents"] == before["amountCents"]
    rows = (await operator.get(f"/bookings/{booking_id}/forms")).json()["items"]
    retained = next(item for item in rows if item["id"] == followup["id"])
    assert retained["responseDeadline"] == followup["responseDeadline"]
    assert retained["fields"][0]["label"] == "Original yes/no"
    history = (await operator.get(f"/bookings/{booking_id}/emails")).json()["items"]
    assert (
        len(
            [
                item
                for item in history
                if item["kind"] == "booking_followup"
                and item["status"] == "queued"
                and item["recipientEmail"] == corrected
            ]
        )
        == 1
    )


async def test_daily_digests_use_local_nine_am_and_do_not_repeat_old_unread_messages(communication):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    operator, customer, owner = communication
    client_id, email = await sign_in(operator, customer, owner)
    await operator.post(
        f"/clients/{client_id}/conversation/messages",
        headers=staff_headers(operator),
        json={"submissionId": str(uuid4()), "body": "Synthetic digest message"},
    )
    # The spring DST boundary is handled by the workspace's actual IANA zone.
    async with owner.transaction() as session:
        wid = await session.scalar(
            text("SELECT workspace_id FROM clients WHERE id=:id"), {"id": client_id}
        )
        timezone = await session.scalar(
            text("SELECT timezone FROM workspaces WHERE id=:id"), {"id": wid}
        )
        morning = datetime(2027, 3, 28, 9, tzinfo=ZoneInfo(timezone))
        await session.execute(
            text("UPDATE conversation_messages SET created_at=:at WHERE conversation_id=:id"),
            {"at": morning.replace(hour=8), "id": client_id},
        )
        early = morning.replace(hour=8, minute=59)
        await session.execute(
            text("SELECT public.slotera_queue_message_digests(:base,:now)"),
            {"base": "http://localhost:3344", "now": early},
        )
        count = await session.scalar(
            text(
                "SELECT count(*) FROM email_outbox WHERE kind='message_digest' "
                "AND recipient_email=:email"
            ),
            {"email": email},
        )
        assert count == 0
        await session.execute(
            text("SELECT public.slotera_queue_message_digests(:base,:now)"),
            {"base": "http://localhost:3344", "now": morning},
        )
        await session.execute(
            text("SELECT public.slotera_queue_message_digests(:base,:now)"),
            {"base": "http://localhost:3344", "now": morning},
        )
        count = await session.scalar(
            text(
                "SELECT count(*) FROM email_outbox WHERE kind='message_digest' "
                "AND recipient_email=:email"
            ),
            {"email": email},
        )
        assert count == 1
        await session.execute(
            text("SELECT public.slotera_queue_message_digests(:base,:now)"),
            {"base": "http://localhost:3344", "now": morning.replace(day=29)},
        )
        count = await session.scalar(
            text(
                "SELECT count(*) FROM email_outbox WHERE kind='message_digest' "
                "AND recipient_email=:email"
            ),
            {"email": email},
        )
        assert count == 1
    await customer.patch(
        "/client/preferences",
        headers=client_headers(customer),
        json={"messageDigestEnabled": False},
    )
    async with owner.transaction() as session:
        eligible = await session.scalar(
            text(
                "SELECT public.slotera_client_mail_eligible(id) FROM email_outbox "
                "WHERE kind='message_digest' AND recipient_email=:email LIMIT 1"
            ),
            {"email": email},
        )
        assert eligible is False


async def test_client_access_fails_closed_and_credentials_are_separate(communication):
    operator, customer, owner = communication
    client_id, _ = await sign_in(operator, customer, owner)
    assert (await operator.get("/client/auth/session")).status_code == 401
    assert (await customer.get("/auth/session")).status_code == 401
    assert (
        await customer.post(
            "/client/conversation/messages",
            headers={"Origin": "https://foreign.example"},
            json={"submissionId": str(uuid4()), "body": "Forbidden"},
        )
    ).status_code == 403
    assert (
        await customer.post(
            "/client/conversation/messages",
            headers=ORIGIN,
            json={"submissionId": str(uuid4()), "body": "Forbidden"},
        )
    ).status_code == 403
    assert (
        await customer.post(
            "/client/conversation/messages",
            headers=client_headers(customer),
            json={"submissionId": str(uuid4()), "body": "x" * 4001},
        )
    ).status_code == 422
    assert (
        await customer.post(
            f"/client/bookings/{uuid4()}/management-access", headers=client_headers(customer)
        )
    ).status_code == 404
    # Neither runtime role nor client identity receives credential-table access.
    runtime = Database(get_settings().database_url)
    from sqlalchemy.exc import DBAPIError

    with pytest.raises(DBAPIError):
        async with runtime.transaction() as session:
            await session.execute(text("SELECT * FROM client_auth_sessions"))
    for statement in (
        "UPDATE conversation_messages SET body='tampered' WHERE false",
        "DELETE FROM conversation_messages WHERE false",
    ):
        with pytest.raises(DBAPIError):
            async with runtime.transaction() as session:
                await session.execute(text(statement))
    await runtime.dispose()
    async with owner.transaction() as session:
        await session.execute(
            text(
                "UPDATE client_auth_sessions SET expires_at=now()-interval '1 second' "
                "WHERE client_id=:id"
            ),
            {"id": client_id},
        )
    assert (await customer.get("/client/auth/session")).status_code == 401
    assert (await customer.get("/client/conversation/messages")).status_code == 401


async def test_dashboard_worklist_uses_shared_tasks_and_reviewed_versions(communication):
    operator, customer, _ = communication
    title = f"Synthetic task {uuid4()}"
    created = await operator.post("/tasks", headers=staff_headers(operator), json={"title": title})
    assert created.status_code == 201
    task = created.json()
    assert task["sessionId"] is None
    worklist = await operator.get("/dashboard/worklist?limit=25&status=todo")
    assert worklist.status_code == 200
    assert worklist.json()["unreadNotifications"] >= 0
    # A bounded search-free task read and the dashboard expose the same resource.
    assert (await operator.get(f"/tasks/{task['id']}")).json() == task
    changed = await operator.patch(
        f"/tasks/{task['id']}",
        headers={**staff_headers(operator), "If-Match": f'"v{task["version"]}"'},
        json={"status": "done"},
    )
    assert changed.status_code == 200
    stale = await operator.patch(
        f"/tasks/{task['id']}",
        headers={**staff_headers(operator), "If-Match": f'"v{task["version"]}"'},
        json={"title": "Stale overwrite"},
    )
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "resource_stale"
    assert any(
        item["id"] == task["id"]
        for item in (await operator.get("/dashboard/worklist?status=done")).json()["items"]
    )
    assert (await customer.get("/tasks")).status_code == 401


async def test_preference_write_cannot_restore_erased_client_context(communication):
    import asyncio

    operator, customer, owner = communication
    client_id, _ = await sign_in(operator, customer, owner)
    pending = None
    try:
        async with owner.transaction() as session:
            workspace_id = await session.scalar(
                text("SELECT workspace_id FROM clients WHERE id=:id"), {"id": client_id}
            )
            await session.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:scope,0))"),
                {"scope": f"slotera:scheduling:{workspace_id}"},
            )
            pending = asyncio.create_task(
                customer.patch(
                    "/client/preferences",
                    headers=client_headers(customer),
                    json={"language": "tr", "messageDigestEnabled": True},
                )
            )
            for _ in range(100):
                if await session.scalar(
                    text(
                        "SELECT EXISTS(SELECT 1 FROM pg_locks "
                        "WHERE locktype='advisory' AND NOT granted)"
                    )
                ):
                    break
                await asyncio.sleep(0.01)
            else:
                pytest.fail("The preference write did not wait for the workspace boundary")
            # Model erasure after authentication, before the waiting command may write.
            await session.execute(
                text("DELETE FROM client_auth_sessions WHERE client_id=:id"), {"id": client_id}
            )
            await session.execute(
                text(
                    "UPDATE clients SET erased_at=now(),preferred_language='en',"
                    "message_digest_enabled=false WHERE id=:id"
                ),
                {"id": client_id},
            )
        assert (await pending).status_code == 401
        async with owner.transaction() as session:
            row = (
                await session.execute(
                    text(
                        "SELECT preferred_language,message_digest_enabled FROM clients WHERE id=:id"
                    ),
                    {"id": client_id},
                )
            ).one()
            assert row.preferred_language == "en"
            assert row.message_digest_enabled is False
    finally:
        if pending and not pending.done():
            pending.cancel()
            await asyncio.gather(pending, return_exceptions=True)


async def test_workspace_closure_revokes_client_access_even_after_reactivation(communication):
    operator, customer, owner = communication
    client_id, _ = await sign_in(operator, customer, owner)
    async with owner.transaction() as session:
        workspace_id = await session.scalar(
            text("SELECT workspace_id FROM clients WHERE id=:id"), {"id": client_id}
        )
        actor = await session.scalar(
            text("SELECT user_id FROM workspace_memberships WHERE workspace_id=:id LIMIT 1"),
            {"id": workspace_id},
        )
        result = await session.scalar(
            text("SELECT slotera_workspace_request_closure(:workspace,:actor,:audit)"),
            {"workspace": workspace_id, "actor": actor, "audit": uuid4()},
        )
        assert result == "closing"
        # Restore only the disposable fixture workspace; revoked sessions must stay revoked.
        await session.execute(
            text(
                "UPDATE workspaces SET operational_status='active',"
                "closure_requested_at=NULL WHERE id=:id"
            ),
            {"id": workspace_id},
        )
    assert (await customer.get("/client/auth/session")).status_code == 401
    assert (await customer.get("/client/conversation/messages")).status_code == 401
