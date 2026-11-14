import pytest

from slotera_api.email.locales import TEXT, render_localized
from slotera_api.email.templates import (
    booking_calendar_file,
    render_booking_email,
    render_operator_email,
)

DATA: dict[str, object] = {
    "reference": "SLT-LOCALE",
    "serviceName": "Consultant-written service",
    "providerName": "Ada",
    "startsAt": "2030-01-10T09:00:00Z",
    "endsAt": "2030-01-10T10:00:00Z",
    "timezone": "Europe/Berlin",
    "paymentMethod": "manual",
    "paymentStatus": "pending",
    "approvalStatus": "pending",
    "amountCents": 12345,
    "currency": "GBP",
    "paymentDueAt": "2030-01-09T09:00:00Z",
    "manualPaymentInstructions": "Operator's original payment instructions",
    "cancellationRule": "Operator's original terms",
    "manageUrl": "https://example.com/booking/manage#test",
    "clientName": "Customer",
    "bookingStatus": "pending",
    "adminUrl": "https://example.com/admin/bookings/test",
}


@pytest.mark.parametrize("lang", ["tr", "de"])
@pytest.mark.parametrize(
    "kind", ["received", "confirmed", "reminder", "rescheduled", "cancelled", "details"]
)
def test_client_emails_are_localized_without_translating_authored_content(
    lang: str, kind: str
) -> None:
    raw = {**DATA, "language": lang}
    subject, body = render_booking_email(f"booking_{kind}", raw)  # type: ignore[arg-type]
    assert TEXT[lang][kind] in subject
    assert "Consultant-written service" in subject
    assert TEXT[lang]["reference"] in body
    assert "Operator's original terms" in body
    if kind == "received":
        assert "Operator's original payment instructions" in body
        assert "123,45 GBP" in body
    calendar = booking_calendar_file(f"booking_{kind}", raw)  # type: ignore[arg-type]
    if calendar:
        assert TEXT[lang]["calendar"] in calendar.replace("\r\n ", "")
        assert "#test" not in calendar


@pytest.mark.parametrize("lang", ["tr", "de"])
@pytest.mark.parametrize("kind", ["new", "rescheduled", "cancelled"])
def test_operator_emails_have_localized_subjects_and_actions(lang: str, kind: str) -> None:
    subject, body = render_operator_email(f"operator_booking_{kind}", {**DATA, "language": lang})  # type: ignore[arg-type]
    assert TEXT[lang][kind] in subject
    assert TEXT[lang]["open"] in body
    assert body.endswith(str(DATA["adminUrl"]))


@pytest.mark.parametrize("lang", ["tr", "de"])
def test_activation_email_uses_selected_language(lang: str) -> None:
    subject, body = render_localized(
        "account_activation",
        {
            "language": lang,
            "firstName": "Ada",
            "resetUrl": "https://example.com/reset?token=test",
            "expiresAt": "2030-01-10T09:00:00Z",
        },
    )
    assert subject == TEXT[lang]["activation"]
    assert TEXT[lang]["activate"] in body
    assert "https://example.com/reset?token=test" in body


def test_unknown_or_legacy_language_keeps_english_compatibility() -> None:
    assert render_booking_email("booking_confirmed", DATA) == render_booking_email(
        "booking_confirmed", {**DATA, "language": "unexpected"}
    )
