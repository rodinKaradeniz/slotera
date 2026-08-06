from http import HTTPStatus
from typing import Annotated, Literal, cast
from uuid import UUID

from fastapi import APIRouter, Header, Query, Response

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.bookings.repository import (
    BookingApprovalError,
    BookingAttendanceError,
    BookingCapacityExceededError,
    BookingIdempotencyConflictError,
    BookingPaymentError,
    BookingsRepository,
    BookingTransitionError,
)
from slotera_api.db.models import Booking, BookingAttendance
from slotera_api.errors import ApiError
from slotera_api.schemas.bookings import (
    BookingAttendanceCommand,
    BookingCustomerSnapshot,
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
    pending_reasons: list[Literal["approval", "payment"]] = []
    if item.approval_status.value == "pending":
        pending_reasons.append("approval")
    if item.payment_status.value == "pending":
        pending_reasons.append("payment")
    return BookingResponse(
        id=item.id,
        session_id=item.session_id,
        client_id=item.client_id,
        reference=item.reference,
        status=item.status.value,
        payment_status=item.payment_status.value,
        payment_method=cast(Literal["free", "manual"], item.payment_method),
        confirmation_policy=item.confirmation_policy_snapshot.value,
        approval_status=item.approval_status.value,
        pending_reasons=pending_reasons,
        attendance=item.attendance.value if item.attendance is not None else None,
        amount_cents=item.amount_cents,
        net_amount_cents=item.net_amount_cents,
        tax_amount_cents=item.tax_amount_cents,
        tax_treatment=cast(Literal["none", "fixed"], item.tax_treatment),
        tax_rate_bps=item.tax_rate_bps,
        tax_label=item.tax_label,
        tax_jurisdiction=item.tax_jurisdiction,
        seller_tax_number=item.seller_tax_number,
        currency=item.currency,
        payment_due_at=item.payment_due_at,
        payment_received_at=item.payment_received_at,
        approved_at=item.approved_at,
        declined_at=item.declined_at,
        customer=BookingCustomerSnapshot(
            first_name=item.customer_first_name,
            last_name=item.customer_last_name,
            email=item.customer_email,
            phone=item.customer_phone,
            company=item.customer_company,
        ),
        provider_terms_snapshot=item.provider_terms_snapshot,
        platform_terms_version=item.platform_terms_version,
        terms_accepted_at=item.terms_accepted_at,
        manual_payment_instructions_snapshot=item.manual_payment_instructions_snapshot,
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
    if isinstance(error, BookingAttendanceError):
        return ApiError(
            status_code=HTTPStatus.CONFLICT,
            code="booking_attendance_invalid",
            message=(
                "Attendance can only be recorded for confirmed or completed group-session bookings"
            ),
        )
    if isinstance(error, BookingApprovalError):
        return ApiError(
            status_code=HTTPStatus.CONFLICT,
            code="booking_approval_invalid",
            message="The booking is not awaiting an approval decision",
        )
    if isinstance(error, BookingPaymentError):
        return ApiError(
            status_code=HTTPStatus.CONFLICT,
            code="booking_payment_transition_invalid",
            message="Manual payment receipt cannot be recorded for this booking",
        )
    raise error


@router.get("", response_model=BookingListResponse, operation_id="listBookings")
async def list_bookings(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    session_id: Annotated[UUID | None, Query(alias="sessionId")] = None,
) -> BookingListResponse:
    items, total = await BookingsRepository(database).list_bookings(
        operator.workspace_id,
        limit=limit,
        offset=offset,
        session_id=session_id,
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


@router.post(
    "/{booking_id}/mark-payment-received",
    response_model=BookingResponse,
    operation_id="markBookingPaymentReceived",
)
async def mark_booking_payment_received(
    booking_id: UUID,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: IdempotencyKey,
) -> BookingResponse:
    try:
        result = await BookingsRepository(database).record_payment_received(
            operator.workspace_id,
            operator.user_id,
            booking_id,
            idempotency_key,
        )
    except (BookingIdempotencyConflictError, BookingPaymentError) as exc:
        raise _command_error(exc) from exc
    if result is None:
        raise _booking_not_found()
    _private(response)
    return _response(result.booking)


async def _approval(
    booking_id: UUID,
    command: Literal["approve", "decline"],
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: IdempotencyKey,
) -> BookingResponse:
    try:
        result = await BookingsRepository(database).set_approval(
            operator.workspace_id,
            operator.user_id,
            booking_id,
            command,
            idempotency_key,
        )
    except (BookingApprovalError, BookingIdempotencyConflictError) as exc:
        raise _command_error(exc) from exc
    if result is None:
        raise _booking_not_found()
    _private(response)
    return _response(result.booking)


@router.post(
    "/{booking_id}/approve",
    response_model=BookingResponse,
    operation_id="approveBooking",
)
async def approve_booking(
    booking_id: UUID,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: IdempotencyKey,
) -> BookingResponse:
    return await _approval(
        booking_id, "approve", response, operator, database, idempotency_key
    )


@router.post(
    "/{booking_id}/decline",
    response_model=BookingResponse,
    operation_id="declineBooking",
)
async def decline_booking(
    booking_id: UUID,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: IdempotencyKey,
) -> BookingResponse:
    return await _approval(
        booking_id, "decline", response, operator, database, idempotency_key
    )


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


@router.post(
    "/{booking_id}/attendance",
    response_model=BookingResponse,
    operation_id="recordBookingAttendance",
)
async def record_booking_attendance(
    booking_id: UUID,
    payload: BookingAttendanceCommand,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: IdempotencyKey,
) -> BookingResponse:
    try:
        result = await BookingsRepository(database).record_attendance(
            operator.workspace_id,
            operator.user_id,
            booking_id,
            BookingAttendance(payload.attendance),
            idempotency_key,
        )
    except (BookingAttendanceError, BookingIdempotencyConflictError) as exc:
        raise _command_error(exc) from exc
    if result is None:
        raise _booking_not_found()
    _private(response)
    return _response(result.booking)
