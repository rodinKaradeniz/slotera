from datetime import datetime
from hashlib import sha256
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Header, Response
from pydantic import Field
from sqlalchemy import select, text

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.db.models import (
    AuditEvent,
    Booking,
    BookingFollowup,
    FormStatus,
    FormTemplate,
    Service,
    ServiceFollowupRule,
)
from slotera_api.editing import ExpectedVersionDependency, ensure_version
from slotera_api.errors import ApiError
from slotera_api.followups import queue_followup, snapshot_followup
from slotera_api.schemas.operator_resources import StrictApiModel

router = APIRouter(tags=["follow-ups"])


class FollowupRuleInput(StrictApiModel):
    enabled: bool
    delay_hours: int = Field(ge=0, le=720)
    message: str = Field(max_length=5000)
    form_template_id: UUID | None = None


class FollowupRuleView(FollowupRuleInput):
    version: int


@router.get(
    "/services/{service_id}/follow-up",
    response_model=FollowupRuleView,
    operation_id="getFollowupRule",
)
async def get_rule(
    service_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> FollowupRuleView:
    async with database.tenant_transaction(operator.workspace_id) as session:
        service = await session.scalar(
            select(Service).where(
                Service.workspace_id == operator.workspace_id, Service.id == service_id
            )
        )
        if not service:
            raise ApiError(
                status_code=404, code="service_not_found", message="Service was not found."
            )
        rule = await session.get(ServiceFollowupRule, (operator.workspace_id, service_id))
        result = FollowupRuleView(
            version=service.version,
            enabled=rule.enabled if rule else False,
            delay_hours=rule.delay_hours if rule else 24,
            message=rule.message if rule else "",
            form_template_id=rule.form_template_id if rule else None,
        )
    response.headers["Cache-Control"] = "no-store"
    return result


@router.patch(
    "/services/{service_id}/follow-up",
    response_model=FollowupRuleView,
    operation_id="updateFollowupRule",
)
async def update_rule(
    service_id: UUID,
    payload: FollowupRuleInput,
    response: Response,
    expected_version: ExpectedVersionDependency,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> FollowupRuleView:
    async with database.tenant_transaction(operator.workspace_id, scheduling_write=True) as session:
        service = await session.scalar(
            select(Service)
            .where(Service.workspace_id == operator.workspace_id, Service.id == service_id)
            .with_for_update()
        )
        if not service:
            raise ApiError(
                status_code=404, code="service_not_found", message="Service was not found."
            )
        ensure_version(service, expected_version)
        if payload.form_template_id and not await session.scalar(
            select(FormTemplate.id).where(
                FormTemplate.workspace_id == operator.workspace_id,
                FormTemplate.id == payload.form_template_id,
                FormTemplate.status == FormStatus.ACTIVE,
            )
        ):
            raise ApiError(
                status_code=422,
                code="followup_form_invalid",
                message="Choose an active form in this workspace.",
            )
        rule = await session.get(ServiceFollowupRule, (operator.workspace_id, service_id))
        if not rule:
            rule = ServiceFollowupRule(workspace_id=operator.workspace_id, service_id=service_id)
            session.add(rule)
        for name, value in payload.model_dump().items():
            setattr(rule, name, value)
        session.add(
            AuditEvent(
                workspace_id=operator.workspace_id,
                actor_user_id=operator.user_id,
                action="service.followup_updated",
                resource_type="service",
                resource_id=service_id,
                details={"enabled": payload.enabled},
            )
        )
        service.version += 1
        await session.flush()
        result = FollowupRuleView(version=service.version, **payload.model_dump())
    response.headers["Cache-Control"] = "no-store"
    return result


class FollowupView(StrictApiModel):
    delivery_status: str | None = None
    version: int
    state: str
    recipient_email: str
    message: str
    due_at: datetime | None
    queued_at: datetime | None
    can_send: bool


class FollowupCommand(StrictApiModel):
    expected_version: int = Field(ge=0)
    recipient_email: str = Field(max_length=320)


def view(booking: Booking, followup: BookingFollowup | None) -> FollowupView:
    return FollowupView(
        version=followup.version if followup else 0,
        state=followup.state if followup else "none",
        recipient_email=booking.delivery_email_override or booking.customer_email,
        message=followup.message if followup else "",
        due_at=followup.due_at if followup else None,
        queued_at=followup.queued_at if followup else None,
        can_send=bool(booking.customer_email)
        and booking.status.value == "completed"
        and (not followup or followup.state in {"scheduled", "manual"}),
    )


@router.get(
    "/bookings/{booking_id}/follow-up",
    response_model=FollowupView,
    operation_id="getBookingFollowup",
)
async def get_followup(
    booking_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> FollowupView:
    async with database.tenant_transaction(operator.workspace_id) as session:
        booking = await session.scalar(
            select(Booking).where(
                Booking.workspace_id == operator.workspace_id, Booking.id == booking_id
            )
        )
        if not booking:
            raise ApiError(
                status_code=404, code="booking_not_found", message="Booking was not found."
            )
        record = await session.scalar(
            select(BookingFollowup).where(
                BookingFollowup.workspace_id == operator.workspace_id,
                BookingFollowup.booking_id == booking_id,
            )
        )
        result = view(booking, record)
        delivery = await session.scalar(
            text("SELECT public.slotera_followup_delivery(:id)"), {"id": booking.id}
        )
        result.delivery_status = delivery["status"] if delivery else None
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post(
    "/bookings/{booking_id}/follow-up/{action}",
    response_model=FollowupView,
    operation_id="commandBookingFollowup",
)
async def command_followup(
    booking_id: UUID,
    action: Literal["send", "skip"],
    payload: FollowupCommand,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=1, max_length=255),
) -> FollowupView:
    fingerprint = sha256(f"{action}:{payload.model_dump_json()}".encode()).hexdigest()
    async with database.tenant_transaction(operator.workspace_id, scheduling_write=True) as session:
        booking = await session.scalar(
            select(Booking)
            .where(Booking.workspace_id == operator.workspace_id, Booking.id == booking_id)
            .with_for_update()
        )
        if not booking or not booking.customer_email:
            raise ApiError(
                status_code=404, code="booking_not_found", message="Booking was not found."
            )
        record = await session.scalar(
            select(BookingFollowup)
            .where(
                BookingFollowup.workspace_id == operator.workspace_id,
                BookingFollowup.booking_id == booking_id,
            )
            .with_for_update()
        )
        replay = record.commands.get(idempotency_key) if record else None
        if replay:
            if replay != fingerprint:
                raise ApiError(
                    status_code=409,
                    code="idempotency_key_reused",
                    message="This command changed; review it again.",
                )
            return view(booking, record)
        if payload.expected_version != (record.version if record else 0):
            raise ApiError(
                status_code=409,
                code="resource_stale",
                message="Review the latest follow-up before saving.",
            )
        if payload.recipient_email != (booking.delivery_email_override or booking.customer_email):
            raise ApiError(
                status_code=409,
                code="resource_stale",
                message="The recipient changed; review the destination again.",
            )
        if booking.status.value != "completed":
            raise ApiError(
                status_code=409, code="followup_not_ready", message="Complete the booking first."
            )
        if record is None:
            record = await snapshot_followup(session, booking)
        assert record is not None
        if record.state in {"queued", "skipped"}:
            raise ApiError(
                status_code=409,
                code="followup_handled",
                message="This follow-up was already handled.",
            )
        if action == "send":
            await queue_followup(session, booking, record, manual=True)
        else:
            if not await session.scalar(
                text("SELECT public.slotera_followup_suppress(:id)"), {"id": booking.id}
            ):
                raise ApiError(
                    status_code=409,
                    code="booking_email_in_progress",
                    message="An email is being sent; try again later.",
                )
            record.state = "skipped"
        session.add(
            AuditEvent(
                workspace_id=operator.workspace_id,
                actor_user_id=operator.user_id,
                action=f"booking.followup_{action}",
                resource_type="booking",
                resource_id=booking_id,
                details={},
            )
        )
        record.commands = {**record.commands, idempotency_key: fingerprint}
        await session.flush()
        result = view(booking, record)
    response.headers["Cache-Control"] = "no-store"
    return result
