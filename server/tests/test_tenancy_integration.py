from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.db.models import TENANT_TABLES
from slotera_api.seed import import_demo_seed


@pytest.mark.integration
async def test_all_tenant_tables_have_forced_rls_and_policies() -> None:
    database = Database(get_migration_settings().migration_database_url)

    try:
        async with database.transaction() as session:
            rows = (
                await session.execute(
                    text(
                        """
                        SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
                               count(p.policyname) AS policy_count
                        FROM pg_class AS c
                        JOIN pg_namespace AS n ON n.oid = c.relnamespace
                        LEFT JOIN pg_policies AS p
                          ON p.schemaname = n.nspname AND p.tablename = c.relname
                        WHERE n.nspname = 'public'
                          AND (
                            c.relname = 'workspaces'
                            OR EXISTS (
                              SELECT 1
                              FROM information_schema.columns AS cols
                              WHERE cols.table_schema = n.nspname
                                AND cols.table_name = c.relname
                                AND cols.column_name = 'workspace_id'
                            )
                          )
                        GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
                        """
                    )
                )
            ).mappings()
    finally:
        await database.dispose()

    by_name = {row["relname"]: row for row in rows}
    assert by_name.keys() == TENANT_TABLES
    for row in by_name.values():
        assert row["relrowsecurity"] is True
        assert row["relforcerowsecurity"] is True
        assert row["policy_count"] > 0


@pytest.mark.integration
async def test_runtime_role_is_tenant_scoped_and_cannot_cross_write() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    workspace_a = uuid4()
    workspace_b = uuid4()
    membership_a = uuid4()
    membership_b = uuid4()
    user_a = uuid4()
    user_b = uuid4()

    try:
        async with owner.transaction() as session:
            await session.execute(
                text(
                    """
                    INSERT INTO users (id, email, first_names, last_name)
                    VALUES (:user_a, :email_a, 'Tenant', 'A'),
                           (:user_b, :email_b, 'Tenant', 'B')
                    """
                ),
                {
                    "user_a": user_a,
                    "email_a": f"{user_a}@example.test",
                    "user_b": user_b,
                    "email_b": f"{user_b}@example.test",
                },
            )
            await session.execute(
                text(
                    """
                    INSERT INTO workspaces (id, name, slug)
                    VALUES (:workspace_a, 'Tenant A', :slug_a),
                           (:workspace_b, 'Tenant B', :slug_b)
                    """
                ),
                {
                    "workspace_a": workspace_a,
                    "slug_a": f"tenant-{workspace_a}",
                    "workspace_b": workspace_b,
                    "slug_b": f"tenant-{workspace_b}",
                },
            )
            await session.execute(
                text(
                    """
                    INSERT INTO workspace_memberships (id, workspace_id, user_id, role)
                    VALUES (:membership_a, :workspace_a, :user_a, 'operator_admin'),
                           (:membership_b, :workspace_b, :user_b, 'operator_admin')
                    """
                ),
                {
                    "membership_a": membership_a,
                    "workspace_a": workspace_a,
                    "user_a": user_a,
                    "membership_b": membership_b,
                    "workspace_b": workspace_b,
                    "user_b": user_b,
                },
            )

        async with application.transaction() as session:
            unscoped_count = await session.scalar(
                text("SELECT count(*) FROM workspace_memberships")
            )
        async with application.tenant_transaction(workspace_a) as session:
            visible_ids = set(
                (
                    await session.scalars(
                        text("SELECT id FROM workspace_memberships ORDER BY id")
                    )
                ).all()
            )

        with pytest.raises(DBAPIError):
            async with application.tenant_transaction(workspace_a) as session:
                await session.execute(
                    text(
                        """
                        INSERT INTO workspace_memberships (id, workspace_id, user_id, role)
                        VALUES (:id, :workspace_b, :user_a, 'operator_admin')
                        """
                    ),
                    {"id": uuid4(), "workspace_b": workspace_b, "user_a": user_a},
                )

        assert unscoped_count == 0
        assert visible_ids == {membership_a}
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text("DELETE FROM workspace_memberships WHERE workspace_id IN (:a, :b)"),
                {"a": workspace_a, "b": workspace_b},
            )
            await session.execute(
                text("DELETE FROM workspaces WHERE id IN (:a, :b)"),
                {"a": workspace_a, "b": workspace_b},
            )
            await session.execute(
                text("DELETE FROM users WHERE id IN (:a, :b)"),
                {"a": user_a, "b": user_b},
            )
        await application.dispose()
        await owner.dispose()


@pytest.mark.integration
async def test_identity_tables_are_not_directly_accessible_to_runtime_role() -> None:
    database = Database(get_settings().database_url)

    try:
        async with database.transaction() as session:
            privileges = (
                await session.execute(
                    text(
                        """
                        SELECT
                          has_table_privilege(current_user, 'users', 'SELECT') AS users_select,
                          has_table_privilege(current_user, 'auth_sessions', 'SELECT')
                            AS sessions_select,
                          has_table_privilege(current_user, 'password_reset_tokens', 'SELECT')
                            AS resets_select
                        """
                    )
                )
            ).mappings().one()
    finally:
        await database.dispose()

    assert privileges == {
        "users_select": False,
        "sessions_select": False,
        "resets_select": False,
    }


@pytest.mark.integration
async def test_audit_events_are_append_only_for_runtime_role() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    workspace_id = uuid4()
    event_id = uuid4()

    try:
        async with owner.transaction() as session:
            await session.execute(
                text("INSERT INTO workspaces (id, name, slug) VALUES (:id, 'Audit', :slug)"),
                {"id": workspace_id, "slug": f"audit-{workspace_id}"},
            )

        async with application.tenant_transaction(workspace_id) as session:
            await session.execute(
                text(
                    """
                    INSERT INTO audit_events
                      (id, workspace_id, action, resource_type, details)
                    VALUES
                      (:id, :workspace_id, 'test.created', 'test', '{"before": false}')
                    """
                ),
                {"id": event_id, "workspace_id": workspace_id},
            )

        async with application.tenant_transaction(workspace_id) as session:
            update_result = await session.execute(
                text("UPDATE audit_events SET details = '{\"after\": true}' WHERE id = :id"),
                {"id": event_id},
            )
            delete_result = await session.execute(
                text("DELETE FROM audit_events WHERE id = :id"), {"id": event_id}
            )
            details = await session.scalar(
                text("SELECT details FROM audit_events WHERE id = :id"), {"id": event_id}
            )

        assert update_result.rowcount == 0
        assert delete_result.rowcount == 0
        assert details == {"before": False}
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text("DELETE FROM audit_events WHERE workspace_id = :workspace_id"),
                {"workspace_id": workspace_id},
            )
            await session.execute(
                text("DELETE FROM workspaces WHERE id = :workspace_id"),
                {"workspace_id": workspace_id},
            )
        await application.dispose()
        await owner.dispose()


@pytest.mark.integration
async def test_demo_seed_is_repeatable() -> None:
    database = Database(get_migration_settings().migration_database_url)

    try:
        first = await import_demo_seed(database)
        second = await import_demo_seed(database)
        async with database.transaction() as session:
            workspace_count = await session.scalar(
                text("SELECT count(*) FROM workspaces WHERE slug = 'lena'")
            )
            operator_count = await session.scalar(
                text("SELECT count(*) FROM users WHERE email = 'hello@slotera.app'")
            )
    finally:
        await database.dispose()

    assert first.total_inserted >= 0
    assert second.total_inserted == 0
    assert workspace_count == 1
    assert operator_count == 1
