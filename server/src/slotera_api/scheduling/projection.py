from typing import Literal
from zoneinfo import ZoneInfo

from slotera_api.db.models import Session, SessionSeries
from slotera_api.schemas.operator_resources import Address
from slotera_api.schemas.scheduling import SchedulingSessionResponse


def session_response(
    item: Session, series: SessionSeries | None, booked_count: int = 0
) -> SchedulingSessionResponse:
    recurring: Literal["one-off", "weekly", "custom"] = "one-off"
    if series is not None:
        local_weekday = item.start_at.astimezone(ZoneInfo(series.timezone)).isoweekday()
        recurring = (
            "weekly"
            if series.interval_weeks == 1 and series.weekdays == [local_weekday]
            else "custom"
        )
    return SchedulingSessionResponse(
        version=item.version,
        id=item.id,
        series_id=item.series_id,
        series_version=series.version if series else None,
        service_id=item.service_id,
        calendar_owner_id=item.calendar_owner_id,
        start_at=item.start_at,
        end_at=item.end_at,
        capacity=item.capacity,
        booked_count=booked_count,
        status=item.status.value,
        location_type=item.location_type.value,
        location=item.location,
        address=Address.model_validate(item.address) if item.address else None,
        recurring=recurring,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )
