import json
from datetime import date, timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import DEMO_SEED, import_demo_seed

DEMO_PASSWORD = "slotera-local-only"


@pytest.mark.integration
async def test_public_open_booking_is_private_transactional_and_idempotent() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    form_id = uuid4()
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        async with owner.transaction() as session:
            await session.execute(
                text(
                    """
                    UPDATE workspace_payment_settings
                    SET tax_treatment = 'fixed',
                        tax_rate_bps = 1900,
                        tax_label = 'VAT',
                        tax_jurisdiction = 'DE'
                    WHERE workspace_id = :workspace_id
                    """
                ),
                {"workspace_id": DEMO_SEED.workspace.id},
            )
            await session.execute(
                text(
                    """
                    INSERT INTO form_templates (
                      id, workspace_id, name, description, status, fields,
                      required_before_payment
                    ) VALUES (
                      :id, :workspace_id, 'Public prep', '', 'active',
                      CAST(:fields AS jsonb), true
                    )
                    """
                ),
                {
                    "id": form_id,
                    "workspace_id": DEMO_SEED.workspace.id,
                    "fields": json.dumps(
                        [
                            {
                                "id": "goal",
                                "label": "What should we focus on?",
                                "type": "short_text",
                                "required": True,
                                "placeholder": None,
                                "help_text": None,
                                "options": None,
                            }
                        ]
                    ),
                },
            )
            await session.execute(
                text(
                    """
                    INSERT INTO form_template_services (
                      workspace_id, form_template_id, service_id
                    ) SELECT :workspace_id, :form_id, id
                    FROM services
                    WHERE workspace_id = :workspace_id
                      AND name = 'Strategy Session'
                    """
                ),
                {"workspace_id": DEMO_SEED.workspace.id, "form_id": form_id},
            )

        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            services = await client.get("/public/workspaces/lena/services")
            assert services.status_code == 200
            service = next(
                item for item in services.json()["items"] if item["name"] == "Strategy Session"
            )
            free_service = next(
                item for item in services.json()["items"] if item["name"] == "Discovery Call"
            )
            assert service["capacity"] == 1
            assert service["quote"]["grossAmountCents"] == 38000
            assert service["quote"]["taxAmountCents"] > 0
            assert free_service["quote"]["grossAmountCents"] == 0
            assert free_service["quote"]["taxAmountCents"] == 0
            assert free_service["quote"]["label"] == "VAT"
            assert "notes" not in service
            public_forms = await client.get(
                f"/public/workspaces/lena/services/{service['id']}/forms"
            )
            assert public_forms.status_code == 200
            assert [item["id"] for item in public_forms.json()["items"]] == [str(form_id)]

            starts_on = date.today() + timedelta(days=7)
            ends_on = starts_on + timedelta(days=14)
            availability = await client.get(
                f"/public/workspaces/lena/services/{service['id']}/availability",
                params={"from": starts_on.isoformat(), "to": ends_on.isoformat()},
            )
            assert availability.status_code == 200
            assert availability.json()["items"]
            slot = availability.json()["items"][0]

            payload = {
                "serviceId": service["id"],
                "startAt": slot["startAt"],
                "customer": {
                    "firstName": "Ayla",
                    "lastName": "Demir",
                    "email": "ayla@example.com",
                },
                "billingAddress": {
                    "street": "Test Street 1",
                    "city": "Berlin",
                    "postalCode": "10115",
                    "country": "DE",
                },
                "paymentMethod": "manual",
                "formResponses": [
                    {
                        "formTemplateId": str(form_id),
                        "answers": [{"fieldId": "goal", "value": "Pricing strategy"}],
                    }
                ],
                "termsAccepted": True,
            }
            key = f"public-test-{uuid4()}"
            created = await client.post(
                "/public/workspaces/lena/bookings",
                headers={"Origin": "http://localhost:3344", "Idempotency-Key": key},
                json=payload,
            )
            replay = await client.post(
                "/public/workspaces/lena/bookings",
                headers={"Origin": "http://localhost:3344", "Idempotency-Key": key},
                json=payload,
            )
            reused = await client.post(
                "/public/workspaces/lena/bookings",
                headers={"Origin": "http://localhost:3344", "Idempotency-Key": key},
                json={**payload, "customer": {**payload["customer"], "firstName": "Other"}},
            )
            after = await client.get(
                f"/public/workspaces/lena/services/{service['id']}/availability",
                params={"from": starts_on.isoformat(), "to": ends_on.isoformat()},
            )

        assert created.status_code == 201
        assert created.json()["status"] == "pending"
        assert created.json()["paymentStatus"] == "pending"
        assert created.json()["quote"] == service["quote"]
        assert replay.status_code == 200
        assert replay.json()["id"] == created.json()["id"]
        assert reused.status_code == 409
        assert slot["startAt"] not in {item["startAt"] for item in after.json()["items"]}

        async with owner.transaction() as session:
            stored = (
                (
                    await session.execute(
                        text(
                            """
                        SELECT b.reference, b.amount_cents, b.net_amount_cents,
                               b.tax_amount_cents, b.tax_rate_bps, s.capacity,
                               count(r.id) AS response_count
                        FROM bookings b
                        JOIN sessions s ON s.id = b.session_id
                        LEFT JOIN booking_form_responses r ON r.booking_id = b.id
                        WHERE b.id = :booking_id
                        GROUP BY b.reference, b.amount_cents, b.net_amount_cents,
                                 b.tax_amount_cents, b.tax_rate_bps, s.capacity
                        """
                        ),
                        {"booking_id": created.json()["id"]},
                    )
                )
                .mappings()
                .one()
            )
        assert stored["amount_cents"] == stored["net_amount_cents"] + stored["tax_amount_cents"]
        assert stored["tax_rate_bps"] == 1900
        assert stored["capacity"] == 1
        assert stored["response_count"] == 1

        async with owner.transaction() as session:
            await session.execute(
                text(
                    """
                    UPDATE bookings
                    SET payment_due_at = statement_timestamp() - interval '1 minute'
                    WHERE id = :booking_id
                    """
                ),
                {"booking_id": created.json()["id"]},
            )
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            expired_availability = await client.get(
                f"/public/workspaces/lena/services/{service['id']}/availability",
                params={"from": starts_on.isoformat(), "to": ends_on.isoformat()},
            )
        assert slot["startAt"] in {item["startAt"] for item in expired_availability.json()["items"]}
        async with owner.transaction() as session:
            expired = (
                (
                    await session.execute(
                        text("SELECT status, payment_status FROM bookings WHERE id = :booking_id"),
                        {"booking_id": created.json()["id"]},
                    )
                )
                .mappings()
                .one()
            )
        assert dict(expired) == {"status": "cancelled", "payment_status": "overdue"}
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text("DELETE FROM form_template_services WHERE form_template_id = :form_id"),
                {"form_id": form_id},
            )
            await session.execute(
                text("DELETE FROM form_templates WHERE id = :form_id"),
                {"form_id": form_id},
            )
        await application.dispose()
        await owner.dispose()
