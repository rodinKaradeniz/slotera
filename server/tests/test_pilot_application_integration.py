from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app

ORIGIN = {"Origin": "http://localhost:3344"}


@pytest.mark.integration
async def test_pilot_application_is_stored_as_a_pilot_inquiry() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    email = f"pilot-{uuid4().hex[:8]}@example.com"
    body = {
        "name": "Pia Pilot",
        "email": email,
        "businessName": "Pia Coaching",
        "businessType": "coaching",
        "country": "United Kingdom",
        "bookingsPerMonth": "20_50",
        "whatsappInterest": True,
        "message": "Mostly 1:1 sessions.",
        "consent": True,
    }
    try:
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM request_rate_limits"))
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as client:
            no_consent = await client.post(
                "/public/pilot-applications", headers=ORIGIN, json={**body, "consent": False}
            )
            no_origin = await client.post("/public/pilot-applications", json=body)
            accepted = await client.post("/public/pilot-applications", headers=ORIGIN, json=body)
            limited = [
                (
                    await client.post("/public/pilot-applications", headers=ORIGIN, json=body)
                ).status_code
                for _ in range(5)
            ]
        async with owner.transaction() as session:
            rows = (
                await session.execute(
                    text(
                        "SELECT reason, company, message FROM platform_inquiries "
                        "WHERE email = :email"
                    ),
                    {"email": email},
                )
            ).all()
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text("DELETE FROM platform_inquiries WHERE email = :email"), {"email": email}
            )
            await session.execute(text("DELETE FROM request_rate_limits"))
        await application.dispose()
        await owner.dispose()

    assert no_consent.status_code == 422
    assert no_origin.status_code == 403
    assert accepted.status_code == 202
    assert limited[-1] == 429
    reason, company, message = rows[0]
    assert reason == "pilot" and company == "Pia Coaching"
    assert message.splitlines()[:4] == [
        "Business type: coaching",
        "Country: United Kingdom",
        "Bookings per month: 20–50",
        "WhatsApp interest: yes",
    ]
    assert message.endswith("Mostly 1:1 sessions.")
