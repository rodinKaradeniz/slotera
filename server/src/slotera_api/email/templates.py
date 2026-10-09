from datetime import datetime
from typing import Literal, get_args
from zoneinfo import ZoneInfo

from pydantic import Field

from slotera_api.schemas.base import ApiModel


class BookingEmailTemplateData(ApiModel):
    reference: str
    service_name: str
    provider_name: str
    starts_at: datetime
    ends_at: datetime
    timezone: str
    payment_method: Literal["free", "manual"]
    payment_status: Literal["paid", "pending", "refunded", "free", "overdue"]
    approval_status: Literal["not_required", "pending", "approved", "declined"]
    amount_cents: int = Field(ge=0)
    currency: str
    payment_due_at: datetime | None
    manual_payment_instructions: str
    cancellation_rule: str
    manage_url: str | None = None


BookingEmailKind = Literal[
    "booking_received",
    "booking_confirmed",
    "booking_reminder",
    "booking_rescheduled",
    "booking_cancelled",
]
BOOKING_EMAIL_KINDS: frozenset[str] = frozenset(get_args(BookingEmailKind))


def _manage_lines(data: BookingEmailTemplateData) -> list[str]:
    if not data.manage_url:
        return []
    return ["", "View, reschedule, or cancel your booking:", data.manage_url]


def _booking_facts(data: BookingEmailTemplateData) -> list[str]:
    timezone = ZoneInfo(data.timezone)
    starts_at = data.starts_at.astimezone(timezone)
    ends_at = data.ends_at.astimezone(timezone)
    when = (
        f"{starts_at.strftime('%A, %d %B %Y at %H:%M')}–"
        f"{ends_at.strftime('%H:%M %Z')}"
    )
    facts = [
        f"Reference: {data.reference}",
        f"Service: {data.service_name}",
        f"Provider: {data.provider_name}",
        f"When: {when}",
    ]
    if data.cancellation_rule.strip():
        facts.append(f"Cancellation policy: {data.cancellation_rule.strip()}")
    return facts


def render_booking_email(
    kind: BookingEmailKind,
    raw_data: dict[str, object],
) -> tuple[str, str]:
    data = BookingEmailTemplateData.model_validate(raw_data)
    facts = _booking_facts(data)
    if kind == "booking_confirmed":
        subject = f"Booking confirmed — {data.service_name}"
        body = "\n".join(
            [
                "Your booking is confirmed.",
                "",
                *facts,
                *_manage_lines(data),
                "",
                "Keep this email and reference for your records.",
            ]
        )
        return subject, body
    if kind == "booking_reminder":
        subject = f"Reminder — {data.service_name}"
        body = "\n".join(["Your session is coming up.", "", *facts, *_manage_lines(data)])
        return subject, body
    if kind == "booking_rescheduled":
        subject = f"Booking moved — {data.service_name}"
        body = "\n".join(
            ["Your booking has a new time.", "", *facts, *_manage_lines(data)]
        )
        return subject, body
    if kind == "booking_cancelled":
        subject = f"Booking cancelled — {data.service_name}"
        body = "\n".join(
            [
                "Your booking has been cancelled.",
                "",
                *facts,
                "",
                "Any refund is handled by the provider under their cancellation policy.",
            ]
        )
        return subject, body

    next_steps: list[str] = []
    if data.approval_status == "pending":
        next_steps.append("The provider will review your request before it is confirmed.")
    if data.payment_status == "pending":
        amount = f"{data.amount_cents / 100:.2f} {data.currency}"
        next_steps.append(f"Manual payment due: {amount}.")
        if data.payment_due_at is not None:
            due = data.payment_due_at.astimezone(ZoneInfo(data.timezone))
            next_steps.append(f"Payment deadline: {due.strftime('%d %B %Y at %H:%M %Z')}.")
        if data.manual_payment_instructions.strip():
            next_steps.extend(
                ["Payment instructions:", data.manual_payment_instructions.strip()]
            )
    subject = f"Booking received — {data.service_name}"
    body = "\n".join(
        [
            "We received your booking.",
            "It is not confirmed yet.",
            "",
            *facts,
            "",
            *next_steps,
            *_manage_lines(data),
            "",
            "You will receive another email when the booking is confirmed.",
        ]
    )
    return subject, body
