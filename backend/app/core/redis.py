"""
Redis async connection manager with lifecycle hooks.

Provides a global Redis client initialized during the FastAPI lifespan.
"""

from __future__ import annotations

import asyncio
import logging
from typing import AsyncGenerator

from fastapi import HTTPException, status
from redis.asyncio import Redis as AsyncRedis, ConnectionPool

logger = logging.getLogger("crop.redis")


class RedisManager:
    """Manages the async Redis client with connectivity check."""

    def __init__(self) -> None:
        self._client: AsyncRedis | None = None
        self._initialized = False

    @property
    def is_initialized(self) -> bool:
        return self._initialized

    @property
    def client(self) -> AsyncRedis:
        if self._client is None:
            raise RuntimeError("Redis not initialized. Call initialize() first.")
        return self._client

    async def initialize(self, redis_url: str, required: bool = True) -> None:
        """Create the connection pool, run a connectivity check, and store the client.

        Args:
            redis_url: Redis connection URL (e.g. ``redis://localhost:6379/0``).
            required: If ``True``, raise on failure (production).
                      If ``False`` (dev), skip connection entirely — no-op.

        Raises:
            ConnectionError: If Redis is unreachable and ``required=True``.
        """
        if not required:
            logger.info(
                "Redis is not required in this environment. "
                "Skipping connection. Redis-dependent features (SSE, refresh tokens) "
                "will be unavailable."
            )
            return

        logger.info("Initializing Redis connection...")

        pool = ConnectionPool.from_url(
            redis_url,
            decode_responses=False,
            socket_connect_timeout=5,
            socket_keepalive=True,
        )
        self._client = AsyncRedis(connection_pool=pool)

        # ── Connectivity pre-check ──────────────────────────
        try:
            async with asyncio.timeout(10):
                await self._client.ping()
            logger.info("Redis connectivity pre-check passed (PING).")
        except asyncio.TimeoutError:
            await self._client.aclose()
            self._client = None
            raise ConnectionError(
                "Redis unreachable: PING timed out after 10 seconds."
            ) from None
        except Exception as exc:
            if self._client:
                await self._client.aclose()
            self._client = None
            raise ConnectionError(f"Redis connectivity check failed: {exc}") from exc

        self._initialized = True

    async def close(self) -> None:
        """Close the Redis connection pool gracefully."""
        if not self._initialized or self._client is None:
            return
        logger.info("Closing Redis connection...")
        try:
            await self._client.aclose()
        except Exception as exc:
            logger.warning("Error closing Redis: %s", exc)
        self._initialized = False
        logger.info("Redis connection closed.")


# Global singleton
redis_manager = RedisManager()


async def get_redis() -> AsyncGenerator[AsyncRedis, None]:
    """FastAPI dependency that yields the Redis client.

    Usage::

        @router.post("/login")
        async def login(r: AsyncRedis = Depends(get_redis)):
            ...

    Raises:
        HTTPException 503: If Redis was not initialized (e.g. in dev mode).
    """
    if not redis_manager.is_initialized:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis is not available. This feature requires Redis to be running.",
        )
    yield redis_manager.client
