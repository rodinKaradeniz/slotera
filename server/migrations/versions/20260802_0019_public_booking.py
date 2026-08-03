"""Add payment settings and transactional open-mode public bookings.

Revision ID: 20260802_0019
Revises: 20260802_0018
Create Date: 2026-08-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260802_0019"
down_revision: str | None = "20260802_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _enable_tenant_rls(table_name: str) -> None:
    op.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY")
    for operation, clause in (
        ("select", "USING"),
        ("insert", "WITH CHECK"),
        ("delete", "USING"),
    ):
        op.execute(
            f"CREATE POLICY {table_name}_{operation} ON {table_name} "
            f"FOR {operation.upper()} TO slotera_app "
            f"{clause} (workspace_id = public.slotera_current_workspace_id())"
        )
    op.execute(
        f"CREATE POLICY {table_name}_update ON {table_name} FOR UPDATE TO slotera_app "
        "USING (workspace_id = public.slotera_current_workspace_id()) "
        "WITH CHECK (workspace_id = public.slotera_current_workspace_id())"
    )


def upgrade() -> None:
    op.create_table(
        "workspace_payment_settings",
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("manual_payment_enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "manual_payment_instructions", sa.String(4000), server_default="", nullable=False
        ),
        sa.Column("booking_terms_enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("booking_terms_content", sa.String(10000), server_default="", nullable=False),
        sa.Column("tax_treatment", sa.String(16), server_default="none", nullable=False),
        sa.Column("tax_rate_bps", sa.Integer(), server_default="0", nullable=False),
        sa.Column("tax_label", sa.String(40), server_default="Tax", nullable=False),
        sa.Column("tax_jurisdiction", sa.String(2), nullable=True),
        sa.Column("seller_tax_number", sa.String(80), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("tax_treatment IN ('none', 'fixed')", name="tax_treatment"),
        sa.CheckConstraint("tax_rate_bps BETWEEN 0 AND 10000", name="tax_rate_bps"),
        sa.CheckConstraint(
            "(tax_treatment = 'none' AND tax_rate_bps = 0) OR "
            "(tax_treatment = 'fixed' AND tax_rate_bps > 0)",
            name="tax_treatment_rate",
        ),
        sa.CheckConstraint(
            "tax_jurisdiction IS NULL OR tax_jurisdiction ~ '^[A-Z]{2}$'",
            name="tax_jurisdiction_iso2",
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("workspace_id"),
    )
    op.execute(
        """
        INSERT INTO workspace_payment_settings (
          workspace_id,
          manual_payment_enabled,
          manual_payment_instructions,
          tax_treatment,
          tax_rate_bps,
          tax_label,
          tax_jurisdiction
        )
        SELECT id, true, '', 'none', 0, 'Tax', NULL
        FROM workspaces
        """
    )

    op.add_column("bookings", sa.Column("reference", sa.String(32), nullable=True))
    op.add_column("bookings", sa.Column("payment_method", sa.String(16), nullable=True))
    op.add_column("bookings", sa.Column("net_amount_cents", sa.Integer(), nullable=True))
    op.add_column("bookings", sa.Column("tax_amount_cents", sa.Integer(), nullable=True))
    op.add_column("bookings", sa.Column("tax_treatment", sa.String(16), nullable=True))
    op.add_column("bookings", sa.Column("tax_rate_bps", sa.Integer(), nullable=True))
    op.add_column("bookings", sa.Column("tax_label", sa.String(40), nullable=True))
    op.add_column("bookings", sa.Column("tax_jurisdiction", sa.String(2), nullable=True))
    op.add_column("bookings", sa.Column("seller_tax_number", sa.String(80), nullable=True))
    op.add_column(
        "bookings",
        sa.Column(
            "billing_address",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "bookings", sa.Column("payment_due_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.execute(
        """
        UPDATE bookings
        SET reference = 'SLT-' || upper(substr(replace(id::text, '-', ''), 1, 12)),
            payment_method = CASE WHEN amount_cents = 0 THEN 'free' ELSE 'manual' END,
            net_amount_cents = amount_cents,
            tax_amount_cents = 0,
            tax_treatment = 'none',
            tax_rate_bps = 0
        """
    )
    for column in (
        "reference",
        "payment_method",
        "net_amount_cents",
        "tax_amount_cents",
        "tax_treatment",
        "tax_rate_bps",
    ):
        op.alter_column("bookings", column, nullable=False)
    op.create_unique_constraint(
        "uq_bookings_workspace_reference", "bookings", ["workspace_id", "reference"]
    )
    op.create_check_constraint(
        "ck_bookings_payment_method", "bookings", "payment_method IN ('free', 'manual')"
    )
    op.create_check_constraint(
        "ck_bookings_financial_snapshot_nonnegative",
        "bookings",
        "net_amount_cents >= 0 AND tax_amount_cents >= 0 "
        "AND amount_cents = net_amount_cents + tax_amount_cents",
    )
    op.create_check_constraint(
        "ck_bookings_tax_treatment",
        "bookings",
        "tax_treatment IN ('none', 'fixed') AND tax_rate_bps BETWEEN 0 AND 10000",
    )

    op.create_table(
        "booking_form_responses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column("form_template_id", sa.Uuid(), nullable=False),
        sa.Column("form_name", sa.String(160), nullable=False),
        sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["workspace_id", "booking_id"],
            ["bookings.workspace_id", "bookings.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workspace_id", "booking_id", "form_template_id", name="uq_booking_form_response"
        ),
    )
    op.create_index(
        "ix_booking_form_responses_workspace_id",
        "booking_form_responses",
        ["workspace_id"],
    )

    op.create_table(
        "public_booking_idempotency",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("idempotency_key", sa.String(255), nullable=False),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["workspace_id", "booking_id"],
            ["bookings.workspace_id", "bookings.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workspace_id", "idempotency_key", name="uq_public_booking_idempotency_key"
        ),
    )
    op.create_index(
        "ix_public_booking_idempotency_workspace_id",
        "public_booking_idempotency",
        ["workspace_id"],
    )

    for table_name in (
        "workspace_payment_settings",
        "booking_form_responses",
        "public_booking_idempotency",
    ):
        _enable_tenant_rls(table_name)

    op.execute(
        """
        CREATE FUNCTION public.slotera_public_resolve_workspace(p_slug text)
        RETURNS uuid
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
          SELECT workspace.id
          FROM public.workspaces AS workspace
          JOIN public.workspace_business_profiles AS profile
            ON profile.workspace_id = workspace.id
          WHERE workspace.slug = lower(btrim(p_slug))
            AND workspace.operational_status::text = 'active'
            AND profile.booking_page_enabled = true
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION public.slotera_public_resolve_workspace(text) FROM PUBLIC")
    op.execute(
        "GRANT EXECUTE ON FUNCTION public.slotera_public_resolve_workspace(text) TO slotera_app"
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION public.slotera_public_resolve_workspace(text)")
    op.drop_table("public_booking_idempotency")
    op.drop_table("booking_form_responses")
    op.drop_constraint("ck_bookings_tax_treatment", "bookings", type_="check")
    op.drop_constraint("ck_bookings_financial_snapshot_nonnegative", "bookings", type_="check")
    op.drop_constraint("ck_bookings_payment_method", "bookings", type_="check")
    op.drop_constraint("uq_bookings_workspace_reference", "bookings", type_="unique")
    for column in (
        "payment_due_at",
        "billing_address",
        "seller_tax_number",
        "tax_jurisdiction",
        "tax_label",
        "tax_rate_bps",
        "tax_treatment",
        "tax_amount_cents",
        "net_amount_cents",
        "payment_method",
        "reference",
    ):
        op.drop_column("bookings", column)
    op.drop_table("workspace_payment_settings")
