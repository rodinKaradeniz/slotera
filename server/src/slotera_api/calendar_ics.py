"""Minimal iCalendar (RFC 5545) writer for booking attachments and operator feeds.

Times are written in UTC, so every calendar app shows them in its own time zone. A
booking keeps one UID (`{reference}@slotera.io`); a later file with a higher SEQUENCE
replaces the earlier event, and `METHOD:CANCEL` removes it. web/src/lib/ics.ts writes the
same format for the browser's "Add to calendar" button.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

PRODID = "-//Slotera//Bookings//EN"


@dataclass(frozen=True)
class CalendarEvent:
    uid: str
    start: datetime
    end: datetime
    summary: str
    location: str = ""
    description: str = ""
    url: str | None = None
    sequence: int = 0
    cancelled: bool = False


def booking_uid(reference: str) -> str:
    return f"{reference.lower()}@slotera.io"


def _utc(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def _escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def _fold(line: str) -> str:
    """Split lines longer than 75 octets; continuation lines start with one space."""
    data = line.encode()
    parts: list[bytes] = []
    limit = 75
    while len(data) > limit:
        cut = limit
        while cut > 0 and (data[cut] & 0xC0) == 0x80:  # never split a UTF-8 character
            cut -= 1
        parts.append(data[:cut])
        data = data[cut:]
        limit = 74  # the leading space counts toward the next line's 75 octets
    parts.append(data)
    return "\r\n ".join(part.decode() for part in parts)


def _event_lines(event: CalendarEvent, stamp: str) -> list[str]:
    lines = [
        "BEGIN:VEVENT",
        f"UID:{event.uid}",
        f"DTSTAMP:{stamp}",
        f"DTSTART:{_utc(event.start)}",
        f"DTEND:{_utc(event.end)}",
        f"SEQUENCE:{event.sequence}",
        f"SUMMARY:{_escape(event.summary)}",
    ]
    if event.location:
        lines.append(f"LOCATION:{_escape(event.location)}")
    if event.description:
        lines.append(f"DESCRIPTION:{_escape(event.description)}")
    if event.url:
        lines.append(f"URL:{event.url}")
    lines += [f"STATUS:{'CANCELLED' if event.cancelled else 'CONFIRMED'}", "END:VEVENT"]
    return lines


def build_calendar(
    events: list[CalendarEvent],
    *,
    method: Literal["PUBLISH", "CANCEL"] = "PUBLISH",
    name: str | None = None,
    now: datetime | None = None,
) -> str:
    stamp = _utc(now or datetime.now(UTC))
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", f"PRODID:{PRODID}", "CALSCALE:GREGORIAN"]
    lines.append(f"METHOD:{method}")
    if name:
        lines.append(f"X-WR-CALNAME:{_escape(name)}")
    for event in events:
        lines += _event_lines(event, stamp)
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"
