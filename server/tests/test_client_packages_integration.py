"""A client's own packages: what they see, booking a session with one, and buying one."""

from collections.abc import AsyncIterator
from datetime import date, timedelta
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient, Response
from sqlalchemy import text
from test_client_communication_integration import communication as communication
from test_client_communication_integration import sign_in, staff_headers

from slotera_api.config import get_migration_settings
from slotera_api.database import Database
from slotera_api.seed import _seed_id

pytestmark = pytest.mark.integration
ORIGIN = {"Origin": "http://localhost:3344"}


@pytest_asyncio.fixture(autouse=True)
async def _remove_test_packages() -> AsyncIterator[None]:
    """Sold packages can't be deleted through the API, so remove this module's sales here."""
    yield
    owner = Database(get_migration_settings().migration_database_url)
    purchases = (
        "SELECT p.id FROM package_purchases p JOIN service_packages k ON k.id = p.package_id "
        "WHERE k.name LIKE 'Pack %'"
    )
    bookings = f"SELECT id FROM bookings WHERE package_purchase_id IN ({purchases})"
    try:
        async with owner.transaction() as session:
            for table, column in (
                ("email_outbox", "related_booking_id"),
                ("notifications", "resource_id"),
                ("booking_command_idempotency", "booking_id"),
                ("booking_form_responses", "booking_id"),
                ("booking_form_snapshots", "booking_id"),
                ("booking_access_tokens", "booking_id"),
                ("public_booking_idempotency", "booking_id"),
                ("audit_events", "resource_id"),
            ):
                await session.execute(text(f"DELETE FROM {table} WHERE {column} IN ({bookings})"))
            await session.execute(text(f"DELETE FROM bookings WHERE id IN ({bookings})"))
            await session.execute(
                text(f"DELETE FROM notifications WHERE resource_id IN ({purchases})")
            )
            await session.execute(text(f"DELETE FROM package_purchases WHERE id IN ({purchases})"))
            await session.execute(text("DELETE FROM service_packages WHERE name LIKE 'Pack %'"))
    finally:
        await owner.dispose()


async def _fresh_limits(owner: Database) -> None:
    async with owner.transaction() as session:
        await session.execute(text("DELETE FROM request_rate_limits"))


async def _package(operator: AsyncClient, service_name: str, price: int = 40000) -> str:
    services = (await operator.get("/services")).json()["items"]
    service = next(item["id"] for item in services if item["name"] == service_name)
    created = await operator.post(
        "/packages",
        headers=staff_headers(operator),
        json={
            "name": f"Pack {uuid4().hex[:6]}",
            "status": "active",
            "priceCents": price,
            "items": [{"serviceId": service}, {"serviceId": service}],
        },
    )
    assert created.status_code == 201, created.text
    return str(created.json()["id"])


async def _sell(
    operator: AsyncClient, client_id: str, package_id: str, *, paid: bool, notes: str = ""
) -> Response:
    return await operator.post(
        f"/clients/{client_id}/package-purchases",
        headers={**staff_headers(operator), "Idempotency-Key": str(uuid4())},
        json={"packageId": package_id, "paymentReceived": paid, "notes": notes or None},
    )


async def test_a_client_sees_only_their_own_packages_without_private_notes(communication) -> None:
    operator, customer, owner = communication
    await _fresh_limits(owner)
    assert (await customer.get("/client/package-purchases")).status_code == 401
    client_id, _email = await sign_in(operator, customer, owner)
    package_id = await _package(operator, "Discovery Call")
    mine = await _sell(operator, client_id, package_id, paid=False, notes="Private: owes a favour")
    assert mine.status_code == 201, mine.text
    other = await operator.post(
        "/clients",
        headers=staff_headers(operator),
        json={"name": "Someone else", "email": f"other-{uuid4()}@example.com"},
    )
    assert (await _sell(operator, other.json()["id"], package_id, paid=True)).status_code == 201

    listed = await customer.get("/client/package-purchases")
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert [item["id"] for item in body["items"]] == [mine.json()["id"]]
    package = body["items"][0]
    assert (package["paymentStatus"], package["remainingCount"]) == ("pending", 2)
    assert [session["bookedFor"] for session in package["sessions"]] == [None, None]
    assert "notes" not in package and "Private" not in listed.text
    # A pending package shows how to pay.
    assert body["manualPaymentInstructions"].strip()


def _client_write(customer: AsyncClient) -> dict[str, str]:
    return {
        **ORIGIN,
        "X-CSRF-Token": customer.cookies["slotera_client_csrf"],
        "Idempotency-Key": str(uuid4()),
    }


async def _service_slot(customer: AsyncClient, name: str) -> tuple[str, str]:
    services = (await customer.get("/public/workspaces/lena/services")).json()["items"]
    service = next(item["id"] for item in services if item["name"] == name)
    starts_on = date.today() + timedelta(days=7)
    window = {"from": starts_on.isoformat(), "to": (starts_on + timedelta(days=14)).isoformat()}
    slots = await customer.get(
        f"/public/workspaces/lena/services/{service}/availability", params=window
    )
    return service, slots.json()["items"][0]["startAt"]


def _package_booking(service: str, start: str, purchase: str, email: str) -> dict[str, object]:
    return {
        "serviceId": service,
        "startAt": start,
        "customer": {"firstName": "Pat", "lastName": "Client", "email": email},
        "paymentMethod": "package",
        "packagePurchaseId": purchase,
        "termsAccepted": True,
    }


async def test_a_signed_in_client_books_with_a_paid_package_of_their_own(communication) -> None:
    operator, customer, owner = communication
    await _fresh_limits(owner)
    client_id, email = await sign_in(operator, customer, owner)
    package_id = await _package(operator, "Discovery Call")
    unpaid = (await _sell(operator, client_id, package_id, paid=False)).json()
    paid = (await _sell(operator, client_id, package_id, paid=True)).json()
    other = await operator.post(
        "/clients",
        headers=staff_headers(operator),
        json={"name": "Not the buyer", "email": f"not-{uuid4()}@example.com"},
    )
    theirs = (await _sell(operator, other.json()["id"], package_id, paid=True)).json()
    service, start = await _service_slot(customer, "Discovery Call")
    url = "/public/workspaces/lena/bookings"

    # The operator's own browser has no client session: a package needs the signed-in buyer.
    signed_out = await operator.post(
        url,
        headers={**ORIGIN, "Idempotency-Key": str(uuid4())},
        json=_package_booking(service, start, paid["id"], email),
    )
    assert signed_out.status_code == 401
    forged = await customer.post(
        url,
        headers={**ORIGIN, "Idempotency-Key": str(uuid4()), "X-CSRF-Token": "forged"},
        json=_package_booking(service, start, paid["id"], email),
    )
    assert forged.status_code == 403
    for refused in (unpaid["id"], theirs["id"]):
        response = await customer.post(
            url,
            headers=_client_write(customer),
            json=_package_booking(service, start, refused, email),
        )
        assert response.status_code == 409, response.text
        assert response.json()["error"]["code"] == "package_credit_unavailable"

    # The email in the form doesn't matter: the booking belongs to the signed-in client.
    booked = await customer.post(
        url,
        headers=_client_write(customer),
        json=_package_booking(service, start, paid["id"], "someone@else.example"),
    )
    assert booked.status_code == 201, booked.text
    body = booked.json()
    assert (body["paymentMethod"], body["paymentStatus"], body["status"]) == (
        "package",
        "paid",
        "confirmed",
    )
    assert body["quote"]["grossAmountCents"] == 0 and body["pendingReasons"] == []
    detail = (await operator.get(f"/bookings/{body['id']}")).json()
    assert (detail["clientId"], detail["customer"]["email"]) == (client_id, email)
    assert detail["packagePurchaseId"] == paid["id"] and detail["packagePosition"] == 0

    view = (await customer.get("/client/package-purchases")).json()["items"]
    used = next(item for item in view if item["id"] == paid["id"])
    assert used["remainingCount"] == 1 and used["sessions"][0]["bookedFor"] is not None
    history = (await customer.get("/client/bookings")).json()["items"]
    assert history[0]["paymentMethod"] == "package" and history[0]["refundedCents"] == 0

    voided = await operator.post(
        f"/package-purchases/{paid['id']}/void",
        headers={**staff_headers(operator), "If-Match": f'"v{paid["version"]}"'},
    )
    assert voided.status_code == 200
    _, later = await _service_slot(customer, "Discovery Call")
    after_void = await customer.post(
        url,
        headers=_client_write(customer),
        json=_package_booking(service, later, paid["id"], email),
    )
    assert after_void.status_code == 409
    assert after_void.json()["error"]["code"] == "package_voided"


async def test_a_package_booking_still_waits_for_the_services_approval(communication) -> None:
    operator, customer, owner = communication
    await _fresh_limits(owner)
    client_id, email = await sign_in(operator, customer, owner)
    paid = (
        await _sell(operator, client_id, await _package(operator, "Strategy Session"), paid=True)
    ).json()
    service, start = await _service_slot(customer, "Strategy Session")
    answers = {
        "formTemplateId": str(_seed_id("form:hartmann-strategy:intake")),
        "answers": [
            {"fieldId": "goal", "value": "Pricing strategy"},
            {"fieldId": "focus", "value": "Strategy"},
            {"fieldId": "agreement", "value": True},
        ],
    }
    booked = await customer.post(
        "/public/workspaces/lena/bookings",
        headers=_client_write(customer),
        json={**_package_booking(service, start, paid["id"], email), "formResponses": [answers]},
    )
    assert booked.status_code == 201, booked.text
    body = booked.json()
    assert (body["status"], body["paymentStatus"], body["pendingReasons"]) == (
        "pending",
        "paid",
        ["approval"],
    )


async def _outbox(owner: Database, kind: str, recipient: str) -> list[dict[str, object]]:
    async with owner.transaction() as session:
        rows = await session.execute(
            text(
                "SELECT subject, text_body, template_data FROM email_outbox "
                "WHERE kind = :kind AND recipient_email = :email ORDER BY created_at"
            ),
            {"kind": kind, "email": recipient},
        )
        return [dict(row) for row in rows.mappings()]


async def _request(customer: AsyncClient, package_id: str, email: str, key: str) -> Response:
    return await customer.post(
        "/public/workspaces/lena/package-purchases",
        headers={**ORIGIN, "Idempotency-Key": key},
        json={
            "packageId": package_id,
            "customer": {"firstName": "Mira", "lastName": "Neu", "email": email},
            "language": "de",
            "termsAccepted": True,
        },
    )


async def test_a_visitor_buys_a_package_and_gets_it_once_the_payment_is_marked(
    communication,
) -> None:
    operator, customer, owner = communication
    await _fresh_limits(owner)
    package_id = await _package(operator, "Discovery Call")
    email = f"buyer-{uuid4()}@example.com"
    key = f"buy-{uuid4()}"
    bought = await _request(customer, package_id, email, key)
    assert bought.status_code == 201, bought.text
    sale = bought.json()
    assert (sale["paymentStatus"], sale["sessionCount"], sale["priceCents"]) == (
        "pending",
        2,
        40000,
    )
    assert sale["manualPaymentInstructions"].strip()
    replay = await _request(customer, package_id, email, key)
    assert replay.status_code == 200 and replay.json()["id"] == sale["id"]
    other_package = await _package(operator, "Discovery Call")
    reused = await _request(customer, other_package, email, key)
    assert reused.json()["error"]["code"] == "idempotency_key_reused"

    # The client gets the payment details in the language they chose; the owner is told.
    [requested] = await _outbox(owner, "package_requested", email)
    assert requested["subject"].startswith("So bezahlen Sie")
    assert sale["manualPaymentInstructions"].strip() in requested["text_body"]
    alerts = await _outbox(owner, "operator_package_requested", "hello@slotera.io")
    assert any("Mira Neu" in str(row["text_body"]) for row in alerts)
    bell = (await operator.get("/notifications")).json()["items"]
    item = next(entry for entry in bell if entry["resourceId"] == sale["id"])
    assert item["kind"] == "package_requested" and item["payload"]["packageName"].startswith("Pack")
    assert "Mira" not in str(item["payload"])

    client_id = item["payload"]["clientId"]
    listed = (await operator.get(f"/clients/{client_id}/package-purchases")).json()["items"][0]
    assert listed["id"] == sale["id"] and listed["paymentStatus"] == "pending"
    assert await _outbox(owner, "package_ready", email) == []
    paid = await operator.post(
        f"/package-purchases/{sale['id']}/payment-received",
        headers={**staff_headers(operator), "If-Match": f'"v{listed["version"]}"'},
    )
    assert paid.status_code == 200, paid.text
    [ready] = await _outbox(owner, "package_ready", email)
    assert "/book/lena" in str(ready["text_body"]) and "/client/lena/sign-in" in str(
        ready["text_body"]
    )
    async with owner.transaction() as session:
        terms_at = await session.scalar(
            text("SELECT terms_accepted_at FROM package_purchases WHERE id = :id"),
            {"id": sale["id"]},
        )
    assert terms_at is not None


async def test_buying_needs_an_active_package_and_manual_payments(communication) -> None:
    operator, customer, owner = communication
    await _fresh_limits(owner)
    email = f"buyer-{uuid4()}@example.com"
    missing = await _request(customer, str(uuid4()), email, f"buy-{uuid4()}")
    assert missing.status_code == 404
    package_id = await _package(operator, "Discovery Call")
    async with owner.transaction() as session:
        await session.execute(
            text("UPDATE workspace_payment_settings SET manual_payment_enabled = false")
        )
    try:
        closed = await _request(customer, package_id, email, f"buy-{uuid4()}")
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text("UPDATE workspace_payment_settings SET manual_payment_enabled = true")
            )
    assert closed.status_code == 409
    assert closed.json()["error"]["code"] == "package_purchase_unavailable"


async def test_recording_a_paid_sale_emails_the_client_unless_asked_not_to(communication) -> None:
    operator, customer, owner = communication
    await _fresh_limits(owner)
    package_id = await _package(operator, "Discovery Call")
    created = await operator.post(
        "/clients",
        headers=staff_headers(operator),
        json={"name": "Quiet client", "email": f"quiet-{uuid4()}@example.com"},
    )
    client = created.json()
    quiet = await operator.post(
        f"/clients/{client['id']}/package-purchases",
        headers={**staff_headers(operator), "Idempotency-Key": str(uuid4())},
        json={"packageId": package_id, "paymentReceived": True, "notifyClient": False},
    )
    assert quiet.status_code == 201
    assert await _outbox(owner, "package_ready", client["email"]) == []
    assert (await _sell(operator, client["id"], package_id, paid=True)).status_code == 201
    [ready] = await _outbox(owner, "package_ready", client["email"])
    assert "2" in str(ready["text_body"])
