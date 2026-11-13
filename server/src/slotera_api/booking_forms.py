"""Booking-owned questions and one-time responses; never expose operator notes."""

from datetime import UTC, datetime
from uuid import UUID

from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.db.models import (
    AuditEvent,
    Booking,
    BookingFormResponse,
    BookingFormSnapshot,
    FormStatus,
    FormTemplate,
    FormTemplateService,
    Session,
)
from slotera_api.errors import ApiError
from slotera_api.public_booking.repository import PublicBookingRepository, PublicFormValidationError
from slotera_api.schemas.base import ApiModel
from slotera_api.schemas.forms import FormFieldInput
from slotera_api.schemas.operator_resources import StrictApiModel
from slotera_api.schemas.public_booking import PublicFormAnswer


class BookingFormView(ApiModel):
    id: UUID
    name: str
    description: str
    fields: list[FormFieldInput]
    answers: list[PublicFormAnswer] | None
    submitted_at: datetime | None
    required_before_payment: bool
    historical_approximation: bool = False
    can_submit: bool = False


class BookingFormSubmit(StrictApiModel):
    answers: list[PublicFormAnswer] = Field(max_length=100)


class BookingFormsResponse(ApiModel):
    items: list[BookingFormView]


async def snapshot_forms(
    session: AsyncSession, workspace_id: UUID, booking_id: UUID, service_id: UUID
) -> None:
    forms = (
        await session.scalars(
            select(FormTemplate)
            .join(
                FormTemplateService,
                (FormTemplateService.workspace_id == FormTemplate.workspace_id)
                & (FormTemplateService.form_template_id == FormTemplate.id),
            )
            .where(
                FormTemplate.workspace_id == workspace_id,
                FormTemplateService.service_id == service_id,
                FormTemplate.status == FormStatus.ACTIVE,
            )
        )
    ).all()
    session.add_all(
        [
            BookingFormSnapshot(
                workspace_id=workspace_id,
                booking_id=booking_id,
                form_template_id=form.id,
                name=form.name,
                description=form.description,
                fields=form.fields,
                required_before_payment=form.required_before_payment,
            )
            for form in forms
        ]
    )


async def read_forms(
    session: AsyncSession, workspace_id: UUID, booking: Booking, starts_at: datetime
) -> BookingFormsResponse:
    snapshots = (
        await session.scalars(
            select(BookingFormSnapshot)
            .where(
                BookingFormSnapshot.workspace_id == workspace_id,
                BookingFormSnapshot.booking_id == booking.id,
            )
            .order_by(BookingFormSnapshot.created_at, BookingFormSnapshot.id)
        )
    ).all()
    responses = (
        await session.scalars(
            select(BookingFormResponse).where(
                BookingFormResponse.workspace_id == workspace_id,
                BookingFormResponse.booking_id == booking.id,
            )
        )
    ).all()
    by_form = {item.form_template_id: item for item in responses}
    items = []
    for form in snapshots:
        response = by_form.pop(form.form_template_id, None)
        items.append(
            BookingFormView(
                id=form.id,
                name=form.name,
                description=form.description,
                fields=[FormFieldInput.model_validate(field) for field in form.fields],
                answers=[PublicFormAnswer.model_validate(a) for a in response.answers]
                if response
                else None,
                submitted_at=response.submitted_at if response else None,
                required_before_payment=form.required_before_payment,
                can_submit=(
                    not response
                    and not form.required_before_payment
                    and booking.status.value in {"pending", "confirmed"}
                    and datetime.now(UTC) < starts_at
                ),
            )
        )
    # Legacy answers have no trustworthy question snapshot. Never assign new forms here.
    for response in by_form.values():
        template = await session.scalar(
            select(FormTemplate).where(
                FormTemplate.workspace_id == workspace_id,
                FormTemplate.id == response.form_template_id,
            )
        )
        fields = template.fields if template else []
        items.append(
            BookingFormView(
                id=response.id,
                name=response.form_name,
                description="",
                fields=[FormFieldInput.model_validate(field) for field in fields],
                answers=[PublicFormAnswer.model_validate(a) for a in response.answers],
                submitted_at=response.submitted_at,
                required_before_payment=True,
                historical_approximation=True,
            )
        )
    return BookingFormsResponse(items=items)


async def submit_form(
    session: AsyncSession,
    workspace_id: UUID,
    booking_id: UUID,
    form_id: UUID,
    answers: list[PublicFormAnswer],
) -> BookingFormsResponse:
    booking = await session.scalar(
        select(Booking)
        .where(Booking.workspace_id == workspace_id, Booking.id == booking_id)
        .with_for_update()
    )
    if booking is None:
        raise ApiError(status_code=404, code="booking_not_found", message="Booking was not found")
    occurrence = await session.scalar(
        select(Session)
        .where(Session.workspace_id == workspace_id, Session.id == booking.session_id)
        .with_for_update()
    )
    form = await session.scalar(
        select(BookingFormSnapshot).where(
            BookingFormSnapshot.workspace_id == workspace_id,
            BookingFormSnapshot.booking_id == booking_id,
            BookingFormSnapshot.id == form_id,
        )
    )
    if form is None or occurrence is None:
        raise ApiError(status_code=404, code="booking_form_not_found", message="Form was not found")
    template = FormTemplate(
        id=form.form_template_id, name=form.name, fields=form.fields, required_before_payment=True
    )
    try:
        normalized = PublicBookingRepository._validate_form_responses(
            [template],
            [
                {
                    "form_template_id": template.id,
                    "answers": [answer.model_dump() for answer in answers],
                }
            ],
        )[0][1]
    except PublicFormValidationError as exc:
        raise ApiError(
            status_code=422, code="booking_form_invalid", message="Check your answers"
        ) from exc
    previous = await session.scalar(
        select(BookingFormResponse).where(
            BookingFormResponse.workspace_id == workspace_id,
            BookingFormResponse.booking_id == booking_id,
            BookingFormResponse.form_template_id == form.form_template_id,
        )
    )
    if previous:
        if sorted(previous.answers, key=lambda a: str(a["field_id"])) != sorted(
            normalized, key=lambda a: str(a["field_id"])
        ):
            raise ApiError(
                status_code=409,
                code="booking_form_submitted",
                message="This form has already been submitted",
            )
    else:
        if (
            form.required_before_payment
            or booking.status.value not in {"pending", "confirmed"}
            or datetime.now(UTC) >= occurrence.start_at
        ):
            raise ApiError(
                status_code=409,
                code="booking_form_closed",
                message="This form can no longer be submitted",
            )
        session.add(
            BookingFormResponse(
                workspace_id=workspace_id,
                booking_id=booking_id,
                form_template_id=form.form_template_id,
                form_name=form.name,
                answers=normalized,
            )
        )
        session.add(
            AuditEvent(
                workspace_id=workspace_id,
                actor_user_id=None,
                action="booking.form_submitted",
                resource_type="booking",
                resource_id=booking_id,
                details={"form_id": str(form.id)},
            )
        )
        await session.flush()
    return await read_forms(session, workspace_id, booking, occurrence.start_at)
