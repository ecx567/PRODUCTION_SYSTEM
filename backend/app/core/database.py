"""
Async database engine manager with connectivity pre-check and graceful shutdown.

Uses asyncpg via SQLAlchemy 2.0 async engine. The engine is initialized during
the FastAPI lifespan and disposed on shutdown (SIGTERM).

Usage:

    from app.core.database import db, get_db

    async def my_endpoint(db_session: AsyncSession = Depends(get_db)):
        ...
"""

from __future__ import annotations

import asyncio
import logging
from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

logger = logging.getLogger("crop.database")


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


class DatabaseManager:
    """Manages the async SQLAlchemy engine and session factory with lifecycle hooks."""

    def __init__(self) -> None:
        self._engine = None
        self._session_factory = None
        self._initialized = False

    @property
    def is_initialized(self) -> bool:
        return self._initialized

    async def initialize(self, database_url: str) -> None:
        """Create the engine, run connectivity pre-check, and build the session factory.

        The connectivity check uses ``SELECT 1`` with a 10-second timeout to
        fail fast instead of waiting for the default 120-second pool timeout.

        Raises:
            ConnectionError: If the database is unreachable within the timeout.
        """
        logger.info("Initializing database connection...")

        self._engine = create_async_engine(
            database_url,
            pool_pre_ping=True,          # verify connection before checkout
            pool_size=10,
            max_overflow=20,
            pool_recycle=3600,           # recycle connections every hour
            echo=False,
        )

        # ── Connectivity pre-check (fail fast) ──────────────
        try:
            async with asyncio.timeout(10):
                async with self._engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))
                    await conn.commit()
            logger.info("Database connectivity pre-check passed (SELECT 1).")
        except asyncio.TimeoutError:
            await self._engine.dispose()
            raise ConnectionError(
                "Database unreachable: SELECT 1 timed out after 10 seconds. "
                "Check that TimescaleDB is running and DATABASE_URL is correct."
            ) from None
        except Exception as exc:
            await self._engine.dispose()
            raise ConnectionError(
                f"Database connectivity pre-check failed: {exc}"
            ) from exc

        self._session_factory = async_sessionmaker(
            bind=self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        self._initialized = True
        logger.info("Database engine initialized successfully.")

    async def close(self) -> None:
        """Gracefully shut down the engine: flush pending work and dispose.

        Call this during the FastAPI lifespan shutdown phase (SIGTERM).
        """
        if not self._initialized or self._engine is None:
            return

        logger.info("Shutting down database engine...")
        try:
            # Dispose the engine — waits for all connections to return to pool
            await self._engine.dispose()
        except Exception as exc:
            logger.warning("Error during engine disposal: %s", exc)

        self._initialized = False
        logger.info("Database engine shut down complete.")

    def get_session_factory(self) -> async_sessionmaker[AsyncSession]:
        """Return the session factory. Raises if not initialized."""
        if self._session_factory is None:
            raise RuntimeError("DatabaseManager not initialized. Call initialize() first.")
        return self._session_factory


# Global singleton
db = DatabaseManager()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session.

    The session is automatically closed when the request completes.

    Usage::

        @router.get("/items")
        async def list_items(session: AsyncSession = Depends(get_db)):
            ...
    """
    factory = db.get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
