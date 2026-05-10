"""Add recommendations and predictions tables.

Adds two new tables for the Phase 5 recommendation engine and ML prediction pipeline:

    - ``recommendations`` — Stored agronomic recommendations (irrigation, fertilization,
      pest risk) as JSONB payloads for historical tracking and audit.
    - ``predictions`` — ML model yield predictions with confidence intervals and
      model version tracking for reproducibility.

Revision ID: 004
Revises: 003
Create Date: 2026-05-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Recommendations table ────────────────────────────────
    op.create_table(
        "recommendations",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("field_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "type",
            sa.String(20),
            nullable=False,
            comment="Recommendation type: irrigation | fertilization | pest_risk",
        ),
        sa.Column(
            "payload",
            JSONB(),
            nullable=False,
            comment="Full recommendation payload as JSONB (schema in Python).",
        ),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="When the recommendation was generated.",
        ),
        sa.Column(
            "applied_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When the recommendation was applied by the farmer (null = pending).",
        ),
        sa.ForeignKeyConstraint(
            ["field_id"],
            ["fields.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_recommendations_field_type",
        "recommendations",
        ["field_id", "type"],
    )
    op.create_index(
        "ix_recommendations_generated_at",
        "recommendations",
        ["generated_at"],
    )

    # ── Predictions table ────────────────────────────────────
    op.create_table(
        "predictions",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("field_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "type",
            sa.String(20),
            nullable=False,
            comment="Prediction type: yield | growth",
        ),
        sa.Column(
            "value",
            sa.Float(),
            nullable=False,
            comment="Predicted yield in kg/ha (or growth metric).",
        ),
        sa.Column(
            "lower_bound",
            sa.Float(),
            nullable=True,
            comment="Lower bound of confidence interval.",
        ),
        sa.Column(
            "upper_bound",
            sa.Float(),
            nullable=True,
            comment="Upper bound of confidence interval.",
        ),
        sa.Column(
            "model_version",
            sa.String(100),
            nullable=False,
            comment="Model identifier (e.g., 'yield_model_rf', 'fallback_gdd').",
        ),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="When the prediction was generated.",
        ),
        sa.ForeignKeyConstraint(
            ["field_id"],
            ["fields.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_predictions_field_type",
        "predictions",
        ["field_id", "type"],
    )
    op.create_index(
        "ix_predictions_generated_at",
        "predictions",
        ["generated_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_predictions_generated_at", table_name="predictions")
    op.drop_index("ix_predictions_field_type", table_name="predictions")
    op.drop_table("predictions")
    op.drop_index("ix_recommendations_generated_at", table_name="recommendations")
    op.drop_index("ix_recommendations_field_type", table_name="recommendations")
    op.drop_table("recommendations")
