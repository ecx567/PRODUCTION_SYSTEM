"""
Ingestion service: MQTT message handling, schema validation, poison pill pattern.

The poison pill pattern ensures that a single malformed sensor reading does
NOT corrupt an entire batch:

    1. Try batch INSERT of all readings
    2. If the batch succeeds → done
    3. If the batch fails → fall back to row-by-row INSERT
    4. Rows that fail validation or DB constraints are **isolated** (logged,
       skipped) — all valid rows are preserved
    5. Duplicates are silently ignored via ``ON CONFLICT DO NOTHING`` on the
       unique index ``(time, sensor_id)``
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.ingestion.schemas import (
    PoisonPillResult,
    SensorReadingCreate,
    SensorReadingResponse,
    SensorReadingSummary,
)

logger = logging.getLogger("crop.ingestion.service")


class IngestionService:
    """Handles sensor data ingestion with validation, poison pill, and dedup."""

    # ── Range limits per metric ─────────────────────────────
    RANGE_LIMITS: dict[str, tuple[float, float]] = {
        "temp": (-50.0, 100.0),
        "humidity": (0.0, 100.0),
        "soil_moisture": (0.0, 100.0),
        "rain": (0.0, 1000.0),
    }

    async def handle_mqtt_message(
        self,
        topic: str,
        payload: bytes,
        db: AsyncSession,
    ) -> PoisonPillResult:
        """Parse an incoming MQTT message and persist the reading.

        The ``tenant_id`` and ``sensor_id`` are extracted from the topic path.
        The payload (JSON) is validated against ``SensorReadingCreate``.

        Args:
            topic:   Full MQTT topic (e.g. ``farm/{tenant_id}/sensor/{sensor_id}/data``).
            payload: Raw bytes from the MQTT broker.
            db:      Async SQLAlchemy session.

        Returns:
            ``PoisonPillResult`` with counts of stored / isolated / duplicate readings.
        """
        raw_tenant_id = self._extract_tenant_id(topic)
        if not raw_tenant_id:
            raise ValueError(
                f"Cannot extract tenant_id from topic: {topic}",
            )
        try:
            tenant_id = UUID(raw_tenant_id)
        except ValueError:
            raise ValueError(
                f"Invalid tenant_id UUID format in topic: {topic}",
            )

        try:
            data = json.loads(payload)
        except json.JSONDecodeError as exc:
            logger.warning("Invalid JSON payload on %s: %s", topic, exc)
            return PoisonPillResult(
                total_submitted=1, stored_count=0, isolated_count=1,
                isolated_readings=[{"topic": topic, "error": f"Invalid JSON: {exc}"}],
                details="Invalid JSON payload",
            )

        # Inject topic-derived fields if not already present
        sensor_id = self._extract_sensor_id(topic)
        if sensor_id:
            data.setdefault("sensor_id", sensor_id)
        data.setdefault("tenant_id", str(tenant_id))

        try:
            reading = SensorReadingCreate(**data)
        except ValidationError as exc:
            logger.warning("Schema validation failed on %s: %s", topic, exc)
            return PoisonPillResult(
                total_submitted=1, stored_count=0, isolated_count=1,
                isolated_readings=[{"topic": topic, "errors": exc.errors(include_input=True)}],
                details="Schema validation failed",
            )

        return await self.ingest_batch([reading], tenant_id, db)

    async def ingest_batch(
        self,
        readings: list[SensorReadingCreate],
        tenant_id: UUID | str,
        db: AsyncSession,
    ) -> PoisonPillResult:
        """Persist a batch of sensor readings using the poison pill pattern.

        Poison pill flow:

        1. **Batch attempt** — single multi-row INSERT
        2. On **IntegrityError / DataError** → fallback row-by-row
        3. Each failing row is **isolated** (logged, skipped)
        4. Non-failing rows are **stored**
        5. **Duplicates** are ignored via ``ON CONFLICT DO NOTHING``

        Args:
            readings:   List of validated sensor readings.
            tenant_id:  Tenant UUID (from topic or auth context).
            db:         Async SQLAlchemy session.

        Returns:
            ``PoisonPillResult`` with detailed counts.
        """
        result = PoisonPillResult(total_submitted=len(readings))

        # ── Step 1: Batch attempt ───────────────────────────
        if not readings:
            return result

        tenant_uuid = UUID(str(tenant_id)) if isinstance(tenant_id, str) else tenant_id
        now = datetime.now(timezone.utc)

        values: list[dict[str, Any]] = []
        for r in readings:
            signal_quality = self._compute_signal_quality(r)
            values.append({
                "time": r.ts,
                "tenant_id": tenant_uuid,
                "sensor_id": r.sensor_id,
                "field_id": r.field_id,
                "temp": r.temp,
                "humidity": r.humidity,
                "soil_moisture": r.soil_moisture,
                "rain": r.rain,
                "ingestion_ts": now,
                "validation_status": "valid",
                "signal_quality": json.dumps(signal_quality),
            })

        try:
            stored = await self._execute_batch_insert(db, values)
            result.stored_count = stored
            result.details = f"Batch insert: {stored} rows stored."
            logger.info("Batch insert: %d/%d rows stored.", stored, len(values))
            return result
        except Exception as batch_exc:
            logger.warning(
                "Batch insert failed (%s). Falling back to row-by-row...",
                batch_exc,
            )

        # ── Step 2: Row-by-row fallback (poison pill) ───────
        stored_count = 0
        isolated_count = 0
        duplicate_count = 0
        isolated_readings: list[dict[str, Any]] = []

        for row in values:
            try:
                inserted = await self._execute_batch_insert(db, [row])
                if inserted > 0:
                    stored_count += 1
                else:
                    duplicate_count += 1
            except Exception as row_exc:
                isolated_count += 1
                isolated_readings.append({
                    "sensor_id": str(row["sensor_id"]),
                    "time": row["time"].isoformat(),
                    "error": str(row_exc),
                })
                logger.warning(
                    "Isolated sensor reading: sensor=%s time=%s error=%s",
                    row["sensor_id"], row["time"], row_exc,
                )

        result.stored_count = stored_count
        result.isolated_count = isolated_count
        result.duplicate_count = duplicate_count
        result.isolated_readings = isolated_readings
        result.details = (
            f"Row-by-row fallback: {stored_count} stored, "
            f"{duplicate_count} duplicates ignored, "
            f"{isolated_count} isolated."
        )
        logger.info(
            "Ingestion complete: %d stored, %d dupes, %d isolated.",
            stored_count, duplicate_count, isolated_count,
        )
        return result

    # ── Query methods ───────────────────────────────────────

    async def get_latest_readings(
        self,
        field_id: UUID | str,
        tenant_id: UUID | str,
        db: AsyncSession,
        limit: int = 50,
    ) -> list[SensorReadingResponse]:
        """Return the latest sensor reading per unique sensor in a field.

        Uses a DISTINCT ON query to get the most recent reading for each sensor.
        """
        stmt = text("""
            SELECT DISTINCT ON (sr.sensor_id)
                sr.time,
                sr.tenant_id,
                sr.sensor_id,
                sr.field_id,
                sr.temp,
                sr.humidity,
                sr.soil_moisture,
                sr.rain,
                sr.ingestion_ts,
                sr.validation_status
            FROM sensor_readings sr
            WHERE sr.field_id = :field_id
              AND sr.tenant_id = :tenant_id
              AND sr.validation_status = 'valid'
            ORDER BY sr.sensor_id, sr.time DESC
            LIMIT :limit
        """)
        result = await db.execute(
            stmt,
            {
                "field_id": field_id,
                "tenant_id": tenant_id,
                "limit": limit,
            },
        )
        rows = result.fetchall()
        return [SensorReadingResponse.model_validate(row._mapping) for row in rows]

    async def get_history(
        self,
        field_id: UUID | str,
        tenant_id: UUID | str,
        db: AsyncSession,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> list[SensorReadingResponse]:
        """Return sensor reading history for a field with optional time range."""
        conditions = [
            "sr.field_id = :field_id",
            "sr.tenant_id = :tenant_id",
            "sr.validation_status = 'valid'",
        ]
        params: dict[str, Any] = {
            "field_id": field_id,
            "tenant_id": tenant_id,
            "limit": limit,
            "offset": offset,
        }

        if start_time:
            conditions.append("sr.time >= :start_time")
            params["start_time"] = start_time
        if end_time:
            conditions.append("sr.time <= :end_time")
            params["end_time"] = end_time

        where_clause = " AND ".join(conditions)
        stmt = text(f"""
            SELECT sr.time, sr.tenant_id, sr.sensor_id, sr.field_id,
                   sr.temp, sr.humidity, sr.soil_moisture, sr.rain,
                   sr.ingestion_ts, sr.validation_status
            FROM sensor_readings sr
            WHERE {where_clause}
            ORDER BY sr.time DESC
            LIMIT :limit OFFSET :offset
        """)
        result = await db.execute(stmt, params)
        rows = result.fetchall()
        return [SensorReadingResponse.model_validate(row._mapping) for row in rows]

    # ── Internal helpers ────────────────────────────────────

    async def _execute_batch_insert(
        self,
        db: AsyncSession,
        values: list[dict[str, Any]],
    ) -> int:
        """Execute a multi-row INSERT with ``ON CONFLICT DO NOTHING``.

        Returns the number of rows actually inserted (excludes duplicates).
        """
        if not values:
            return 0

        # Build multi-row VALUES clause (CAST avoids PostgreSQL :: syntax
        # which conflicts with asyncpg's named-parameter conversion).
        placeholders = ", ".join(
            f"(:time_{i}, :tenant_id_{i}, :sensor_id_{i}, :field_id_{i}, "
            f":temp_{i}, :humidity_{i}, :soil_moisture_{i}, :rain_{i}, "
            f":ingestion_ts_{i}, :validation_status_{i}, "
            f"CAST(:signal_quality_{i} AS jsonb))"
            for i in range(len(values))
        )

        flat_params: dict[str, Any] = {}
        for i, row in enumerate(values):
            flat_params[f"time_{i}"] = row["time"]
            flat_params[f"tenant_id_{i}"] = row["tenant_id"]
            flat_params[f"sensor_id_{i}"] = row["sensor_id"]
            flat_params[f"field_id_{i}"] = row["field_id"]
            flat_params[f"temp_{i}"] = row["temp"]
            flat_params[f"humidity_{i}"] = row["humidity"]
            flat_params[f"soil_moisture_{i}"] = row["soil_moisture"]
            flat_params[f"rain_{i}"] = row["rain"]
            flat_params[f"ingestion_ts_{i}"] = row["ingestion_ts"]
            flat_params[f"validation_status_{i}"] = row["validation_status"]
            flat_params[f"signal_quality_{i}"] = row.get("signal_quality", "{}")

        stmt = text(f"""
            INSERT INTO sensor_readings
                (time, tenant_id, sensor_id, field_id,
                 temp, humidity, soil_moisture, rain,
                 ingestion_ts, validation_status, signal_quality)
            VALUES {placeholders}
            ON CONFLICT ON CONSTRAINT uq_sensor_readings_time_sensor
            DO NOTHING
        """)
        result = await db.execute(stmt, flat_params)
        await db.commit()
        return result.rowcount

    @staticmethod
    def _extract_tenant_id(topic: str) -> str | None:
        """Extract tenant_id from an MQTT topic.

        Expected format: ``farm/{tenant_id}/sensor/{sensor_id}/data``
        """
        parts = topic.split("/")
        if len(parts) >= 2 and parts[0] == "farm":
            return parts[1]
        return None

    @staticmethod
    def _extract_sensor_id(topic: str) -> str | None:
        """Extract sensor_id from an MQTT topic.

        Expected format: ``farm/{tenant_id}/sensor/{sensor_id}/data``
        """
        parts = topic.split("/")
        if len(parts) >= 4 and parts[0] == "farm" and parts[2] == "sensor":
            return parts[3]
        return None

    @staticmethod
    def _compute_signal_quality(reading: SensorReadingCreate) -> dict[str, Any]:
        """Compute signal quality metadata for a reading.

        Returns a dict with flags indicating which metrics are present and
        whether values are within the expected range.
        """
        quality: dict[str, Any] = {
            "metrics_present": [],
            "metrics_out_of_range": [],
        }

        for field_name in ("temp", "humidity", "soil_moisture", "rain"):
            value = getattr(reading, field_name, None)
            if value is not None:
                quality["metrics_present"].append(field_name)
                limits = IngestionService.RANGE_LIMITS.get(field_name)
                if limits and (value < limits[0] or value > limits[1]):
                    quality["metrics_out_of_range"].append({
                        "metric": field_name,
                        "value": value,
                        "range": list(limits),
                    })

        quality["all_metrics_present"] = len(quality["metrics_present"]) == 4
        quality["any_out_of_range"] = len(quality["metrics_out_of_range"]) > 0

        # Overall quality score: 1.0 - penalty for missing metrics
        missing_penalty = (4 - len(quality["metrics_present"])) * 0.1
        range_penalty = len(quality["metrics_out_of_range"]) * 0.15
        quality["score"] = round(max(0.0, 1.0 - missing_penalty - range_penalty), 2)

        return quality
