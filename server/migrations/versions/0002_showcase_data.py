"""Small local showcase dataset; dates are relative to the initial migration run."""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import delete, text

from slotera_api.config import get_migration_settings
from slotera_api.db.models import ReservedWorkspaceSlug
from slotera_api.seed import DEMO_SEED, RESERVED_WORKSPACE_SLUGS, seed_on_connection

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if get_migration_settings().environment == "production":
        raise RuntimeError("Showcase migrations are local-only; freeze a production baseline first")
    seed_on_connection(op.get_bind(), demo_password="slotera-local-only")


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        text("DELETE FROM workspaces WHERE id = :id"), {"id": DEMO_SEED.workspace.id}
    )
    connection.execute(
        text("DELETE FROM users WHERE id IN (:operator, :staff)"),
        {"operator": DEMO_SEED.operator.id, "staff": DEMO_SEED.superadmin.id},
    )
    connection.execute(
        delete(ReservedWorkspaceSlug).where(ReservedWorkspaceSlug.slug.in_(RESERVED_WORKSPACE_SLUGS))
    )
