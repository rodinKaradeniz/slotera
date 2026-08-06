import argparse
import asyncio
import logging
from dataclasses import replace
from typing import Literal, cast

from slotera_api.config import get_settings
from slotera_api.database import Database
from slotera_api.email.providers import EmailProvider, create_email_provider
from slotera_api.email.repository import EmailOutboxRepository
from slotera_api.email.templates import render_booking_email
from slotera_api.logging import configure_logging

logger = logging.getLogger("slotera.email.worker")


async def deliver_available(
    repository: EmailOutboxRepository,
    provider: EmailProvider,
    *,
    limit: int = 100,
) -> int:
    delivered = 0
    for _ in range(limit):
        message = await repository.claim()
        if message is None:
            break
        try:
            resolved = message
            if message.kind in {"booking_received", "booking_confirmed"}:
                kind = cast(
                    Literal["booking_received", "booking_confirmed"], message.kind
                )
                subject, text_body = render_booking_email(kind, message.template_data)
                resolved = replace(message, subject=subject, text_body=text_body)
            provider_id = await provider.send(resolved)
        except Exception as exc:
            # The database applies bounded exponential retry timing. Store only
            # the exception class; provider messages can echo request content.
            await repository.mark_failed(message.id, type(exc).__name__)
            logger.exception("email_delivery_failed", extra={"message_id": str(message.id)})
        else:
            await repository.mark_sent(message.id, provider_id)
            delivered += 1
    return delivered


async def run(*, once: bool, poll_seconds: float) -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    database = Database(settings.database_url)
    repository = EmailOutboxRepository(database)
    provider = create_email_provider(settings)
    try:
        while True:
            await deliver_available(repository, provider)
            if once:
                return
            await asyncio.sleep(poll_seconds)
    finally:
        await database.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Deliver Slotera transactional email")
    parser.add_argument("--once", action="store_true", help="drain available email and exit")
    parser.add_argument("--poll-seconds", type=float, default=5.0)
    args = parser.parse_args()
    asyncio.run(run(once=args.once, poll_seconds=max(args.poll_seconds, 0.25)))
