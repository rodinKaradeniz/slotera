"""A workspace's own data, for export (data portability) and for closing it.

Closing suspends the workspace at once; the maintenance job deletes it
`CLOSURE_GRACE_DAYS` later, unless Slotera staff reactivate it first.

Every tenant table is listed in exactly one of `EXPORTED_TABLES` or `NOT_EXPORTED_TABLES`
(a unit test enforces it), so a new table forces a decision about the export.
"""

from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text

from slotera_api.database import Database

CLOSURE_GRACE_DAYS = 30

# What the operator entered or their clients submitted, in a sensible reading order.
EXPORTED_TABLES: tuple[str, ...] = (
    "workspaces",
    "workspace_business_profiles",
    "workspace_locations",
    "workspace_payment_settings",
    "workspace_slug_history",
    "services",
    "form_templates",
    "form_template_services",
    "availability_policies",
    "availability_windows",
    "availability_blackouts",
    "session_series",
    "sessions",
    "session_action_items",
    "clients",
    "client_notes",
    "bookings",
    "booking_form_responses",
)

# Credentials, retry bookkeeping and Slotera's own records: not the operator's content.
NOT_EXPORTED_TABLES: frozenset[str] = frozenset(
    {
        "audit_events",
        "workspace_memberships",
        "notifications",
        "booking_access_tokens",
        "calendar_feed_tokens",
        "booking_command_idempotency",
        "public_booking_idempotency",
    }
)


def _rows_query(table: str) -> str:
    # Table names come only from the constant tuple above. Hash columns are dropped in case
    # a credential is ever added to an exported table.
    key = "id" if table == "workspaces" else "workspace_id"
    return f"""
        SELECT coalesce(jsonb_agg(row ORDER BY row->>'created_at', row->>'id'), '[]'::jsonb)
        FROM (
          SELECT (
            SELECT jsonb_object_agg(field.key, field.value)
            FROM jsonb_each(to_jsonb(t)) AS field
            WHERE field.key NOT LIKE '%\\_hash'
          ) AS row
          FROM public.{table} AS t
          WHERE t.{key} = :workspace_id
        ) AS rows
    """


class WorkspaceDataRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def export(self, workspace_id: UUID) -> dict[str, list[dict[str, Any]]]:
        exported: dict[str, list[dict[str, Any]]] = {}
        async with self.database.tenant_transaction(workspace_id) as session:
            for table in EXPORTED_TABLES:
                rows = await session.scalar(
                    text(_rows_query(table)), {"workspace_id": workspace_id}
                )
                exported[table] = list(rows or [])
        return exported

    async def slug(self, workspace_id: UUID) -> str | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            slug = await session.scalar(
                text("SELECT slug FROM public.workspaces WHERE id = :id"), {"id": workspace_id}
            )
        return str(slug) if slug is not None else None

    async def request_closure(self, *, workspace_id: UUID, actor_user_id: UUID) -> str:
        """Suspend the workspace (signing everyone out) and start the deletion countdown."""
        async with self.database.transaction() as session:
            result_code = await session.scalar(
                text(
                    "SELECT public.slotera_workspace_request_closure("
                    ":workspace_id, :actor_user_id, :audit_event_id)"
                ),
                {
                    "workspace_id": workspace_id,
                    "actor_user_id": actor_user_id,
                    "audit_event_id": uuid4(),
                },
            )
        return str(result_code)

    async def purge_closed(self, *, after_days: int = CLOSURE_GRACE_DAYS) -> int:
        """Delete every workspace closed more than `after_days` ago. Returns the count."""
        async with self.database.transaction() as session:
            purged = await session.scalar(
                text("SELECT public.slotera_workspace_purge_closed(:days)"), {"days": after_days}
            )
        return int(purged or 0)
