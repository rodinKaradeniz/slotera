"""Platform overview and inquiries, plus the public contact form that feeds them."""

from http import HTTPStatus
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Query, Request, Response

from slotera_api.auth.dependencies import (
    CsrfPlatformSuperadminDependency,
    DatabaseDependency,
    PlatformSuperadminDependency,
    SettingsDependency,
    require_trusted_origin,
)
from slotera_api.errors import ApiError
from slotera_api.platform.repository import PlatformRepository
from slotera_api.public_booking.repository import PublicBookingRepository
from slotera_api.schemas.platform import (
    PlatformInquiryListResponse,
    PlatformInquiryReadChange,
    PlatformInquiryResponse,
    PlatformOverviewResponse,
    PublicInquiryAccepted,
    PublicInquiryCreate,
    PublicPilotApplication,
)

platform_router = APIRouter(prefix="/platform", tags=["platform"])
public_inquiry_router = APIRouter(prefix="/public/inquiries", tags=["public"])
public_pilot_router = APIRouter(prefix="/public/pilot-applications", tags=["public"])


@platform_router.get(
    "/overview", response_model=PlatformOverviewResponse, operation_id="getPlatformOverview"
)
async def get_platform_overview(
    response: Response, superadmin: PlatformSuperadminDependency, database: DatabaseDependency
) -> PlatformOverviewResponse:
    overview = await PlatformRepository(database).overview(superadmin.user_id)
    if overview is None:
        raise ApiError(
            status_code=HTTPStatus.FORBIDDEN,
            code="platform_superadmin_required",
            message="A platform superadmin is required",
        )
    response.headers["Cache-Control"] = "no-store"
    return PlatformOverviewResponse(**overview.__dict__)


@platform_router.get(
    "/inquiries", response_model=PlatformInquiryListResponse, operation_id="listPlatformInquiries"
)
async def list_platform_inquiries(
    response: Response,
    superadmin: PlatformSuperadminDependency,
    database: DatabaseDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
    search: Annotated[str, Query(max_length=320)] = "",
    reason: Literal["", "business", "pilot", "development", "feature", "general"] = "",
    read: Literal["", "read", "unread"] = "",
) -> PlatformInquiryListResponse:
    items, total = await PlatformRepository(database).inquiry_page(
        superadmin.user_id, limit=limit, offset=offset, search=search, reason=reason, read=read
    )
    response.headers["Cache-Control"] = "no-store"
    return PlatformInquiryListResponse(
        items=[PlatformInquiryResponse(**item.__dict__) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@platform_router.get(
    "/inquiries/{inquiry_id}",
    response_model=PlatformInquiryResponse,
    operation_id="getPlatformInquiry",
)
async def get_inquiry(
    inquiry_id: UUID, superadmin: PlatformSuperadminDependency, database: DatabaseDependency
) -> PlatformInquiryResponse:
    items, _ = await PlatformRepository(database).inquiry_page(
        superadmin.user_id, limit=1, offset=0, inquiry_id=inquiry_id
    )
    if not items:
        raise ApiError(status_code=404, code="inquiry_not_found", message="Inquiry was not found")
    return PlatformInquiryResponse(**items[0].__dict__)


@platform_router.post(
    "/inquiries/{inquiry_id}/read",
    status_code=HTTPStatus.NO_CONTENT,
    response_class=Response,
    operation_id="setPlatformInquiryRead",
)
async def set_platform_inquiry_read(
    inquiry_id: UUID,
    payload: PlatformInquiryReadChange,
    superadmin: CsrfPlatformSuperadminDependency,
    database: DatabaseDependency,
) -> Response:
    result = await PlatformRepository(database).set_inquiry_read(
        actor_user_id=superadmin.user_id, inquiry_id=inquiry_id, read=payload.read
    )
    if result == "inquiry_not_found":
        raise ApiError(
            status_code=HTTPStatus.NOT_FOUND,
            code="platform_inquiry_not_found",
            message="Inquiry was not found",
        )
    if result != "updated":
        raise ApiError(
            status_code=HTTPStatus.FORBIDDEN,
            code="platform_superadmin_required",
            message="A platform superadmin is required",
        )
    return Response(status_code=HTTPStatus.NO_CONTENT, headers={"Cache-Control": "no-store"})


@public_inquiry_router.post(
    "",
    response_model=PublicInquiryAccepted,
    status_code=HTTPStatus.ACCEPTED,
    operation_id="createPublicInquiry",
)
async def create_public_inquiry(
    payload: PublicInquiryCreate,
    request: Request,
    database: DatabaseDependency,
    settings: SettingsDependency,
) -> PublicInquiryAccepted:
    require_trusted_origin(request, settings)
    client_key = request.client.host if request.client is not None else "unknown"
    if not await PublicBookingRepository(database).consume_rate_limit(
        scope="public_inquiry", key=client_key, limit=5, window_seconds=3600
    ):
        raise ApiError(
            status_code=HTTPStatus.TOO_MANY_REQUESTS,
            code="rate_limit_exceeded",
            message="Too many messages. Please try again later",
        )
    await PlatformRepository(database).create_inquiry(
        name=payload.name,
        email=str(payload.email),
        company=payload.company,
        reason=payload.reason,
        message=payload.message,
    )
    return PublicInquiryAccepted()


_VOLUME_LABEL = {
    "under_20": "under 20",
    "20_50": "20–50",
    "50_150": "50–150",
    "over_150": "over 150",
}


@public_pilot_router.post(
    "",
    response_model=PublicInquiryAccepted,
    status_code=HTTPStatus.ACCEPTED,
    operation_id="createPilotApplication",
)
async def create_pilot_application(
    payload: PublicPilotApplication,
    request: Request,
    database: DatabaseDependency,
    settings: SettingsDependency,
) -> PublicInquiryAccepted:
    """The pilot waitlist. No confirmation email: a public form that mails any address it
    is given can be abused, so the page shows the success state instead."""
    require_trusted_origin(request, settings)
    client_key = request.client.host if request.client is not None else "unknown"
    if not await PublicBookingRepository(database).consume_rate_limit(
        scope="pilot_application", key=client_key, limit=5, window_seconds=3600
    ):
        raise ApiError(
            status_code=HTTPStatus.TOO_MANY_REQUESTS,
            code="rate_limit_exceeded",
            message="Too many applications. Please try again later",
        )
    lines = [
        f"Business type: {payload.business_type}",
        f"Country: {payload.country}",
        f"Bookings per month: {_VOLUME_LABEL[payload.bookings_per_month]}",
        f"WhatsApp interest: {'yes' if payload.whatsapp_interest else 'no'}",
    ]
    if payload.message.strip():
        lines += ["", payload.message.strip()]
    await PlatformRepository(database).create_inquiry(
        name=payload.name,
        email=str(payload.email),
        company=payload.business_name,
        reason="pilot",
        message="\n".join(lines),
    )
    return PublicInquiryAccepted()
