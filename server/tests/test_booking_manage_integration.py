from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.maintenance import queue_booking_reminders
from slotera_api.seed import DEMO_SEED, import_demo_seed

ORIGIN = {"Origin": "http://localhost:3344"}
MANAGE = "/public/bookings/manage"


@pytest.mark.integration
async def test_customer_link_views_reschedules_once_gets_reminded_and_cancels() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    workspace_id = DEMO_SEED.workspace.id
    booking_id: str | None = None
    try:
        await import_demo_seed(owner, demo_password="slotera-local-only")
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM request_rate_limits"))
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            services = await client.get("/public/workspaces/lena/services")
            service = next(
                item for item in services.json()["items"] if item["name"] == "Discovery Call"
            )
            starts_on = date.today() + timedelta(days=8)
            availability = await client.get(
                f"/public/workspaces/lena/services/{service['id']}/availability",
                params={
                    "from": starts_on.isoformat(),
                    "to": (starts_on + timedelta(days=6)).isoformat(),
                },
            )
            first_slot, *_, later_slot = availability.json()["items"]
            created = await client.post(
                "/public/workspaces/lena/bookings",
                headers={**ORIGIN, "Idempotency-Key": f"manage-{uuid4()}"},
                json={
                    "serviceId": service["id"],
                    "startAt": first_slot["startAt"],
                    "customer": {
                        "firstName": "Link",
                        "lastName": "Customer",
                        "email": f"link-{uuid4().hex[:8]}@customer.example",
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
            assert created.status_code == 201
            booking_id = created.json()["id"]
            async with owner.transaction() as session:
                manage_url = await session.scalar(
                    text(
                        "SELECT template_data->>'manageUrl' FROM email_outbox "
                        "WHERE related_booking_id = :id AND kind = 'booking_confirmed'"
                    ),
                    {"id": booking_id},
                )
            assert manage_url is not None and "/booking/manage#" in manage_url
            token = {"X-Booking-Token": manage_url.split("#", 1)[1]}

            viewed = await client.get(MANAGE, headers=token)
            unknown = await client.get(MANAGE, headers={"X-Booking-Token": "x" * 43})
            moved = await client.post(
                f"{MANAGE}/reschedule",
                headers={**ORIGIN, **token},
                json={"startAt": later_slot["startAt"]},
            )
            moved_again = await client.post(
                f"{MANAGE}/reschedule",
                headers={**ORIGIN, **token},
                json={"startAt": first_slot["startAt"]},
            )

            # Pull the session inside the 24h window: a reminder becomes due, and
            # self-service closes under the default 24h cutoff.
            soon = datetime.now(UTC).replace(microsecond=0) + timedelta(hours=3)
            async with owner.transaction() as session:
                await session.execute(
                    text(
                        "UPDATE sessions SET start_at = :start, end_at = :end "
                        "WHERE id = (SELECT session_id FROM bookings WHERE id = :id)"
                    ),
                    {"start": soon, "end": soon + timedelta(minutes=30), "id": booking_id},
                )
            reminders_first = await queue_booking_reminders(application)
            reminders_second = await queue_booking_reminders(application)
            too_late = await client.post(f"{MANAGE}/cancel", headers={**ORIGIN, **token})
            async with owner.transaction() as session:
                await session.execute(
                    text(
                        "UPDATE availability_policies SET customer_change_notice_hours = 0 "
                        "WHERE workspace_id = :workspace_id"
                    ),
                    {"workspace_id": workspace_id},
                )
            cancelled = await client.post(f"{MANAGE}/cancel", headers={**ORIGIN, **token})
            cancelled_again = await client.post(f"{MANAGE}/cancel", headers={**ORIGIN, **token})

        async with owner.transaction() as session:
            outbox = dict(
                (
                    await session.execute(
                        text(
                            "SELECT kind, count(*) FROM email_outbox "
                            "WHERE related_booking_id = :id GROUP BY kind"
                        ),
                        {"id": booking_id},
                    )
                ).all()
            )
            operator_recipients = set(
                (
                    await session.execute(
                        text(
                            "SELECT recipient_email FROM email_outbox "
                            "WHERE related_booking_id = :id AND kind LIKE 'operator%'"
                        ),
                        {"id": booking_id},
                    )
                ).scalars()
            )
            session_states = sorted(
                (
                    await session.execute(
                        text(
                            "SELECT s.status::text FROM sessions s "
                            "JOIN audit_events a ON a.resource_id = :id "
                            "AND a.action = 'booking.customer_rescheduled' "
                            "WHERE s.id::text IN (a.details->>'from_session_id', "
                            "a.details->>'to_session_id')"
                        ),
                        {"id": booking_id},
                    )
                ).scalars()
            )
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text(
                    "UPDATE availability_policies SET customer_change_notice_hours = 24 "
                    "WHERE workspace_id = :workspace_id"
                ),
                {"workspace_id": workspace_id},
            )
            if booking_id is not None:
                sessions = (
                    "SELECT (details->>'from_session_id')::uuid FROM audit_events "
                    "WHERE resource_id = :id UNION SELECT session_id FROM bookings WHERE id = :id"
                )
                for statement in (
                    "DELETE FROM email_outbox WHERE related_booking_id = :id",
                    "DELETE FROM notifications WHERE resource_id = :id",
                    "DELETE FROM public_booking_idempotency WHERE booking_id = :id",
                    f"CREATE TEMP TABLE doomed AS {sessions}",
                    "DELETE FROM bookings WHERE id = :id",
                    "DELETE FROM sessions WHERE id IN (SELECT * FROM doomed)",
                    "DROP TABLE doomed",
                ):
                    await session.execute(text(statement), {"id": booking_id})
            await session.execute(text("DELETE FROM request_rate_limits"))
        await application.dispose()
        await owner.dispose()

    assert viewed.status_code == 200
    view = viewed.json()
    assert view["status"] == "confirmed"
    assert view["canCancel"] is True and view["canReschedule"] is True
    assert view["workspaceSlug"] == "lena"
    assert "notes" not in view and "customerEmail" not in view
    assert unknown.status_code == 404
    assert moved.status_code == 200
    assert datetime.fromisoformat(moved.json()["sessionStartAt"]) == datetime.fromisoformat(
        later_slot["startAt"]
    )
    assert moved.json()["rescheduled"] is True and moved.json()["canReschedule"] is False
    assert moved_again.status_code == 409
    assert moved_again.json()["error"]["code"] == "customer_change_window_closed"
    # Both public 1:1 sessions are released: the original one by the reschedule,
    # the new one by the cancellation.
    assert session_states == ["cancelled", "cancelled"]
    assert reminders_first == 1 and reminders_second == 0
    assert too_late.status_code == 409
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"
    assert cancelled_again.status_code == 200
    assert outbox == {
        "booking_confirmed": 1,
        "booking_rescheduled": 1,
        "booking_reminder": 1,
        "booking_cancelled": 1,
        # The owner hears about each thing the client did themselves.
        "operator_booking_new": 1,
        "operator_booking_rescheduled": 1,
        "operator_booking_cancelled": 1,
    }
    assert operator_recipients == {"hello@slotera.io"}
