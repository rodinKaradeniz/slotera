from collections.abc import Mapping
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from slotera_api.database import Database
from slotera_api.db.models import AuditEvent, Client


class ClientEmailConflictError(Exception):
    pass


class ClientsRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def list_clients(
        self, workspace_id: UUID, *, search: str | None, limit: int, offset: int
    ) -> tuple[list[Client], int]:
        filters: list[Any] = [Client.workspace_id == workspace_id]
        if search:
            pattern = f"%{search.strip()}%"
            filters.append(
                or_(
                    Client.name.ilike(pattern),
                    Client.email.ilike(pattern),
                    Client.company.ilike(pattern),
                )
            )
        async with self.database.tenant_transaction(workspace_id) as session:
            total = await session.scalar(select(func.count(Client.id)).where(*filters))
            clients = list(
                (
                    await session.scalars(
                        select(Client)
                        .where(*filters)
                        .order_by(Client.created_at.desc(), Client.id)
                        .limit(limit)
                        .offset(offset)
                    )
                ).all()
            )
            return clients, int(total or 0)

    async def get_client(self, workspace_id: UUID, client_id: UUID) -> Client | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            result = await session.scalar(
                select(Client).where(Client.id == client_id, Client.workspace_id == workspace_id)
            )
            return result if isinstance(result, Client) else None

    async def create_client(
        self, workspace_id: UUID, actor_user_id: UUID, values: Mapping[str, Any]
    ) -> Client:
        async with self.database.tenant_transaction(workspace_id) as session:
            client = Client(id=uuid4(), workspace_id=workspace_id, **values)
            session.add(client)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="client.created",
                    resource_type="client",
                    resource_id=client.id,
                    details={},
                )
            )
            try:
                await session.flush()
            except IntegrityError as exc:
                raise ClientEmailConflictError from exc
            await session.refresh(client)
            return client

    async def update_client(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        client_id: UUID,
        changes: Mapping[str, Any],
    ) -> Client | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            client = await session.scalar(
                select(Client).where(Client.id == client_id, Client.workspace_id == workspace_id)
            )
            if client is None:
                return None
            for key, value in changes.items():
                setattr(client, key, value)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="client.updated",
                    resource_type="client",
                    resource_id=client.id,
                    details={"fields": sorted(changes)},
                )
            )
            try:
                await session.flush()
            except IntegrityError as exc:
                raise ClientEmailConflictError from exc
            await session.refresh(client)
            return client
