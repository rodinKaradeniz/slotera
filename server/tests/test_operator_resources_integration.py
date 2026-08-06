from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import import_demo_seed

DEMO_PASSWORD = "slotera-local-only"


async def _login(client: AsyncClient, email: str = "hello@slotera.app") -> None:
    response = await client.post(
        "/auth/login",
        headers={"Origin": "http://localhost:3344"},
        json={"email": email, "password": DEMO_PASSWORD},
    )
    assert response.status_code == 200


def _csrf_headers(client: AsyncClient) -> dict[str, str]:
    return {
        "Origin": "http://localhost:3344",
        "X-CSRF-Token": client.cookies["slotera_csrf"],
    }


@pytest.mark.integration
async def test_business_patch_does_not_clear_unmentioned_fields() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)

    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            before = await client.get("/settings/business")
            changed = await client.patch(
                "/settings/business",
                headers=_csrf_headers(client),
                json={"bookingPageEnabled": False},
            )
            restored = await client.patch(
                "/settings/business",
                headers=_csrf_headers(client),
                json={"bookingPageEnabled": True},
            )
    finally:
        await application.dispose()
        await owner.dispose()

    assert before.status_code == 200
    assert before.json()["currency"] == "EUR"
    assert changed.status_code == 200
    assert changed.json()["bookingPageEnabled"] is False
    assert changed.json()["displayName"] == before.json()["displayName"]
    assert changed.json()["bio"] == before.json()["bio"]
    assert restored.status_code == 200


@pytest.mark.integration
async def test_saved_location_crud_is_workspace_scoped() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)

    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            created = await client.post(
                "/settings/locations",
                headers=_csrf_headers(client),
                json={
                    "label": "Temporary Studio",
                    "address": {
                        "street": "Teststraße 1",
                        "city": "Berlin",
                        "postalCode": "10115",
                        "country": "de",
                    },
                },
            )
            location_id = created.json()["id"]
            changed = await client.patch(
                f"/settings/locations/{location_id}",
                headers=_csrf_headers(client),
                json={"label": "Updated Studio"},
            )
            deleted = await client.delete(
                f"/settings/locations/{location_id}",
                headers=_csrf_headers(client),
            )
            listing = await client.get("/settings/locations")
    finally:
        await application.dispose()
        await owner.dispose()

    assert created.status_code == 201
    assert created.json()["address"]["country"] == "DE"
    assert changed.status_code == 200
    assert changed.json()["label"] == "Updated Studio"
    assert deleted.status_code == 204
    assert location_id not in {item["id"] for item in listing.json()["items"]}


@pytest.mark.integration
async def test_service_crud_derives_currency_and_preserves_patch_fields() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)

    payload = {
        "name": "Architecture Review",
        "description": "A focused technical review.",
        "durationMin": 75,
        "priceCents": 25000,
        "capacity": 1,
        "locationType": "physical",
        "location": "Berlin office",
        "address": {
            "street": "Teststraße 2",
            "city": "Berlin",
            "postalCode": "10115",
            "country": "DE",
        },
        "bookingMode": "open",
        "confirmationPolicy": "operator_approval",
        "cancellationRule": "Free cancellation up to 24h before.",
        "active": True,
        "notes": "Operator-only preparation note.",
    }

    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            created = await client.post("/services", headers=_csrf_headers(client), json=payload)
            service_id = created.json()["id"]
            changed = await client.patch(
                f"/services/{service_id}",
                headers=_csrf_headers(client),
                json={"name": "Architecture Deep Dive"},
            )
            fetched = await client.get(f"/services/{service_id}")
            deleted = await client.delete(f"/services/{service_id}", headers=_csrf_headers(client))
            missing = await client.get(f"/services/{service_id}")
        async with owner.transaction() as session:
            audit_actions = list(
                (
                    await session.scalars(
                        text(
                            """
                            SELECT action FROM audit_events
                            WHERE resource_id = :service_id
                            ORDER BY occurred_at
                            """
                        ),
                        {"service_id": service_id},
                    )
                ).all()
            )
    finally:
        await application.dispose()
        await owner.dispose()

    assert created.status_code == 201
    assert created.json()["currency"] == "EUR"
    assert created.json()["confirmationPolicy"] == "operator_approval"
    assert changed.status_code == 200
    assert changed.json()["address"] == created.json()["address"]
    assert changed.json()["notes"] == "Operator-only preparation note."
    assert changed.json()["confirmationPolicy"] == "operator_approval"
    assert fetched.json()["name"] == "Architecture Deep Dive"
    assert deleted.status_code == 204
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "service_not_found"
    assert set(audit_actions) == {"service.created", "service.updated", "service.deleted"}


@pytest.mark.integration
async def test_service_input_cannot_override_workspace_currency() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)

    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            response = await client.post(
                "/services",
                headers=_csrf_headers(client),
                json={
                    "name": "Currency Probe",
                    "description": "",
                    "durationMin": 30,
                    "priceCents": 1000,
                    "currency": "USD",
                    "capacity": 1,
                    "locationType": "online",
                    "location": "Online",
                    "bookingMode": "open",
                    "cancellationRule": "",
                    "active": True,
                },
            )
    finally:
        await application.dispose()
        await owner.dispose()

    assert response.status_code == 422


@pytest.mark.integration
async def test_service_list_supports_only_the_product_filters() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)

    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            response = await client.get(
                "/services",
                params={"search": "group", "active": "true", "locationType": "physical"},
            )
    finally:
        await application.dispose()
        await owner.dispose()

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert [item["name"] for item in response.json()["items"]] == ["Group Workshop"]
    assert response.json()["items"][0]["currency"] == "EUR"


@pytest.mark.integration
async def test_operator_cannot_read_another_workspace_service_by_id() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    other_workspace_id = uuid4()
    other_service_id = uuid4()

    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        async with owner.transaction() as session:
            await session.execute(
                text(
                    """
                    INSERT INTO workspaces (id, name, slug)
                    VALUES (:workspace_id, 'Other Workspace', :slug)
                    """
                ),
                {
                    "workspace_id": other_workspace_id,
                    "slug": f"other-{other_workspace_id}",
                },
            )
            await session.execute(
                text(
                    """
                    INSERT INTO services (
                      id, workspace_id, name, description, duration_min,
                      price_cents, capacity, location_type, location,
                      booking_mode, cancellation_rule, active
                    )
                    VALUES (
                      :service_id, :workspace_id, 'Private Service', '', 30,
                      1000, 1, 'online', 'Online', 'open', '', true
                    )
                    """
                ),
                {"service_id": other_service_id, "workspace_id": other_workspace_id},
            )

        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            response = await client.get(f"/services/{other_service_id}")
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text("DELETE FROM services WHERE workspace_id = :workspace_id"),
                {"workspace_id": other_workspace_id},
            )
            await session.execute(
                text("DELETE FROM workspaces WHERE id = :workspace_id"),
                {"workspace_id": other_workspace_id},
            )
        await application.dispose()
        await owner.dispose()

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "service_not_found"


@pytest.mark.integration
async def test_operator_updates_gross_inclusive_payment_and_tax_settings() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            updated = await client.patch(
                "/settings/payments",
                headers=_csrf_headers(client),
                json={
                    "manualPaymentEnabled": True,
                    "manualPaymentInstructions": "Transfer using the booking reference.",
                    "bookingTermsEnabled": True,
                    "bookingTermsContent": "Payment is due before the session.",
                    "taxTreatment": "fixed",
                    "taxRateBps": 1900,
                    "taxLabel": "VAT",
                    "taxJurisdiction": "de",
                    "sellerTaxNumber": "DE123456789",
                },
            )
            fetched = await client.get("/settings/payments")

        assert updated.status_code == 200
        assert fetched.status_code == 200
        assert fetched.json()["taxTreatment"] == "fixed"
        assert fetched.json()["taxRateBps"] == 1900
        assert fetched.json()["taxJurisdiction"] == "DE"
        async with owner.transaction() as session:
            facts = (
                (
                    await session.execute(
                        text(
                            """
                            SELECT p.tax_treatment, p.tax_rate_bps, s.price_cents,
                                   count(a.id) AS audit_count
                            FROM workspace_payment_settings p
                            JOIN services s ON s.workspace_id = p.workspace_id
                              AND s.name = 'Strategy Session'
                            LEFT JOIN audit_events a ON a.workspace_id = p.workspace_id
                              AND a.action = 'payment_settings.updated'
                            WHERE p.workspace_id = (
                              SELECT id FROM workspaces WHERE slug = 'lena'
                            )
                            GROUP BY p.tax_treatment, p.tax_rate_bps, s.price_cents
                            """
                        )
                    )
                )
                .mappings()
                .one()
            )
        assert facts["tax_treatment"] == "fixed"
        assert facts["tax_rate_bps"] == 1900
        assert facts["price_cents"] == 38000
        assert facts["audit_count"] >= 1
    finally:
        await application.dispose()
        await owner.dispose()
