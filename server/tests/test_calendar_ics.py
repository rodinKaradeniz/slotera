from datetime import UTC, datetime, timedelta, timezone

from slotera_api.calendar_ics import CalendarEvent, booking_uid, build_calendar

START = datetime(2026, 11, 3, 14, 0, tzinfo=timezone(timedelta(hours=1)))


def _event(**changes: object) -> CalendarEvent:
    values: dict[str, object] = {
        "uid": booking_uid("SLT-AB12"),
        "start": START,
        "end": START + timedelta(minutes=50),
        "summary": "Discovery Call with Dr. Lena Hartmann",
        "location": "Studio 4, 1 Main St; London",
        "description": "Reference: SLT-AB12\nTo change or cancel, use your email link.",
        "sequence": 7,
    }
    values.update(changes)
    return CalendarEvent(**values)  # type: ignore[arg-type]


def test_publishes_one_event_in_utc_with_escaping() -> None:
    ics = build_calendar([_event()], now=datetime(2026, 10, 11, tzinfo=UTC))
    assert ics.startswith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")
    assert ics.endswith("END:VCALENDAR\r\n")
    assert "METHOD:PUBLISH\r\n" in ics
    assert "UID:slt-ab12@slotera.io\r\n" in ics
    assert "DTSTART:20261103T130000Z\r\n" in ics and "DTEND:20261103T135000Z\r\n" in ics
    assert "DTSTAMP:20261011T000000Z\r\n" in ics
    assert "LOCATION:Studio 4\\, 1 Main St\; London\r\n" in ics
    assert "DESCRIPTION:Reference: SLT-AB12\\nTo change" in ics
    assert "STATUS:CONFIRMED" in ics and "SEQUENCE:7" in ics


def test_cancellation_uses_the_same_uid() -> None:
    ics = build_calendar([_event(cancelled=True)], method="CANCEL")
    assert "METHOD:CANCEL\r\n" in ics and "STATUS:CANCELLED\r\n" in ics
    assert "UID:slt-ab12@slotera.io\r\n" in ics


def test_long_lines_fold_at_75_octets_without_splitting_characters() -> None:
    ics = build_calendar([_event(summary="Sitzung mit Ünal Öztürk " * 8)])
    for line in ics.split("\r\n"):
        assert len(line.encode()) <= 75
    unfolded = ics.replace("\r\n ", "")
    assert "SUMMARY:" + ("Sitzung mit Ünal Öztürk " * 8) in unfolded
