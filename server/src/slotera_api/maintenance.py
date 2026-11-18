import argparse
import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, text

from slotera_api.auth.repository import AuthRepository
from slotera_api.booking_access import emit_booking_event
from slotera_api.config import get_settings
from slotera_api.database import Database
from slotera_api.db.models import Booking, BookingStatus, Session, SessionStatus
from slotera_api.followups import queue_due_followups
from slotera_api.logging import configure_logging
from slotera_api.observability import init_sentry
from slotera_api.scheduling.recurrence import ROLLING_HORIZON_DAYS
from slotera_api.scheduling.repository import SchedulingRepository
from slotera_api.workspace_data import WorkspaceDataRepository

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
        async with database.tenant_transaction(row.workspace_id, scheduling_write=True) as session:
            now = datetime.now(UTC)
            current = (
                await session.execute(
                    select(Booking, Session)
                    .join(
                        Session,
                        (Session.workspace_id == Booking.workspace_id)
                        & (Session.id == Booking.session_id),
                    )
                    .where(
                        Booking.workspace_id == row.workspace_id,
                        Booking.id == row.booking_id,
                        Booking.status == BookingStatus.CONFIRMED,
                        Session.status == SessionStatus.SCHEDULED,
                        Session.start_at > now,
                        Session.start_at <= now + REMINDER_LEAD,
                    )
                    .with_for_update(of=(Booking, Session))
                )
            ).one_or_none()
            if current is None:
                continue
            occurrence = current[1]
            if await emit_booking_event(
                session,
                workspace_id=row.workspace_id,
                booking_id=row.booking_id,
                session_ends_at=occurrence.end_at,
                event_key=str(int(occurrence.start_at.timestamp())),
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
    init_sentry(settings)
    database = Database(settings.database_url)
    try:
        cleaned = await AuthRepository(database).run_maintenance()
        reminders = await queue_booking_reminders(database)
        followups = await queue_due_followups(database)
        async with database.transaction() as session:
            digests = await session.scalar(
                text("SELECT public.slotera_queue_message_digests(:base)"),
                {"base": settings.public_web_base_url},
            )
            await session.execute(text("SELECT slotera_ai_cleanup()"))
            notifications = await session.scalar(text("SELECT slotera_notification_retention()"))
            client_credentials = await session.scalar(
                text("SELECT public.slotera_client_auth_maintenance()")
            )
        sessions = await extend_series_horizons(database)
        purged = await WorkspaceDataRepository(database).purge_closed()
        # The JSON log formatter keeps only request fields from `extra`, so the counts
        # go in the message.
        logger.info(
            "maintenance_completed auth_rows=%s reminders=%s series_sessions=%s "
            "workspaces_purged=%s followups=%s digests=%s client_credentials=%s "
            "notifications_expired=%s",
            cleaned,
            reminders,
            sessions,
            purged,
            followups,
            digests,
            client_credentials,
            notifications,
        )
        return (
            cleaned
            + reminders
            + followups
            + (digests or 0)
            + (client_credentials or 0)
            + (notifications or 0)
            + sessions
            + purged
        )
    finally:
        await database.dispose()


async def run_loop() -> None:
    while True:
        await run()
        await asyncio.sleep(900)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run local maintenance jobs")
    parser.add_argument("--loop", action="store_true", help="repeat every 15 minutes")
    args = parser.parse_args()
    asyncio.run(run_loop() if args.loop else run())
