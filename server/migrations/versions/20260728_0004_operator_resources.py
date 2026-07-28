"""Add operator business settings, saved locations, and services.

Revision ID: 20260728_0004
Revises: 20260728_0003
Create Date: 2026-07-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260728_0004"
down_revision: str | None = "20260728_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

location_type = postgresql.ENUM(
    "online", "physical", "hybrid", name="location_type", create_type=False
)
service_booking_mode = postgresql.ENUM(
    "open", "scheduled", name="service_booking_mode", create_type=False
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
        f"""
        CREATE POLICY {table_name}_select ON {table_name} FOR SELECT TO slotera_app
        USING (workspace_id = public.slotera_current_workspace_id())
        """
    )
    op.execute(
        f"""
        CREATE POLICY {table_name}_insert ON {table_name} FOR INSERT TO slotera_app
        WITH CHECK (workspace_id = public.slotera_current_workspace_id())
        """
    )
    op.execute(
        f"""
        CREATE POLICY {table_name}_update ON {table_name} FOR UPDATE TO slotera_app
        USING (workspace_id = public.slotera_current_workspace_id())
        WITH CHECK (workspace_id = public.slotera_current_workspace_id())
        """
    )
    op.execute(
        f"""
        CREATE POLICY {table_name}_delete ON {table_name} FOR DELETE TO slotera_app
        USING (workspace_id = public.slotera_current_workspace_id())
        """
    )


def upgrade() -> None:
    location_type.create(op.get_bind(), checkfirst=True)
    service_booking_mode.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "workspace_business_profiles",
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("display_name", sa.String(length=160), nullable=False),
        sa.Column("bio", sa.String(length=4000), server_default="", nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("phone", sa.String(length=40), server_default="", nullable=False),
        sa.Column("address", sa.String(length=500), server_default="", nullable=False),
        sa.Column("booking_page_enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_workspace_business_profiles_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("workspace_id", name=op.f("pk_workspace_business_profiles")),
    )

    op.create_table(
        "workspace_locations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("street", sa.String(length=200), nullable=False),
        sa.Column("street2", sa.String(length=200), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("region", sa.String(length=120), nullable=True),
        sa.Column("postal_code", sa.String(length=32), nullable=False),
        sa.Column("country", sa.String(length=2), nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(
            "country = upper(country) AND country ~ '^[A-Z]{2}$'",
            name=op.f("ck_workspace_locations_country_iso2"),
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_workspace_locations_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workspace_locations")),
    )
    op.create_index(
        op.f("ix_workspace_locations_workspace_id"),
        "workspace_locations",
        ["workspace_id"],
        unique=False,
    )

    op.create_table(
        "services",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.String(length=4000), server_default="", nullable=False),
        sa.Column("duration_min", sa.Integer(), nullable=False),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("location_type", location_type, nullable=False),
        sa.Column("location", sa.String(length=240), nullable=False),
        sa.Column("address", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("booking_mode", service_booking_mode, nullable=False),
        sa.Column("cancellation_rule", sa.String(length=1000), server_default="", nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        *_timestamps(),
        sa.CheckConstraint("duration_min BETWEEN 5 AND 1440", name=op.f("ck_services_duration")),
        sa.CheckConstraint("price_cents >= 0", name=op.f("ck_services_price")),
        sa.CheckConstraint("capacity BETWEEN 1 AND 10000", name=op.f("ck_services_capacity")),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_services_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_services")),
    )
    op.create_index(op.f("ix_services_workspace_id"), "services", ["workspace_id"], unique=False)

    for table_name in ("workspace_business_profiles", "workspace_locations", "services"):
        _enable_tenant_rls(table_name)


def downgrade() -> None:
    op.drop_table("services")
    op.drop_table("workspace_locations")
    op.drop_table("workspace_business_profiles")
    service_booking_mode.drop(op.get_bind(), checkfirst=True)
    location_type.drop(op.get_bind(), checkfirst=True)
