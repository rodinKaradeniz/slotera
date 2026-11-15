"""Reviewed session changes and their customer effects share one transaction."""

import hashlib
import json
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.booking_access import emit_booking_event
from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    Booking,
    BookingStatus,
    Service,
    Session,
    SessionCommandIdempotency,
    SessionSeries,
    SessionStatus,
    WorkspaceMembership,
)
from slotera_api.editing import ensure_version
from slotera_api.errors import ApiError
from slotera_api.scheduling.impact import SessionImpact, review_impact, validate_booking_constraints
from slotera_api.scheduling.projection import session_response
from slotera_api.schemas.scheduling import SchedulingSessionResponse
from slotera_api.session_capacity import CAPACITY_CONSUMING_STATUSES

Scope = Literal["this", "this_and_following"]


def conflict(code: str, message: str) -> ApiError:
    return ApiError(status_code=409, code=code, message=message)


async def load_affected(
    transaction: AsyncSession,
    workspace_id: UUID,
    session_id: UUID,
    scope: Scope,
    *,
    lock: bool,
) -> tuple[Session, SessionSeries | None, list[Session], list[Booking]]:
    query = select(Session).where(Session.workspace_id == workspace_id, Session.id == session_id)
    target = await transaction.scalar(query)
    if target is None:
        raise ApiError(status_code=404, code="session_not_found", message="Session was not found")
    series = None
    if target.series_id:
        series_query = select(SessionSeries).where(
            SessionSeries.workspace_id == workspace_id, SessionSeries.id == target.series_id
        )
        series = await transaction.scalar(series_query.with_for_update() if lock else series_query)
    occurrence_query = select(Session).where(Session.workspace_id == workspace_id)
    if scope == "this_and_following" and target.series_id:
        occurrence_query = occurrence_query.where(
            Session.series_id == target.series_id, Session.start_at >= target.start_at
        )
    else:
        occurrence_query = occurrence_query.where(Session.id == session_id)
    occurrence_query = occurrence_query.order_by(Session.id).execution_options(
        populate_existing=True
    )
    occurrences = list(
        await transaction.scalars(occurrence_query.with_for_update() if lock else occurrence_query)
    )
    target = next(item for item in occurrences if item.id == session_id)
    booking_query = (
        select(Booking)
        .where(
            Booking.workspace_id == workspace_id,
            Booking.session_id.in_([item.id for item in occurrences]),
        )
        .order_by(Booking.id)
    )
    bookings = list(
        await transaction.scalars(booking_query.with_for_update() if lock else booking_query)
    )
    return target, series, occurrences, bookings


class SessionCommands:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def preview(self, workspace_id: UUID, session_id: UUID, scope: Scope) -> SessionImpact:
        async with self.database.tenant_transaction(workspace_id, repeatable_read=True) as tx:
            _, series, occurrences, bookings = await load_affected(
                tx, workspace_id, session_id, scope, lock=False
            )
            impact = review_impact(occurrences, bookings)
            # The series revision covers changes to future materialisation too.
            revision = hashlib.sha256(
                f"{impact.revision}:{series.version if series else 0}".encode()
            ).hexdigest()
            return SessionImpact(
                impact.session_count,
                impact.active_booking_count,
                impact.paid_booking_count,
                revision,
            )

    async def apply(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        session_id: UUID,
        changes: dict[str, Any],
        scope: Scope,
        expected_version: int,
        expected_series_version: int | None,
        impact_revision: str,
        idempotency_key: str,
        *,
        cancel: bool = False,
    ) -> SchedulingSessionResponse:
        fingerprint = hashlib.sha256(
            json.dumps(
                {
                    "session": str(session_id),
                    "changes": changes,
                    "scope": scope,
                    "version": expected_version,
                    "seriesVersion": expected_series_version,
                    "impact": impact_revision,
                    "cancel": cancel,
                },
                sort_keys=True,
                default=str,
            ).encode()
        ).hexdigest()
        async with self.database.tenant_transaction(workspace_id, scheduling_write=True) as tx:
            previous = await tx.scalar(
                select(SessionCommandIdempotency).where(
                    SessionCommandIdempotency.workspace_id == workspace_id,
                    SessionCommandIdempotency.actor_user_id == actor_user_id,
                    SessionCommandIdempotency.idempotency_key == idempotency_key,
                )
            )
            if previous:
                if previous.request_fingerprint != fingerprint:
                    raise conflict(
                        "idempotency_conflict",
                        "This key was already used for a different session change",
                    )
                return SchedulingSessionResponse.model_validate(previous.outcome)
            target, series, occurrences, bookings = await load_affected(
                tx, workspace_id, session_id, scope, lock=True
            )
            ensure_version(target, expected_version)
            if scope == "this_and_following" and series:
                if expected_series_version is None:
                    raise ApiError(
                        status_code=422,
                        code="series_version_required",
                        message="Review the recurring series before editing it",
                    )
                ensure_version(series, expected_series_version)
            impact = review_impact(occurrences, bookings)
            revision = hashlib.sha256(
                f"{impact.revision}:{series.version if series else 0}".encode()
            ).hexdigest()
            if revision != impact_revision:
                raise conflict(
                    "session_impact_stale",
                    "Session attendance changed. Review the impact again; your draft is kept",
                )
            now = datetime.now(UTC)
            if target.start_at <= now and (cancel or scope != "this" or set(changes) - {"notes"}):
                raise conflict("past_session_immutable", "Past sessions cannot be changed")
            if target.status == SessionStatus.CANCELLED and (cancel or set(changes) - {"notes"}):
                raise conflict(
                    "session_cancelled", "A cancelled session cannot be changed or reopened"
                )
            if "status" in changes:
                raise ApiError(
                    status_code=422,
                    code="session_status_command_required",
                    message="Use the dedicated session cancellation action",
                )
            if "service_id" in changes and not await tx.scalar(
                select(Service.id).where(
                    Service.workspace_id == workspace_id, Service.id == changes["service_id"]
                )
            ):
                raise ApiError(
                    status_code=404,
                    code="session_dependency_not_found",
                    message="Service was not found",
                )
            if "calendar_owner_id" in changes and not await tx.scalar(
                select(WorkspaceMembership.id).where(
                    WorkspaceMembership.workspace_id == workspace_id,
                    WorkspaceMembership.user_id == changes["calendar_owner_id"],
                )
            ):
                raise ApiError(
                    status_code=404,
                    code="session_dependency_not_found",
                    message="Calendar owner was not found",
                )
            private_note_only = scope == "this" and bool(changes) and not (set(changes) - {"notes"})
            mutable = (
                [target]
                if private_note_only
                else [item for item in occurrences if item.status != SessionStatus.CANCELLED]
            )
            validate_booking_constraints(mutable, bookings, changes)
            if scope == "this_and_following":
                if set(changes) - {
                    "start_at",
                    "end_at",
                    "location_type",
                    "location",
                    "address",
                    "capacity",
                    "notes",
                }:
                    raise ApiError(
                        status_code=422,
                        code="series_fields_invalid",
                        message="Following changes support time, location and capacity",
                    )
                if series and "start_at" in changes:
                    review_zone = ZoneInfo(series.timezone)
                    if (
                        changes["start_at"].astimezone(review_zone).date()
                        != target.start_at.astimezone(review_zone).date()
                    ):
                        raise ApiError(
                            status_code=422,
                            code="series_date_change_invalid",
                            message="Move a calendar date using This session",
                        )
                await tx.execute(text("SET CONSTRAINTS ex_sessions_owner_time DEFERRED"))
            notice_fields = ("start_at", "end_at", "location_type", "location", "address")
            before = {
                item.id: tuple(getattr(item, key) for key in notice_fields) for item in mutable
            }
            affected_ids = {item.id for item in mutable}
            active = [
                item
                for item in bookings
                if item.session_id in affected_ids and item.status in CAPACITY_CONSUMING_STATUSES
            ]
            original_start = target.start_at
            zone: ZoneInfo | None = ZoneInfo(series.timezone) if series else None
            clock_deltas = {
                key: changes[key].astimezone(zone).replace(tzinfo=None)
                - getattr(target, key).astimezone(zone).replace(tzinfo=None)
                for key in ("start_at", "end_at")
                if zone and key in changes
            }
            for occurrence in mutable:
                if cancel:
                    occurrence.status = SessionStatus.CANCELLED
                else:
                    for key, value in changes.items():
                        if scope == "this_and_following" and zone and key in {"start_at", "end_at"}:
                            original = getattr(occurrence, key).astimezone(zone)
                            # Retain local clock times across daylight-saving transitions.
                            delta = clock_deltas[key]
                            value = (original.replace(tzinfo=None) + delta).replace(tzinfo=zone)
                            if value.astimezone(UTC).astimezone(zone).replace(
                                tzinfo=None
                            ) != value.replace(tzinfo=None):
                                raise conflict(
                                    "session_time_invalid",
                                    "This time does not exist at a daylight-saving transition",
                                )
                        setattr(occurrence, key, value)
            notifying_ids = {
                item.id
                for item in mutable
                if cancel or before[item.id] != tuple(getattr(item, key) for key in notice_fields)
            }
            for item in mutable:
                if (
                    not cancel
                    and ("start_at" in changes or "end_at" in changes)
                    and (item.start_at <= now or item.end_at <= item.start_at)
                ):
                    raise conflict(
                        "session_time_invalid",
                        "Changed sessions must start in the future and end after they start",
                    )
            for booking in active:
                if (
                    booking.session_id in notifying_ids
                    and booking.customer_email
                    and not await tx.scalar(
                        text("SELECT public.slotera_booking_prepare_email_send(:id)"),
                        {"id": booking.id},
                    )
                ):
                    raise conflict(
                        "booking_email_in_flight",
                        "A booking email is being sent. Retry after it finishes; nothing changed",
                    )
            if series:
                series.version += 1
                if not cancel and scope == "this_and_following":
                    if "start_at" in changes:
                        duration = (changes["end_at"] - changes["start_at"]).total_seconds()
                        if duration % 60:
                            raise ApiError(
                                status_code=422,
                                code="series_duration_invalid",
                                message="Recurring duration must use whole minutes",
                            )
                        series.start_local = (
                            changes["start_at"]
                            .astimezone(ZoneInfo(series.timezone))
                            .time()
                            .replace(tzinfo=None)
                        )
                        series.duration_min = int(duration // 60)
                    for key in ("capacity", "location_type", "location", "address", "notes"):
                        if key in changes:
                            setattr(series, key, changes[key])
                if cancel and scope == "this_and_following":
                    cutoff = original_start.astimezone(ZoneInfo(series.timezone)).date()
                    series.cancelled_from = (
                        min(series.cancelled_from, cutoff) if series.cancelled_from else cutoff
                    )
            by_id = {item.id: item for item in mutable}
            for booking in active:
                if cancel:
                    booking.status = BookingStatus.CANCELLED
                    tx.add(
                        AuditEvent(
                            workspace_id=workspace_id,
                            actor_user_id=actor_user_id,
                            action="booking.cancelled",
                            resource_type="booking",
                            resource_id=booking.id,
                            details={
                                "reason": "session_cancelled",
                                "sessionId": str(booking.session_id),
                            },
                        )
                    )
                if booking.session_id in notifying_ids and booking.customer_email:
                    await tx.flush()
                    emitted = await emit_booking_event(
                        tx,
                        workspace_id=workspace_id,
                        booking_id=booking.id,
                        session_ends_at=by_id[booking.session_id].end_at,
                        event="cancelled" if cancel else "rescheduled",
                        event_key=f"session:{actor_user_id}:{idempotency_key}",
                        operator_notification=False,
                    )
                    if not emitted:
                        raise ApiError(
                            status_code=503,
                            code="session_notice_failed",
                            message="The session notice could not be queued; nothing changed",
                        )
            tx.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="session.cancelled" if cancel else "session.updated",
                    resource_type="session",
                    resource_id=session_id,
                    details={
                        "fields": sorted(changes),
                        "scope": scope,
                        "sessionCount": len(mutable),
                        "bookingCount": len(active),
                    },
                )
            )
            await tx.flush()
            await tx.refresh(target)
            if series is not None:
                await tx.refresh(series)
            result = session_response(
                target,
                series,
                0 if cancel else sum(item.session_id == session_id for item in active),
            )
            tx.add(
                SessionCommandIdempotency(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    session_id=session_id,
                    idempotency_key=idempotency_key,
                    request_fingerprint=fingerprint,
                    outcome=result.model_dump(mode="json"),
                )
            )
            return result
