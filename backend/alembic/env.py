"""
Async Alembic environment for TimescaleDB migrations.

This env.py configures Alembic to use SQLAlchemy's async engine with asyncpg.
All models must be imported here so that ``target_metadata`` reflects the full
schema for autogenerate support.
"""

import asyncio
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# Alembic Config object
config = context.config

# Allow DATABASE_URL env var to override the ini file (used by dev.ps1)
_database_url = os.environ.get("DATABASE_URL")
if _database_url:
    config.set_main_option("sqlalchemy.url", _database_url)

# Set up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Import all models so Base.metadata is populated ─────────
# pylint: disable=unused-import
from app.core.database import Base
from app.domain.auth.models import User
from app.domain.auth.models_tenant import Tenant
from app.domain.fields.models import Field
from app.domain.notifications.models import AlertRule, AlertEvent
from app.domain.recommendations.models import Recommendation

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — emit SQL without connecting."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    """Configure and run migrations against a sync-style connection."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode — connect to the database."""
    url = config.get_main_option("sqlalchemy.url")
    connectable = create_async_engine(url)

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
