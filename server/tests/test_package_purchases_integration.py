from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import DEMO_SEED, import_demo_seed

DEMO_PASSWORD = "slotera-local-only"
ORIGIN = {"Origin": "http://localhost:3344"}


def _csrf(
    client: AsyncClient, key: str | None = None, version: int | None = None
) -> dict[str, str]:
    headers = {**ORIGIN, "X-CSRF-Token": client.cookies["slotera_csrf"]}
    if key:
        headers["Idempotency-Key"] = key
    if version is not None:
        headers["If-Match"] = f'"v{version}"'
    return headers


async def _clean_up(owner: Database, made: dict[str, list[str]]) -> None:
    async with owner.transaction() as session:
        for booking_id in made["bookings"]:
            for statement in (
                "DELETE FROM email_outbox WHERE related_booking_id = :id",
                "DELETE FROM notifications WHERE resource_id = :id",
                "DELETE FROM booking_command_idempotency WHERE booking_id = :id",
                "DELETE FROM booking_form_snapshots WHERE booking_id = :id",
                "DELETE FROM booking_access_tokens WHERE booking_id = :id",
                "DELETE FROM audit_events WHERE resource_id = :id",
                "DELETE FROM bookings WHERE id = :id",
            ):
                await session.execute(text(statement), {"id": booking_id})
        for purchase_id in made["purchases"]:
            await session.execute(
                text("DELETE FROM audit_events WHERE resource_id = :id"), {"id": purchase_id}
            )
            await session.execute(
                text("DELETE FROM package_purchases WHERE id = :id"), {"id": purchase_id}
            )
        for statement, key in (
            ("DELETE FROM sessions WHERE id = :id", "sessions"),
            ("DELETE FROM service_packages WHERE id = :id", "packages"),
            ("DELETE FROM clients WHERE id = :id", "clients"),
        ):
            for value in made[key]:
                await session.execute(
                    text("DELETE FROM audit_events WHERE resource_id = :id"), {"id": value}
                )
                await session.execute(text(statement), {"id": value})
        await session.execute(text("DELETE FROM request_rate_limits"))


@pytest.mark.integration
async def test_a_recorded_package_sale_covers_bookings_until_its_sessions_are_used() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    made: dict[str, list[str]] = {
        key: [] for key in ("bookings", "purchases", "sessions", "packages", "clients")
    }
    results: dict[str, Any] = {}
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM request_rate_limits"))
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            login = await client.post(
                "/auth/login",
                headers=ORIGIN,
                json={"email": "hello@slotera.io", "password": DEMO_PASSWORD},
            )
            assert login.status_code == 200
            services = (await client.get("/services", params={"limit": 200})).json()["items"]
            discovery = next(item["id"] for item in services if item["name"] == "Discovery Call")
            other = next(item["id"] for item in services if item["id"] != discovery)
            package = await client.post(
                "/packages",
                headers=_csrf(client),
                json={
                    "name": "Two discovery calls",
                    "status": "active",
                    "priceCents": 30000,
                    "items": [
                        {"serviceId": discovery},
                        {"serviceId": discovery, "title": "Follow-up call"},
                    ],
                },
            )
            assert package.status_code == 201, package.text
            made["packages"].append(package.json()["id"])
            buyer = await client.post(
                "/clients",
                headers=_csrf(client),
                json={
                    "name": "Package Buyer",
                    "email": f"buyer-{uuid4().hex[:8]}@customer.example",
                },
            )
            assert buyer.status_code == 201, buyer.text
            client_id = buyer.json()["id"]
            made["clients"].append(client_id)

            sale_key = f"sale-{uuid4()}"
            sale_body = {"packageId": package.json()["id"], "notes": "Paid by bank transfer"}

            async def sell(key: str, body: dict[str, Any]) -> Response:
                return await client.post(
                    f"/clients/{client_id}/package-purchases", headers=_csrf(client, key), json=body
                )

            results["sale"] = await sell(sale_key, sale_body)
            assert results["sale"].status_code == 201, results["sale"].text
            purchase = results["sale"].json()
            made["purchases"].append(purchase["id"])
            results["replay"] = await sell(sale_key, sale_body)
            results["reused"] = await sell(sale_key, {**sale_body, "notes": "Something else"})

            base = datetime.now(UTC).replace(hour=4, minute=0, second=0, microsecond=0)

            async def new_session(days: int, service: str) -> str:
                start = base + timedelta(days=days)
                created = await client.post(
                    "/sessions",
                    headers=_csrf(client),
                    json={
                        "serviceId": service,
                        "calendarOwnerId": str(DEMO_SEED.operator.id),
                        "startAt": start.isoformat(),
                        "endAt": (start + timedelta(minutes=30)).isoformat(),
                        "capacity": 1,
                        "locationType": "online",
                        "location": "Zoom",
                    },
                )
                assert created.status_code == 201, created.text
                made["sessions"].append(created.json()["id"])
                return str(created.json()["id"])

            slots = [await new_session(day, discovery) for day in (60, 61, 62, 63)]
            elsewhere = await new_session(64, other)

            async def book(session_id: str) -> Response:
                response = await client.post(
                    "/bookings",
                    headers=_csrf(client, f"book-{uuid4()}"),
                    json={
                        "clientId": client_id,
                        "sessionId": session_id,
                        "packagePurchaseId": purchase["id"],
                        "auditReason": "Package session",
                        "sendEmail": False,
                    },
                )
                if response.status_code == 201:
                    made["bookings"].append(response.json()["id"])
                return response

            results["first"] = await book(slots[0])
            results["second"] = await book(slots[1])
            results["exhausted"] = await book(slots[2])
            results["wrong_service"] = await book(elsewhere)
            results["used_view"] = (
                await client.get(f"/clients/{client_id}/package-purchases")
            ).json()
            cancelled = await client.post(
                f"/bookings/{results['first'].json()['id']}/cancel",
                headers=_csrf(client, f"cancel-{uuid4()}"),
            )
            assert cancelled.status_code == 200, cancelled.text
            results["after_cancel"] = await book(slots[2])
            results["detail"] = (
                await client.get(f"/bookings/{results['second'].json()['id']}")
            ).json()

            results["stale_paid"] = await client.post(
                f"/package-purchases/{purchase['id']}/payment-received",
                headers=_csrf(client, version=9),
            )
            results["revenue_before"] = (await client.get("/dashboard/summary")).json()[
                "revenueThisMonthCents"
            ]
            results["paid"] = await client.post(
                f"/package-purchases/{purchase['id']}/payment-received",
                headers=_csrf(client, version=purchase["version"]),
            )
            results["spent"] = (await client.get(f"/clients/{client_id}")).json()["totalSpentCents"]
            results["revenue_after"] = (await client.get("/dashboard/summary")).json()[
                "revenueThisMonthCents"
            ]
            results["delete_package"] = await client.delete(
                f"/packages/{package.json()['id']}",
                headers=_csrf(client, version=package.json()["version"]),
            )
            freed = await client.post(
                f"/bookings/{results['second'].json()['id']}/cancel",
                headers=_csrf(client, f"cancel-{uuid4()}"),
            )
            assert freed.status_code == 200, freed.text
            results["void"] = await client.post(
                f"/package-purchases/{purchase['id']}/void",
                headers=_csrf(client, version=results["paid"].json()["version"]),
            )
            results["after_void"] = await book(slots[3])
            results["spent_after_void"] = (await client.get(f"/clients/{client_id}")).json()[
                "totalSpentCents"
            ]

            fresh = (await client.get(f"/clients/{client_id}")).json()
            erased = await client.post(
                f"/clients/{client_id}/erase",
                headers=_csrf(client, version=fresh["version"]),
                json={"confirmEmail": fresh["email"]},
            )
            assert erased.status_code == 204, erased.text
        async with owner.transaction() as session:
            results["erased_notes"] = await session.scalar(
                text("SELECT notes FROM package_purchases WHERE id = :id"), {"id": purchase["id"]}
            )
    finally:
        await _clean_up(owner, made)
        await application.dispose()
        await owner.dispose()

    assert purchase["paymentStatus"] == "pending" and purchase["status"] == "active"
    assert [item["title"] for item in purchase["items"]] == ["Discovery Call", "Follow-up call"]
    assert purchase["remainingCount"] == 2 and purchase["priceCents"] == 30000
    assert results["replay"].status_code == 200 and results["replay"].json()["id"] == purchase["id"]
    assert results["reused"].status_code == 409
    assert results["reused"].json()["error"]["code"] == "idempotency_key_reused"

    first, second = results["first"].json(), results["second"].json()
    assert results["first"].status_code == 201 and results["second"].status_code == 201
    assert (first["paymentMethod"], first["paymentStatus"], first["status"]) == (
        "package",
        "paid",
        "confirmed",
    )
    assert first["amountCents"] == 0 and first["pendingReasons"] == []
    assert (first["packagePosition"], second["packagePosition"]) == (0, 1)
    for refused in ("exhausted", "wrong_service"):
        assert results[refused].status_code == 409
        assert results[refused].json()["error"]["code"] == "package_credit_unavailable"
    view = results["used_view"]["items"][0]
    assert (view["usedCount"], view["remainingCount"]) == (2, 0)
    # Cancelling the first booking gave its session back, at the lowest position.
    assert results["after_cancel"].status_code == 201
    assert results["after_cancel"].json()["packagePosition"] == 0
    assert results["detail"]["context"]["packageName"] == "Two discovery calls"
    assert results["detail"]["context"]["packageSize"] == 2

    assert results["stale_paid"].status_code == 409
    assert results["paid"].status_code == 200 and results["paid"].json()["paymentStatus"] == "paid"
    # The sale is the money; the covered bookings are worth nothing.
    assert results["spent"] == 30000
    assert results["revenue_after"] - results["revenue_before"] == 30000
    assert results["delete_package"].status_code == 409
    assert results["delete_package"].json()["error"]["code"] == "package_in_use"
    assert results["void"].status_code == 200 and results["void"].json()["remainingCount"] == 0
    assert results["after_void"].status_code == 409
    assert results["after_void"].json()["error"]["code"] == "package_voided"
    assert results["spent_after_void"] == 0
    assert results["erased_notes"] is None


@pytest.mark.integration
async def test_two_bookings_cannot_hold_the_same_package_session() -> None:
    """The partial unique index is the last guard against a double-spent session."""
    owner = Database(get_migration_settings().migration_database_url)
    made: dict[str, list[str]] = {
        key: [] for key in ("bookings", "purchases", "sessions", "packages", "clients")
    }
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        async with owner.transaction() as session:
            row = (
                await session.execute(
                    text(
                        "SELECT b.id, b.workspace_id, b.client_id, s.service_id FROM bookings b "
                        "JOIN sessions s ON s.id = b.session_id WHERE b.status <> 'cancelled' "
                        "AND b.workspace_id = (SELECT workspace_id FROM bookings "
                        "WHERE status <> 'cancelled' GROUP BY workspace_id "
                        "HAVING count(*) > 1 LIMIT 1) LIMIT 2"
                    )
                )
            ).all()
            workspace_id, client_id, service_id = row[0][1], row[0][2], row[0][3]
            package_id = await session.scalar(
                text("SELECT id FROM service_packages WHERE workspace_id = :w LIMIT 1"),
                {"w": workspace_id},
            )
            purchase_id = uuid4()
            made["purchases"].append(str(purchase_id))
            await session.execute(
                text(
                    "INSERT INTO package_purchases (id, workspace_id, client_id, package_id, "
                    "package_name_snapshot, price_cents, currency, payment_status, status) "
                    "VALUES (:id, :w, :c, :p, 'Guard', 0, 'GBP', 'pending', 'active')"
                ),
                {"id": purchase_id, "w": workspace_id, "c": client_id, "p": package_id},
            )
            await session.execute(
                text(
                    "INSERT INTO package_purchase_items (id, workspace_id, purchase_id, "
                    "service_id, position, title_snapshot) VALUES (:id, :w, :p, :s, 0, 'Guard')"
                ),
                {"id": uuid4(), "w": workspace_id, "p": purchase_id, "s": service_id},
            )
        with pytest.raises(Exception, match="ux_bookings_live_package_item"):
            async with owner.transaction() as session:
                for booking_id, *_ in row:
                    await session.execute(
                        text(
                            "UPDATE bookings SET payment_method = 'package', "
                            "package_purchase_id = :p, package_position = 0 WHERE id = :id"
                        ),
                        {"p": purchase_id, "id": booking_id},
                    )
    finally:
        await _clean_up(owner, made)
        await owner.dispose()
