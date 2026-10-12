from slotera_api.email.providers import EmailProviderError
from slotera_api.email.repository import OutboxMessage
from slotera_api.email.send_test import send_test


class CapturingProvider:
    def __init__(self) -> None:
        self.messages: list[OutboxMessage] = []

    async def send(self, message: OutboxMessage) -> str:
        self.messages.append(message)
        return "provider-id"


class RejectingProvider:
    async def send(self, message: OutboxMessage) -> str:
        raise EmailProviderError(403, "validation_error")


async def test_send_test_email_goes_to_the_given_address() -> None:
    provider = CapturingProvider()

    assert await send_test(provider, "you@example.com") == 0

    [sent] = provider.messages
    assert sent.recipient_email == "you@example.com"
    assert sent.subject == "Slotera test email"


async def test_send_test_email_fails_when_the_provider_rejects_it(capsys) -> None:  # type: ignore[no-untyped-def]
    assert await send_test(RejectingProvider(), "you@example.com") == 1
    assert "rejected: 403 validation_error" in capsys.readouterr().err
