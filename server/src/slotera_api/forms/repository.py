# ruff: noqa: E501, E701, E702
from typing import cast
from uuid import UUID, uuid4

from sqlalchemy import func, select

from slotera_api.database import Database
from slotera_api.db.models import AuditEvent, FormTemplate, FormTemplateService, Service


class FormsRepository:
    def __init__(self, database: Database) -> None: self.database = database
    async def list_forms(self, workspace_id: UUID) -> tuple[list[FormTemplate], int]:
        async with self.database.tenant_transaction(workspace_id) as session:
            rows = list((await session.scalars(select(FormTemplate).where(FormTemplate.workspace_id == workspace_id).order_by(FormTemplate.created_at.desc()))).all())
            return rows, len(rows)
    async def attachments(self, workspace_id: UUID, form_id: UUID) -> list[UUID]:
        async with self.database.tenant_transaction(workspace_id) as session:
            return list((await session.scalars(select(FormTemplateService.service_id).where(FormTemplateService.workspace_id == workspace_id, FormTemplateService.form_template_id == form_id))).all())
    async def create(self, workspace_id: UUID, actor: UUID, values: dict[str, object]) -> FormTemplate | None:
        service_ids = cast(list[UUID], values.pop("attached_service_ids", []))
        async with self.database.tenant_transaction(workspace_id) as session:
            if service_ids and await session.scalar(select(func.count(Service.id)).where(Service.workspace_id == workspace_id, Service.id.in_(service_ids))) != len(service_ids): return None
            item = FormTemplate(id=uuid4(), workspace_id=workspace_id, **values)
            session.add(item); await session.flush()
            session.add_all([FormTemplateService(workspace_id=workspace_id, form_template_id=item.id, service_id=item_id) for item_id in service_ids])
            session.add(AuditEvent(workspace_id=workspace_id, actor_user_id=actor, action="form.created", resource_type="form", resource_id=item.id, details={}))
            await session.flush(); await session.refresh(item); return item
