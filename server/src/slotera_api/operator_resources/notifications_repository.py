from uuid import UUID

from sqlalchemy import func, select, update

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
    ) -> tuple[list[Notification], int]:
        filters = (
            Notification.workspace_id == workspace_id,
            Notification.recipient_user_id == user_id,
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
                        .where(*filters)
                        .order_by(Notification.occurred_at.desc(), Notification.id)
                        .limit(limit)
                    )
                ).all()
            )
            return notifications, int(unread_count or 0)

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
