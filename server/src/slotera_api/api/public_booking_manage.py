from http import HTTPStatus
from typing import Annotated, Literal, cast

from fastapi import APIRouter, Header, Request, Response
from sqlalchemy.exc import IntegrityError

from slotera_api.auth.dependencies import (
    DatabaseDependency,
    SettingsDependency,
    require_trusted_origin,
)
from slotera_api.errors import ApiError
from slotera_api.public_booking.manage import (
    BookingLinkInvalidError,
    BookingManageRepository,
    CustomerChangeClosedError,
    ManagedBooking,
    pending_reasons,
)
from slotera_api.public_booking.repository import (
    PublicBookingRepository,
    PublicSlotUnavailableError,
)
from slotera_api.schemas.operator_resources import Address
from slotera_api.schemas.public_booking import ManagedBookingReschedule, ManagedBookingResponse

router = APIRouter(prefix="/public/bookings/manage", tags=["public-booking"])

# The token comes from the link's URL fragment and is sent as a header, so it never
# appears in a URL that servers or proxies log.
BookingToken = Annotated[str, Header(alias="X-Booking-Token", min_length=32, max_length=256)]


def _response(managed: ManagedBooking) -> ManagedBookingResponse:
    booking, session = managed.booking, managed.session
    return ManagedBookingResponse(
        reference=booking.reference,
        status=booking.status.value,
        payment_status=booking.payment_status.value,
        payment_method=cast(Literal["free", "manual"], booking.payment_method),
        approval_status=booking.approval_status.value,
        pending_reasons=pending_reasons(booking),
        amount_cents=booking.amount_cents,
        currency=booking.currency,
        payment_due_at=booking.payment_due_at,
        manual_payment_instructions=(
            booking.manual_payment_instructions_snapshot
            if booking.payment_status.value == "pending"
            else ""
        ),
        service_id=managed.service.id,
        service_name=managed.service.name,
        cancellation_rule=managed.service.cancellation_rule,
        provider_name=managed.profile.display_name,
        provider_email=managed.profile.email,
        provider_phone=managed.profile.phone,
        workspace_slug=managed.workspace.slug,
        timezone=managed.workspace.timezone,
        session_start_at=session.start_at,
        session_end_at=session.end_at,
        session_location_type=session.location_type.value,
        session_location=session.location,
        session_address=Address.model_validate(session.address) if session.address else None,
        change_deadline=managed.change_deadline,
        can_cancel=managed.can_cancel,
        can_reschedule=managed.can_reschedule,
        rescheduled=booking.customer_rescheduled_at is not None,
    )


async def _limit(request: Request, database: DatabaseDependency, scope: str) -> None:
    client_key = request.client.host if request.client is not None else "unknown"
    if not await PublicBookingRepository(database).consume_rate_limit(
        scope=scope, key=client_key, limit=30, window_seconds=3600
    ):
        raise ApiError(
            status_code=HTTPStatus.TOO_MANY_REQUESTS,
            code="rate_limit_exceeded",
            message="Too many attempts. Please try again later",
        )


def _link_invalid() -> ApiError:
    return ApiError(
        status_code=HTTPStatus.NOT_FOUND,
        code="booking_link_invalid",
        message="This booking link is invalid or has expired",
    )


def _change_closed() -> ApiError:
    return ApiError(
        status_code=HTTPStatus.CONFLICT,
        code="customer_change_window_closed",
        message="This booking can no longer be changed online. Please contact the provider",
    )


@router.get("", response_model=ManagedBookingResponse, operation_id="getManagedBooking")
async def get_managed_booking(
    token: BookingToken, request: Request, response: Response, database: DatabaseDependency
) -> ManagedBookingResponse:
    await _limit(request, database, "public_booking_manage_read")
    try:
        managed = await BookingManageRepository(database).get(token)
    except BookingLinkInvalidError as exc:
        raise _link_invalid() from exc
    response.headers["Cache-Control"] = "no-store"
    return _response(managed)


@router.post("/cancel", response_model=ManagedBookingResponse, operation_id="cancelManagedBooking")
async def cancel_managed_booking(
    token: BookingToken,
    request: Request,
    response: Response,
    database: DatabaseDependency,
    settings: SettingsDependency,
) -> ManagedBookingResponse:
    require_trusted_origin(request, settings)
    await _limit(request, database, "public_booking_manage_change")
    try:
        managed = await BookingManageRepository(database).cancel(token)
    except BookingLinkInvalidError as exc:
        raise _link_invalid() from exc
    except CustomerChangeClosedError as exc:
        raise _change_closed() from exc
    response.headers["Cache-Control"] = "no-store"
    return _response(managed)


@router.post(
    "/reschedule",
    response_model=ManagedBookingResponse,
    operation_id="rescheduleManagedBooking",
)
async def reschedule_managed_booking(
    token: BookingToken,
    payload: ManagedBookingReschedule,
    request: Request,
    response: Response,
    database: DatabaseDependency,
    settings: SettingsDependency,
) -> ManagedBookingResponse:
    require_trusted_origin(request, settings)
    await _limit(request, database, "public_booking_manage_change")
    try:
        managed = await BookingManageRepository(database).reschedule(token, payload.start_at)
    except BookingLinkInvalidError as exc:
        raise _link_invalid() from exc
    except CustomerChangeClosedError as exc:
        raise _change_closed() from exc
    except (PublicSlotUnavailableError, IntegrityError) as exc:
        raise ApiError(
            status_code=HTTPStatus.CONFLICT,
            code="public_slot_unavailable",
            message="That time is no longer available",
        ) from exc
    response.headers["Cache-Control"] = "no-store"
    return _response(managed)
