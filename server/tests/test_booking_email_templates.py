from slotera_api.email.templates import render_booking_email, render_operator_email

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


def test_confirmed_email_lists_where_and_the_meeting_link() -> None:
    _subject, body = render_booking_email(
        "booking_confirmed",
        {
            **TEMPLATE_DATA,
            "locationType": "hybrid",
            "location": "Mitte studio",
            "address": {"street": "1 Main St", "postal_code": "10115", "city": "Berlin"},
            "meetingUrl": "https://meet.example.com/abc",
        },
    )
    assert "Where: Mitte studio, 1 Main St, 10115, Berlin" in body
    assert "Join online: https://meet.example.com/abc" in body


def test_calendar_file_only_for_add_move_and_remove_emails() -> None:
    from slotera_api.email.templates import booking_calendar_file

    assert booking_calendar_file("booking_received", TEMPLATE_DATA) is None
    assert booking_calendar_file("booking_reminder", TEMPLATE_DATA) is None
    confirmed = booking_calendar_file("booking_confirmed", TEMPLATE_DATA)
    cancelled = booking_calendar_file("booking_cancelled", TEMPLATE_DATA)
    assert confirmed is not None and cancelled is not None
    assert "METHOD:PUBLISH" in confirmed and "UID:slt-example@slotera.io" in confirmed
    assert "SUMMARY:Strategy Session with Hartmann Strategy" in confirmed
    assert "METHOD:CANCEL" in cancelled and "STATUS:CANCELLED" in cancelled
    assert "manage" not in confirmed.lower().replace("change or cancel", "")


def test_operator_email_says_what_the_client_did_and_links_to_the_booking() -> None:
    subject, body = render_operator_email(
        "operator_booking_new",
        {
            "reference": "SLT-OPS1",
            "serviceName": "Discovery Call",
            "clientName": "Fiona Feed",
            "startsAt": "2030-01-10T09:00:00Z",
            "timezone": "Europe/London",
            "bookingStatus": "pending",
            "approvalStatus": "pending",
            "paymentStatus": "free",
            "adminUrl": "https://app.example/admin/bookings/b1",
        },
    )

    assert subject == "New booking: Fiona Feed, Discovery Call"
    assert "Thursday, 10 January 2030 at 09:00 GMT" in body
    assert "It is waiting for your approval." in body
    assert body.endswith("https://app.example/admin/bookings/b1")
