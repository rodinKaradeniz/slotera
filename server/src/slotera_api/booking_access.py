"""Customer booking links and the booking emails that carry them.

A customer never has an account. Each booking email carries a fresh link to that one
booking; only the token's SHA-256 is stored. The token travels in the URL fragment
(`/booking/manage#<token>`), which browsers never send to servers, so it does not land
in access logs or Referer headers.
"""

from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.config import get_settings
from slotera_api.db.models import BookingAccessToken
from slotera_api.identity import hash_opaque_token, issue_opaque_token

BookingEvent = Literal["received", "confirmed", "reminder", "rescheduled", "cancelled"]
# What a client did themselves; the operator gets an email for each.
ClientAction = Literal["new", "cancelled", "rescheduled"]

# Links stay useful for follow-up after the session, then expire.
ACCESS_LINK_GRACE = timedelta(days=30)


async def issue_manage_url(
    session: AsyncSession, *, workspace_id: UUID, booking_id: UUID, session_ends_at: datetime
) -> str:
    """Store a new access token for the booking and return its customer link."""
    token = issue_opaque_token()
    session.add(
        BookingAccessToken(
            workspace_id=workspace_id,
            booking_id=booking_id,
            token_hash=hash_opaque_token(token),
            expires_at=max(session_ends_at, datetime.now(UTC)) + ACCESS_LINK_GRACE,
        )
    )
    await session.flush()
    return f"{get_settings().public_web_base_url}/booking/manage#{token}"


async def emit_booking_event(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    booking_id: UUID,
    session_ends_at: datetime,
    event: BookingEvent,
) -> bool:
    """Queue the customer email (with a manage link) and the operator notification.

    Runs inside the caller's tenant transaction. Returns False when the event does not
    apply to the booking's current state, or was already sent for this booking.
    """
    manage_url = (
        None
        if event == "cancelled"
        else await issue_manage_url(
            session,
            workspace_id=workspace_id,
            booking_id=booking_id,
            session_ends_at=session_ends_at,
        )
    )
    emitted = await session.scalar(
        text("SELECT public.slotera_booking_emit_event(:booking_id, :event, :manage_url)"),
        {"booking_id": booking_id, "event": event, "manage_url": manage_url},
    )
    return emitted is True


async def notify_operator(session: AsyncSession, *, booking_id: UUID, action: ClientAction) -> None:
    """Queue an email telling the workspace owner what a client just did.

    Call it only from client-initiated paths (public booking, manage link): the
    operator's own changes must not email them. Runs in the caller's tenant transaction.
    """
    admin_url = f"{get_settings().public_web_base_url}/admin/bookings/{booking_id}"
    await session.execute(
        text("SELECT public.slotera_booking_notify_operator(:booking_id, :event, :admin_url)"),
        {"booking_id": booking_id, "event": action, "admin_url": admin_url},
    )
