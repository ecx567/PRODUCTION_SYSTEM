"""Add country and region columns to tenants table.

Adds two location columns to the ``tenants`` table for multi-tenant
country/region filtering:

    - ``country`` (VARCHAR(100), NOT NULL, DEFAULT 'EC')
    - ``region`` (VARCHAR(100), nullable)

Existing rows automatically receive ``country='EC'`` via the server default.

Revision ID: 009
Revises: 008
Create Date: 2026-05-12
"""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column(
            "country",
            sa.String(100),
            nullable=False,
            server_default=sa.text("'EC'"),
            comment="ISO country code (uppercase).",
        ),
    )
    op.add_column(
        "tenants",
        sa.Column(
            "region",
            sa.String(100),
            nullable=True,
            comment="Geographic region within the country.",
        ),
    )


def downgrade() -> None:
    op.drop_column("tenants", "region")
    op.drop_column("tenants", "country")
