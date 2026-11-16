"""A coherent dashboard worklist: private tasks and live source conditions."""

from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Query, Response
from sqlalchemy import func, select, text

from slotera_api.api.session_action_items import _item_response
from slotera_api.auth.dependencies import DatabaseDependency, OperatorWorkspaceDependency
from slotera_api.db.models import Notification, SessionActionItemStatus, Workspace
from slotera_api.schemas.session_action_items import SessionActionItemListResponse
from slotera_api.session_action_items.repository import list_items_in_session

router = APIRouter(tags=["tasks"])


class WorklistResponse(SessionActionItemListResponse):
    unread_messages: int
    unread_notifications: int
    trial_ends_at: datetime
    paid_through: date | None


@router.get(
    "/dashboard/worklist", response_model=WorklistResponse, operation_id="getDashboardWorklist"
)
async def worklist(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    status: SessionActionItemStatus = SessionActionItemStatus.TODO,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> WorklistResponse:
    async with database.principal_transaction(
        operator.workspace_id, operator.user_id, repeatable_read=True
    ) as session:
        page = await list_items_in_session(
            session, operator.workspace_id, None, limit, offset, status
        )
        assert page is not None
        items, total = page
        workspace = await session.get(Workspace, operator.workspace_id)
        assert workspace is not None
        notifications = await session.scalar(
            select(func.count(Notification.id)).where(
                Notification.workspace_id == operator.workspace_id,
                Notification.recipient_user_id == operator.user_id,
                Notification.read_at.is_(None),
            )
        )
        messages = await session.scalar(
            text("""
            SELECT count(*) FROM conversation_messages m
            JOIN clients c ON c.workspace_id=m.workspace_id AND c.id=m.conversation_id
            LEFT JOIN conversation_reads r ON r.workspace_id=m.workspace_id
              AND r.conversation_id=m.conversation_id AND r.actor_key=:actor
            WHERE m.workspace_id=:workspace AND c.erased_at IS NULL
              AND m.sender_kind='client' AND m.sequence>coalesce(r.last_read,0)
        """),
            {"workspace": operator.workspace_id, "actor": f"operator:{operator.user_id}"},
        )
        result = WorklistResponse(
            items=[_item_response(item) for item in items],
            total=total,
            limit=limit,
            offset=offset,
            unread_messages=messages or 0,
            unread_notifications=notifications or 0,
            trial_ends_at=workspace.trial_ends_at,
            paid_through=workspace.paid_through,
        )
    response.headers["Cache-Control"] = "no-store"
    return result
