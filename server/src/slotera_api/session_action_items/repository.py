from collections.abc import Mapping
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import case, select

from slotera_api.database import Database
from slotera_api.db.models import AuditEvent, Session, SessionActionItem, SessionActionItemStatus


class SessionActionItemsRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def list_items(
        self, workspace_id: UUID, session_id: UUID
    ) -> tuple[list[SessionActionItem], int] | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            exists = await session.scalar(
                select(Session.id).where(
                    Session.workspace_id == workspace_id,
                    Session.id == session_id,
                )
            )
            if exists is None:
                return None
            items = list(
                (
                    await session.scalars(
                        select(SessionActionItem)
                        .where(
                            SessionActionItem.workspace_id == workspace_id,
                            SessionActionItem.session_id == session_id,
                        )
                        .order_by(
                            case(
                                (
                                    SessionActionItem.status
                                    == SessionActionItemStatus.TODO,
                                    0,
                                ),
                                else_=1,
                            ),
                            SessionActionItem.created_at,
                            SessionActionItem.id,
                        )
                    )
                ).all()
            )
            return items, len(items)

    async def create_item(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        session_id: UUID,
        values: Mapping[str, Any],
    ) -> SessionActionItem | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            exists = await session.scalar(
                select(Session.id).where(
                    Session.workspace_id == workspace_id,
                    Session.id == session_id,
                )
            )
            if exists is None:
                return None
            item = SessionActionItem(
                id=uuid4(),
                workspace_id=workspace_id,
                session_id=session_id,
                **values,
            )
            session.add(item)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="session_action_item.created",
                    resource_type="session_action_item",
                    resource_id=item.id,
                    details={"session_id": str(session_id)},
                )
            )
            await session.flush()
            await session.refresh(item)
            return item

    async def update_item(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        item_id: UUID,
        changes: Mapping[str, Any],
    ) -> SessionActionItem | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            item = await session.scalar(
                select(SessionActionItem).where(
                    SessionActionItem.workspace_id == workspace_id,
                    SessionActionItem.id == item_id,
                )
            )
            if item is None:
                return None
            for field, value in changes.items():
                setattr(item, field, value)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="session_action_item.updated",
                    resource_type="session_action_item",
                    resource_id=item.id,
                    details={"fields": sorted(changes)},
                )
            )
            await session.flush()
            await session.refresh(item)
            return item

    async def delete_item(
        self, workspace_id: UUID, actor_user_id: UUID, item_id: UUID
    ) -> bool:
        async with self.database.tenant_transaction(workspace_id) as session:
            item = await session.scalar(
                select(SessionActionItem).where(
                    SessionActionItem.workspace_id == workspace_id,
                    SessionActionItem.id == item_id,
                )
            )
            if item is None:
                return False
            await session.delete(item)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="session_action_item.deleted",
                    resource_type="session_action_item",
                    resource_id=item_id,
                    details={"session_id": str(item.session_id)},
                )
            )
            return True
