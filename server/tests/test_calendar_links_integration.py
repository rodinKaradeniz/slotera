from datetime import date, timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import import_demo_seed

ORIGIN = {"Origin": "http://localhost:3344"}
MEETING = "https://meet.example.com/discovery"


def _csrf(client: AsyncClient) -> dict[str, str]:
    return {**ORIGIN, "X-CSRF-Token": client.cookies["slotera_csrf"]}


@pytest.mark.integration
async def test_meeting_link_and_private_calendar_feed() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    email = f"feed-{uuid4().hex[:8]}@customer.example"
    booking_id: str | None = None
    service_id: str | None = None
    try:
        await import_demo_seed(owner, demo_password="slotera-local-only")
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM request_rate_limits"))
        app = create_app(database=application)
        transport = ASGITransport(app=app)
        async with (
            AsyncClient(transport=transport, base_url="http://test") as operator,
            AsyncClient(transport=transport, base_url="http://test") as visitor,
        ):
            login = await operator.post(
                "/auth/login",
                headers=ORIGIN,
                json={"email": "hello@slotera.io", "password": "slotera-local-only"},
            )
            assert login.status_code == 200
            services = (await visitor.get("/public/workspaces/lena/services")).json()["items"]
            service = next(item for item in services if item["name"] == "Discovery Call")
            service_id = service["id"]
            bad_link = await operator.patch(
                f"/services/{service_id}",
                headers=_csrf(operator),
                json={"meetingUrl": "http://insecure.example.com"},
            )
            patched = await operator.patch(
                f"/services/{service_id}", headers=_csrf(operator), json={"meetingUrl": MEETING}
            )

            starts_on = date.today() + timedelta(days=10)
            availability = await visitor.get(
                f"/public/workspaces/lena/services/{service_id}/availability",
                params={
                    "from": starts_on.isoformat(),
                    "to": (starts_on + timedelta(days=6)).isoformat(),
                },
            )
            created = await visitor.post(
                "/public/workspaces/lena/bookings",
                headers={**ORIGIN, "Idempotency-Key": f"feed-{uuid4()}"},
                json={
                    "serviceId": service_id,
                    "startAt": availability.json()["items"][0]["startAt"],
                    "customer": {
                        "firstName": "Fiona",
                        "lastName": "Feed",
                        "email": email,
                        "phone": "+44 20 7946 0001",
                    },
                    "billingAddress": {
                        "street": "1 Feed Lane",
                        "city": "London",
                        "postalCode": "N1 1AA",
                        "country": "GB",
                    },
                    "paymentMethod": "free",
                    "termsAccepted": True,
                },
            )
            assert created.status_code == 201, created.text
            booking_id = created.json()["id"]

            before = await operator.get("/settings/calendar-feed")
            first = await operator.post("/settings/calendar-feed", headers=_csrf(operator))
            first_path = first.json()["url"].removeprefix("http://test")
            feed = await visitor.get(first_path)
            second = await operator.post("/settings/calendar-feed", headers=_csrf(operator))
            second_path = second.json()["url"].removeprefix("http://test")
            old_link = await visitor.get(first_path)
            status = await operator.get("/settings/calendar-feed")
            revoked = await operator.delete("/settings/calendar-feed", headers=_csrf(operator))
            after_revoke = await visitor.get(second_path)

        async with owner.transaction() as session:
            template = await session.scalar(
                text(
                    "SELECT template_data FROM email_outbox "
                    "WHERE related_booking_id = :id AND kind = 'booking_confirmed'"
                ),
                {"id": booking_id},
            )
    finally:
        async with owner.transaction() as session:
            if booking_id is not None:
                await session.execute(
                    text("DELETE FROM email_outbox WHERE related_booking_id = :id"),
                    {"id": booking_id},
                )
            if service_id is not None:
                await session.execute(
                    text("UPDATE services SET meeting_url = NULL WHERE id = :id"),
                    {"id": service_id},
                )
            await session.execute(text("DELETE FROM calendar_feed_tokens"))
            await session.execute(text("DELETE FROM request_rate_limits"))
        await application.dispose()
        await owner.dispose()

    assert bad_link.status_code == 422
    assert patched.status_code == 200 and patched.json()["meetingUrl"] == MEETING
    assert created.json()["status"] == "confirmed"
    assert created.json()["meetingUrl"] == MEETING
    assert template is not None and template["meetingUrl"] == MEETING
    assert template["locationType"] == "online"

    assert before.json() == {"active": False, "createdAt": None}
    assert first.status_code == 201 and first_path.startswith("/calendar/feed/")
    assert feed.status_code == 200
    assert feed.headers["content-type"].startswith("text/calendar")
    body = feed.text
    assert body.startswith("BEGIN:VCALENDAR") and "BEGIN:VEVENT" in body
    assert "Discovery Call · Fiona Feed" in body
    assert email not in body and "+44 20 7946 0001" not in body
    assert old_link.status_code == 404
    assert status.json()["active"] is True
    assert revoked.status_code == 204 and after_revoke.status_code == 404
