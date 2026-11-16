"""Completion-owned follow-up rules and one-time post-session assignments."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.booking_access import issue_manage_url
from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    Booking,
    BookingFollowup,
    BookingFormSnapshot,
    Client,
    FormStatus,
    FormTemplate,
    ServiceFollowupRule,
    Session,
)
from slotera_api.email.locales import COMMUNICATION_COPY
from slotera_api.errors import ApiError


async def snapshot_followup(session: AsyncSession, booking: Booking) -> BookingFollowup | None:
    current = await session.scalar(
        select(BookingFollowup).where(
            BookingFollowup.workspace_id == booking.workspace_id,
            BookingFollowup.booking_id == booking.id,
        )
    )
    if current is not None:
        return current
    occurrence = await session.get(Session, booking.session_id)
    if occurrence is None or booking.status.value != "completed":
        return None
    rule = await session.get(ServiceFollowupRule, (booking.workspace_id, occurrence.service_id))
    assignment = None
    if rule and rule.form_template_id:
        template = await session.scalar(
            select(FormTemplate).where(
                FormTemplate.workspace_id == booking.workspace_id,
                FormTemplate.id == rule.form_template_id,
                FormTemplate.status == FormStatus.ACTIVE,
            )
        )
        if template:
            assignment = BookingFormSnapshot(
                id=uuid4(),
                workspace_id=booking.workspace_id,
                booking_id=booking.id,
                form_template_id=template.id,
                name=template.name,
                description=template.description,
                fields=template.fields,
                required_before_payment=False,
                assignment_kind="followup",
            )
            session.add(assignment)
            await session.flush()
    result = BookingFollowup(
        workspace_id=booking.workspace_id,
        booking_id=booking.id,
        state="scheduled" if rule and rule.enabled else "manual",
        message=rule.message if rule else "",
        delay_hours=rule.delay_hours if rule else 24,
        due_at=max(
            occurrence.end_at + timedelta(hours=rule.delay_hours if rule else 24), datetime.now(UTC)
        ),
        form_snapshot_id=assignment.id if assignment else None,
        commands={},
    )
    session.add(result)
    await session.flush()
    return result


async def queue_followup(
    session: AsyncSession,
    booking: Booking,
    followup: BookingFollowup,
    *,
    manual: bool,
    event_key: str = "",
) -> bool:
    occurrence = await session.get(Session, booking.session_id)
    client = await session.scalar(
        select(Client)
        .where(Client.workspace_id == booking.workspace_id, Client.id == booking.client_id)
        .with_for_update()
    )
    if not client or client.erased_at or not occurrence or booking.status.value != "completed":
        return False
    if not manual:
        effective_due = max(
            followup.due_at, occurrence.end_at + timedelta(hours=followup.delay_hours)
        )
        if datetime.now(UTC) < effective_due:
            followup.due_at = effective_due
            return False
    if datetime.now(UTC) < occurrence.end_at:
        raise ApiError(
            status_code=409, code="followup_not_ready", message="The session has not ended."
        )
    if not manual and not client.automatic_followup_enabled:
        followup.state = "manual"
        return False
    subject, default = COMMUNICATION_COPY[booking.language]["booking_followup"]
    queued_at = followup.queued_at or datetime.now(UTC)
    url = await issue_manage_url(
        session,
        workspace_id=booking.workspace_id,
        booking_id=booking.id,
        session_ends_at=occurrence.end_at,
    )
    queued = await session.scalar(
        text(
            "SELECT public.slotera_followup_queue(:booking,:url,:subject,:body,:manual,:event_key)"
        ),
        {
            "booking": booking.id,
            "url": url,
            "subject": subject,
            "body": followup.message or default,
            "manual": manual,
            "event_key": event_key,
        },
    )
    if queued:
        followup.state = "queued"
        followup.queued_at = queued_at
        if followup.form_snapshot_id:
            assignment = await session.get(BookingFormSnapshot, followup.form_snapshot_id)
            if assignment:
                assignment.response_deadline = followup.queued_at + timedelta(days=30)
        session.add(
            AuditEvent(
                workspace_id=booking.workspace_id,
                actor_user_id=None,
                action="booking.followup_queued",
                resource_type="booking",
                resource_id=booking.id,
                details={"manual": manual},
            )
        )
    return queued is True


async def queue_due_followups(database: "Database") -> int:
    async with database.transaction() as session:
        due = (await session.execute(text("SELECT * FROM public.slotera_due_followups()"))).all()
    count = 0
    for item in due:
        async with database.tenant_transaction(item.workspace_id, scheduling_write=True) as session:
            booking = await session.scalar(
                select(Booking)
                .where(Booking.workspace_id == item.workspace_id, Booking.id == item.booking_id)
                .with_for_update()
            )
            followup = await session.scalar(
                select(BookingFollowup)
                .where(
                    BookingFollowup.workspace_id == item.workspace_id,
                    BookingFollowup.booking_id == item.booking_id,
                )
                .with_for_update()
            )
            if (
                booking
                and followup
                and followup.state == "scheduled"
                and followup.due_at <= datetime.now(UTC)
            ):
                count += int(await queue_followup(session, booking, followup, manual=False))
    return count
