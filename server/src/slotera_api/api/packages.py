"""Informational package resources; no checkout or payment changes."""

from typing import Annotated, Literal, cast
from uuid import UUID

from fastapi import APIRouter, Query, Response
from sqlalchemy import func, select

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.db.models import AuditEvent, ServicePackage, ServicePackageItem, Workspace
from slotera_api.editing import ExpectedVersionDependency, ensure_version
from slotera_api.packages.repository import load_package, package_view, save_package
from slotera_api.schemas.packages import (
    PackageInput,
    PackageList,
    PackageSummary,
    PackageSummaryPage,
    PackageView,
)

router = APIRouter(prefix="/packages", tags=["packages"])


@router.get("", response_model=PackageList, operation_id="listPackages")
async def list_packages(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    search: Annotated[str, Query(max_length=160)] = "",
    status: Literal["active", "inactive"] | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PackageList:
    response.headers["Cache-Control"] = "no-store"
    async with database.tenant_transaction(operator.workspace_id, repeatable_read=True) as session:
        predicate = ServicePackage.workspace_id == operator.workspace_id
        if search.strip():
            pattern = (
                "%" + search.strip().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"
            )
            predicate &= ServicePackage.name.ilike(
                pattern, escape="!"
            ) | ServicePackage.description.ilike(pattern, escape="!")
        if status:
            predicate &= ServicePackage.status == status
        total = int(
            await session.scalar(select(func.count(ServicePackage.id)).where(predicate)) or 0
        )
        rows = (
            await session.scalars(
                select(ServicePackage)
                .where(predicate)
                .order_by(ServicePackage.created_at.desc(), ServicePackage.id)
                .limit(limit)
                .offset(offset)
            )
        ).all()
        currency = await session.scalar(
            select(Workspace.currency).where(Workspace.id == operator.workspace_id)
        )
        children: dict[UUID, list[ServicePackageItem]] = {}
        if rows:
            entries = (
                await session.scalars(
                    select(ServicePackageItem)
                    .where(
                        ServicePackageItem.workspace_id == operator.workspace_id,
                        ServicePackageItem.package_id.in_([row.id for row in rows]),
                    )
                    .order_by(ServicePackageItem.position)
                )
            ).all()
            for entry in entries:
                children.setdefault(entry.package_id, []).append(entry)
        return PackageList(
            items=[
                await package_view(session, row, str(currency), children.get(row.id, []))
                for row in rows
            ],
            total=total,
            limit=limit,
            offset=offset,
        )


@router.get("/summaries", response_model=PackageSummaryPage, operation_id="listPackageSummaries")
async def list_package_summaries(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    search: Annotated[str, Query(max_length=160)] = "",
    status: Literal["active", "inactive"] | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PackageSummaryPage:
    async with database.tenant_transaction(operator.workspace_id, repeatable_read=True) as session:
        predicate = ServicePackage.workspace_id == operator.workspace_id
        if search.strip():
            escaped = search.strip().replace("!", "!!").replace("%", "!%").replace("_", "!_")
            predicate &= ServicePackage.name.ilike(
                f"%{escaped}%", escape="!"
            ) | ServicePackage.description.ilike(f"%{escaped}%", escape="!")
        if status:
            predicate &= ServicePackage.status == status
        total = int(
            await session.scalar(select(func.count(ServicePackage.id)).where(predicate)) or 0
        )
        rows = (
            await session.scalars(
                select(ServicePackage)
                .where(predicate)
                .order_by(ServicePackage.created_at.desc(), ServicePackage.id)
                .limit(limit)
                .offset(offset)
            )
        ).all()
        currency = str(
            await session.scalar(
                select(Workspace.currency).where(Workspace.id == operator.workspace_id)
            )
        )
        count_rows = (
            (
                await session.execute(
                    select(ServicePackageItem.package_id, func.count(ServicePackageItem.id))
                    .where(
                        ServicePackageItem.workspace_id == operator.workspace_id,
                        ServicePackageItem.package_id.in_([item.id for item in rows]),
                    )
                    .group_by(ServicePackageItem.package_id)
                )
            ).all()
            if rows
            else []
        )
        counts = {key: int(value) for key, value in count_rows}
        items = [
            PackageSummary(
                id=item.id,
                name=item.name,
                description=item.description,
                price_cents=item.price_cents,
                currency=currency,
                featured=item.featured,
                status=cast(Literal["active", "inactive"], item.status),
                item_count=counts.get(item.id, 0),
            )
            for item in rows
        ]
    response.headers["Cache-Control"] = "no-store"
    return PackageSummaryPage(items=items, total=total, limit=limit, offset=offset)


@router.get("/{package_id}", response_model=PackageView, operation_id="getPackage")
async def get_package(
    package_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> PackageView:
    response.headers["Cache-Control"] = "no-store"
    async with database.tenant_transaction(operator.workspace_id) as session:
        item = await load_package(session, operator.workspace_id, package_id)
        currency = await session.scalar(
            select(Workspace.currency).where(Workspace.id == operator.workspace_id)
        )
        return await package_view(session, item, str(currency))


@router.post("", response_model=PackageView, status_code=201, operation_id="createPackage")
async def create_package(
    payload: PackageInput, operator: CsrfOperatorWorkspaceDependency, database: DatabaseDependency
) -> PackageView:
    async with database.tenant_transaction(operator.workspace_id) as session:
        return await save_package(session, operator.workspace_id, operator.user_id, payload, None)


@router.put("/{package_id}", response_model=PackageView, operation_id="updatePackage")
async def update_package(
    expected_version: ExpectedVersionDependency,
    package_id: UUID,
    payload: PackageInput,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> PackageView:
    async with database.tenant_transaction(operator.workspace_id) as session:
        item = await load_package(session, operator.workspace_id, package_id, lock=True)
        ensure_version(item, expected_version)
        return await save_package(session, operator.workspace_id, operator.user_id, payload, item)


@router.delete("/{package_id}", status_code=204, operation_id="deletePackage")
async def delete_package(
    expected_version: ExpectedVersionDependency,
    package_id: UUID,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> Response:
    async with database.tenant_transaction(operator.workspace_id) as session:
        item = await load_package(session, operator.workspace_id, package_id, lock=True)
        ensure_version(item, expected_version)
        await session.delete(item)
        session.add(
            AuditEvent(
                workspace_id=operator.workspace_id,
                actor_user_id=operator.user_id,
                action="package.deleted",
                resource_type="package",
                resource_id=item.id,
                details={},
            )
        )
    return Response(status_code=204)
