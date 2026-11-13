# ruff: noqa: E501
"""Persistent package offers and scoped client-page branding."""

from collections.abc import Sequence

from alembic import op

revision: str = "20261113_0038"
down_revision: str | None = "20261113_0037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    statements = """
        ALTER TABLE workspace_business_profiles ADD COLUMN brand_accent varchar(7) NOT NULL DEFAULT '#3d5a3d';
        ALTER TABLE workspace_business_profiles ADD COLUMN brand_font varchar(5) NOT NULL DEFAULT 'serif';
        ALTER TABLE workspace_business_profiles ADD CONSTRAINT ck_brand_font CHECK (brand_font IN ('serif','sans'));
        ALTER TABLE workspace_business_profiles ADD CONSTRAINT ck_brand_accent CHECK (brand_accent ~ '^#[0-9a-fA-F]{6}$');
        CREATE TABLE service_packages (
            id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            name varchar(160) NOT NULL, description varchar(4000) NOT NULL,
            status varchar(8) NOT NULL CHECK (status IN ('active','inactive')),
            price_cents integer NOT NULL CHECK(price_cents >= 0), notes varchar(4000),
            featured boolean NOT NULL DEFAULT false,
            created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE(workspace_id, id));
        CREATE TABLE service_package_items (
            id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            package_id uuid NOT NULL, service_id uuid NOT NULL, title varchar(160), description varchar(1000),
            position integer NOT NULL CHECK(position >= 0),
            FOREIGN KEY(workspace_id, package_id) REFERENCES service_packages(workspace_id, id) ON DELETE CASCADE,
            FOREIGN KEY(workspace_id, service_id) REFERENCES services(workspace_id, id) ON DELETE RESTRICT,
            UNIQUE(workspace_id, package_id, position));
    """
    for statement in statements.split(";"):
        if statement.strip():
            op.execute(statement)
    for table in ("service_packages", "service_package_items"):
        op.execute(f"CREATE INDEX ix_{table}_workspace_id ON {table}(workspace_id)")
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY {table}_tenant ON {table} TO slotera_app "
            "USING (workspace_id = public.slotera_current_workspace_id()) "
            "WITH CHECK (workspace_id = public.slotera_current_workspace_id())"
        )


def downgrade() -> None:
    op.drop_table("service_package_items")
    op.drop_table("service_packages")
    op.drop_column("workspace_business_profiles", "brand_font")
    op.drop_column("workspace_business_profiles", "brand_accent")
