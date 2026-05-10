"""Add sync_revision table for mobile offline-first sync protocol.

Adds a single-row revision counter table used by the mobile sync protocol
to track incremental changes.

Revision ID: 005
Revises: 004
Create Date: 2026-05-10
"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sync_revision",
        sa.Column("id", sa.BigInteger(), nullable=False, server_default="1"),
        sa.Column("revision", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.String(32), server_default=sa.text("datetime('now')"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Insert initial revision row
    op.execute("INSERT INTO sync_revision (id, revision) VALUES (1, 0)")


def downgrade() -> None:
    op.drop_table("sync_revision")
