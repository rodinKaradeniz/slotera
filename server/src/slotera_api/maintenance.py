import asyncio
import logging
from datetime import timedelta

from sqlalchemy import text

from slotera_api.auth.repository import AuthRepository
from slotera_api.booking_access import emit_booking_event
from slotera_api.config import get_settings
from slotera_api.database import Database
from slotera_api.logging import configure_logging
from slotera_api.scheduling.recurrence import ROLLING_HORIZON_DAYS
from slotera_api.scheduling.repository import SchedulingRepository

logger = logging.getLogger("slotera.maintenance")

REMINDER_LEAD = timedelta(hours=24)


async def queue_booking_reminders(database: Database) -> int:
    """Queue one reminder per confirmed booking starting within `REMINDER_LEAD`.

    The email worker sends them; the outbox's per-booking uniqueness makes a repeat run
    a no-op. Each reminder carries a fresh manage link, issued in the booking's tenant.
    """
    async with database.transaction() as session:
        due = (
            await session.execute(
                text("SELECT * FROM public.slotera_booking_due_reminders(:within)"),
                {"within": REMINDER_LEAD},
            )
        ).all()
    queued = 0
    for row in due:
        async with database.tenant_transaction(row.workspace_id) as session:
            if await emit_booking_event(
                session,
                workspace_id=row.workspace_id,
                booking_id=row.booking_id,
                session_ends_at=row.ends_at,
                event="reminder",
            ):
                queued += 1
    return queued


async def extend_series_horizons(database: Database) -> int:
    """Keep every open-ended recurring series materialised `ROLLING_HORIZON_DAYS` ahead."""
    async with database.transaction() as session:
        due = (
            await session.execute(
                text("SELECT * FROM public.slotera_series_due_extension(:days)"),
                {"days": ROLLING_HORIZON_DAYS},
            )
        ).all()
    repository = SchedulingRepository(database)
    created = 0
    for row in due:
        created += await repository.extend_series(row.workspace_id, row.series_id)
    return created


async def run() -> int:
    """Run every periodic job once. Schedule it every ~15 minutes."""
    settings = get_settings()
    configure_logging(settings.log_level)
    database = Database(settings.database_url)
    try:
        cleaned = await AuthRepository(database).run_maintenance()
        reminders = await queue_booking_reminders(database)
        sessions = await extend_series_horizons(database)
        logger.info(
            "maintenance_completed",
            extra={"auth_rows": cleaned, "reminders": reminders, "series_sessions": sessions},
        )
        return cleaned + reminders + sessions
    finally:
        await database.dispose()


def main() -> None:
    asyncio.run(run())
