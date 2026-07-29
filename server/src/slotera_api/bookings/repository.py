from uuid import UUID

from sqlalchemy import func, select

from slotera_api.database import Database
from slotera_api.db.models import Booking


class BookingsRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def list_bookings(
        self, workspace_id: UUID, *, limit: int, offset: int
    ) -> tuple[list[Booking], int]:
        async with self.database.tenant_transaction(workspace_id) as session:
            predicate = Booking.workspace_id == workspace_id
            total = await session.scalar(select(func.count(Booking.id)).where(predicate))
            items = list(
                (
                    await session.scalars(
                        select(Booking)
                        .where(predicate)
                        .order_by(Booking.created_at.desc(), Booking.id)
                        .limit(limit)
                        .offset(offset)
                    )
                ).all()
            )
            return items, int(total or 0)

    async def get_booking(self, workspace_id: UUID, booking_id: UUID) -> Booking | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            result = await session.scalar(
                select(Booking).where(
                    Booking.workspace_id == workspace_id, Booking.id == booking_id
                )
            )
            return result if isinstance(result, Booking) else None
