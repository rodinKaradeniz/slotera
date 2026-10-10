"""Settings → Calendar subscribe link, and the public feed calendar apps fetch."""

from datetime import datetime
from http import HTTPStatus

from fastapi import APIRouter, Request, Response

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
    SettingsDependency,
)
from slotera_api.calendar_feed import CalendarFeedRepository, feed_path
from slotera_api.calendar_ics import build_calendar
from slotera_api.errors import ApiError
from slotera_api.identity import hash_opaque_token
from slotera_api.public_booking.repository import PublicBookingRepository
from slotera_api.schemas.base import ApiModel

settings_router = APIRouter(prefix="/settings/calendar-feed", tags=["settings"])
public_router = APIRouter(prefix="/calendar/feed", tags=["public"])


class CalendarFeedStatus(ApiModel):
    active: bool
    created_at: datetime | None


class CalendarFeedLink(ApiModel):
    """The subscribe URL. It is shown once; only its hash is stored."""

    url: str


@settings_router.get("", response_model=CalendarFeedStatus, operation_id="getCalendarFeed")
async def get_calendar_feed(
    response: Response, operator: OperatorWorkspaceDependency, database: DatabaseDependency
) -> CalendarFeedStatus:
    created_at = await CalendarFeedRepository(database).created_at(
        workspace_id=operator.workspace_id, user_id=operator.user_id
    )
    response.headers["Cache-Control"] = "no-store"
    return CalendarFeedStatus(active=created_at is not None, created_at=created_at)


@settings_router.post(
    "",
    response_model=CalendarFeedLink,
    status_code=HTTPStatus.CREATED,
    operation_id="createCalendarFeed",
)
async def create_calendar_feed(
    request: Request,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> CalendarFeedLink:
    """Create a subscribe link, revoking any earlier one."""
    token = await CalendarFeedRepository(database).rotate(
        workspace_id=operator.workspace_id, user_id=operator.user_id
    )
    response.headers["Cache-Control"] = "no-store"
    return CalendarFeedLink(url=f"{str(request.base_url).rstrip('/')}{feed_path(token)}")


@settings_router.delete("", status_code=HTTPStatus.NO_CONTENT, operation_id="revokeCalendarFeed")
async def revoke_calendar_feed(
    operator: CsrfOperatorWorkspaceDependency, database: DatabaseDependency
) -> Response:
    await CalendarFeedRepository(database).revoke(
        workspace_id=operator.workspace_id, user_id=operator.user_id
    )
    return Response(status_code=HTTPStatus.NO_CONTENT, headers={"Cache-Control": "no-store"})


@public_router.get(
    "/{token}.ics",
    response_class=Response,
    operation_id="getCalendarFeedIcs",
    include_in_schema=False,
)
async def calendar_feed_ics(
    token: str, database: DatabaseDependency, settings: SettingsDependency
) -> Response:
    not_found = ApiError(
        status_code=HTTPStatus.NOT_FOUND, code="not_found", message="Calendar feed was not found"
    )
    if not 32 <= len(token) <= 256:
        raise not_found
    if not await PublicBookingRepository(database).consume_rate_limit(
        scope="calendar_feed",
        key=hash_opaque_token(token).hex()[:32],
        limit=120,
        window_seconds=3600,
    ):
        raise ApiError(
            status_code=HTTPStatus.TOO_MANY_REQUESTS,
            code="rate_limit_exceeded",
            message="Too many requests for this calendar feed",
        )
    repository = CalendarFeedRepository(database)
    workspace_id = await repository.resolve(token)
    if workspace_id is None:
        raise not_found
    feed = await repository.feed(workspace_id, web_base_url=settings.public_web_base_url)
    return Response(
        content=build_calendar(feed.events, name=feed.name),
        media_type="text/calendar; charset=utf-8",
        headers={"Cache-Control": "private, max-age=300"},
    )
