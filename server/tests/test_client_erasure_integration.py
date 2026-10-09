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
MANAGE = "/public/bookings/manage"


def _csrf(client: AsyncClient) -> dict[str, str]:
    return {**ORIGIN, "X-CSRF-Token": client.cookies["slotera_csrf"]}


@pytest.mark.integration
async def test_client_export_and_erasure_keep_only_financial_facts() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    email = f"erase-{uuid4().hex[:8]}@customer.example"
    booking_id: str | None = None
    try:
        await import_demo_seed(owner, demo_password="slotera-local-only")
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM request_rate_limits"))
        app = create_app(database=application)
        transport = ASGITransport(app=app)
        async with (
            AsyncClient(transport=transport, base_url="http://test") as visitor,
            AsyncClient(transport=transport, base_url="http://test") as operator,
        ):
            services = await visitor.get("/public/workspaces/lena/services")
            service = next(
                item for item in services.json()["items"] if item["name"] == "Discovery Call"
            )
            starts_on = date.today() + timedelta(days=9)
            availability = await visitor.get(
                f"/public/workspaces/lena/services/{service['id']}/availability",
                params={
                    "from": starts_on.isoformat(),
                    "to": (starts_on + timedelta(days=6)).isoformat(),
                },
            )
            created = await visitor.post(
                "/public/workspaces/lena/bookings",
                headers={**ORIGIN, "Idempotency-Key": f"erase-{uuid4()}"},
                json={
                    "serviceId": service["id"],
                    "startAt": availability.json()["items"][0]["startAt"],
                    "customer": {
                        "firstName": "Erin",
                        "lastName": "Erasable",
                        "email": email,
                        "phone": "+44 20 7946 0000",
                    },
                    "billingAddress": {
                        "street": "1 Private Lane",
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
            async with owner.transaction() as session:
                client_id = await session.scalar(
                    text("SELECT client_id FROM bookings WHERE id = :id"), {"id": booking_id}
                )
                manage_url = await session.scalar(
                    text(
                        "SELECT template_data->>'manageUrl' FROM email_outbox "
                        "WHERE related_booking_id = :id AND kind = 'booking_confirmed'"
                    ),
                    {"id": booking_id},
                )
                # Pretend the worker already delivered the confirmation email.
                await session.execute(
                    text(
                        "UPDATE email_outbox SET sent_at = now() "
                        "WHERE related_booking_id = :id AND kind = 'booking_confirmed'"
                    ),
                    {"id": booking_id},
                )
            assert manage_url is not None
            token = {"X-Booking-Token": manage_url.split("#", 1)[1]}

            login = await operator.post(
                "/auth/login",
                headers=ORIGIN,
                json={"email": "hello@slotera.app", "password": "slotera-local-only"},
            )
            assert login.status_code == 200
            note = await operator.post(
                f"/clients/{client_id}/notes",
                headers=_csrf(operator),
                json={"title": "Intake", "body": "Prefers mornings."},
            )
            assert note.status_code == 201
            exported = await operator.get(f"/clients/{client_id}/export")
            link_before = await visitor.get(MANAGE, headers=token)
            mismatch = await operator.post(
                f"/clients/{client_id}/erase",
                headers=_csrf(operator),
                json={"confirmEmail": "someone-else@example.com"},
            )
            unknown = await operator.post(
                f"/clients/{uuid4()}/erase",
                headers=_csrf(operator),
                json={"confirmEmail": email},
            )
            erased = await operator.post(
                f"/clients/{client_id}/erase",
                headers=_csrf(operator),
                json={"confirmEmail": email.upper()},
            )
            after = await operator.get(f"/clients/{client_id}/export")
            link_after = await visitor.get(MANAGE, headers=token)

        async with owner.transaction() as session:
            booking = (
                (
                    await session.execute(
                        text(
                            "SELECT customer_email, customer_first_name, customer_phone, "
                            "billing_address, amount_cents, currency, status::text AS status "
                            "FROM bookings WHERE id = :id"
                        ),
                        {"id": booking_id},
                    )
                )
                .mappings()
                .one()
            )
            outbox = (
                await session.execute(
                    text(
                        "SELECT recipient_email, template_data, sent_at FROM email_outbox "
                        "WHERE related_booking_id = :id"
                    ),
                    {"id": booking_id},
                )
            ).all()
            audit = await session.scalar(
                text(
                    "SELECT details FROM audit_events WHERE resource_id = :id "
                    "AND action = 'client.erased'"
                ),
                {"id": client_id},
            )
    finally:
        async with owner.transaction() as session:
            if booking_id is not None:
                await session.execute(
                    text("DELETE FROM email_outbox WHERE related_booking_id = :id"),
                    {"id": booking_id},
                )
            await session.execute(text("DELETE FROM request_rate_limits"))
        await application.dispose()
        await owner.dispose()

    assert exported.status_code == 200
    body = exported.json()
    assert body["client"]["email"] == email
    assert [item["customerEmail"] for item in body["bookings"]] == [email]
    assert body["bookings"][0]["billingAddress"]["city"] == "London"
    assert [item["title"] for item in body["notes"]] == ["Intake"]
    assert "formResponses" in body
    assert link_before.status_code == 200

    assert mismatch.status_code == 422
    assert unknown.status_code == 404
    assert erased.status_code == 204

    cleared = after.json()
    assert cleared["client"]["name"] == "Erased client"
    assert cleared["client"]["email"].endswith("@invalid")
    assert cleared["client"]["phone"] is None
    assert cleared["notes"] == [] and cleared["formResponses"] == []
    assert link_after.status_code != 200

    assert booking["customer_email"] == "" and booking["customer_first_name"] == ""
    assert booking["customer_phone"] is None and booking["billing_address"] == {}
    assert booking["amount_cents"] == body["bookings"][0]["amountCents"]
    assert booking["currency"] == "GBP" and booking["status"] == "confirmed"
    # The delivered email keeps a blank row (it blocks duplicates); unsent ones are gone.
    assert [(row.recipient_email, row.template_data) for row in outbox] == [
        ("erased@invalid", {})
    ]
    assert audit == {"booking_count": 1}
