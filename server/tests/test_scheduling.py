from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError

from slotera_api.scheduling.recurrence import expand_weekly_occurrences
from slotera_api.schemas.scheduling import AvailabilityUpdate


def test_recurrence_keeps_the_local_wall_clock_across_dst() -> None:
    occurrences = expand_weekly_occurrences(
        first_start=datetime(2026, 3, 22, 9, tzinfo=UTC),
        duration_minutes=60,
        timezone="Europe/Berlin",
        interval_weeks=1,
        weekdays=(7,),
        horizon_end=date(2026, 4, 6),
    )

    assert [start.astimezone().tzinfo for start, _ in occurrences]
    assert [start.hour for start, _ in occurrences] == [9, 8, 8]


def test_availability_rejects_overlapping_windows_on_the_same_day() -> None:
    with pytest.raises(ValidationError, match="overlap"):
        AvailabilityUpdate.model_validate(
            {
                "timezone": "Europe/Berlin",
                "weeklyHours": [
                    {"dayOfWeek": 1, "startLocal": "09:00", "endLocal": "12:00"},
                    {"dayOfWeek": 1, "startLocal": "11:30", "endLocal": "17:00"},
                ],
                "slotIntervalMin": 30,
                "bufferBeforeMin": 0,
                "bufferAfterMin": 0,
                "minimumNoticeMin": 60,
                "maximumAdvanceDays": 90,
                "blackouts": [],
            }
        )
