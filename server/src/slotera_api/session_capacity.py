"""Which bookings hold a seat, and freeing a public 1:1 session once nothing holds it."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.db.models import Booking, BookingStatus, Session, SessionOrigin, SessionStatus

CAPACITY_CONSUMING_STATUSES = (BookingStatus.PENDING, BookingStatus.CONFIRMED)


async def release_public_session(
    database_session: AsyncSession,
    workspace_id: UUID,
    booking: Booking,
    scheduled_session: Session,
) -> None:
    """A public 1:1 session exists only for its booking, so cancel it once unused.
    Operator-scheduled sessions stay and simply regain the seat."""
    if (
        scheduled_session.origin != SessionOrigin.PUBLIC_OPEN
        or scheduled_session.capacity != 1
        or scheduled_session.status == SessionStatus.CANCELLED
    ):
        return
    remaining = await database_session.scalar(
        select(func.count(Booking.id)).where(
            Booking.workspace_id == workspace_id,
            Booking.session_id == scheduled_session.id,
            Booking.id != booking.id,
            Booking.status.in_(CAPACITY_CONSUMING_STATUSES),
        )
    )
    if int(remaining or 0) == 0:
        scheduled_session.status = SessionStatus.CANCELLED
