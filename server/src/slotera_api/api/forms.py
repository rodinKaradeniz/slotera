# ruff: noqa: E501
from http import HTTPStatus
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Query, Response

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.db.models import FormTemplate
from slotera_api.editing import ExpectedVersionDependency
from slotera_api.errors import ApiError
from slotera_api.forms.repository import FormsRepository
from slotera_api.schemas.forms import (
    FormFieldInput,
    FormSummary,
    FormSummaryPage,
    FormTemplateInput,
    FormTemplateListResponse,
    FormTemplatePatch,
    FormTemplateResponse,
)

router = APIRouter(prefix="/forms", tags=["forms"])


async def _response(
    repository: FormsRepository, workspace_id: UUID, item: FormTemplate
) -> FormTemplateResponse:
    return FormTemplateResponse(
        version=item.version,
        id=item.id,
        name=item.name,
        description=item.description,
        status=item.status.value,
        fields=[FormFieldInput.model_validate(field) for field in item.fields],
        attached_service_ids=await repository.attachments(workspace_id, item.id),
        required_before_payment=item.required_before_payment,
        created_at=item.created_at,
    )


@router.get("", response_model=FormTemplateListResponse, operation_id="listForms")
async def list_forms(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    search: Annotated[str, Query(max_length=160)] = "",
    status: Literal["active", "inactive"] | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> FormTemplateListResponse:
    repository = FormsRepository(database)
    items, total, attachments, states = await repository.list_page(
        operator.workspace_id, search, status, limit, offset
    )
    response.headers["Cache-Control"] = "no-store"
    return FormTemplateListResponse(
        items=[
            FormTemplateResponse(
                version=item.version,
                id=item.id,
                name=item.name,
                description=item.description,
                status=item.status.value,
                fields=[FormFieldInput.model_validate(field) for field in item.fields],
                attached_service_ids=attachments.get(item.id, []),
                required_before_payment=item.required_before_payment,
                created_at=item.created_at,
            )
            for item in items
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=FormTemplateResponse,
    status_code=HTTPStatus.CREATED,
    operation_id="createForm",
)
async def create_form(
    payload: FormTemplateInput,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> FormTemplateResponse:
    repository = FormsRepository(database)
    values = payload.model_dump()
    values["fields"] = [field.model_dump() for field in payload.fields]
    item = await repository.create(operator.workspace_id, operator.user_id, values)
    if item is None:
        raise ApiError(
            status_code=HTTPStatus.NOT_FOUND,
            code="form_service_not_found",
            message="An attached service was not found",
        )
    response.headers["Cache-Control"] = "no-store"
    return await _response(repository, operator.workspace_id, item)


@router.get("/summaries", response_model=FormSummaryPage, operation_id="listFormSummaries")
async def list_form_summaries(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    search: Annotated[str, Query(max_length=160)] = "",
    status: Literal["active", "inactive"] | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> FormSummaryPage:
    items, total, attachments, states = await FormsRepository(database).list_page(
        operator.workspace_id, search, status, limit, offset
    )
    response.headers["Cache-Control"] = "no-store"
    return FormSummaryPage(
        states=states,
        items=[
            FormSummary(
                id=item.id,
                name=item.name,
                description=item.description,
                status=item.status.value,
                field_count=len(item.fields),
                attached_service_count=len(attachments.get(item.id, [])),
            )
            for item in items
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{form_id}", response_model=FormTemplateResponse, operation_id="getForm")
async def get_form(
    form_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> FormTemplateResponse:
    repository = FormsRepository(database)
    item = await repository.get_form(operator.workspace_id, form_id)
    if item is None:
        raise ApiError(status_code=404, code="form_not_found", message="Form was not found")
    response.headers["Cache-Control"] = "no-store"
    return await _response(repository, operator.workspace_id, item)


@router.patch("/{form_id}", response_model=FormTemplateResponse, operation_id="updateForm")
async def update_form(
    expected_version: ExpectedVersionDependency,
    form_id: UUID,
    payload: FormTemplatePatch,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> FormTemplateResponse:
    values = payload.model_dump(exclude_unset=True)
    if "fields" in values and values["fields"] is not None:
        values["fields"] = [field.model_dump() for field in payload.fields or []]
    repository = FormsRepository(database)
    item = await repository.update(
        operator.workspace_id, operator.user_id, form_id, values, expected_version=expected_version
    )
    if item is None:
        raise ApiError(status_code=404, code="form_not_found", message="Form was not found")
    response.headers["Cache-Control"] = "no-store"
    return await _response(repository, operator.workspace_id, item)


@router.delete("/{form_id}", status_code=204, operation_id="deleteForm")
async def delete_form(
    expected_version: ExpectedVersionDependency,
    form_id: UUID,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> Response:
    deleted = await FormsRepository(database).delete(
        operator.workspace_id, operator.user_id, form_id, expected_version=expected_version
    )
    if not deleted:
        raise ApiError(status_code=404, code="form_not_found", message="Form was not found")
    return Response(status_code=204)
