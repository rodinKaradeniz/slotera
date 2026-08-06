import json
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from hashlib import sha256
from typing import Any
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    AvailabilityBlackout,
    AvailabilityPolicy,
    AvailabilityWindow,
    Booking,
    BookingApprovalStatus,
    BookingFormResponse,
    BookingOrigin,
    BookingStatus,
    Client,
    FormStatus,
    FormTemplate,
    FormTemplateService,
    PaymentStatus,
    PublicBookingIdempotency,
    Service,
    ServiceBookingMode,
    Session,
    SessionOrigin,
    SessionStatus,
    Workspace,
    WorkspaceBusinessProfile,
    WorkspaceMembership,
    WorkspaceOperationalStatus,
    WorkspacePaymentSettings,
)
from slotera_api.public_booking.terms import PLATFORM_TERMS_VERSION


class PublicWorkspaceNotFoundError(Exception):
    pass


class PublicServiceNotFoundError(Exception):
    pass


class PublicSlotUnavailableError(Exception):
    pass


class PublicPaymentMethodError(Exception):
    pass


class PublicFormValidationError(Exception):
    pass


class PublicBookingIdempotencyConflictError(Exception):
    pass


@dataclass(frozen=True)
class TaxQuote:
    treatment: str
    rate_bps: int
    label: str | None
    jurisdiction: str | None
    gross_amount_cents: int
    net_amount_cents: int
    tax_amount_cents: int
    currency: str


@dataclass(frozen=True)
class PublicWorkspaceContext:
    workspace: Workspace
    profile: WorkspaceBusinessProfile
    payments: WorkspacePaymentSettings


@dataclass(frozen=True)
class AvailabilitySlot:
    start_at: datetime
    end_at: datetime


@dataclass(frozen=True)
class PublicBookingResult:
    booking: Booking
    session: Session
    quote: TaxQuote
    replayed: bool


def quote_for(
    service: Service,
    workspace: Workspace,
    payments: WorkspacePaymentSettings,
) -> TaxQuote:
    gross = service.price_cents
    if payments.tax_treatment == "fixed" and payments.tax_rate_bps > 0:
        net = round(gross * 10000 / (10000 + payments.tax_rate_bps))
        tax = gross - net
        label: str | None = payments.tax_label
    else:
        net = gross
        tax = 0
        label = None
    return TaxQuote(
        treatment=payments.tax_treatment,
        rate_bps=payments.tax_rate_bps,
        label=label,
        jurisdiction=payments.tax_jurisdiction,
        gross_amount_cents=gross,
        net_amount_cents=net,
        tax_amount_cents=tax,
        currency=workspace.currency,
    )


def _overlaps(
    left_start: datetime,
    left_end: datetime,
    right_start: datetime,
    right_end: datetime,
) -> bool:
    return left_start < right_end and right_start < left_end


def _fingerprint(values: Mapping[str, Any]) -> str:
    serialized = json.dumps(values, sort_keys=True, separators=(",", ":"), default=str)
    return sha256(serialized.encode()).hexdigest()


class PublicBookingRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def consume_rate_limit(
        self, *, scope: str, key: str, limit: int, window_seconds: int
    ) -> bool:
        async with self.database.transaction() as session:
            allowed = await session.scalar(
                text(
                    "SELECT public.slotera_rate_limit_consume("
                    ":scope, :key_hash, :limit, :window_seconds)"
                ),
                {
                    "scope": scope,
                    "key_hash": sha256(key.encode()).digest(),
                    "limit": limit,
                    "window_seconds": window_seconds,
                },
            )
            return allowed is True

    async def resolve_workspace_id(self, slug: str) -> UUID:
        async with self.database.transaction() as session:
            workspace_id = await session.scalar(
                text("SELECT public.slotera_public_resolve_workspace(:slug)"),
                {"slug": slug},
            )
        if not isinstance(workspace_id, UUID):
            raise PublicWorkspaceNotFoundError
        return workspace_id

    async def get_workspace(self, workspace_id: UUID) -> PublicWorkspaceContext:
        async with self.database.tenant_transaction(workspace_id) as session:
            row = (
                await session.execute(
                    select(
                        Workspace,
                        WorkspaceBusinessProfile,
                        WorkspacePaymentSettings,
                    )
                    .join(
                        WorkspaceBusinessProfile,
                        WorkspaceBusinessProfile.workspace_id == Workspace.id,
                    )
                    .join(
                        WorkspacePaymentSettings,
                        WorkspacePaymentSettings.workspace_id == Workspace.id,
                    )
                    .where(
                        Workspace.id == workspace_id,
                        Workspace.operational_status == WorkspaceOperationalStatus.ACTIVE,
                        WorkspaceBusinessProfile.booking_page_enabled.is_(True),
                    )
                )
            ).one_or_none()
            if row is None:
                raise PublicWorkspaceNotFoundError
            workspace, profile, payments = row._tuple()
            return PublicWorkspaceContext(workspace, profile, payments)

    async def list_services(
        self, workspace_id: UUID
    ) -> tuple[list[Service], PublicWorkspaceContext]:
        context = await self.get_workspace(workspace_id)
        async with self.database.tenant_transaction(workspace_id) as session:
            services = list(
                (
                    await session.scalars(
                        select(Service)
                        .where(
                            Service.workspace_id == workspace_id,
                            Service.active.is_(True),
                            Service.booking_mode == ServiceBookingMode.OPEN,
                            Service.capacity == 1,
                        )
                        .order_by(Service.created_at, Service.id)
                    )
                ).all()
            )
        return services, context

    async def get_service(
        self, workspace_id: UUID, service_id: UUID
    ) -> tuple[Service, PublicWorkspaceContext]:
        context = await self.get_workspace(workspace_id)
        async with self.database.tenant_transaction(workspace_id) as session:
            service = await session.scalar(
                select(Service).where(
                    Service.workspace_id == workspace_id,
                    Service.id == service_id,
                    Service.active.is_(True),
                    Service.booking_mode == ServiceBookingMode.OPEN,
                    Service.capacity == 1,
                )
            )
            if service is None:
                raise PublicServiceNotFoundError
        return service, context

    async def list_forms(self, workspace_id: UUID, service_id: UUID) -> list[FormTemplate]:
        await self.get_service(workspace_id, service_id)
        async with self.database.tenant_transaction(workspace_id) as session:
            return list(
                (
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
                        .order_by(FormTemplate.created_at, FormTemplate.id)
                    )
                ).all()
            )

    async def list_availability(
        self,
        workspace_id: UUID,
        service_id: UUID,
        *,
        starts_on: date,
        ends_on: date,
        now: datetime | None = None,
    ) -> tuple[str, list[AvailabilitySlot]]:
        service, context = await self.get_service(workspace_id, service_id)
        async with self.database.tenant_transaction(workspace_id) as session:
            effective_now = now or datetime.now(UTC)
            await self._expire_manual_bookings(session, workspace_id, effective_now)
            slots = await self._available_slots(
                session,
                workspace_id,
                service,
                context.workspace.timezone,
                starts_on,
                ends_on,
                effective_now,
            )
        return context.workspace.timezone, slots

    async def _expire_manual_bookings(
        self,
        session: AsyncSession,
        workspace_id: UUID,
        now: datetime,
    ) -> None:
        rows = (
            await session.execute(
                select(Booking, Session)
                .join(
                    Session,
                    (Session.workspace_id == Booking.workspace_id)
                    & (Session.id == Booking.session_id),
                )
                .where(
                    Booking.workspace_id == workspace_id,
                    Booking.status == BookingStatus.PENDING,
                    Booking.payment_status == PaymentStatus.PENDING,
                    Booking.payment_method == "manual",
                    Booking.payment_due_at.is_not(None),
                    Booking.payment_due_at <= now,
                    Session.capacity == 1,
                    Session.origin == SessionOrigin.PUBLIC_OPEN,
                    Session.status == SessionStatus.SCHEDULED,
                )
                .with_for_update(of=(Booking, Session))
            )
        ).all()
        for booking, scheduled_session in rows:
            booking.status = BookingStatus.CANCELLED
            booking.payment_status = PaymentStatus.OVERDUE
            scheduled_session.status = SessionStatus.CANCELLED
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=None,
                    action="booking.public_expired",
                    resource_type="booking",
                    resource_id=booking.id,
                    details={"session_id": str(scheduled_session.id)},
                )
            )
        if rows:
            await session.flush()

    async def _available_slots(
        self,
        session: AsyncSession,
        workspace_id: UUID,
        service: Service,
        timezone_name: str,
        starts_on: date,
        ends_on: date,
        now: datetime,
    ) -> list[AvailabilitySlot]:
        policy = await session.get(AvailabilityPolicy, workspace_id)
        if policy is None:
            return []
        windows = list(
            (
                await session.scalars(
                    select(AvailabilityWindow).where(
                        AvailabilityWindow.workspace_id == workspace_id
                    )
                )
            ).all()
        )
        timezone = ZoneInfo(timezone_name)
        range_start = datetime.combine(starts_on, time.min, timezone).astimezone(UTC)
        range_end = datetime.combine(ends_on + timedelta(days=1), time.min, timezone).astimezone(
            UTC
        )
        blackouts = list(
            (
                await session.scalars(
                    select(AvailabilityBlackout).where(
                        AvailabilityBlackout.workspace_id == workspace_id,
                        AvailabilityBlackout.starts_at < range_end,
                        AvailabilityBlackout.ends_at > range_start,
                    )
                )
            ).all()
        )
        sessions = list(
            (
                await session.scalars(
                    select(Session).where(
                        Session.workspace_id == workspace_id,
                        Session.status != SessionStatus.CANCELLED,
                        Session.start_at < range_end + timedelta(minutes=policy.buffer_before_min),
                        Session.end_at > range_start - timedelta(minutes=policy.buffer_after_min),
                    )
                )
            ).all()
        )
        earliest = now + timedelta(minutes=policy.minimum_notice_min)
        latest = now + timedelta(days=policy.maximum_advance_days)
        duration = timedelta(minutes=service.duration_min)
        interval = timedelta(minutes=policy.slot_interval_min)
        buffer_before = timedelta(minutes=policy.buffer_before_min)
        buffer_after = timedelta(minutes=policy.buffer_after_min)
        by_day: dict[int, list[AvailabilityWindow]] = {}
        for window in windows:
            by_day.setdefault(window.day_of_week, []).append(window)

        slots: list[AvailabilitySlot] = []
        current_day = starts_on
        while current_day <= ends_on:
            for window in by_day.get(current_day.isoweekday(), []):
                cursor = datetime.combine(current_day, window.start_local, timezone)
                window_end = datetime.combine(current_day, window.end_local, timezone)
                while cursor + duration <= window_end:
                    start_at = cursor.astimezone(UTC)
                    end_at = (cursor + duration).astimezone(UTC)
                    blocked_start = start_at - buffer_before
                    blocked_end = end_at + buffer_after
                    if (
                        start_at >= earliest
                        and start_at <= latest
                        and not any(
                            _overlaps(
                                blocked_start,
                                blocked_end,
                                item.starts_at,
                                item.ends_at,
                            )
                            for item in blackouts
                        )
                        and not any(
                            _overlaps(
                                blocked_start,
                                blocked_end,
                                item.start_at,
                                item.end_at,
                            )
                            for item in sessions
                        )
                    ):
                        slots.append(AvailabilitySlot(start_at=start_at, end_at=end_at))
                    cursor += interval
            current_day += timedelta(days=1)
        return slots

    async def create_booking(
        self,
        workspace_id: UUID,
        *,
        idempotency_key: str,
        values: Mapping[str, Any],
    ) -> PublicBookingResult:
        fingerprint = _fingerprint(values)
        async with self.database.tenant_transaction(workspace_id) as session:
            await session.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
                {"key": f"public-booking-idempotency:{workspace_id}:{idempotency_key}"},
            )
            await self._expire_manual_bookings(session, workspace_id, datetime.now(UTC))
            replay = await session.scalar(
                select(PublicBookingIdempotency).where(
                    PublicBookingIdempotency.workspace_id == workspace_id,
                    PublicBookingIdempotency.idempotency_key == idempotency_key,
                )
            )
            if replay is not None:
                if replay.request_fingerprint != fingerprint:
                    raise PublicBookingIdempotencyConflictError
                booking = await session.scalar(
                    select(Booking).where(
                        Booking.workspace_id == workspace_id,
                        Booking.id == replay.booking_id,
                    )
                )
                if booking is None:
                    raise RuntimeError("public booking replay lost its booking")
                scheduled_session = await session.scalar(
                    select(Session).where(
                        Session.workspace_id == workspace_id,
                        Session.id == booking.session_id,
                    )
                )
                if scheduled_session is None:
                    raise RuntimeError("public booking replay lost its session")
                return PublicBookingResult(
                    booking=booking,
                    session=scheduled_session,
                    quote=self._quote_from_booking(booking),
                    replayed=True,
                )

            service_id = values["service_id"]
            start_at = values["start_at"]
            if not isinstance(service_id, UUID) or not isinstance(start_at, datetime):
                raise PublicServiceNotFoundError
            await session.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
                {"key": f"public-booking-slot:{workspace_id}:{start_at.isoformat()}"},
            )
            row = (
                await session.execute(
                    select(
                        Service,
                        Workspace,
                        WorkspaceBusinessProfile,
                        WorkspacePaymentSettings,
                    )
                    .join(Workspace, Workspace.id == Service.workspace_id)
                    .join(
                        WorkspaceBusinessProfile,
                        WorkspaceBusinessProfile.workspace_id == Workspace.id,
                    )
                    .join(
                        WorkspacePaymentSettings,
                        WorkspacePaymentSettings.workspace_id == Workspace.id,
                    )
                    .where(
                        Service.workspace_id == workspace_id,
                        Service.id == service_id,
                        Service.active.is_(True),
                        Service.booking_mode == ServiceBookingMode.OPEN,
                        Service.capacity == 1,
                        Workspace.operational_status == WorkspaceOperationalStatus.ACTIVE,
                        WorkspaceBusinessProfile.booking_page_enabled.is_(True),
                    )
                    .with_for_update(of=Service)
                )
            ).one_or_none()
            if row is None:
                raise PublicServiceNotFoundError
            service, workspace, _profile, payments = row._tuple()
            effective_now = datetime.now(UTC)
            start_at = start_at.astimezone(UTC)
            local_day = start_at.astimezone(ZoneInfo(workspace.timezone)).date()
            available = await self._available_slots(
                session,
                workspace_id,
                service,
                workspace.timezone,
                local_day,
                local_day,
                effective_now,
            )
            slot = next((item for item in available if item.start_at == start_at), None)
            if slot is None:
                raise PublicSlotUnavailableError

            payment_method = values["payment_method"]
            if service.price_cents == 0:
                if payment_method != "free":
                    raise PublicPaymentMethodError
            elif payment_method != "manual" or not payments.manual_payment_enabled:
                raise PublicPaymentMethodError

            forms = list(
                (
                    await session.scalars(
                        select(FormTemplate)
                        .join(
                            FormTemplateService,
                            (FormTemplateService.workspace_id == FormTemplate.workspace_id)
                            & (FormTemplateService.form_template_id == FormTemplate.id),
                        )
                        .where(
                            FormTemplate.workspace_id == workspace_id,
                            FormTemplateService.service_id == service.id,
                            FormTemplate.status == FormStatus.ACTIVE,
                        )
                    )
                ).all()
            )
            submissions = values.get("form_responses", [])
            validated = self._validate_form_responses(forms, submissions)

            owner_user_id = await session.scalar(
                select(WorkspaceMembership.user_id)
                .where(WorkspaceMembership.workspace_id == workspace_id)
                .order_by(WorkspaceMembership.created_at, WorkspaceMembership.id)
                .limit(1)
            )
            if not isinstance(owner_user_id, UUID):
                raise PublicWorkspaceNotFoundError

            customer = values["customer"]
            if not isinstance(customer, Mapping):
                raise PublicFormValidationError
            email = str(customer["email"]).strip().lower()
            client = await session.scalar(
                select(Client).where(
                    Client.workspace_id == workspace_id,
                    Client.email == email,
                )
            )
            if client is None:
                client = Client(
                    id=uuid4(),
                    workspace_id=workspace_id,
                    name=f"{customer['first_name']} {customer['last_name']}".strip(),
                    email=email,
                    phone=customer.get("phone"),
                    company=customer.get("company"),
                    role=None,
                    timezone=None,
                    address=None,
                    vat_id=None,
                )
                session.add(client)
                await session.flush()

            scheduled_session = Session(
                id=uuid4(),
                workspace_id=workspace_id,
                series_id=None,
                service_id=service.id,
                calendar_owner_id=owner_user_id,
                start_at=slot.start_at,
                end_at=slot.end_at,
                capacity=1,
                status=SessionStatus.SCHEDULED,
                origin=SessionOrigin.PUBLIC_OPEN,
                location_type=service.location_type,
                location=service.location,
                address=service.address,
                notes=None,
            )
            session.add(scheduled_session)
            # The booking uses a composite tenant FK to the materialized session.
            # Persist the occurrence first so the database can validate that FK.
            await session.flush()
            booking_id = uuid4()
            quote = quote_for(service, workspace, payments)
            payment_due_at = (
                min(effective_now + timedelta(hours=48), slot.start_at)
                if payment_method == "manual"
                else None
            )
            approval_status = (
                BookingApprovalStatus.PENDING
                if service.confirmation_policy.value == "operator_approval"
                else BookingApprovalStatus.NOT_REQUIRED
            )
            payment_status = (
                PaymentStatus.FREE if payment_method == "free" else PaymentStatus.PENDING
            )
            initial_status = (
                BookingStatus.CONFIRMED
                if payment_status == PaymentStatus.FREE
                and approval_status == BookingApprovalStatus.NOT_REQUIRED
                else BookingStatus.PENDING
            )
            booking = Booking(
                id=booking_id,
                workspace_id=workspace_id,
                session_id=scheduled_session.id,
                client_id=client.id,
                status=initial_status,
                payment_status=payment_status,
                origin=BookingOrigin.PUBLIC,
                confirmation_policy_snapshot=service.confirmation_policy,
                approval_status=approval_status,
                attendance=None,
                reference=f"SLT-{booking_id.hex[:12].upper()}",
                payment_method=str(payment_method),
                amount_cents=quote.gross_amount_cents,
                net_amount_cents=quote.net_amount_cents,
                tax_amount_cents=quote.tax_amount_cents,
                tax_treatment=quote.treatment,
                tax_rate_bps=quote.rate_bps,
                tax_label=quote.label,
                tax_jurisdiction=quote.jurisdiction,
                seller_tax_number=payments.seller_tax_number,
                currency=quote.currency,
                billing_address=dict(values["billing_address"]),
                payment_due_at=payment_due_at,
                payment_received_at=None,
                approved_at=None,
                declined_at=None,
                customer_first_name=str(customer["first_name"]),
                customer_last_name=str(customer["last_name"]),
                customer_email=email,
                customer_phone=(str(customer["phone"]) if customer.get("phone") else None),
                customer_company=(
                    str(customer["company"]) if customer.get("company") else None
                ),
                provider_terms_snapshot=(
                    payments.booking_terms_content if payments.booking_terms_enabled else ""
                ),
                platform_terms_version=PLATFORM_TERMS_VERSION,
                terms_accepted_at=effective_now,
                manual_payment_instructions_snapshot=(
                    payments.manual_payment_instructions if payment_method == "manual" else ""
                ),
                notes=customer.get("notes"),
            )
            session.add(booking)
            await session.flush()
            session.add_all(
                [
                    BookingFormResponse(
                        id=uuid4(),
                        workspace_id=workspace_id,
                        booking_id=booking.id,
                        form_template_id=form.id,
                        form_name=form.name,
                        answers=answers,
                    )
                    for form, answers in validated
                ]
            )
            session.add(
                PublicBookingIdempotency(
                    id=uuid4(),
                    workspace_id=workspace_id,
                    idempotency_key=idempotency_key,
                    request_fingerprint=fingerprint,
                    booking_id=booking.id,
                )
            )
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=None,
                    action="booking.public_created",
                    resource_type="booking",
                    resource_id=booking.id,
                    details={
                        "service_id": str(service.id),
                        "session_id": str(scheduled_session.id),
                        "payment_method": payment_method,
                    },
                )
            )
            await session.flush()
            emitted = await session.scalar(
                text("SELECT public.slotera_booking_emit_event(:booking_id, :event)"),
                {
                    "booking_id": booking.id,
                    "event": (
                        "confirmed"
                        if booking.status == BookingStatus.CONFIRMED
                        else "received"
                    ),
                },
            )
            if emitted is not True:
                raise RuntimeError("public booking event could not be enqueued")
            await session.refresh(booking)
            await session.refresh(scheduled_session)
            return PublicBookingResult(booking, scheduled_session, quote, replayed=False)

    @staticmethod
    def _validate_form_responses(
        forms: list[FormTemplate], submissions: object
    ) -> list[tuple[FormTemplate, list[dict[str, object]]]]:
        if not isinstance(submissions, list):
            raise PublicFormValidationError
        forms_by_id = {form.id: form for form in forms}
        submitted_by_id: dict[UUID, list[dict[str, object]]] = {}
        for submission in submissions:
            if not isinstance(submission, Mapping):
                raise PublicFormValidationError
            form_id = submission.get("form_template_id")
            answers = submission.get("answers")
            if not isinstance(form_id, UUID) or form_id in submitted_by_id:
                raise PublicFormValidationError
            form = forms_by_id.get(form_id)
            if form is None or not isinstance(answers, list):
                raise PublicFormValidationError
            fields = {str(field["id"]): field for field in form.fields}
            normalized: list[dict[str, object]] = []
            seen: set[str] = set()
            for answer in answers:
                if not isinstance(answer, Mapping):
                    raise PublicFormValidationError
                field_id = str(answer.get("field_id", ""))
                if field_id in seen or field_id not in fields:
                    raise PublicFormValidationError
                seen.add(field_id)
                value = answer.get("value")
                field = fields[field_id]
                field_type = str(field.get("type"))
                options = field.get("options")
                if not isinstance(value, (str, list, bool)):
                    raise PublicFormValidationError
                if isinstance(value, str) and len(value) > 4000:
                    raise PublicFormValidationError
                if isinstance(value, list):
                    if len(value) > 100 or not all(isinstance(item, str) for item in value):
                        raise PublicFormValidationError
                    if options is not None and (
                        not isinstance(options, list)
                        or not all(isinstance(item, str) for item in options)
                        or not set(value) <= set(options)
                    ):
                        raise PublicFormValidationError
                if field_type != "consent_checkbox" and isinstance(value, bool):
                    raise PublicFormValidationError
                if field_type == "consent_checkbox" and value is not True:
                    raise PublicFormValidationError
                normalized.append({"field_id": field_id, "value": value})
            for field_id, field in fields.items():
                if not field.get("required"):
                    continue
                answer = next(
                    (item["value"] for item in normalized if item["field_id"] == field_id),
                    None,
                )
                if answer is None or answer == "" or answer == []:
                    raise PublicFormValidationError
            submitted_by_id[form_id] = normalized
        if any(form.required_before_payment and form.id not in submitted_by_id for form in forms):
            raise PublicFormValidationError
        return [(forms_by_id[form_id], answers) for form_id, answers in submitted_by_id.items()]

    @staticmethod
    def _quote_from_booking(booking: Booking) -> TaxQuote:
        return TaxQuote(
            treatment=booking.tax_treatment,
            rate_bps=booking.tax_rate_bps,
            label=booking.tax_label,
            jurisdiction=booking.tax_jurisdiction,
            gross_amount_cents=booking.amount_cents,
            net_amount_cents=booking.net_amount_cents,
            tax_amount_cents=booking.tax_amount_cents,
            currency=booking.currency,
        )
