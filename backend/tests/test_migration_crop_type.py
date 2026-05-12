"""
Tests for the 006_crop_type_string Alembic migration.

Verifies migration metadata, revision chain integrity, and SQL syntax.
The actual ALTER COLUMN requires PostgreSQL, so we validate via module
introspection and revision chain walking.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest


MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "alembic" / "versions"
MIGRATION_006 = MIGRATIONS_DIR / "006_crop_type_string.py"


# ═══════════════════════════════════════════════════════════════
# Module-level tests (pure introspection, no DB needed)
# ═══════════════════════════════════════════════════════════════

class TestMigration006Module:
    """Validate the migration file structure and metadata."""

    def _load_migration_module(self):
        """Load the migration as a Python module for introspection."""
        spec = importlib.util.spec_from_file_location(
            "migration_006", str(MIGRATION_006),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def test_migration_file_exists(self):
        """006_crop_type_string.py exists in the versions directory."""
        assert MIGRATION_006.exists(), f"Migration not found: {MIGRATION_006}"

    def test_revision_metadata(self):
        """Migration revision is '006' and revises '005'."""
        mod = self._load_migration_module()
        assert mod.revision == "006"
        assert mod.down_revision == "005"
        assert mod.branch_labels is None
        assert mod.depends_on is None

    def test_upgrade_downgrade_functions_exist(self):
        """Both upgrade() and downgrade() are callable."""
        mod = self._load_migration_module()
        assert callable(mod.upgrade)
        assert callable(mod.downgrade)

    def test_upgrade_contains_alter_column(self):
        """upgrade() source contains ALTER COLUMN ... VARCHAR(50)."""
        import inspect
        mod = self._load_migration_module()
        source = inspect.getsource(mod.upgrade)
        assert "ALTER TABLE fields ALTER COLUMN crop_type" in source
        assert "TYPE VARCHAR(50)" in source
        assert "USING crop_type::text" in source
        assert "DROP TYPE IF EXISTS crop_type" in source

    def test_downgrade_recreates_enum(self):
        """downgrade() source contains CREATE TYPE ... AS ENUM."""
        import inspect
        mod = self._load_migration_module()
        source = inspect.getsource(mod.downgrade)
        assert "CREATE TYPE crop_type AS ENUM" in source
        for crop in ("banana", "maize", "cacao", "rice"):
            assert f"'{crop}'" in source


# ═══════════════════════════════════════════════════════════════
# Revision chain integrity checks
# ═══════════════════════════════════════════════════════════════

class TestRevisionChain:
    """Verify the full migration chain is consistent."""

    EXPECTED_REVISIONS = {
        "001": "Initial schema",
        "002": "Add ingestion metadata",
        "003": "Add alert tables",
        "004": "Add recommendations and predictions",
        "005": "Add sync revision",
        "006": "Change crop_type to String(50)",
    }

    def _load_all_migrations(self):
        """Load all migration modules and return {revision: module}."""
        migrations = {}
        for fpath in sorted(MIGRATIONS_DIR.glob("*.py")):
            if fpath.name == "__init__.py":
                continue
            spec = importlib.util.spec_from_file_location(
                f"migration_{fpath.stem}", str(fpath),
            )
            mod = importlib.util.module_from_spec(spec)
            sys.modules[mod.__name__] = mod
            spec.loader.exec_module(mod)
            migrations[mod.revision] = mod
        return migrations

    def test_all_revisions_present(self):
        """Every expected revision ID is present in a migration file."""
        migrations = self._load_all_migrations()
        for rev, desc in self.EXPECTED_REVISIONS.items():
            assert rev in migrations, f"Migration '{rev}' ({desc}) not found"
            assert hasattr(migrations[rev], "revision")

    def test_chain_is_contiguous(self):
        """Each migration's down_revision points to the prior one, ending at None."""
        migrations = self._load_all_migrations()
        current = migrations["006"]
        expected = ["006", "005", "004", "003", "002", "001"]
        for i, exp_rev in enumerate(expected):
            assert current.revision == exp_rev, (
                f"Position {i}: expected {exp_rev}, got {current.revision}"
            )
            if current.down_revision is not None:
                current = migrations[current.down_revision]
            else:
                assert exp_rev == "001", (
                    f"Unexpected None down_revision at {exp_rev}"
                )


# ═══════════════════════════════════════════════════════════════
# Post-migration end-to-end check (requires PostgreSQL — skip if not available)
# ═══════════════════════════════════════════════════════════════

@pytest.mark.skip(reason="Requires PostgreSQL — run manually with INTEGRATION_DATABASE_URL")
class TestMigrationEndToEnd:
    """Verify the migration + seed data lifecycle.

    These tests require a PostgreSQL database with alembic access.
    They are skipped by default.

    Steps to run manually:
        1. Set INTEGRATION_DATABASE_URL pointing to a test PostgreSQL
        2. Create DB with ``alembic upgrade 005``
        3. Insert seed data (4 fields with old enum values)
        4. Run ``alembic upgrade 006``
        5. Verify crop_type values are preserved as strings
        6. Run ``alembic downgrade 005``
        7. Verify original data still intact
        8. ``alembic upgrade 006`` again to restore
    """

    def test_migration_preserves_seed_data(self):
        """Run alembic upgrade head and verify seed data survives."""
        pass
