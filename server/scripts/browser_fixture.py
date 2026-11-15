"""Narrow synthetic browser-test helpers; never usable with the normal database."""

import asyncio
import json
import os
import sys
from uuid import UUID

from slotera_api.booking_access import issue_manage_url
from slotera_api.config import get_migration_settings
from slotera_api.database import Database
from slotera_api.db.models import Booking, Session


async def run():
    settings = get_migration_settings()
    if os.environ.get(
        "SLOTERA_BROWSER_TEST"
    ) != "1" or not settings.migration_database_url.endswith("/slotera_browser_test"):
        raise RuntimeError("Browser helpers require the dedicated disposable database")
    database = Database(settings.migration_database_url)
    try:
        booking_id = UUID(sys.argv[2])
        async with database.transaction() as tx:
            booking = await tx.get(Booking, booking_id)
            if booking is None:
                raise RuntimeError("Synthetic booking missing")
            occurrence = await tx.get(Session, booking.session_id)
            if occurrence is None:
                raise RuntimeError("Synthetic session missing")
            if sys.argv[1] != "manage-link":
                raise RuntimeError("Unknown browser fixture operation")
            url = await issue_manage_url(
                tx,
                workspace_id=booking.workspace_id,
                booking_id=booking_id,
                session_ends_at=occurrence.end_at,
            )
            print(json.dumps({"url": url}))
    finally:
        await database.dispose()


asyncio.run(run())
