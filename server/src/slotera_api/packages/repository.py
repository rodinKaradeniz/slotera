"""Tenant-scoped package offers; no purchase or entitlement behavior."""

from typing import Literal, cast
from uuid import UUID, uuid4

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.db.models import AuditEvent, Service, ServicePackage, ServicePackageItem, Workspace
from slotera_api.errors import ApiError
from slotera_api.schemas.packages import PackageInput, PackageItemView, PackageView


async def package_view(
    session: AsyncSession,
    item: ServicePackage,
    currency: str,
    prefetched: list[ServicePackageItem] | None = None,
) -> PackageView:
    rows = (
        prefetched
        if prefetched is not None
        else (
            await session.scalars(
                select(ServicePackageItem)
                .where(
                    ServicePackageItem.workspace_id == item.workspace_id,
                    ServicePackageItem.package_id == item.id,
                )
                .order_by(ServicePackageItem.position)
            )
        ).all()
    )
    return PackageView(
        version=item.version,
        id=item.id,
        name=item.name,
        description=item.description,
        price_cents=item.price_cents,
        currency=currency,
        featured=item.featured,
        status=cast(Literal["active", "inactive"], item.status),
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
        items=[
            PackageItemView(
                id=row.id,
                service_id=row.service_id,
                title=row.title,
                description=row.description,
                order=row.position,
            )
            for row in rows
        ],
    )


async def load_package(
    session: AsyncSession, workspace_id: UUID, package_id: UUID, *, lock: bool = False
) -> ServicePackage:
    query = select(ServicePackage).where(
        ServicePackage.workspace_id == workspace_id, ServicePackage.id == package_id
    )
    item = await session.scalar(query.with_for_update() if lock else query)
    if item is None:
        raise ApiError(status_code=404, code="package_not_found", message="Package was not found")
    return item


async def save_package(
    session: AsyncSession,
    workspace_id: UUID,
    actor: UUID,
    payload: PackageInput,
    item: ServicePackage | None,
) -> PackageView:
    ids = {entry.service_id for entry in payload.items}
    found = set(
        (
            await session.scalars(
                select(Service.id)
                .where(Service.workspace_id == workspace_id, Service.id.in_(ids))
                .with_for_update()
            )
        ).all()
    )
    if found != ids:
        raise ApiError(
            status_code=404, code="package_service_not_found", message="A service was not found"
        )
    values = payload.model_dump(exclude={"items"})
    action = "package.updated" if item else "package.created"
    if item is None:
        item = ServicePackage(id=uuid4(), workspace_id=workspace_id, **values)
        session.add(item)
        await session.flush()
    else:
        item.version += 1
        for key, value in values.items():
            setattr(item, key, value)
        await session.execute(
            delete(ServicePackageItem).where(
                ServicePackageItem.workspace_id == workspace_id,
                ServicePackageItem.package_id == item.id,
            )
        )
    session.add_all(
        [
            ServicePackageItem(
                id=uuid4(),
                workspace_id=workspace_id,
                package_id=item.id,
                service_id=entry.service_id,
                title=entry.title,
                description=entry.description,
                position=index,
            )
            for index, entry in enumerate(payload.items)
        ]
    )
    session.add(
        AuditEvent(
            workspace_id=workspace_id,
            actor_user_id=actor,
            action=action,
            resource_type="package",
            resource_id=item.id,
            details={},
        )
    )
    await session.flush()
    await session.refresh(item)
    currency = await session.scalar(select(Workspace.currency).where(Workspace.id == workspace_id))
    return await package_view(session, item, str(currency))
