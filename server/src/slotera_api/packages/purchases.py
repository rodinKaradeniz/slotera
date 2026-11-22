"""Package sales the operator records, and the sessions they cover.

The client pays outside Slotera, so a sale is a record, not a checkout. Each purchase
snapshots its package's items; a live booking holds one item (`bookings.package_purchase_id`
and `package_position`), and a partial unique index allows only one live booking per item.
A cancelled booking leaves that index, which is how a session comes back.
"""

from collections import defaultdict
from datetime import UTC, datetime
from typing import Literal, cast
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.db.models import (
    AuditEvent,
    Booking,
    BookingStatus,
    Client,
    PackagePurchase,
    PackagePurchaseItem,
    Service,
    ServicePackage,
    ServicePackageItem,
    Session,
    Workspace,
)
from slotera_api.editing import ensure_version
from slotera_api.errors import ApiError
from slotera_api.packages.notify import PackageEvent, notify_package
from slotera_api.schemas.package_purchases import (
    PackagePurchaseCreate,
    PackagePurchaseItemBooking,
    PackagePurchaseItemView,
    PackagePurchaseView,
)

LIVE_STATUSES = (
    BookingStatus.PENDING,
    BookingStatus.CONFIRMED,
    BookingStatus.COMPLETED,
    BookingStatus.NOSHOW,
)


class PackageCreditUnavailableError(Exception):
    """The purchase has no unused session for this service (or isn't this client's)."""


class PackagePurchaseVoidedError(Exception):
    """The purchase was voided; its unused sessions can't be booked."""


def _not_found() -> ApiError:
    return ApiError(
        status_code=404, code="package_purchase_not_found", message="Package sale was not found"
    )


def _purchase_id(workspace_id: UUID, actor: UUID, idempotency_key: str) -> UUID:
    # The key names the sale, so a retried request finds the row it already wrote.
    return uuid5(NAMESPACE_URL, f"slotera:package-sale:{workspace_id}:{actor}:{idempotency_key}")


async def purchase_views(
    session: AsyncSession, workspace_id: UUID, purchases: list[PackagePurchase]
) -> list[PackagePurchaseView]:
    ids = [purchase.id for purchase in purchases]
    items: dict[UUID, list[PackagePurchaseItem]] = defaultdict(list)
    holders: dict[tuple[UUID, int], PackagePurchaseItemBooking] = {}
    if ids:
        for item in await session.scalars(
            select(PackagePurchaseItem)
            .where(
                PackagePurchaseItem.workspace_id == workspace_id,
                PackagePurchaseItem.purchase_id.in_(ids),
            )
            .order_by(PackagePurchaseItem.position)
        ):
            items[item.purchase_id].append(item)
        rows = await session.execute(
            select(
                Booking.package_purchase_id,
                Booking.package_position,
                Booking.id,
                Booking.status,
                Session.start_at,
            )
            .join(
                Session, (Session.id == Booking.session_id) & (Session.workspace_id == workspace_id)
            )
            .where(
                Booking.workspace_id == workspace_id,
                Booking.package_purchase_id.in_(ids),
                Booking.status.in_(LIVE_STATUSES),
            )
        )
        for purchase_id, position, booking_id, status, start_at in rows:
            holders[(purchase_id, position)] = PackagePurchaseItemBooking(
                id=booking_id,
                status=cast(Literal["pending", "confirmed", "completed", "noshow"], status.value),
                start_at=start_at,
            )
    views = []
    for purchase in purchases:
        entries = [
            PackagePurchaseItemView(
                position=item.position,
                service_id=item.service_id,
                title=item.title_snapshot,
                booking=holders.get((purchase.id, item.position)),
            )
            for item in items[purchase.id]
        ]
        used = sum(1 for entry in entries if entry.booking is not None)
        views.append(
            PackagePurchaseView(
                id=purchase.id,
                version=purchase.version,
                client_id=purchase.client_id,
                package_id=purchase.package_id,
                package_name=purchase.package_name_snapshot,
                price_cents=purchase.price_cents,
                currency=purchase.currency,
                payment_status=cast(Literal["pending", "paid"], purchase.payment_status),
                payment_received_at=purchase.payment_received_at,
                status=cast(Literal["active", "voided"], purchase.status),
                voided_at=purchase.voided_at,
                refunded_cents=purchase.refunded_cents,
                refunded_at=purchase.refunded_at,
                notes=purchase.notes,
                items=entries,
                used_count=used,
                remaining_count=0 if purchase.status == "voided" else len(entries) - used,
                created_at=purchase.created_at,
            )
        )
    return views


async def list_for_client(
    session: AsyncSession, workspace_id: UUID, client_id: UUID
) -> list[PackagePurchaseView]:
    purchases = list(
        await session.scalars(
            select(PackagePurchase)
            .where(
                PackagePurchase.workspace_id == workspace_id, PackagePurchase.client_id == client_id
            )
            .order_by(PackagePurchase.created_at.desc(), PackagePurchase.id)
            .limit(100)
        )
    )
    return await purchase_views(session, workspace_id, purchases)


async def load_purchase(
    session: AsyncSession, workspace_id: UUID, purchase_id: UUID, *, lock: bool = False
) -> PackagePurchase:
    query = select(PackagePurchase).where(
        PackagePurchase.workspace_id == workspace_id, PackagePurchase.id == purchase_id
    )
    purchase = await session.scalar(query.with_for_update() if lock else query)
    if purchase is None:
        raise _not_found()
    return purchase


async def record_sale(
    session: AsyncSession,
    workspace_id: UUID,
    actor: UUID,
    client_id: UUID,
    payload: PackagePurchaseCreate,
    idempotency_key: str,
) -> tuple[PackagePurchaseView, bool]:
    """Record a sale; returns the purchase and whether this call created it."""
    client = await session.scalar(
        select(Client)
        .where(Client.workspace_id == workspace_id, Client.id == client_id)
        .with_for_update()
    )
    if client is None or client.erased_at is not None:
        raise ApiError(status_code=404, code="client_not_found", message="Client was not found")
    purchase_id = _purchase_id(workspace_id, actor, idempotency_key)
    existing = await session.get(PackagePurchase, purchase_id)
    if existing is not None:
        same = (
            existing.workspace_id == workspace_id
            and existing.client_id == client_id
            and existing.package_id == payload.package_id
            and existing.notes == payload.notes
        )
        if not same:
            raise _key_reused()
        return (await purchase_views(session, workspace_id, [existing]))[0], False
    purchase = await _new_sale(
        session,
        workspace_id,
        actor,
        purchase_id,
        client_id,
        payload.package_id,
        paid=payload.payment_received,
        notes=payload.notes,
        terms=None,
    )
    view = (await purchase_views(session, workspace_id, [purchase]))[0]
    if purchase.payment_status == "paid" and payload.notify_client:
        await notify_package(session, purchase, "ready", view.remaining_count)
    return view, True


async def request_sale(
    session: AsyncSession,
    workspace_id: UUID,
    client_id: UUID,
    package_id: UUID,
    idempotency_key: str,
    terms: str,
) -> tuple[PackagePurchaseView, bool]:
    """A client asks for a package on the booking page: a sale awaiting manual payment.

    A free package is paid at once. The client gets the payment details (or the ready
    email) and the workspace owner is told. Returns whether this call created it.
    """
    purchase_id = uuid5(NAMESPACE_URL, f"slotera:package-request:{workspace_id}:{idempotency_key}")
    existing = await session.get(PackagePurchase, purchase_id)
    if existing is not None:
        if existing.client_id != client_id or existing.package_id != package_id:
            raise _key_reused()
        return (await purchase_views(session, workspace_id, [existing]))[0], False
    price = await session.scalar(
        select(ServicePackage.price_cents).where(
            ServicePackage.workspace_id == workspace_id, ServicePackage.id == package_id
        )
    )
    purchase = await _new_sale(
        session,
        workspace_id,
        None,
        purchase_id,
        client_id,
        package_id,
        paid=price == 0,
        notes=None,
        terms=terms,
    )
    view = (await purchase_views(session, workspace_id, [purchase]))[0]
    event: PackageEvent = "ready" if purchase.payment_status == "paid" else "requested"
    await notify_package(session, purchase, event, view.remaining_count, tell_owner=True)
    return view, True


def _key_reused() -> ApiError:
    return ApiError(
        status_code=409,
        code="idempotency_key_reused",
        message="The idempotency key was already used for a different sale",
    )


async def _new_sale(
    session: AsyncSession,
    workspace_id: UUID,
    actor: UUID | None,
    purchase_id: UUID,
    client_id: UUID,
    package_id: UUID,
    *,
    paid: bool,
    notes: str | None,
    terms: str | None,
) -> PackagePurchase:
    package = await session.scalar(
        select(ServicePackage).where(
            ServicePackage.workspace_id == workspace_id, ServicePackage.id == package_id
        )
    )
    if package is None:
        raise ApiError(status_code=404, code="package_not_found", message="Package was not found")
    package_items = list(
        await session.scalars(
            select(ServicePackageItem)
            .where(
                ServicePackageItem.workspace_id == workspace_id,
                ServicePackageItem.package_id == package.id,
            )
            .order_by(ServicePackageItem.position)
        )
    )
    if package.status != "active" or not package_items:
        raise ApiError(
            status_code=409,
            code="package_not_for_sale",
            message="Only an active package with sessions can be sold",
        )
    currency = await session.scalar(select(Workspace.currency).where(Workspace.id == workspace_id))
    now = datetime.now(UTC)
    purchase = PackagePurchase(
        id=purchase_id,
        workspace_id=workspace_id,
        client_id=client_id,
        package_id=package.id,
        package_name_snapshot=package.name,
        price_cents=package.price_cents,
        currency=str(currency),
        payment_status="paid" if paid else "pending",
        payment_received_at=now if paid else None,
        status="active",
        voided_at=None,
        notes=notes,
        provider_terms_snapshot=terms,
        terms_accepted_at=now if terms is not None else None,
    )
    session.add(purchase)
    await session.flush()
    titles = await _service_names(
        session, workspace_id, {item.service_id for item in package_items}
    )
    session.add_all(
        [
            PackagePurchaseItem(
                workspace_id=workspace_id,
                purchase_id=purchase.id,
                service_id=item.service_id,
                position=index,
                title_snapshot=(item.title or titles.get(item.service_id, ""))[:160],
            )
            for index, item in enumerate(package_items)
        ]
    )
    action = "package_purchase.recorded" if actor else "package_purchase.requested"
    _audit(session, workspace_id, actor, action, purchase, client=str(client_id))
    await session.flush()
    await session.refresh(purchase)
    return purchase


async def mark_paid(
    session: AsyncSession, workspace_id: UUID, actor: UUID, purchase_id: UUID, expected: int
) -> PackagePurchaseView:
    purchase = await _locked_for_change(session, workspace_id, purchase_id, expected)
    if purchase.payment_status != "pending":
        raise _transition_error()
    purchase.payment_status = "paid"
    purchase.payment_received_at = datetime.now(UTC)
    purchase.version += 1
    _audit(session, workspace_id, actor, "package_purchase.payment_received", purchase)
    await session.flush()
    await session.refresh(purchase)
    view = (await purchase_views(session, workspace_id, [purchase]))[0]
    # The client can book now; tell them, unless the sale was already voided.
    if purchase.status == "active":
        await notify_package(session, purchase, "ready", view.remaining_count)
    return view


async def void(
    session: AsyncSession, workspace_id: UUID, actor: UUID, purchase_id: UUID, expected: int
) -> PackagePurchaseView:
    purchase = await _locked_for_change(session, workspace_id, purchase_id, expected)
    if purchase.status != "active":
        raise _transition_error()
    purchase.status = "voided"
    purchase.voided_at = datetime.now(UTC)
    purchase.version += 1
    _audit(session, workspace_id, actor, "package_purchase.voided", purchase)
    await session.flush()
    await session.refresh(purchase)
    return (await purchase_views(session, workspace_id, [purchase]))[0]


async def refund(
    session: AsyncSession,
    workspace_id: UUID,
    actor: UUID,
    purchase_id: UUID,
    expected: int,
    amount_cents: int,
) -> PackagePurchaseView:
    """Record money given back for a paid sale; refunds add up to at most the price."""
    purchase = await _locked_for_change(session, workspace_id, purchase_id, expected)
    if (
        purchase.payment_status != "paid"
        or amount_cents > purchase.price_cents - purchase.refunded_cents
    ):
        raise ApiError(
            status_code=409,
            code="package_refund_invalid",
            message="A refund can only be recorded on a paid sale, up to its price",
        )
    purchase.refunded_cents += amount_cents
    purchase.refunded_at = datetime.now(UTC)
    purchase.version += 1
    _audit(
        session,
        workspace_id,
        actor,
        "package_purchase.refund_recorded",
        purchase,
        amount_cents=str(amount_cents),
    )
    await session.flush()
    await session.refresh(purchase)
    return (await purchase_views(session, workspace_id, [purchase]))[0]


async def claim_item(
    session: AsyncSession, workspace_id: UUID, purchase_id: UUID, client_id: UUID, service_id: UUID
) -> tuple[PackagePurchase, int]:
    """Lock the purchase and return the lowest unused position for `service_id`.

    The caller writes the booking in the same transaction; the partial unique index is the
    final guard if two transactions ever pick the same item.
    """
    purchase = await session.scalar(
        select(PackagePurchase)
        .where(PackagePurchase.workspace_id == workspace_id, PackagePurchase.id == purchase_id)
        .with_for_update()
    )
    if purchase is None or purchase.client_id != client_id:
        raise PackageCreditUnavailableError
    if purchase.status != "active":
        raise PackagePurchaseVoidedError
    taken = set(
        await session.scalars(
            select(Booking.package_position).where(
                Booking.workspace_id == workspace_id,
                Booking.package_purchase_id == purchase_id,
                Booking.status.in_(LIVE_STATUSES),
            )
        )
    )
    position = await session.scalar(
        select(PackagePurchaseItem.position)
        .where(
            PackagePurchaseItem.workspace_id == workspace_id,
            PackagePurchaseItem.purchase_id == purchase_id,
            PackagePurchaseItem.service_id == service_id,
            PackagePurchaseItem.position.not_in(taken),
        )
        .order_by(PackagePurchaseItem.position)
        .limit(1)
    )
    if position is None:
        raise PackageCreditUnavailableError
    return purchase, int(position)


async def package_summary(
    session: AsyncSession, workspace_id: UUID, purchase_id: UUID
) -> tuple[str, int] | None:
    """The package name and its number of sessions, for a booking's display."""
    name = await session.scalar(
        select(PackagePurchase.package_name_snapshot).where(
            PackagePurchase.workspace_id == workspace_id, PackagePurchase.id == purchase_id
        )
    )
    if name is None:
        return None
    total = len(
        list(
            await session.scalars(
                select(PackagePurchaseItem.id).where(
                    PackagePurchaseItem.workspace_id == workspace_id,
                    PackagePurchaseItem.purchase_id == purchase_id,
                )
            )
        )
    )
    return str(name), total


async def _service_names(
    session: AsyncSession, workspace_id: UUID, ids: set[UUID]
) -> dict[UUID, str]:
    rows = await session.execute(
        select(Service.id, Service.name).where(
            Service.workspace_id == workspace_id, Service.id.in_(ids)
        )
    )
    return {service_id: name for service_id, name in rows}


async def _locked_for_change(
    session: AsyncSession, workspace_id: UUID, purchase_id: UUID, expected: int
) -> PackagePurchase:
    purchase = await load_purchase(session, workspace_id, purchase_id, lock=True)
    ensure_version(purchase, expected)
    return purchase


def _transition_error() -> ApiError:
    return ApiError(
        status_code=409,
        code="package_purchase_transition_invalid",
        message="This package sale can't make that change",
    )


def _audit(
    session: AsyncSession,
    workspace_id: UUID,
    actor: UUID | None,
    action: str,
    purchase: PackagePurchase,
    **details: str,
) -> None:
    session.add(
        AuditEvent(
            workspace_id=workspace_id,
            actor_user_id=actor,
            action=action,
            resource_type="package_purchase",
            resource_id=purchase.id,
            details={"package_id": str(purchase.package_id), **details},
        )
    )
