"""Change fields.crop_type from Enum to String(50).

Changes the ``crop_type`` column on the ``fields`` table from a
PostgreSQL enum (``crop_type``) to ``VARCHAR(50)`` so new crop types
can be added without schema migrations.

Downgrade note: only succeeds if all rows have crop_type values in
{banana, maize, cacao, rice}. Rows with new crop types (coffee, etc.)
will prevent downgrade — this is an intentional one-way migration
toward dynamic crop types.

Revision ID: 006
Revises: 005
Create Date: 2026-05-11
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Change the column type from enum to VARCHAR(50), casting existing values
    op.execute(
        "ALTER TABLE fields ALTER COLUMN crop_type TYPE VARCHAR(50)"
        " USING crop_type::text"
    )
    # The old enum type is no longer referenced by any column — drop it
    op.execute("DROP TYPE IF EXISTS crop_type")


def downgrade() -> None:
    # Recreate the enum type
    op.execute("CREATE TYPE crop_type AS ENUM ('banana', 'maize', 'cacao', 'rice')")
    # Cast back — will fail if any row contains a value not in the original enum
    op.execute(
        "ALTER TABLE fields ALTER COLUMN crop_type TYPE crop_type"
        " USING crop_type::crop_type"
    )
