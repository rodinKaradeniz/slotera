"""Generation orchestration with short transactions, usage reservations and privacy fences."""

import asyncio
import hashlib
import json
import logging
from datetime import UTC, datetime, timedelta
from time import perf_counter
from typing import Any
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.ai import actions
from slotera_api.ai.provider import Provider, create_provider, metrics
from slotera_api.ai.retrieval import enqueue_all, retrieve
from slotera_api.auth.repository import AuthRepository
from slotera_api.config import Settings
from slotera_api.database import Database
from slotera_api.db.ai_models import (
    AIBriefing,
    AIDocument,
    AIJob,
    AIState,
    AIThread,
    AITurn,
    AIUsage,
)
from slotera_api.db.models import Client, Workspace
from slotera_api.errors import ApiError
from slotera_api.identity import hash_opaque_token

logger = logging.getLogger("slotera.ai")
running_generations: dict[tuple[UUID, UUID, str], asyncio.Task[Any]] = {}


def turn_fingerprint(thread: UUID, prompt: str, language: str) -> str:
    return hashlib.sha256(
        json.dumps([thread, prompt, language, "None", False], default=str).encode()
    ).hexdigest()


def fail(code: str, message: str, status: int = 409) -> ApiError:
    return ApiError(status_code=status, code=code, message=message)


async def state_row(session: AsyncSession, workspace: UUID, lock: bool = False) -> AIState:
    await session.execute(
        text("INSERT INTO ai_states(workspace_id) VALUES(:w) ON CONFLICT DO NOTHING"),
        {"w": workspace},
    )
    query = select(AIState).where(AIState.workspace_id == workspace)
    if lock:
        query = query.with_for_update()
    result = await session.scalar(query)
    assert result is not None
    return result


async def active(session: AsyncSession, workspace: UUID, epoch: int | None = None) -> AIState:
    state = await state_row(session, workspace)
    workspace_row = await session.get(Workspace, workspace)
    if (
        not state.enabled
        or not workspace_row
        or workspace_row.operational_status.value != "active"
        or (epoch is not None and state.privacy_epoch != epoch)
    ):
        raise fail(
            "ai_context_changed", "AI access or private context changed; start a fresh request."
        )
    return state


def turn_view(turn: AITurn) -> dict[str, Any]:
    status = turn.status
    code = turn.error_code
    if status == "pending" and turn.created_at < datetime.now(UTC) - timedelta(seconds=90):
        status = "failed"
        code = "ai_interrupted"
    return {
        "id": turn.id,
        "threadId": turn.thread_id,
        "prompt": turn.prompt,
        "answer": turn.answer,
        "language": turn.language,
        "status": status,
        "citations": turn.citations,
        "proposal": turn.proposal,
        "errorCode": code,
        "createdAt": turn.created_at,
    }


class AssistantService:
    def __init__(self, database: Database, settings: Settings, provider: Provider | None = None):
        self.database = database
        self.settings = settings
        self.provider = provider

    async def status(self, workspace: UUID) -> dict[str, Any]:
        async with self.database.tenant_transaction(workspace) as session:
            state = await state_row(session, workspace)
            workspace_row = await session.get(Workspace, workspace)
            assert workspace_row
            local = datetime.now(ZoneInfo(workspace_row.timezone))
            day = local.date()
            usage = await session.get(AIUsage, (workspace, day))
            pending = await session.scalar(
                select(func.count())
                .select_from(AIJob)
                .where(AIJob.workspace_id == workspace, AIJob.attempts < 5)
            )
            failed = await session.scalar(
                select(func.count())
                .select_from(AIJob)
                .where(AIJob.workspace_id == workspace, AIJob.attempts >= 5)
            )
            indexed = await session.scalar(
                select(func.count())
                .select_from(AIDocument)
                .where(AIDocument.workspace_id == workspace)
            )
            return {
                "enabled": state.enabled,
                "available": self.settings.ai_provider != "disabled",
                "simulated": self.settings.ai_provider == "local",
                "revision": state.revision,
                "privacyEpoch": state.privacy_epoch,
                "pending": pending or 0,
                "failed": failed or 0,
                "indexed": indexed or 0,
                "dailyAnswers": usage.answers if usage else 0,
                "dailyTokens": usage.tokens if usage else 0,
                "indexingTokens": usage.indexing_tokens if usage else 0,
                "answerLimit": self.settings.ai_daily_answers,
                "tokenLimit": self.settings.ai_daily_tokens,
                "indexingLimit": self.settings.ai_daily_indexing_tokens,
                "timezone": workspace_row.timezone,
                "resetsAt": datetime.combine(
                    day + timedelta(days=1), datetime.min.time(), tzinfo=local.tzinfo
                ),
            }

    async def configure(self, workspace: UUID, enabled: bool, revision: int) -> dict[str, Any]:
        if enabled and self.settings.ai_provider == "disabled":
            raise fail("ai_unavailable", "AI is not configured on this server.", 503)
        async with self.database.tenant_transaction(workspace, scheduling_write=True) as session:
            state = await state_row(session, workspace, True)
            if state.revision != revision:
                raise fail("resource_stale", "Review the latest AI settings before saving.")
            if state.enabled != enabled:
                state.enabled = enabled
                state.revision += 1
                state.privacy_epoch += 1
                await session.execute(delete(AIThread).where(AIThread.workspace_id == workspace))
                await session.execute(
                    delete(AIDocument).where(AIDocument.workspace_id == workspace)
                )
                await session.execute(delete(AIJob).where(AIJob.workspace_id == workspace))
                if enabled:
                    await enqueue_all(session, workspace)
        return await self.status(workspace)

    async def clear(self, workspace: UUID) -> None:
        async with self.database.tenant_transaction(workspace, scheduling_write=True) as session:
            state = await state_row(session, workspace, True)
            state.privacy_epoch += 1
            await session.execute(delete(AIThread).where(AIThread.workspace_id == workspace))

    async def thread(self, workspace: UUID, actor: UUID, identifier: UUID, title: str) -> AIThread:
        async with self.database.tenant_transaction(workspace) as session:
            await active(session, workspace)
            await session.execute(
                text(
                    "INSERT INTO ai_threads(id,workspace_id,actor_id,title) "
                    "VALUES(:id,:w,:a,:title) ON CONFLICT DO NOTHING"
                ),
                {"id": identifier, "w": workspace, "a": actor, "title": title[:120]},
            )
            item = await session.scalar(
                select(AIThread).where(
                    AIThread.workspace_id == workspace,
                    AIThread.actor_id == actor,
                    AIThread.id == identifier,
                )
            )
            if item is None:
                raise fail("ai_thread_not_found", "Conversation was not found.", 404)
            return item

    async def generate(
        self,
        operator: Any,
        thread_id: UUID,
        prompt: str,
        language: str,
        key: str,
        client_id: UUID | None = None,
        briefing: str | None = None,
        refresh: bool = False,
    ) -> AITurn:
        workspace = operator.workspace_id
        actor = operator.user_id
        fingerprint = hashlib.sha256(
            json.dumps(
                [
                    briefing if briefing else thread_id,
                    prompt,
                    language,
                    str(client_id),
                    refresh,
                ],
                default=str,
            ).encode()
        ).hexdigest()
        started = perf_counter()
        identifier = uuid4()
        reserved = 0
        async with self.database.tenant_transaction(workspace, scheduling_write=True) as session:
            state = await active(session, workspace)
            existing = await session.scalar(
                select(AITurn).where(
                    AITurn.workspace_id == workspace, AITurn.actor_id == actor, AITurn.key == key
                )
            )
            if existing:
                if existing.fingerprint != fingerprint:
                    raise fail(
                        "idempotency_key_reused",
                        "This request changed; submit it as a new request.",
                    )
                return existing
            workspace_row = await session.get(Workspace, workspace)
            assert workspace_row
            timezone = workspace_row.timezone
            local = datetime.now(ZoneInfo(timezone))
            if client_id and not await session.scalar(
                select(Client.id).where(
                    Client.workspace_id == workspace,
                    Client.id == client_id,
                    Client.erased_at.is_(None),
                )
            ):
                raise fail("client_not_found", "Client was not found.", 404)
            if briefing and not client_id:
                raise fail("ai_client_required", "Choose a client.", 422)
            scope = "client:" + str(client_id)
            if briefing:
                cached = await session.scalar(
                    select(AIBriefing).where(
                        AIBriefing.workspace_id == workspace,
                        AIBriefing.actor_id == actor,
                        AIBriefing.scope == scope,
                    )
                )
                if cached:
                    if not refresh and cached.language == language:
                        item = await session.get(AITurn, cached.turn_id)
                        if item:
                            return item
                    if cached.generated_at > datetime.now(UTC) - timedelta(minutes=15):
                        raise fail(
                            "ai_refresh_wait",
                            "This briefing can be refreshed after fifteen minutes.",
                            429,
                        )
            thread = await session.scalar(
                select(AIThread).where(
                    AIThread.workspace_id == workspace,
                    AIThread.actor_id == actor,
                    AIThread.id == thread_id,
                )
            )
            if not thread:
                if not briefing:
                    raise fail("ai_thread_not_found", "Conversation was not found.", 404)
                name = await session.scalar(
                    select(Client.name).where(
                        Client.workspace_id == workspace, Client.id == client_id
                    )
                )
                prefix = {
                    "en": "Client briefing",
                    "tr": "Danışan özeti",
                    "de": "Kundenbriefing",
                }[language]
                title = prefix + ": " + str(name)
                thread = AIThread(
                    id=thread_id,
                    workspace_id=workspace,
                    actor_id=actor,
                    title=title[:120],
                    title_generated=True,
                    kind="client",
                )
                session.add(thread)
                await session.flush()
            recent = await session.scalar(
                select(func.count())
                .select_from(AITurn)
                .where(
                    AITurn.workspace_id == workspace,
                    AITurn.status == "pending",
                    AITurn.created_at > datetime.now(UTC) - timedelta(seconds=90),
                )
            )
            if (recent or 0) >= 2:
                raise fail("ai_busy", "Two requests are already running; retry shortly.", 429)
            thread.created_at = datetime.now(UTC)
            history_rows = list(
                (
                    await session.scalars(
                        select(AITurn)
                        .where(
                            AITurn.workspace_id == workspace,
                            AITurn.actor_id == actor,
                            AITurn.thread_id == thread_id,
                            AITurn.status == "completed",
                        )
                        .order_by(AITurn.created_at.desc(), AITurn.id)
                        .limit(4)
                    )
                ).all()
            )
            history = [
                {"request": r.prompt[:500], "answer": r.answer[:500]}
                for r in reversed(history_rows)
            ]
            epoch = state.privacy_epoch
            source_snapshot = await session.scalar(text("SELECT pg_current_snapshot()::text"))
            commands = actions.contract()
            # UTF-8 bytes conservatively bound input tokens, including bounded retrieval,
            # routing, query embeddings, instructions and the output allowance.
            reserved = (
                len(json.dumps([prompt, history, commands], ensure_ascii=False).encode()) + 24000
            )
            await session.execute(
                text(
                    "INSERT INTO ai_usage(workspace_id,day) VALUES(:w,:day) ON CONFLICT DO NOTHING"
                ),
                {"w": workspace, "day": local.date()},
            )
            allowed = await session.scalar(
                text(
                    "UPDATE ai_usage SET answers=answers+1,tokens=tokens+:n WHERE "
                    "workspace_id=:w AND day=:day AND answers<:cap AND tokens+:n<=:tokens "
                    "RETURNING answers"
                ),
                {
                    "w": workspace,
                    "day": local.date(),
                    "n": reserved,
                    "cap": self.settings.ai_daily_answers,
                    "tokens": self.settings.ai_daily_tokens,
                },
            )
            if allowed is None:
                raise fail("ai_quota_exceeded", "The daily AI budget is exhausted.", 429)
            turn = AITurn(
                id=identifier,
                workspace_id=workspace,
                actor_id=actor,
                thread_id=thread_id,
                key=key,
                fingerprint=fingerprint,
                prompt=prompt,
                language=language,
                status="pending",
                privacy_epoch=epoch,
                answer="",
                citations=[],
            )
            session.add(turn)
            await session.flush()
        met = {"calls": 0, "reported": 0, "tokens": 0}
        met_token = metrics.set(met)
        task = asyncio.current_task()
        if task:
            running_generations[(workspace, actor, key)] = task
        try:
            async with self.database.tenant_transaction(workspace) as session:
                status = await session.scalar(
                    select(AITurn.status).where(
                        AITurn.workspace_id == workspace, AITurn.id == identifier
                    )
                )
                if status != "pending":
                    raise fail("ai_cancelled", "Generation was stopped.")
            provider = self.provider or create_provider(self.settings)
            async with asyncio.timeout(65):
                route = await provider.route(prompt)
                category = route.category if route.confidence >= 0.75 else "clarify"
                vector = (await provider.embed([prompt]))[0] if category != "clarify" else None
                evidence = (
                    await retrieve(
                        self.database,
                        workspace,
                        prompt,
                        vector,
                        category,
                        client_id,
                        timezone,
                        actor,
                    )
                    if category != "clarify"
                    else []
                )
                coverage = await self.status(workspace)
                pending_count = coverage["pending"] + coverage["failed"]
                if pending_count:
                    evidence.insert(
                        0,
                        {
                            "id": "coverage",
                            "title": "Index coverage",
                            "href": "/admin/settings?section=ai",
                            "content": (
                                "Indexing is incomplete. Narrative search may omit records; do not "
                                "claim absence. Current structured facts remain available."
                            ),
                        },
                    )
                answer = await provider.answer(
                    prompt,
                    evidence,
                    language,
                    history,
                    commands if category == "action" else "No write proposals for this request.",
                )
            by_id = {str(x["id"]): x for x in evidence}
            if any(identifier not in by_id for identifier in answer.citation_ids):
                raise fail(
                    "ai_invalid_output",
                    "The answer contained an unavailable source; try again.",
                    502,
                )
            verified = await AuthRepository(self.database).session_for_token(
                hash_opaque_token(operator.authenticated.session_token)
            )
            if verified is None or verified.user_id != actor or verified.workspace_id != workspace:
                raise fail("unauthorized", "Sign in again before requesting an answer.", 401)
            async with self.database.command_transaction(workspace) as session:
                await active(session, workspace, epoch)
                if await session.scalar(
                    text(
                        "SELECT EXISTS(SELECT 1 FROM ai_source_revisions WHERE workspace_id=:w "
                        "AND NOT pg_visible_in_snapshot(CAST(transaction_id AS text)::xid8, "
                        "CAST(:snapshot AS text)::pg_snapshot))"
                    ),
                    {"w": workspace, "snapshot": source_snapshot},
                ):
                    raise fail(
                        "ai_context_changed", "Source records changed; request a current answer."
                    )
                row = await session.scalar(
                    select(AITurn)
                    .where(
                        AITurn.workspace_id == workspace,
                        AITurn.actor_id == actor,
                        AITurn.id == identifier,
                    )
                    .with_for_update()
                )
                if not row:
                    raise fail(
                        "ai_context_changed", "Private context changed; start a new request."
                    )
                if row.status != "pending":
                    raise fail("ai_cancelled", "Generation was stopped.")
                if answer.conversation_title and not briefing:
                    conversation = await session.get(AIThread, row.thread_id)
                    title = " ".join(answer.conversation_title.split())[:80]
                    if conversation and not conversation.title_generated and title:
                        conversation.title = title
                        conversation.title_generated = True
                row.answer = answer.text
                row.status = "completed"
                row.citations = [
                    {name: by_id[key][name] for name in ("id", "title", "href")}
                    for key in dict.fromkeys(answer.citation_ids)
                ]
                if answer.action:
                    if category != "action":
                        raise fail(
                            "ai_invalid_output", "A read request cannot propose an action.", 502
                        )
                    proposal = await actions.prepare(
                        session, workspace, answer.action, self.database, operator
                    )
                    proposal["hash"] = hashlib.sha256(
                        json.dumps(proposal, sort_keys=True, default=str).encode()
                    ).hexdigest()
                    row.proposal = proposal
                if briefing:
                    await session.execute(
                        text(
                            "INSERT INTO "
                            "ai_briefings(id,workspace_id,actor_id,scope,"
                            "language,turn_id) "
                            "VALUES(gen_random_uuid(),:w,:a,:scope,:lang,:turn) ON "
                            "CONFLICT(workspace_id,actor_id,scope) DO UPDATE SET "
                            "language=EXCLUDED.language"
                            ",turn_id=EXCLUDED.turn_id,generated_at=now()"
                        ),
                        {
                            "w": workspace,
                            "a": actor,
                            "scope": scope,
                            "lang": language,
                            "turn": identifier,
                        },
                    )
                if met["calls"] and met["calls"] == met["reported"]:
                    await session.execute(
                        text(
                            "UPDATE ai_usage SET tokens=greatest(0,tokens-:reserved+:actual) "
                            "WHERE workspace_id=:w AND day=:day"
                        ),
                        {
                            "reserved": reserved,
                            "actual": met["tokens"],
                            "w": workspace,
                            "day": local.date(),
                        },
                    )
                await session.flush()
            logger.info(
                "ai_generation_completed",
                extra={
                    "workspace_id": str(workspace),
                    "actor_id": str(actor),
                    "resource_id": str(identifier),
                    "duration_ms": round((perf_counter() - started) * 1000),
                    "model": self.settings.ai_model,
                    "provider_calls": met["calls"],
                    "ai_tokens": met["tokens"],
                    "reserved_tokens": reserved,
                    "operation_id": str(identifier),
                },
            )
            return row
        except (Exception, asyncio.CancelledError) as exc:
            if isinstance(exc, asyncio.CancelledError):
                exc = fail("ai_cancelled", "Generation was stopped.")
            code = exc.code if isinstance(exc, ApiError) else "ai_provider_unavailable"
            async with self.database.tenant_transaction(
                workspace, scheduling_write=True
            ) as session:
                current = await session.scalar(
                    select(AITurn).where(AITurn.workspace_id == workspace, AITurn.id == identifier)
                )
                if current:
                    current.status = "failed"
                    current.error_code = code
                if reserved:
                    await session.execute(
                        text(
                            "UPDATE ai_usage SET answers=greatest(0,answers-1) WHERE "
                            "workspace_id=:w AND day=:day"
                        ),
                        {"w": workspace, "day": local.date()},
                    )
            logger.warning(
                "ai_generation_failed",
                extra={
                    "workspace_id": str(workspace),
                    "operation_id": str(identifier),
                    "error_code": code,
                },
            )
            if isinstance(exc, ApiError):
                raise exc
            raise fail(
                "ai_provider_unavailable",
                "AI could not finish this request; retry explicitly.",
                503,
            ) from None

        finally:
            running_generations.pop((workspace, actor, key), None)
            metrics.reset(met_token)
