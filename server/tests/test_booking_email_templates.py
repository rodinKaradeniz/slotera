from slotera_api.email.templates import render_booking_email

TEMPLATE_DATA: dict[str, object] = {
    "reference": "SLT-EXAMPLE",
    "serviceName": "Strategy Session",
    "providerName": "Hartmann Strategy",
    "startsAt": "2030-01-10T09:00:00Z",
    "endsAt": "2030-01-10T10:30:00Z",
    "timezone": "Europe/Berlin",
    "paymentMethod": "manual",
    "paymentStatus": "pending",
    "approvalStatus": "pending",
    "amountCents": 38000,
    "currency": "EUR",
    "paymentDueAt": "2030-01-09T09:00:00Z",
    "manualPaymentInstructions": "Use the booking reference with your transfer.",
    "cancellationRule": "Cancel at least 24 hours before the session.",
}


def test_booking_received_template_explains_both_pending_gates() -> None:
    subject, body = render_booking_email("booking_received", TEMPLATE_DATA)

    assert subject == "Booking received — Strategy Session"
    assert "not confirmed yet" in body
    assert "review your request" in body
    assert "Manual payment due: 380.00 EUR" in body
    assert "Use the booking reference" in body
    assert "SLT-EXAMPLE" in body


def test_booking_confirmed_template_contains_booking_facts_without_a_magic_link() -> None:
    subject, body = render_booking_email(
        "booking_confirmed",
        {
            **TEMPLATE_DATA,
            "paymentStatus": "paid",
            "approvalStatus": "approved",
        },
    )

    assert subject == "Booking confirmed — Strategy Session"
    assert "Your booking is confirmed" in body
    assert "SLT-EXAMPLE" in body
    assert "http" not in body
