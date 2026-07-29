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


def _csrf_headers(client: AsyncClient) -> dict[str, str]:
    return {
        "Origin": "http://localhost:3344",
        "X-CSRF-Token": client.cookies["slotera_csrf"],
    }


@pytest.mark.integration
async def test_client_crud_normalizes_email_and_rejects_duplicates() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    payload = {"name": "Ada Lovelace", "email": " ADA@EXAMPLE.COM ", "company": "Analytical"}
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            created = await client.post("/clients", headers=_csrf_headers(client), json=payload)
            client_id = created.json()["id"]
            changed = await client.patch(
                f"/clients/{client_id}",
                headers=_csrf_headers(client),
                json={"phone": "+44 20 0000"},
            )
            duplicate = await client.post("/clients", headers=_csrf_headers(client), json=payload)
            listed = await client.get("/clients", params={"search": "lovelace"})
    finally:
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM clients WHERE email = 'ada@example.com'"))
        await application.dispose()
        await owner.dispose()

    assert created.status_code == 201
    assert created.json()["email"] == "ada@example.com"
    assert changed.status_code == 200
    assert changed.json()["phone"] == "+44 20 0000"
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "client_email_conflict"
    assert [item["id"] for item in listed.json()["items"]] == [client_id]


@pytest.mark.integration
async def test_operator_cannot_read_another_workspace_client() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    workspace_id = uuid4()
    client_id = uuid4()
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        async with owner.transaction() as session:
            await session.execute(
                text("INSERT INTO workspaces (id, name, slug) VALUES (:id, 'Other', :slug)"),
                {"id": workspace_id, "slug": f"other-{workspace_id}"},
            )
            await session.execute(
                text(
                    """
                    INSERT INTO clients (id, workspace_id, name, email)
                    VALUES (:client_id, :workspace_id, 'Private Client', 'private@example.com')
                    """
                ),
                {"client_id": client_id, "workspace_id": workspace_id},
            )
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client)
            response = await client.get(f"/clients/{client_id}")
    finally:
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM clients WHERE id = :id"), {"id": client_id})
            await session.execute(
                text("DELETE FROM workspaces WHERE id = :id"), {"id": workspace_id}
            )
        await application.dispose()
        await owner.dispose()

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "client_not_found"
