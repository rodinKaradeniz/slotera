"""Add workspace availability and materialised sessions.

Revision ID: 20260728_0006
Revises: 20260728_0005
Create Date: 2026-07-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260728_0006"
down_revision: str | None = "20260728_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

session_status = postgresql.ENUM(
    "scheduled", "live", "done", "cancelled", name="session_status", create_type=False
)
location_type = postgresql.ENUM(
    "online", "physical", "hybrid", name="location_type", create_type=False
)


def _timestamps() -> tuple[sa.Column[object], sa.Column[object]]:
    return (
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def _enable_tenant_rls(table_name: str) -> None:
    op.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY {table_name}_select ON {table_name} FOR SELECT TO slotera_app "
        "USING (workspace_id = public.slotera_current_workspace_id())"
    )
    op.execute(
        f"CREATE POLICY {table_name}_insert ON {table_name} FOR INSERT TO slotera_app "
        "WITH CHECK (workspace_id = public.slotera_current_workspace_id())"
    )
    op.execute(
        f"CREATE POLICY {table_name}_update ON {table_name} FOR UPDATE TO slotera_app "
        "USING (workspace_id = public.slotera_current_workspace_id()) "
        "WITH CHECK (workspace_id = public.slotera_current_workspace_id())"
    )
    op.execute(
        f"CREATE POLICY {table_name}_delete ON {table_name} FOR DELETE TO slotera_app "
        "USING (workspace_id = public.slotera_current_workspace_id())"
    )


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    session_status.create(op.get_bind(), checkfirst=True)
    op.create_unique_constraint("uq_services_workspace_id_id", "services", ["workspace_id", "id"])

    op.create_table(
        "availability_policies",
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("slot_interval_min", sa.Integer(), server_default="30", nullable=False),
        sa.Column("buffer_before_min", sa.Integer(), server_default="0", nullable=False),
        sa.Column("buffer_after_min", sa.Integer(), server_default="0", nullable=False),
        sa.Column("minimum_notice_min", sa.Integer(), server_default="1440", nullable=False),
        sa.Column("maximum_advance_days", sa.Integer(), server_default="90", nullable=False),
        *_timestamps(),
        sa.CheckConstraint("slot_interval_min BETWEEN 5 AND 1440", name="slot_interval"),
        sa.CheckConstraint("buffer_before_min BETWEEN 0 AND 1440", name="buffer_before"),
        sa.CheckConstraint("buffer_after_min BETWEEN 0 AND 1440", name="buffer_after"),
        sa.CheckConstraint("minimum_notice_min BETWEEN 0 AND 525600", name="minimum_notice"),
        sa.CheckConstraint("maximum_advance_days BETWEEN 1 AND 730", name="maximum_advance"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("workspace_id"),
    )
    op.create_table(
        "availability_windows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_local", sa.Time(), nullable=False),
        sa.Column("end_local", sa.Time(), nullable=False),
        sa.CheckConstraint("day_of_week BETWEEN 1 AND 7", name="day_of_week"),
        sa.CheckConstraint("start_local < end_local", name="ordered"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", "day_of_week", "start_local", "end_local"),
    )
    op.create_index(
        "ix_availability_windows_workspace_id", "availability_windows", ["workspace_id"]
    )
    op.create_table(
        "availability_blackouts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(240), nullable=True),
        sa.CheckConstraint("starts_at < ends_at", name="ordered"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_availability_blackouts_workspace_id", "availability_blackouts", ["workspace_id"]
    )
    op.create_table(
        "session_series",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("interval_weeks", sa.Integer(), nullable=False),
        sa.Column("weekdays", postgresql.JSONB(), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=True),
        sa.Column("horizon_through", sa.Date(), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("interval_weeks BETWEEN 1 AND 52", name="interval_weeks"),
        sa.CheckConstraint("starts_on <= ends_on OR ends_on IS NULL", name="date_order"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", "id", name="uq_session_series_workspace_id_id"),
    )
    op.create_index("ix_session_series_workspace_id", "session_series", ["workspace_id"])
    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("series_id", sa.Uuid(), nullable=True),
        sa.Column("service_id", sa.Uuid(), nullable=False),
        sa.Column("calendar_owner_id", sa.Uuid(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("status", session_status, server_default="scheduled", nullable=False),
        sa.Column("location_type", location_type, nullable=False),
        sa.Column("location", sa.String(240), nullable=False),
        sa.Column("address", postgresql.JSONB(), nullable=True),
        sa.Column("notes", sa.String(2000), nullable=True),
        *_timestamps(),
        sa.CheckConstraint("start_at < end_at", name="ordered"),
        sa.CheckConstraint("capacity BETWEEN 1 AND 10000", name="capacity"),
        sa.ForeignKeyConstraint(
            ["workspace_id", "calendar_owner_id"],
            ["workspace_memberships.workspace_id", "workspace_memberships.user_id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id", "service_id"],
            ["services.workspace_id", "services.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id", "series_id"],
            ["session_series.workspace_id", "session_series.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("series_id", "start_at"),
    )
    op.create_index("ix_sessions_workspace_id", "sessions", ["workspace_id"])
    op.create_index("ix_sessions_series_id", "sessions", ["series_id"])
    op.create_index("ix_sessions_service_id", "sessions", ["service_id"])
    op.create_index("ix_sessions_start_at", "sessions", ["start_at"])
    op.execute(
        "ALTER TABLE sessions ADD CONSTRAINT ex_sessions_owner_time "
        "EXCLUDE USING gist (calendar_owner_id WITH =, "
        "tstzrange(start_at, end_at, '[)') WITH &&) "
        "WHERE (status <> 'cancelled') DEFERRABLE INITIALLY IMMEDIATE"
    )

    for table_name in (
        "availability_policies",
        "availability_windows",
        "availability_blackouts",
        "session_series",
        "sessions",
    ):
        _enable_tenant_rls(table_name)


def downgrade() -> None:
    op.drop_table("sessions")
    op.drop_table("session_series")
    op.drop_table("availability_blackouts")
    op.drop_table("availability_windows")
    op.drop_table("availability_policies")
    op.drop_constraint("uq_services_workspace_id_id", "services", type_="unique")
    session_status.drop(op.get_bind(), checkfirst=True)
