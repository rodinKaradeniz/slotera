"""Add a meeting link per service, and location facts to booking emails.

- `services.meeting_url`: an optional https link (Zoom, Meet, Teams). It lives on the
  service, so editing it updates every booking's emails and manage page.
- `slotera_booking_emit_event` adds `locationType`, `location`, `address` and
  `meetingUrl` to the email template data, so emails and their calendar attachment can
  say where the session happens. The meeting link is included only once the booking is
  confirmed.

The function body is 0024's, extended by text substitution so the two cannot drift.

Revision ID: 20261011_0030
Revises: 20261011_0029
Create Date: 2026-10-11
"""

import importlib.util
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

revision: str = "20261011_0030"
down_revision: str | None = "20261011_0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SIGNATURE = "public.slotera_booking_emit_event(uuid, text, text)"


def _body_0024() -> str:
    path = Path(__file__).with_name("20261009_0024_booking_access.py")
    spec = importlib.util.spec_from_file_location("slotera_migration_0024", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return str(module._EMIT_BODY)


def _replace_once(body: str, old: str, new: str) -> str:
    if body.count(old) != 1:
        raise RuntimeError(f"expected exactly one {old!r} in the 0024 emit body")
    return body.replace(old, new)


def _body_with_location() -> str:
    body = _body_0024()
    body = _replace_once(
        body,
        "            scheduled_session.end_at,\n",
        "            scheduled_session.end_at,\n"
        "            scheduled_session.location_type::text AS location_type,\n"
        "            scheduled_session.location,\n"
        "            scheduled_session.address,\n"
        "            service.meeting_url,\n",
    )
    return _replace_once(
        body,
        "              'manageUrl', p_manage_url\n",
        "              'manageUrl', p_manage_url,\n"
        "              'locationType', target.location_type,\n"
        "              'location', target.location,\n"
        "              'address', target.address,\n"
        "              'meetingUrl', CASE\n"
        "                WHEN target.booking_status = 'confirmed' AND p_event <> 'cancelled'\n"
        "                THEN target.meeting_url\n"
        "              END\n",
    )


def _replace_function(body: str) -> None:
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION public.slotera_booking_emit_event(
          p_booking_id uuid,
          p_event text,
          p_manage_url text DEFAULT NULL
        )
        RETURNS boolean
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $${body}$$
        """
    )
    op.execute(f"REVOKE ALL ON FUNCTION {_SIGNATURE} FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION {_SIGNATURE} TO slotera_app")


def upgrade() -> None:
    op.add_column("services", sa.Column("meeting_url", sa.String(500), nullable=True))
    op.create_check_constraint(
        "ck_services_meeting_url_https", "services", "meeting_url LIKE 'https://%'"
    )
    _replace_function(_body_with_location())


def downgrade() -> None:
    _replace_function(_body_0024())
    op.drop_constraint("ck_services_meeting_url_https", "services", type_="check")
    op.drop_column("services", "meeting_url")
