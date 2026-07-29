from http import HTTPStatus
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.clients.repository import ClientEmailConflictError, ClientsRepository
from slotera_api.db.models import Client
from slotera_api.errors import ApiError
from slotera_api.schemas.clients import (
    ClientCreate,
    ClientListResponse,
    ClientPatch,
    ClientResponse,
)

router = APIRouter(prefix="/clients", tags=["clients"])


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _client_response(client: Client) -> ClientResponse:
    return ClientResponse(
        id=client.id,
        name=client.name,
        email=client.email,
        phone=client.phone,
        company=client.company,
        role=client.role,
        timezone=client.timezone,
        address=client.address,
        vat_id=client.vat_id,
        created_at=client.created_at,
        updated_at=client.updated_at,
    )


def _not_found() -> ApiError:
    return ApiError(
        status_code=HTTPStatus.NOT_FOUND,
        code="client_not_found",
        message="Client was not found",
    )


def _email_conflict() -> ApiError:
    return ApiError(
        status_code=HTTPStatus.CONFLICT,
        code="client_email_conflict",
        message="A client with this email already exists in the workspace",
    )


@router.get("", response_model=ClientListResponse, operation_id="listClients")
async def list_clients(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    search: Annotated[str | None, Query(max_length=160)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ClientListResponse:
    items, total = await ClientsRepository(database).list_clients(
        operator.workspace_id, search=search, limit=limit, offset=offset
    )
    _private(response)
    return ClientListResponse(
        items=[_client_response(item) for item in items], total=total, limit=limit, offset=offset
    )


@router.post(
    "",
    response_model=ClientResponse,
    status_code=HTTPStatus.CREATED,
    operation_id="createClient",
)
async def create_client(
    payload: ClientCreate,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> ClientResponse:
    try:
        client = await ClientsRepository(database).create_client(
            operator.workspace_id, operator.user_id, payload.model_dump()
        )
    except ClientEmailConflictError as exc:
        raise _email_conflict() from exc
    _private(response)
    return _client_response(client)


@router.get("/{client_id}", response_model=ClientResponse, operation_id="getClient")
async def get_client(
    client_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> ClientResponse:
    client = await ClientsRepository(database).get_client(operator.workspace_id, client_id)
    if client is None:
        raise _not_found()
    _private(response)
    return _client_response(client)


@router.patch("/{client_id}", response_model=ClientResponse, operation_id="updateClient")
async def update_client(
    client_id: UUID,
    payload: ClientPatch,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> ClientResponse:
    changes = payload.model_dump(exclude_unset=True)
    repository = ClientsRepository(database)
    try:
        client = (
            await repository.update_client(
                operator.workspace_id, operator.user_id, client_id, changes
            )
            if changes
            else await repository.get_client(operator.workspace_id, client_id)
        )
    except ClientEmailConflictError as exc:
        raise _email_conflict() from exc
    if client is None:
        raise _not_found()
    _private(response)
    return _client_response(client)
