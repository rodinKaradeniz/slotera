from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from slotera_api.auth.passwords import create_password_hasher
from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.db.models import Notification
from slotera_api.main import create_app
from slotera_api.seed import DEMO_SEED, import_demo_seed

DEMO_PASSWORD = "slotera-local-only"


async def _login(client: AsyncClient, *, workspace_id: UUID | None = None) -> None:
    payload: dict[str, object] = {
        "email": DEMO_SEED.operator.email,
        "password": DEMO_PASSWORD,
    }
    if workspace_id is not None:
        payload["workspaceId"] = str(workspace_id)
    response = await client.post(
        "/auth/login",
        headers={"Origin": "http://localhost:3344"},
        json=payload,
    )
    assert response.status_code == 200


def _csrf_headers(client: AsyncClient) -> dict[str, str]:
    return {
        "Origin": "http://localhost:3344",
        "X-CSRF-Token": client.cookies["slotera_csrf"],
    }


@pytest.mark.integration
async def test_notifications_are_structured_and_mark_all_is_principal_scoped() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    other_user_id = uuid4()
    other_membership_id = uuid4()
    other_workspace_id = uuid4()
    cross_membership_id = uuid4()
    own_notification_id = uuid4()
    other_user_notification_id = uuid4()
    cross_workspace_notification_id = uuid4()
    previous_read_state: list[tuple[UUID, datetime | None]] = []

    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        async with owner.transaction() as session:
            previous_read_state = [
                (row.id, row.read_at)
                for row in (
                    await session.execute(
                        text(
                            """
                            SELECT id, read_at
                            FROM notifications
                            WHERE workspace_id = :workspace_id
                              AND recipient_user_id = :user_id
                            """
                        ),
                        {
                            "workspace_id": DEMO_SEED.workspace.id,
                            "user_id": DEMO_SEED.operator.id,
                        },
                    )
                )
            ]
            await session.execute(
                text(
                    """
                    INSERT INTO users (
                      id, email, first_names, last_name, password_hash
                    ) VALUES (
                      :user_id, :email, 'Other', 'Operator', :password_hash
                    )
                    """
                ),
                {
                    "user_id": other_user_id,
                    "email": f"{other_user_id}@example.test",
                    "password_hash": create_password_hasher().hash(DEMO_PASSWORD),
                },
            )
            await session.execute(
                text(
                    """
                    INSERT INTO workspaces (id, name, slug)
                    VALUES (:workspace_id, 'Other Notifications', :slug)
                    """
                ),
                {
                    "workspace_id": other_workspace_id,
                    "slug": f"notifications-{other_workspace_id}",
                },
            )
            await session.execute(
                text(
                    """
                    INSERT INTO workspace_memberships (id, workspace_id, user_id, role)
                    VALUES
                      (:other_membership_id, :demo_workspace_id, :other_user_id,
                       'operator_admin'),
                      (:cross_membership_id, :other_workspace_id, :demo_user_id,
                       'operator_admin')
                    """
                ),
                {
                    "other_membership_id": other_membership_id,
                    "demo_workspace_id": DEMO_SEED.workspace.id,
                    "other_user_id": other_user_id,
                    "cross_membership_id": cross_membership_id,
                    "other_workspace_id": other_workspace_id,
                    "demo_user_id": DEMO_SEED.operator.id,
                },
            )
            session.add_all(
                [
                    Notification(
                        id=own_notification_id,
                        workspace_id=DEMO_SEED.workspace.id,
                        recipient_user_id=DEMO_SEED.operator.id,
                        kind="booking_confirmed",
                        payload={
                            "clientName": "Test Client",
                            "serviceName": "Strategy Session",
                            "startsAt": "2030-01-01T09:00:00Z",
                        },
                        occurred_at=datetime(2030, 1, 1, tzinfo=UTC),
                    ),
                    Notification(
                        id=other_user_notification_id,
                        workspace_id=DEMO_SEED.workspace.id,
                        recipient_user_id=other_user_id,
                        kind="payment_pending",
                        payload={
                            "clientName": "Private Client",
                            "serviceName": "Group Workshop",
                            "amountCents": 18000,
                            "currency": "EUR",
                        },
                        occurred_at=datetime(2030, 1, 1, tzinfo=UTC),
                    ),
                    Notification(
                        id=cross_workspace_notification_id,
                        workspace_id=other_workspace_id,
                        recipient_user_id=DEMO_SEED.operator.id,
                        kind="session_starting",
                        payload={
                            "clientName": "Other Workspace Client",
                            "serviceName": "Private Session",
                            "startsAt": "2030-01-01T10:00:00Z",
                        },
                        occurred_at=datetime(2030, 1, 1, tzinfo=UTC),
                    ),
                ]
            )

        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await _login(client, workspace_id=DEMO_SEED.workspace.id)
            before = await client.get("/notifications")
            marked = await client.post(
                "/notifications/mark-all-read",
                headers=_csrf_headers(client),
            )
            after = await client.get("/notifications")

        async with owner.transaction() as session:
            read_state = dict(
                (
                    await session.execute(
                        text(
                            """
                            SELECT id, read_at
                            FROM notifications
                            WHERE id IN (:own_id, :other_user_id, :cross_id)
                            """
                        ),
                        {
                            "own_id": own_notification_id,
                            "other_user_id": other_user_notification_id,
                            "cross_id": cross_workspace_notification_id,
                        },
                    )
                ).all()
            )
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text(
                    """
                    DELETE FROM notifications
                    WHERE id IN (:own_id, :other_user_id, :cross_id)
                    """
                ),
                {
                    "own_id": own_notification_id,
                    "other_user_id": other_user_notification_id,
                    "cross_id": cross_workspace_notification_id,
                },
            )
            for notification_id, read_at in previous_read_state:
                await session.execute(
                    text("UPDATE notifications SET read_at = :read_at WHERE id = :id"),
                    {"id": notification_id, "read_at": read_at},
                )
            await session.execute(
                text("DELETE FROM workspaces WHERE id = :workspace_id"),
                {"workspace_id": other_workspace_id},
            )
            await session.execute(
                text("DELETE FROM users WHERE id = :user_id"),
                {"user_id": other_user_id},
            )
        await application.dispose()
        await owner.dispose()

    assert before.status_code == 200
    by_id = {item["id"]: item for item in before.json()["items"]}
    own_id = str(own_notification_id)
    assert own_id in by_id
    assert str(other_user_notification_id) not in by_id
    assert str(cross_workspace_notification_id) not in by_id
    assert by_id[own_id]["kind"] == "booking_confirmed"
    assert by_id[own_id]["payload"] == {
        "clientName": "Test Client",
        "serviceName": "Strategy Session",
        "startsAt": "2030-01-01T09:00:00Z",
    }
    assert not ({"title", "detail", "icon", "tone", "age", "unread"} & by_id[own_id].keys())
    assert before.json()["unreadCount"] >= 1
    assert marked.status_code == 204
    assert after.json()["unreadCount"] == 0
    assert read_state[own_notification_id] is not None
    assert read_state[other_user_notification_id] is None
    assert read_state[cross_workspace_notification_id] is None


@pytest.mark.integration
async def test_runtime_can_only_update_notification_read_state() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)

    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        async with application.principal_transaction(
            DEMO_SEED.workspace.id, DEMO_SEED.operator.id
        ) as session:
            privileges = (
                (
                    await session.execute(
                        text(
                            """
                        SELECT
                          has_table_privilege(current_user, 'notifications', 'INSERT')
                            AS can_insert,
                          has_table_privilege(current_user, 'notifications', 'DELETE')
                            AS can_delete,
                          has_column_privilege(
                            current_user, 'notifications', 'read_at', 'UPDATE'
                          ) AS can_update_read_at,
                          has_column_privilege(
                            current_user, 'notifications', 'payload', 'UPDATE'
                          ) AS can_update_payload
                        """
                        )
                    )
                )
                .mappings()
                .one()
            )

        with pytest.raises(ProgrammingError):
            async with application.principal_transaction(
                DEMO_SEED.workspace.id, DEMO_SEED.operator.id
            ) as session:
                await session.execute(text("UPDATE notifications SET payload = '{}'::jsonb"))
    finally:
        await application.dispose()
        await owner.dispose()

    assert privileges == {
        "can_insert": False,
        "can_delete": False,
        "can_update_read_at": True,
        "can_update_payload": False,
    }
