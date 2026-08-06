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
                    UPDATE services
                    SET confirmation_policy = 'operator_approval'
                    WHERE workspace_id = :workspace_id
                      AND name = 'Strategy Session'
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
        assert created.json()["approvalStatus"] == "pending"
        assert created.json()["pendingReasons"] == ["approval", "payment"]
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
                               b.customer_first_name, b.customer_last_name,
                               b.customer_email, b.terms_accepted_at,
                               b.provider_terms_snapshot,
                               b.manual_payment_instructions_snapshot,
                               b.confirmation_policy_snapshot, b.approval_status,
                               s.origin,
                               count(r.id) AS response_count
                        FROM bookings b
                        JOIN sessions s ON s.id = b.session_id
                        LEFT JOIN booking_form_responses r ON r.booking_id = b.id
                        WHERE b.id = :booking_id
                        GROUP BY b.reference, b.amount_cents, b.net_amount_cents,
                                 b.tax_amount_cents, b.tax_rate_bps, s.capacity,
                                 b.customer_first_name, b.customer_last_name,
                                 b.customer_email, b.terms_accepted_at,
                                 b.provider_terms_snapshot,
                                 b.manual_payment_instructions_snapshot,
                                 b.confirmation_policy_snapshot, b.approval_status,
                                 s.origin
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
        assert stored["origin"] == "public_open"
        assert stored["customer_first_name"] == "Ayla"
        assert stored["customer_last_name"] == "Demir"
        assert stored["customer_email"] == "ayla@example.com"
        assert stored["terms_accepted_at"] is not None
        assert stored["provider_terms_snapshot"]
        assert stored["manual_payment_instructions_snapshot"]
        assert stored["confirmation_policy_snapshot"] == "operator_approval"
        assert stored["approval_status"] == "pending"
        assert stored["response_count"] == 1

        async with owner.transaction() as session:
            initial_events = (
                (
                    await session.execute(
                        text(
                            """
                            SELECT
                              (SELECT count(*) FROM email_outbox
                               WHERE related_booking_id = :booking_id) AS email_count,
                              (SELECT count(*) FROM notifications
                               WHERE resource_type = 'booking'
                                 AND resource_id = :booking_id) AS notification_count,
                              (SELECT bool_and(
                                 NOT (payload ? 'clientName')
                                 AND NOT (payload ? 'serviceName')
                               ) FROM notifications
                               WHERE resource_type = 'booking'
                                 AND resource_id = :booking_id) AS payload_is_pii_free
                            """
                        ),
                        {"booking_id": created.json()["id"]},
                    )
                )
                .mappings()
                .one()
            )
        assert dict(initial_events) == {
            "email_count": 1,
            "notification_count": 1,
            "payload_is_pii_free": True,
        }

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

        second_payload = {
            **payload,
            "customer": {
                **payload["customer"],
                "firstName": "Aylin",
                "phone": "+49 30 5550199",
            },
        }
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            second = await client.post(
                "/public/workspaces/lena/bookings",
                headers={
                    "Origin": "http://localhost:3344",
                    "Idempotency-Key": f"public-second-{uuid4()}",
                },
                json=second_payload,
            )
            login = await client.post(
                "/auth/login",
                headers={"Origin": "http://localhost:3344"},
                json={"email": "hello@slotera.app", "password": DEMO_PASSWORD},
            )
            assert login.status_code == 200
            csrf = {
                "Origin": "http://localhost:3344",
                "X-CSRF-Token": client.cookies["slotera_csrf"],
            }
            approved = await client.post(
                f"/bookings/{second.json()['id']}/approve",
                headers={**csrf, "Idempotency-Key": f"approve-{uuid4()}"},
            )
            payment_key = f"payment-{uuid4()}"
            paid = await client.post(
                f"/bookings/{second.json()['id']}/mark-payment-received",
                headers={**csrf, "Idempotency-Key": payment_key},
            )
            paid_replay = await client.post(
                f"/bookings/{second.json()['id']}/mark-payment-received",
                headers={**csrf, "Idempotency-Key": payment_key},
            )

        assert second.status_code == 201
        assert approved.status_code == 200
        assert approved.json()["status"] == "pending"
        assert approved.json()["approvalStatus"] == "approved"
        assert approved.json()["pendingReasons"] == ["payment"]
        assert paid.status_code == 200
        assert paid.json()["status"] == "confirmed"
        assert paid.json()["paymentStatus"] == "paid"
        assert paid.json()["pendingReasons"] == []
        assert paid_replay.status_code == 200
        assert paid_replay.json()["id"] == second.json()["id"]

        async with owner.transaction() as session:
            second_stored = (
                (
                    await session.execute(
                        text(
                            """
                            SELECT b.customer_first_name, b.customer_phone, c.name AS client_name,
                                   count(DISTINCT e.id) AS email_count,
                                   count(DISTINCT n.id) AS notification_count
                            FROM bookings b
                            JOIN clients c ON c.id = b.client_id
                            LEFT JOIN email_outbox e ON e.related_booking_id = b.id
                            LEFT JOIN notifications n
                              ON n.resource_type = 'booking' AND n.resource_id = b.id
                            WHERE b.id = :booking_id
                            GROUP BY b.customer_first_name, b.customer_phone, c.name
                            """
                        ),
                        {"booking_id": second.json()["id"]},
                    )
                )
                .mappings()
                .one()
            )
        assert second_stored["customer_first_name"] == "Aylin"
        assert second_stored["customer_phone"] == "+49 30 5550199"
        assert second_stored["client_name"] == "Ayla Demir"
        assert second_stored["email_count"] == 2
        assert second_stored["notification_count"] == 2
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
