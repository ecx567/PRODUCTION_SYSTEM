"""
REST API endpoints for field analytics.

Endpoints:
    - ``GET /api/v1/fields/{id}/analytics/summary`` — aggregates per time window
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domain.auth.middleware import (
    AuthPayload,
    RoleChecker,
    get_current_user,
)
from app.domain.analytics.service import AnalyticsService
from app.domain.ingestion.schemas import SensorReadingSummary

logger = logging.getLogger("crop.api.analytics")

router = APIRouter(tags=["Analytics"])

# ── Role guards ─────────────────────────────────────────────
agronomist_or_higher = RoleChecker("agronomist", "admin")

# Singleton service
_analytics_service = AnalyticsService()


# ── GET /api/v1/fields/{id}/analytics/summary ───────────────

@router.get(
    "/fields/{field_id}/analytics/summary",
    response_model=SensorReadingSummary,
    summary="Aggregated sensor statistics for a field",
)
async def get_field_analytics_summary(
    field_id: UUID,
    current_user: Annotated[AuthPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    start_time: datetime | None = Query(
        default=None,
        description="Start of analysis window (ISO 8601). Defaults to 24 hours ago.",
    ),
    end_time: datetime | None = Query(
        default=None,
        description="End of analysis window (ISO 8601). Defaults to now.",
    ),
) -> SensorReadingSummary:
    """Compute aggregate sensor statistics for a field over a configurable time window.

    Returns:
        - ``avg_temp`` / ``avg_humidity`` / ``avg_soil_moisture``
        - ``total_rain``
        - ``reading_count`` — total readings in window
        - ``sensor_count`` — unique sensors reporting

    Defaults to the last **24 hours** if no time range is specified.
    Requires **agronomist** or **admin** role.
    """
    tenant_id = UUID(current_user.tenant_id)
    summary = await _analytics_service.get_summary(
        field_id=field_id,
        tenant_id=tenant_id,
        db=db,
        start_time=start_time,
        end_time=end_time,
    )
    return summary


# ── GET /api/v1/fields/{id}/analytics/hourly ─────────────────

@router.get(
    "/fields/{field_id}/analytics/hourly",
    summary="Hourly aggregated time-series data",
)
async def get_hourly_aggregates(
    field_id: UUID,
    current_user: Annotated[AuthPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    start_time: datetime | None = Query(
        default=None,
        description="Start of window (ISO 8601). Defaults to 72 hours ago.",
    ),
    end_time: datetime | None = Query(
        default=None,
        description="End of window (ISO 8601). Defaults to now.",
    ),
) -> list[dict]:
    """Return hourly-bucketed sensor averages for time-series charting.

    Useful for rendering line charts in the dashboard. Returns one row
    per hour with avg/min/max temperature, avg humidity, and total rain.
    """
    tenant_id = UUID(current_user.tenant_id)
    rollup = await _analytics_service.get_hourly_rollup(
        field_id=field_id,
        tenant_id=tenant_id,
        db=db,
        start_time=start_time,
        end_time=end_time,
    )
    return rollup


# ── GET /api/v1/fields/{id}/analytics/gaps ──────────────────

@router.get(
    "/fields/{field_id}/analytics/gaps",
    summary="Detect sensors with missing data",
)
async def get_sensor_gaps(
    field_id: UUID,
    current_user: Annotated[AuthPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    threshold_minutes: int = Query(
        default=30,
        ge=1,
        le=1440,
        description="Minutes of silence before flagging a gap.",
    ),
) -> list[dict]:
    """Detect field sensors that have stopped reporting data.

    A **gap** is flagged when a sensor has not sent any valid reading
    within the last ``threshold_minutes``. Returns each gap with:
        - ``sensor_id``
        - ``last_seen`` timestamp
        - ``gap_minutes`` — how long since the last reading
    """
    tenant_id = UUID(current_user.tenant_id)
    gaps = await _analytics_service.detect_gaps(
        field_id=field_id,
        tenant_id=tenant_id,
        db=db,
        threshold_minutes=threshold_minutes,
    )
    return gaps
