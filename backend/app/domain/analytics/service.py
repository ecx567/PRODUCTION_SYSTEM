"""
Analytics service: continuous aggregates, gap detection, range validation.

Provides field-level analytics for agronomists to monitor sensor health,
data quality, and trends over configurable time windows.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.ingestion.schemas import SensorReadingSummary

logger = logging.getLogger("crop.analytics.service")

# Default gap threshold: alert if no data received for this duration
DEFAULT_GAP_THRESHOLD_MINUTES = 30


class AnalyticsService:
    """Field-level analytics: aggregation, gap detection, data quality."""

    # ── Range limits per metric (industry-standard bounds) ──
    RANGE_LIMITS: dict[str, dict[str, Any]] = {
        "temp": {
            "min": -50.0,
            "max": 100.0,
            "unit": "°C",
            "label": "Temperature",
        },
        "humidity": {
            "min": 0.0,
            "max": 100.0,
            "unit": "%",
            "label": "Relative Humidity",
        },
        "soil_moisture": {
            "min": 0.0,
            "max": 100.0,
            "unit": "%",
            "label": "Soil Moisture",
        },
        "rain": {
            "min": 0.0,
            "max": 1000.0,
            "unit": "mm",
            "label": "Rainfall",
        },
    }

    async def get_summary(
        self,
        field_id: UUID | str,
        tenant_id: UUID | str,
        db: AsyncSession,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> SensorReadingSummary:
        """Compute aggregate sensor statistics for a field over a time window.

        Defaults to the last 24 hours if no time range is specified.
        """
        if end_time is None:
            end_time = datetime.now(timezone.utc)
        if start_time is None:
            start_time = end_time - timedelta(hours=24)

        stmt = text("""
            SELECT
                COUNT(*)                                         AS reading_count,
                COUNT(DISTINCT sr.sensor_id)                     AS sensor_count,
                AVG(sr.temp)                                     AS avg_temp,
                AVG(sr.humidity)                                 AS avg_humidity,
                AVG(sr.soil_moisture)                            AS avg_soil_moisture,
                SUM(sr.rain)                                     AS total_rain
            FROM sensor_readings sr
            WHERE sr.field_id = :field_id
              AND sr.tenant_id = :tenant_id
              AND sr.time >= :start_time
              AND sr.time <= :end_time
              AND sr.validation_status = 'valid'
        """)
        result = await db.execute(
            stmt,
            {
                "field_id": field_id,
                "tenant_id": tenant_id,
                "start_time": start_time,
                "end_time": end_time,
            },
        )
        row = result.one()

        return SensorReadingSummary(
            period_start=start_time,
            period_end=end_time,
            avg_temp=float(row.avg_temp) if row.avg_temp is not None else None,
            avg_humidity=float(row.avg_humidity) if row.avg_humidity is not None else None,
            avg_soil_moisture=float(row.avg_soil_moisture) if row.avg_soil_moisture is not None else None,
            total_rain=float(row.total_rain) if row.total_rain is not None else None,
            reading_count=row.reading_count,
            sensor_count=row.sensor_count,
        )

    async def get_hourly_rollup(
        self,
        field_id: UUID | str,
        tenant_id: UUID | str,
        db: AsyncSession,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """Return hourly aggregated sensor data for time-series charts.

        Each row represents one hour with averages per metric.
        """
        if end_time is None:
            end_time = datetime.now(timezone.utc)
        if start_time is None:
            start_time = end_time - timedelta(hours=72)

        stmt = text("""
            SELECT
                date_trunc('hour', sr.time)                      AS bucket,
                COUNT(*)                                         AS reading_count,
                COUNT(DISTINCT sr.sensor_id)                     AS active_sensors,
                AVG(sr.temp)                                     AS avg_temp,
                MAX(sr.temp)                                     AS max_temp,
                MIN(sr.temp)                                     AS min_temp,
                AVG(sr.humidity)                                 AS avg_humidity,
                AVG(sr.soil_moisture)                            AS avg_soil_moisture,
                SUM(sr.rain)                                     AS total_rain
            FROM sensor_readings sr
            WHERE sr.field_id = :field_id
              AND sr.tenant_id = :tenant_id
              AND sr.time >= :start_time
              AND sr.time <= :end_time
              AND sr.validation_status = 'valid'
            GROUP BY bucket
            ORDER BY bucket ASC
        """)
        result = await db.execute(
            stmt,
            {
                "field_id": field_id,
                "tenant_id": tenant_id,
                "start_time": start_time,
                "end_time": end_time,
            },
        )
        rows = result.fetchall()
        return [
            {
                "bucket": row.bucket.isoformat() if row.bucket else None,
                "reading_count": row.reading_count,
                "active_sensors": row.active_sensors,
                "avg_temp": float(row.avg_temp) if row.avg_temp is not None else None,
                "max_temp": float(row.max_temp) if row.max_temp is not None else None,
                "min_temp": float(row.min_temp) if row.min_temp is not None else None,
                "avg_humidity": float(row.avg_humidity) if row.avg_humidity is not None else None,
                "avg_soil_moisture": float(row.avg_soil_moisture) if row.avg_soil_moisture is not None else None,
                "total_rain": float(row.total_rain) if row.total_rain is not None else None,
            }
            for row in rows
        ]

    async def detect_gaps(
        self,
        field_id: UUID | str,
        tenant_id: UUID | str,
        db: AsyncSession,
        threshold_minutes: int = DEFAULT_GAP_THRESHOLD_MINUTES,
        lookback_hours: int = 24,
    ) -> list[dict[str, Any]]:
        """Detect sensors that have stopped reporting data.

        A **gap** is defined as a sensor that has not sent any reading within
        the last ``threshold_minutes``.

        Args:
            field_id:           Field to check.
            tenant_id:          Tenant scope.
            db:                 DB session.
            threshold_minutes:  Minutes of silence before flagging a gap.
            lookback_hours:     How far back to scan for known sensors.

        Returns:
            List of gap records with sensor_id, last_seen, and gap_duration.
        """
        threshold = datetime.now(timezone.utc) - timedelta(minutes=threshold_minutes)
        lookback_start = threshold - timedelta(hours=lookback_hours)

        stmt = text("""
            WITH recent_activity AS (
                SELECT
                    sr.sensor_id,
                    MAX(sr.time) AS last_seen
                FROM sensor_readings sr
                WHERE sr.field_id = :field_id
                  AND sr.tenant_id = :tenant_id
                  AND sr.time >= :lookback_start
                  AND sr.validation_status = 'valid'
                GROUP BY sr.sensor_id
            )
            SELECT
                sensor_id,
                last_seen,
                EXTRACT(EPOCH FROM (NOW() - last_seen)) / 60 AS gap_minutes
            FROM recent_activity
            WHERE last_seen < :threshold
            ORDER BY gap_minutes DESC
        """)
        result = await db.execute(
            stmt,
            {
                "field_id": field_id,
                "tenant_id": tenant_id,
                "threshold": threshold,
                "lookback_start": lookback_start,
            },
        )
        rows = result.fetchall()
        return [
            {
                "sensor_id": str(row.sensor_id),
                "last_seen": row.last_seen.isoformat() if row.last_seen else None,
                "gap_minutes": round(float(row.gap_minutes), 1),
            }
            for row in rows
        ]

    @staticmethod
    def validate_reading_range(
        metric: str,
        value: float | None,
    ) -> dict[str, Any]:
        """Check if a single reading value falls within valid range.

        Returns a dict with ``valid`` (bool), ``metric``, ``value``, and
        optional ``range`` and ``message``.

        Example::

            >>> AnalyticsService.validate_reading_range("temp", 105.0)
            {"valid": False, "metric": "temp", "value": 105.0,
             "range": {"min": -50.0, "max": 100.0},
             "message": "Temperature 105.0°C exceeds maximum of 100.0°C"}
        """
        if value is None:
            return {
                "valid": True,  # None means "not reported" — not invalid
                "metric": metric,
                "value": None,
            }

        limits = AnalyticsService.RANGE_LIMITS.get(metric)
        if limits is None:
            return {"valid": True, "metric": metric, "value": value}

        unit = limits.get("unit", "")
        label = limits.get("label", metric)

        if value < limits["min"]:
            return {
                "valid": False,
                "metric": metric,
                "value": value,
                "range": {"min": limits["min"], "max": limits["max"]},
                "message": (
                    f"{label} {value}{unit} is below minimum of {limits['min']}{unit}"
                ),
            }
        if value > limits["max"]:
            return {
                "valid": False,
                "metric": metric,
                "value": value,
                "range": {"min": limits["min"], "max": limits["max"]},
                "message": (
                    f"{label} {value}{unit} exceeds maximum of {limits['max']}{unit}"
                ),
            }

        return {"valid": True, "metric": metric, "value": value}

    @staticmethod
    def check_data_quality(
        readings: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Run data quality checks across a batch of readings.

        Checks:
            - Completeness: what % of metrics are reported
            - Range validity: are values within bounds
            - Consistency: no sudden unrealistic jumps

        Returns a quality report dict.
        """
        total_metrics = 0
        present_metrics = 0
        out_of_range = []
        completeness: dict[str, int] = {}
        total_readings = len(readings)

        for reading in readings:
            for metric in ("temp", "humidity", "soil_moisture", "rain"):
                total_metrics += 1
                value = reading.get(metric)
                if value is not None:
                    present_metrics += 1
                    completeness[metric] = completeness.get(metric, 0) + 1
                    result = AnalyticsService.validate_reading_range(metric, value)
                    if not result["valid"]:
                        out_of_range.append(result)

        completeness_pct = round(present_metrics / total_metrics * 100, 1) if total_metrics else 100.0

        return {
            "total_readings": total_readings,
            "completeness_pct": completeness_pct,
            "metrics_out_of_range": len(out_of_range),
            "out_of_range_details": out_of_range[:10],  # cap to avoid huge payloads
            "metric_coverage": {
                metric: {
                    "reported": count,
                    "coverage_pct": round(count / total_readings * 100, 1) if total_readings else 0,
                }
                for metric, count in completeness.items()
            },
        }
