"""Reviewed versions are pinned by the caller; retries cannot silently overwrite edits."""

import asyncio
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.db.models import Client, FormTemplate
from slotera_api.main import create_app

pytestmark = pytest.mark.integration


async def test_atomic_edits_required_preconditions_and_parent_versions() -> None:
    database = Database(get_settings().database_url)
    owner = Database(get_migration_settings().migration_database_url)
    ids: dict[str, UUID] = {}
    try:
        async with AsyncClient(
            transport=ASGITransport(app=create_app(database=database)), base_url="http://test"
        ) as client:
            assert (
                await client.post(
                    "/auth/login",
                    headers={"Origin": "http://localhost:3344"},
                    json={"email": "hello@slotera.io", "password": "slotera-local-only"},
                )
            ).status_code == 200
            headers = {
                "Origin": "http://localhost:3344",
                "X-CSRF-Token": client.cookies["slotera_csrf"],
            }
            created = (
                await client.post(
                    "/clients",
                    headers=headers,
                    json={"name": "Concurrent edit", "email": f"{uuid4()}@example.com"},
                )
            ).json()
            ids["client"] = UUID(created["id"])
            path = f"/clients/{created['id']}"
            assert (
                await client.patch(path, headers=headers, json={"company": "Missing"})
            ).status_code == 422
            reviewed = {**headers, "If-Match": f'"v{created["version"]}"'}
            results = await asyncio.gather(
                *[
                    client.patch(path, headers=reviewed, json={"company": value})
                    for value in ("First", "Second")
                ]
            )
            assert sorted(result.status_code for result in results) == [200, 409]
            conflict = next(result for result in results if result.status_code == 409)
            assert conflict.json()["error"]["code"] == "resource_stale"
            latest = (await client.get(path)).json()
            assert latest["version"] == created["version"] + 1
            assert latest["company"] in ("First", "Second")
            # Erasure must also use the reviewed profile, not silently accept newer contact facts.
            assert (
                await client.post(
                    f"{path}/erase", headers=reviewed, json={"confirmEmail": created["email"]}
                )
            ).status_code == 409
            form = (
                await client.post(
                    "/forms",
                    headers=headers,
                    json={
                        "name": "Versioned form",
                        "description": "",
                        "status": "active",
                        "fields": [],
                        "attachedServiceIds": [],
                        "requiredBeforePayment": False,
                    },
                )
            ).json()
            ids["form"] = UUID(form["id"])
            form_path = f"/forms/{form['id']}"
            form_headers = {**headers, "If-Match": f'"v{form["version"]}"'}
            changed = await client.patch(
                form_path,
                headers=form_headers,
                json={
                    "fields": [
                        {
                            "id": "context",
                            "label": "Context",
                            "type": "short_text",
                            "required": False,
                        }
                    ]
                },
            )
            assert changed.status_code == 200, changed.text
            assert changed.json()["version"] == form["version"] + 1
            assert (await client.delete(form_path, headers=form_headers)).status_code == 409
    finally:
        async with owner.transaction() as session:
            if "form" in ids:
                await session.execute(delete(FormTemplate).where(FormTemplate.id == ids["form"]))
            if "client" in ids:
                await session.execute(delete(Client).where(Client.id == ids["client"]))
        await database.dispose()
        await owner.dispose()


async def test_settings_sections_share_one_atomic_revision() -> None:
    database = Database(get_settings().database_url)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=create_app(database=database)), base_url="http://test"
        ) as client:
            await client.post(
                "/auth/login",
                headers={"Origin": "http://localhost:3344"},
                json={"email": "hello@slotera.io", "password": "slotera-local-only"},
            )
            headers = {
                "Origin": "http://localhost:3344",
                "X-CSRF-Token": client.cookies["slotera_csrf"],
            }
            business, branding, payments, availability = await asyncio.gather(
                *[
                    client.get(path)
                    for path in (
                        "/settings/business",
                        "/settings/branding",
                        "/settings/payments",
                        "/availability",
                    )
                ]
            )
            version = business.json()["version"]
            assert {result.json()["version"] for result in (branding, payments, availability)} == {
                version
            }
            reviewed = {**headers, "If-Match": f'"v{version}"'}
            # Saving unchanged values still serializes an intentional reviewed write.
            results = await asyncio.gather(
                client.patch(
                    "/settings/business", headers=reviewed, json={"name": business.json()["name"]}
                ),
                client.patch(
                    "/settings/branding",
                    headers=reviewed,
                    json={
                        "accent": branding.json()["accent"],
                        "fontFamily": branding.json()["fontFamily"],
                    },
                ),
            )
            assert sorted(result.status_code for result in results) == [200, 409]
            assert (await client.get("/settings/payments")).json()["version"] == version + 1
    finally:
        await database.dispose()


async def test_note_creation_cannot_restore_context_after_erasure() -> None:
    database = Database(get_settings().database_url)
    owner = Database(get_migration_settings().migration_database_url)
    client_id = None
    try:
        async with AsyncClient(
            transport=ASGITransport(app=create_app(database=database)), base_url="http://test"
        ) as client:
            await client.post(
                "/auth/login",
                headers={"Origin": "http://localhost:3344"},
                json={"email": "hello@slotera.io", "password": "slotera-local-only"},
            )
            headers = {
                "Origin": "http://localhost:3344",
                "X-CSRF-Token": client.cookies["slotera_csrf"],
            }
            profile = (
                await client.post(
                    "/clients",
                    headers=headers,
                    json={"name": "Erase race", "email": f"{uuid4()}@example.com"},
                )
            ).json()
            client_id = UUID(profile["id"])
            path = f"/clients/{client_id}"
            note, erased = await asyncio.gather(
                client.post(
                    f"{path}/notes",
                    headers=headers,
                    json={"title": "Private context", "body": "<p>Disposable race</p>"},
                ),
                client.post(
                    f"{path}/erase",
                    headers={**headers, "If-Match": f'"v{profile["version"]}"'},
                    json={"confirmEmail": profile["email"]},
                ),
            )
            assert erased.status_code == 204, erased.text
            assert note.status_code in (201, 404)
            assert (await client.get(f"{path}/notes")).json()["items"] == []
            rejected = await client.post(
                f"{path}/notes",
                headers=headers,
                json={"title": "Too late", "body": "<p>Must not persist</p>"},
            )
            assert rejected.status_code == 404
    finally:
        async with owner.transaction() as session:
            if client_id:
                await session.execute(delete(Client).where(Client.id == client_id))
        await database.dispose()
        await owner.dispose()
