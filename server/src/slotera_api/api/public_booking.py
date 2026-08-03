from datetime import date
from http import HTTPStatus
from typing import Annotated, Literal, cast
from uuid import UUID

from fastapi import APIRouter, Header, Query, Request, Response
from sqlalchemy.exc import IntegrityError

from slotera_api.auth.dependencies import (
    DatabaseDependency,
    SettingsDependency,
    require_trusted_origin,
)
from slotera_api.errors import ApiError
from slotera_api.public_booking.repository import (
    PublicBookingIdempotencyConflictError,
    PublicBookingRepository,
    PublicFormValidationError,
    PublicPaymentMethodError,
    PublicServiceNotFoundError,
    PublicSlotUnavailableError,
    PublicWorkspaceContext,
    PublicWorkspaceNotFoundError,
    TaxQuote,
    quote_for,
)
from slotera_api.schemas.forms import FormFieldInput
from slotera_api.schemas.public_booking import (
    PublicAvailabilityResponse,
    PublicAvailabilitySlot,
    PublicBookingCreate,
    PublicBookingResponse,
    PublicFormListResponse,
    PublicFormResponse,
    PublicServiceListResponse,
    PublicServiceResponse,
    PublicTaxQuote,
    PublicWorkspaceResponse,
)

router = APIRouter(prefix="/public/workspaces/{workspace_slug}", tags=["public-booking"])
IdempotencyKey = Annotated[str, Header(alias="Idempotency-Key", min_length=8, max_length=255)]


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _not_found() -> ApiError:
    return ApiError(
        status_code=HTTPStatus.NOT_FOUND,
        code="public_booking_resource_not_found",
        message="The booking page or service was not found",
    )


def _tax_response(quote: TaxQuote) -> PublicTaxQuote:
    return PublicTaxQuote(
        treatment=cast(Literal["none", "fixed"], quote.treatment),
        rate_bps=quote.rate_bps,
        label=quote.label,
        jurisdiction=quote.jurisdiction,
        gross_amount_cents=quote.gross_amount_cents,
        net_amount_cents=quote.net_amount_cents,
        tax_amount_cents=quote.tax_amount_cents,
        currency=quote.currency,
    )


def _workspace_response(context: PublicWorkspaceContext) -> PublicWorkspaceResponse:
    return PublicWorkspaceResponse(
        slug=context.workspace.slug,
        display_name=context.profile.display_name,
        bio=context.profile.bio,
        email=context.profile.email,
        address=context.profile.address,
        currency=context.workspace.currency,
        timezone=context.workspace.timezone,
        manual_payment_enabled=context.payments.manual_payment_enabled,
        manual_payment_instructions=context.payments.manual_payment_instructions,
        booking_terms_enabled=context.payments.booking_terms_enabled,
        booking_terms_content=context.payments.booking_terms_content,
    )


async def _workspace_id(repository: PublicBookingRepository, slug: str) -> UUID:
    try:
        return await repository.resolve_workspace_id(slug)
    except PublicWorkspaceNotFoundError as exc:
        raise _not_found() from exc


@router.get("", response_model=PublicWorkspaceResponse, operation_id="getPublicWorkspace")
async def get_public_workspace(
    workspace_slug: str, response: Response, database: DatabaseDependency
) -> PublicWorkspaceResponse:
    repository = PublicBookingRepository(database)
    workspace_id = await _workspace_id(repository, workspace_slug)
    try:
        context = await repository.get_workspace(workspace_id)
    except PublicWorkspaceNotFoundError as exc:
        raise _not_found() from exc
    _no_store(response)
    return _workspace_response(context)


@router.get(
    "/services", response_model=PublicServiceListResponse, operation_id="listPublicServices"
)
async def list_public_services(
    workspace_slug: str, response: Response, database: DatabaseDependency
) -> PublicServiceListResponse:
    repository = PublicBookingRepository(database)
    workspace_id = await _workspace_id(repository, workspace_slug)
    try:
        services, context = await repository.list_services(workspace_id)
    except PublicWorkspaceNotFoundError as exc:
        raise _not_found() from exc
    _no_store(response)
    return PublicServiceListResponse(
        items=[
            PublicServiceResponse(
                id=item.id,
                name=item.name,
                description=item.description,
                duration_min=item.duration_min,
                capacity=item.capacity,
                location_type=item.location_type.value,
                location=item.location,
                cancellation_rule=item.cancellation_rule,
                quote=_tax_response(quote_for(item, context.workspace, context.payments)),
            )
            for item in services
        ]
    )


@router.get(
    "/services/{service_id}/forms",
    response_model=PublicFormListResponse,
    operation_id="listPublicServiceForms",
)
async def list_public_service_forms(
    workspace_slug: str,
    service_id: UUID,
    response: Response,
    database: DatabaseDependency,
) -> PublicFormListResponse:
    repository = PublicBookingRepository(database)
    workspace_id = await _workspace_id(repository, workspace_slug)
    try:
        forms = await repository.list_forms(workspace_id, service_id)
    except (PublicWorkspaceNotFoundError, PublicServiceNotFoundError) as exc:
        raise _not_found() from exc
    _no_store(response)
    return PublicFormListResponse(
        items=[
            PublicFormResponse(
                id=item.id,
                name=item.name,
                description=item.description,
                fields=[FormFieldInput.model_validate(field) for field in item.fields],
                required_before_payment=item.required_before_payment,
            )
            for item in forms
        ]
    )


@router.get(
    "/services/{service_id}/availability",
    response_model=PublicAvailabilityResponse,
    operation_id="listPublicAvailability",
)
async def list_public_availability(
    workspace_slug: str,
    service_id: UUID,
    response: Response,
    database: DatabaseDependency,
    starts_on: Annotated[date, Query(alias="from")],
    ends_on: Annotated[date, Query(alias="to")],
) -> PublicAvailabilityResponse:
    if ends_on < starts_on or (ends_on - starts_on).days > 31:
        raise ApiError(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            code="availability_range_invalid",
            message="Availability range must be between 1 and 32 days",
        )
    repository = PublicBookingRepository(database)
    workspace_id = await _workspace_id(repository, workspace_slug)
    try:
        timezone, slots = await repository.list_availability(
            workspace_id, service_id, starts_on=starts_on, ends_on=ends_on
        )
    except (PublicWorkspaceNotFoundError, PublicServiceNotFoundError) as exc:
        raise _not_found() from exc
    _no_store(response)
    return PublicAvailabilityResponse(
        timezone=timezone,
        items=[
            PublicAvailabilitySlot(start_at=item.start_at, end_at=item.end_at) for item in slots
        ],
    )


@router.post(
    "/bookings",
    response_model=PublicBookingResponse,
    status_code=HTTPStatus.CREATED,
    operation_id="createPublicBooking",
)
async def create_public_booking(
    workspace_slug: str,
    payload: PublicBookingCreate,
    request: Request,
    response: Response,
    database: DatabaseDependency,
    settings: SettingsDependency,
    idempotency_key: IdempotencyKey,
) -> PublicBookingResponse:
    require_trusted_origin(request, settings)
    repository = PublicBookingRepository(database)
    client_key = request.client.host if request.client is not None else "unknown"
    if not await repository.consume_rate_limit(
        scope="public_booking_create",
        key=f"{workspace_slug}:{client_key}",
        limit=20,
        window_seconds=3600,
    ):
        raise ApiError(
            status_code=HTTPStatus.TOO_MANY_REQUESTS,
            code="rate_limit_exceeded",
            message="Too many booking attempts. Please try again later",
        )
    workspace_id = await _workspace_id(repository, workspace_slug)
    try:
        result = await repository.create_booking(
            workspace_id, idempotency_key=idempotency_key, values=payload.model_dump()
        )
    except (PublicWorkspaceNotFoundError, PublicServiceNotFoundError) as exc:
        raise _not_found() from exc
    except (PublicSlotUnavailableError, IntegrityError) as exc:
        raise ApiError(
            status_code=HTTPStatus.CONFLICT,
            code="public_slot_unavailable",
            message="That time is no longer available",
        ) from exc
    except PublicBookingIdempotencyConflictError as exc:
        raise ApiError(
            status_code=HTTPStatus.CONFLICT,
            code="idempotency_key_reused",
            message="The idempotency key was already used for another booking",
        ) from exc
    except (PublicPaymentMethodError, PublicFormValidationError) as exc:
        raise ApiError(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            code="public_booking_invalid",
            message="The booking details are not valid",
        ) from exc
    _no_store(response)
    if result.replayed:
        response.status_code = HTTPStatus.OK
    return PublicBookingResponse(
        id=result.booking.id,
        reference=result.booking.reference,
        status=cast(
            Literal["pending", "confirmed", "cancelled"],
            result.booking.status.value,
        ),
        payment_status=cast(
            Literal["pending", "free", "overdue"],
            result.booking.payment_status.value,
        ),
        payment_method=cast(Literal["free", "manual"], result.booking.payment_method),
        session_start_at=result.session.start_at,
        session_end_at=result.session.end_at,
        payment_due_at=result.booking.payment_due_at,
        quote=_tax_response(result.quote),
    )
