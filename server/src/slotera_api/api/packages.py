"""Informational package resources; no checkout or payment changes."""

from uuid import UUID

from fastapi import APIRouter, Response
from sqlalchemy import select

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.db.models import AuditEvent, ServicePackage, Workspace
from slotera_api.packages.repository import load_package, package_view, save_package
from slotera_api.schemas.packages import PackageInput, PackageList, PackageView

router = APIRouter(prefix="/packages", tags=["packages"])


@router.get("", response_model=PackageList, operation_id="listPackages")
async def list_packages(
    response: Response, operator: OperatorWorkspaceDependency, database: DatabaseDependency
) -> PackageList:
    response.headers["Cache-Control"] = "no-store"
    async with database.tenant_transaction(operator.workspace_id) as session:
        rows = (
            await session.scalars(
                select(ServicePackage)
                .where(ServicePackage.workspace_id == operator.workspace_id)
                .order_by(ServicePackage.created_at.desc())
            )
        ).all()
        currency = await session.scalar(
            select(Workspace.currency).where(Workspace.id == operator.workspace_id)
        )
        return PackageList(items=[await package_view(session, row, str(currency)) for row in rows])


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
    package_id: UUID,
    payload: PackageInput,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> PackageView:
    async with database.tenant_transaction(operator.workspace_id) as session:
        item = await load_package(session, operator.workspace_id, package_id, lock=True)
        return await save_package(session, operator.workspace_id, operator.user_id, payload, item)


@router.delete("/{package_id}", status_code=204, operation_id="deletePackage")
async def delete_package(
    package_id: UUID, operator: CsrfOperatorWorkspaceDependency, database: DatabaseDependency
) -> Response:
    async with database.tenant_transaction(operator.workspace_id) as session:
        item = await load_package(session, operator.workspace_id, package_id, lock=True)
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
