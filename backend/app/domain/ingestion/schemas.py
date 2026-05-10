"""
Pydantic schemas for sensor data ingestion, validation, and response.

All sensor values are nullable FLOAT — sensors may not report all metrics
in every reading cycle.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ── Ingress Schemas ────────────────────────────────────────

class SensorReadingCreate(BaseModel):
    """Incoming sensor reading from MQTT or HTTP fallback.

    The ``ts`` field is the sensor's measurement timestamp (ISO 8601).
    All metric fields are nullable since sensors may not report every
    value in every cycle.
    """

    ts: datetime = Field(
        ...,
        description="Sensor measurement timestamp (ISO 8601).",
    )
    sensor_id: UUID = Field(
        ...,
        description="Unique identifier of the sensor device.",
    )
    field_id: UUID = Field(
        ...,
        description="Field this sensor monitors.",
    )
    temp: Optional[float] = Field(
        default=None, ge=-50.0, le=100.0,
        description="Temperature in °C (valid range: -50 to 100).",
    )
    humidity: Optional[float] = Field(
        default=None, ge=0.0, le=100.0,
        description="Relative humidity in % (valid range: 0–100).",
    )
    soil_moisture: Optional[float] = Field(
        default=None, ge=0.0, le=100.0,
        description="Soil moisture in % (valid range: 0–100).",
    )
    rain: Optional[float] = Field(
        default=None, ge=0.0, le=1000.0,
        description="Rainfall in mm (valid range: 0–1000).",
    )

    @field_validator("ts")
    @classmethod
    def ts_not_in_future(cls, v: datetime) -> datetime:
        """Reject timestamps more than 5 minutes in the future.

        A small tolerance (±5 min) is allowed for clock skew between
        the sensor device and the server.
        """
        now = datetime.now(v.tzinfo)
        if v.tzinfo is None:
            now = datetime.now()
        if v > now and (v - now).total_seconds() > 300:
            raise ValueError(
                f"Timestamp {v.isoformat()} is more than 5 minutes in the future. "
                "Check sensor clock synchronization."
            )
        return v


class SensorReadingBulkCreate(BaseModel):
    """Bulk payload for the HTTP fallback endpoint."""

    readings: list[SensorReadingCreate] = Field(
        ..., min_length=1, max_length=1000,
        description="List of sensor readings (1–1000 per request).",
    )


# ── Response Schemas ───────────────────────────────────────

class SensorReadingResponse(BaseModel):
    """A stored sensor reading as returned by the API."""

    time: datetime
    tenant_id: UUID
    sensor_id: UUID
    field_id: UUID
    temp: Optional[float] = None
    humidity: Optional[float] = None
    soil_moisture: Optional[float] = None
    rain: Optional[float] = None
    ingestion_ts: Optional[datetime] = None
    validation_status: str = "valid"

    model_config = {"from_attributes": True}


class SensorReadingSummary(BaseModel):
    """Aggregated sensor statistics for a time window."""

    period_start: datetime
    period_end: datetime
    avg_temp: Optional[float] = None
    avg_humidity: Optional[float] = None
    avg_soil_moisture: Optional[float] = None
    total_rain: Optional[float] = None
    reading_count: int = 0
    sensor_count: int = 0


# ── Poison Pill Schemas ────────────────────────────────────

class PoisonPillResult(BaseModel):
    """Result of a batch ingestion attempt with poison pill handling."""

    total_submitted: int = 0
    stored_count: int = 0
    isolated_count: int = 0
    duplicate_count: int = 0
    isolated_readings: list[dict[str, Any]] = Field(default_factory=list)
    details: str = "OK"
