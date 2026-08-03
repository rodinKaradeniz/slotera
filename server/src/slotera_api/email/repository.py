from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import text

from slotera_api.database import Database


@dataclass(frozen=True)
class OutboxMessage:
    id: UUID
    recipient_email: str
    subject: str
    text_body: str
    attempt_count: int


class EmailOutboxRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def claim(self) -> OutboxMessage | None:
        async with self.database.transaction() as session:
            row = (
                (await session.execute(text("SELECT * FROM public.slotera_email_claim()")))
                .mappings()
                .one_or_none()
            )
        return OutboxMessage(**row) if row is not None else None

    async def mark_sent(self, message_id: UUID, provider_message_id: str) -> bool:
        async with self.database.transaction() as session:
            updated = await session.scalar(
                text("SELECT public.slotera_email_mark_sent(:id, :provider_id)"),
                {"id": message_id, "provider_id": provider_message_id},
            )
        return updated is True

    async def mark_failed(self, message_id: UUID, error: str) -> bool:
        async with self.database.transaction() as session:
            updated = await session.scalar(
                text("SELECT public.slotera_email_mark_failed(:id, :error)"),
                {"id": message_id, "error": error},
            )
        return updated is True
