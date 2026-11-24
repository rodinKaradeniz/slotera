from uuid import uuid4

import pytest
from httpx import AsyncClient, Response
from test_everyday_booking_integration import book, headers
from test_everyday_booking_integration import setup as setup

pytestmark = pytest.mark.integration


async def _refund(
    client: AsyncClient, booking_id: object, amount: int, key: str | None = None
) -> Response:
    return await client.post(
        f"/bookings/{booking_id}/record-refund",
        headers=headers(client, key),
        json={"amountCents": amount},
    )


async def _money(client: AsyncClient, client_id: object) -> tuple[int, int]:
    spent = (await client.get(f"/clients/{client_id}")).json()["totalSpentCents"]
    revenue = (await client.get("/dashboard/summary")).json()["revenueThisMonthCents"]
    return spent, revenue


async def test_refunds_add_up_and_lower_revenue_while_a_kept_cancellation_still_counts(
    setup,
) -> None:
    client, _owner, _ = setup
    booking = await book(client, service="Strategy Session", send=False)
    booking_id, client_id, price = (
        booking["id"],
        booking["clientId"],
        int(str(booking["amountCents"])),
    )
    assert booking["paymentStatus"] == "pending" and price > 0

    # Nothing was paid yet, so there is nothing to give back.
    unpaid = await _refund(client, booking_id, 100)
    assert unpaid.status_code == 409
    assert unpaid.json()["error"]["code"] == "booking_refund_invalid"

    spent_before, revenue_before = await _money(client, client_id)
    paid = await client.post(
        f"/bookings/{booking_id}/mark-payment-received", headers=headers(client)
    )
    assert paid.status_code == 200, paid.text
    assert await _money(client, client_id) == (spent_before + price, revenue_before + price)

    once = f"refund-{uuid4()}"
    partial = await _refund(client, booking_id, 10000, key=once)
    assert partial.status_code == 200, partial.text
    assert (partial.json()["paymentStatus"], partial.json()["refundedCents"]) == ("paid", 10000)
    replay = await _refund(client, booking_id, 10000, key=once)
    assert replay.status_code == 200 and replay.json()["refundedCents"] == 10000
    reused = await _refund(client, booking_id, 500, key=once)
    assert reused.json()["error"]["code"] == "idempotency_key_reused"
    over = await _refund(client, booking_id, price - 10000 + 1)
    assert over.json()["error"]["code"] == "booking_refund_invalid"
    assert await _money(client, client_id) == (
        spent_before + price - 10000,
        revenue_before + price - 10000,
    )

    # A cancellation without a refund is money kept: it still counts.
    cancelled = await client.post(f"/bookings/{booking_id}/cancel", headers=headers(client))
    assert cancelled.status_code == 200, cancelled.text
    assert await _money(client, client_id) == (
        spent_before + price - 10000,
        revenue_before + price - 10000,
    )

    rest = await _refund(client, booking_id, price - 10000)
    assert rest.status_code == 200, rest.text
    assert (rest.json()["paymentStatus"], rest.json()["refundedCents"]) == ("refunded", price)
    assert rest.json()["refundedAt"] is not None
    assert await _money(client, client_id) == (spent_before, revenue_before)
    after_full = await _refund(client, booking_id, 1)
    assert after_full.json()["error"]["code"] == "booking_refund_invalid"

    # The client's data export shows how the booking was paid and what was refunded.
    exported = (await client.get(f"/clients/{client_id}/export")).json()["bookings"]
    row = next(item for item in exported if item["reference"] == booking["reference"])
    assert (row["paymentMethod"], row["refundedCents"]) == ("manual", price)
    assert row["refundedAt"] is not None


async def test_free_bookings_have_nothing_to_refund(setup) -> None:
    client, _owner, _ = setup
    booking = await book(client, send=False)
    assert booking["paymentStatus"] == "free"
    refused = await _refund(client, booking["id"], 1)
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "booking_refund_invalid"
