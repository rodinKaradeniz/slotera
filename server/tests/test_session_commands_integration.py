import asyncio
from datetime import UTC, date, datetime, timedelta
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import text
from test_everyday_booking_integration import book, headers, occurrence
from test_everyday_booking_integration import setup as setup

from slotera_api.maintenance import queue_booking_reminders
from slotera_api.scheduling.repository import SchedulingRepository
from slotera_api.seed import DEMO_SEED

pytestmark = pytest.mark.integration


async def review(client, session_id, scope="this"):
    current = (await client.get(f"/sessions/{session_id}")).json()
    impact = (
        await client.get(f"/sessions/{session_id}/change-preview", params={"scope": scope})
    ).json()
    return {
        **headers(client),
        "If-Match": f'"v{current["version"]}"',
        "X-Series-Version": str(current["seriesVersion"] or 1),
        "X-Impact-Revision": impact["revision"],
    }, impact


@pytest.mark.parametrize("service", ["Discovery Call", "Strategy Session"])
async def test_session_cancellation_preserves_money_and_replays_without_notices(setup, service):
    client, owner, application = setup
    booking = await book(client, service=service, language="de")
    if service == "Strategy Session":
        paid = await client.post(
            f"/bookings/{booking['id']}/mark-payment-received", headers=headers(client), json={}
        )
        assert paid.status_code == 200, paid.text
        booking = paid.json()
    session_id = booking["sessionId"]
    reviewed, impact = await review(client, session_id)
    assert impact["activeBookingCount"] == 1
    assert impact["paidBookingCount"] == (service == "Strategy Session")
    result = await client.post(f"/sessions/{session_id}/cancel", headers=reviewed)
    assert result.status_code == 200, result.text
    replay = await client.post(f"/sessions/{session_id}/cancel", headers=reviewed)
    assert replay.json() == result.json()
    after = (await client.get(f"/bookings/{booking['id']}")).json()
    assert after["status"] == "cancelled"
    for field in ("paymentStatus", "amountCents", "netAmountCents", "taxAmountCents", "currency"):
        assert after[field] == booking[field]
    emails = (await client.get(f"/bookings/{booking['id']}/emails")).json()["items"]
    assert sum(item["kind"] == "booking_cancelled" for item in emails) == 1
    assert any(item["status"] == "superseded" for item in emails)
    changed_retry = await client.patch(
        f"/sessions/{session_id}", headers=reviewed, json={"capacity": 2}
    )
    assert changed_retry.status_code == 409
    assert changed_retry.json()["error"]["code"] == "idempotency_conflict"


async def test_claimed_notice_blocks_entire_change_and_can_be_retried(setup):
    client, owner, application = setup
    booking = await book(client)
    session_id = booking["sessionId"]
    reviewed, _ = await review(client, session_id)
    async with owner.transaction() as tx:
        await tx.execute(
            text(
                "UPDATE email_outbox SET claimed_at=now() "
                "WHERE related_booking_id=:id AND sent_at IS NULL"
            ),
            {"id": booking["id"]},
        )
    result = await client.post(f"/sessions/{session_id}/cancel", headers=reviewed)
    assert result.status_code == 409, result.text
    assert result.json()["error"]["code"] == "booking_email_in_flight"
    assert (await client.get(f"/bookings/{booking['id']}")).json()["status"] == "confirmed"
    assert (await client.get(f"/sessions/{session_id}")).json()["status"] == "scheduled"
    async with owner.transaction() as tx:
        await tx.execute(
            text("UPDATE email_outbox SET claimed_at=NULL WHERE related_booking_id=:id"),
            {"id": booking["id"]},
        )
    retry = await client.post(f"/sessions/{session_id}/cancel", headers=reviewed)
    assert retry.status_code == 200, retry.text


async def test_changed_attendance_invalidates_preview_and_historical_service_is_locked(setup):
    client, owner, application = setup
    booking = await book(client)
    session_id = booking["sessionId"]
    reviewed, _ = await review(client, session_id)
    async with owner.transaction() as tx:
        await tx.execute(
            text("UPDATE bookings SET status='completed', updated_at=now() WHERE id=:id"),
            {"id": booking["id"]},
        )
    stale = await client.patch(
        f"/sessions/{session_id}", headers=reviewed, json={"location": "New meeting"}
    )
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "session_impact_stale"
    reviewed, _ = await review(client, session_id)
    current_service = (await client.get(f"/sessions/{session_id}")).json()["serviceId"]
    other = next(
        item
        for item in (await client.get("/services")).json()["items"]
        if item["id"] != current_service
    )
    blocked = await client.patch(
        f"/sessions/{session_id}", headers=reviewed, json={"serviceId": other["id"]}
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "session_service_in_use"


async def test_time_and_location_notice_uses_corrected_contact_and_keeps_forms(setup):
    client, owner, application = setup
    booking = await book(client)
    session_id = booking["sessionId"]
    corrected = "corrected-session@example.com"
    sent = await client.post(
        f"/bookings/{booking['id']}/send-details",
        headers=headers(client),
        json={"recipientEmail": corrected, "expectedRecipientEmail": booking["emailContact"]},
    )
    assert sent.status_code == 202, sent.text
    reviewed, _ = await review(client, session_id)
    changed = await client.patch(
        f"/sessions/{session_id}", headers=reviewed, json={"location": "Updated meeting"}
    )
    assert changed.status_code == 200, changed.text
    after = (await client.get(f"/bookings/{booking['id']}")).json()
    assert after["status"] == booking["status"] and after["amountCents"] == booking["amountCents"]
    history = (await client.get(f"/bookings/{booking['id']}/emails")).json()["items"]
    notice = [item for item in history if item["kind"] == "booking_rescheduled"]
    assert len(notice) == 1 and notice[0]["recipientEmail"] == corrected
    assert notice[0]["status"] == "queued"


async def test_notice_failure_rolls_back_session_booking_audit_and_suppression(setup, monkeypatch):
    client, owner, application = setup
    booking = await book(client)
    session_id = booking["sessionId"]
    reviewed, _ = await review(client, session_id)

    async def fail_notice(*args, **kwargs):
        return False

    monkeypatch.setattr("slotera_api.scheduling.commands.emit_booking_event", fail_notice)
    response = await client.post(f"/sessions/{session_id}/cancel", headers=reviewed)
    assert response.status_code == 503
    assert (await client.get(f"/sessions/{session_id}")).json()["status"] == "scheduled"
    assert (await client.get(f"/bookings/{booking['id']}")).json()["status"] == "confirmed"
    history = (await client.get(f"/bookings/{booking['id']}/emails")).json()["items"]
    assert len(history) == 1 and history[0]["status"] == "queued"
    async with owner.transaction() as tx:
        assert (
            await tx.scalar(
                text("SELECT count(*) FROM session_command_idempotency WHERE session_id=:id"),
                {"id": session_id},
            )
            == 0
        )
        assert (
            await tx.scalar(
                text(
                    "SELECT count(*) FROM audit_events WHERE resource_id=:id "
                    "AND action='session.cancelled'"
                ),
                {"id": session_id},
            )
            == 0
        )


async def test_concurrent_booking_and_cancellation_have_one_atomic_winner(setup):
    client, owner, application = setup
    session_id = await occurrence(client)
    reviewed, _ = await review(client, session_id)
    async with asyncio.timeout(5):
        cancelled, created = await asyncio.gather(
            client.post(f"/sessions/{session_id}/cancel", headers=reviewed),
            client.post(
                "/bookings",
                headers=headers(client),
                json={
                    "sessionId": session_id,
                    "newClient": {"name": "Racing client", "email": f"{uuid4()}@example.com"},
                    "auditReason": "Capacity race",
                    "sendEmail": True,
                },
            ),
        )
    assert sorted([cancelled.status_code, created.status_code]) in ([200, 409], [201, 409])
    current = (await client.get(f"/sessions/{session_id}")).json()
    if cancelled.status_code == 200:
        assert current["status"] == "cancelled" and current["bookedCount"] == 0
    else:
        assert current["status"] == "scheduled" and current["bookedCount"] == 1


async def test_reminder_and_erasure_cannot_deadlock_session_cancellation(setup):
    client, owner, application = setup
    booking = await book(client)
    session_id = booking["sessionId"]
    # Put the synthetic session inside the reminder window without conflicting with the showcase.
    now = datetime.now(UTC)
    async with owner.transaction() as tx:
        free_start = await tx.scalar(
            text("""
            SELECT candidate FROM generate_series(:start, :finish, interval '30 minutes') candidate
            WHERE NOT EXISTS (SELECT 1 FROM sessions WHERE workspace_id=:workspace
              AND status <> 'cancelled' AND start_at < candidate+interval '30 minutes'
              AND end_at > candidate)
            ORDER BY candidate LIMIT 1
        """),
            {
                "start": now + timedelta(hours=1),
                "finish": now + timedelta(hours=23),
                "workspace": DEMO_SEED.workspace.id,
            },
        )
        assert free_start is not None
        await tx.execute(
            text(
                "UPDATE sessions SET start_at=:start, end_at=:finish, "
                "version=version+1 WHERE id=:id"
            ),
            {
                "id": session_id,
                "start": free_start,
                "finish": free_start + timedelta(minutes=30),
            },
        )
    reviewed, _ = await review(client, session_id)
    async with asyncio.timeout(5):
        cancelled, _ = await asyncio.gather(
            client.post(f"/sessions/{session_id}/cancel", headers=reviewed),
            queue_booking_reminders(application),
        )
    assert cancelled.status_code == 200, cancelled.text
    async with owner.transaction() as tx:
        assert (
            await tx.scalar(
                text(
                    "SELECT count(*) FROM email_outbox WHERE related_booking_id=:id "
                    "AND kind='booking_reminder' AND suppressed_at IS NULL AND sent_at IS NULL"
                ),
                {"id": booking["id"]},
            )
            == 0
        )
    # A second cancellation race includes the client parent locks used by privacy erasure.
    another = await book(client)
    reviewed, _ = await review(client, another["sessionId"])
    profile = (await client.get(f"/clients/{another['clientId']}")).json()
    async with asyncio.timeout(5):
        result, erased = await asyncio.gather(
            client.post(f"/sessions/{another['sessionId']}/cancel", headers=reviewed),
            client.post(
                f"/clients/{another['clientId']}/erase",
                headers={**headers(client), "If-Match": f'"v{profile["version"]}"'},
                json={"confirmEmail": profile["email"]},
            ),
        )
    assert result.status_code in (200, 409)
    assert erased.status_code == 204, erased.text


async def test_following_changes_preserve_local_dates_dst_and_generation_boundary(
    setup, monkeypatch
):
    client, owner, application = setup
    service = next(
        item
        for item in (await client.get("/services")).json()["items"]
        if item["name"] == "Discovery Call"
    )
    # Next spring's Sunday change crosses Berlin's spring-forward boundary.
    year = datetime.now(UTC).year + 1
    last_sunday = date(year, 3, 31)
    last_sunday -= timedelta(days=(last_sunday.weekday() + 1) % 7)
    first = datetime.combine(
        last_sunday - timedelta(days=7), datetime.min.time(), tzinfo=ZoneInfo("Europe/Berlin")
    ).replace(hour=9)
    async with owner.transaction() as tx:
        await tx.execute(
            text(
                "DELETE FROM sessions WHERE location IN ('DST test','New recurring room') "
                "AND NOT EXISTS (SELECT 1 FROM bookings WHERE bookings.session_id=sessions.id)"
            )
        )

    class ExtensionClock(datetime):
        @classmethod
        def now(cls, tz=None):
            return (first - timedelta(days=1)).astimezone(tz or UTC)

    result = await client.post(
        "/sessions",
        headers=headers(client),
        json={
            "serviceId": service["id"],
            "startAt": first.isoformat(),
            "endAt": (first + timedelta(minutes=30)).isoformat(),
            "capacity": 2,
            "locationType": "online",
            "location": "DST test",
            "recurrence": {
                "weekdays": [7],
                "endsOn": (last_sunday + timedelta(days=7)).isoformat(),
            },
        },
    )
    assert result.status_code == 201, result.text
    target = result.json()
    reviewed, _ = await review(client, target["id"], "this_and_following")
    shifted = await client.patch(
        f"/sessions/{target['id']}?scope=this_and_following",
        headers=reviewed,
        json={
            "startAt": (first + timedelta(hours=1)).isoformat(),
            "endAt": (first + timedelta(hours=1, minutes=30)).isoformat(),
            "location": "New recurring room",
        },
    )
    assert shifted.status_code == 200, shifted.text
    listing = (await client.get("/sessions", params={"seriesId": target["seriesId"]})).json()[
        "items"
    ]
    assert len(listing) == 3
    starts = [
        datetime.fromisoformat(item["startAt"]).astimezone(ZoneInfo("Europe/Berlin"))
        for item in listing
    ]
    assert [item.hour for item in starts] == [10, 10, 10]
    assert [item.date() for item in starts] == [
        first.date(),
        last_sunday,
        last_sunday + timedelta(days=7),
    ]
    last = listing[-1]
    reviewed, _ = await review(client, last["id"])
    exception = await client.patch(
        f"/sessions/{last['id']}",
        headers=reviewed,
        json={
            "startAt": (datetime.fromisoformat(last["startAt"]) + timedelta(hours=1)).isoformat(),
            "endAt": (datetime.fromisoformat(last["endAt"]) + timedelta(hours=1)).isoformat(),
            "location": "One-off room",
        },
    )
    assert exception.status_code == 200, exception.text
    async with owner.transaction() as tx:
        await tx.execute(
            text("UPDATE session_series SET ends_on=:date WHERE id=:id"),
            {"id": target["seriesId"], "date": last_sunday + timedelta(days=14)},
        )
    monkeypatch.setattr("slotera_api.scheduling.repository.datetime", ExtensionClock)
    assert (
        await SchedulingRepository(application).extend_series(
            DEMO_SEED.workspace.id, UUID(target["seriesId"])
        )
        == 1
    )
    regenerated = (await client.get("/sessions", params={"seriesId": target["seriesId"]})).json()[
        "items"
    ]
    assert (
        datetime.fromisoformat(regenerated[-1]["startAt"])
        .astimezone(ZoneInfo("Europe/Berlin"))
        .hour
        == 10
    )
    assert regenerated[-1]["location"] == "New recurring room"
    assert regenerated[-2]["location"] == "One-off room"
    reviewed, _ = await review(client, listing[1]["id"], "this_and_following")
    cancelled = await client.post(
        f"/sessions/{listing[1]['id']}/cancel?scope=this_and_following", headers=reviewed
    )
    assert cancelled.status_code == 200, cancelled.text
    assert (
        await SchedulingRepository(application).extend_series(
            DEMO_SEED.workspace.id, UUID(target["seriesId"])
        )
        == 0
    )
    final = (await client.get("/sessions", params={"seriesId": target["seriesId"]})).json()["items"]
    assert [item["status"] for item in final] == [
        "scheduled",
        "cancelled",
        "cancelled",
        "cancelled",
    ]


async def test_capacity_and_cancellation_preserve_terminal_attendees_and_forms(setup):
    client, owner, application = setup
    booking = await book(client)
    session_id = booking["sessionId"]
    reviewed, _ = await review(client, session_id)
    enlarged = await client.patch(f"/sessions/{session_id}", headers=reviewed, json={"capacity": 3})
    assert enlarged.status_code == 200
    others = []
    for _ in range(2):
        created = await client.post(
            "/bookings",
            headers=headers(client),
            json={
                "newClient": {"name": "Group participant", "email": f"{uuid4()}@example.com"},
                "sessionId": session_id,
                "auditReason": "Group coverage",
                "sendEmail": False,
            },
        )
        assert created.status_code == 201, created.text
        others.append(created.json())
    async with owner.transaction() as tx:
        await tx.execute(
            text("UPDATE bookings SET status='completed',updated_at=now() WHERE id=:id"),
            {"id": booking["id"]},
        )
    before_forms = (await client.get(f"/bookings/{booking['id']}/forms")).json()
    reviewed, impact = await review(client, session_id)
    assert impact["activeBookingCount"] == 2
    too_small = await client.patch(
        f"/sessions/{session_id}", headers=reviewed, json={"capacity": 1}
    )
    assert too_small.status_code == 409
    assert too_small.json()["error"]["code"] == "session_capacity_in_use"
    reviewed, _ = await review(client, session_id)
    cancelled = await client.post(f"/sessions/{session_id}/cancel", headers=reviewed)
    assert cancelled.status_code == 200, cancelled.text
    assert (await client.get(f"/bookings/{booking['id']}")).json()["status"] == "completed"
    for item in others:
        assert (await client.get(f"/bookings/{item['id']}")).json()["status"] == "cancelled"
    assert (await client.get(f"/bookings/{booking['id']}/forms")).json() == before_forms


async def test_competing_session_edits_and_booking_move_do_not_deadlock(setup):
    client, owner, application = setup
    booking = await book(client)
    session_id = booking["sessionId"]
    first, _ = await review(client, session_id)
    second = {**first, "Idempotency-Key": str(uuid4())}
    async with asyncio.timeout(5):
        results = await asyncio.gather(
            client.patch(
                f"/sessions/{session_id}", headers=first, json={"location": "First reviewed room"}
            ),
            client.patch(
                f"/sessions/{session_id}", headers=second, json={"location": "Second reviewed room"}
            ),
        )
    assert sorted(item.status_code for item in results) == [200, 409]
    assert (
        next(item for item in results if item.status_code == 409).json()["error"]["code"]
        == "resource_stale"
    )
    destination = await occurrence(client)
    reviewed, _ = await review(client, session_id)
    async with asyncio.timeout(5):
        results = await asyncio.gather(
            client.post(f"/sessions/{session_id}/cancel", headers=reviewed),
            client.post(
                f"/bookings/{booking['id']}/move",
                headers=headers(client),
                json={"sessionId": destination, "auditReason": "Move race"},
            ),
        )
    assert sorted(item.status_code for item in results) == [200, 409]


async def test_revoked_management_link_is_rechecked_after_waiting_for_a_change(setup, monkeypatch):
    from slotera_api.public_booking.manage import BookingManageRepository

    client, owner, application = setup
    booking = await book(client)
    async with owner.transaction() as tx:
        link = await tx.scalar(
            text(
                "SELECT template_data->>'manageUrl' FROM email_outbox "
                "WHERE related_booking_id=:id AND kind='booking_confirmed'"
            ),
            {"id": booking["id"]},
        )
    resolved, proceed = asyncio.Event(), asyncio.Event()
    original = BookingManageRepository._resolve

    async def delayed_resolve(self, token):
        result = await original(self, token)
        resolved.set()
        await proceed.wait()
        return result

    monkeypatch.setattr(BookingManageRepository, "_resolve", delayed_resolve)
    async with asyncio.timeout(5):
        waiting = asyncio.create_task(
            client.post(
                "/public/bookings/manage/cancel",
                headers={
                    "Origin": "http://localhost:3344",
                    "X-Booking-Token": link.split("#", 1)[1],
                },
            )
        )
        await resolved.wait()
        corrected = await client.post(
            f"/bookings/{booking['id']}/send-details",
            headers=headers(client),
            json={
                "recipientEmail": f"{uuid4()}@example.com",
                "expectedRecipientEmail": booking["emailContact"],
            },
        )
        assert corrected.status_code == 202
        proceed.set()
        rejected = await waiting
    assert rejected.status_code == 404
    assert (await client.get(f"/bookings/{booking['id']}")).json()["status"] == "confirmed"


async def test_session_preview_and_commands_cannot_cross_workspace_or_reopen(setup):
    from slotera_api.db.models import Service, Session, Workspace, WorkspaceMembership

    client, owner, application = setup
    booking = await book(client)
    session_id = booking["sessionId"]
    reviewed, _ = await review(client, session_id)
    invalid_status = await client.patch(
        f"/sessions/{session_id}", headers=reviewed, json={"status": "cancelled"}
    )
    assert invalid_status.status_code == 422
    assert (await client.get(f"/sessions/{session_id}")).json()["status"] == "scheduled"
    cancelled = await client.post(f"/sessions/{session_id}/cancel", headers=reviewed)
    assert cancelled.status_code == 200
    reviewed, _ = await review(client, session_id)
    reopen = await client.patch(
        f"/sessions/{session_id}", headers=reviewed, json={"status": "scheduled"}
    )
    assert reopen.status_code == 409 and reopen.json()["error"]["code"] == "session_cancelled"
    note = await client.patch(
        f"/sessions/{session_id}", headers=reviewed, json={"notes": "Private follow-up"}
    )
    assert note.status_code == 200, note.text
    assert note.json()["notes"] == "Private follow-up" and note.json()["status"] == "cancelled"
    foreign_workspace, foreign_service, foreign_session = uuid4(), uuid4(), uuid4()
    try:
        async with owner.transaction() as tx:
            original = await tx.get(Session, UUID(session_id))
            service = await tx.get(Service, original.service_id)
            tx.add(
                Workspace(
                    id=foreign_workspace,
                    name="Other synthetic workspace",
                    slug=f"foreign-{foreign_workspace}",
                )
            )
            await tx.flush()
            tx.add(
                WorkspaceMembership(
                    workspace_id=foreign_workspace,
                    user_id=original.calendar_owner_id,
                    role="operator_admin",
                )
            )
            values = {
                column.name: getattr(service, column.name) for column in Service.__table__.columns
            }
            values.update(id=foreign_service, workspace_id=foreign_workspace)
            tx.add(Service(**values))
            await tx.flush()
            values = {
                column.name: getattr(original, column.name) for column in Session.__table__.columns
            }
            values.update(
                id=foreign_session,
                workspace_id=foreign_workspace,
                service_id=foreign_service,
                series_id=None,
            )
            tx.add(Session(**values))
        hidden = await client.get(f"/sessions/{foreign_session}/change-preview")
        denied = await client.post(
            f"/sessions/{foreign_session}/cancel",
            headers={**headers(client), "If-Match": '"v1"', "X-Impact-Revision": "a" * 64},
        )
        assert hidden.status_code == denied.status_code == 404
    finally:
        async with owner.transaction() as tx:
            await tx.execute(
                text("DELETE FROM sessions WHERE workspace_id=:id"), {"id": foreign_workspace}
            )
            await tx.execute(text("DELETE FROM workspaces WHERE id=:id"), {"id": foreign_workspace})


async def test_moved_session_rechecks_reminders_using_its_new_start(setup):
    client, owner, application = setup
    booking = await book(client)
    session_id = booking["sessionId"]
    now = datetime.now(UTC).replace(microsecond=750000)
    async with owner.transaction() as tx:
        start = await tx.scalar(
            text("""
            SELECT candidate FROM generate_series(:start, :finish, interval '30 minutes') candidate
            WHERE NOT EXISTS (SELECT 1 FROM sessions WHERE workspace_id=:workspace
              AND status <> 'cancelled' AND start_at < candidate+interval '90 minutes'
              AND end_at > candidate)
            ORDER BY candidate LIMIT 1
        """),
            {
                "start": now + timedelta(hours=1),
                "finish": now + timedelta(hours=21),
                "workspace": DEMO_SEED.workspace.id,
            },
        )
        assert start is not None
        await tx.execute(
            text(
                "UPDATE sessions SET start_at=:start,end_at=:finish,version=version+1 WHERE id=:id"
            ),
            {"id": session_id, "start": start, "finish": start + timedelta(minutes=30)},
        )
    await queue_booking_reminders(application)
    async with application.transaction() as tx:
        due = (
            (
                await tx.execute(
                    text(
                        "SELECT booking_id FROM "
                        "public.slotera_booking_due_reminders(interval '24 hours')"
                    )
                )
            )
            .scalars()
            .all()
        )
        assert UUID(booking["id"]) not in due
    reviewed, _ = await review(client, session_id)
    changed = await client.patch(
        f"/sessions/{session_id}",
        headers=reviewed,
        json={
            "startAt": (start + timedelta(minutes=45)).isoformat(),
            "endAt": (start + timedelta(minutes=75)).isoformat(),
        },
    )
    assert changed.status_code == 200, changed.text
    await queue_booking_reminders(application)
    history = (await client.get(f"/bookings/{booking['id']}/emails")).json()["items"]
    reminders = [item for item in history if item["kind"] == "booking_reminder"]
    assert sorted(item["status"] for item in reminders) == ["queued", "superseded"]
    await queue_booking_reminders(application)
    after = (await client.get(f"/bookings/{booking['id']}/emails")).json()["items"]
    assert len([item for item in after if item["kind"] == "booking_reminder"]) == 2
