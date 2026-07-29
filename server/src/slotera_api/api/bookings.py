from http import HTTPStatus
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response

from slotera_api.auth.dependencies import DatabaseDependency, OperatorWorkspaceDependency
from slotera_api.bookings.repository import BookingsRepository
from slotera_api.db.models import Booking
from slotera_api.errors import ApiError
from slotera_api.schemas.bookings import BookingListResponse, BookingResponse

router = APIRouter(prefix="/bookings", tags=["bookings"])


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


@router.get("/{booking_id}", response_model=BookingResponse, operation_id="getBooking")
async def get_booking(
    booking_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> BookingResponse:
    booking = await BookingsRepository(database).get_booking(operator.workspace_id, booking_id)
    if booking is None:
        raise ApiError(
            status_code=HTTPStatus.NOT_FOUND,
            code="booking_not_found",
            message="Booking was not found",
        )
    _private(response)
    return _response(booking)
