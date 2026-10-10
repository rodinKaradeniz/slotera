from uuid import UUID, uuid4

from slotera_api.email.repository import OutboxMessage
from slotera_api.email.worker import deliver_available


class StubRepository:
    def __init__(self, messages: list[OutboxMessage]) -> None:
        self.messages = messages
        self.sent: list[tuple[UUID, str]] = []
        self.failed: list[tuple[UUID, str]] = []

    async def claim(self) -> OutboxMessage | None:
        return self.messages.pop(0) if self.messages else None

    async def mark_sent(self, message_id: UUID, provider_id: str) -> bool:
        self.sent.append((message_id, provider_id))
        return True

    async def mark_failed(self, message_id: UUID, error: str) -> bool:
        self.failed.append((message_id, error))
        return True


class StubProvider:
    async def send(self, message: OutboxMessage) -> str:
        return f"provider:{message.id}"


async def test_worker_claims_and_marks_transactional_email_sent() -> None:
    message = OutboxMessage(
        id=uuid4(),
        kind="account_activation",
        recipient_email="owner@example.com",
        subject="Set your password",
        text_body="credential-bearing body",
        template_data={},
        attempt_count=1,
    )
    repository = StubRepository([message])

    delivered = await deliver_available(repository, StubProvider())  # type: ignore[arg-type]

    assert delivered == 1
    assert repository.sent == [(message.id, f"provider:{message.id}")]
    assert repository.failed == []


class CapturingProvider:
    def __init__(self) -> None:
        self.messages: list[OutboxMessage] = []

    async def send(self, message: OutboxMessage) -> str:
        self.messages.append(message)
        return "provider"


async def test_worker_attaches_a_calendar_file_to_confirmations() -> None:
    message = OutboxMessage(
        id=uuid4(),
        kind="booking_confirmed",
        recipient_email="client@example.com",
        subject="[template:booking_confirmed]",
        text_body="[template:booking_confirmed]",
        template_data={
            "reference": "SLT-ICS1",
            "serviceName": "Discovery Call",
            "providerName": "Lena",
            "startsAt": "2030-01-10T09:00:00Z",
            "endsAt": "2030-01-10T09:30:00Z",
            "timezone": "Europe/London",
            "paymentMethod": "free",
            "paymentStatus": "free",
            "approvalStatus": "not_required",
            "amountCents": 0,
            "currency": "GBP",
            "paymentDueAt": None,
            "manualPaymentInstructions": "",
            "cancellationRule": "",
        },
        attempt_count=1,
    )
    provider = CapturingProvider()

    await deliver_available(StubRepository([message]), provider)  # type: ignore[arg-type]

    [sent] = provider.messages
    [attachment] = sent.attachments
    assert attachment.filename == "booking.ics" and attachment.content_type == "text/calendar"
    assert b"UID:slt-ics1@slotera.app" in attachment.content
