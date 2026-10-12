import time
from datetime import datetime
from typing import Literal, get_args
from zoneinfo import ZoneInfo

from pydantic import Field

from slotera_api.calendar_ics import CalendarEvent, booking_uid, build_calendar
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
    # Added in 20261011_0030; older queued emails lack them.
    location_type: Literal["online", "physical", "hybrid"] | None = None
    location: str = ""
    address: dict[str, object] | None = None
    meeting_url: str | None = None


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


def _address_line(address: dict[str, object] | None) -> str:
    if not address:
        return ""
    keys = ("street", "street2", "postal_code", "postalCode", "city", "country")
    return ", ".join(str(address[key]) for key in keys if address.get(key))


def _where(data: BookingEmailTemplateData) -> str:
    return ", ".join(part for part in (data.location, _address_line(data.address)) if part)


def _booking_facts(data: BookingEmailTemplateData) -> list[str]:
    timezone = ZoneInfo(data.timezone)
    starts_at = data.starts_at.astimezone(timezone)
    ends_at = data.ends_at.astimezone(timezone)
    when = f"{starts_at.strftime('%A, %d %B %Y at %H:%M')}–{ends_at.strftime('%H:%M %Z')}"
    facts = [
        f"Reference: {data.reference}",
        f"Service: {data.service_name}",
        f"Provider: {data.provider_name}",
        f"When: {when}",
    ]
    if _where(data):
        facts.append(f"Where: {_where(data)}")
    if data.meeting_url:
        facts.append(f"Join online: {data.meeting_url}")
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
        body = "\n".join(["Your booking has a new time.", "", *facts, *_manage_lines(data)])
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
            next_steps.extend(["Payment instructions:", data.manual_payment_instructions.strip()])
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


# Emails that carry a calendar file: the event is added, moved, or removed.
CALENDAR_EMAIL_KINDS: frozenset[str] = frozenset(
    {"booking_confirmed", "booking_rescheduled", "booking_cancelled"}
)


def booking_calendar_file(kind: BookingEmailKind, raw_data: dict[str, object]) -> str | None:
    """The `.ics` attachment for an email, or None for kinds that carry none.

    It never includes the manage link: calendar entries get shared and synced.
    """
    if kind not in CALENDAR_EMAIL_KINDS:
        return None
    data = BookingEmailTemplateData.model_validate(raw_data)
    cancelled = kind == "booking_cancelled"
    event = CalendarEvent(
        uid=booking_uid(data.reference),
        start=data.starts_at,
        end=data.ends_at,
        summary=f"{data.service_name} with {data.provider_name}",
        location=data.meeting_url or _where(data),
        description=(
            f"Reference: {data.reference}\n"
            "To change or cancel, use the link in your confirmation email."
        ),
        url=data.meeting_url,
        # Each later file must outrank the earlier one, so use the send time.
        sequence=int(time.time()),
        cancelled=cancelled,
    )
    return build_calendar([event], method="CANCEL" if cancelled else "PUBLISH")


class OperatorEmailTemplateData(ApiModel):
    reference: str
    service_name: str
    client_name: str
    starts_at: datetime
    timezone: str
    booking_status: str
    approval_status: str
    payment_status: str
    admin_url: str


OperatorEmailKind = Literal[
    "operator_booking_new",
    "operator_booking_cancelled",
    "operator_booking_rescheduled",
]
OPERATOR_EMAIL_KINDS: frozenset[str] = frozenset(get_args(OperatorEmailKind))


def render_operator_email(kind: OperatorEmailKind, raw_data: dict[str, object]) -> tuple[str, str]:
    """What a client did, for the workspace owner. Rendered in the workspace's time zone."""
    data = OperatorEmailTemplateData.model_validate(raw_data)
    client = data.client_name or "A client"
    when = data.starts_at.astimezone(ZoneInfo(data.timezone)).strftime("%A, %d %B %Y at %H:%M %Z")
    if kind == "operator_booking_new":
        subject = f"New booking: {client}, {data.service_name}"
        intro = f"{client} booked {data.service_name}."
    elif kind == "operator_booking_rescheduled":
        subject = f"Booking moved: {client}, {data.service_name}"
        intro = f"{client} moved their {data.service_name} booking to a new time."
    else:
        subject = f"Booking cancelled: {client}, {data.service_name}"
        intro = f"{client} cancelled their {data.service_name} booking."
    to_do: list[str] = []
    if kind != "operator_booking_cancelled":
        if data.approval_status == "pending":
            to_do.append("It is waiting for your approval.")
        if data.payment_status == "pending":
            to_do.append("Their manual payment has not been recorded yet.")
    body = "\n".join(
        [
            intro,
            "",
            f"Reference: {data.reference}",
            f"When: {when}",
            *(["", *to_do] if to_do else []),
            "",
            "Open the booking in Slotera:",
            data.admin_url,
        ]
    )
    return subject, body
