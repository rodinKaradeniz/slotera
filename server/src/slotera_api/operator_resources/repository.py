from collections.abc import Mapping
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select

from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    LocationType,
    Service,
    Workspace,
    WorkspaceBusinessProfile,
    WorkspaceLocation,
    WorkspacePaymentSettings,
)


class OperatorResourcesRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def get_business(
        self, workspace_id: UUID
    ) -> tuple[Workspace, WorkspaceBusinessProfile] | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            row = (
                await session.execute(
                    select(Workspace, WorkspaceBusinessProfile)
                    .join(
                        WorkspaceBusinessProfile,
                        WorkspaceBusinessProfile.workspace_id == Workspace.id,
                    )
                    .where(Workspace.id == workspace_id)
                )
            ).one_or_none()
            return None if row is None else (row[0], row[1])

    async def update_business(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        workspace_changes: Mapping[str, Any],
        profile_changes: Mapping[str, Any],
    ) -> tuple[Workspace, WorkspaceBusinessProfile] | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            workspace = await session.get(Workspace, workspace_id)
            profile = await session.get(WorkspaceBusinessProfile, workspace_id)
            if workspace is None or profile is None:
                return None
            for key, value in workspace_changes.items():
                setattr(workspace, key, value)
            for key, value in profile_changes.items():
                setattr(profile, key, value)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="business_settings.updated",
                    resource_type="workspace",
                    resource_id=workspace_id,
                    details={"fields": sorted((*workspace_changes, *profile_changes))},
                )
            )
            await session.flush()
            await session.refresh(workspace)
            await session.refresh(profile)
            return workspace, profile

    async def get_payment_settings(self, workspace_id: UUID) -> WorkspacePaymentSettings | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            result = await session.get(WorkspacePaymentSettings, workspace_id)
            return result if isinstance(result, WorkspacePaymentSettings) else None

    async def update_payment_settings(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        changes: Mapping[str, Any],
    ) -> WorkspacePaymentSettings | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            item = await session.get(WorkspacePaymentSettings, workspace_id)
            if item is None:
                return None
            treatment = changes.get("tax_treatment", item.tax_treatment)
            rate = changes.get("tax_rate_bps", item.tax_rate_bps)
            if treatment == "none":
                changes = {**changes, "tax_rate_bps": 0}
            elif int(rate) == 0:
                return None
            for key, value in changes.items():
                setattr(item, key, value)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="payment_settings.updated",
                    resource_type="workspace_payment_settings",
                    resource_id=workspace_id,
                    details={"fields": sorted(changes)},
                )
            )
            await session.flush()
            await session.refresh(item)
            return item

    async def list_locations(self, workspace_id: UUID) -> list[WorkspaceLocation]:
        async with self.database.tenant_transaction(workspace_id) as session:
            return list(
                (
                    await session.scalars(
                        select(WorkspaceLocation)
                        .order_by(WorkspaceLocation.created_at, WorkspaceLocation.id)
                        .where(WorkspaceLocation.workspace_id == workspace_id)
                    )
                ).all()
            )

    async def create_location(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        values: Mapping[str, Any],
    ) -> WorkspaceLocation:
        async with self.database.tenant_transaction(workspace_id) as session:
            location = WorkspaceLocation(id=uuid4(), workspace_id=workspace_id, **values)
            session.add(location)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="workspace_location.created",
                    resource_type="workspace_location",
                    resource_id=location.id,
                    details={},
                )
            )
            await session.flush()
            await session.refresh(location)
            return location

    async def update_location(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        location_id: UUID,
        changes: Mapping[str, Any],
    ) -> WorkspaceLocation | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            location = await session.scalar(
                select(WorkspaceLocation).where(
                    WorkspaceLocation.id == location_id,
                    WorkspaceLocation.workspace_id == workspace_id,
                )
            )
            if location is None:
                return None
            for key, value in changes.items():
                setattr(location, key, value)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="workspace_location.updated",
                    resource_type="workspace_location",
                    resource_id=location.id,
                    details={"fields": sorted(changes)},
                )
            )
            await session.flush()
            await session.refresh(location)
            return location

    async def delete_location(
        self, workspace_id: UUID, actor_user_id: UUID, location_id: UUID
    ) -> bool:
        async with self.database.tenant_transaction(workspace_id) as session:
            location = await session.scalar(
                select(WorkspaceLocation).where(
                    WorkspaceLocation.id == location_id,
                    WorkspaceLocation.workspace_id == workspace_id,
                )
            )
            if location is None:
                return False
            await session.delete(location)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="workspace_location.deleted",
                    resource_type="workspace_location",
                    resource_id=location_id,
                    details={},
                )
            )
            return True

    async def list_services(
        self,
        workspace_id: UUID,
        *,
        search: str | None,
        active: bool | None,
        location_type: LocationType | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Service], int, str]:
        filters: list[Any] = [Service.workspace_id == workspace_id]
        if search:
            pattern = f"%{search.strip()}%"
            filters.append(or_(Service.name.ilike(pattern), Service.description.ilike(pattern)))
        if active is not None:
            filters.append(Service.active == active)
        if location_type is not None:
            filters.append(Service.location_type == location_type)
        async with self.database.tenant_transaction(workspace_id) as session:
            currency = await session.scalar(
                select(Workspace.currency).where(Workspace.id == workspace_id)
            )
            if currency is None:
                return [], 0, "EUR"
            total = await session.scalar(select(func.count(Service.id)).where(*filters))
            services = list(
                (
                    await session.scalars(
                        select(Service)
                        .where(*filters)
                        .order_by(Service.created_at.desc(), Service.id)
                        .limit(limit)
                        .offset(offset)
                    )
                ).all()
            )
            return services, int(total or 0), currency

    async def get_service(self, workspace_id: UUID, service_id: UUID) -> tuple[Service, str] | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            row = (
                await session.execute(
                    select(Service, Workspace.currency)
                    .join(Workspace, Workspace.id == Service.workspace_id)
                    .where(
                        Service.id == service_id,
                        Service.workspace_id == workspace_id,
                    )
                )
            ).one_or_none()
            return None if row is None else (row[0], row[1])

    async def create_service(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        values: Mapping[str, Any],
    ) -> tuple[Service, str]:
        async with self.database.tenant_transaction(workspace_id) as session:
            currency = await session.scalar(
                select(Workspace.currency).where(Workspace.id == workspace_id)
            )
            if currency is None:
                raise RuntimeError("authenticated workspace no longer exists")
            service = Service(id=uuid4(), workspace_id=workspace_id, **values)
            session.add(service)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="service.created",
                    resource_type="service",
                    resource_id=service.id,
                    details={},
                )
            )
            await session.flush()
            await session.refresh(service)
            return service, currency

    async def update_service(
        self,
        workspace_id: UUID,
        actor_user_id: UUID,
        service_id: UUID,
        changes: Mapping[str, Any],
    ) -> tuple[Service, str] | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            service = await session.scalar(
                select(Service).where(
                    Service.id == service_id,
                    Service.workspace_id == workspace_id,
                )
            )
            currency = await session.scalar(
                select(Workspace.currency).where(Workspace.id == workspace_id)
            )
            if service is None or currency is None:
                return None
            for key, value in changes.items():
                setattr(service, key, value)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="service.updated",
                    resource_type="service",
                    resource_id=service.id,
                    details={"fields": sorted(changes)},
                )
            )
            await session.flush()
            await session.refresh(service)
            return service, currency

    async def delete_service(
        self, workspace_id: UUID, actor_user_id: UUID, service_id: UUID
    ) -> bool:
        async with self.database.tenant_transaction(workspace_id) as session:
            service = await session.scalar(
                select(Service).where(
                    Service.id == service_id,
                    Service.workspace_id == workspace_id,
                )
            )
            if service is None:
                return False
            await session.delete(service)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor_user_id,
                    action="service.deleted",
                    resource_type="service",
                    resource_id=service_id,
                    details={},
                )
            )
            return True
