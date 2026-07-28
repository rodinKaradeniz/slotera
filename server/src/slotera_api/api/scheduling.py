from datetime import datetime
from http import HTTPStatus
from typing import Annotated, Any, Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query, Response

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.db.models import (
    AvailabilityBlackout,
    AvailabilityPolicy,
    AvailabilityWindow,
    Session,
    SessionSeries,
    Workspace,
)
from slotera_api.errors import ApiError
from slotera_api.scheduling.repository import (
    PastSessionImmutableError,
    SchedulingRepository,
    SessionConflictError,
)
from slotera_api.schemas.operator_resources import Address
from slotera_api.schemas.scheduling import (
    AvailabilityBlackoutResponse,
    AvailabilityResponse,
    AvailabilityUpdate,
    AvailabilityWindowInput,
    SchedulingSessionResponse,
    SessionCreate,
    SessionListResponse,
    SessionPatch,
)

availability_router = APIRouter(prefix="/availability", tags=["availability"])
sessions_router = APIRouter(prefix="/sessions", tags=["sessions"])


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _error(status: HTTPStatus, code: str, message: str) -> ApiError:
    return ApiError(status_code=status, code=code, message=message)


def _availability_response(
    workspace: Workspace,
    policy: AvailabilityPolicy,
    windows: list[AvailabilityWindow],
    blackouts: list[AvailabilityBlackout],
) -> AvailabilityResponse:
    return AvailabilityResponse(
        timezone=workspace.timezone,
        weekly_hours=[
            AvailabilityWindowInput(
                day_of_week=item.day_of_week,
                start_local=item.start_local,
                end_local=item.end_local,
            )
            for item in windows
        ],
        slot_interval_min=policy.slot_interval_min,
        buffer_before_min=policy.buffer_before_min,
        buffer_after_min=policy.buffer_after_min,
        minimum_notice_min=policy.minimum_notice_min,
        maximum_advance_days=policy.maximum_advance_days,
        blackouts=[
            AvailabilityBlackoutResponse(
                id=item.id,
                starts_at=item.starts_at,
                ends_at=item.ends_at,
                reason=item.reason,
            )
            for item in blackouts
        ],
        updated_at=max(workspace.updated_at, policy.updated_at),
    )


def _session_response(
    item: Session, series: SessionSeries | None
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
        id=item.id,
        series_id=item.series_id,
        service_id=item.service_id,
        calendar_owner_id=item.calendar_owner_id,
        start_at=item.start_at,
        end_at=item.end_at,
        capacity=item.capacity,
        status=item.status.value,
        location_type=item.location_type.value,
        location=item.location,
        address=Address.model_validate(item.address) if item.address else None,
        recurring=recurring,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _session_values(payload: SessionCreate | SessionPatch) -> dict[str, Any]:
    values = payload.model_dump(exclude_unset=True, exclude={"recurrence"})
    if "address" in payload.model_fields_set and payload.address is not None:
        values["address"] = payload.address.model_dump()
    if values.get("location_type") == "online":
        values["address"] = None
    return values


@availability_router.get("", response_model=AvailabilityResponse, operation_id="getAvailability")
async def get_availability(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> AvailabilityResponse:
    result = await SchedulingRepository(database).get_availability(operator.workspace_id)
    if result is None:
        raise _error(
            HTTPStatus.NOT_FOUND,
            "availability_not_found",
            "Availability settings were not found",
        )
    _private(response)
    return _availability_response(*result)


@availability_router.put(
    "", response_model=AvailabilityResponse, operation_id="replaceAvailability"
)
async def replace_availability(
    payload: AvailabilityUpdate,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> AvailabilityResponse:
    policy_fields = {
        "slot_interval_min",
        "buffer_before_min",
        "buffer_after_min",
        "minimum_notice_min",
        "maximum_advance_days",
    }
    result = await SchedulingRepository(database).replace_availability(
        operator.workspace_id,
        operator.user_id,
        timezone=payload.timezone,
        policy_values={name: getattr(payload, name) for name in policy_fields},
        windows=[item.model_dump() for item in payload.weekly_hours],
        blackouts=[item.model_dump() for item in payload.blackouts],
    )
    _private(response)
    return _availability_response(*result)


@sessions_router.get("", response_model=SessionListResponse, operation_id="listSessions")
async def list_sessions(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    starts_from: Annotated[datetime | None, Query(alias="startsFrom")] = None,
    starts_before: Annotated[datetime | None, Query(alias="startsBefore")] = None,
    service_id: Annotated[UUID | None, Query(alias="serviceId")] = None,
    calendar_owner_id: Annotated[UUID | None, Query(alias="calendarOwnerId")] = None,
    series_id: Annotated[UUID | None, Query(alias="seriesId")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SessionListResponse:
    items, total = await SchedulingRepository(database).list_sessions(
        operator.workspace_id,
        starts_from=starts_from,
        starts_before=starts_before,
        service_id=service_id,
        calendar_owner_id=calendar_owner_id,
        series_id=series_id,
        limit=limit,
        offset=offset,
    )
    _private(response)
    return SessionListResponse(
        items=[_session_response(item, series) for item, series in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@sessions_router.post(
    "",
    response_model=SchedulingSessionResponse,
    status_code=HTTPStatus.CREATED,
    operation_id="createSession",
)
async def create_session(
    payload: SessionCreate,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> SchedulingSessionResponse:
    values = _session_values(payload)
    values["calendar_owner_id"] = payload.calendar_owner_id or operator.user_id
    recurrence = payload.recurrence.model_dump() if payload.recurrence else None
    try:
        result = await SchedulingRepository(database).create_session(
            operator.workspace_id, operator.user_id, values, recurrence
        )
    except SessionConflictError as exc:
        raise _error(
            HTTPStatus.CONFLICT,
            "session_conflict",
            "The calendar owner already has a session during this time",
        ) from exc
    if result is None:
        raise _error(
            HTTPStatus.NOT_FOUND,
            "session_dependency_not_found",
            "The service or calendar owner was not found",
        )
    _private(response)
    return _session_response(*result)


@sessions_router.get(
    "/{session_id}", response_model=SchedulingSessionResponse, operation_id="getSession"
)
async def get_session(
    session_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> SchedulingSessionResponse:
    result = await SchedulingRepository(database).get_session(operator.workspace_id, session_id)
    if result is None:
        raise _error(HTTPStatus.NOT_FOUND, "session_not_found", "Session was not found")
    _private(response)
    return _session_response(*result)


@sessions_router.patch(
    "/{session_id}",
    response_model=SchedulingSessionResponse,
    operation_id="updateSession",
)
async def update_session(
    session_id: UUID,
    payload: SessionPatch,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    scope: Annotated[Literal["this", "this_and_following"], Query()] = "this",
) -> SchedulingSessionResponse:
    repository = SchedulingRepository(database)
    changes = _session_values(payload)
    try:
        result = (
            await repository.update_session(
                operator.workspace_id, operator.user_id, session_id, changes, scope
            )
            if changes
            else await repository.get_session(operator.workspace_id, session_id)
        )
    except SessionConflictError as exc:
        raise _error(
            HTTPStatus.CONFLICT,
            "session_conflict",
            "The calendar owner already has a session during this time",
        ) from exc
    except PastSessionImmutableError as exc:
        raise _error(
            HTTPStatus.CONFLICT,
            "past_session_immutable",
            "Past sessions cannot be changed",
        ) from exc
    if result is None:
        raise _error(HTTPStatus.NOT_FOUND, "session_not_found", "Session was not found")
    _private(response)
    return _session_response(*result)
