from collections.abc import Mapping
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select

from slotera_api.database import Database
from slotera_api.db.models import AuditEvent, Client, ClientNote
from slotera_api.editing import ensure_version


class ClientNotesRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def list_notes(
        self, workspace_id: UUID, client_id: UUID, limit: int = 25, offset: int = 0
    ) -> tuple[list[ClientNote], int] | None:
        async with self.database.tenant_transaction(workspace_id, repeatable_read=True) as session:
            client = await session.scalar(
                select(Client.id).where(
                    Client.workspace_id == workspace_id,
                    Client.id == client_id,
                )
            )
            if client is None:
                return None
            notes = list(
                (
                    await session.scalars(
                        select(ClientNote)
                        .limit(limit)
                        .offset(offset)
                        .where(
                            ClientNote.workspace_id == workspace_id,
                            ClientNote.client_id == client_id,
                        )
                        .order_by(ClientNote.updated_at.desc(), ClientNote.id)
                    )
                ).all()
            )
            total = await session.scalar(
                select(func.count(ClientNote.id)).where(
                    ClientNote.workspace_id == workspace_id, ClientNote.client_id == client_id
                )
            )
            return notes, int(total or 0)

    async def create_note(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        client_id: UUID,
        values: Mapping[str, Any],
    ) -> ClientNote | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            client = await session.scalar(
                select(Client)
                .where(
                    Client.workspace_id == workspace_id,
                    Client.id == client_id,
                )
                .with_for_update()
            )
            if client is None or client.erased_at is not None:
                return None
            note = ClientNote(
                id=uuid4(),
                workspace_id=workspace_id,
                client_id=client_id,
                **values,
            )
            session.add(note)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="client_note.created",
                    resource_type="client_note",
                    resource_id=note.id,
                    details={"client_id": str(client_id)},
                )
            )
            await session.flush()
            await session.refresh(note)
            return note

    async def get_note(self, workspace_id: UUID, note_id: UUID) -> ClientNote | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            note = await session.scalar(
                select(ClientNote).where(
                    ClientNote.workspace_id == workspace_id,
                    ClientNote.id == note_id,
                )
            )
            return note if isinstance(note, ClientNote) else None

    async def update_note(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        note_id: UUID,
        changes: Mapping[str, Any],
        expected_version: int | None = None,
    ) -> ClientNote | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            note = await session.scalar(
                select(ClientNote).where(
                    ClientNote.workspace_id == workspace_id,
                    ClientNote.id == note_id,
                )
            )
            if not isinstance(note, ClientNote):
                return None
            parent = await session.scalar(
                select(Client)
                .where(Client.workspace_id == workspace_id, Client.id == note.client_id)
                .with_for_update()
            )
            if parent is None or parent.erased_at is not None:
                return None
            # Erasure may have removed the note while we waited for its parent.
            note = await session.scalar(
                select(ClientNote)
                .where(ClientNote.workspace_id == workspace_id, ClientNote.id == note_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if not isinstance(note, ClientNote):
                return None
            ensure_version(note, expected_version)
            for field, value in changes.items():
                setattr(note, field, value)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="client_note.updated",
                    resource_type="client_note",
                    resource_id=note.id,
                    details={"fields": sorted(changes)},
                )
            )
            await session.flush()
            await session.refresh(note)
            return note

    async def delete_note(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        note_id: UUID,
        expected_version: int | None = None,
    ) -> bool:
        async with self.database.tenant_transaction(workspace_id) as session:
            note = await session.scalar(
                select(ClientNote).where(
                    ClientNote.workspace_id == workspace_id,
                    ClientNote.id == note_id,
                )
            )
            if note is None:
                return False
            parent = await session.scalar(
                select(Client)
                .where(Client.workspace_id == workspace_id, Client.id == note.client_id)
                .with_for_update()
            )
            if parent is None:
                return False
            note = await session.scalar(
                select(ClientNote)
                .where(ClientNote.workspace_id == workspace_id, ClientNote.id == note_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if note is None:
                return False
            ensure_version(note, expected_version)
            await session.delete(note)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="client_note.deleted",
                    resource_type="client_note",
                    resource_id=note_id,
                    details={"client_id": str(note.client_id)},
                )
            )
            return True
