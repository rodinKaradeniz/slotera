import csv
import io
from collections.abc import AsyncIterator
from http import HTTPStatus
from typing import Annotated, Literal, cast
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Header, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.booking_emails import email_history
from slotera_api.booking_forms import BookingFormsResponse, read_forms
from slotera_api.bookings.repository import (
    BookingApprovalError,
    BookingAttendanceError,
    BookingCapacityExceededError,
    BookingIdempotencyConflictError,
    BookingMoveError,
    BookingPaymentError,
    BookingsRepository,
    BookingTransitionError,
)
from slotera_api.clients.repository import ClientEmailConflictError
from slotera_api.db.models import Booking, BookingAttendance, Session
from slotera_api.errors import ApiError
from slotera_api.packages.purchases import (
    PackageCreditUnavailableError,
    PackagePurchaseVoidedError,
)
from slotera_api.schemas.bookings import (
    BookingAttendanceCommand,
    BookingCustomerSnapshot,
    BookingDisplayContext,
    BookingEmailListResponse,
    BookingEmailSend,
    BookingListResponse,
    BookingMoveCommand,
    BookingResponse,
    BookingSummary,
    BookingSummaryPage,
    OperatorBookingCreate,
)
from slotera_api.schemas.operator_resources import Address

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
        email_contact=item.delivery_email_override or item.customer_email,
        language=cast(Literal["en", "tr", "de"], item.language),
        id=item.id,
        session_id=item.session_id,
        client_id=item.client_id,
        reference=item.reference,
        status=item.status.value,
        payment_status=item.payment_status.value,
        payment_method=cast(Literal["free", "manual", "package"], item.payment_method),
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
        package_purchase_id=item.package_purchase_id,
        package_position=item.package_position,
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
    if isinstance(error, BookingMoveError):
        return ApiError(
            status_code=HTTPStatus.CONFLICT,
            code="booking_move_target_invalid",
            message="Choose a different upcoming session of the same service",
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
    client_id: Annotated[UUID | None, Query(alias="clientId")] = None,
) -> BookingListResponse:
    items, total = await BookingsRepository(database).list_bookings(
        operator.workspace_id,
        limit=limit,
        offset=offset,
        session_id=session_id,
        client_id=client_id,
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
    except ClientEmailConflictError as exc:
        raise ApiError(
            status_code=409,
            code="client_email_conflict",
            message="A client with this email already exists. Select that client instead",
        ) from exc
    except (
        BookingCapacityExceededError,
        BookingIdempotencyConflictError,
        BookingTransitionError,
    ) as exc:
        raise _command_error(exc) from exc
    except PackageCreditUnavailableError as exc:
        raise ApiError(
            status_code=HTTPStatus.CONFLICT,
            code="package_credit_unavailable",
            message="This client's package has no session left for this service",
        ) from exc
    except PackagePurchaseVoidedError as exc:
        raise ApiError(
            status_code=HTTPStatus.CONFLICT,
            code="package_voided",
            message="This package was voided, so its sessions can't be booked",
        ) from exc
    if result is None:
        raise ApiError(
            status_code=HTTPStatus.NOT_FOUND,
            code="booking_dependency_not_found",
            message="The client or session was not found or is unavailable",
        )
    _private(response)
    return _response(result.booking)


@router.post("/{booking_id}/move", response_model=BookingResponse, operation_id="moveBooking")
async def move_booking(
    booking_id: UUID,
    payload: BookingMoveCommand,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: IdempotencyKey,
) -> BookingResponse:
    try:
        result = await BookingsRepository(database).move_booking(
            operator.workspace_id,
            operator.user_id,
            booking_id,
            payload.model_dump(),
            idempotency_key,
        )
    except (
        BookingCapacityExceededError,
        BookingIdempotencyConflictError,
        BookingMoveError,
        BookingTransitionError,
    ) as exc:
        raise _command_error(exc) from exc
    if result is None:
        raise _booking_not_found()
    _private(response)
    return _response(result.booking)


@router.get("/summaries", response_model=BookingSummaryPage, operation_id="listBookingSummaries")
async def list_booking_summaries(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
    search: Annotated[str, Query(max_length=160)] = "",
    status: Literal["pending", "confirmed", "completed", "noshow", "cancelled"] | None = None,
    client_id: Annotated[UUID | None, Query(alias="clientId")] = None,
    service_id: Annotated[UUID | None, Query(alias="serviceId")] = None,
    session_id: Annotated[UUID | None, Query(alias="sessionId")] = None,
    attendance_only: Annotated[bool, Query(alias="attendanceOnly")] = False,
) -> BookingSummaryPage:
    items, total, counts, previews, pending = await BookingsRepository(database).list_summaries(
        operator.workspace_id,
        limit=limit,
        offset=offset,
        search=search,
        status=status,
        client_id=client_id,
        service_id=service_id,
        session_id=session_id,
        attendance_only=attendance_only,
    )
    _private(response)
    return BookingSummaryPage(
        items=[BookingSummary.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
        status_counts=counts,
        status_previews={
            key: [BookingSummary.model_validate(row) for row in rows]
            for key, rows in previews.items()
        },
        pending_payment_count=pending,
    )


@router.get("/export.csv", operation_id="exportBookings")
async def export_bookings(
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    search: Annotated[str, Query(max_length=160)] = "",
    language: Literal["en", "tr", "de"] = "en",
    client_id: Annotated[UUID | None, Query(alias="clientId")] = None,
    service_id: Annotated[UUID | None, Query(alias="serviceId")] = None,
) -> StreamingResponse:
    async def content() -> AsyncIterator[str]:
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        headers = {
            "en": [
                "Reference",
                "Client",
                "Service",
                "Starts (UTC)",
                "Status",
                "Payment",
                "Amount",
                "Currency",
            ],
            "tr": [
                "Referans",
                "Müşteri",
                "Hizmet",
                "Başlangıç (UTC)",
                "Durum",
                "Ödeme",
                "Tutar",
                "Para birimi",
            ],
            "de": [
                "Referenz",
                "Kunde",
                "Leistung",
                "Beginn (UTC)",
                "Status",
                "Zahlung",
                "Betrag",
                "Währung",
            ],
        }
        writer.writerow(headers[language])
        yield "\ufeff" + buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)
        async for row in BookingsRepository(database).export_summaries(
            operator.workspace_id, search, client_id, service_id
        ):
            values = [
                row["reference"],
                row["name"],
                row["service_name"],
                row["start_at"].isoformat(),
                str(row["status"]),
                str(row["payment_status"]),
                f"{row['amount_cents'] / 100:.2f}",
                row["currency"],
            ]
            writer.writerow(
                [
                    "'" + value
                    if isinstance(value, str) and value.startswith(("=", "+", "-", "@", "\t", "\r"))
                    else value
                    for value in values
                ]
            )
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    return StreamingResponse(
        content(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": 'attachment; filename="bookings.csv"',
        },
    )


@router.get("/{booking_id}", response_model=BookingResponse, operation_id="getBooking")
async def get_booking(
    booking_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> BookingResponse:
    detail = await BookingsRepository(database).get_detail(operator.workspace_id, booking_id)
    if detail is None:
        raise _booking_not_found()
    booking, client, occurrence, service, series, booked_count, package = detail
    recurring: Literal["one-off", "weekly", "custom"] = "one-off"
    if series:
        weekday = occurrence.start_at.astimezone(ZoneInfo(series.timezone)).isoweekday()
        recurring = (
            "weekly" if series.interval_weeks == 1 and series.weekdays == [weekday] else "custom"
        )
    _private(response)
    result = _response(booking)
    result.context = BookingDisplayContext(
        client_name=client.name,
        client_email=client.email,
        service_id=service.id,
        service_name=service.name,
        start_at=occurrence.start_at,
        end_at=occurrence.end_at,
        capacity=occurrence.capacity,
        booked_count=booked_count,
        session_status=occurrence.status.value,
        location_type=occurrence.location_type.value,
        location=occurrence.location,
        address=Address.model_validate(occurrence.address) if occurrence.address else None,
        recurring=recurring,
        package_name=package[0] if package else None,
        package_size=package[1] if package else None,
    )
    return result


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
    return await _approval(booking_id, "approve", response, operator, database, idempotency_key)


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
    return await _approval(booking_id, "decline", response, operator, database, idempotency_key)


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


@router.get(
    "/{booking_id}/forms", response_model=BookingFormsResponse, operation_id="getBookingForms"
)
async def get_booking_forms(
    booking_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> BookingFormsResponse:
    async with database.tenant_transaction(operator.workspace_id) as session:
        booking = await session.scalar(
            select(Booking).where(
                Booking.workspace_id == operator.workspace_id, Booking.id == booking_id
            )
        )
        if booking is None:
            raise _booking_not_found()
        occurrence = await session.scalar(
            select(Session).where(
                Session.workspace_id == operator.workspace_id, Session.id == booking.session_id
            )
        )
        if occurrence is None:
            raise _booking_not_found()
        _private(response)
        return await read_forms(session, operator.workspace_id, booking, occurrence.start_at)


@router.get(
    "/{booking_id}/emails", response_model=BookingEmailListResponse, operation_id="getBookingEmails"
)
async def get_booking_emails(
    booking_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> BookingEmailListResponse:
    async with database.tenant_transaction(operator.workspace_id) as session:
        booking = await session.scalar(
            select(Booking.id).where(
                Booking.workspace_id == operator.workspace_id, Booking.id == booking_id
            )
        )
        if booking is None:
            raise _booking_not_found()
        result = await email_history(session, booking_id=booking_id, limit=limit, offset=offset)
    _private(response)
    return BookingEmailListResponse.model_validate(result)


@router.post(
    "/{booking_id}/send-details",
    response_model=BookingResponse,
    status_code=202,
    operation_id="sendBookingDetails",
)
async def send_booking_details(
    booking_id: UUID,
    payload: BookingEmailSend,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: IdempotencyKey,
) -> BookingResponse:
    try:
        result = await BookingsRepository(database).send_details(
            operator.workspace_id,
            operator.user_id,
            booking_id,
            str(payload.recipient_email),
            idempotency_key,
            expected_recipient_email=str(payload.expected_recipient_email),
        )
    except (BookingIdempotencyConflictError, BookingTransitionError) as exc:
        raise _command_error(exc) from exc
    if result is None:
        raise _booking_not_found()
    _private(response)
    return _response(result.booking)
