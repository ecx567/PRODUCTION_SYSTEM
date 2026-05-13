"""
Tests for the daily APScheduler: lifecycle, health tracking, batch processing.

Covers:
    - SchedulerManager start / shutdown lifecycle
    - Health dict and ``is_missed`` detection after ≥25h
    - Daily job batch: single-field failure MUST NOT abort entire batch
    - Daily job: no fields → clean skip
    - Health endpoint returns 200 with correct payload
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.scheduler import SchedulerManager, _days_since_planting

# ═══════════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════════


@pytest.fixture
def scheduler() -> SchedulerManager:
    """Return a fresh SchedulerManager for each test."""
    return SchedulerManager()


@pytest.fixture
def field_row() -> MagicMock:
    """Simulate a DB row returned by the fields query."""
    row = MagicMock()
    row.id = uuid4()
    row.tenant_id = uuid4()
    row.crop_type = "maize"
    row.planted_at = datetime.now(timezone.utc) - timedelta(days=60)
    row.area_ha = 12.5
    row.location = "POINT(-82.5 23.1)"
    return row


# ═══════════════════════════════════════════════════════════════
# Helper: run _run_daily_job with all external deps mocked
# ═══════════════════════════════════════════════════════════════


async def _mock_run_daily_job(
    scheduler: SchedulerManager,
    field_rows: list[MagicMock] | None = None,
) -> None:
    """Run ``_run_daily_job()`` with all external services mocked.

    The ``_run_daily_job`` method late-imports dependencies locally:
        - ``from app.core.database import db as db_manager``
        - ``from app.domain.weather.service import WeatherService``
        - ``from app.domain.crop_profiles.service import get_profile_loader``
        - ``from app.domain.notifications.service import NotificationService``
        - ``from app.core.redis import redis_manager``

    We patch them at import source before calling the method so the
    late imports resolve to mocks.
    """
    mock_session = AsyncMock()

    mock_result = MagicMock()
    mock_result.fetchall.return_value = field_rows if field_rows else []
    mock_session.execute.return_value = mock_result

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session

    mock_db = MagicMock()
    mock_db.get_session_factory.return_value = mock_factory

    # PredictionService must return an AsyncMock so that ``await load_model()`` works
    mock_prediction_service = AsyncMock()
    mock_prediction_service.load_model = AsyncMock()

    with (
        patch("app.core.database.db", mock_db),
        patch("app.core.scheduler.IngestionService"),
        patch("app.core.scheduler.RecommendationService"),
        patch(
            "app.core.scheduler.PredictionService",
            return_value=mock_prediction_service,
        ),
        patch("app.domain.weather.service.WeatherService"),
        patch("app.domain.crop_profiles.service.get_profile_loader"),
        patch("app.domain.notifications.service.NotificationService"),
        patch("app.core.redis.redis_manager"),
    ):
        await scheduler._run_daily_job()


# ═══════════════════════════════════════════════════════════════
# SchedulerManager Lifecycle Tests
# ═══════════════════════════════════════════════════════════════

class TestSchedulerLifecycle:
    """start() / shutdown() / is_running."""

    def test_initial_state(self, scheduler: SchedulerManager):
        """Fresh scheduler is not running."""
        assert scheduler.is_running is False
        assert scheduler.last_status == "never_run"
        assert scheduler.last_run is None
        assert scheduler.is_missed is False

    @pytest.mark.asyncio
    async def test_start_makes_it_running(self, scheduler: SchedulerManager):
        """start() transitions scheduler to running state."""
        scheduler.start()
        assert scheduler.is_running is True
        assert scheduler._scheduler is not None
        scheduler.shutdown(wait=False)

    @pytest.mark.asyncio
    async def test_shutdown_stops_it(self, scheduler: SchedulerManager):
        """shutdown() transitions scheduler to stopped state.

        After ``shutdown(wait=True)``, the underlying APScheduler should
        set its ``running`` flag to ``False``.
        """
        scheduler.start()
        scheduler.shutdown(wait=True)
        # Give the event loop a chance to process the shutdown
        import asyncio
        await asyncio.sleep(0.05)
        assert scheduler.is_running is False

    @pytest.mark.asyncio
    async def test_duplicate_start_is_safe(self, scheduler: SchedulerManager):
        """Calling start() twice logs a warning but doesn't crash."""
        scheduler.start()
        scheduler.start()  # should log warning, not raise
        assert scheduler.is_running is True
        scheduler.shutdown(wait=False)

    def test_shutdown_without_start_is_safe(self, scheduler: SchedulerManager):
        """shutdown() when not running does nothing."""
        scheduler.shutdown(wait=True)
        assert scheduler.is_running is False

    def test_health_dict_initial(self, scheduler: SchedulerManager):
        """health_dict() shows initial 'never_run' state."""
        h = scheduler.health_dict()
        assert h["is_running"] is False
        assert h["last_status"] == "never_run"
        assert h["last_run"] is None
        assert h["is_missed"] is False
        assert h["last_error"] is None
        assert h["last_run_duration_seconds"] is None

    @pytest.mark.asyncio
    async def test_health_dict_after_start(self, scheduler: SchedulerManager):
        """health_dict() shows running after start()."""
        scheduler.start()
        h = scheduler.health_dict()
        assert h["is_running"] is True
        scheduler.shutdown(wait=False)


# ═══════════════════════════════════════════════════════════════
# Health / is_missed Tests
# ═══════════════════════════════════════════════════════════════

class TestHealthMissedDetection:
    """is_missed detection (threshold: > 25h in code, i.e. ≥ 25h+1s)."""

    def test_never_run_not_missed(self, scheduler: SchedulerManager):
        """never_run status does NOT report missed (app just started)."""
        assert scheduler.is_missed is False

    def test_recent_success_not_missed(self, scheduler: SchedulerManager):
        """Successful run within 24h → not missed."""
        scheduler._last_status = "success"
        scheduler._last_run = datetime.now(timezone.utc) - timedelta(hours=12)
        assert scheduler.is_missed is False

    def test_old_success_is_missed(self, scheduler: SchedulerManager):
        """Successful run older than 26h → missed."""
        scheduler._last_status = "success"
        scheduler._last_run = datetime.now(timezone.utc) - timedelta(hours=26)
        assert scheduler.is_missed is True

    def test_error_status_still_tracks_last_run(self, scheduler: SchedulerManager):
        """Even an error run updates last_run, so is_missed can be True."""
        scheduler._last_status = "error"
        scheduler._last_run = datetime.now(timezone.utc) - timedelta(hours=48)
        assert scheduler.is_missed is True

    def test_near_threshold_24h_not_missed(self, scheduler: SchedulerManager):
        """24h is not missed (code uses strict > 25h)."""
        scheduler._last_status = "success"
        scheduler._last_run = datetime.now(timezone.utc) - timedelta(hours=24)
        assert scheduler.is_missed is False

    def test_exactly_25h_is_missed(self, scheduler: SchedulerManager):
        """Exactly 25h IS missed (code uses >= per spec)."""
        scheduler._last_status = "success"
        scheduler._last_run = datetime.now(timezone.utc) - timedelta(hours=25)
        assert scheduler.is_missed is True

    def test_just_over_25h_is_missed(self, scheduler: SchedulerManager):
        """25h + 1 second → missed."""
        scheduler._last_status = "success"
        scheduler._last_run = datetime.now(timezone.utc) - timedelta(hours=25, minutes=1)
        assert scheduler.is_missed is True


# ═══════════════════════════════════════════════════════════════
# Days-Since-Planting Helper Tests
# ═══════════════════════════════════════════════════════════════

class TestDaysSincePlanting:
    """_days_since_planting helper."""

    def test_with_date(self):
        """Date object returns correct delta."""
        d = datetime.now(timezone.utc).date() - timedelta(days=30)
        result = _days_since_planting(d)
        assert 28 <= result <= 32  # allow for test timing

    def test_with_datetime(self):
        """Datetime object returns correct delta."""
        dt = datetime.now(timezone.utc) - timedelta(days=45)
        assert _days_since_planting(dt) == 45

    def test_none_returns_zero(self):
        """None returns 0."""
        assert _days_since_planting(None) == 0

    def test_future_date_returns_zero(self):
        """Future planting date returns 0 (not negative)."""
        future = datetime.now(timezone.utc).date() + timedelta(days=10)
        assert _days_since_planting(future) == 0


# ═══════════════════════════════════════════════════════════════
# Daily Job — Batch Processing Tests
# ═══════════════════════════════════════════════════════════════

class TestDailyJobBatch:
    """Batch processing: field iteration, error isolation, empty state."""

    @pytest.mark.asyncio
    async def test_no_fields_skips_cleanly(
        self, scheduler: SchedulerManager,
    ):
        """No active fields → job logs and returns without error."""
        await _mock_run_daily_job(scheduler, field_rows=None)
        assert True  # no exception = clean skip

    @pytest.mark.asyncio
    async def test_single_field_succeeds(
        self, scheduler: SchedulerManager, field_row: MagicMock,
    ):
        """Single field processes without error."""
        await _mock_run_daily_job(scheduler, field_rows=[field_row])
        assert True

    @pytest.mark.asyncio
    async def test_multiple_fields_all_succeed(
        self, scheduler: SchedulerManager, field_row: MagicMock,
    ):
        """Multiple fields all process without error."""
        fields = [field_row for _ in range(5)]
        await _mock_run_daily_job(scheduler, field_rows=fields)
        assert True

    @pytest.mark.asyncio
    async def test_single_field_failure_does_not_abort_batch(
        self, scheduler: SchedulerManager,
    ):
        """When a field fails, subsequent fields still process (batch continues)."""
        field_a, field_b, field_c = (
            MagicMock() for _ in range(3)
        )
        field_a.id, field_b.id, field_c.id = uuid4(), uuid4(), uuid4()
        for f in (field_a, field_b, field_c):
            f.tenant_id = uuid4()
            f.crop_type = "maize"
            f.planted_at = datetime.now(timezone.utc) - timedelta(days=60)
            f.area_ha = 10.0
            f.location = "POINT(-82.5 23.1)"

        processed: list[UUID] = []
        original_process = scheduler._process_field

        async def tracking_process(*args: Any, **kwargs: Any) -> None:
            fid: UUID = kwargs.get("field_id", args[1] if len(args) > 1 else None)
            processed.append(fid)
            if fid == field_b.id:
                raise RuntimeError(f"Simulated failure for {fid}")

        scheduler._process_field = tracking_process
        try:
            await _mock_run_daily_job(scheduler, field_rows=[field_a, field_b, field_c])
        finally:
            scheduler._process_field = original_process

        assert len(processed) == 3
        assert field_a.id in processed
        assert field_b.id in processed
        assert field_c.id in processed

    @pytest.mark.asyncio
    async def test_all_fields_fail_still_continues(
        self, scheduler: SchedulerManager,
    ):
        """All fields fail → batch catches all exceptions, doesn't crash."""
        field_a, field_b = (MagicMock() for _ in range(2))
        field_a.id, field_b.id = uuid4(), uuid4()
        for f in (field_a, field_b):
            f.tenant_id = uuid4()
            f.crop_type = "maize"
            f.planted_at = datetime.now(timezone.utc) - timedelta(days=60)
            f.area_ha = 10.0
            f.location = "POINT(-82.5 23.1)"

        original_process = scheduler._process_field

        async def failing_process(*args: Any, **kwargs: Any) -> None:
            raise RuntimeError("Always fails")

        scheduler._process_field = failing_process
        try:
            await _mock_run_daily_job(scheduler, field_rows=[field_a, field_b])
        finally:
            scheduler._process_field = original_process

        assert True  # No crash = pass


# ═══════════════════════════════════════════════════════════════
# Health Endpoint Integration Tests
# ═══════════════════════════════════════════════════════════════

class TestSchedulerHealthEndpoint:
    """GET /api/v1/system/scheduler/health."""

    @pytest.mark.asyncio
    async def test_health_endpoint_returns_200(self):
        """Health endpoint returns 200 with scheduler status."""
        from app.main import create_app
        app = create_app()
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            resp = await client.get("/api/v1/system/scheduler/health")

        assert resp.status_code == 200
        payload = resp.json()
        assert "is_running" in payload
        assert "last_status" in payload
        assert "last_run" in payload
        assert "is_missed" in payload
        assert "last_error" in payload
        assert "last_run_duration_seconds" in payload

    @pytest.mark.asyncio
    async def test_health_endpoint_initial_state(self):
        """Initial health shows never_run, not missed."""
        from app.main import create_app
        app = create_app()
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            resp = await client.get("/api/v1/system/scheduler/health")

        payload = resp.json()
        assert payload["last_status"] == "never_run"
        assert payload["is_missed"] is False
        assert payload["is_running"] is False

    @pytest.mark.asyncio
    async def test_health_missed_after_long_gap(self):
        """Health endpoint reports is_missed=True after >25h gap."""
        from app.main import create_app
        from app.core.scheduler import scheduler_manager

        old_time = datetime.now(timezone.utc) - timedelta(hours=30)
        scheduler_manager._last_status = "success"
        scheduler_manager._last_run = old_time
        scheduler_manager._last_run_duration = 30.0
        scheduler_manager._last_error = None

        app = create_app()
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            resp = await client.get("/api/v1/system/scheduler/health")

        payload = resp.json()
        assert payload["is_missed"] is True
        assert payload["last_status"] == "success"
        assert payload["last_run"] is not None

        # Reset state to avoid side effects
        scheduler_manager._last_status = "never_run"
        scheduler_manager._last_run = None
        scheduler_manager._last_run_duration = None
        scheduler_manager._last_error = None

    @pytest.mark.asyncio
    async def test_health_error_state(self):
        """Health endpoint reports last error when job failed."""
        from app.main import create_app
        from app.core.scheduler import scheduler_manager

        scheduler_manager._last_status = "error"
        scheduler_manager._last_error = "Something went wrong"
        scheduler_manager._last_run = datetime.now(timezone.utc) - timedelta(hours=1)
        scheduler_manager._last_run_duration = 15.5

        app = create_app()
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            resp = await client.get("/api/v1/system/scheduler/health")

        payload = resp.json()
        assert payload["last_status"] == "error"
        assert payload["last_error"] == "Something went wrong"
        assert payload["is_missed"] is False  # recent enough
        assert payload["last_run_duration_seconds"] == 15.5

        # Reset
        scheduler_manager._last_status = "never_run"
        scheduler_manager._last_error = None
        scheduler_manager._last_run = None
        scheduler_manager._last_run_duration = None

    @pytest.mark.asyncio
    async def test_health_recent_success_not_missed(self):
        """Health endpoint shows not missed when run was recent."""
        from app.main import create_app
        from app.core.scheduler import scheduler_manager

        scheduler_manager._last_status = "success"
        scheduler_manager._last_run = datetime.now(timezone.utc) - timedelta(hours=6)
        scheduler_manager._last_run_duration = 45.2
        scheduler_manager._last_error = None

        app = create_app()
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            resp = await client.get("/api/v1/system/scheduler/health")

        payload = resp.json()
        assert payload["is_missed"] is False
        assert payload["last_status"] == "success"
        assert payload["last_run_duration_seconds"] == 45.2

        # Reset
        scheduler_manager._last_status = "never_run"
        scheduler_manager._last_run = None
        scheduler_manager._last_run_duration = None
        scheduler_manager._last_error = None


# ═══════════════════════════════════════════════════════════════
# Scheduler Singleton Tests
# ═══════════════════════════════════════════════════════════════

class TestSchedulerSingleton:
    """The module-level singleton exists and is usable."""

    def test_singleton_exists(self):
        """Module-level ``scheduler_manager`` is a SchedulerManager instance."""
        from app.core.scheduler import scheduler_manager
        assert isinstance(scheduler_manager, SchedulerManager)

    def test_singleton_initial_state(self):
        """Singleton starts in initial state."""
        from app.core.scheduler import scheduler_manager
        # Reset to initial if tests polluted the state
        scheduler_manager._last_status = "never_run"
        scheduler_manager._last_run = None
        scheduler_manager._last_error = None
        scheduler_manager._last_run_duration = None
        assert scheduler_manager.last_status == "never_run"

    @pytest.mark.asyncio
    async def test_cron_job_id(self, scheduler: SchedulerManager):
        """The daily job is registered with the correct cron ID."""
        scheduler.start()
        assert scheduler._scheduler is not None
        job = scheduler._scheduler.get_job("daily_cron")
        assert job is not None
        assert job.name == "Daily 06:00 field processing"
        # hour field in APScheduler's CronTrigger
        assert job.trigger.fields[3] is not None
        scheduler.shutdown(wait=False)
