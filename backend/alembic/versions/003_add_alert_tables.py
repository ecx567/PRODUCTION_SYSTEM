"""Add alert_rules and alert_events tables, add deleted_at to fields.

Adds the full alert engine schema:
    - ``alert_rules`` — user-configurable threshold rules
    - ``alert_events`` — triggered alert instances (tenant-scoped)
    - ``deleted_at`` column on ``fields`` for soft-delete support

Revision ID: 003
Revises: 002
Create Date: 2026-05-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Fields: add deleted_at for soft-delete ───────────────
    op.add_column(
        "fields",
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Soft-delete timestamp. NULL means active.",
        ),
    )
    op.add_column(
        "fields",
        sa.Column(
            "location",
            sa.String(500),
            nullable=True,
            comment="WKT or geo coordinates.",
        ),
    )
    op.add_column(
        "fields",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_fields_deleted_at",
        "fields",
        ["deleted_at"],
    )

    # ── Alert Rules ─────────────────────────────────────────
    op.create_table(
        "alert_rules",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("field_id", UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "metric_type",
            sa.String(50),
            nullable=False,
            comment="Metric to monitor: temp, humidity, soil_moisture, rain, etc.",
        ),
        sa.Column(
            "condition",
            sa.String(20),
            nullable=False,
            comment="Comparison operator: gt | lt | eq | between.",
        ),
        sa.Column("threshold", sa.Float(), nullable=False),
        sa.Column(
            "threshold_max",
            sa.Float(),
            nullable=True,
            comment="Upper bound for 'between' condition.",
        ),
        sa.Column(
            "severity",
            sa.String(20),
            nullable=False,
            server_default="warning",
            comment="Severity level: info | warning | critical.",
        ),
        sa.Column(
            "enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("TRUE"),
        ),
        sa.Column(
            "cooldown_minutes",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("15"),
            comment="Min minutes between consecutive alerts from this rule+field.",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["field_id"],
            ["fields.id"],
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_alert_rules_tenant_id",
        "alert_rules",
        ["tenant_id"],
    )

    # ── Alert Events ────────────────────────────────────────
    op.create_table(
        "alert_events",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("rule_id", UUID(as_uuid=True), nullable=False),
        sa.Column("field_id", UUID(as_uuid=True), nullable=False),
        sa.Column("metric_type", sa.String(50), nullable=False),
        sa.Column("actual_value", sa.Float(), nullable=False),
        sa.Column("threshold", sa.Float(), nullable=False),
        sa.Column(
            "severity",
            sa.String(20),
            nullable=False,
            server_default="warning",
        ),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "triggered_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "acknowledged_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When the user acknowledged this alert. NULL = unacknowledged.",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["rule_id"],
            ["alert_rules.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["field_id"],
            ["fields.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_alert_events_tenant_triggered",
        "alert_events",
        ["tenant_id", "triggered_at"],
    )
    op.create_index(
        "ix_alert_events_rule_triggered",
        "alert_events",
        ["rule_id", "triggered_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_alert_events_rule_triggered", table_name="alert_events")
    op.drop_index("ix_alert_events_tenant_triggered", table_name="alert_events")
    op.drop_table("alert_events")
    op.drop_index("ix_alert_rules_tenant_id", table_name="alert_rules")
    op.drop_table("alert_rules")
    op.drop_index("ix_fields_deleted_at", table_name="fields")
    op.drop_column("fields", "created_at")
    op.drop_column("fields", "location")
    op.drop_column("fields", "deleted_at")
