from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import String, and_, case, cast, or_, select

from slotera_api.database import Database
from slotera_api.db.models import Booking, Client, Service, Session

SearchKind = Literal["booking", "client", "service", "session"]


@dataclass(frozen=True)
class SearchMatch:
    kind: SearchKind
    id: UUID
    title: str
    subtitle: str | None
    occurred_at: datetime | None


def _rank(column: Any, query: str) -> Any:
    return case(
        (cast(column, String).ilike(query), 0),
        (cast(column, String).ilike(f"{query}%"), 1),
        else_=2,
    )


class SearchRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def search(
        self, workspace_id: UUID, *, query: str, limit_per_kind: int
    ) -> list[SearchMatch]:
        pattern = f"%{query}%"
        async with self.database.tenant_transaction(workspace_id) as session:
            clients = list(
                (
                    await session.scalars(
                        select(Client)
                        .where(
                            Client.workspace_id == workspace_id,
                            or_(
                                Client.name.ilike(pattern),
                                Client.email.ilike(pattern),
                                Client.company.ilike(pattern),
                                Client.phone.ilike(pattern),
                            ),
                        )
                        .order_by(_rank(Client.name, query), Client.name, Client.id)
                        .limit(limit_per_kind)
                    )
                ).all()
            )
            services = list(
                (
                    await session.scalars(
                        select(Service)
                        .where(
                            Service.workspace_id == workspace_id,
                            or_(
                                Service.name.ilike(pattern),
                                Service.description.ilike(pattern),
                                Service.location.ilike(pattern),
                            ),
                        )
                        .order_by(_rank(Service.name, query), Service.name, Service.id)
                        .limit(limit_per_kind)
                    )
                ).all()
            )
            sessions = list(
                (
                    await session.execute(
                        select(Session, Service.name)
                        .join(
                            Service,
                            and_(
                                Service.workspace_id == Session.workspace_id,
                                Service.id == Session.service_id,
                            ),
                        )
                        .where(
                            Session.workspace_id == workspace_id,
                            or_(
                                Service.name.ilike(pattern),
                                Session.location.ilike(pattern),
                                cast(Session.status, String).ilike(pattern),
                            ),
                        )
                        .order_by(_rank(Service.name, query), Session.start_at, Session.id)
                        .limit(limit_per_kind)
                    )
                ).all()
            )
            bookings = list(
                (
                    await session.execute(
                        select(
                            Booking,
                            Client.name,
                            Client.email,
                            Service.name,
                            Session.start_at,
                        )
                        .join(
                            Client,
                            and_(
                                Client.workspace_id == Booking.workspace_id,
                                Client.id == Booking.client_id,
                            ),
                        )
                        .join(
                            Session,
                            and_(
                                Session.workspace_id == Booking.workspace_id,
                                Session.id == Booking.session_id,
                            ),
                        )
                        .join(
                            Service,
                            and_(
                                Service.workspace_id == Session.workspace_id,
                                Service.id == Session.service_id,
                            ),
                        )
                        .where(
                            Booking.workspace_id == workspace_id,
                            or_(
                                Client.name.ilike(pattern),
                                Client.email.ilike(pattern),
                                Service.name.ilike(pattern),
                                cast(Booking.status, String).ilike(pattern),
                                cast(Booking.payment_status, String).ilike(pattern),
                            ),
                        )
                        .order_by(_rank(Client.name, query), Booking.created_at.desc(), Booking.id)
                        .limit(limit_per_kind)
                    )
                ).all()
            )

        return [
            *[
                SearchMatch(
                    kind="booking",
                    id=booking.id,
                    title=client_name,
                    subtitle=(
                        f"{service_name} · {booking.status.value} · {booking.payment_status.value}"
                    ),
                    occurred_at=start_at,
                )
                for booking, client_name, _client_email, service_name, start_at in bookings
            ],
            *[
                SearchMatch(
                    kind="client",
                    id=client.id,
                    title=client.name,
                    subtitle=" · ".join(item for item in [client.email, client.company] if item)
                    or None,
                    occurred_at=None,
                )
                for client in clients
            ],
            *[
                SearchMatch(
                    kind="service",
                    id=service.id,
                    title=service.name,
                    subtitle=(
                        f"{service.duration_min} min"
                        f"{' · group of ' + str(service.capacity) if service.capacity > 1 else ''}"
                    ),
                    occurred_at=None,
                )
                for service in services
            ],
            *[
                SearchMatch(
                    kind="session",
                    id=session.id,
                    title=service_name,
                    subtitle=f"{session.status.value} · {session.location}",
                    occurred_at=session.start_at,
                )
                for session, service_name in sessions
            ],
        ]
