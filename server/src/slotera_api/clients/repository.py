from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import UUID, uuid4

from sqlalchemy import delete, func, or_, select, text, update
from sqlalchemy.exc import IntegrityError

from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    Booking,
    BookingAccessToken,
    BookingFormResponse,
    BookingStatus,
    Client,
    ClientNote,
    PaymentStatus,
    Service,
    Session,
)


class ClientEmailConflictError(Exception):
    pass


# A client counts as "active" while they have a live booking this recent or upcoming.
ACTIVE_WINDOW_DAYS = 30


@dataclass(frozen=True)
class ClientStats:
    """What a client's bookings add up to. Cancelled bookings never count as activity.

    Tag: `new` has no live (non-cancelled) booking yet, `active` has one that starts within
    the last 30 days or later, and `dormant` has only older ones. Spend is what was paid.
    """

    total_bookings: int = 0
    completed_bookings: int = 0
    cancelled_bookings: int = 0
    total_spent_cents: int = 0
    tag: Literal["new", "active", "dormant"] = "new"


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

    async def client_stats(
        self, workspace_id: UUID, client_ids: Sequence[UUID]
    ) -> dict[UUID, ClientStats]:
        """Booking totals per client. Clients without bookings are simply absent."""
        if not client_ids:
            return {}
        recent = datetime.now(UTC) - timedelta(days=ACTIVE_WINDOW_DAYS)
        live = Booking.status != BookingStatus.CANCELLED
        async with self.database.tenant_transaction(workspace_id) as session:
            rows = await session.execute(
                select(
                    Booking.client_id,
                    func.count(Booking.id),
                    func.count(Booking.id).filter(Booking.status == BookingStatus.COMPLETED),
                    func.count(Booking.id).filter(Booking.status == BookingStatus.CANCELLED),
                    func.coalesce(
                        func.sum(Booking.amount_cents).filter(
                            Booking.payment_status == PaymentStatus.PAID
                        ),
                        0,
                    ),
                    func.count(Booking.id).filter(live),
                    func.count(Booking.id).filter(live & (Session.start_at >= recent)),
                )
                .join(
                    Session,
                    (Session.workspace_id == Booking.workspace_id)
                    & (Session.id == Booking.session_id),
                )
                .where(Booking.workspace_id == workspace_id, Booking.client_id.in_(client_ids))
                .group_by(Booking.client_id)
            )
            stats: dict[UUID, ClientStats] = {}
            for client_id, total, completed, cancelled, spent, live_total, recent_live in rows:
                stats[client_id] = ClientStats(
                    total_bookings=int(total),
                    completed_bookings=int(completed),
                    cancelled_bookings=int(cancelled),
                    total_spent_cents=int(spent),
                    tag="active" if recent_live else "dormant" if live_total else "new",
                )
            return stats

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

    async def export_client(self, workspace_id: UUID, client_id: UUID) -> dict[str, Any] | None:
        """Everything this workspace holds about one client, for a subject access request."""
        async with self.database.tenant_transaction(workspace_id) as session:
            client = await session.scalar(
                select(Client).where(Client.id == client_id, Client.workspace_id == workspace_id)
            )
            if client is None:
                return None
            bookings = (
                await session.execute(
                    select(Booking, Session.start_at, Service.name)
                    .join(
                        Session,
                        (Session.workspace_id == Booking.workspace_id)
                        & (Session.id == Booking.session_id),
                    )
                    .join(
                        Service,
                        (Service.workspace_id == Session.workspace_id)
                        & (Service.id == Session.service_id),
                    )
                    .where(Booking.workspace_id == workspace_id, Booking.client_id == client_id)
                    .order_by(Session.start_at)
                )
            ).all()
            references = {booking.id: booking.reference for booking, _, _ in bookings}
            responses = (
                list(
                    await session.scalars(
                        select(BookingFormResponse)
                        .where(
                            BookingFormResponse.workspace_id == workspace_id,
                            BookingFormResponse.booking_id.in_(references),
                        )
                        .order_by(BookingFormResponse.submitted_at)
                    )
                )
                if references
                else []
            )
            notes = list(
                await session.scalars(
                    select(ClientNote)
                    .where(
                        ClientNote.workspace_id == workspace_id, ClientNote.client_id == client_id
                    )
                    .order_by(ClientNote.created_at)
                )
            )
            return {
                "client": client,
                "bookings": [
                    {
                        "reference": booking.reference,
                        "service_name": service_name,
                        "session_start_at": start_at,
                        "status": booking.status.value,
                        "payment_status": booking.payment_status.value,
                        "amount_cents": booking.amount_cents,
                        "tax_amount_cents": booking.tax_amount_cents,
                        "currency": booking.currency,
                        "customer_first_name": booking.customer_first_name,
                        "customer_last_name": booking.customer_last_name,
                        "customer_email": booking.customer_email,
                        "customer_phone": booking.customer_phone,
                        "customer_company": booking.customer_company,
                        "billing_address": booking.billing_address,
                        "notes": booking.notes,
                        "created_at": booking.created_at,
                    }
                    for booking, start_at, service_name in bookings
                ],
                "form_responses": [
                    {
                        "booking_reference": references[response.booking_id],
                        "form_name": response.form_name,
                        "answers": response.answers,
                        "submitted_at": response.submitted_at,
                    }
                    for response in responses
                ],
                "notes": notes,
            }

    async def erase_client(
        self, workspace_id: UUID, actor_user_id: UUID, client_id: UUID, confirm_email: str
    ) -> Literal["erased", "not_found", "confirmation_mismatch"]:
        """Anonymise a client on request, keeping only the financial facts of their bookings.

        Amounts, tax, currency and payment state stay (bookkeeping); names, contact
        details, billing addresses, form answers, notes, manage links and queued or sent
        booking emails go.
        """
        async with self.database.tenant_transaction(workspace_id) as session:
            client = await session.scalar(
                select(Client)
                .where(Client.id == client_id, Client.workspace_id == workspace_id)
                .with_for_update()
            )
            if client is None:
                return "not_found"
            if confirm_email.strip().lower() != client.email:
                return "confirmation_mismatch"
            booking_ids = list(
                await session.scalars(
                    select(Booking.id).where(
                        Booking.workspace_id == workspace_id, Booking.client_id == client_id
                    )
                )
            )
            client.name = "Erased client"
            client.email = f"erased+{client.id}@invalid"
            client.phone = None
            client.company = None
            client.role = None
            client.timezone = None
            client.address = None
            client.vat_id = None
            await session.execute(
                delete(ClientNote).where(
                    ClientNote.workspace_id == workspace_id, ClientNote.client_id == client_id
                )
            )
            if booking_ids:
                await session.execute(
                    delete(BookingFormResponse).where(
                        BookingFormResponse.workspace_id == workspace_id,
                        BookingFormResponse.booking_id.in_(booking_ids),
                    )
                )
                await session.execute(
                    update(Booking)
                    .where(Booking.workspace_id == workspace_id, Booking.id.in_(booking_ids))
                    .values(
                        customer_first_name="",
                        customer_last_name="",
                        customer_email="",
                        customer_phone=None,
                        customer_company=None,
                        billing_address={},
                        notes=None,
                    )
                )
                await session.execute(
                    update(BookingAccessToken)
                    .where(
                        BookingAccessToken.workspace_id == workspace_id,
                        BookingAccessToken.booking_id.in_(booking_ids),
                        BookingAccessToken.revoked_at.is_(None),
                    )
                    .values(revoked_at=datetime.now(UTC))
                )
                await session.execute(
                    text("SELECT public.slotera_client_erase_outbox(:client_id)"),
                    {"client_id": client_id},
                )
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="client.erased",
                    resource_type="client",
                    resource_id=client_id,
                    details={"booking_count": len(booking_ids)},
                )
            )
            return "erased"
