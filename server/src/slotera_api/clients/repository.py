from collections.abc import Mapping
from datetime import UTC, datetime
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
    Client,
    ClientNote,
    Service,
    Session,
)


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
