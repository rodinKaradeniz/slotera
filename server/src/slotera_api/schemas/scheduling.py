from datetime import date, datetime, time
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_serializer, field_validator, model_validator

from slotera_api.schemas.base import ApiModel
from slotera_api.schemas.operator_resources import Address, NonBlank, StrictApiModel


class AvailabilityWindowInput(StrictApiModel):
    day_of_week: int = Field(ge=1, le=7)
    start_local: time
    end_local: time

    @model_validator(mode="after")
    def validate_order(self) -> "AvailabilityWindowInput":
        if self.start_local >= self.end_local:
            raise ValueError("startLocal must be before endLocal")
        return self

    @field_serializer("start_local", "end_local", when_used="json")
    def serialize_local_time(self, value: time) -> str:
        return value.strftime("%H:%M")


class AvailabilityBlackoutInput(StrictApiModel):
    starts_at: datetime
    ends_at: datetime
    reason: Annotated[str | None, Field(max_length=240)] = None

    @model_validator(mode="after")
    def validate_range(self) -> "AvailabilityBlackoutInput":
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("blackout timestamps must include a timezone")
        if self.starts_at >= self.ends_at:
            raise ValueError("startsAt must be before endsAt")
        return self


class AvailabilityBlackoutResponse(AvailabilityBlackoutInput):
    id: UUID


class AvailabilityUpdate(StrictApiModel):
    timezone: Annotated[NonBlank, Field(max_length=64)]
    weekly_hours: list[AvailabilityWindowInput] = Field(max_length=35)
    slot_interval_min: int = Field(ge=5, le=1440)
    buffer_before_min: int = Field(ge=0, le=1440)
    buffer_after_min: int = Field(ge=0, le=1440)
    minimum_notice_min: int = Field(ge=0, le=525600)
    maximum_advance_days: int = Field(ge=1, le=730)
    blackouts: list[AvailabilityBlackoutInput] = Field(max_length=500)

    @field_validator("timezone")
    @classmethod
    def timezone_must_exist(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("timezone must be an IANA timezone") from exc
        return value

    @model_validator(mode="after")
    def windows_must_not_overlap(self) -> "AvailabilityUpdate":
        by_day: dict[int, list[AvailabilityWindowInput]] = {}
        for window in self.weekly_hours:
            by_day.setdefault(window.day_of_week, []).append(window)
        for windows in by_day.values():
            ordered = sorted(windows, key=lambda item: item.start_local)
            if any(
                left.end_local > right.start_local
                for left, right in zip(ordered, ordered[1:], strict=False)
            ):
                raise ValueError("weeklyHours cannot overlap on the same day")
        return self


class AvailabilityResponse(ApiModel):
    timezone: str
    weekly_hours: list[AvailabilityWindowInput]
    slot_interval_min: int
    buffer_before_min: int
    buffer_after_min: int
    minimum_notice_min: int
    maximum_advance_days: int
    blackouts: list[AvailabilityBlackoutResponse]
    updated_at: datetime


class RecurrenceInput(StrictApiModel):
    interval_weeks: int = Field(default=1, ge=1, le=52)
    weekdays: list[int] = Field(min_length=1, max_length=7)
    ends_on: date | None = None

    @field_validator("weekdays")
    @classmethod
    def validate_weekdays(cls, value: list[int]) -> list[int]:
        if any(day < 1 or day > 7 for day in value):
            raise ValueError("weekdays must contain ISO weekdays from 1 to 7")
        if len(value) != len(set(value)):
            raise ValueError("weekdays cannot contain duplicates")
        return sorted(value)


class SessionCreate(StrictApiModel):
    service_id: UUID
    calendar_owner_id: UUID | None = None
    start_at: datetime
    end_at: datetime
    capacity: int = Field(ge=1, le=10000)
    location_type: Literal["online", "physical", "hybrid"]
    location: Annotated[NonBlank, Field(max_length=240)]
    address: Address | None = None
    notes: Annotated[str | None, Field(max_length=2000)] = None
    recurrence: RecurrenceInput | None = None

    @model_validator(mode="after")
    def validate_range(self) -> "SessionCreate":
        if self.start_at.tzinfo is None or self.end_at.tzinfo is None:
            raise ValueError("session timestamps must include a timezone")
        if self.start_at >= self.end_at:
            raise ValueError("startAt must be before endAt")
        if self.recurrence and (self.end_at - self.start_at).total_seconds() % 60:
            raise ValueError("recurring session duration must use whole minutes")
        if (
            self.recurrence
            and self.recurrence.ends_on
            and self.recurrence.ends_on < self.start_at.date()
        ):
            raise ValueError("recurrence endsOn cannot precede startAt")
        return self


class SessionPatch(StrictApiModel):
    service_id: UUID | None = None
    calendar_owner_id: UUID | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    capacity: int | None = Field(default=None, ge=1, le=10000)
    status: Literal["scheduled", "live", "done", "cancelled"] | None = None
    location_type: Literal["online", "physical", "hybrid"] | None = None
    location: Annotated[NonBlank | None, Field(max_length=240)] = None
    address: Address | None = None
    notes: Annotated[str | None, Field(max_length=2000)] = None

    @model_validator(mode="after")
    def validate_patch(self) -> "SessionPatch":
        for field in self.model_fields_set - {"address", "notes"}:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        if ("start_at" in self.model_fields_set) != ("end_at" in self.model_fields_set):
            raise ValueError("startAt and endAt must be changed together")
        if self.start_at is not None and self.end_at is not None:
            if self.start_at.tzinfo is None or self.end_at.tzinfo is None:
                raise ValueError("session timestamps must include a timezone")
            if self.start_at >= self.end_at:
                raise ValueError("startAt must be before endAt")
        return self


class SchedulingSessionResponse(ApiModel):
    id: UUID
    series_id: UUID | None
    service_id: UUID
    calendar_owner_id: UUID
    start_at: datetime
    end_at: datetime
    capacity: int
    booked_count: int = 0
    status: Literal["scheduled", "live", "done", "cancelled"]
    location_type: Literal["online", "physical", "hybrid"]
    location: str
    address: Address | None
    recurring: Literal["one-off", "weekly", "custom"]
    notes: str | None
    created_at: datetime
    updated_at: datetime


class SessionListResponse(ApiModel):
    items: list[SchedulingSessionResponse]
    total: int
    limit: int
    offset: int
