from http import HTTPStatus
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, Query, Response

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.bookings.repository import (
    BookingCapacityExceededError,
    BookingIdempotencyConflictError,
    BookingsRepository,
    BookingTransitionError,
)
from slotera_api.db.models import Booking
from slotera_api.errors import ApiError
from slotera_api.schemas.bookings import (
    BookingListResponse,
    BookingResponse,
    OperatorBookingCreate,
)

router = APIRouter(prefix="/bookings", tags=["bookings"])

IdempotencyKey = Annotated[
    str,
    Header(alias="Idempotency-Key", min_length=1, max_length=255),
]


def _response(item: Booking) -> BookingResponse:
    return BookingResponse(
        id=item.id,
        session_id=item.session_id,
        client_id=item.client_id,
        status=item.status.value,
        payment_status=item.payment_status.value,
        amount_cents=item.amount_cents,
        currency=item.currency,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _booking_not_found() -> ApiError:
    return ApiError(
        status_code=HTTPStatus.NOT_FOUND,
        code="booking_not_found",
        message="Booking was not found",
    )


def _command_error(error: Exception) -> ApiError:
    if isinstance(error, BookingCapacityExceededError):
        return ApiError(
            status_code=HTTPStatus.CONFLICT,
            code="booking_capacity_exceeded",
            message="The session no longer has capacity for another booking",
        )
    if isinstance(error, BookingIdempotencyConflictError):
        return ApiError(
            status_code=HTTPStatus.CONFLICT,
            code="idempotency_key_reused",
            message="The idempotency key was already used for a different booking command",
        )
    if isinstance(error, BookingTransitionError):
        return ApiError(
            status_code=HTTPStatus.CONFLICT,
            code="booking_transition_invalid",
            message="The booking cannot make that status transition",
        )
    raise error


@router.get("", response_model=BookingListResponse, operation_id="listBookings")
async def list_bookings(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> BookingListResponse:
    items, total = await BookingsRepository(database).list_bookings(
        operator.workspace_id, limit=limit, offset=offset
    )
    _private(response)
    return BookingListResponse(
        items=[_response(item) for item in items], total=total, limit=limit, offset=offset
    )


@router.post(
    "",
    response_model=BookingResponse,
    status_code=HTTPStatus.CREATED,
    operation_id="createOperatorBooking",
)
async def create_operator_booking(
    payload: OperatorBookingCreate,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: IdempotencyKey,
) -> BookingResponse:
    try:
        result = await BookingsRepository(database).create_operator_booking(
            operator.workspace_id,
            operator.user_id,
            payload.model_dump(),
            idempotency_key,
        )
    except (
        BookingCapacityExceededError,
        BookingIdempotencyConflictError,
        BookingTransitionError,
    ) as exc:
        raise _command_error(exc) from exc
    if result is None:
        raise ApiError(
            status_code=HTTPStatus.NOT_FOUND,
            code="booking_dependency_not_found",
            message="The client or session was not found or is unavailable",
        )
    _private(response)
    return _response(result.booking)


@router.get("/{booking_id}", response_model=BookingResponse, operation_id="getBooking")
async def get_booking(
    booking_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> BookingResponse:
    booking = await BookingsRepository(database).get_booking(operator.workspace_id, booking_id)
    if booking is None:
        raise _booking_not_found()
    _private(response)
    return _response(booking)


async def _transition(
    booking_id: UUID,
    command: str,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: IdempotencyKey,
) -> BookingResponse:
    try:
        result = await BookingsRepository(database).transition_booking(
            operator.workspace_id,
            operator.user_id,
            booking_id,
            command,
            idempotency_key,
        )
    except (
        BookingCapacityExceededError,
        BookingIdempotencyConflictError,
        BookingTransitionError,
    ) as exc:
        raise _command_error(exc) from exc
    if result is None:
        raise _booking_not_found()
    _private(response)
    return _response(result.booking)


@router.post("/{booking_id}/confirm", response_model=BookingResponse, operation_id="confirmBooking")
async def confirm_booking(
    booking_id: UUID,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: IdempotencyKey,
) -> BookingResponse:
    return await _transition(booking_id, "confirm", response, operator, database, idempotency_key)


@router.post("/{booking_id}/cancel", response_model=BookingResponse, operation_id="cancelBooking")
async def cancel_booking(
    booking_id: UUID,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: IdempotencyKey,
) -> BookingResponse:
    return await _transition(booking_id, "cancel", response, operator, database, idempotency_key)


@router.post(
    "/{booking_id}/complete",
    response_model=BookingResponse,
    operation_id="completeBooking",
)
async def complete_booking(
    booking_id: UUID,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: IdempotencyKey,
) -> BookingResponse:
    return await _transition(booking_id, "complete", response, operator, database, idempotency_key)


@router.post(
    "/{booking_id}/noshow",
    response_model=BookingResponse,
    operation_id="markBookingNoshow",
)
async def mark_booking_noshow(
    booking_id: UUID,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: IdempotencyKey,
) -> BookingResponse:
    return await _transition(booking_id, "noshow", response, operator, database, idempotency_key)
