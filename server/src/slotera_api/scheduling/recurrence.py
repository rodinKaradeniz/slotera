from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo


def expand_weekly_occurrences(
    *,
    first_start: datetime,
    duration_minutes: int,
    timezone: str,
    interval_weeks: int,
    weekdays: tuple[int, ...],
    horizon_end: date,
) -> list[tuple[datetime, datetime]]:
    """Expand a local-time weekly rule into UTC half-open occurrence ranges."""
    zone = ZoneInfo(timezone)
    local_first = first_start.astimezone(zone)
    anchor_week = local_first.date() - timedelta(days=local_first.isoweekday() - 1)
    cursor = local_first.date()
    result: list[tuple[datetime, datetime]] = []

    while cursor <= horizon_end:
        week = (cursor - anchor_week).days // 7
        if cursor.isoweekday() in weekdays and week % interval_weeks == 0:
            local_start = datetime.combine(
                cursor,
                time(local_first.hour, local_first.minute, local_first.second),
                tzinfo=zone,
            )
            # A UTC round trip detects wall-clock times skipped by a DST transition.
            round_trip = local_start.astimezone(UTC).astimezone(zone)
            if round_trip.replace(fold=local_start.fold) == local_start:
                start = local_start.astimezone(UTC)
                if start >= first_start.astimezone(UTC):
                    result.append((start, start + timedelta(minutes=duration_minutes)))
        cursor += timedelta(days=1)
    return result
