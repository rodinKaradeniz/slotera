import json
from collections.abc import AsyncIterator, Mapping, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any, Literal
from uuid import UUID, uuid4

from sqlalchemy import ColumnElement, case, delete, func, or_, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.booking_access import emit_booking_event
from slotera_api.booking_emails import export_email_history
from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    Booking,
    BookingAccessToken,
    BookingFollowup,
    BookingFormResponse,
    BookingFormSnapshot,
    BookingStatus,
    Client,
    ClientEmailCommand,
    ClientNote,
    PackagePurchase,
    PaymentStatus,
    Service,
    Session,
    Workspace,
)
from slotera_api.editing import ensure_version
from slotera_api.errors import ApiError
from slotera_api.followups import queue_followup


class ClientEmailConflictError(Exception):
    pass


def counted_package_sale(workspace_id: UUID) -> ColumnElement[bool]:
    """A package sale counts as money in once it is paid, until the operator voids it."""
    return (
        (PackagePurchase.workspace_id == workspace_id)
        & (PackagePurchase.payment_status == "paid")
        & (PackagePurchase.status == "active")
    )


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


@asynccontextmanager
async def _read_session(
    database: Database, workspace_id: UUID, existing: AsyncSession | None
) -> AsyncIterator[AsyncSession]:
    if existing is not None:
        yield existing
    else:
        async with database.tenant_transaction(workspace_id, repeatable_read=True) as session:
            yield session


class ClientsRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def list_clients(
        self,
        workspace_id: UUID,
        *,
        search: str | None,
        limit: int,
        offset: int,
        dbsession: AsyncSession | None = None,
        contactable: bool = False,
    ) -> tuple[list[Client], int]:
        filters: list[Any] = [Client.workspace_id == workspace_id]
        if contactable:
            filters.append(Client.erased_at.is_(None))
        if search:
            pattern = (
                "%" + search.strip().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"
            )
            filters.append(
                or_(
                    Client.name.ilike(pattern, escape="!"),
                    Client.email.ilike(pattern, escape="!"),
                    Client.company.ilike(pattern, escape="!"),
                )
            )
        async with _read_session(self.database, workspace_id, dbsession) as session:
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

    async def state_counts(
        self,
        workspace_id: UUID,
        search: str | None,
        contactable: bool,
        session: AsyncSession,
        as_of: datetime,
    ) -> dict[str, int]:
        live = (
            select(Booking.id)
            .where(
                Booking.workspace_id == workspace_id,
                Booking.client_id == Client.id,
                Booking.status != BookingStatus.CANCELLED,
            )
            .correlate(Client)
        )
        recent = live.join(
            Session,
            (Session.workspace_id == Booking.workspace_id) & (Session.id == Booking.session_id),
        ).where(Session.start_at >= as_of - timedelta(days=ACTIVE_WINDOW_DAYS))
        tag = case((recent.exists(), "active"), (live.exists(), "dormant"), else_="new")
        query = select(tag.label("tag")).where(Client.workspace_id == workspace_id)
        if contactable:
            query = query.where(Client.erased_at.is_(None))
        if search:
            pattern = (
                "%" + search.strip().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"
            )
            query = query.where(
                or_(
                    Client.name.ilike(pattern, escape="!"),
                    Client.email.ilike(pattern, escape="!"),
                    Client.company.ilike(pattern, escape="!"),
                )
            )
        rows = query.subquery()
        counts = (
            await session.execute(select(rows.c.tag, func.count()).group_by(rows.c.tag))
        ).all()
        return {str(key): int(value) for key, value in counts}

    async def client_stats(
        self,
        workspace_id: UUID,
        client_ids: Sequence[UUID],
        dbsession: AsyncSession | None = None,
        as_of: datetime | None = None,
    ) -> dict[UUID, ClientStats]:
        """Booking totals per client. Clients without bookings are simply absent."""
        if not client_ids:
            return {}
        recent = (as_of or datetime.now(UTC)) - timedelta(days=ACTIVE_WINDOW_DAYS)
        live = Booking.status != BookingStatus.CANCELLED
        async with _read_session(self.database, workspace_id, dbsession) as session:
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
            # A package is paid for once, at the sale; the bookings it covers are worth 0.
            sales = await session.execute(
                select(PackagePurchase.client_id, func.sum(PackagePurchase.price_cents))
                .where(
                    counted_package_sale(workspace_id), PackagePurchase.client_id.in_(client_ids)
                )
                .group_by(PackagePurchase.client_id)
            )
            for client_id, paid in sales:
                current = stats.get(client_id, ClientStats())
                stats[client_id] = replace(
                    current, total_spent_cents=current.total_spent_cents + int(paid or 0)
                )
            return stats

    async def export_directory(
        self, workspace_id: UUID, search: str
    ) -> AsyncIterator[list[object]]:
        recent = datetime.now(UTC) - timedelta(days=ACTIVE_WINDOW_DAYS)
        live = Booking.status != BookingStatus.CANCELLED
        aggregate = (
            select(
                Booking.client_id.label("client_id"),
                func.count(Booking.id).label("total"),
                func.count(Booking.id)
                .filter(Booking.status == BookingStatus.COMPLETED)
                .label("completed"),
                func.count(Booking.id)
                .filter(Booking.status == BookingStatus.CANCELLED)
                .label("cancelled"),
                func.coalesce(
                    func.sum(Booking.amount_cents).filter(
                        Booking.payment_status == PaymentStatus.PAID
                    ),
                    0,
                ).label("spent"),
                func.count(Booking.id).filter(live).label("live"),
                func.count(Booking.id).filter(live & (Session.start_at >= recent)).label("recent"),
            )
            .join(
                Session, (Session.id == Booking.session_id) & (Session.workspace_id == workspace_id)
            )
            .where(Booking.workspace_id == workspace_id)
            .group_by(Booking.client_id)
            .subquery()
        )
        sales = (
            select(
                PackagePurchase.client_id.label("client_id"),
                func.sum(PackagePurchase.price_cents).label("paid"),
            )
            .where(counted_package_sale(workspace_id))
            .group_by(PackagePurchase.client_id)
            .subquery()
        )
        statement = (
            select(
                Client,
                aggregate.c.total,
                aggregate.c.completed,
                aggregate.c.cancelled,
                (func.coalesce(aggregate.c.spent, 0) + func.coalesce(sales.c.paid, 0)).label(
                    "spent"
                ),
                aggregate.c.live,
                aggregate.c.recent,
                Workspace.currency,
            )
            .join(Workspace, Workspace.id == Client.workspace_id)
            .outerjoin(aggregate, aggregate.c.client_id == Client.id)
            .outerjoin(sales, sales.c.client_id == Client.id)
            .where(Client.workspace_id == workspace_id)
        )
        if search.strip():
            pattern = (
                "%" + search.strip().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"
            )
            statement = statement.where(
                or_(
                    Client.name.ilike(pattern, escape="!"),
                    Client.email.ilike(pattern, escape="!"),
                    Client.company.ilike(pattern, escape="!"),
                )
            )
        async with self.database.tenant_transaction(workspace_id, repeatable_read=True) as session:
            result = await session.stream(
                statement.order_by(Client.created_at.desc(), Client.id).execution_options(
                    yield_per=500
                )
            )
            try:
                async for (
                    client,
                    total,
                    completed,
                    cancelled,
                    spent,
                    live_total,
                    recent_live,
                    currency,
                ) in result:
                    yield [
                        client.name,
                        client.email,
                        client.phone or "",
                        client.company or "",
                        "active" if recent_live else "dormant" if live_total else "new",
                        total or 0,
                        completed or 0,
                        cancelled or 0,
                        f"{(spent or 0) / 100:.2f}",
                        currency,
                        client.created_at.date().isoformat(),
                    ]
            finally:
                await result.close()

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
            return await self.create_in_session(session, workspace_id, actor_user_id, values)

    @staticmethod
    async def create_in_session(
        session: AsyncSession, workspace_id: UUID, actor_user_id: UUID, values: Mapping[str, Any]
    ) -> Client:
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
            if getattr(
                exc.orig, "sqlstate", None
            ) == "23505" and "uq_clients_workspace_id_email" in str(exc.orig):
                raise ClientEmailConflictError from exc
            raise
        await session.refresh(client)
        return client

    async def update_client(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        client_id: UUID,
        changes: Mapping[str, Any],
        expected_version: int | None = None,
        email_transfer_confirmed: bool = False,
        idempotency_key: str | None = None,
    ) -> Client | None:
        async with self.database.tenant_transaction(workspace_id, scheduling_write=True) as session:
            client = await session.scalar(
                select(Client)
                .where(Client.id == client_id, Client.workspace_id == workspace_id)
                .with_for_update()
            )
            if client is None:
                return None
            fingerprint = sha256(
                json.dumps(dict(changes), sort_keys=True, default=str).encode()
            ).hexdigest()
            if idempotency_key:
                replay = await session.scalar(
                    select(ClientEmailCommand).where(
                        ClientEmailCommand.workspace_id == workspace_id,
                        ClientEmailCommand.actor_user_id == actor_user_id,
                        ClientEmailCommand.idempotency_key == idempotency_key,
                    )
                )
                if replay:
                    if replay.client_id != client_id or replay.fingerprint != fingerprint:
                        raise ApiError(
                            status_code=409,
                            code="idempotency_key_reused",
                            message="This edit changed; review and retry.",
                        )
                    return client
            ensure_version(client, expected_version)
            if client.erased_at:
                raise ApiError(
                    status_code=409,
                    code="client_erased",
                    message="Erased clients cannot be edited.",
                )
            transfer = None
            if "email" in changes and changes["email"] != client.email:
                if not email_transfer_confirmed or not idempotency_key:
                    raise ApiError(
                        status_code=409,
                        code="client_email_review_required",
                        message="Confirm the transfer of account and booking-email access.",
                    )
                transfer = await session.scalar(
                    text("SELECT public.slotera_client_contact_prepare(:client,:email)"),
                    {"client": client_id, "email": changes["email"]},
                )
                if transfer is None:
                    raise ApiError(
                        status_code=409,
                        code="booking_email_in_progress",
                        message="An email is being sent; no changes were saved. Try again later.",
                    )

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
            if transfer is not None:
                for booking_value in transfer["summaries"]:
                    booking = await session.scalar(
                        select(Booking).where(
                            Booking.workspace_id == workspace_id, Booking.id == UUID(booking_value)
                        )
                    )
                    occurrence = await session.get(Session, booking.session_id) if booking else None
                    if booking and occurrence:
                        await emit_booking_event(
                            session,
                            workspace_id=workspace_id,
                            booking_id=booking.id,
                            session_ends_at=occurrence.end_at,
                            event="details",
                            event_key=str(uuid4()),
                            operator_notification=False,
                        )
                for followup_data in transfer["followups"]:
                    booking_value = followup_data["bookingId"]
                    booking = await session.scalar(
                        select(Booking).where(
                            Booking.workspace_id == workspace_id, Booking.id == UUID(booking_value)
                        )
                    )
                    followup = await session.scalar(
                        select(BookingFollowup).where(
                            BookingFollowup.workspace_id == workspace_id,
                            BookingFollowup.booking_id == UUID(booking_value),
                        )
                    )
                    if booking and followup:
                        await queue_followup(
                            session,
                            booking,
                            followup,
                            manual=bool(followup_data["manual"]),
                            event_key=str(uuid4()),
                        )
                session.add(
                    ClientEmailCommand(
                        workspace_id=workspace_id,
                        actor_user_id=actor_user_id,
                        client_id=client_id,
                        idempotency_key=idempotency_key,
                        fingerprint=fingerprint,
                    )
                )
                await session.flush()
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
            snapshots = (
                list(
                    (
                        await session.scalars(
                            select(BookingFormSnapshot).where(
                                BookingFormSnapshot.workspace_id == workspace_id,
                                BookingFormSnapshot.booking_id.in_(references),
                            )
                        )
                    ).all()
                )
                if references
                else []
            )
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
            communication = await session.scalar(
                text("""
                SELECT jsonb_build_object(
                  'messages',coalesce((
                    SELECT jsonb_agg(to_jsonb(m) ORDER BY m.sequence)
                    FROM conversation_messages m
                    WHERE m.workspace_id=:workspace AND m.conversation_id=:client
                  ),'[]'::jsonb),
                  'followups',coalesce((
                    SELECT jsonb_agg(to_jsonb(f)-'commands') FROM booking_followups f
                    JOIN bookings b ON b.workspace_id=f.workspace_id AND b.id=f.booking_id
                    WHERE b.workspace_id=:workspace AND b.client_id=:client
                  ),'[]'::jsonb),
                  'preferences',jsonb_build_object(
                    'language',CAST(:language AS text),
                    'messageDigestEnabled',CAST(:digest AS boolean),
                    'automaticFollowupEnabled',CAST(:followup AS boolean)
                  )
                )
            """),
                {
                    "workspace": workspace_id,
                    "client": client_id,
                    "language": client.preferred_language,
                    "digest": client.message_digest_enabled,
                    "followup": client.automatic_followup_enabled,
                },
            )
            return {
                "communication": communication,
                "booking_emails": await export_email_history(session, client_id=client_id),
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
                        "email_contact": booking.delivery_email_override or booking.customer_email,
                        "customer_phone": booking.customer_phone,
                        "customer_company": booking.customer_company,
                        "billing_address": booking.billing_address,
                        "notes": booking.notes,
                        "created_at": booking.created_at,
                    }
                    for booking, start_at, service_name in bookings
                ],
                "form_snapshots": [
                    {
                        "booking_reference": references[item.booking_id],
                        "assignment_id": str(item.id),
                        "assignment_kind": item.assignment_kind,
                        "response_deadline": item.response_deadline.isoformat()
                        if item.response_deadline
                        else None,
                        "name": item.name,
                        "description": item.description,
                        "fields": item.fields,
                        "required_before_payment": item.required_before_payment,
                    }
                    for item in snapshots
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
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        client_id: UUID,
        confirm_email: str,
        expected_version: int | None = None,
    ) -> Literal["erased", "not_found", "confirmation_mismatch"]:
        """Anonymise a client on request, keeping only the financial facts of their bookings.

        Amounts, tax, currency and payment state stay (bookkeeping); names, contact
        details, billing addresses, form answers, notes, manage links and queued or sent
        booking emails go.
        """
        async with self.database.tenant_transaction(workspace_id, scheduling_write=True) as session:
            client = await session.scalar(
                select(Client)
                .where(Client.id == client_id, Client.workspace_id == workspace_id)
                .with_for_update()
            )
            if client is None:
                return "not_found"
            ensure_version(client, expected_version)
            if confirm_email.strip().lower() != client.email:
                return "confirmation_mismatch"
            booking_ids = list(
                await session.scalars(
                    select(Booking.id)
                    .where(Booking.workspace_id == workspace_id, Booking.client_id == client_id)
                    .order_by(Booking.id)
                    .with_for_update()
                )
            )
            prepared = await session.scalar(
                text("SELECT public.slotera_client_contact_prepare(:client,NULL)"),
                {"client": client_id},
            )
            if prepared is None:
                raise ApiError(
                    status_code=409,
                    code="booking_email_in_progress",
                    message="An email is being sent; retry erasure later.",
                )
            await session.execute(
                text("SELECT public.slotera_client_erase_context(:client)"), {"client": client_id}
            )
            client.erased_at = datetime.now(UTC)
            client.preferred_language = "en"
            client.message_digest_enabled = False
            client.automatic_followup_enabled = False
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
            # Package sales keep their money facts; the operator's note about them goes.
            await session.execute(
                update(PackagePurchase)
                .where(
                    PackagePurchase.workspace_id == workspace_id,
                    PackagePurchase.client_id == client_id,
                    PackagePurchase.notes.is_not(None),
                )
                .values(notes=None, version=PackagePurchase.version + 1)
            )
            if booking_ids:
                await session.execute(
                    delete(BookingFormSnapshot).where(
                        BookingFormSnapshot.workspace_id == workspace_id,
                        BookingFormSnapshot.booking_id.in_(booking_ids),
                    )
                )
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
                        delivery_email_override=None,
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
