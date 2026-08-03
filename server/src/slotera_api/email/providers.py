import logging
from typing import Protocol

import httpx

from slotera_api.config import Settings
from slotera_api.email.repository import OutboxMessage

logger = logging.getLogger("slotera.email")


class EmailProvider(Protocol):
    async def send(self, message: OutboxMessage) -> str: ...


class ConsoleEmailProvider:
    async def send(self, message: OutboxMessage) -> str:
        # This provider is local/test-only (production configuration rejects it).
        # Printing the body makes its one-time activation URL usable without a
        # third-party mail account. Treat local application logs as sensitive.
        logger.info(
            "email_console_delivered id=%s recipient=%s subject=%s\n%s",
            message.id,
            message.recipient_email,
            message.subject,
            message.text_body,
        )
        return f"console:{message.id}"


class ResendEmailProvider:
    def __init__(self, settings: Settings) -> None:
        if settings.resend_api_key is None:
            raise ValueError("Resend API key is required")
        self._api_key = settings.resend_api_key.get_secret_value()
        self._from_address = settings.email_from_address

    async def send(self, message: OutboxMessage) -> str:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Idempotency-Key": str(message.id),
                },
                json={
                    "from": self._from_address,
                    "to": [message.recipient_email],
                    "subject": message.subject,
                    "text": message.text_body,
                },
            )
            response.raise_for_status()
            payload = response.json()
        provider_id = payload.get("id")
        if not isinstance(provider_id, str) or not provider_id:
            raise RuntimeError("Email provider response did not contain a message id")
        return provider_id


def create_email_provider(settings: Settings) -> EmailProvider:
    if settings.email_provider == "resend":
        return ResendEmailProvider(settings)
    return ConsoleEmailProvider()
