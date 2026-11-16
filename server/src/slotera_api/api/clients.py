import csv
import io
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from http import HTTPStatus
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Header, Query, Response
from fastapi.responses import StreamingResponse

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.clients.repository import (
    ClientEmailConflictError,
    ClientsRepository,
    ClientStats,
)
from slotera_api.db.models import Client
from slotera_api.editing import ExpectedVersionDependency
from slotera_api.errors import ApiError
from slotera_api.schemas.clients import (
    ClientCreate,
    ClientErase,
    ClientExportBooking,
    ClientExportFormResponse,
    ClientExportNote,
    ClientExportResponse,
    ClientListResponse,
    ClientPatch,
    ClientResponse,
)

router = APIRouter(prefix="/clients", tags=["clients"])


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _client_response(client: Client, stats: ClientStats | None = None) -> ClientResponse:
    stats = stats or ClientStats()
    return ClientResponse(
        version=client.version,
        erased_at=client.erased_at,
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
        total_bookings=stats.total_bookings,
        completed_bookings=stats.completed_bookings,
        cancelled_bookings=stats.cancelled_bookings,
        total_spent_cents=stats.total_spent_cents,
        tag=stats.tag,
    )


async def _with_stats(
    repository: ClientsRepository, workspace_id: UUID, client: Client
) -> ClientResponse:
    stats = await repository.client_stats(workspace_id, [client.id])
    return _client_response(client, stats.get(client.id))


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
    search: Annotated[str | None, Query(max_length=320)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    contactable: bool = False,
) -> ClientListResponse:
    repository = ClientsRepository(database)
    async with database.tenant_transaction(operator.workspace_id, repeatable_read=True) as session:
        items, total = await repository.list_clients(
            operator.workspace_id,
            search=search,
            limit=limit,
            offset=offset,
            dbsession=session,
            contactable=contactable,
        )
        stats = await repository.client_stats(
            operator.workspace_id, [item.id for item in items], dbsession=session
        )
    _private(response)
    return ClientListResponse(
        items=[_client_response(item, stats.get(item.id)) for item in items],
        total=total,
        limit=limit,
        offset=offset,
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
    return _client_response(client)  # A new client has no bookings yet.


@router.get("/export.csv", operation_id="exportClientDirectory")
async def export_directory(
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    language: Literal["en", "tr", "de"] = "en",
    search: Annotated[str, Query(max_length=320)] = "",
) -> StreamingResponse:
    async def content() -> AsyncIterator[str]:
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        headings = {
            "en": [
                "Name",
                "Email",
                "Phone",
                "Company",
                "Status",
                "Bookings",
                "Completed",
                "Cancelled",
                "Spent",
                "Currency",
                "Client since",
            ],
            "tr": [
                "Ad",
                "E-posta",
                "Telefon",
                "Şirket",
                "Durum",
                "Rezervasyonlar",
                "Tamamlanan",
                "İptal edilen",
                "Harcama",
                "Para birimi",
                "Kayıt tarihi",
            ],
            "de": [
                "Name",
                "E-Mail",
                "Telefon",
                "Unternehmen",
                "Status",
                "Buchungen",
                "Abgeschlossen",
                "Storniert",
                "Ausgaben",
                "Währung",
                "Kunde seit",
            ],
        }
        writer.writerow(headings[language])
        yield "\ufeff" + buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)
        async for row in ClientsRepository(database).export_directory(
            operator.workspace_id, search
        ):
            writer.writerow(
                [
                    "'" + value
                    if isinstance(value, str) and value.startswith(("=", "+", "-", "@", "\t", "\r"))
                    else value
                    for value in row
                ]
            )
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    return StreamingResponse(
        content(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": 'attachment; filename="clients.csv"',
        },
    )


@router.get("/{client_id}", response_model=ClientResponse, operation_id="getClient")
async def get_client(
    client_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> ClientResponse:
    repository = ClientsRepository(database)
    client = await repository.get_client(operator.workspace_id, client_id)
    if client is None:
        raise _not_found()
    _private(response)
    return await _with_stats(repository, operator.workspace_id, client)


@router.patch("/{client_id}", response_model=ClientResponse, operation_id="updateClient")
async def update_client(
    expected_version: ExpectedVersionDependency,
    client_id: UUID,
    payload: ClientPatch,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    idempotency_key: Annotated[
        str | None, Header(alias="Idempotency-Key", min_length=1, max_length=255)
    ] = None,
) -> ClientResponse:
    changes = payload.model_dump(exclude_unset=True, exclude={"email_transfer_confirmed"})
    repository = ClientsRepository(database)
    try:
        client = (
            await repository.update_client(
                operator.workspace_id,
                operator.user_id,
                client_id,
                changes,
                expected_version=expected_version,
                email_transfer_confirmed=payload.email_transfer_confirmed,
                idempotency_key=idempotency_key,
            )
            if changes
            else await repository.get_client(operator.workspace_id, client_id)
        )
    except ClientEmailConflictError as exc:
        raise _email_conflict() from exc
    if client is None:
        raise _not_found()
    _private(response)
    return await _with_stats(repository, operator.workspace_id, client)


@router.get("/{client_id}/export", response_model=ClientExportResponse, operation_id="exportClient")
async def export_client(
    client_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> ClientExportResponse:
    repository = ClientsRepository(database)
    exported = await repository.export_client(operator.workspace_id, client_id)
    if exported is None:
        raise _not_found()
    _private(response)
    return ClientExportResponse(
        exported_at=datetime.now(UTC),
        client=await _with_stats(repository, operator.workspace_id, exported["client"]),
        bookings=[ClientExportBooking(**item) for item in exported["bookings"]],
        booking_emails=exported["booking_emails"],
        communication=exported["communication"],
        form_snapshots=exported["form_snapshots"],
        form_responses=[ClientExportFormResponse(**item) for item in exported["form_responses"]],
        notes=[
            ClientExportNote(
                title=note.title,
                body=note.body,
                created_at=note.created_at,
                updated_at=note.updated_at,
            )
            for note in exported["notes"]
        ],
    )


@router.post(
    "/{client_id}/erase",
    status_code=HTTPStatus.NO_CONTENT,
    operation_id="eraseClient",
)
async def erase_client(
    expected_version: ExpectedVersionDependency,
    client_id: UUID,
    payload: ClientErase,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> Response:
    result = await ClientsRepository(database).erase_client(
        operator.workspace_id, operator.user_id, client_id, payload.confirm_email, expected_version
    )
    if result == "not_found":
        raise _not_found()
    if result == "confirmation_mismatch":
        raise ApiError(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            code="client_erase_confirmation_mismatch",
            message="Type the client's email exactly to confirm erasure",
        )
    return Response(status_code=HTTPStatus.NO_CONTENT, headers={"Cache-Control": "no-store"})
