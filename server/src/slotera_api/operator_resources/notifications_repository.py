from datetime import datetime
from uuid import UUID

from sqlalchemy import ColumnElement, and_, func, or_, select, update

from slotera_api.database import Database
from slotera_api.db.models import Notification


class NotificationsRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def list_for_principal(
        self,
        workspace_id: UUID,
        user_id: UUID,
        *,
        limit: int,
        before: tuple[datetime, UUID] | None = None,
    ) -> tuple[list[Notification], int, bool]:
        """Newest first. `before` is the (occurredAt, id) of the last item already shown,
        so later pages stay stable while new notifications arrive at the top."""
        filters = (
            Notification.workspace_id == workspace_id,
            Notification.recipient_user_id == user_id,
        )
        page_filters: tuple[ColumnElement[bool], ...] = filters
        if before is not None:
            occurred_at, identifier = before
            page_filters = (
                *filters,
                or_(
                    Notification.occurred_at < occurred_at,
                    and_(Notification.occurred_at == occurred_at, Notification.id > identifier),
                ),
            )
        async with self.database.principal_transaction(workspace_id, user_id) as session:
            unread_count = await session.scalar(
                select(func.count(Notification.id)).where(
                    *filters,
                    Notification.read_at.is_(None),
                )
            )
            notifications = list(
                (
                    await session.scalars(
                        select(Notification)
                        .where(*page_filters)
                        .order_by(Notification.occurred_at.desc(), Notification.id)
                        .limit(limit + 1)
                    )
                ).all()
            )
            return notifications[:limit], int(unread_count or 0), len(notifications) > limit

    async def mark_all_read(self, workspace_id: UUID, user_id: UUID) -> None:
        async with self.database.principal_transaction(workspace_id, user_id) as session:
            await session.execute(
                update(Notification)
                .where(
                    Notification.workspace_id == workspace_id,
                    Notification.recipient_user_id == user_id,
                    Notification.read_at.is_(None),
                )
                .values(read_at=func.now())
            )
