from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, insert, select

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.db.models import (
    AuditEvent,
    Client,
    EmailOutbox,
    FormTemplate,
    PasswordResetToken,
    Service,
    ServicePackage,
    ServicePackageItem,
    Workspace,
)
from slotera_api.main import create_app

pytestmark = pytest.mark.integration


async def test_bounded_catalogs_selected_options_exports_and_bootstrap() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    database = Database(get_settings().database_url)
    prefix = f"Architecture-{uuid4()}"
    ids = {kind: [uuid4() for _ in range(30)] for kind in ("client", "service", "form", "package")}
    try:
        async with owner.transaction() as session:
            workspace = await session.scalar(select(Workspace).where(Workspace.slug == "lena"))
            assert workspace
            prototype = await session.scalar(
                select(Service).where(Service.workspace_id == workspace.id)
            )
            assert prototype
            base = {
                column.name: getattr(prototype, column.name) for column in Service.__table__.columns
            }
            await session.execute(
                insert(Service),
                [
                    {
                        **base,
                        "id": item,
                        "name": f"{prefix} service {i:02}",
                        "active": i != 29,
                        "notes": "PRIVATE NOTE",
                    }
                    for i, item in enumerate(ids["service"])
                ],
            )
            await session.execute(
                insert(Client),
                [
                    {
                        "id": item,
                        "workspace_id": workspace.id,
                        "name": f"{prefix} person {i:02}",
                        "email": f"{item}@example.invalid",
                    }
                    for i, item in enumerate(ids["client"])
                ],
            )
            await session.execute(
                insert(FormTemplate),
                [
                    {
                        "id": item,
                        "workspace_id": workspace.id,
                        "name": f"{prefix} form {i:02}",
                        "description": "Test",
                        "status": "active",
                        "fields": [
                            {
                                "id": "q",
                                "type": "short_text",
                                "label": "PRIVATE QUESTION",
                                "required": False,
                            }
                        ],
                        "required_before_payment": False,
                    }
                    for i, item in enumerate(ids["form"])
                ],
            )
            await session.execute(
                insert(ServicePackage),
                [
                    {
                        "id": item,
                        "workspace_id": workspace.id,
                        "name": f"{prefix} package {i:02}",
                        "description": "Test",
                        "status": "active",
                        "price_cents": 100,
                        "featured": False,
                        "notes": "PRIVATE NOTE",
                    }
                    for i, item in enumerate(ids["package"])
                ],
            )
            await session.execute(
                insert(ServicePackageItem),
                [
                    {
                        "id": uuid4(),
                        "workspace_id": workspace.id,
                        "package_id": item,
                        "service_id": prototype.id,
                        "position": 0,
                    }
                    for item in ids["package"]
                ],
            )
        async with AsyncClient(
            transport=ASGITransport(app=create_app(database=database)), base_url="http://test"
        ) as client:
            assert (await client.get("/services/options")).status_code == 401
            login = await client.post(
                "/auth/login",
                headers={"Origin": "http://localhost:3344"},
                json={"email": "hello@slotera.io", "password": "slotera-local-only"},
            )
            assert login.status_code == 200
            assert login.json()["workspace"]["currency"] == workspace.currency
            assert login.json()["workspace"]["timezone"] == workspace.timezone
            assert login.json()["user"]["language"] in {"en", "tr", "de"}
            for resource in ("services", "forms", "packages"):
                first = await client.get(
                    f"/{resource}/summaries", params={"search": prefix, "limit": 25}
                )
                assert first.status_code == 200, first.text
                assert first.json()["total"] == 30
                assert len(first.json()["items"]) == 25
                assert "PRIVATE" not in first.text
                assert not {"fields", "items", "notes"} & first.json()["items"][0].keys()
                second = await client.get(
                    f"/{resource}/summaries", params={"search": prefix, "offset": 25}
                )
                assert len(second.json()["items"]) == 5
                assert (await client.get(f"/{resource}/summaries?limit=101")).status_code == 422
            page = (await client.get("/clients", params={"search": prefix, "limit": 25})).json()
            assert page["total"] == 30 and len(page["items"]) == 25
            exported = await client.get("/clients/export.csv", params={"search": prefix})
            assert exported.status_code == 200 and len(exported.text.splitlines()) == 31
            assert exported.headers["cache-control"] == "no-store"
            options = await client.get(
                "/services/options",
                params=[
                    ("search", prefix),
                    ("activeOnly", "true"),
                    ("selectedIds", str(ids["service"][-1])),
                    ("selectedIds", str(uuid4())),
                ],
            )
            assert options.status_code == 200, options.text
            assert len(options.json()["items"]) == 21
            assert options.json()["items"][0]["id"] == str(ids["service"][-1])
            assert options.json()["items"][0]["active"] is False
            assert "PRIVATE" not in options.text
            outside = await client.get(
                "/services/options", params={"onlySelected": True, "selectedIds": str(uuid4())}
            )
            assert outside.json()["items"] == []
    finally:
        async with owner.transaction() as session:
            await session.execute(
                delete(ServicePackage).where(ServicePackage.id.in_(ids["package"]))
            )
            await session.execute(delete(FormTemplate).where(FormTemplate.id.in_(ids["form"])))
            await session.execute(delete(Client).where(Client.id.in_(ids["client"])))
            await session.execute(delete(Service).where(Service.id.in_(ids["service"])))
        await database.dispose()
        await owner.dispose()


async def test_request_trace_reaches_outbox_and_audit_without_message_content() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    database = Database(get_settings().database_url)
    form_id = None
    outbox_id = None
    reset_id = None
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
            created = await client.post(
                "/forms",
                headers={
                    "Origin": "http://localhost:3344",
                    "X-CSRF-Token": client.cookies["slotera_csrf"],
                },
                json={
                    "name": "Trace fixture",
                    "description": "",
                    "fields": [],
                    "status": "active",
                    "attachedServiceIds": [],
                    "requiredBeforePayment": False,
                },
            )
            assert created.status_code == 201, created.text
            from uuid import UUID

            form_id = UUID(created.json()["id"])
            reset = await client.post(
                "/auth/password-reset/request",
                headers={"Origin": "http://localhost:3344"},
                json={"email": "hello@slotera.io", "language": "en"},
            )
            assert reset.status_code == 202
            async with owner.transaction() as session:
                audit = await session.scalar(
                    select(AuditEvent).where(AuditEvent.resource_id == form_id)
                )
                assert audit and audit.details["requestId"] == created.headers["x-request-id"]
                email = await session.scalar(
                    select(EmailOutbox)
                    .where(EmailOutbox.recipient_email == "hello@slotera.io")
                    .order_by(EmailOutbox.created_at.desc())
                    .limit(1)
                )
                assert (
                    email
                    and email.template_data["_traceRequestId"] == reset.headers["x-request-id"]
                )
                assert email.template_data["_traceOperationId"] == reset.headers["x-request-id"]
                outbox_id, reset_id = email.id, email.related_password_reset_token_id
    finally:
        async with owner.transaction() as session:
            if outbox_id:
                await session.execute(delete(EmailOutbox).where(EmailOutbox.id == outbox_id))
            if reset_id:
                await session.execute(
                    delete(PasswordResetToken).where(PasswordResetToken.id == reset_id)
                )
            if form_id:
                await session.execute(delete(FormTemplate).where(FormTemplate.id == form_id))
                await session.execute(delete(AuditEvent).where(AuditEvent.resource_id == form_id))
        await database.dispose()
        await owner.dispose()
