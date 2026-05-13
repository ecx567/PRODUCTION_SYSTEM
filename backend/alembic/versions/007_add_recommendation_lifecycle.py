"""Add lifecycle columns to recommendations table.

Adds status, severity, title, acknowledged_at, and dismissed_at columns
to the existing ``recommendations`` table for lifecycle tracking.

Lifecycle states:
    - ``active`` (default): newly generated, awaiting farmer action
    - ``acknowledged``: farmer has seen the recommendation
    - ``dismissed``: farmer dismissed (not relevant / wrong timing)
    - ``applied``: farmer acted on the recommendation

Severity levels:
    - ``info``, ``low``, ``medium``, ``high``, ``critical``

Revision ID: 007
Revises: 006
Create Date: 2026-05-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Add lifecycle columns ─────────────────────────────────
    op.add_column(
        "recommendations",
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="active",
            comment="Lifecycle status: active | acknowledged | dismissed | applied",
        ),
    )
    op.add_column(
        "recommendations",
        sa.Column(
            "severity",
            sa.String(20),
            nullable=False,
            server_default="info",
            comment="Severity level: info | low | medium | high | critical",
        ),
    )
    op.add_column(
        "recommendations",
        sa.Column(
            "title",
            sa.String(255),
            nullable=True,
            comment="Human-readable recommendation title.",
        ),
    )
    op.add_column(
        "recommendations",
        sa.Column(
            "acknowledged_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When the farmer acknowledged the recommendation.",
        ),
    )
    op.add_column(
        "recommendations",
        sa.Column(
            "dismissed_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When the farmer dismissed the recommendation.",
        ),
    )

    # ── Index for lifecycle queries ───────────────────────────
    op.create_index(
        "ix_recommendations_status",
        "recommendations",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("ix_recommendations_status", table_name="recommendations")
    op.drop_column("recommendations", "dismissed_at")
    op.drop_column("recommendations", "acknowledged_at")
    op.drop_column("recommendations", "title")
    op.drop_column("recommendations", "severity")
    op.drop_column("recommendations", "status")
