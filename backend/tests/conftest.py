"""
Pytest fixtures for the Crop Production System test suite.

Provides:
    - Async SQLAlchemy session (in-memory or test DB)
    - FastAPI TestClient
    - Mock EMQX / MQTT client
    - IngestionService instance
    - Sample sensor reading payloads
    - Auth token fixtures for tenant-scoped tests
    - Field and notification service instances
"""

from __future__ import annotations

from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.database import Base, DatabaseManager, get_db

# ── Import ALL models to register them in Base.metadata ─────
# pylint: disable=unused-import
from app.domain.auth.models import User
from app.domain.auth.models_tenant import Tenant
from app.domain.fields.models import Field
from app.domain.notifications.models import AlertRule, AlertEvent

# ── Test DB (in-memory SQLite for unit tests) ───────────────
# Note: SQLite doesn't support all PostgreSQL/JSONB features, so some
# integration tests require a real TimescaleDB. These unit tests focus
# on validation and service logic.

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"


@pytest.fixture(scope="session")
def event_loop_policy():
    """Use the default asyncio event loop policy for tests."""
    import asyncio
    return asyncio.DefaultEventLoopPolicy()


@pytest.fixture
async def db_engine():
    """Create a fresh async engine for testing."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Yield a fresh async session for each test."""
    factory = async_sessionmaker(
        bind=db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
def app() -> FastAPI:
    """Create a minimal FastAPI app for testing.

    Avoids importing the real main.py to prevent side effects
    (e.g., MQTT connection attempts during tests).
    """
    from app.main import create_app
    return create_app()


@pytest.fixture
async def client(app: FastAPI, db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Yield an async HTTP client backed by the test app.

    Overrides the ``get_db`` dependency to use the test session.
    """

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# ── Mock MQTT ───────────────────────────────────────────────

@pytest.fixture
def mock_mqtt_client() -> MagicMock:
    """Return a mock gmqtt Client for unit testing MQTTManager."""
    mock = MagicMock()
    mock.connect = AsyncMock()
    mock.disconnect = AsyncMock()
    mock.subscribe = MagicMock()
    mock.publish = MagicMock()
    return mock


@pytest.fixture
def mock_mqtt_manager(mock_mqtt_client: MagicMock):
    """Patch MQTTManager to use a mock client."""
    with patch("app.core.mqtt.MQTTClient", return_value=mock_mqtt_client):
        from app.core.mqtt import mqtt_manager

        # Reset state
        mqtt_manager._connected = False
        mqtt_manager._initialized = False
        mqtt_manager._client = mock_mqtt_client
        yield mqtt_manager


# ── Sample payloads ─────────────────────────────────────────

@pytest.fixture
def valid_sensor_payload() -> dict:
    """A valid sensor reading payload."""
    return {
        "ts": "2026-05-10T14:30:00Z",
        "sensor_id": "550e8400-e29b-41d4-a716-446655440000",
        "field_id": "660e8400-e29b-41d4-a716-446655440001",
        "temp": 25.5,
        "humidity": 70.2,
        "soil_moisture": 45.0,
        "rain": 0.0,
    }


@pytest.fixture
def invalid_sensor_payload() -> dict:
    """A payload with out-of-range temperature."""
    return {
        "ts": "2026-05-10T14:30:00Z",
        "sensor_id": "550e8400-e29b-41d4-a716-446655440000",
        "field_id": "660e8400-e29b-41d4-a716-446655440001",
        "temp": 150.0,  # Out of range!
        "humidity": 70.2,
        "soil_moisture": 45.0,
        "rain": 0.0,
    }


@pytest.fixture
def mqtt_topic() -> str:
    return "farm/a1b2c3d4-e29b-41d4-a716-446655440000/sensor/550e8400-e29b-41d4-a716-446655440000/data"


@pytest.fixture
def ingredient_service():
    """Return a fresh IngestionService instance."""
    from app.domain.ingestion.service import IngestionService
    return IngestionService()


# ── Auth / Token fixtures ───────────────────────────────────

@pytest.fixture
def tenant_id() -> UUID:
    """A fixed tenant UUID for test isolation."""
    return UUID("a1b2c3d4-e29b-41d4-a716-446655440000")


@pytest.fixture
def other_tenant_id() -> UUID:
    """A different tenant UUID for isolation testing."""
    return UUID("b2c3d4e5-e29b-41d4-a716-446655440001")


@pytest.fixture
def farmer_token(tenant_id: UUID) -> str:
    """Generate a JWT access token for a farmer user."""
    from app.domain.auth.service import create_access_token
    return create_access_token(
        user_id="550e8400-e29b-41d4-a716-446655440000",
        tenant_id=str(tenant_id),
        role="farmer",
    )


@pytest.fixture
def agronomist_token(tenant_id: UUID) -> str:
    """Generate a JWT access token for an agronomist user."""
    from app.domain.auth.service import create_access_token
    return create_access_token(
        user_id="660e8400-e29b-41d4-a716-446655440001",
        tenant_id=str(tenant_id),
        role="agronomist",
    )


@pytest.fixture
def admin_token(tenant_id: UUID) -> str:
    """Generate a JWT access token for an admin user."""
    from app.domain.auth.service import create_access_token
    return create_access_token(
        user_id="770e8400-e29b-41d4-a716-446655440002",
        tenant_id=str(tenant_id),
        role="admin",
    )


@pytest.fixture
def other_tenant_token(other_tenant_id: UUID) -> str:
    """Generate a JWT token for a user in a different tenant."""
    from app.domain.auth.service import create_access_token
    return create_access_token(
        user_id="880e8400-e29b-41d4-a716-446655440003",
        tenant_id=str(other_tenant_id),
        role="farmer",
    )


@pytest.fixture
def auth_headers(farmer_token: str) -> dict[str, str]:
    """Standard Authorization header for a farmer user."""
    return {"Authorization": f"Bearer {farmer_token}"}


# ── Field fixtures ──────────────────────────────────────────

@pytest.fixture
def fields_service():
    """Return a fresh FieldsService instance."""
    from app.domain.fields.service import FieldsService
    return FieldsService()


@pytest.fixture
def sample_field_create() -> dict:
    """A valid field creation payload."""
    return {
        "name": "Test North Field",
        "crop_type": "maize",
        "planted_at": "2026-03-15T08:00:00Z",
        "area_ha": 12.5,
        "location": "POINT(-82.5 23.1)",
    }


@pytest.fixture
def sample_field_create_banana() -> dict:
    """A banana field creation payload for tenant isolation testing."""
    return {
        "name": "Banana Plantation",
        "crop_type": "banana",
        "area_ha": 25.0,
    }


# ── Notification fixtures ───────────────────────────────────

@pytest.fixture
def notification_service():
    """Return a fresh NotificationService instance."""
    from app.domain.notifications.service import NotificationService
    return NotificationService()


@pytest.fixture
def sample_alert_rule_create() -> dict:
    """A valid alert rule creation payload."""
    return {
        "name": "High Temperature",
        "metric_type": "temp",
        "condition": "gt",
        "threshold": 35.0,
        "severity": "warning",
        "enabled": True,
        "cooldown_minutes": 15,
    }


@pytest.fixture
def sample_alert_rule_low_humidity() -> dict:
    """Another alert rule for testing."""
    return {
        "name": "Low Humidity",
        "metric_type": "humidity",
        "condition": "lt",
        "threshold": 30.0,
        "severity": "critical",
        "enabled": True,
    }


# ── Mock Redis for SSE tests ────────────────────────────────

@pytest.fixture
def mock_redis():
    """Return a mock Redis client for testing alert publishing."""
    from unittest.mock import AsyncMock, MagicMock
    mock = MagicMock()
    mock.publish = AsyncMock()
    mock.pubsub = MagicMock()
    pubsub = MagicMock()
    pubsub.subscribe = AsyncMock()
    pubsub.get_message = AsyncMock(return_value=None)
    pubsub.unsubscribe = AsyncMock()
    pubsub.reset = AsyncMock()
    mock.pubsub.return_value = pubsub
    return mock
