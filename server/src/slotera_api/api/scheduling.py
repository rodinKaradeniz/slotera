from datetime import datetime
from http import HTTPStatus
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Header, Query, Response
from sqlalchemy.exc import IntegrityError

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.db.models import (
    AvailabilityBlackout,
    AvailabilityPolicy,
    AvailabilityWindow,
    Workspace,
)
from slotera_api.editing import ExpectedVersionDependency
from slotera_api.errors import ApiError
from slotera_api.scheduling.commands import SessionCommands
from slotera_api.scheduling.projection import session_response as _session_response
from slotera_api.scheduling.repository import (
    SchedulingRepository,
    SessionConflictError,
    _is_exclusion_violation,
)
from slotera_api.schemas.scheduling import (
    AvailabilityBlackoutResponse,
    AvailabilityResponse,
    AvailabilityUpdate,
    AvailabilityWindowInput,
    SchedulingSessionResponse,
    SessionCreate,
    SessionImpactResponse,
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
    version: int,
) -> AvailabilityResponse:
    return AvailabilityResponse(
        version=version,
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
        customer_change_notice_hours=policy.customer_change_notice_hours,
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
    expected_version: ExpectedVersionDependency,
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
        expected_version=expected_version,
        timezone=payload.timezone,
        policy_values={
            **{name: getattr(payload, name) for name in policy_fields},
            **(
                {"customer_change_notice_hours": payload.customer_change_notice_hours}
                if payload.customer_change_notice_hours is not None
                else {}
            ),
        },
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
    bookable: bool = False,
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
        bookable=bookable,
        limit=limit,
        offset=offset,
    )
    counts = await SchedulingRepository(database).booking_counts(
        operator.workspace_id, [item.id for item, _ in items]
    )
    _private(response)
    return SessionListResponse(
        items=[_session_response(item, series, counts.get(item.id, 0)) for item, series in items],
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
    counts = await SchedulingRepository(database).booking_counts(
        operator.workspace_id, [session_id]
    )
    _private(response)
    return _session_response(*result, booked_count=counts.get(session_id, 0))


@sessions_router.get(
    "/{session_id}/change-preview",
    response_model=SessionImpactResponse,
    operation_id="previewSessionChange",
)
async def preview_session_change(
    session_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    scope: Annotated[Literal["this", "this_and_following"], Query()] = "this",
) -> SessionImpactResponse:
    impact = await SessionCommands(database).preview(operator.workspace_id, session_id, scope)
    _private(response)
    return SessionImpactResponse(
        session_count=impact.session_count,
        active_booking_count=impact.active_booking_count,
        paid_booking_count=impact.paid_booking_count,
        revision=impact.revision,
    )


@sessions_router.patch(
    "/{session_id}", response_model=SchedulingSessionResponse, operation_id="updateSession"
)
async def update_session(
    expected_version: ExpectedVersionDependency,
    session_id: UUID,
    payload: SessionPatch,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    impact_revision: Annotated[
        str, Header(alias="X-Impact-Revision", min_length=64, max_length=64)
    ],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=255)],
    scope: Annotated[Literal["this", "this_and_following"], Query()] = "this",
    series_version: Annotated[int | None, Header(alias="X-Series-Version", ge=1)] = None,
) -> SchedulingSessionResponse:
    try:
        result = await SessionCommands(database).apply(
            operator.workspace_id,
            operator.user_id,
            session_id,
            _session_values(payload),
            scope,
            expected_version,
            series_version,
            impact_revision,
            idempotency_key,
        )
    except IntegrityError as exc:
        if _is_exclusion_violation(exc):
            raise _error(
                HTTPStatus.CONFLICT,
                "session_conflict",
                "The calendar owner already has a session during this time",
            ) from exc
        raise
    _private(response)
    return result


@sessions_router.post(
    "/{session_id}/cancel", response_model=SchedulingSessionResponse, operation_id="cancelSession"
)
async def cancel_session(
    expected_version: ExpectedVersionDependency,
    session_id: UUID,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    impact_revision: Annotated[
        str, Header(alias="X-Impact-Revision", min_length=64, max_length=64)
    ],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=255)],
    scope: Annotated[Literal["this", "this_and_following"], Query()] = "this",
    series_version: Annotated[int | None, Header(alias="X-Series-Version", ge=1)] = None,
) -> SchedulingSessionResponse:
    result = await SessionCommands(database).apply(
        operator.workspace_id,
        operator.user_id,
        session_id,
        {},
        scope,
        expected_version,
        series_version,
        impact_revision,
        idempotency_key,
        cancel=True,
    )
    _private(response)
    return result
