"""Real tenant/RLS, retrieval and command boundaries with deterministic AI providers."""

import asyncio
import json
from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.ai.provider import Answer, LocalProvider
from slotera_api.ai.worker import process_one
from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import import_demo_seed

pytestmark = pytest.mark.integration
ORIGIN = {"Origin": "http://localhost:3344"}


def csrf(client: AsyncClient) -> dict[str, str]:
    return {
        **ORIGIN,
        "X-CSRF-Token": client.cookies["slotera_csrf"],
        "Idempotency-Key": str(uuid4()),
    }


@pytest.fixture(scope="module")
def seeded_ai_workspace():
    async def seed_once():
        database = Database(get_migration_settings().migration_database_url)
        try:
            await import_demo_seed(database, demo_password="slotera-local-only")
        finally:
            await database.dispose()

    asyncio.run(seed_once())


@pytest_asyncio.fixture
async def ai(
    seeded_ai_workspace,
) -> AsyncIterator[tuple[AsyncClient, AsyncClient, Database, Database]]:
    owner = Database(get_migration_settings().migration_database_url)
    runtime = Database(get_settings().database_url)
    settings = get_settings().model_copy(
        update={"ai_provider": "local", "ai_daily_tokens": 2_000_000}
    )
    app = create_app(settings=settings, database=runtime)
    app.dependency_overrides[get_settings] = lambda: settings
    async with (
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as staff,
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as outsider,
    ):
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM request_rate_limits"))
        login = await staff.post(
            "/auth/login",
            headers=ORIGIN,
            json={"email": "hello@slotera.io", "password": "slotera-local-only"},
        )
        assert login.status_code == 200
        # Tests own this synthetic workspace; release earlier test usage and AI data.
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM ai_usage"))
            await session.execute(
                text("DELETE FROM session_action_items WHERE title LIKE 'Synthetic%'")
            )
            await session.execute(text("DELETE FROM ai_threads"))
            await session.execute(text("UPDATE ai_states SET enabled=false"))
        yield staff, outsider, owner, runtime
    await runtime.dispose()
    await owner.dispose()


async def enable(staff: AsyncClient) -> None:
    status = await staff.get("/ai/status")
    assert status.status_code == 200
    response = await staff.patch(
        "/ai/settings",
        headers=csrf(staff),
        json={"enabled": True, "revision": status.json()["revision"]},
    )
    assert response.status_code == 200, response.text


async def thread(staff: AsyncClient) -> str:
    id = str(uuid4())
    result = await staff.post(
        "/ai/threads", headers=csrf(staff), json={"id": id, "title": "Synthetic assistant"}
    )
    assert result.status_code == 200, result.text
    return id


async def turn(staff: AsyncClient, id: str, prompt: str, headers: dict[str, str] | None = None):
    return await staff.post(
        f"/ai/threads/{id}/turns",
        headers=headers or csrf(staff),
        json={"prompt": prompt, "language": "en"},
    )


async def test_ai_is_opt_in_and_all_surfaces_require_operator_identity(ai):
    staff, outsider, _, _ = ai
    assert (await outsider.get("/ai/status")).status_code == 401
    assert (
        await staff.post(
            "/ai/threads", headers=csrf(staff), json={"id": str(uuid4()), "title": "Denied"}
        )
    ).status_code == 409
    await enable(staff)
    assert (await staff.get("/ai/status")).json()["pending"] > 0
    assert (
        await staff.post(
            "/ai/threads", headers=ORIGIN, json={"id": str(uuid4()), "title": "Denied"}
        )
    ).status_code == 403
    id = await thread(staff)
    assert (await outsider.get(f"/ai/threads/{id}/turns")).status_code == 401


async def test_grounded_answers_and_reviewed_action_commit_exactly_once(ai):
    staff, _, owner, _ = ai
    await enable(staff)
    id = await thread(staff)
    headers = csrf(staff)
    result = await turn(staff, id, "Add task Synthetic reviewed task", headers)
    assert result.status_code == 200, result.text
    data = result.json()
    assert data["status"] == "completed"
    assert data["citations"]
    proposal = data["proposal"]
    assert proposal["status"] == "proposed"
    async with owner.transaction() as session:
        assert (
            await session.scalar(
                text(
                    "SELECT count(*) FROM session_action_items WHERE title="
                    "'Synthetic reviewed task'"
                )
            )
            == 0
        )
    same = await turn(staff, id, "Add task Synthetic reviewed task", headers)
    assert same.json()["id"] == data["id"]
    changed = await turn(staff, id, "Add task Changed", headers)
    assert changed.status_code == 409
    confirmation = csrf(staff)
    applied = await staff.post(
        f"/ai/proposals/{data['id']}/confirm",
        headers=confirmation,
        json={"proposalHash": proposal["hash"]},
    )
    assert applied.status_code == 200, applied.text
    replay = await staff.post(
        f"/ai/proposals/{data['id']}/confirm",
        headers=confirmation,
        json={"proposalHash": proposal["hash"]},
    )
    assert replay.status_code == 200
    async with owner.transaction() as session:
        assert (
            await session.scalar(
                text(
                    "SELECT count(*) FROM session_action_items WHERE title="
                    "'Synthetic reviewed task'"
                )
            )
            == 1
        )


async def test_proposals_reject_stale_records_and_forbidden_commands(ai):
    staff, _, owner, _ = ai
    await enable(staff)
    id = await thread(staff)
    created = await staff.post(
        "/tasks", headers=csrf(staff), json={"title": "Synthetic stale target"}
    )
    task = created.json()
    action = {
        "name": "task.update",
        "resource_id": task["id"],
        "arguments_json": json.dumps({"title": "Assistant draft"}),
    }
    result = await turn(staff, id, "/action " + json.dumps(action))
    assert result.status_code == 200, result.text
    proposal = result.json()["proposal"]
    edit = await staff.patch(
        f"/tasks/{task['id']}",
        headers={**csrf(staff), "If-Match": f'"v{task["version"]}"'},
        json={"title": "Newer human edit"},
    )
    assert edit.status_code == 200
    conflict = await staff.post(
        f"/ai/proposals/{result.json()['id']}/confirm",
        headers=csrf(staff),
        json={"proposalHash": proposal["hash"]},
    )
    assert conflict.status_code == 409
    assert (await staff.get(f"/tasks/{task['id']}")).json()["title"] == "Newer human edit"
    denied = await turn(
        staff,
        id,
        "/action "
        + json.dumps({"name": "client.erase", "resource_id": str(uuid4()), "arguments_json": "{}"}),
    )
    assert denied.status_code == 422


async def test_indexing_is_tenant_scoped_and_source_changes_remove_old_vectors(ai):
    staff, _, owner, runtime = ai
    await enable(staff)
    settings = get_settings().model_copy(
        update={"ai_provider": "local", "ai_daily_indexing_tokens": 2_000_000}
    )
    for _ in range(100):
        if not await process_one(runtime, settings, LocalProvider()):
            break
    status = (await staff.get("/ai/status")).json()
    assert status["indexed"] > 0
    assert status["failed"] == 0
    service = (await staff.get("/services")).json()["items"][0]
    changed = await staff.patch(
        f"/services/{service['id']}",
        headers={**csrf(staff), "If-Match": f'"v{service["version"]}"'},
        json={"description": "Synthetic updated narrative " + str(uuid4())},
    )
    assert changed.status_code == 200, changed.text
    async with owner.transaction() as session:
        assert (
            await session.scalar(
                text("SELECT count(*) FROM ai_documents WHERE kind='services' AND source_id=:id"),
                {"id": service["id"]},
            )
            == 0
        )
    async with runtime.transaction() as session:
        assert await session.scalar(text("SELECT count(*) FROM ai_documents")) == 0


async def _client(staff) -> str:
    response = await staff.post(
        "/clients",
        headers=csrf(staff),
        json={"name": "Synthetic briefing client", "email": f"ai-{uuid4()}@example.com"},
    )
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


async def test_briefing_cache_and_refresh_are_not_extra_generations(ai):
    staff, _, _, _ = ai
    await enable(staff)
    path = f"/ai/briefings/client?clientId={await _client(staff)}"
    one = await staff.post(path, headers=csrf(staff), json={"language": "de"})
    assert one.status_code == 200, one.text
    before = (await staff.get("/ai/status")).json()["dailyAnswers"]
    two = await staff.post(path, headers=csrf(staff), json={"language": "de"})
    assert two.json()["id"] == one.json()["id"]
    assert (await staff.get("/ai/status")).json()["dailyAnswers"] == before
    refresh = await staff.post(path, headers=csrf(staff), json={"language": "de", "refresh": True})
    assert refresh.status_code == 429
    switched = await staff.post(path, headers=csrf(staff), json={"language": "tr"})
    assert switched.status_code == 429


async def test_workspace_daily_briefings_no_longer_exist(ai):
    staff, _, _, _ = ai
    await enable(staff)
    generated = await staff.post(
        "/ai/briefings/daily", headers=csrf(staff), json={"language": "en"}
    )
    assert generated.status_code == 422
    read = await staff.get("/ai/briefings/daily")
    assert read.status_code == 422
    missing_client = await staff.post(
        "/ai/briefings/client", headers=csrf(staff), json={"language": "en"}
    )
    assert missing_client.status_code == 422


async def test_disabled_context_discards_inflight_generation_and_cannot_reappear(ai, monkeypatch):
    staff, _, owner, _ = ai
    await enable(staff)
    id = await thread(staff)
    entered = asyncio.Event()
    release = asyncio.Event()
    original = LocalProvider.answer

    async def waiting(self, *args, **kwargs) -> Answer:
        entered.set()
        await release.wait()
        return await original(self, *args, **kwargs)

    monkeypatch.setattr(LocalProvider, "answer", waiting)
    pending = asyncio.create_task(turn(staff, id, "Synthetic privacy request"))
    await asyncio.wait_for(entered.wait(), 10)
    status = (await staff.get("/ai/status")).json()
    off = await staff.patch(
        "/ai/settings", headers=csrf(staff), json={"enabled": False, "revision": status["revision"]}
    )
    assert off.status_code == 200
    release.set()
    result = await pending
    assert result.status_code == 409
    async with owner.transaction() as session:
        assert await session.scalar(text("SELECT count(*) FROM ai_turns")) == 0


async def test_read_requests_cannot_gain_writes_from_provider_output(ai, monkeypatch):
    from slotera_api.ai.provider import Action, Route

    staff, _, _, _ = ai
    await enable(staff)
    identifier = await thread(staff)

    async def read_route(self, prompt):
        return Route(category="workspace", confidence=1)

    async def injected(self, *args, **kwargs):
        return Answer(
            text="Injected",
            citation_ids=[],
            action=Action(
                name="task.create",
                resource_id=None,
                arguments_json='{"title":"Forbidden injection"}',
            ),
        )

    monkeypatch.setattr(LocalProvider, "route", read_route)
    monkeypatch.setattr(LocalProvider, "answer", injected)
    result = await turn(staff, identifier, "Read my notes")
    assert result.status_code == 502
    tasks = (await staff.get("/tasks")).json()["items"]
    assert all(row["title"] != "Forbidden injection" for row in tasks)


async def test_quota_denial_happens_before_any_provider_call(ai, monkeypatch):
    staff, _, owner, _ = ai
    await enable(staff)
    identifier = await thread(staff)
    async with owner.transaction() as session:
        await session.execute(
            text(
                "INSERT INTO ai_usage(workspace_id,day,answers,tokens,indexing_tokens) "
                "SELECT id,(now() AT TIME ZONE timezone)::date,50,2000000,0 "
                "FROM workspaces WHERE slug='lena' ON CONFLICT(workspace_id,day) "
                "DO UPDATE SET answers=50,tokens=2000000"
            )
        )

    async def forbidden(*args, **kwargs):
        pytest.fail("A quota-denied request reached the provider")

    monkeypatch.setattr(LocalProvider, "route", forbidden)
    result = await turn(staff, identifier, "Synthetic budget check")
    assert result.status_code == 429


async def test_client_erasure_clears_chats_and_indexed_context(ai):
    staff, _, owner, runtime = ai
    await enable(staff)
    identifier = await thread(staff)
    client = (
        await staff.post(
            "/clients",
            headers=csrf(staff),
            json={"name": "Synthetic AI erasure", "email": f"ai-{uuid4()}@example.com"},
        )
    ).json()
    await staff.post(
        f"/clients/{client['id']}/notes",
        headers=csrf(staff),
        json={
            "title": "Synthetic private context",
            "body": "<p>Synthetic confidential narrative</p>",
        },
    )
    answer = await turn(staff, identifier, "Read Synthetic AI erasure")
    assert answer.status_code == 200
    current = (await staff.get(f"/clients/{client['id']}")).json()
    erased = await staff.post(
        f"/clients/{client['id']}/erase",
        headers={**csrf(staff), "If-Match": f'"v{current["version"]}"'},
        json={"confirmEmail": client["email"]},
    )
    assert erased.status_code == 204, erased.text
    assert (await staff.get("/ai/threads")).json()["total"] == 0
    async with owner.transaction() as session:
        assert (
            await session.scalar(
                text("SELECT count(*) FROM ai_documents WHERE client_id=:id"), {"id": client["id"]}
            )
            == 0
        )


async def test_action_failure_rolls_back_new_records_and_keeps_proposal(ai, monkeypatch):
    from slotera_api.ai import actions

    staff, _, owner, _ = ai
    await enable(staff)
    identifier = await thread(staff)
    result = await turn(staff, identifier, "Add task Synthetic rollback command")
    assert result.status_code == 200
    proposal = result.json()["proposal"]
    original = actions.REGISTRY["task.create"]

    async def failing(payload, response, operator, database):
        await original[1](payload, response, operator, database)
        from slotera_api.errors import ApiError

        raise ApiError(status_code=409, code="synthetic_failure", message="Synthetic rollback")

    monkeypatch.setitem(
        actions.REGISTRY, "task.create", (original[0], failing, original[2], original[3])
    )
    failure = await staff.post(
        f"/ai/proposals/{result.json()['id']}/confirm",
        headers=csrf(staff),
        json={"proposalHash": proposal["hash"]},
    )
    assert failure.status_code == 409
    async with owner.transaction() as session:
        assert (
            await session.scalar(
                text(
                    "SELECT count(*) FROM session_action_items WHERE title="
                    "'Synthetic rollback command'"
                )
            )
            == 0
        )
    assert (await staff.get(f"/ai/operations/{result.json()['id']}")).json()["proposal"][
        "status"
    ] == "proposed"


@pytest.mark.parametrize("change", ["source", "settings", "logout", "citation", "concurrency"])
async def test_generation_rechecks_authority_sources_and_output(ai, monkeypatch, change):
    staff, _, _, _ = ai
    await enable(staff)
    identifier = await thread(staff)
    entered, release = asyncio.Event(), asyncio.Event()
    original = LocalProvider.answer

    async def waiting(self, *args, **kwargs):
        entered.set()
        await release.wait()
        value = await original(self, *args, **kwargs)
        return (
            value.model_copy(update={"citation_ids": ["invented"]})
            if change == "citation"
            else value
        )

    monkeypatch.setattr(LocalProvider, "answer", waiting)
    pending = asyncio.create_task(turn(staff, identifier, "Synthetic current workspace"))
    await asyncio.wait_for(entered.wait(), 10)
    other = None
    if change == "source":
        result = await staff.post(
            "/tasks", headers=csrf(staff), json={"title": "Synthetic source changed"}
        )
        assert result.status_code == 201, result.text
    elif change == "settings":
        current = (await staff.get("/settings/business")).json()
        result = await staff.patch(
            "/settings/business",
            headers={**csrf(staff), "If-Match": f'"v{current["version"]}"'},
            json={"displayName": "Synthetic reviewed workspace"},
        )
        assert result.status_code == 200, result.text
    elif change == "logout":
        assert (await staff.post("/auth/logout", headers=csrf(staff))).status_code == 204
    elif change == "concurrency":
        other = asyncio.create_task(turn(staff, identifier, "Synthetic second request"))
        # Wait until both requests have reserved their independent generation slots.
        for _ in range(100):
            await asyncio.sleep(0.01)
            async with ai[2].transaction() as session:
                count = await session.scalar(
                    text("SELECT count(*) FROM ai_turns WHERE status='pending'")
                )
            if count == 2:
                break
        third = await turn(staff, identifier, "Synthetic third request")
        assert third.status_code == 429
    release.set()
    response = await pending
    assert (
        response.status_code
        == {"source": 409, "settings": 409, "logout": 401, "citation": 502, "concurrency": 200}[
            change
        ]
    )
    if other:
        assert (await other).status_code == 200


async def test_enabled_workspace_deletion_cascades_all_ai_data(ai):
    _, _, owner, _ = ai
    wid = uuid4()
    async with owner.transaction() as session:
        await session.execute(
            text("INSERT INTO workspaces(id,name,slug) VALUES(:id,'Synthetic AI deletion',:slug)"),
            {"id": wid, "slug": "synthetic-" + wid.hex},
        )
        await session.execute(
            text("INSERT INTO ai_states(workspace_id,enabled) VALUES(:id,true)"), {"id": wid}
        )
        await session.execute(
            text(
                "INSERT INTO clients(id,workspace_id,name,email) "
                "VALUES(gen_random_uuid(),:id,'Synthetic client','synthetic@example.com')"
            ),
            {"id": wid},
        )
        await session.execute(text("DELETE FROM workspaces WHERE id=:id"), {"id": wid})
        assert (
            await session.scalar(
                text("SELECT count(*) FROM ai_source_revisions WHERE workspace_id=:id"), {"id": wid}
            )
            == 0
        )


async def test_foreign_workspace_vectors_are_unreadable_and_unwritable(ai):
    from sqlalchemy.exc import DBAPIError

    _, _, owner, runtime = ai
    wid = uuid4()
    try:
        async with owner.transaction() as session:
            own = await session.scalar(text("SELECT id FROM workspaces WHERE slug='lena'"))
            await session.execute(
                text("INSERT INTO workspaces(id,name,slug) VALUES(:id,'Synthetic other',:slug)"),
                {"id": wid, "slug": "synthetic-" + wid.hex},
            )
            statement = text(
                "INSERT INTO ai_documents(id,workspace_id,kind,source_id,position,title,"
                "content,href,embedding) VALUES(gen_random_uuid(),:w,'help',gen_random_uuid(),"
                "0,'Synthetic private','Synthetic private','/admin/dashboard',CAST(:v AS vector))"
            )
            await session.execute(statement, {"w": wid, "v": json.dumps([1.0] * 1536)})
        async with runtime.tenant_transaction(own) as session:
            assert (
                await session.scalar(
                    text("SELECT count(*) FROM ai_documents WHERE workspace_id=:w"), {"w": wid}
                )
                == 0
            )
        with pytest.raises(DBAPIError):
            async with runtime.tenant_transaction(own) as session:
                await session.execute(statement, {"w": wid, "v": json.dumps([1.0] * 1536)})
    finally:
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM workspaces WHERE id=:id"), {"id": wid})


@pytest.mark.parametrize("late", [False, True])
async def test_stop_prevents_late_answers_and_releases_answer_allowance(ai, monkeypatch, late):
    staff, _, _, _ = ai
    await enable(staff)
    identifier = await thread(staff)
    entered = asyncio.Event()
    original = LocalProvider.answer

    async def waiting(self, *args, **kwargs):
        entered.set()
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            if late:
                return await original(self, *args, **kwargs)
            raise

    monkeypatch.setattr(LocalProvider, "answer", waiting)
    headers = csrf(staff)
    pending = asyncio.create_task(turn(staff, identifier, "Synthetic stopped question", headers))
    await asyncio.wait_for(entered.wait(), 10)
    stopped = await staff.post(
        f"/ai/threads/{identifier}/stop",
        headers=csrf(staff),
        json={
            "key": headers["Idempotency-Key"],
            "prompt": "Synthetic stopped question",
            "language": "en",
        },
    )
    assert stopped.status_code == 204
    assert (await pending).status_code == 409
    rows = (await staff.get(f"/ai/threads/{identifier}/turns")).json()["items"]
    assert rows[0]["errorCode"] == "ai_cancelled"
    assert rows[0]["answer"] == ""
    assert (await staff.get("/ai/status")).json()["dailyAnswers"] == 0


async def test_stop_before_generation_is_durable_and_uses_no_provider(ai, monkeypatch):
    staff, _, _, _ = ai
    await enable(staff)
    identifier = await thread(staff)
    headers = csrf(staff)
    result = await staff.post(
        f"/ai/threads/{identifier}/stop",
        headers=csrf(staff),
        json={
            "key": headers["Idempotency-Key"],
            "prompt": "Synthetic early stop",
            "language": "en",
        },
    )
    assert result.status_code == 204

    async def forbidden(*args, **kwargs):
        pytest.fail("Stopped request reached provider")

    monkeypatch.setattr(LocalProvider, "route", forbidden)
    result = await turn(staff, identifier, "Synthetic early stop", headers)
    assert result.status_code == 200
    assert result.json()["errorCode"] == "ai_cancelled"
    assert (await staff.get("/ai/status")).json()["dailyAnswers"] == 0


async def test_edit_branch_preserves_original_actions_and_copies_no_proposals(ai):
    staff, outsider, _, _ = ai
    await enable(staff)
    identifier = await thread(staff)
    first = (await turn(staff, identifier, "Add task Synthetic branch task")).json()
    confirmed = await staff.post(
        f"/ai/proposals/{first['id']}/confirm",
        headers=csrf(staff),
        json={"proposalHash": first["proposal"]["hash"]},
    )
    assert confirmed.status_code == 200
    second = (await turn(staff, identifier, "Synthetic second question")).json()
    new_id = str(uuid4())
    payload = {"threadId": new_id, "turnId": second["id"], "title": "Synthetic branch edit"}
    assert (
        await outsider.post(f"/ai/threads/{identifier}/branch", json=payload)
    ).status_code == 401
    result = await staff.post(f"/ai/threads/{identifier}/branch", headers=csrf(staff), json=payload)
    assert result.status_code == 200, result.text
    assert (
        await staff.post(f"/ai/threads/{identifier}/branch", headers=csrf(staff), json=payload)
    ).status_code == 200
    old = (await staff.get(f"/ai/threads/{identifier}/turns")).json()["items"]
    new = (await staff.get(f"/ai/threads/{new_id}/turns")).json()["items"]
    assert len(old) == 2 and len(new) == 1
    assert old[0]["proposal"]["status"] == "executed"
    assert new[0]["proposal"] is None
    assert (
        await staff.post(f"/ai/threads/{uuid4()}/branch", headers=csrf(staff), json=payload)
    ).status_code == 404


async def test_first_answer_titles_the_thread_once_without_an_extra_generation(ai, monkeypatch):
    staff, _, _, _ = ai
    await enable(staff)
    identifier = await thread(staff)
    original = LocalProvider.answer
    calls = 0

    async def titled(self, *args, **kwargs):
        nonlocal calls
        calls += 1
        result = await original(self, *args, **kwargs)
        return result.model_copy(
            update={"conversation_title": "Short first title" if calls == 1 else "Do not replace"}
        )

    monkeypatch.setattr(LocalProvider, "answer", titled)
    assert (
        await turn(staff, identifier, "A first request with a longer explanation")
    ).status_code == 200
    assert (await turn(staff, identifier, "Second request")).status_code == 200
    rows = (await staff.get("/ai/threads")).json()["items"]
    assert next(row["title"] for row in rows if row["id"] == identifier) == "Short first title"
    assert calls == 2


@pytest.mark.parametrize("stale", [False, True])
async def test_reviewed_general_todo_removal_is_versioned_and_idempotent(ai, stale):
    staff, _, _, _ = ai
    await enable(staff)
    identifier = await thread(staff)
    created = (
        await staff.post("/tasks", headers=csrf(staff), json={"title": "Synthetic remove me"})
    ).json()
    preview = await turn(staff, identifier, "Remove task Synthetic remove me")
    assert preview.status_code == 200, preview.text
    data = preview.json()
    assert data["proposal"]["action"]["name"] == "task.delete"
    assert (await staff.get(f"/tasks/{created['id']}")).status_code == 200
    if stale:
        assert (
            await staff.patch(
                f"/tasks/{created['id']}",
                headers={**csrf(staff), "If-Match": f'"v{created["version"]}"'},
                json={"title": "Synthetic changed"},
            )
        ).status_code == 200
    headers = csrf(staff)
    for _ in range(2):
        response = await staff.post(
            f"/ai/proposals/{data['id']}/confirm",
            headers=headers,
            json={"proposalHash": data["proposal"]["hash"]},
        )
        assert response.status_code == (409 if stale else 200), response.text
    assert (await staff.get(f"/tasks/{created['id']}")).status_code == (200 if stale else 404)


async def test_dashboard_todos_exclude_session_tasks_and_ai_cannot_remove_those(ai):
    staff, _, owner, _ = ai
    await enable(staff)
    identifier = await thread(staff)
    session_id = (await staff.get("/sessions?limit=1")).json()["items"][0]["id"]
    session_task = (
        await staff.post(
            f"/sessions/{session_id}/action-items",
            headers=csrf(staff),
            json={"title": "Synthetic session task"},
        )
    ).json()
    todo = (
        await staff.post("/tasks", headers=csrf(staff), json={"title": "Synthetic simple todo"})
    ).json()
    listing = (await staff.get("/tasks?general_only=true&limit=1")).json()
    assert listing["limit"] == 1 and len(listing["items"]) <= 1
    all_general = (await staff.get("/tasks?general_only=true&limit=100")).json()
    assert todo["id"] in {item["id"] for item in all_general["items"]}
    assert all(item["sessionId"] is None for item in all_general["items"])
    assert (await staff.get(f"/tasks?general_only=true&session_id={session_id}")).status_code == 422
    foreign_workspace, foreign_task = uuid4(), uuid4()
    async with owner.transaction() as session:
        await session.execute(
            text("INSERT INTO workspaces(id,name,slug) VALUES(:id,'Synthetic separate',:slug)"),
            {"id": foreign_workspace, "slug": "synthetic-" + foreign_workspace.hex},
        )
        await session.execute(
            text(
                "INSERT INTO session_action_items(id,workspace_id,title) "
                "VALUES(:id,:w,'Synthetic foreign task')"
            ),
            {"id": foreign_task, "w": foreign_workspace},
        )
    try:
        for item_id in (session_task["id"], str(foreign_task)):
            result = await turn(
                staff,
                identifier,
                "/action "
                + json.dumps(
                    {"name": "task.delete", "resource_id": item_id, "arguments_json": "{}"}
                ),
            )
            assert result.status_code == 422, result.text
        assert (await staff.get(f"/tasks/{session_task['id']}")).status_code == 200
        assert (await staff.get(f"/tasks/{foreign_task}")).status_code == 404
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text("DELETE FROM workspaces WHERE id=:id"), {"id": foreign_workspace}
            )


async def test_generated_briefings_are_not_chat_history(ai):
    staff, _, _, _ = ai
    await enable(staff)
    briefing = await staff.post(
        f"/ai/briefings/client?clientId={await _client(staff)}",
        headers=csrf(staff),
        json={"language": "en", "refresh": False},
    )
    assert briefing.status_code == 200, briefing.text
    assert (await staff.get("/ai/threads")).json()["total"] == 0
    chat = await thread(staff)
    history = (await staff.get("/ai/threads?limit=1")).json()
    assert history["total"] == 1
    assert history["items"][0]["id"] == chat


@pytest.mark.parametrize(
    "path", ["/services/summaries", "/forms/summaries", "/packages/summaries", "/clients"]
)
async def test_directory_state_counts_do_not_depend_on_the_page(ai, path):
    staff, _, _, _ = ai
    first = (await staff.get(path, params={"limit": 1})).json()
    beyond = (await staff.get(path, params={"limit": 1, "offset": 1000000})).json()
    assert sum(first["states"].values()) == first["total"]
    assert beyond["items"] == []
    assert beyond["states"] == first["states"]
    empty = (await staff.get(path, params={"search": str(uuid4())})).json()
    assert empty["total"] == 0 and empty["states"] == {}
    if path == "/clients":
        all_rows = (await staff.get(path, params={"limit": 200})).json()
        assert all_rows["total"] <= 200
        expected = {}
        for row in all_rows["items"]:
            expected[row["tag"]] = expected.get(row["tag"], 0) + 1
        assert all_rows["states"] == expected
