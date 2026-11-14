# ruff: noqa: E501
"""Exercise the new real-data surfaces, including their rejection paths."""

import asyncio
from datetime import UTC, date, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import import_demo_seed

ORIGIN = {"Origin": "http://localhost:3344"}


@pytest.mark.integration
async def test_forms_offers_branding_billing_and_preferences() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    database = Database(get_settings().database_url)
    service_id = form_id = package_id = booking_id = None
    stamp = uuid4().hex
    try:
        await import_demo_seed(owner, demo_password="slotera-local-only")
        transport = ASGITransport(app=create_app(database=database), client=(stamp, 1))
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            assert (await client.get("/packages")).status_code == 401
            login = await client.post(
                "/auth/login",
                headers=ORIGIN,
                json={"email": "hello@slotera.io", "password": "slotera-local-only"},
            )
            assert login.status_code == 200
            csrf = {**ORIGIN, "X-CSRF-Token": client.cookies["slotera_csrf"]}
            assert (
                await client.patch("/auth/preferences", json={"language": "de"})
            ).status_code == 403
            assert (
                await client.patch("/auth/preferences", headers=csrf, json={"language": "de"})
            ).status_code == 200
            assert (await client.get("/auth/preferences")).json() == {"language": "de"}
            assert (
                await client.patch(
                    "/settings/branding",
                    headers={
                        **csrf,
                        "If-Match": '"v'
                        + str((await client.get("/settings/branding")).json().get("version", 1))
                        + '"',
                    },
                    json={"accent": "#ffffff", "fontFamily": "sans"},
                )
            ).status_code == 422
            assert (
                await client.patch(
                    "/settings/branding",
                    headers={
                        **csrf,
                        "If-Match": '"v'
                        + str((await client.get("/settings/branding")).json().get("version", 1))
                        + '"',
                    },
                    json={"accent": "#123456", "fontFamily": "sans"},
                )
            ).status_code == 200
            assert (await client.get("/public/workspaces/lena")).json()["branding"][
                "accent"
            ] == "#123456"
            before = (await client.get("/settings/billing")).json()
            assert (
                await client.post(
                    "/settings/billing/change-request",
                    headers=csrf,
                    json={"plan": "professional", "billingInterval": "yearly"},
                )
            ).status_code == 202
            assert (await client.get("/settings/billing")).json() == before
            async with owner.transaction() as session:
                request = (
                    await session.execute(
                        text(
                            "SELECT email, message FROM platform_inquiries "
                            "WHERE message LIKE 'Billing change request%' "
                            "ORDER BY created_at DESC LIMIT 1"
                        )
                    )
                ).one()
            assert request.email == "hello@slotera.io"
            assert "Requested plan: professional" in request.message
            assert "Billing interval: yearly" in request.message
            assert "Workspace: " in request.message
            service = await client.post(
                "/services",
                headers=csrf,
                json={
                    "name": f"Completion {stamp}",
                    "durationMin": 30,
                    "priceCents": 0,
                    "capacity": 1,
                    "locationType": "online",
                    "location": "Online",
                    "bookingMode": "open",
                },
            )
            assert service.status_code == 201, service.text
            service_id = service.json()["id"]
            package = {
                "name": "Offer",
                "description": "An offer",
                "status": "active",
                "priceCents": 1000,
                "notes": "Private offer notes",
                "featured": True,
                "items": [{"serviceId": service_id}, {"serviceId": service_id, "title": "Second"}],
            }
            saved = await client.post("/packages", headers=csrf, json=package)
            assert saved.status_code == 201, saved.text
            package_id = saved.json()["id"]
            assert [i["order"] for i in saved.json()["items"]] == [0, 1]
            package["items"] = [{"serviceId": str(uuid4())}]
            assert (await client.post("/packages", headers=csrf, json=package)).status_code == 404
            offers = (await client.get("/public/workspaces/lena/packages")).json()["items"]
            offer = next(p for p in offers if p["id"] == package_id)
            assert "notes" not in offer and "status" not in offer
            assert offer["currency"] == service.json()["currency"]
            assert (
                await client.delete(
                    f"/services/{service_id}",
                    headers={
                        **csrf,
                        "If-Match": '"v'
                        + str(
                            (await client.get(f"/services/{service_id}")).json().get("version", 1)
                        )
                        + '"',
                    },
                )
            ).status_code == 409
            await client.patch(
                f"/services/{service_id}",
                headers={
                    **csrf,
                    "If-Match": '"v'
                    + str((await client.get(f"/services/{service_id}")).json().get("version", 1))
                    + '"',
                },
                json={"active": False},
            )
            assert not any(
                p["id"] == package_id
                for p in (await client.get("/public/workspaces/lena/packages")).json()["items"]
            )
            await client.patch(
                f"/services/{service_id}",
                headers={
                    **csrf,
                    "If-Match": '"v'
                    + str((await client.get(f"/services/{service_id}")).json().get("version", 1))
                    + '"',
                },
                json={"active": True},
            )
            form = await client.post(
                "/forms",
                headers=csrf,
                json={
                    "name": "Optional prep",
                    "status": "active",
                    "requiredBeforePayment": False,
                    "attachedServiceIds": [service_id],
                    "fields": [
                        {
                            "id": "yes",
                            "label": "Original question",
                            "type": "yes_no",
                            "required": True,
                        }
                    ],
                },
            )
            assert form.status_code == 201, form.text
            form_id = form.json()["id"]
            day = date.today() + timedelta(days=15)
            slots = (
                await client.get(
                    f"/public/workspaces/lena/services/{service_id}/availability",
                    params={"from": day.isoformat(), "to": (day + timedelta(days=7)).isoformat()},
                )
            ).json()["items"]
            assert slots
            created = await client.post(
                "/public/workspaces/lena/bookings",
                headers={**ORIGIN, "Idempotency-Key": stamp},
                json={
                    "serviceId": service_id,
                    "startAt": slots[0]["startAt"],
                    "language": "tr",
                    "customer": {
                        "firstName": "Form",
                        "lastName": "Client",
                        "email": f"{stamp}@example.com",
                    },
                    "billingAddress": {
                        "street": "1 Road",
                        "city": "Berlin",
                        "postalCode": "10115",
                        "country": "DE",
                    },
                    "paymentMethod": "free",
                    "termsAccepted": True,
                },
            )
            assert created.status_code == 201, created.text
            booking_id = created.json()["id"]
            async with owner.transaction() as session:
                payload = await session.scalar(
                    text(
                        "SELECT template_data FROM email_outbox WHERE related_booking_id = :id AND kind = 'booking_confirmed'"
                    ),
                    {"id": UUID(booking_id)},
                )
                operator_language = await session.scalar(
                    text(
                        "SELECT template_data->>'language' FROM email_outbox WHERE related_booking_id = :id AND kind = 'operator_booking_new'"
                    ),
                    {"id": UUID(booking_id)},
                )
            assert payload["language"] == "tr"
            assert operator_language == "de"
            token = {"X-Booking-Token": payload["manageUrl"].split("#")[1]}
            await client.patch(
                f"/forms/{form_id}",
                headers={
                    **csrf,
                    "If-Match": '"v'
                    + str((await client.get(f"/forms/{form_id}")).json().get("version", 1))
                    + '"',
                },
                json={
                    "fields": [
                        {
                            "id": "yes",
                            "label": "Changed question",
                            "type": "yes_no",
                            "required": True,
                        }
                    ]
                },
            )
            await client.delete(
                f"/forms/{form_id}",
                headers={
                    **csrf,
                    "If-Match": '"v'
                    + str((await client.get(f"/forms/{form_id}")).json().get("version", 1))
                    + '"',
                },
            )
            form_id = None
            managed = (await client.get("/public/bookings/manage/forms", headers=token)).json()[
                "items"
            ]
            assert managed[0]["fields"][0]["label"] == "Original question"
            assert managed[0]["canSubmit"]
            snapshot = managed[0]["id"]
            url = f"/public/bookings/manage/forms/{snapshot}/submit"
            # Enforce lifecycle and deadline on the server, even for direct HTTP submissions.
            async with owner.transaction() as session:
                await session.execute(
                    text("UPDATE bookings SET status = 'cancelled' WHERE id = :id"),
                    {"id": UUID(booking_id)},
                )
            attempt = {"answers": [{"fieldId": "yes", "value": False}]}
            assert (
                await client.post(url, headers={**ORIGIN, **token}, json=attempt)
            ).status_code == 409
            async with owner.transaction() as session:
                await session.execute(
                    text("UPDATE bookings SET status = 'confirmed' WHERE id = :id"),
                    {"id": UUID(booking_id)},
                )
                original = (
                    await session.execute(
                        text(
                            "SELECT id, start_at, end_at FROM sessions WHERE id = (SELECT session_id FROM bookings WHERE id = :id)"
                        ),
                        {"id": UUID(booking_id)},
                    )
                ).one()
                past = datetime.now(UTC) - timedelta(hours=3)
                await session.execute(
                    text(
                        "UPDATE sessions SET status = 'cancelled', start_at = :start, end_at = :finish WHERE id = :id"
                    ),
                    {"id": original.id, "start": past, "finish": past + timedelta(minutes=30)},
                )
            assert (
                await client.post(url, headers={**ORIGIN, **token}, json=attempt)
            ).status_code == 409
            async with owner.transaction() as session:
                await session.execute(
                    text(
                        "UPDATE sessions SET status = 'scheduled', start_at = :start, end_at = :finish WHERE id = :id"
                    ),
                    {"id": original.id, "start": original.start_at, "finish": original.end_at},
                )
            assert (
                await client.post(
                    url,
                    headers={**ORIGIN, **token},
                    json={"answers": [{"fieldId": "yes", "value": "no"}]},
                )
            ).status_code == 422
            answers = {"answers": [{"fieldId": "yes", "value": False}]}
            assert (await client.post(url, headers=token, json=answers)).status_code == 403
            simultaneous = await asyncio.gather(
                client.post(url, headers={**ORIGIN, **token}, json=answers),
                client.post(url, headers={**ORIGIN, **token}, json=answers),
            )
            assert [response.status_code for response in simultaneous] == [200, 200]
            async with owner.transaction() as session:
                assert (
                    await session.scalar(
                        text("SELECT count(*) FROM booking_form_responses WHERE booking_id = :id"),
                        {"id": UUID(booking_id)},
                    )
                    == 1
                )
            assert (
                await client.post(url, headers={**ORIGIN, **token}, json=answers)
            ).status_code == 200
            answers["answers"][0]["value"] = True
            assert (
                await client.post(url, headers={**ORIGIN, **token}, json=answers)
            ).status_code == 409
            assert (
                await client.get(
                    "/public/bookings/manage/forms", headers={"X-Booking-Token": "x" * 43}
                )
            ).status_code == 404
            viewed = (await client.get(f"/bookings/{booking_id}/forms")).json()["items"]
            assert viewed[0]["answers"][0]["value"] is False
            async with database.tenant_transaction(uuid4()) as session:
                assert await session.scalar(text("SELECT count(*) FROM service_packages")) == 0
                assert (
                    await session.scalar(text("SELECT count(*) FROM booking_form_snapshots")) == 0
                )
            exported = (await client.get("/settings/workspace-export")).json()["tables"]
            assert any(p["id"] == package_id for p in exported["service_packages"])
            assert any(f["booking_id"] == booking_id for f in exported["booking_form_snapshots"])
            detail = (await client.get(f"/bookings/{booking_id}")).json()
            client_id = detail["clientId"]
            client_export = await client.get(f"/clients/{client_id}/export")
            assert client_export.status_code == 200
            assert (
                client_export.json()["formSnapshots"][0]["fields"][0]["label"]
                == "Original question"
            )
            # A legacy answer has no invented historical questions or new assignments.
            async with owner.transaction() as session:
                await session.execute(
                    text("DELETE FROM booking_form_snapshots WHERE booking_id = :id"),
                    {"id": UUID(booking_id)},
                )
            legacy = (await client.get(f"/bookings/{booking_id}/forms")).json()["items"]
            assert legacy[0]["historicalApproximation"] is True
            assert legacy[0]["fields"] == []
            assert legacy[0]["answers"][0]["fieldId"] == "yes"
            erased = await client.post(
                f"/clients/{client_id}/erase",
                headers={
                    **csrf,
                    "If-Match": '"v'
                    + str((await client.get(f"/clients/{client_id}")).json().get("version", 1))
                    + '"',
                },
                json={"confirmEmail": f"{stamp}@example.com"},
            )
            assert erased.status_code == 204, erased.text
            assert (
                await client.get("/public/bookings/manage/forms", headers=token)
            ).status_code == 404
            assert (await client.get(f"/bookings/{booking_id}/forms")).json()["items"] == []
            # Restore per-workspace settings changed by this test.
            await client.patch(
                "/settings/branding",
                headers={
                    **csrf,
                    "If-Match": '"v'
                    + str((await client.get("/settings/branding")).json().get("version", 1))
                    + '"',
                },
                json={"accent": "#3d5a3d", "fontFamily": "serif"},
            )
            await client.patch("/auth/preferences", headers=csrf, json={"language": "en"})
    finally:
        async with owner.transaction() as session:
            if booking_id:
                await session.execute(
                    text("DELETE FROM bookings WHERE id = :id"), {"id": UUID(booking_id)}
                )
            if form_id:
                await session.execute(
                    text("DELETE FROM form_templates WHERE id = :id"), {"id": UUID(form_id)}
                )
            if package_id:
                await session.execute(
                    text("DELETE FROM service_packages WHERE id = :id"), {"id": UUID(package_id)}
                )
            if service_id:
                await session.execute(
                    text("DELETE FROM sessions WHERE service_id = :id"), {"id": UUID(service_id)}
                )
                await session.execute(
                    text("DELETE FROM services WHERE id = :id"), {"id": UUID(service_id)}
                )
        await owner.dispose()
        await database.dispose()


@pytest.mark.integration
async def test_activation_language_is_saved_without_changing_existing_account_preferences() -> None:
    from urllib.parse import parse_qs, urlparse

    owner = Database(get_migration_settings().migration_database_url)
    database = Database(get_settings().database_url)
    suffix = uuid4().hex
    email = f"language-{suffix}@example.com"
    try:
        transport = ASGITransport(app=create_app(database=database), client=(suffix, 1))
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/auth/signup",
                headers=ORIGIN,
                json={
                    "workspaceName": "Language test",
                    "slug": f"language-{suffix}",
                    "firstNames": "Ada",
                    "lastName": "Example",
                    "email": email,
                    "language": "tr",
                    "termsAccepted": True,
                },
            )
            assert response.status_code == 202, response.text
            async with owner.transaction() as session:
                payload = await session.scalar(
                    text(
                        "SELECT template_data FROM email_outbox WHERE recipient_email = :email ORDER BY created_at DESC LIMIT 1"
                    ),
                    {"email": email},
                )
            assert payload["language"] == "tr"
            token = parse_qs(urlparse(payload["resetUrl"]).query)["token"][0]
            consumed = await client.post(
                "/auth/password-reset/consume",
                headers=ORIGIN,
                json={"token": token, "newPassword": "local-language-test-password"},
            )
            assert consumed.status_code == 204, consumed.text
            login = await client.post(
                "/auth/login",
                headers=ORIGIN,
                json={"email": email, "password": "local-language-test-password"},
            )
            assert login.status_code == 200
            assert (await client.get("/auth/preferences")).json()["language"] == "tr"
            response = await client.post(
                "/auth/password-reset/request",
                headers=ORIGIN,
                json={"email": email, "language": "de"},
            )
            assert response.status_code == 202
            assert (await client.get("/auth/preferences")).json()["language"] == "tr"
    finally:
        await database.dispose()
        await owner.dispose()
