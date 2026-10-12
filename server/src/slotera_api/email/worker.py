import argparse
import asyncio
import logging
from dataclasses import replace
from typing import cast

from slotera_api.config import get_settings
from slotera_api.database import Database
from slotera_api.email.providers import EmailProvider, EmailProviderError, create_email_provider
from slotera_api.email.repository import EmailAttachment, EmailOutboxRepository, OutboxMessage
from slotera_api.email.templates import (
    BOOKING_EMAIL_KINDS,
    OPERATOR_EMAIL_KINDS,
    BookingEmailKind,
    OperatorEmailKind,
    booking_calendar_file,
    render_booking_email,
    render_operator_email,
)
from slotera_api.logging import configure_logging
from slotera_api.observability import init_sentry

logger = logging.getLogger("slotera.email.worker")

# Every email comes from a no-reply address, so each one says where to go instead.
NO_REPLY_FOOTER = "This is an automated message; replies to this address aren't read."
BOOKING_NO_REPLY_FOOTER = (
    f"{NO_REPLY_FOOTER} To change your booking, use the link above. "
    "For anything else, contact your provider directly."
)
CANCELLED_NO_REPLY_FOOTER = f"{NO_REPLY_FOOTER} For questions, contact your provider directly."


def _with_footer(message: OutboxMessage) -> OutboxMessage:
    if message.kind not in BOOKING_EMAIL_KINDS:
        footer = NO_REPLY_FOOTER
    elif message.template_data.get("manageUrl"):
        footer = BOOKING_NO_REPLY_FOOTER
    else:
        footer = CANCELLED_NO_REPLY_FOOTER
    return replace(message, text_body=f"{message.text_body}\n\n--\n{footer}")


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
            if message.kind in BOOKING_EMAIL_KINDS:
                kind = cast(BookingEmailKind, message.kind)
                subject, text_body = render_booking_email(kind, message.template_data)
                calendar = booking_calendar_file(kind, message.template_data)
                resolved = replace(
                    message,
                    subject=subject,
                    text_body=text_body,
                    attachments=(
                        (EmailAttachment("booking.ics", calendar.encode(), "text/calendar"),)
                        if calendar
                        else ()
                    ),
                )
            elif message.kind in OPERATOR_EMAIL_KINDS:
                subject, text_body = render_operator_email(
                    cast(OperatorEmailKind, message.kind), message.template_data
                )
                resolved = replace(message, subject=subject, text_body=text_body)
            provider_id = await provider.send(_with_footer(resolved))
        except Exception as exc:
            # The database applies bounded exponential retry timing. Store only the
            # exception class (plus a provider's status and error category); provider
            # messages can echo request content.
            error = type(exc).__name__
            if isinstance(exc, EmailProviderError):
                error = f"{error}: {exc.status_code} {exc.category}"
                logger.error(
                    "email_delivery_failed id=%s status=%s category=%s",
                    message.id,
                    exc.status_code,
                    exc.category,
                )
            else:
                logger.exception("email_delivery_failed", extra={"message_id": str(message.id)})
            await repository.mark_failed(message.id, error)
        else:
            await repository.mark_sent(message.id, provider_id)
            delivered += 1
    return delivered


async def run(*, once: bool, poll_seconds: float) -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    init_sentry(settings)
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
