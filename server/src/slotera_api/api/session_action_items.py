from http import HTTPStatus
from uuid import UUID

from fastapi import APIRouter, Response

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.db.models import SessionActionItem
from slotera_api.errors import ApiError
from slotera_api.schemas.session_action_items import (
    SessionActionItemCreate,
    SessionActionItemListResponse,
    SessionActionItemPatch,
    SessionActionItemResponse,
)
from slotera_api.session_action_items.repository import SessionActionItemsRepository

router = APIRouter(tags=["session action items"])


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _item_response(item: SessionActionItem) -> SessionActionItemResponse:
    return SessionActionItemResponse(
        id=item.id,
        session_id=item.session_id,
        title=item.title,
        description=item.description,
        status=item.status.value,
        due_date=item.due_date,
        client_visible=item.client_visible,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _session_not_found() -> ApiError:
    return ApiError(
        status_code=HTTPStatus.NOT_FOUND,
        code="session_not_found",
        message="Session was not found",
    )


def _item_not_found() -> ApiError:
    return ApiError(
        status_code=HTTPStatus.NOT_FOUND,
        code="session_action_item_not_found",
        message="Session action item was not found",
    )


@router.get(
    "/sessions/{session_id}/action-items",
    response_model=SessionActionItemListResponse,
    operation_id="listSessionActionItems",
)
async def list_session_action_items(
    session_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> SessionActionItemListResponse:
    result = await SessionActionItemsRepository(database).list_items(
        operator.workspace_id, session_id
    )
    if result is None:
        raise _session_not_found()
    items, total = result
    _private(response)
    return SessionActionItemListResponse(
        items=[_item_response(item) for item in items], total=total
    )


@router.post(
    "/sessions/{session_id}/action-items",
    response_model=SessionActionItemResponse,
    status_code=HTTPStatus.CREATED,
    operation_id="createSessionActionItem",
)
async def create_session_action_item(
    session_id: UUID,
    payload: SessionActionItemCreate,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> SessionActionItemResponse:
    item = await SessionActionItemsRepository(database).create_item(
        operator.workspace_id,
        operator.user_id,
        session_id,
        payload.model_dump(),
    )
    if item is None:
        raise _session_not_found()
    _private(response)
    return _item_response(item)


@router.patch(
    "/session-action-items/{item_id}",
    response_model=SessionActionItemResponse,
    operation_id="updateSessionActionItem",
)
async def update_session_action_item(
    item_id: UUID,
    payload: SessionActionItemPatch,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> SessionActionItemResponse:
    item = await SessionActionItemsRepository(database).update_item(
        operator.workspace_id,
        operator.user_id,
        item_id,
        payload.model_dump(exclude_unset=True),
    )
    if item is None:
        raise _item_not_found()
    _private(response)
    return _item_response(item)


@router.delete(
    "/session-action-items/{item_id}",
    status_code=HTTPStatus.NO_CONTENT,
    operation_id="deleteSessionActionItem",
)
async def delete_session_action_item(
    item_id: UUID,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> Response:
    deleted = await SessionActionItemsRepository(database).delete_item(
        operator.workspace_id, operator.user_id, item_id
    )
    if not deleted:
        raise _item_not_found()
    return Response(status_code=HTTPStatus.NO_CONTENT)
