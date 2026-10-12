"""Send one test email straight through the configured provider, skipping the outbox.

    slotera-send-test-email --to you@example.com

Use it after setting or rotating the Resend key, or changing the sending domain. Exits
non-zero when the provider rejects the message.
"""

import argparse
import asyncio
import sys
from uuid import uuid4

from slotera_api.config import get_settings
from slotera_api.email.providers import EmailProvider, EmailProviderError, create_email_provider
from slotera_api.email.repository import OutboxMessage


def build_test_message(recipient: str) -> OutboxMessage:
    return OutboxMessage(
        id=uuid4(),
        kind="test",
        recipient_email=recipient,
        subject="Slotera test email",
        text_body="This is a test from Slotera.\n\nIf you can read this, sending works.",
        template_data={},
        attempt_count=0,
    )


async def send_test(provider: EmailProvider, recipient: str) -> int:
    try:
        provider_id = await provider.send(build_test_message(recipient))
    except EmailProviderError as exc:
        print(f"rejected: {exc.status_code} {exc.category}", file=sys.stderr)
        return 1
    print(f"sent, provider id: {provider_id}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Send one Slotera test email")
    parser.add_argument("--to", required=True, help="recipient address")
    args = parser.parse_args()
    settings = get_settings()
    print(f"provider: {settings.email_provider}, from: {settings.email_from_address}")
    sys.exit(asyncio.run(send_test(create_email_provider(settings), args.to)))
