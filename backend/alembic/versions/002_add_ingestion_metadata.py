"""Add ingestion_ts, validation_status, signal_quality to sensor_readings.

Adds quality metadata columns for the poison pill pattern and data quality
tracking:
    - ``ingestion_ts`` — when the server ingested this reading
    - ``validation_status`` — valid | invalid | isolated
    - ``signal_quality`` — JSONB with quality score and flags

Revision ID: 002
Revises: 001
Create Date: 2026-05-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sensor_readings",
        sa.Column(
            "ingestion_ts",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Server-side ingestion timestamp (when the backend processed this reading).",
        ),
    )
    op.add_column(
        "sensor_readings",
        sa.Column(
            "validation_status",
            sa.String(20),
            nullable=False,
            server_default="valid",
            comment="Validation outcome: valid | invalid | isolated.",
        ),
    )
    op.add_column(
        "sensor_readings",
        sa.Column(
            "signal_quality",
            JSONB(),
            nullable=True,
            comment="JSON quality metadata: score, metrics_present, out_of_range flags.",
        ),
    )
    # Index for filtering by validation status (poison pill queries)
    op.create_index(
        "ix_sensor_readings_validation_status",
        "sensor_readings",
        ["validation_status"],
    )
    # Index for time-range queries on ingestion_ts
    op.create_index(
        "ix_sensor_readings_ingestion_ts",
        "sensor_readings",
        ["ingestion_ts"],
    )


def downgrade() -> None:
    op.drop_index("ix_sensor_readings_ingestion_ts", table_name="sensor_readings")
    op.drop_index("ix_sensor_readings_validation_status", table_name="sensor_readings")
    op.drop_column("sensor_readings", "signal_quality")
    op.drop_column("sensor_readings", "validation_status")
    op.drop_column("sensor_readings", "ingestion_ts")
