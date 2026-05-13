"""
APScheduler management for daily 06:00 crop processing jobs.

Uses ``AsyncIOScheduler`` to integrate with FastAPI's async event loop.
The scheduler is started during the application lifespan (``app/main.py``)
and runs a daily batch job that processes all active fields.

Health tracking (``GET /api/v1/system/scheduler/health``):
    - ``last_run`` — datetime of the most recent job execution
    - ``last_status`` — ``never_run`` | ``running`` | ``success`` | ``error``
    - ``last_error`` — error message from the most recent failure (null if OK)
    - ``is_missed`` — ``True`` if no successful run in ≥25 hours
    - ``last_run_duration_seconds`` — how long the last run took

Graceful shutdown: call ``shutdown()`` during the FastAPI lifespan teardown.

Edge cases:
    - No fields: job logs a message and returns cleanly
    - Single-field failure: caught, logged, batch continues (R2, R3 scheduler spec)
    - DB unavailable: caught at the field level, logged
    - Missed runs: ``coalesce=True`` merges missed runs, 1h misfire grace
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from app.domain.ingestion.service import IngestionService
from app.domain.recommendations.service import RecommendationService, _parse_wkt_point
from app.domain.analytics.predictions import PredictionService

logger = logging.getLogger("crop.scheduler")

# Constants
_MISSED_THRESHOLD_HOURS = 25


def _days_since_planting(planted_at: datetime | date | None) -> int:
    """Calculate days since planting. Returns 0 when None."""
    if planted_at is None:
        return 0
    if isinstance(planted_at, datetime):
        planted_at = planted_at.date()
    delta = datetime.now(timezone.utc).date() - planted_at
    return max(0, delta.days)


def _reading_to_dict(r: Any) -> dict[str, Any]:
    """Convert a SensorReadingResponse to the dict format expected by services."""
    return {
        "temp": r.temp,
        "humidity": r.humidity,
        "soil_moisture": r.soil_moisture,
        "rain": r.rain,
    }


# ═══════════════════════════════════════════════════════════════
# Scheduler Manager
# ═══════════════════════════════════════════════════════════════


class SchedulerManager:
    """APScheduler lifecycle and health tracking.

    Usage (in ``main.py`` lifespan)::

        scheduler = SchedulerManager()
        scheduler.start()          # startup
        # ...
        scheduler.shutdown()       # shutdown
    """

    def __init__(self) -> None:
        self._scheduler: AsyncIOScheduler | None = None
        self._last_run: datetime | None = None
        self._last_status: str = "never_run"
        self._last_error: str | None = None
        self._last_run_duration: float | None = None

    # ── Public properties ─────────────────────────────────────

    @property
    def is_running(self) -> bool:
        """True while the scheduler is active."""
        return self._scheduler is not None and self._scheduler.running

    @property
    def last_run(self) -> datetime | None:
        return self._last_run

    @property
    def last_status(self) -> str:
        return self._last_status

    @property
    def last_error(self) -> str | None:
        return self._last_error

    @property
    def is_missed(self) -> bool:
        """Return True if no successful run in ≥25 hours.

        ``never_run`` returns False — the app may have just started.
        """
        if self._last_status == "never_run":
            return False
        if self._last_run is None:
            return False
        elapsed = datetime.now(timezone.utc) - self._last_run
        return elapsed >= timedelta(hours=_MISSED_THRESHOLD_HOURS)

    # ── Lifecycle ─────────────────────────────────────────────

    def start(self) -> None:
        """Start the scheduler with a daily 06:00 cron job.

        Safe to call multiple times — logs a warning if already running.
        """
        if self._scheduler is not None and self._scheduler.running:
            logger.warning("Scheduler is already running — ignoring duplicate start")
            return

        self._scheduler = AsyncIOScheduler(
            job_defaults={
                "coalesce": True,
                "max_instances": 1,
                "misfire_grace_time": 3600,
            },
        )

        self._scheduler.add_job(
            self._execute_daily_job,
            CronTrigger(hour=6, minute=0),
            id="daily_cron",
            name="Daily 06:00 field processing",
            replace_existing=True,
        )

        self._scheduler.start()
        logger.info("Scheduler started — daily 06:00 cron active")

    def shutdown(self, wait: bool = True) -> None:
        """Gracefully shut down the scheduler. Blocks until jobs finish when wait=True."""
        if self._scheduler is not None and self._scheduler.running:
            self._scheduler.shutdown(wait=wait)
            logger.info("Scheduler shut down gracefully")

    # ── Health report ─────────────────────────────────────────

    def health_dict(self) -> dict[str, Any]:
        """Return a health-status dict for the ``/health`` endpoint."""
        return {
            "is_running": self.is_running,
            "last_run": self._last_run.isoformat() if self._last_run else None,
            "last_status": self._last_status,
            "last_error": self._last_error,
            "last_run_duration_seconds": self._last_run_duration,
            "is_missed": self.is_missed,
        }

    # ═══════════════════════════════════════════════════════════
    # Daily Job
    # ═══════════════════════════════════════════════════════════

    def _execute_daily_job(self) -> None:
        """Synchronous entry point for APScheduler.

        Creates a new event loop to run the async job, then updates health
        tracking. This is the ``callable`` passed to ``add_job()``.
        """
        import asyncio

        self._last_status = "running"
        start = datetime.now(timezone.utc)

        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(self._run_daily_job())
            finally:
                loop.close()

            self._last_status = "success"
            self._last_error = None
        except Exception as exc:
            self._last_status = "error"
            self._last_error = str(exc)
            logger.exception("Daily job failed: %s", exc)

        self._last_run = datetime.now(timezone.utc)
        self._last_run_duration = round(
            (self._last_run - start).total_seconds(), 2,
        )
        logger.info(
            "Daily job finished: status=%s duration=%.1fs",
            self._last_status, self._last_run_duration,
        )

    async def _run_daily_job(self) -> None:
        """Main daily processing — iterate all active fields.

        Late-imports heavy modules so the scheduler starts fast.
        """
        from app.core.database import db as db_manager
        from app.domain.weather.service import WeatherService
        from app.domain.crop_profiles.service import get_profile_loader
        from app.domain.notifications.service import NotificationService
        from app.core.redis import redis_manager

        # ── Initialize services ──────────────────────────────
        ingestion_service = IngestionService()

        redis_client = redis_manager.client if redis_manager.is_initialized else None
        weather_service = WeatherService(redis=redis_client)

        recommendation_service = RecommendationService(
            profile_loader=get_profile_loader(),
            weather_service=weather_service,
            notification_service=NotificationService(),
        )

        prediction_service = PredictionService()
        await prediction_service.load_model()

        # ── Get all active fields ────────────────────────────
        factory = db_manager.get_session_factory()
        async with factory() as db:
            result = await db.execute(
                text("""
                    SELECT id, tenant_id, crop_type, planted_at, area_ha, location
                    FROM fields
                    WHERE deleted_at IS NULL
                """),
            )
            fields = result.fetchall()

        if not fields:
            logger.info("No active fields found — skipping daily job")
            return

        logger.info("Daily job processing %d fields", len(fields))

        # ── Process each field (single-field failure OK) ─────
        for field_row in fields:
            try:
                async with factory() as db:
                    await self._process_field(
                        db=db,
                        field_id=field_row.id,
                        tenant_id=field_row.tenant_id,
                        crop_type=field_row.crop_type,
                        planted_at=field_row.planted_at,
                        area_ha=field_row.area_ha,
                        location=field_row.location,
                        ingestion_service=ingestion_service,
                        recommendation_service=recommendation_service,
                        prediction_service=prediction_service,
                        weather_service=weather_service,
                    )
            except Exception:
                logger.exception(
                    "Daily job: field %s (crop=%s) failed — continuing batch",
                    field_row.id, field_row.crop_type,
                )
                continue

        logger.info("Daily job completed for all fields")

    # ═══════════════════════════════════════════════════════════
    # Per-field Processing
    # ═══════════════════════════════════════════════════════════

    async def _process_field(
        self,
        db: Any,
        field_id: UUID,
        tenant_id: UUID,
        crop_type: str,
        planted_at: datetime | None,
        area_ha: float,
        location: str | None,
        ingestion_service: IngestionService,
        recommendation_service: RecommendationService,
        prediction_service: PredictionService,
        weather_service: Any,
    ) -> None:
        """Process a single field: readings → forecast → recs → prediction → store.

        Every exception propagates up so the batch loop can catch and continue.
        """
        logger.debug("Processing field %s (crop=%s)", field_id, crop_type)

        # ── Days since planting ──────────────────────────────
        days_since_planting = _days_since_planting(planted_at)

        # ── Parse location for forecast ──────────────────────
        lat, lon = None, None
        if location:
            coords = _parse_wkt_point(location)
            if coords:
                lon, lat = coords  # WKT is POINT(lon lat)

        # ── Fetch sensor readings (last 72h) ─────────────────
        cutoff = datetime.now(timezone.utc) - timedelta(hours=72)
        readings = await ingestion_service.get_history(
            field_id=field_id,
            tenant_id=tenant_id,
            db=db,
            start_time=cutoff,
            limit=500,
        )

        if not readings:
            logger.warning(
                "No sensor readings for field %s in last 72h "
                "— recommendations may be limited or unavailable",
                field_id,
            )

        # Convert to dicts for the recommendation service
        reading_dicts = [_reading_to_dict(r) for r in readings]

        # ── Compute recommendation summary ───────────────────
        summary = await recommendation_service.get_summary(
            field_id=field_id,
            crop_type=crop_type,
            days_since_planting=days_since_planting,
            sensor_readings=reading_dicts,
            db=db,
            tenant_id=tenant_id,
            lat=lat,
            lon=lon,
        )

        # ── Compute yield prediction ─────────────────────────
        prediction = await prediction_service.predict_yield(
            field_id=field_id,
            crop_type=crop_type,
            days_since_planting=days_since_planting,
            readings=readings,
            area_ha=area_ha,
        )

        # ── Store results (single commit per field) ──────────
        try:
            await self._store_recommendations(db, field_id, summary)
            await self._store_prediction(db, field_id, prediction)
            await db.commit()
        except Exception:
            await db.rollback()
            raise

    # ═══════════════════════════════════════════════════════════
    # Persistence
    # ═══════════════════════════════════════════════════════════

    @staticmethod
    async def _store_recommendations(
        db: Any,
        field_id: UUID,
        summary: Any,
    ) -> None:
        """Insert irrigation, fertilization, and pest_risk recommendations.

        Each recommendation type is stored as a separate row in the
        ``recommendations`` table with its payload serialised to JSON.
        """
        now = datetime.now(timezone.utc)

        # ── Irrigation ────────────────────────────────────────
        if summary.irrigation is not None:
            severity = _irrigation_severity(summary.irrigation)
            await db.execute(
                text("""
                    INSERT INTO recommendations
                        (field_id, type, payload, generated_at, status, severity)
                    VALUES
                        (:field_id, 'irrigation', :payload, :generated_at, 'active', :severity)
                """),
                {
                    "field_id": field_id,
                    "payload": json.dumps(summary.irrigation.model_dump(), default=str),
                    "generated_at": now,
                    "severity": severity,
                },
            )

        # ── Fertilization ─────────────────────────────────────
        if summary.fertilization is not None:
            await db.execute(
                text("""
                    INSERT INTO recommendations
                        (field_id, type, payload, generated_at, status, severity)
                    VALUES
                        (:field_id, 'fertilization', :payload, :generated_at, 'active', :severity)
                """),
                {
                    "field_id": field_id,
                    "payload": json.dumps(summary.fertilization.model_dump(), default=str),
                    "generated_at": now,
                    "severity": "info",
                },
            )

        # ── Pest risk (one row per alert) ─────────────────────
        for alert in summary.pest_risk:
            risk_severity = _pest_severity(alert.risk_level)
            await db.execute(
                text("""
                    INSERT INTO recommendations
                        (field_id, type, payload, generated_at, status, severity)
                    VALUES
                        (:field_id, 'pest_risk', :payload, :generated_at, 'active', :severity)
                """),
                {
                    "field_id": field_id,
                    "payload": json.dumps(alert.model_dump(), default=str),
                    "generated_at": now,
                    "severity": risk_severity,
                },
            )

    @staticmethod
    async def _store_prediction(
        db: Any,
        field_id: UUID,
        prediction: Any,
    ) -> None:
        """Insert a yield prediction into the ``predictions`` table."""
        await db.execute(
            text("""
                INSERT INTO predictions
                    (field_id, type, value, lower_bound, upper_bound,
                     model_version, data_quality, features_used, generated_at)
                VALUES
                    (:field_id, 'yield', :value, :lower_bound, :upper_bound,
                     :model_version, :data_quality, :features_used, :generated_at)
            """),
            {
                "field_id": field_id,
                "value": prediction.predicted_yield_kg_ha,
                "lower_bound": prediction.lower_bound,
                "upper_bound": prediction.upper_bound,
                "model_version": prediction.model_version,
                "data_quality": prediction.data_quality,
                "features_used": json.dumps(prediction.features_used),
                "generated_at": prediction.generated_at,
            },
        )


# ── Severity helpers ─────────────────────────────────────────


def _irrigation_severity(irrigation: Any) -> str:
    """Map irrigation recommendation to a severity level."""
    if irrigation.recommendation == "water" and irrigation.depletion_percent >= 80:
        return "high"
    elif irrigation.recommendation == "water":
        return "medium"
    elif irrigation.recommendation == "monitor":
        return "low"
    return "info"


def _pest_severity(risk_level: str) -> str:
    """Map pest risk level to recommendation severity."""
    if risk_level in ("low", "medium", "high"):
        return risk_level
    return "info"


# Module-level singleton
scheduler_manager = SchedulerManager()
