"""Let an operator switch off the emails about client actions.

Three booleans on the business profile, one per client action that emails the owner:
a new booking, a cancellation and a reschedule. All default to on, so nothing changes
for existing workspaces. The application reads them in `notify_operator` before it
queues anything.

Revision ID: 20261027_0035
Revises: 20261012_0034
Create Date: 2026-10-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261027_0035"
down_revision: str | None = "20261012_0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = ("notify_operator_new", "notify_operator_cancelled", "notify_operator_rescheduled")


def upgrade() -> None:
    for column in _COLUMNS:
        op.add_column(
            "workspace_business_profiles",
            sa.Column(column, sa.Boolean(), server_default=sa.text("true"), nullable=False),
        )


def downgrade() -> None:
    for column in reversed(_COLUMNS):
        op.drop_column("workspace_business_profiles", column)
