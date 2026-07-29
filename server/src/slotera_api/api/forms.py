# ruff: noqa: E501
from http import HTTPStatus
from uuid import UUID

from fastapi import APIRouter, Response

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.db.models import FormTemplate
from slotera_api.errors import ApiError
from slotera_api.forms.repository import FormsRepository
from slotera_api.schemas.forms import (
    FormFieldInput,
    FormTemplateInput,
    FormTemplateListResponse,
    FormTemplateResponse,
)

router = APIRouter(prefix="/forms", tags=["forms"])


async def _response(repository: FormsRepository, workspace_id: UUID, item: FormTemplate) -> FormTemplateResponse:
    return FormTemplateResponse(id=item.id, name=item.name, description=item.description, status=item.status.value, fields=[FormFieldInput.model_validate(field) for field in item.fields], attached_service_ids=await repository.attachments(workspace_id, item.id), required_before_payment=item.required_before_payment, created_at=item.created_at)


@router.get("", response_model=FormTemplateListResponse, operation_id="listForms")
async def list_forms(response: Response, operator: OperatorWorkspaceDependency, database: DatabaseDependency) -> FormTemplateListResponse:
    repository = FormsRepository(database)
    items, total = await repository.list_forms(operator.workspace_id)
    response.headers["Cache-Control"] = "no-store"
    return FormTemplateListResponse(items=[await _response(repository, operator.workspace_id, item) for item in items], total=total)


@router.post("", response_model=FormTemplateResponse, status_code=HTTPStatus.CREATED, operation_id="createForm")
async def create_form(payload: FormTemplateInput, response: Response, operator: CsrfOperatorWorkspaceDependency, database: DatabaseDependency) -> FormTemplateResponse:
    repository = FormsRepository(database)
    values = payload.model_dump()
    values["fields"] = [field.model_dump() for field in payload.fields]
    item = await repository.create(operator.workspace_id, operator.user_id, values)
    if item is None:
        raise ApiError(status_code=HTTPStatus.NOT_FOUND, code="form_service_not_found", message="An attached service was not found")
    response.headers["Cache-Control"] = "no-store"
    return await _response(repository, operator.workspace_id, item)
