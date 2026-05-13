"""Add data_quality and features_used columns to predictions.

Adds two metadata columns to the existing ``predictions`` table for tracking
prediction data quality and the set of features used by the model:

    - ``data_quality`` (VARCHAR(20)) — ``high`` | ``medium`` | ``low`` | ``insufficient``
    - ``features_used`` (JSON) — list of feature names used for the prediction

These columns enable downstream consumers (dashboard, scheduler health checks)
to understand the confidence and provenance of each prediction.

Revision ID: 008
Revises: 007
Create Date: 2026-05-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "predictions",
        sa.Column(
            "data_quality",
            sa.String(20),
            nullable=True,
            comment="Data quality: high | medium | low | insufficient",
        ),
    )
    op.add_column(
        "predictions",
        sa.Column(
            "features_used",
            JSON(),
            nullable=True,
            comment="List of feature names used for this prediction.",
        ),
    )


def downgrade() -> None:
    op.drop_column("predictions", "features_used")
    op.drop_column("predictions", "data_quality")
