"""
FastAPI application factory with lifespan management.

The lifespan context manager handles:
- Startup: database initialization, RSA key readiness check
- Shutdown: graceful database engine disposal
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.database import db
from app.core.mqtt import mqtt_manager
from app.core.redis import redis_manager
from app.domain.ingestion.service import IngestionService
from app.domain.notifications.service import NotificationService

# ── Logging ────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("crop.main")


# ── Lifespan ───────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI application lifespan."""
    # ── Startup ─────────────────────────────────────────────
    logger.info("Starting Crop Production System API...")

    # Verify RSA keys are available (will generate if needed)
    _ = settings.private_key_pem
    logger.info("JWT RSA key pair ready (algorithm=%s).", settings.JWT_ALGORITHM)

    # Initialize database connection pool
    await db.initialize(settings.DATABASE_URL)

    # Initialize Redis (required if REDIS_URL is set, optional otherwise)
    await redis_manager.initialize(
        settings.REDIS_URL,
        required=bool(settings.REDIS_URL),
    )

    # ── Seed database (dev/test only) ───────────────────────
    if settings.ENVIRONMENT != "production":
        from app.core.database import get_db
        from app.seed import seed_database

        factory = db.get_session_factory()
        async with factory() as session:
            await seed_database(session)
            await session.commit()

    # ── Initialize MQTT and subscribe to tenant topics ──────
    _ingestion_service = IngestionService()

    async def _mqtt_message_handler(topic: str, payload: bytes) -> None:
        """Route incoming MQTT messages to the ingestion service."""
        from app.core.database import get_db

        # Each MQTT message gets its own DB session
        factory = db.get_session_factory()
        async with factory() as session:
            try:
                result = await _ingestion_service.handle_mqtt_message(
                    topic=topic, payload=payload, db=session,
                )
                if result.isolated_count > 0:
                    logger.warning(
                        "MQTT ingestion isolated %d/%d readings on %s.",
                        result.isolated_count, result.total_submitted, topic,
                    )
            except Exception as exc:
                logger.error("MQTT handler error on %s: %s", topic, exc)
                await session.rollback()

    mqtt_manager.set_message_callback(_mqtt_message_handler)

    try:
        await mqtt_manager.connect(
            host=settings.EMQX_HOST,
            port=settings.EMQX_PORT,
            client_id="crop-backend",
            username="admin",
            password=settings.EMQX_ADMIN_PASSWORD,
            use_tls=False,
        )
        # Subscribe to all tenant sensor data topics
        # In production, subscribe per-tenant dynamically
        await mqtt_manager.subscribe("farm/+/sensor/+/data", qos=1)
        logger.info("MQTT initialized and subscribed to farm/+/sensor/+/data")
    except ConnectionError as exc:
        logger.warning("MQTT connection failed (service will start without MQTT): %s", exc)

    yield

    # ── Shutdown ────────────────────────────────────────────
    logger.info("Shutting down Crop Production System API...")
    await mqtt_manager.disconnect(flush=True)
    await redis_manager.close()
    await db.close()
    logger.info("Shutdown complete.")


# ── App Factory ─────────────────────────────────────────────
def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Crop Production System API",
        description="Digital agriculture management platform — IoT ingestion, "
                    "real-time monitoring, recommendations, and yield forecasting.",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/api/redoc" if settings.ENVIRONMENT != "production" else None,
    )

    # ── Middleware ──────────────────────────────────────────
    cors_origins = (
        ["http://localhost:3000", "http://127.0.0.1:3000"]
        if settings.ENVIRONMENT != "production"
        else settings.CORS_ORIGINS.split(",")
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ─────────────────────────────────────────────
    from app.api.v1.auth import router as auth_router
    from app.api.v1.sse import router as sse_router
    from app.domain.ingestion.router import router as ingestion_router
    from app.domain.analytics.router import router as analytics_router
    from app.domain.fields.router import router as fields_router
    from app.domain.notifications.router import router as notifications_router
    from app.domain.recommendations.router import router as recommendations_router
    from app.domain.analytics.router_predictions import router as predictions_router
    from app.domain.sync.router import router as sync_router
    from app.domain.weather.router import router as weather_router
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(sse_router, prefix="/api/v1")
    app.include_router(ingestion_router, prefix="/api/v1")
    app.include_router(analytics_router, prefix="/api/v1")
    app.include_router(fields_router, prefix="/api/v1")
    app.include_router(notifications_router, prefix="/api/v1")
    app.include_router(recommendations_router, prefix="/api/v1")
    app.include_router(predictions_router, prefix="/api/v1")
    app.include_router(sync_router, prefix="/api/v1")
    app.include_router(weather_router, prefix="/api/v1")

    # ── Global exception handler ────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Catch any unhandled exception, log it, and return a clean 500."""
        logger.exception("Unhandled exception on %s %s: %s", request.method, request.url.path, exc)
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {type(exc).__name__}. Check server logs."},
        )

    # ── Root health check ───────────────────────────────────
    @app.get("/health")
    async def health_check():
        return {
            "status": "healthy",
            "database": db.is_initialized,
            "redis": redis_manager.is_initialized,
        }

    return app


app = create_app()
