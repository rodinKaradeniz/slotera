from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.auth.passwords import create_password_hasher
from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import DEMO_SEED, import_demo_seed
from slotera_api.workspace_data import WorkspaceDataRepository

ORIGIN = {"Origin": "http://localhost:3344"}
PASSWORD = "slotera-local-only"


def _csrf(client: AsyncClient) -> dict[str, str]:
    return {**ORIGIN, "X-CSRF-Token": client.cookies["slotera_csrf"]}


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login", headers=ORIGIN, json={"email": email, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text


def _keys(value: Any) -> set[str]:
    if isinstance(value, dict):
        return set(value) | {key for item in value.values() for key in _keys(item)}
    if isinstance(value, list):
        return {key for item in value for key in _keys(item)}
    return set()


@pytest.mark.integration
async def test_operator_exports_their_own_workspace_only() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    try:
        await import_demo_seed(owner, demo_password=PASSWORD)
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM request_rate_limits"))
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as op:
            await _login(op, "hello@slotera.io")
            exported = await op.get("/settings/workspace-export")
    finally:
        await application.dispose()
        await owner.dispose()

    assert exported.status_code == 200
    assert exported.headers["Cache-Control"] == "no-store"
    tables = exported.json()["tables"]
    assert [row["slug"] for row in tables["workspaces"]] == ["lena"]
    assert tables["clients"] and tables["services"] and tables["sessions"]
    workspace_id = str(DEMO_SEED.workspace.id)
    for rows in tables.values():
        assert all(row.get("workspace_id", workspace_id) == workspace_id for row in rows)
    assert not any(key.endswith("_hash") for key in _keys(tables))


@pytest.mark.integration
async def test_closing_a_workspace_suspends_it_and_the_purge_deletes_it() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    suffix = uuid4().hex[:10]
    slug = f"closing-{suffix}"
    owner_email = f"closing-{suffix}@example.com"
    workspace_id: str | None = None
    try:
        await import_demo_seed(owner, demo_password=PASSWORD)
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM request_rate_limits"))
        app = create_app(database=application)
        transport = ASGITransport(app=app)
        async with (
            AsyncClient(transport=transport, base_url="http://test") as staff,
            AsyncClient(transport=transport, base_url="http://test") as operator,
        ):
            await _login(staff, "admin@slotera.io")
            created = await staff.post(
                "/platform/workspaces",
                headers=_csrf(staff),
                json={
                    "name": "Closing Practice",
                    "slug": slug,
                    "ownerFirstNames": "Cleo",
                    "ownerLastName": "Close",
                    "ownerEmail": owner_email,
                    "timezone": "Europe/London",
                },
            )
            assert created.status_code == 201, created.text
            workspace_id = created.json()["id"]
            async with owner.transaction() as session:
                await session.execute(
                    text("UPDATE users SET password_hash = :hash WHERE email = :email"),
                    {"hash": create_password_hasher().hash(PASSWORD), "email": owner_email},
                )

            await _login(operator, owner_email)
            client = await operator.post(
                "/clients",
                headers=_csrf(operator),
                json={"name": "Carla Client", "email": f"carla-{suffix}@example.com"},
            )
            assert client.status_code == 201, client.text
            mismatch = await operator.post(
                "/settings/close-workspace",
                headers=_csrf(operator),
                json={"confirmSlug": "not-it"},
            )
            closed = await operator.post(
                "/settings/close-workspace",
                headers=_csrf(operator),
                json={"confirmSlug": slug.upper()},
            )
            after_close = await operator.get("/auth/session")
            closing = await staff.get(f"/platform/workspaces/{workspace_id}")

            reactivated = await staff.post(
                f"/platform/workspaces/{workspace_id}/reactivate", headers=_csrf(staff)
            )
            await _login(operator, owner_email)
            closed_again = await operator.post(
                "/settings/close-workspace",
                headers=_csrf(operator),
                json={"confirmSlug": slug},
            )

        repository = WorkspaceDataRepository(application)
        purged_too_early = await repository.purge_closed()
        async with owner.transaction() as session:
            await session.execute(
                text(
                    "UPDATE workspaces SET closure_requested_at = now() - interval '31 days' "
                    "WHERE id = :id"
                ),
                {"id": workspace_id},
            )
        purged = await repository.purge_closed()
        async with owner.transaction() as session:
            remaining = await session.scalar(
                text(
                    "SELECT (SELECT count(*) FROM workspaces WHERE id = :id)"
                    " + (SELECT count(*) FROM clients WHERE workspace_id = :id)"
                    " + (SELECT count(*) FROM users WHERE email = :email)"
                ),
                {"id": workspace_id, "email": owner_email},
            )
            demo_still_there = await session.scalar(
                text("SELECT count(*) FROM workspaces WHERE slug = 'lena'")
            )
        if purged >= 1:
            workspace_id = None
    finally:
        if workspace_id is not None:
            async with owner.transaction() as session:
                await session.execute(
                    text(
                        "UPDATE workspaces SET closure_requested_at = now() - interval '1 year',"
                        " operational_status = 'suspended' WHERE id = :id"
                    ),
                    {"id": workspace_id},
                )
            await WorkspaceDataRepository(application).purge_closed()
        await application.dispose()
        await owner.dispose()

    assert mismatch.status_code == 422
    assert mismatch.json()["error"]["code"] == "workspace_close_confirmation_mismatch"
    assert closed.status_code == 200
    assert closed.json() == {"deletedAfterDays": 30}
    assert after_close.status_code == 401
    assert closing.json()["operationalStatus"] == "suspended"
    assert closing.json()["closureRequestedAt"] is not None
    assert reactivated.status_code == 200
    assert reactivated.json()["operationalStatus"] == "active"
    assert reactivated.json()["closureRequestedAt"] is None
    assert closed_again.status_code == 200
    assert purged_too_early == 0
    assert purged == 1
    assert remaining == 0
    assert demo_still_there == 1
