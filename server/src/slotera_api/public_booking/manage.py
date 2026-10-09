"""Customer self-service for one booking, reached through its emailed link.

The token is resolved to a booking by one fixed cross-tenant lookup; everything after
that runs in the booking's own tenant transaction. Customers can cancel, and reschedule
once, until the workspace's change cutoff. Payment state never changes here: the
operator handles refunds under their own policy.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.booking_access import emit_booking_event
from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    AvailabilityPolicy,
    Booking,
    BookingStatus,
    Service,
    ServiceBookingMode,
    Session,
    SessionOrigin,
    SessionStatus,
    Workspace,
    WorkspaceBusinessProfile,
)
from slotera_api.identity import hash_opaque_token
from slotera_api.public_booking.repository import (
    PublicBookingRepository,
    PublicSlotUnavailableError,
)

_CHANGEABLE = (BookingStatus.PENDING, BookingStatus.CONFIRMED)


class BookingLinkInvalidError(Exception):
    """Unknown, expired, or revoked link — reported as not found."""


class CustomerChangeClosedError(Exception):
    """Too late, already rescheduled once, or the booking is no longer active."""


@dataclass(frozen=True)
class ManagedBooking:
    booking: Booking
    session: Session
    service: Service
    workspace: Workspace
    profile: WorkspaceBusinessProfile
    change_deadline: datetime

    @property
    def can_cancel(self) -> bool:
        return self.booking.status in _CHANGEABLE and datetime.now(UTC) < self.change_deadline

    @property
    def can_reschedule(self) -> bool:
        return self.can_cancel and self.booking.customer_rescheduled_at is None


class BookingManageRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def _resolve(self, token: str) -> tuple[UUID, UUID]:
        async with self.database.transaction() as session:
            row = (
                await session.execute(
                    text("SELECT * FROM public.slotera_public_booking_access(:token_hash)"),
                    {"token_hash": hash_opaque_token(token)},
                )
            ).one_or_none()
        if row is None:
            raise BookingLinkInvalidError
        return row.workspace_id, row.booking_id

    async def _load(
        self, session: AsyncSession, workspace_id: UUID, booking_id: UUID, *, lock: bool
    ) -> ManagedBooking:
        booking_query = select(Booking).where(
            Booking.workspace_id == workspace_id, Booking.id == booking_id
        )
        booking = await session.scalar(booking_query.with_for_update() if lock else booking_query)
        if booking is None:
            raise BookingLinkInvalidError
        session_query = select(Session).where(
            Session.workspace_id == workspace_id, Session.id == booking.session_id
        )
        scheduled_session = await session.scalar(
            session_query.with_for_update() if lock else session_query
        )
        row = (
            await session.execute(
                select(Service, Workspace, WorkspaceBusinessProfile, AvailabilityPolicy)
                .join(Workspace, Workspace.id == Service.workspace_id)
                .join(
                    WorkspaceBusinessProfile,
                    WorkspaceBusinessProfile.workspace_id == Workspace.id,
                )
                .join(AvailabilityPolicy, AvailabilityPolicy.workspace_id == Workspace.id)
                .where(
                    Service.workspace_id == workspace_id,
                    Service.id == (scheduled_session.service_id if scheduled_session else None),
                )
            )
        ).one_or_none()
        if scheduled_session is None or row is None:
            raise BookingLinkInvalidError
        service, workspace, profile, policy = row._tuple()
        deadline = scheduled_session.start_at - timedelta(hours=policy.customer_change_notice_hours)
        return ManagedBooking(booking, scheduled_session, service, workspace, profile, deadline)

    async def get(self, token: str) -> ManagedBooking:
        workspace_id, booking_id = await self._resolve(token)
        async with self.database.tenant_transaction(workspace_id) as session:
            return await self._load(session, workspace_id, booking_id, lock=False)

    async def cancel(self, token: str) -> ManagedBooking:
        workspace_id, booking_id = await self._resolve(token)
        async with self.database.tenant_transaction(workspace_id) as session:
            managed = await self._load(session, workspace_id, booking_id, lock=True)
            if managed.booking.status == BookingStatus.CANCELLED:
                return managed  # A repeated click is a no-op, not an error.
            if not managed.can_cancel:
                raise CustomerChangeClosedError
            managed.booking.status = BookingStatus.CANCELLED
            await self._release_if_public(session, workspace_id, managed.booking, managed.session)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=None,
                    action="booking.customer_cancelled",
                    resource_type="booking",
                    resource_id=booking_id,
                    details={"session_id": str(managed.session.id)},
                )
            )
            await session.flush()
            await emit_booking_event(
                session,
                workspace_id=workspace_id,
                booking_id=booking_id,
                session_ends_at=managed.session.end_at,
                event="cancelled",
            )
            return await self._load(session, workspace_id, booking_id, lock=False)

    async def reschedule(self, token: str, start_at: datetime) -> ManagedBooking:
        workspace_id, booking_id = await self._resolve(token)
        start_at = start_at.astimezone(UTC)
        async with self.database.tenant_transaction(workspace_id) as session:
            managed = await self._load(session, workspace_id, booking_id, lock=True)
            if managed.session.start_at == start_at:
                return managed  # Same slot: nothing to move (also covers replays).
            if not managed.can_reschedule:
                raise CustomerChangeClosedError
            now = datetime.now(UTC)
            booking_repository = PublicBookingRepository(self.database)
            await session.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
                {"key": f"public-booking-slot:{workspace_id}:{start_at.isoformat()}"},
            )
            if managed.service.booking_mode == ServiceBookingMode.SCHEDULED:
                target = await booking_repository._lock_scheduled_session(
                    session, workspace_id, managed.service, start_at, now
                )
            else:
                local_day = start_at.astimezone(ZoneInfo(managed.workspace.timezone)).date()
                slots = await booking_repository._available_slots(
                    session,
                    workspace_id,
                    managed.service,
                    managed.workspace.timezone,
                    local_day,
                    local_day,
                    now,
                )
                slot = next((item for item in slots if item.start_at == start_at), None)
                if slot is None:
                    raise PublicSlotUnavailableError
                target = Session(
                    id=uuid4(),
                    workspace_id=workspace_id,
                    series_id=None,
                    service_id=managed.service.id,
                    calendar_owner_id=managed.session.calendar_owner_id,
                    start_at=slot.start_at,
                    end_at=slot.end_at,
                    capacity=1,
                    status=SessionStatus.SCHEDULED,
                    origin=SessionOrigin.PUBLIC_OPEN,
                    location_type=managed.service.location_type,
                    location=managed.service.location,
                    address=managed.service.address,
                    notes=None,
                )
                session.add(target)
                await session.flush()
            previous = managed.session
            managed.booking.session_id = target.id
            managed.booking.customer_rescheduled_at = now
            await self._release_if_public(session, workspace_id, managed.booking, previous)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=None,
                    action="booking.customer_rescheduled",
                    resource_type="booking",
                    resource_id=booking_id,
                    details={"from_session_id": str(previous.id), "to_session_id": str(target.id)},
                )
            )
            await session.flush()
            await emit_booking_event(
                session,
                workspace_id=workspace_id,
                booking_id=booking_id,
                session_ends_at=target.end_at,
                event="rescheduled",
            )
            return await self._load(session, workspace_id, booking_id, lock=False)

    @staticmethod
    async def _release_if_public(
        session: AsyncSession, workspace_id: UUID, booking: Booking, scheduled_session: Session
    ) -> None:
        """A public 1:1 session exists only for its booking, so free it once unused.
        Operator-scheduled sessions stay and simply regain the seat."""
        if scheduled_session.origin != SessionOrigin.PUBLIC_OPEN:
            return
        remaining = await session.scalar(
            select(func.count(Booking.id)).where(
                Booking.workspace_id == workspace_id,
                Booking.session_id == scheduled_session.id,
                Booking.id != booking.id,
                Booking.status.in_(_CHANGEABLE),
            )
        )
        if int(remaining or 0) == 0:
            scheduled_session.status = SessionStatus.CANCELLED


PendingReason = Literal["approval", "payment"]


def pending_reasons(booking: Booking) -> list[PendingReason]:
    reasons: list[PendingReason] = []
    if booking.approval_status.value == "pending":
        reasons.append("approval")
    if booking.payment_status.value == "pending":
        reasons.append("payment")
    return reasons
