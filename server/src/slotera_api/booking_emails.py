"""Display-safe booking email metadata through a tenant-scoped database capability."""

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.config import get_settings


async def email_history(
    session: AsyncSession,
    *,
    booking_id: UUID | None = None,
    client_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
) -> dict[str, Any]:
    result = await session.scalar(
        text("SELECT public.slotera_booking_email_history(:booking_id,:limit,:offset,:client_id)"),
        {"booking_id": booking_id, "client_id": client_id, "limit": limit, "offset": offset},
    )
    page = dict(result)
    if get_settings().email_provider == "console":
        for item in page["items"]:
            if item["sent_at"] is None:
                item["simulated"] = True
    return page


async def export_email_history(
    session: AsyncSession,
    *,
    client_id: UUID | None = None,
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    while True:
        page = await email_history(session, client_id=client_id, limit=100, offset=len(items))
        items.extend(page["items"])
        if not page["items"] or len(items) >= page["total"]:
            return items
