"""Platform overview and inquiries, plus the public contact form that feeds them."""

from http import HTTPStatus
from uuid import UUID

from fastapi import APIRouter, Request, Response

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
)

platform_router = APIRouter(prefix="/platform", tags=["platform"])
public_inquiry_router = APIRouter(prefix="/public/inquiries", tags=["public"])


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
    response: Response, superadmin: PlatformSuperadminDependency, database: DatabaseDependency
) -> PlatformInquiryListResponse:
    items = await PlatformRepository(database).list_inquiries(superadmin.user_id)
    response.headers["Cache-Control"] = "no-store"
    return PlatformInquiryListResponse(
        items=[PlatformInquiryResponse(**item.__dict__) for item in items]
    )


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
