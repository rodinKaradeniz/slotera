import json
from collections.abc import AsyncIterator, Mapping
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from hashlib import sha256
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Select, String, cast, func, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.booking_access import emit_booking_event, notify_client_moved
from slotera_api.booking_financials import financial_snapshot, quote_for
from slotera_api.clients.repository import ClientsRepository
from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    Booking,
    BookingAccessToken,
    BookingApprovalStatus,
    BookingAttendance,
    BookingCommandIdempotency,
    BookingFollowup,
    BookingOrigin,
    BookingStatus,
    Client,
    ConfirmationPolicy,
    PaymentStatus,
    Service,
    Session,
    SessionSeries,
    SessionStatus,
    Workspace,
    WorkspacePaymentSettings,
)
from slotera_api.errors import ApiError
from slotera_api.followups import queue_followup, snapshot_followup
from slotera_api.packages.purchases import claim_item, package_summary
from slotera_api.session_capacity import CAPACITY_CONSUMING_STATUSES, release_public_session


class BookingCapacityExceededError(Exception):
    pass


class BookingIdempotencyConflictError(Exception):
    pass


class BookingTransitionError(Exception):
    pass


class BookingAttendanceError(Exception):
    pass


class BookingApprovalError(Exception):
    pass


class BookingPaymentError(Exception):
    pass


class BookingMoveError(Exception):
    """The chosen session can't take this booking (other service, past, cancelled, same)."""


@dataclass(frozen=True)
class BookingCommandResult:
    booking: Booking
    replayed: bool


_TRANSITIONS: dict[str, tuple[BookingStatus, tuple[BookingStatus, ...]]] = {
    "confirm": (BookingStatus.CONFIRMED, (BookingStatus.PENDING,)),
    "cancel": (BookingStatus.CANCELLED, (BookingStatus.PENDING, BookingStatus.CONFIRMED)),
    "complete": (BookingStatus.COMPLETED, (BookingStatus.CONFIRMED,)),
    "noshow": (BookingStatus.NOSHOW, (BookingStatus.CONFIRMED,)),
}
_AUDIT_ACTIONS = {
    "confirm": "booking.confirmed",
    "cancel": "booking.cancelled",
    "complete": "booking.completed",
    "noshow": "booking.noshow",
}


@dataclass(frozen=True)
class _Command:
    """One idempotent booking command: who issued it, under which key, and what it asked for."""

    workspace_id: UUID
    actor_user_id: UUID
    idempotency_key: str
    name: str
    fingerprint: str


def _command(
    workspace_id: UUID,
    actor_user_id: UUID,
    idempotency_key: str,
    name: str,
    values: Mapping[str, Any],
) -> _Command:
    return _Command(workspace_id, actor_user_id, idempotency_key, name, _fingerprint(name, values))


def _fingerprint(command: str, values: Mapping[str, Any]) -> str:
    serialized = json.dumps(
        {"command": command, **values},
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return sha256(serialized.encode()).hexdigest()


def _confirmation_ready(booking: Booking) -> bool:
    return booking.payment_status in (PaymentStatus.FREE, PaymentStatus.PAID) and (
        booking.approval_status
        in (BookingApprovalStatus.NOT_REQUIRED, BookingApprovalStatus.APPROVED)
    )


def _summary_base(
    workspace_id: UUID, search: str, client_id: UUID | None, service_id: UUID | None
) -> Select[Any]:
    predicate = Booking.workspace_id == workspace_id
    if client_id is not None:
        predicate &= Booking.client_id == client_id
    if service_id is not None:
        predicate &= Session.service_id == service_id
    if search.strip():
        escaped = search.strip().replace("!", "!!").replace("%", "!%").replace("_", "!_")
        pattern = f"%{escaped}%"
        predicate &= or_(
            Client.name.ilike(pattern, escape="!"),
            Service.name.ilike(pattern, escape="!"),
            cast(Booking.id, String).ilike(pattern, escape="!"),
        )
    base = (
        select(Booking.id)
        .join(
            Session,
            (Session.id == Booking.session_id) & (Session.workspace_id == workspace_id),
        )
        .join(
            Service,
            (Service.id == Session.service_id) & (Service.workspace_id == workspace_id),
        )
        .join(Client, (Client.id == Booking.client_id) & (Client.workspace_id == workspace_id))
        .where(predicate)
    )
    return base


class BookingsRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def list_bookings(
        self,
        workspace_id: UUID,
        *,
        limit: int,
        offset: int,
        session_id: UUID | None = None,
        client_id: UUID | None = None,
    ) -> tuple[list[Booking], int]:
        async with self.database.tenant_transaction(workspace_id) as session:
            predicate = Booking.workspace_id == workspace_id
            if session_id is not None:
                predicate = predicate & (Booking.session_id == session_id)
            if client_id is not None:
                predicate = predicate & (Booking.client_id == client_id)
            total = await session.scalar(select(func.count(Booking.id)).where(predicate))
            items = list(
                (
                    await session.scalars(
                        select(Booking)
                        .where(predicate)
                        .order_by(Booking.created_at.desc(), Booking.id)
                        .limit(limit)
                        .offset(offset)
                    )
                ).all()
            )
            return items, int(total or 0)

    async def list_summaries(
        self,
        workspace_id: UUID,
        *,
        limit: int,
        offset: int,
        search: str = "",
        status: str | None = None,
        client_id: UUID | None = None,
        service_id: UUID | None = None,
        session_id: UUID | None = None,
        attendance_only: bool = False,
    ) -> tuple[list[dict[str, Any]], int, dict[str, int], dict[str, list[dict[str, Any]]], int]:
        async with self.database.tenant_transaction(workspace_id, repeatable_read=True) as session:
            base = _summary_base(workspace_id, search, client_id, service_id)
            if session_id is not None:
                base = base.where(Booking.session_id == session_id)
            if attendance_only:
                base = base.where(
                    Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED])
                )
            count_rows = (
                await session.execute(
                    base.with_only_columns(
                        Booking.status,
                        func.count(Booking.id),
                        func.count(Booking.id).filter(
                            Booking.payment_status == PaymentStatus.PENDING
                        ),
                    ).group_by(Booking.status)
                )
            ).all()
            counts = {key: int(value) for key, value, _ in count_rows}
            pending_payment_count = sum(int(pending) for _, _, pending in count_rows)
            statement = base.with_only_columns(
                Booking.id,
                Booking.client_id,
                Booking.session_id,
                Session.service_id,
                Booking.reference,
                Booking.attendance,
                Client.name.label("client_name"),
                Client.company.label("client_company"),
                Service.name.label("service_name"),
                Session.start_at,
                Booking.status,
                Booking.payment_status,
                Booking.amount_cents,
                Booking.currency,
                (Booking.payment_method == "package").label("covered_by_package"),
                Booking.created_at,
            )
            ranked = statement.add_columns(
                func.row_number()
                .over(partition_by=Booking.status, order_by=(Booking.created_at.desc(), Booking.id))
                .label("preview_rank")
            ).subquery()
            previews: dict[str, list[dict[str, Any]]] = {}
            for row in (
                await session.execute(
                    select(ranked)
                    .where(ranked.c.preview_rank <= 2)
                    .order_by(ranked.c.status, ranked.c.preview_rank)
                )
            ).mappings():
                previews.setdefault(str(row["status"]), []).append(
                    {key: value for key, value in row.items() if key != "preview_rank"}
                )
            if status is not None:
                statement = statement.where(Booking.status == status)
            rows = (
                (
                    await session.execute(
                        statement.order_by(Booking.created_at.desc(), Booking.id)
                        .limit(limit)
                        .offset(offset)
                    )
                )
                .mappings()
                .all()
            )
            normalized = {str(key): int(value) for key, value in counts.items()}
            return (
                [dict(row) for row in rows],
                (normalized.get(status, 0) if status else sum(normalized.values())),
                normalized,
                previews,
                pending_payment_count,
            )

    async def export_summaries(
        self,
        workspace_id: UUID,
        search: str,
        client_id: UUID | None,
        service_id: UUID | None,
    ) -> AsyncIterator[Mapping[str, Any]]:
        async with self.database.tenant_transaction(workspace_id, repeatable_read=True) as session:
            statement = (
                _summary_base(workspace_id, search, client_id, service_id)
                .with_only_columns(
                    Booking.reference,
                    Client.name,
                    Service.name.label("service_name"),
                    Session.start_at,
                    Booking.status,
                    Booking.payment_status,
                    Booking.amount_cents,
                    Booking.currency,
                )
                .order_by(Booking.created_at.desc(), Booking.id)
            )
            result = await session.stream(statement.execution_options(yield_per=500))
            try:
                async for row in result.mappings():
                    yield dict(row)
            finally:
                await result.close()

    async def get_detail(
        self, workspace_id: UUID, booking_id: UUID
    ) -> (
        tuple[Booking, Client, Session, Service, SessionSeries | None, int, tuple[str, int] | None]
        | None
    ):
        async with self.database.tenant_transaction(workspace_id, repeatable_read=True) as session:
            count = (
                select(func.count(Booking.id))
                .where(
                    Booking.workspace_id == workspace_id,
                    Booking.session_id == Session.id,
                    Booking.status.in_(CAPACITY_CONSUMING_STATUSES),
                )
                .correlate(Session)
                .scalar_subquery()
            )
            row = (
                await session.execute(
                    select(Booking, Client, Session, Service, SessionSeries, count)
                    .join(
                        Client,
                        (Client.id == Booking.client_id) & (Client.workspace_id == workspace_id),
                    )
                    .join(
                        Session,
                        (Session.id == Booking.session_id) & (Session.workspace_id == workspace_id),
                    )
                    .join(
                        Service,
                        (Service.id == Session.service_id) & (Service.workspace_id == workspace_id),
                    )
                    .outerjoin(
                        SessionSeries,
                        (SessionSeries.id == Session.series_id)
                        & (SessionSeries.workspace_id == workspace_id),
                    )
                    .where(Booking.workspace_id == workspace_id, Booking.id == booking_id)
                )
            ).one_or_none()
            if row is None:
                return None
            booking = row[0]
            package = (
                await package_summary(session, workspace_id, booking.package_purchase_id)
                if booking.package_purchase_id is not None
                else None
            )
            return (booking, row[1], row[2], row[3], row[4], int(row[5]), package)

    async def get_booking(self, workspace_id: UUID, booking_id: UUID) -> Booking | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            result = await session.scalar(
                select(Booking).where(
                    Booking.workspace_id == workspace_id, Booking.id == booking_id
                )
            )
            return result if isinstance(result, Booking) else None

    async def send_details(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        booking_id: UUID,
        recipient_email: str,
        idempotency_key: str,
        expected_recipient_email: str | None = None,
    ) -> BookingCommandResult | None:
        cmd = _command(
            workspace_id,
            actor_user_id,
            idempotency_key,
            "send_details",
            {
                "booking_id": str(booking_id),
                "recipient_email": recipient_email,
                "expected_recipient_email": expected_recipient_email,
            },
        )
        async with self.database.tenant_transaction(workspace_id, scheduling_write=True) as session:
            booking = await session.scalar(
                select(Booking)
                .where(Booking.workspace_id == workspace_id, Booking.id == booking_id)
                .with_for_update()
            )
            if booking is None:
                return None
            replay = await self._replay_or_conflict(session, cmd)
            if replay is not None:
                return BookingCommandResult(replay, True)
            if not booking.customer_email:
                raise ApiError(
                    status_code=409,
                    code="booking_email_erased",
                    message="Client data has been erased; email cannot be sent",
                )
            if expected_recipient_email is not None and expected_recipient_email != (
                booking.delivery_email_override or booking.customer_email
            ):
                raise ApiError(
                    status_code=409,
                    code="resource_stale",
                    message="The delivery address changed. Review it before sending.",
                )
            prepared = await session.scalar(
                text("SELECT public.slotera_booking_prepare_email_send(:booking_id)"),
                {"booking_id": booking_id},
            )
            if not prepared:
                raise ApiError(
                    status_code=409,
                    code="booking_email_sending",
                    message="An email is being sent. Retry shortly",
                )
            for scope, value, limit, window in (
                ("booking_email_send", str(booking_id), 5, 900),
                ("workspace_email_send", str(workspace_id), 30, 3600),
            ):
                allowed = await session.scalar(
                    text("SELECT public.slotera_rate_limit_consume(:scope,:key,:limit,:window)"),
                    {
                        "scope": scope,
                        "key": sha256(f"{workspace_id}:{value}".encode()).digest(),
                        "limit": limit,
                        "window": window,
                    },
                )
                if not allowed:
                    raise ApiError(
                        status_code=429,
                        code="rate_limit_exceeded",
                        message="Too many email requests. Try again later",
                    )
            changed = (booking.delivery_email_override or booking.customer_email) != recipient_email
            pending_followup = None
            if changed:
                pending_followup = await session.scalar(
                    text("SELECT public.slotera_followup_delivery(:id)"), {"id": booking.id}
                )
                if (
                    pending_followup
                    and pending_followup["pending"]
                    and not await session.scalar(
                        text("SELECT public.slotera_followup_suppress(:id)"), {"id": booking.id}
                    )
                ):
                    raise ApiError(
                        status_code=409,
                        code="booking_email_sending",
                        message="An email is being sent. Retry shortly.",
                    )
                booking.delivery_email_override = recipient_email
                await session.execute(
                    update(BookingAccessToken)
                    .where(
                        BookingAccessToken.workspace_id == workspace_id,
                        BookingAccessToken.booking_id == booking_id,
                        BookingAccessToken.revoked_at.is_(None),
                    )
                    .values(revoked_at=datetime.now(UTC))
                )
                session.add(
                    AuditEvent(
                        workspace_id=workspace_id,
                        actor_user_id=actor_user_id,
                        action="booking.email_contact_changed",
                        resource_type="booking",
                        resource_id=booking_id,
                        details={"fields": ["delivery_email_override"]},
                    )
                )
            occurrence = await session.scalar(
                select(Session).where(
                    Session.workspace_id == workspace_id, Session.id == booking.session_id
                )
            )
            if occurrence is None:
                raise BookingTransitionError
            await session.flush()
            if pending_followup and pending_followup["pending"]:
                followup = await session.scalar(
                    select(BookingFollowup)
                    .where(
                        BookingFollowup.workspace_id == workspace_id,
                        BookingFollowup.booking_id == booking.id,
                    )
                    .with_for_update()
                )
                if followup:
                    await queue_followup(
                        session,
                        booking,
                        followup,
                        manual=bool(pending_followup["manual"]),
                        event_key=str(uuid4()),
                    )
            queued = await emit_booking_event(
                session,
                workspace_id=workspace_id,
                booking_id=booking_id,
                session_ends_at=occurrence.end_at,
                event="details",
                event_key=f"{actor_user_id}:{idempotency_key}",
                operator_notification=False,
            )
            if not queued:
                raise ApiError(
                    status_code=409,
                    code="booking_email_unavailable",
                    message="Booking details could not be queued",
                )
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="booking.email_details_requested",
                    resource_type="booking",
                    resource_id=booking_id,
                    details={},
                )
            )
            await self._record_idempotency(session, cmd, booking_id)
            await session.flush()
            await session.refresh(booking)
            return BookingCommandResult(booking, False)

    async def create_operator_booking(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        values: Mapping[str, Any],
        idempotency_key: str,
    ) -> BookingCommandResult | None:
        session_id = values["session_id"]
        client_id = values.get("client_id")
        cmd = _command(
            workspace_id,
            actor_user_id,
            idempotency_key,
            "create",
            dict(values),
        )
        async with self.database.tenant_transaction(
            workspace_id, scheduling_write=True
        ) as database_session:
            # Client precedes session/booking locks, matching erasure's lock order.
            client = (
                await database_session.scalar(
                    select(Client)
                    .where(
                        Client.workspace_id == workspace_id,
                        Client.id == client_id,
                    )
                    .with_for_update()
                )
                if client_id is not None
                else None
            )
            package_purchase_id = values.get("package_purchase_id")
            locked = await database_session.execute(
                select(Session, Service, Workspace)
                .join(
                    Service,
                    (Service.workspace_id == Session.workspace_id)
                    & (Service.id == Session.service_id),
                )
                .join(Workspace, Workspace.id == Session.workspace_id)
                .where(Session.workspace_id == workspace_id, Session.id == session_id)
                .with_for_update(of=Session)
            )
            row = locked.one_or_none()
            if row is None:
                return None
            scheduled_session, service, workspace = row._tuple()
            replay = await self._replay_or_conflict(database_session, cmd)
            if replay is not None:
                return BookingCommandResult(booking=replay, replayed=True)
            payment_settings = await database_session.get(WorkspacePaymentSettings, workspace_id)
            if (
                (client is None and values.get("new_client") is None)
                or (client is not None and client.erased_at is not None)
                or payment_settings is None
                or scheduled_session.status != SessionStatus.SCHEDULED
                or scheduled_session.start_at <= datetime.now(UTC)
            ):
                return None
            consumed = await database_session.scalar(
                select(func.count(Booking.id)).where(
                    Booking.workspace_id == workspace_id,
                    Booking.session_id == session_id,
                    Booking.status.in_(CAPACITY_CONSUMING_STATUSES),
                )
            )
            if int(consumed or 0) >= scheduled_session.capacity:
                raise BookingCapacityExceededError
            if values.get("new_client") is not None:
                client = await ClientsRepository.create_in_session(
                    database_session, workspace_id, actor_user_id, values["new_client"]
                )
            assert client is not None
            client_id = client.id
            quote = quote_for(service, workspace, payment_settings)
            package_position: int | None = None
            if package_purchase_id is not None:
                # The purchase is locked after the client and session, as erasure orders it;
                # the package already paid for this session, so the booking is worth nothing.
                _, package_position = await claim_item(
                    database_session, workspace_id, package_purchase_id, client_id, service.id
                )
                quote = replace(quote, gross_amount_cents=0, net_amount_cents=0, tax_amount_cents=0)
            booking_id = uuid4()
            payment_status = (
                PaymentStatus.PAID
                if package_position is not None
                else PaymentStatus.FREE
                if service.price_cents == 0
                else PaymentStatus.PENDING
            )
            booking = Booking(
                id=booking_id,
                workspace_id=workspace_id,
                session_id=session_id,
                client_id=client_id,
                status=BookingStatus.CONFIRMED
                if payment_status in (PaymentStatus.FREE, PaymentStatus.PAID)
                else BookingStatus.PENDING,
                language=str(values.get("language", "en")),
                payment_status=payment_status,
                origin=BookingOrigin.OPERATOR,
                confirmation_policy_snapshot=ConfirmationPolicy.AUTOMATIC,
                approval_status=BookingApprovalStatus.NOT_REQUIRED,
                reference=f"SLT-{booking_id.hex[:12].upper()}",
                payment_method="package"
                if package_position is not None
                else "free"
                if service.price_cents == 0
                else "manual",
                package_purchase_id=package_purchase_id if package_position is not None else None,
                package_position=package_position,
                **financial_snapshot(quote, payment_settings),
                billing_address={},
                payment_due_at=None,
                payment_received_at=None,
                approved_at=None,
                declined_at=None,
                customer_first_name=client.name,
                customer_last_name="",
                customer_email=client.email,
                customer_phone=client.phone,
                customer_company=client.company,
                provider_terms_snapshot="",
                platform_terms_version="",
                terms_accepted_at=None,
                manual_payment_instructions_snapshot=(
                    payment_settings.manual_payment_instructions
                    if payment_status == PaymentStatus.PENDING
                    else ""
                ),
                notes=values.get("notes"),
            )
            database_session.add(booking)
            await database_session.flush()
            from slotera_api.booking_forms import snapshot_forms

            await snapshot_forms(database_session, workspace_id, booking.id, service.id)
            database_session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="booking.created",
                    resource_type="booking",
                    resource_id=booking.id,
                    details={
                        "audit_reason": values["audit_reason"],
                        "session_id": str(session_id),
                        "client_id": str(client_id),
                        **(
                            {
                                "package_purchase_id": str(package_purchase_id),
                                "package_position": package_position,
                            }
                            if package_position is not None
                            else {}
                        ),
                    },
                )
            )
            await self._record_idempotency(database_session, cmd, booking.id)
            await database_session.flush()
            if values.get("send_email", True):
                emitted = await emit_booking_event(
                    database_session,
                    workspace_id=workspace_id,
                    booking_id=booking.id,
                    session_ends_at=scheduled_session.end_at,
                    event="confirmed" if booking.status == BookingStatus.CONFIRMED else "received",
                    operator_notification=False,
                )
                if not emitted:
                    raise RuntimeError("initial booking email could not be queued")
            await database_session.refresh(booking)
            return BookingCommandResult(booking=booking, replayed=False)

    async def move_booking(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        booking_id: UUID,
        values: Mapping[str, Any],
        idempotency_key: str,
    ) -> BookingCommandResult | None:
        """Move a pending or confirmed booking to another upcoming session of its service.

        The client's price and payment facts stay as booked. Every booking origin
        receives a current-time summary without notifying the operator of their own action.
        """
        target_id = values["session_id"]
        cmd = _command(
            workspace_id,
            actor_user_id,
            idempotency_key,
            "move",
            {
                "booking_id": str(booking_id),
                "session_id": str(target_id),
                "audit_reason": values["audit_reason"],
            },
        )
        async with self.database.tenant_transaction(
            workspace_id, scheduling_write=True
        ) as database_session:
            booking = await database_session.scalar(
                select(Booking)
                .where(Booking.workspace_id == workspace_id, Booking.id == booking_id)
                .with_for_update()
            )
            if booking is None:
                return None
            # Lock both sessions in id order so two opposite moves cannot deadlock.
            sessions = {
                item.id: item
                for item in (
                    await database_session.scalars(
                        select(Session)
                        .where(
                            Session.workspace_id == workspace_id,
                            Session.id.in_([booking.session_id, target_id]),
                        )
                        .order_by(Session.id)
                        .with_for_update()
                    )
                ).all()
            }
            previous = sessions.get(booking.session_id)
            target = sessions.get(target_id)
            if previous is None:
                return None
            replay = await self._replay_or_conflict(database_session, cmd)
            if replay is not None:
                return BookingCommandResult(booking=replay, replayed=True)
            if booking.status not in CAPACITY_CONSUMING_STATUSES:
                raise BookingTransitionError
            if (
                target is None
                or target.id == previous.id
                or target.service_id != previous.service_id
                or target.status == SessionStatus.CANCELLED
                or target.start_at <= datetime.now(UTC)
            ):
                raise BookingMoveError
            consumed = await database_session.scalar(
                select(func.count(Booking.id)).where(
                    Booking.workspace_id == workspace_id,
                    Booking.session_id == target.id,
                    Booking.status.in_(CAPACITY_CONSUMING_STATUSES),
                )
            )
            if int(consumed or 0) >= target.capacity:
                raise BookingCapacityExceededError
            booking.session_id = target.id
            database_session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="booking.moved",
                    resource_type="booking",
                    resource_id=booking.id,
                    details={
                        "audit_reason": values["audit_reason"],
                        "from_session_id": str(previous.id),
                        "to_session_id": str(target.id),
                    },
                )
            )
            await self._record_idempotency(database_session, cmd, booking.id)
            await database_session.flush()
            await release_public_session(database_session, workspace_id, booking, previous)
            if booking.customer_email:
                await notify_client_moved(
                    database_session,
                    workspace_id=workspace_id,
                    booking_id=booking.id,
                    session_ends_at=target.end_at,
                )
            await database_session.refresh(booking)
            return BookingCommandResult(booking=booking, replayed=False)

    async def record_attendance(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        booking_id: UUID,
        attendance: BookingAttendance,
        idempotency_key: str,
    ) -> BookingCommandResult | None:
        cmd = _command(
            workspace_id,
            actor_user_id,
            idempotency_key,
            "attendance",
            {"booking_id": str(booking_id), "attendance": attendance.value},
        )
        async with self.database.tenant_transaction(
            workspace_id, scheduling_write=True
        ) as database_session:
            booking = await database_session.scalar(
                select(Booking)
                .where(Booking.workspace_id == workspace_id, Booking.id == booking_id)
                .with_for_update()
            )
            if booking is None:
                return None
            scheduled_session = await database_session.scalar(
                select(Session)
                .where(
                    Session.workspace_id == workspace_id,
                    Session.id == booking.session_id,
                )
                .with_for_update()
            )
            if scheduled_session is None:
                return None
            replay = await self._replay_or_conflict(database_session, cmd)
            if replay is not None:
                return BookingCommandResult(booking=replay, replayed=True)
            if scheduled_session.capacity <= 1 or booking.status not in (
                BookingStatus.CONFIRMED,
                BookingStatus.COMPLETED,
            ):
                raise BookingAttendanceError
            previous_status = booking.status
            previous_attendance = booking.attendance
            booking.status = BookingStatus.COMPLETED
            booking.attendance = attendance
            if previous_status != BookingStatus.COMPLETED:
                await snapshot_followup(database_session, booking)
            database_session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="booking.attendance_recorded",
                    resource_type="booking",
                    resource_id=booking.id,
                    details={
                        "previous_status": previous_status.value,
                        "status": booking.status.value,
                        "previous_attendance": (
                            previous_attendance.value if previous_attendance is not None else None
                        ),
                        "attendance": attendance.value,
                    },
                )
            )
            await self._record_idempotency(database_session, cmd, booking.id)
            await database_session.flush()
            await database_session.refresh(booking)
            return BookingCommandResult(booking=booking, replayed=False)

    async def record_payment_received(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        booking_id: UUID,
        idempotency_key: str,
    ) -> BookingCommandResult | None:
        command = "mark_payment_received"
        cmd = _command(
            workspace_id, actor_user_id, idempotency_key, command, {"booking_id": str(booking_id)}
        )
        async with self.database.tenant_transaction(
            workspace_id, scheduling_write=True
        ) as database_session:
            locked = await self._lock_booking_and_session(
                database_session, workspace_id, booking_id
            )
            if locked is None:
                return None
            booking, _scheduled_session = locked
            replay = await self._replay_or_conflict(database_session, cmd)
            if replay is not None:
                return BookingCommandResult(booking=replay, replayed=True)
            if (
                booking.payment_method != "manual"
                or booking.payment_status != PaymentStatus.PENDING
                or booking.status != BookingStatus.PENDING
            ):
                raise BookingPaymentError

            booking.payment_status = PaymentStatus.PAID
            booking.payment_received_at = datetime.now(UTC)
            confirmed = _confirmation_ready(booking)
            if confirmed:
                booking.status = BookingStatus.CONFIRMED
            database_session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="booking.payment_received",
                    resource_type="booking",
                    resource_id=booking.id,
                    details={"payment_status": "paid", "confirmed": confirmed},
                )
            )
            if confirmed:
                self._add_confirmation_audit(
                    database_session, workspace_id, actor_user_id, booking, command
                )
            await self._record_idempotency(database_session, cmd, booking.id)
            await database_session.flush()
            if confirmed:
                await self._emit_confirmed_event(database_session, booking)
            await database_session.refresh(booking)
            return BookingCommandResult(booking=booking, replayed=False)

    async def set_approval(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        booking_id: UUID,
        command: str,
        idempotency_key: str,
    ) -> BookingCommandResult | None:
        if command not in {"approve", "decline"}:
            raise ValueError("unknown booking approval command")
        cmd = _command(
            workspace_id, actor_user_id, idempotency_key, command, {"booking_id": str(booking_id)}
        )
        async with self.database.tenant_transaction(
            workspace_id, scheduling_write=True
        ) as database_session:
            locked = await self._lock_booking_and_session(
                database_session, workspace_id, booking_id
            )
            if locked is None:
                return None
            booking, scheduled_session = locked
            replay = await self._replay_or_conflict(database_session, cmd)
            if replay is not None:
                return BookingCommandResult(booking=replay, replayed=True)
            if (
                booking.confirmation_policy_snapshot != ConfirmationPolicy.OPERATOR_APPROVAL
                or booking.approval_status != BookingApprovalStatus.PENDING
                or booking.status != BookingStatus.PENDING
            ):
                raise BookingApprovalError

            confirmed = False
            if command == "approve":
                booking.approval_status = BookingApprovalStatus.APPROVED
                booking.approved_at = datetime.now(UTC)
                confirmed = _confirmation_ready(booking)
                if confirmed:
                    booking.status = BookingStatus.CONFIRMED
            else:
                booking.approval_status = BookingApprovalStatus.DECLINED
                booking.declined_at = datetime.now(UTC)
                booking.status = BookingStatus.CANCELLED

            database_session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action=f"booking.{command}d",
                    resource_type="booking",
                    resource_id=booking.id,
                    details={
                        "approval_status": booking.approval_status.value,
                        "payment_status": booking.payment_status.value,
                        "confirmed": confirmed,
                    },
                )
            )
            if confirmed:
                self._add_confirmation_audit(
                    database_session, workspace_id, actor_user_id, booking, command
                )
            await self._record_idempotency(database_session, cmd, booking.id)
            await database_session.flush()
            if command == "decline":
                await emit_booking_event(
                    database_session,
                    workspace_id=workspace_id,
                    booking_id=booking.id,
                    session_ends_at=scheduled_session.end_at,
                    event="cancelled",
                    operator_notification=False,
                )
                await release_public_session(
                    database_session, workspace_id, booking, scheduled_session
                )
            if confirmed:
                await self._emit_confirmed_event(database_session, booking)
            await database_session.refresh(booking)
            return BookingCommandResult(booking=booking, replayed=False)

    async def transition_booking(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        booking_id: UUID,
        command: str,
        idempotency_key: str,
    ) -> BookingCommandResult | None:
        target, allowed = _TRANSITIONS[command]
        cmd = _command(
            workspace_id,
            actor_user_id,
            idempotency_key,
            command,
            {"booking_id": str(booking_id)},
        )
        async with self.database.tenant_transaction(
            workspace_id, scheduling_write=True
        ) as database_session:
            locked = await self._lock_booking_and_session(
                database_session, workspace_id, booking_id
            )
            if locked is None:
                return None
            booking, scheduled_session = locked
            replay = await self._replay_or_conflict(database_session, cmd)
            if replay is not None:
                return BookingCommandResult(booking=replay, replayed=True)
            if booking.status not in allowed:
                raise BookingTransitionError
            if command == "confirm" and not _confirmation_ready(booking):
                raise BookingTransitionError
            previous_status = booking.status
            booking.status = target
            database_session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action=_AUDIT_ACTIONS[command],
                    resource_type="booking",
                    resource_id=booking.id,
                    details={
                        "previous_status": previous_status.value,
                        "status": target.value,
                    },
                )
            )
            await self._record_idempotency(database_session, cmd, booking.id)
            await database_session.flush()
            if command == "cancel":
                await release_public_session(
                    database_session, workspace_id, booking, scheduled_session
                )
            if command == "cancel" and booking.customer_email:
                await emit_booking_event(
                    database_session,
                    workspace_id=workspace_id,
                    booking_id=booking.id,
                    session_ends_at=scheduled_session.end_at,
                    event="cancelled",
                    operator_notification=False,
                )
            if command == "complete":
                await snapshot_followup(database_session, booking)
            if command == "confirm":
                await self._emit_confirmed_event(database_session, booking)
            await database_session.refresh(booking)
            return BookingCommandResult(booking=booking, replayed=False)

    @staticmethod
    async def _lock_booking_and_session(
        database_session: AsyncSession,
        workspace_id: UUID,
        booking_id: UUID,
    ) -> tuple[Booking, Session] | None:
        booking = await database_session.scalar(
            select(Booking)
            .where(Booking.workspace_id == workspace_id, Booking.id == booking_id)
            .with_for_update()
        )
        if booking is None:
            return None
        scheduled_session = await database_session.scalar(
            select(Session)
            .where(
                Session.workspace_id == workspace_id,
                Session.id == booking.session_id,
            )
            .with_for_update()
        )
        if scheduled_session is None:
            return None
        return booking, scheduled_session

    @staticmethod
    def _add_confirmation_audit(
        database_session: AsyncSession,
        workspace_id: UUID,
        actor_user_id: UUID,
        booking: Booking,
        trigger: str,
    ) -> None:
        database_session.add(
            AuditEvent(
                workspace_id=workspace_id,
                actor_user_id=actor_user_id,
                action="booking.confirmed",
                resource_type="booking",
                resource_id=booking.id,
                details={"trigger": trigger},
            )
        )

    @staticmethod
    async def _emit_confirmed_event(
        database_session: AsyncSession,
        booking: Booking,
    ) -> None:
        if not booking.customer_email:
            return
        scheduled_session = await database_session.scalar(
            select(Session).where(
                Session.workspace_id == booking.workspace_id,
                Session.id == booking.session_id,
            )
        )
        if scheduled_session is None:
            raise RuntimeError("booking confirmation lost its session")
        emitted = await emit_booking_event(
            database_session,
            workspace_id=booking.workspace_id,
            booking_id=booking.id,
            session_ends_at=scheduled_session.end_at,
            event="confirmed",
            operator_notification=False,
        )
        if not emitted:
            raise RuntimeError("booking confirmation event could not be enqueued")

    async def _replay_or_conflict(
        self, database_session: AsyncSession, cmd: _Command
    ) -> Booking | None:
        record = await database_session.scalar(
            select(BookingCommandIdempotency).where(
                BookingCommandIdempotency.workspace_id == cmd.workspace_id,
                BookingCommandIdempotency.actor_user_id == cmd.actor_user_id,
                BookingCommandIdempotency.idempotency_key == cmd.idempotency_key,
            )
        )
        if record is None:
            return None
        if record.request_fingerprint != cmd.fingerprint:
            raise BookingIdempotencyConflictError
        booking = await database_session.scalar(
            select(Booking).where(
                Booking.workspace_id == cmd.workspace_id,
                Booking.id == record.booking_id,
            )
        )
        if booking is None:
            raise RuntimeError("booking command idempotency record lost its booking")
        return booking

    async def _record_idempotency(
        self, database_session: AsyncSession, cmd: _Command, booking_id: UUID
    ) -> None:
        statement = (
            insert(BookingCommandIdempotency)
            .values(
                id=uuid4(),
                workspace_id=cmd.workspace_id,
                actor_user_id=cmd.actor_user_id,
                idempotency_key=cmd.idempotency_key,
                command=cmd.name,
                request_fingerprint=cmd.fingerprint,
                booking_id=booking_id,
            )
            .on_conflict_do_nothing(
                index_elements=["workspace_id", "actor_user_id", "idempotency_key"]
            )
            .returning(BookingCommandIdempotency.id)
        )
        inserted = await database_session.scalar(statement)
        if inserted is not None:
            return
        replay = await self._replay_or_conflict(database_session, cmd)
        if replay is None:
            raise RuntimeError("booking command idempotency record was not persisted")
