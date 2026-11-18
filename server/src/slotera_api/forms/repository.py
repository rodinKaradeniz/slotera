# ruff: noqa: E501, E701, E702
from typing import cast
from uuid import UUID, uuid4

from sqlalchemy import delete, func, select

from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    FormTemplate,
    FormTemplateService,
    Service,
    ServiceFollowupRule,
)
from slotera_api.editing import ensure_version
from slotera_api.errors import ApiError


class FormsRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def list_forms(self, workspace_id: UUID) -> tuple[list[FormTemplate], int]:
        async with self.database.tenant_transaction(workspace_id, scheduling_write=True) as session:
            rows = list(
                (
                    await session.scalars(
                        select(FormTemplate)
                        .where(FormTemplate.workspace_id == workspace_id)
                        .order_by(FormTemplate.created_at.desc())
                    )
                ).all()
            )
            return rows, len(rows)

    async def list_page(
        self, workspace_id: UUID, search: str, status: str | None, limit: int, offset: int
    ) -> tuple[list[FormTemplate], int, dict[UUID, list[UUID]], dict[str, int]]:
        predicate = FormTemplate.workspace_id == workspace_id
        if search.strip():
            pattern = (
                "%" + search.strip().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"
            )
            predicate &= FormTemplate.name.ilike(
                pattern, escape="!"
            ) | FormTemplate.description.ilike(pattern, escape="!")
        state_predicate = predicate
        if status:
            predicate &= FormTemplate.status == status
        async with self.database.tenant_transaction(workspace_id, repeatable_read=True) as session:
            state_rows = (
                await session.execute(
                    select(FormTemplate.status, func.count())
                    .where(state_predicate)
                    .group_by(FormTemplate.status)
                )
            ).all()
            states = {str(key.value): int(value) for key, value in state_rows}
            total = int(
                await session.scalar(select(func.count(FormTemplate.id)).where(predicate)) or 0
            )
            items = list(
                (
                    await session.scalars(
                        select(FormTemplate)
                        .where(predicate)
                        .order_by(FormTemplate.created_at.desc(), FormTemplate.id)
                        .limit(limit)
                        .offset(offset)
                    )
                ).all()
            )
            attachments: dict[UUID, list[UUID]] = {}
            if items:
                rows = await session.execute(
                    select(FormTemplateService.form_template_id, FormTemplateService.service_id)
                    .where(
                        FormTemplateService.workspace_id == workspace_id,
                        FormTemplateService.form_template_id.in_([item.id for item in items]),
                    )
                    .order_by(FormTemplateService.service_id)
                )
                for form_id, service_id in rows:
                    attachments.setdefault(form_id, []).append(service_id)
            return items, total, attachments, states

    async def attachments(self, workspace_id: UUID, form_id: UUID) -> list[UUID]:
        async with self.database.tenant_transaction(workspace_id, scheduling_write=True) as session:
            return list(
                (
                    await session.scalars(
                        select(FormTemplateService.service_id).where(
                            FormTemplateService.workspace_id == workspace_id,
                            FormTemplateService.form_template_id == form_id,
                        )
                    )
                ).all()
            )

    async def create(
        self, workspace_id: UUID, actor: UUID, values: dict[str, object]
    ) -> FormTemplate | None:
        service_ids = cast(list[UUID], values.pop("attached_service_ids", []))
        async with self.database.tenant_transaction(workspace_id, scheduling_write=True) as session:
            if service_ids and await session.scalar(
                select(func.count(Service.id)).where(
                    Service.workspace_id == workspace_id, Service.id.in_(service_ids)
                )
            ) != len(service_ids):
                return None
            item = FormTemplate(id=uuid4(), workspace_id=workspace_id, **values)
            session.add(item)
            await session.flush()
            session.add_all(
                [
                    FormTemplateService(
                        workspace_id=workspace_id, form_template_id=item.id, service_id=item_id
                    )
                    for item_id in service_ids
                ]
            )
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor,
                    action="form.created",
                    resource_type="form",
                    resource_id=item.id,
                    details={},
                )
            )
            await session.flush()
            await session.refresh(item)
            return item

    async def get_form(self, workspace_id: UUID, form_id: UUID) -> FormTemplate | None:
        async with self.database.tenant_transaction(workspace_id, scheduling_write=True) as session:
            result = await session.scalar(
                select(FormTemplate).where(
                    FormTemplate.workspace_id == workspace_id,
                    FormTemplate.id == form_id,
                )
            )
            return result if isinstance(result, FormTemplate) else None

    async def update(
        self,
        workspace_id: UUID,
        actor: UUID,
        form_id: UUID,
        values: dict[str, object],
        expected_version: int | None = None,
    ) -> FormTemplate | None:
        service_ids = values.pop("attached_service_ids", None)
        async with self.database.tenant_transaction(workspace_id, scheduling_write=True) as session:
            if service_ids is not None:
                service_ids = cast(list[UUID], service_ids)
                found = (
                    await session.scalars(
                        select(Service.id)
                        .where(Service.workspace_id == workspace_id, Service.id.in_(service_ids))
                        .order_by(Service.id)
                        .with_for_update(read=True, key_share=True)
                    )
                ).all()
                if len(found) != len(service_ids):
                    return None
            item = await session.scalar(
                select(FormTemplate)
                .where(
                    FormTemplate.workspace_id == workspace_id,
                    FormTemplate.id == form_id,
                )
                .with_for_update()
            )
            if item is None:
                return None
            ensure_version(item, expected_version)
            if values.get("status") == "inactive" and await session.scalar(
                select(ServiceFollowupRule.service_id)
                .where(
                    ServiceFollowupRule.workspace_id == workspace_id,
                    ServiceFollowupRule.form_template_id == form_id,
                )
                .limit(1)
            ):
                raise ApiError(
                    status_code=409,
                    code="followup_form_in_use",
                    message="Remove this form from service follow-up settings before deactivating it.",
                )

            if service_ids is not None:
                await session.execute(
                    delete(FormTemplateService).where(
                        FormTemplateService.workspace_id == workspace_id,
                        FormTemplateService.form_template_id == form_id,
                    )
                )
                session.add_all(
                    [
                        FormTemplateService(
                            workspace_id=workspace_id,
                            form_template_id=form_id,
                            service_id=service_id,
                        )
                        for service_id in service_ids
                    ]
                )
            item.version += 1
            for field, value in values.items():
                setattr(item, field, value)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor,
                    action="form.updated",
                    resource_type="form",
                    resource_id=form_id,
                    details={"fields": sorted(values)},
                )
            )
            await session.flush()
            await session.refresh(item)
            return item

    async def delete(
        self,
        workspace_id: UUID,
        actor: UUID,
        form_id: UUID,
        expected_version: int | None = None,
    ) -> bool:
        async with self.database.tenant_transaction(workspace_id, scheduling_write=True) as session:
            item = await session.scalar(
                select(FormTemplate).where(
                    FormTemplate.workspace_id == workspace_id, FormTemplate.id == form_id
                )
            )
            if item is None:
                return False
            ensure_version(item, expected_version)
            if await session.scalar(
                select(ServiceFollowupRule.service_id)
                .where(
                    ServiceFollowupRule.workspace_id == workspace_id,
                    ServiceFollowupRule.form_template_id == form_id,
                )
                .limit(1)
            ):
                raise ApiError(
                    status_code=409,
                    code="followup_form_in_use",
                    message="Remove this form from service follow-up settings before deleting it.",
                )

            await session.delete(item)
            session.add(
                AuditEvent(
                    workspace_id=workspace_id,
                    actor_user_id=actor,
                    action="form.deleted",
                    resource_type="form",
                    resource_id=form_id,
                    details={},
                )
            )
            return True
