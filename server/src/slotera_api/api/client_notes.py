from http import HTTPStatus
from uuid import UUID

from fastapi import APIRouter, Response

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.db.models import ClientNote
from slotera_api.errors import ApiError
from slotera_api.notes.repository import ClientNotesRepository
from slotera_api.notes.sanitization import has_visible_note_content, sanitize_note_html
from slotera_api.schemas.client_notes import (
    ClientNoteCreate,
    ClientNoteListResponse,
    ClientNotePatch,
    ClientNoteResponse,
)

router = APIRouter(tags=["client notes"])


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _note_response(note: ClientNote) -> ClientNoteResponse:
    return ClientNoteResponse(
        id=note.id,
        client_id=note.client_id,
        title=note.title,
        body=note.body,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


def _client_not_found() -> ApiError:
    return ApiError(
        status_code=HTTPStatus.NOT_FOUND,
        code="client_not_found",
        message="Client was not found",
    )


def _note_not_found() -> ApiError:
    return ApiError(
        status_code=HTTPStatus.NOT_FOUND,
        code="client_note_not_found",
        message="Client note was not found",
    )


def _sanitized_body(value: str) -> str:
    sanitized = sanitize_note_html(value)
    if not has_visible_note_content(sanitized):
        raise ApiError(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            code="client_note_body_invalid",
            message="Client note must include visible text",
        )
    return sanitized


@router.get(
    "/clients/{client_id}/notes",
    response_model=ClientNoteListResponse,
    operation_id="listClientNotes",
)
async def list_client_notes(
    client_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> ClientNoteListResponse:
    result = await ClientNotesRepository(database).list_notes(operator.workspace_id, client_id)
    if result is None:
        raise _client_not_found()
    notes, total = result
    _private(response)
    return ClientNoteListResponse(items=[_note_response(note) for note in notes], total=total)


@router.post(
    "/clients/{client_id}/notes",
    response_model=ClientNoteResponse,
    status_code=HTTPStatus.CREATED,
    operation_id="createClientNote",
)
async def create_client_note(
    client_id: UUID,
    payload: ClientNoteCreate,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> ClientNoteResponse:
    note = await ClientNotesRepository(database).create_note(
        operator.workspace_id,
        operator.user_id,
        client_id,
        {"title": payload.title, "body": _sanitized_body(payload.body)},
    )
    if note is None:
        raise _client_not_found()
    _private(response)
    return _note_response(note)


@router.patch(
    "/client-notes/{note_id}",
    response_model=ClientNoteResponse,
    operation_id="updateClientNote",
)
async def update_client_note(
    note_id: UUID,
    payload: ClientNotePatch,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> ClientNoteResponse:
    changes = payload.model_dump(exclude_unset=True)
    if "body" in changes:
        changes["body"] = _sanitized_body(payload.body or "")
    note = await ClientNotesRepository(database).update_note(
        operator.workspace_id, operator.user_id, note_id, changes
    )
    if note is None:
        raise _note_not_found()
    _private(response)
    return _note_response(note)


@router.delete(
    "/client-notes/{note_id}",
    status_code=HTTPStatus.NO_CONTENT,
    operation_id="deleteClientNote",
)
async def delete_client_note(
    note_id: UUID,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> Response:
    deleted = await ClientNotesRepository(database).delete_note(
        operator.workspace_id, operator.user_id, note_id
    )
    if not deleted:
        raise _note_not_found()
    return Response(status_code=HTTPStatus.NO_CONTENT)
