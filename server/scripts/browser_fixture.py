"""Narrow synthetic browser-test helpers; never usable with the normal database."""

import asyncio
import json
import os
import sys
from datetime import timedelta
from uuid import UUID

from sqlalchemy import func, select, text

from slotera_api.booking_access import issue_manage_url
from slotera_api.config import get_migration_settings
from slotera_api.database import Database
from slotera_api.db.models import Booking, Session
from slotera_api.followups import queue_due_followups


async def run():
    settings = get_migration_settings()
    if os.environ.get(
        "SLOTERA_BROWSER_TEST"
    ) != "1" or not settings.migration_database_url.endswith("/slotera_browser_test"):
        raise RuntimeError("Browser helpers require the dedicated disposable database")
    database = Database(settings.migration_database_url)
    try:
        operation = sys.argv[1]
        if operation == "index-ai":
            from slotera_api.ai.provider import LocalProvider
            from slotera_api.ai.worker import process_one
            from slotera_api.config import get_settings

            for _ in range(200):
                if not await process_one(database, get_settings(), LocalProvider()):
                    break
            print(json.dumps({"ready": True}))
            return
        if operation == "queue-followups":
            print(json.dumps({"queued": await queue_due_followups(database)}))
            return
        async with database.transaction() as tx:
            if operation == "prepare-auth":
                await tx.execute(text("DELETE FROM request_rate_limits WHERE scope='auth.login'"))
                print(json.dumps({"ready": True}))
                return
            if operation == "client-link":
                body = await tx.scalar(
                    text(
                        "SELECT text_body FROM email_outbox WHERE kind='client_sign_in' "
                        "AND recipient_email=:email ORDER BY created_at DESC LIMIT 1"
                    ),
                    {"email": sys.argv[2]},
                )
                if body is None:
                    raise RuntimeError("Synthetic sign-in missing")
                print(json.dumps({"url": body.splitlines()[-1]}))
                return
            booking_id = UUID(sys.argv[2])
            booking = await tx.get(Booking, booking_id)
            if booking is None:
                raise RuntimeError("Synthetic booking missing")
            await tx.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:scope,0))"),
                {"scope": f"slotera:scheduling:{booking.workspace_id}"},
            )
            occurrence = await tx.get(Session, booking.session_id)
            if occurrence is None:
                raise RuntimeError("Synthetic session missing")
            if operation == "finish-session":
                earliest = await tx.scalar(select(func.min(Session.start_at)))
                occurrence.start_at = earliest - timedelta(days=1)
                occurrence.end_at = occurrence.start_at + timedelta(minutes=30)
                print(json.dumps({"ready": True}))
            elif operation == "manage-link":
                # All journeys share localhost's hourly manage-link allowance; reset it.
                await tx.execute(
                    text(
                        "DELETE FROM request_rate_limits WHERE scope IN "
                        "('public_booking_manage_read', 'public_booking_manage_change')"
                    )
                )
                url = await issue_manage_url(
                    tx,
                    workspace_id=booking.workspace_id,
                    booking_id=booking_id,
                    session_ends_at=occurrence.end_at,
                )
                print(json.dumps({"url": url}))
            else:
                raise RuntimeError("Unknown browser fixture operation")
    finally:
        await database.dispose()


asyncio.run(run())
