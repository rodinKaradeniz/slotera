"""Typed, allow-listed adapters to existing commands; no HTTP or model executes writes."""

import inspect
import json
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, cast
from uuid import UUID

from fastapi import Response
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.ai.provider import Action
from slotera_api.api import (
    bookings,
    clients,
    operator_resources,
    packages,
    scheduling,
    session_action_items,
)
from slotera_api.database import Database
from slotera_api.db.models import (
    Booking,
    Client,
    Service,
    ServicePackage,
    Session,
    SessionActionItem,
    SessionSeries,
    Workspace,
    WorkspaceBusinessProfile,
    WorkspacePaymentSettings,
)
from slotera_api.errors import ApiError
from slotera_api.schemas.bookings import BookingMoveCommand, OperatorBookingCreate
from slotera_api.schemas.clients import ClientCreate, ClientPatch
from slotera_api.schemas.operator_resources import ServiceCreate, ServicePatch
from slotera_api.schemas.packages import PackageInput
from slotera_api.schemas.scheduling import SessionCreate, SessionPatch
from slotera_api.schemas.session_action_items import SessionActionItemPatch

# name -> schema, command, resource model, resource parameter
REGISTRY: dict[str, tuple[type[BaseModel] | None, Any, Any, str]] = {
    "client.create": (ClientCreate, clients.create_client, Client, "client_id"),
    "client.update": (ClientPatch, clients.update_client, Client, "client_id"),
    "task.create": (
        session_action_items.TaskCreate,
        session_action_items.create_task,
        SessionActionItem,
        "item_id",
    ),
    "task.update": (
        SessionActionItemPatch,
        session_action_items.update_session_action_item,
        SessionActionItem,
        "item_id",
    ),
    "service.create": (ServiceCreate, operator_resources.create_service, Service, "service_id"),
    "service.update": (ServicePatch, operator_resources.update_service, Service, "service_id"),
    "package.create": (PackageInput, packages.create_package, ServicePackage, "package_id"),
    "package.update": (PackageInput, packages.update_package, ServicePackage, "package_id"),
    "session.create": (SessionCreate, scheduling.create_session, Session, "session_id"),
    "session.update": (SessionPatch, scheduling.update_session, Session, "session_id"),
    "session.cancel": (None, scheduling.cancel_session, Session, "session_id"),
    "booking.create": (
        OperatorBookingCreate,
        bookings.create_operator_booking,
        Booking,
        "booking_id",
    ),
    "booking.move": (BookingMoveCommand, bookings.move_booking, Booking, "booking_id"),
    "booking.cancel": (None, bookings.cancel_booking, Booking, "booking_id"),
    "booking.complete": (None, bookings.complete_booking, Booking, "booking_id"),
    "booking.no_show": (None, bookings.mark_booking_noshow, Booking, "booking_id"),
}


def contract() -> str:
    commands: dict[str, Any] = {}
    for name, (schema, *_) in REGISTRY.items():
        arguments: dict[str, Any] = (
            schema.model_json_schema()
            if schema
            else {"type": "object", "additionalProperties": False, "properties": {}}
        )
        if name in {"session.update", "session.cancel"}:
            arguments.setdefault("properties", {})["scope"] = {
                "type": "string",
                "enum": ["this", "this_and_following"],
                "default": "this",
            }
        commands[name] = {
            "resource_id": "null for creation; exact current record UUID for changes",
            "arguments": arguments,
        }
    return json.dumps(commands, separators=(",", ":"))


def invalid(message: str = "Review the request and supply all required values.") -> ApiError:
    return ApiError(status_code=422, code="ai_clarification_required", message=message)


def parse(action: Action) -> tuple[Any, dict[str, Any], str]:
    if action.name not in REGISTRY:
        raise invalid("This operation must be completed in its existing app screen.")
    try:
        body = json.loads(action.arguments_json)
        if not isinstance(body, dict):
            raise ValueError()
        if action.name == "client.update" and (
            "email" in body
            or "emailTransferConfirmed" in body
            or "email_transfer_confirmed" in body
        ):
            raise invalid("Email transfers must use the reviewed client editor.")
        if action.name == "session.create" and any(
            k in body for k in ("recurrence", "calendarOwnerId", "calendar_owner_id")
        ):
            raise invalid("Create recurring series or another calendar owner's time in Calendar.")
        scope = (
            body.pop("scope", "this")
            if action.name in {"session.update", "session.cancel"}
            else "this"
        )
        if scope not in {"this", "this_and_following"}:
            raise ValueError()
        schema = REGISTRY[action.name][0]
        payload = schema.model_validate(body) if schema else None
        if schema is None and body:
            raise ValueError()
        return payload, body, scope
    except (ValueError, ValidationError, TypeError):
        raise invalid() from None


def snapshot(item: Any) -> dict[str, Any]:
    return {
        key: str(getattr(item, key))
        if isinstance(getattr(item, key), (UUID, datetime))
        else getattr(item, key)
        for key in (
            "id",
            "name",
            "title",
            "version",
            "status",
            "payment_status",
            "amount_cents",
            "price_cents",
            "start_at",
            "end_at",
            "capacity",
            "location",
            "service_id",
            "client_id",
            "session_id",
            "active",
        )
        if hasattr(item, key)
    }


async def prepare(
    session: AsyncSession, workspace: UUID, action: Action, database: Database, operator: Any
) -> dict[str, Any]:
    if action.name == "booking.create":
        values = json.loads(action.arguments_json)
        values.setdefault("language", operator.authenticated.session.preferred_language)
        values.setdefault("sendEmail", True)
        action = action.model_copy(update={"arguments_json": json.dumps(values)})
    payload, body, scope = parse(action)
    _, _, model, _ = REGISTRY[action.name]
    before: dict[str, Any] = {}
    item = None
    if not action.name.endswith(".create"):
        try:
            identifier = UUID(action.resource_id or "")
        except ValueError:
            raise invalid("Choose one exact record first.") from None
        item = await session.scalar(
            select(model).where(model.workspace_id == workspace, model.id == identifier)
        )
        if item is None or (isinstance(item, Client) and item.erased_at):
            raise invalid("The selected record is not available.")
        before = snapshot(item)
    elif action.resource_id is not None:
        raise invalid("Creation must not replace an existing record.")
    # References never rely on model-generated ownership claims.
    values = payload.model_dump(exclude_unset=True) if payload else {}
    references: list[dict[str, Any]] = []
    related: dict[str, str] = {}
    selected_session = None
    target: Any
    selected: Any
    for field, target in (
        ("client_id", Client),
        ("service_id", Service),
        ("session_id", Session),
        ("target_session_id", Session),
    ):
        reference = values.get(field)
        if reference is not None:
            selected = await session.scalar(
                select(target).where(target.workspace_id == workspace, target.id == reference)
            )
            if selected is None or (isinstance(selected, Client) and selected.erased_at):
                raise invalid("A referenced record is not available in this workspace.")
            references.append(
                {"kind": target.__tablename__, "id": str(selected.id), "state": snapshot(selected)}
            )
            related[str(selected.id)] = getattr(selected, "name", str(selected.id))
            if isinstance(selected, Session):
                selected_session = selected
                service = await session.scalar(
                    select(Service).where(
                        Service.workspace_id == workspace, Service.id == selected.service_id
                    )
                )
                if service:
                    references.append(
                        {"kind": "services", "id": str(service.id), "state": snapshot(service)}
                    )
                    related[str(service.id)] = service.name
    for part in values.get("items", []):
        catalog_item = await session.scalar(
            select(Service).where(
                Service.workspace_id == workspace, Service.id == part["service_id"]
            )
        )
        if catalog_item is None:
            raise invalid("Choose services from this workspace.")
        references.append(
            {"kind": "services", "id": str(catalog_item.id), "state": snapshot(catalog_item)}
        )
        related[str(catalog_item.id)] = catalog_item.name
    workspace_facts = await session.get(Workspace, workspace)
    if workspace_facts is None:
        raise invalid()
    review: dict[str, Any] = {
        "action": action.model_dump(),
        "before": before,
        "changes": payload.model_dump(mode="json", exclude_unset=True) if payload else {},
        "scope": scope,
        "expected_version": getattr(item, "version", None),
        "expires_at": (datetime.now(UTC) + timedelta(minutes=10)).isoformat(),
        "status": "proposed",
        "references": references,
        "related": related,
        "currency": workspace_facts.currency,
        "timezone": workspace_facts.timezone,
    }
    if action.name == "booking.create" and selected_session:
        from slotera_api.booking_financials import quote_for

        service = await session.get(Service, selected_session.service_id)
        workspace_row = await session.get(Workspace, workspace)
        payments = await session.get(WorkspacePaymentSettings, workspace)
        profile = await session.get(WorkspaceBusinessProfile, workspace)
        if not service or not payments or not workspace_row or not profile:
            raise invalid()
        review["quote"] = asdict(quote_for(service, workspace_row, payments))
        review["settings_revision"] = profile.version

    if action.name in {"session.update", "session.cancel"}:
        impact = await scheduling.preview_session_change(
            UUID(action.resource_id or ""),
            Response(),
            operator,
            database,
            cast(Literal["this", "this_and_following"], scope),
        )
        review["impact"] = impact.model_dump(mode="json", by_alias=True)
        if item and item.series_id:
            series = await session.get(SessionSeries, item.series_id)
            review["series_version"] = series.version if series else None
    review["effects"] = (
        "Uses existing booking/payment rules; booking/session changes may queue"
        " client notices. Cancellation preserves payment and may require a "
        "manual refund. Catalog changes affect future offers; existing "
        "snapshots stay unchanged."
    )
    return review


async def execute(
    review: dict[str, Any],
    session: AsyncSession,
    workspace: UUID,
    database: Database,
    operator: Any,
    key: str,
) -> dict[str, Any]:
    if datetime.fromisoformat(review["expires_at"]) <= datetime.now(UTC):
        raise ApiError(
            status_code=409,
            code="resource_stale",
            message="This proposal expired; request a fresh review.",
        )
    action = Action.model_validate(review["action"])
    payload, _, scope = parse(action)
    _, command, model, parameter = REGISTRY[action.name]
    if action.resource_id:
        item = await session.scalar(
            select(model)
            .where(model.workspace_id == workspace, model.id == UUID(action.resource_id))
            .with_for_update()
        )
        if item is None or snapshot(item) != review["before"]:
            raise ApiError(
                status_code=409,
                code="resource_stale",
                message="The record changed; request a fresh review.",
            )
    for reference in review.get("references", []):
        reference_model: Any = {"clients": Client, "services": Service, "sessions": Session}[
            reference["kind"]
        ]
        current = await session.scalar(
            select(reference_model)
            .where(
                reference_model.workspace_id == workspace,
                reference_model.id == UUID(reference["id"]),
            )
            .with_for_update()
        )
        if current is None or snapshot(current) != reference["state"]:
            raise ApiError(
                status_code=409,
                code="resource_stale",
                message="A related record changed; request a fresh review.",
            )
    if "settings_revision" in review:
        profile = await session.scalar(
            select(WorkspaceBusinessProfile)
            .where(WorkspaceBusinessProfile.workspace_id == workspace)
            .with_for_update()
        )
        if not profile or profile.version != review["settings_revision"]:
            raise ApiError(
                status_code=409,
                code="resource_stale",
                message="Payment settings changed; review the booking price again.",
            )
    arguments = {
        "payload": payload,
        "response": Response(),
        "operator": operator,
        "database": database,
        "expected_version": review.get("expected_version"),
        "idempotency_key": key,
        "scope": scope,
        "series_version": review.get("series_version"),
        "impact_revision": review.get("impact", {}).get("revision"),
    }
    if action.resource_id:
        arguments[parameter] = UUID(action.resource_id)
    result = await command(
        **{
            key: value
            for key, value in arguments.items()
            if key in inspect.signature(command).parameters
        }
    )
    return result.model_dump(mode="json") if isinstance(result, BaseModel) else {}
