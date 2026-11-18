"""Authenticated consultant-only assistant resources."""

from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, Query, Response
from pydantic import Field
from sqlalchemy import delete, func, select, text

from slotera_api.ai import actions
from slotera_api.ai.service import AssistantService, active, fail, state_row, turn_view
from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
    SettingsDependency,
)
from slotera_api.db.ai_models import AIThread, AITurn
from slotera_api.db.models import AuditEvent
from slotera_api.schemas.operator_resources import StrictApiModel

router = APIRouter(prefix="/ai", tags=["assistant"])
Key = Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=255)]


class AIStatus(StrictApiModel):
    enabled: bool
    available: bool
    simulated: bool
    revision: int
    privacy_epoch: int
    pending: int
    failed: int
    indexed: int
    daily_answers: int
    daily_tokens: int
    indexing_tokens: int
    answer_limit: int
    token_limit: int
    indexing_limit: int
    timezone: str
    resets_at: datetime


class SettingsInput(StrictApiModel):
    enabled: bool
    revision: int = Field(ge=1)


class ThreadInput(StrictApiModel):
    id: UUID
    title: str = Field(min_length=1, max_length=120)


class ThreadView(StrictApiModel):
    id: UUID
    title: str
    created_at: datetime


class ThreadPage(StrictApiModel):
    items: list[ThreadView]
    total: int
    limit: int
    offset: int


class Citation(StrictApiModel):
    id: str
    title: str
    href: str


class TurnView(StrictApiModel):
    id: UUID
    thread_id: UUID
    prompt: str
    answer: str
    language: Literal["en", "tr", "de"]
    status: Literal["pending", "completed", "failed"]
    citations: list[Citation]
    proposal: dict[str, Any] | None
    error_code: str | None
    created_at: datetime


class TurnPage(StrictApiModel):
    items: list[TurnView]
    total: int
    limit: int
    offset: int


class TurnInput(StrictApiModel):
    prompt: str = Field(min_length=1, max_length=4000)
    language: Literal["en", "tr", "de"] = "en"


class BriefInput(StrictApiModel):
    language: Literal["en", "tr", "de"] = "en"
    refresh: bool = False


class ConfirmInput(StrictApiModel):
    proposal_hash: str = Field(min_length=64, max_length=64)


@router.get("/status", response_model=AIStatus, operation_id="getAIStatus")
async def status(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    settings: SettingsDependency,
) -> AIStatus:
    response.headers["Cache-Control"] = "no-store"
    return AIStatus.model_validate(
        await AssistantService(database, settings).status(operator.workspace_id)
    )


@router.patch("/settings", response_model=AIStatus, operation_id="updateAISettings")
async def configure(
    payload: SettingsInput,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    settings: SettingsDependency,
) -> AIStatus:
    return AIStatus.model_validate(
        await AssistantService(database, settings).configure(
            operator.workspace_id, payload.enabled, payload.revision
        )
    )


@router.delete("/history", status_code=204, operation_id="clearAIHistory")
async def clear(
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    settings: SettingsDependency,
) -> None:
    await AssistantService(database, settings).clear(operator.workspace_id)


@router.post("/threads", response_model=ThreadView, operation_id="createAIThread")
async def create_thread(
    payload: ThreadInput,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    settings: SettingsDependency,
) -> ThreadView:
    item = await AssistantService(database, settings).thread(
        operator.workspace_id, operator.user_id, payload.id, payload.title
    )
    return ThreadView(id=item.id, title=item.title, created_at=item.created_at)


@router.get("/threads", response_model=ThreadPage, operation_id="listAIThreads")
async def threads(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ThreadPage:
    async with database.tenant_transaction(operator.workspace_id, repeatable_read=True) as session:
        query = select(AIThread).where(
            AIThread.workspace_id == operator.workspace_id,
            AIThread.actor_id == operator.user_id,
            AIThread.created_at > datetime.now(UTC) - timedelta(days=30),
            AIThread.kind == "chat",
        )
        total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
        rows = (
            await session.scalars(
                query.order_by(AIThread.created_at.desc(), AIThread.id).limit(limit).offset(offset)
            )
        ).all()
        result = ThreadPage(
            items=[ThreadView(id=r.id, title=r.title, created_at=r.created_at) for r in rows],
            total=total,
            limit=limit,
            offset=offset,
        )
    response.headers["Cache-Control"] = "no-store"
    return result


@router.delete("/threads/{identifier}", status_code=204, operation_id="deleteAIThread")
async def delete_thread(
    identifier: UUID, operator: CsrfOperatorWorkspaceDependency, database: DatabaseDependency
) -> None:
    async with database.tenant_transaction(operator.workspace_id, scheduling_write=True) as session:
        state = await state_row(session, operator.workspace_id, True)
        state.privacy_epoch += 1
        await session.execute(
            delete(AIThread).where(
                AIThread.workspace_id == operator.workspace_id,
                AIThread.actor_id == operator.user_id,
                AIThread.id == identifier,
            )
        )


@router.get("/threads/{identifier}/turns", response_model=TurnPage, operation_id="listAITurns")
async def turns(
    identifier: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TurnPage:
    async with database.tenant_transaction(operator.workspace_id, repeatable_read=True) as session:
        query = select(AITurn).where(
            AITurn.workspace_id == operator.workspace_id,
            AITurn.actor_id == operator.user_id,
            AITurn.thread_id == identifier,
            AITurn.created_at > datetime.now(UTC) - timedelta(days=30),
        )
        total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
        rows = (
            await session.scalars(
                query.order_by(AITurn.created_at.desc(), AITurn.id).limit(limit).offset(offset)
            )
        ).all()
        result = TurnPage(
            items=[TurnView.model_validate(turn_view(r)) for r in reversed(rows)],
            total=total,
            limit=limit,
            offset=offset,
        )
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post("/threads/{identifier}/turns", response_model=TurnView, operation_id="createAITurn")
async def generate(
    identifier: UUID,
    payload: TurnInput,
    idempotency_key: Key,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    settings: SettingsDependency,
) -> TurnView:
    item = await AssistantService(database, settings).generate(
        operator, identifier, payload.prompt, payload.language, idempotency_key
    )
    return TurnView.model_validate(turn_view(item))


@router.get("/operations/{identifier}", response_model=TurnView, operation_id="getAIOperation")
async def operation(
    identifier: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> TurnView:
    async with database.tenant_transaction(operator.workspace_id) as session:
        item = await session.scalar(
            select(AITurn).where(
                AITurn.workspace_id == operator.workspace_id,
                AITurn.actor_id == operator.user_id,
                AITurn.id == identifier,
                AITurn.created_at > datetime.now(UTC) - timedelta(days=30),
            )
        )
        if item is None:
            raise fail("ai_operation_not_found", "This operation was not found.", 404)
        result = TurnView.model_validate(turn_view(item))
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post("/briefings/{kind}", response_model=TurnView, operation_id="generateAIBriefing")
async def briefing(
    kind: Literal["client"],
    payload: BriefInput,
    idempotency_key: Key,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
    settings: SettingsDependency,
    client_id: Annotated[UUID | None, Query(alias="clientId")] = None,
) -> TurnView:
    if client_id is None:
        raise fail("ai_client_required", "Choose a client.", 422)
    prompts = {
        "en": "Summarize this client’s history, bookings, preparation, messages and open work.",
        "tr": "Danışan geçmişini, görüşmeleri, hazırlığı, mesajları ve açık işleri özetle.",
        "de": "Kundenbriefing: Verlauf, Buchungen, Vorbereitung, Nachrichten und offene Aufgaben.",
    }
    prompt = prompts[payload.language]

    item = await AssistantService(database, settings).generate(
        operator,
        uuid4(),
        prompt,
        payload.language,
        idempotency_key,
        client_id,
        kind,
        payload.refresh,
    )
    return TurnView.model_validate(turn_view(item))


@router.post(
    "/proposals/{identifier}/confirm", response_model=TurnView, operation_id="confirmAIProposal"
)
async def confirm(
    identifier: UUID,
    payload: ConfirmInput,
    idempotency_key: Key,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> TurnView:
    import hashlib
    import json

    async with database.command_transaction(operator.workspace_id) as session:
        state = await active(session, operator.workspace_id)
        row = await session.scalar(
            select(AITurn)
            .where(
                AITurn.workspace_id == operator.workspace_id,
                AITurn.actor_id == operator.user_id,
                AITurn.id == identifier,
            )
            .with_for_update()
        )
        if not row or not row.proposal or row.privacy_epoch != state.privacy_epoch:
            raise fail("ai_proposal_unavailable", "Request a fresh proposal.")
        proposal = row.proposal
        # Hash covers the review, not mutable execution bookkeeping.
        reviewed = {
            key: value
            for key, value in proposal.items()
            if key not in {"hash", "result", "confirmationKey"}
        }
        expected = hashlib.sha256(
            json.dumps(reviewed, sort_keys=True, default=str).encode()
        ).hexdigest()
        if payload.proposal_hash != proposal.get("hash", expected):
            raise fail("resource_stale", "Review the current proposal before confirming.")
        if proposal.get("status") == "executed":
            if proposal.get("confirmationKey") != idempotency_key:
                raise fail("ai_already_executed", "This action was already completed.")
            return TurnView.model_validate(turn_view(row))
        result = await actions.execute(
            proposal, session, operator.workspace_id, database, operator, "ai:" + str(row.id)
        )
        row.proposal = {
            **proposal,
            "status": "executed",
            "result": result,
            "confirmationKey": idempotency_key,
        }
        session.add(
            AuditEvent(
                workspace_id=operator.workspace_id,
                actor_user_id=operator.user_id,
                action="ai.action_executed",
                resource_type="ai_turn",
                resource_id=row.id,
                details={"command": proposal["action"]["name"]},
            )
        )
        await session.flush()
        return TurnView.model_validate(turn_view(row))


@router.get("/briefings/{kind}", response_model=TurnView | None, operation_id="getAIBriefing")
async def get_briefing(
    kind: Literal["client"],
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    client_id: Annotated[UUID | None, Query(alias="clientId")] = None,
) -> TurnView | None:
    from slotera_api.db.ai_models import AIBriefing

    if client_id is None:
        raise fail("ai_client_required", "Choose a client.", 422)
    scope = "client:" + str(client_id)
    async with database.tenant_transaction(operator.workspace_id) as session:
        row = await session.scalar(
            select(AITurn)
            .join(AIBriefing, AIBriefing.turn_id == AITurn.id)
            .where(
                AITurn.workspace_id == operator.workspace_id,
                AITurn.actor_id == operator.user_id,
                AIBriefing.workspace_id == operator.workspace_id,
                AIBriefing.actor_id == operator.user_id,
                AIBriefing.scope == scope,
                AITurn.created_at > datetime.now(UTC) - timedelta(days=30),
            )
        )
        result = TurnView.model_validate(turn_view(row)) if row else None
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post("/index/retry", status_code=204, operation_id="retryAIIndexing")
async def retry_index(
    operator: CsrfOperatorWorkspaceDependency, database: DatabaseDependency
) -> None:
    from sqlalchemy import text

    async with database.tenant_transaction(operator.workspace_id, scheduling_write=True) as session:
        await active(session, operator.workspace_id)
        await session.execute(
            text(
                "UPDATE ai_jobs SET "
                "attempts=0,claimed_at=NULL,due_at=now(),revision=revision+1"
                " WHERE workspace_id=:w AND attempts>=5"
            ),
            {"w": operator.workspace_id},
        )


class StopInput(StrictApiModel):
    key: str = Field(min_length=1, max_length=255)
    prompt: str = Field(min_length=1, max_length=4000)
    language: Literal["en", "tr", "de"]


@router.post("/threads/{identifier}/stop", status_code=204, operation_id="stopAITurn")
async def stop_turn(
    identifier: UUID,
    payload: StopInput,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> None:
    from slotera_api.ai.service import running_generations, turn_fingerprint

    async with database.tenant_transaction(operator.workspace_id, scheduling_write=True) as session:
        state = await active(session, operator.workspace_id)
        thread = await session.scalar(
            select(AIThread).where(
                AIThread.workspace_id == operator.workspace_id,
                AIThread.actor_id == operator.user_id,
                AIThread.id == identifier,
            )
        )
        if not thread:
            raise fail("ai_thread_not_found", "Conversation was not found.", 404)
        fingerprint = turn_fingerprint(identifier, payload.prompt, payload.language)
        row = await session.scalar(
            select(AITurn)
            .where(
                AITurn.workspace_id == operator.workspace_id,
                AITurn.actor_id == operator.user_id,
                AITurn.key == payload.key,
            )
            .with_for_update()
        )
        if row and (row.thread_id != identifier or row.fingerprint != fingerprint):
            raise fail("idempotency_key_reused", "The request changed.")
        if row is None:
            row = AITurn(
                workspace_id=operator.workspace_id,
                actor_id=operator.user_id,
                thread_id=identifier,
                key=payload.key,
                fingerprint=fingerprint,
                prompt=payload.prompt,
                answer="",
                language=payload.language,
                privacy_epoch=state.privacy_epoch,
                citations=[],
                status="failed",
                error_code="ai_cancelled",
            )
            session.add(row)
        elif row.status == "pending":
            row.status = "failed"
            row.error_code = "ai_cancelled"
        else:
            return  # Completed answers and confirmed actions are never undone by Stop.
    task = running_generations.get((operator.workspace_id, operator.user_id, payload.key))
    if task:
        task.cancel()


class BranchInput(StrictApiModel):
    title: str = Field(min_length=1, max_length=120)
    thread_id: UUID
    turn_id: UUID


@router.post(
    "/threads/{identifier}/branch", response_model=ThreadView, operation_id="branchAIThread"
)
async def branch_thread(
    identifier: UUID,
    payload: BranchInput,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> ThreadView:
    async with database.tenant_transaction(operator.workspace_id, scheduling_write=True) as session:
        await active(session, operator.workspace_id)
        source = await session.scalar(
            select(AITurn).where(
                AITurn.id == payload.turn_id,
                AITurn.thread_id == identifier,
                AITurn.actor_id == operator.user_id,
                AITurn.workspace_id == operator.workspace_id,
                AITurn.created_at > datetime.now(UTC) - timedelta(days=30),
            )
        )
        if source is None:
            raise fail("ai_thread_not_found", "Conversation was not found.", 404)
        details = {
            "sourceThreadId": str(identifier),
            "sourceTurnId": str(source.id),
            "titleHash": sha256(payload.title.encode()).hexdigest(),
        }
        existing = await session.scalar(
            select(AIThread).where(
                AIThread.id == payload.thread_id,
                AIThread.workspace_id == operator.workspace_id,
                AIThread.actor_id == operator.user_id,
            )
        )
        if existing:
            audit = await session.scalar(
                select(AuditEvent).where(
                    AuditEvent.workspace_id == operator.workspace_id,
                    AuditEvent.resource_id == existing.id,
                    AuditEvent.actor_user_id == operator.user_id,
                    AuditEvent.action == "ai.thread_branched",
                )
            )
            if not audit or any(audit.details.get(key) != value for key, value in details.items()):
                raise fail("idempotency_key_reused", "The branch request changed.")
            return ThreadView(id=existing.id, title=existing.title, created_at=existing.created_at)
        thread = AIThread(
            id=payload.thread_id,
            workspace_id=operator.workspace_id,
            actor_id=operator.user_id,
            title=payload.title,
        )
        session.add(thread)
        await session.flush()
        # Copy prior conversation only; executable proposals remain solely in original history.
        await session.execute(
            text("""
            INSERT INTO ai_turns(id,workspace_id,actor_id,thread_id,key,fingerprint,prompt,answer,
                language,status,privacy_epoch,citations,proposal,error_code,created_at)
            SELECT gen_random_uuid(),workspace_id,actor_id,:new,gen_random_uuid()::text,fingerprint,
                prompt,answer,language,status,privacy_epoch,citations,NULL,error_code,created_at
            FROM ai_turns WHERE workspace_id=:w AND actor_id=:actor AND thread_id=:old
                AND (created_at,id)<(:created,:turn) AND status<>'pending'
                AND created_at>now()-interval '30 days'
        """),
            {
                "new": thread.id,
                "w": operator.workspace_id,
                "actor": operator.user_id,
                "old": identifier,
                "created": source.created_at,
                "turn": source.id,
            },
        )
        session.add(
            AuditEvent(
                workspace_id=operator.workspace_id,
                actor_user_id=operator.user_id,
                action="ai.thread_branched",
                resource_type="ai_thread",
                resource_id=thread.id,
                details=details,
            )
        )
        return ThreadView(id=thread.id, title=thread.title, created_at=thread.created_at)
