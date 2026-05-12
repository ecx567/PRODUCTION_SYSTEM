"""Initial schema: tenants, users, fields, sensor_readings hypertable.

Revision ID: 001
Revises: None
Create Date: 2026-05-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from app.domain.auth.models import UserRole

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extensions ──────────────────────────────────────────
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "timescaledb"')

    # ── Tenants ─────────────────────────────────────────────
    op.create_table(
        "tenants",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # ── Users ───────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "role",
            sa.Enum(UserRole, name="user_role", create_type=False),
            nullable=False,
            server_default=UserRole.FARMER.name,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("TRUE"),
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
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index(
        "ix_users_tenant_id",
        "users",
        ["tenant_id"],
    )

    # ── Fields ──────────────────────────────────────────────
    op.create_table(
        "fields",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "crop_type",
            sa.Enum("banana", "maize", "cacao", "rice", name="crop_type"),
            nullable=False,
        ),
        sa.Column("planted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("area_ha", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_fields_tenant_id",
        "fields",
        ["tenant_id"],
    )

    # ── Sensor Readings (TimescaleDB Hypertable) ────────────
    op.create_table(
        "sensor_readings",
        sa.Column("time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("sensor_id", UUID(as_uuid=True), nullable=False),
        sa.Column("field_id", UUID(as_uuid=True), nullable=False),
        sa.Column("temp", sa.Float(), nullable=True),
        sa.Column("humidity", sa.Float(), nullable=True),
        sa.Column("soil_moisture", sa.Float(), nullable=True),
        sa.Column("rain", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(
            ["field_id"],
            ["fields.id"],
            ondelete="CASCADE",
        ),
    )
    # Convert to hypertable (TimescaleDB)
    op.execute(
        "SELECT create_hypertable('sensor_readings', 'time', "
        "chunk_time_interval => INTERVAL '1 day', "
        "if_not_exists => TRUE)"
    )
    # Unique index for idempotent inserts
    op.create_unique_constraint(
        "uq_sensor_readings_time_sensor",
        "sensor_readings",
        ["time", "sensor_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_sensor_readings_time_sensor",
        "sensor_readings",
        type_="unique",
    )
    op.drop_table("sensor_readings")
    op.drop_table("fields")
    op.drop_table("users")
    op.drop_table("tenants")
    op.execute("DROP TYPE IF EXISTS crop_type")
    op.execute("DROP TYPE IF EXISTS user_role")
    # Extensions are not dropped during downgrade to avoid cascading issues
