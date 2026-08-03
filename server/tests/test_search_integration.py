from collections import Counter
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import import_demo_seed

DEMO_PASSWORD = "slotera-local-only"


async def _login(client: AsyncClient) -> None:
    response = await client.post(
        "/auth/login",
        headers={"Origin": "http://localhost:3344"},
        json={"email": "hello@slotera.app", "password": DEMO_PASSWORD},
    )
    assert response.status_code == 200


@pytest.mark.integration
async def test_operator_search_is_private_bounded_and_workspace_scoped() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    other_workspace_id = uuid4()
    other_client_id = uuid4()
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        async with owner.transaction() as session:
            await session.execute(
                text("INSERT INTO workspaces (id, name, slug) VALUES (:id, 'Other', :slug)"),
                {"id": other_workspace_id, "slug": f"other-{other_workspace_id}"},
            )
            await session.execute(
                text(
                    """
                    INSERT INTO clients (id, workspace_id, name, email)
                    VALUES (
                        :client_id,
                        :workspace_id,
                        'Private Search Client',
                        'private-search@example.com'
                    )
                    """
                ),
                {"client_id": other_client_id, "workspace_id": other_workspace_id},
            )
        app = create_app(database=application)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as anonymous:
            denied = await anonymous.get("/search", params={"query": "strategy"})
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            invalid = await client.get("/search", params={"query": ""})
            matched = await client.get("/search", params={"query": "strategy", "limitPerKind": 1})
            private = await client.get("/search", params={"query": "private search"})
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text("DELETE FROM clients WHERE id = :id"), {"id": other_client_id}
            )
            await session.execute(
                text("DELETE FROM workspaces WHERE id = :id"), {"id": other_workspace_id}
            )
        await application.dispose()
        await owner.dispose()

    assert denied.status_code == 401
    assert invalid.status_code == 422
    assert matched.status_code == 200
    assert matched.headers["Cache-Control"] == "no-store"
    assert any(item["kind"] == "service" for item in matched.json()["items"])
    assert all("notes" not in item for item in matched.json()["items"])
    assert max(Counter(item["kind"] for item in matched.json()["items"]).values()) <= 1
    assert private.status_code == 200
    assert private.json()["items"] == []
