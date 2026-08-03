import json
from collections.abc import Mapping
from dataclasses import dataclass
from hashlib import sha256
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    Booking,
    BookingAttendance,
    BookingCommandIdempotency,
    BookingStatus,
    Client,
    PaymentStatus,
    Service,
    Session,
    SessionStatus,
    Workspace,
)


class BookingCapacityExceededError(Exception):
    pass


class BookingIdempotencyConflictError(Exception):
    pass


class BookingTransitionError(Exception):
    pass


class BookingAttendanceError(Exception):
    pass


@dataclass(frozen=True)
class BookingCommandResult:
    booking: Booking
    replayed: bool


_CAPACITY_CONSUMING_STATUSES = (BookingStatus.PENDING, BookingStatus.CONFIRMED)
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


def _fingerprint(command: str, values: Mapping[str, Any]) -> str:
    serialized = json.dumps(
        {"command": command, **values},
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return sha256(serialized.encode()).hexdigest()


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
    ) -> tuple[list[Booking], int]:
        async with self.database.tenant_transaction(workspace_id) as session:
            predicate = Booking.workspace_id == workspace_id
            if session_id is not None:
                predicate = predicate & (Booking.session_id == session_id)
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

    async def get_booking(self, workspace_id: UUID, booking_id: UUID) -> Booking | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            result = await session.scalar(
                select(Booking).where(
                    Booking.workspace_id == workspace_id, Booking.id == booking_id
                )
            )
            return result if isinstance(result, Booking) else None

    async def create_operator_booking(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        values: Mapping[str, Any],
        idempotency_key: str,
    ) -> BookingCommandResult | None:
        session_id = values["session_id"]
        client_id = values["client_id"]
        fingerprint = _fingerprint(
            "create",
            {
                "client_id": str(client_id),
                "session_id": str(session_id),
                "notes": values.get("notes"),
                "audit_reason": values["audit_reason"],
            },
        )
        async with self.database.tenant_transaction(workspace_id) as database_session:
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
            replay = await self._replay_or_conflict(
                database_session,
                workspace_id,
                actor_user_id,
                idempotency_key,
                fingerprint,
            )
            if replay is not None:
                return BookingCommandResult(booking=replay, replayed=True)
            client_exists = await database_session.scalar(
                select(Client.id).where(
                    Client.workspace_id == workspace_id,
                    Client.id == client_id,
                )
            )
            if client_exists is None or scheduled_session.status == SessionStatus.CANCELLED:
                return None
            consumed = await database_session.scalar(
                select(func.count(Booking.id)).where(
                    Booking.workspace_id == workspace_id,
                    Booking.session_id == session_id,
                    Booking.status.in_(_CAPACITY_CONSUMING_STATUSES),
                )
            )
            if int(consumed or 0) >= scheduled_session.capacity:
                raise BookingCapacityExceededError
            booking_id = uuid4()
            booking = Booking(
                id=booking_id,
                workspace_id=workspace_id,
                session_id=session_id,
                client_id=client_id,
                status=BookingStatus.PENDING,
                payment_status=PaymentStatus.PENDING,
                reference=f"SLT-{booking_id.hex[:12].upper()}",
                payment_method="free" if service.price_cents == 0 else "manual",
                amount_cents=service.price_cents,
                net_amount_cents=service.price_cents,
                tax_amount_cents=0,
                tax_treatment="none",
                tax_rate_bps=0,
                tax_label=None,
                tax_jurisdiction=None,
                seller_tax_number=None,
                currency=workspace.currency,
                billing_address={},
                payment_due_at=None,
                notes=values.get("notes"),
            )
            database_session.add(booking)
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
                    },
                )
            )
            await self._record_idempotency(
                database_session,
                workspace_id,
                actor_user_id,
                idempotency_key,
                "create",
                fingerprint,
                booking.id,
            )
            await database_session.flush()
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
        fingerprint = _fingerprint(
            "attendance",
            {"booking_id": str(booking_id), "attendance": attendance.value},
        )
        async with self.database.tenant_transaction(workspace_id) as database_session:
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
            replay = await self._replay_or_conflict(
                database_session,
                workspace_id,
                actor_user_id,
                idempotency_key,
                fingerprint,
            )
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
            await self._record_idempotency(
                database_session,
                workspace_id,
                actor_user_id,
                idempotency_key,
                "attendance",
                fingerprint,
                booking.id,
            )
            await database_session.flush()
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
        fingerprint = _fingerprint(
            command,
            {"booking_id": str(booking_id)},
        )
        async with self.database.tenant_transaction(workspace_id) as database_session:
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
            replay = await self._replay_or_conflict(
                database_session,
                workspace_id,
                actor_user_id,
                idempotency_key,
                fingerprint,
            )
            if replay is not None:
                return BookingCommandResult(booking=replay, replayed=True)
            if booking.status not in allowed:
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
            await self._record_idempotency(
                database_session,
                workspace_id,
                actor_user_id,
                idempotency_key,
                command,
                fingerprint,
                booking.id,
            )
            await database_session.flush()
            await database_session.refresh(booking)
            return BookingCommandResult(booking=booking, replayed=False)

    async def _replay_or_conflict(
        self,
        database_session: AsyncSession,
        workspace_id: UUID,
        actor_user_id: UUID,
        idempotency_key: str,
        fingerprint: str,
    ) -> Booking | None:
        record = await database_session.scalar(
            select(BookingCommandIdempotency).where(
                BookingCommandIdempotency.workspace_id == workspace_id,
                BookingCommandIdempotency.actor_user_id == actor_user_id,
                BookingCommandIdempotency.idempotency_key == idempotency_key,
            )
        )
        if record is None:
            return None
        if record.request_fingerprint != fingerprint:
            raise BookingIdempotencyConflictError
        booking = await database_session.scalar(
            select(Booking).where(
                Booking.workspace_id == workspace_id,
                Booking.id == record.booking_id,
            )
        )
        if booking is None:
            raise RuntimeError("booking command idempotency record lost its booking")
        return booking

    async def _record_idempotency(
        self,
        database_session: AsyncSession,
        workspace_id: UUID,
        actor_user_id: UUID,
        idempotency_key: str,
        command: str,
        fingerprint: str,
        booking_id: UUID,
    ) -> None:
        statement = (
            insert(BookingCommandIdempotency)
            .values(
                id=uuid4(),
                workspace_id=workspace_id,
                actor_user_id=actor_user_id,
                idempotency_key=idempotency_key,
                command=command,
                request_fingerprint=fingerprint,
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
        replay = await self._replay_or_conflict(
            database_session,
            workspace_id,
            actor_user_id,
            idempotency_key,
            fingerprint,
        )
        if replay is None:
            raise RuntimeError("booking command idempotency record was not persisted")
