"""
REST API endpoints for sensor data ingestion and retrieval.

Endpoints:
    - ``GET  /api/v1/fields/{id}/sensors`` — latest readings per field
    - ``GET  /api/v1/fields/{id}/sensors/history`` — time-range with aggregation
    - ``POST /api/v1/sensors/data`` — direct sensor data submission (HTTP fallback)
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domain.auth.middleware import (
    AuthPayload,
    RoleChecker,
    get_current_user,
)
from app.domain.ingestion.schemas import (
    PoisonPillResult,
    SensorReadingBulkCreate,
    SensorReadingCreate,
    SensorReadingResponse,
)
from app.domain.ingestion.service import IngestionService

logger = logging.getLogger("crop.api.ingestion")

router = APIRouter(tags=["Sensor Ingestion"])

# ── Role guards ─────────────────────────────────────────────
farmer_or_higher = RoleChecker("farmer", "agronomist", "admin")

# Singleton service
_ingestion_service = IngestionService()


# ── GET /api/v1/fields/{id}/sensors ─────────────────────────

@router.get(
    "/fields/{field_id}/sensors",
    response_model=list[SensorReadingResponse],
    summary="Latest sensor readings per sensor in a field",
)
async def get_latest_sensor_readings(
    field_id: UUID,
    current_user: Annotated[AuthPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=500, description="Max sensors to return"),
) -> list[SensorReadingResponse]:
    """Return the most recent reading for each unique sensor in the specified field.

    Results are scoped to the authenticated user's tenant.
    """
    tenant_id = UUID(current_user.tenant_id)
    readings = await _ingestion_service.get_latest_readings(
        field_id=field_id,
        tenant_id=tenant_id,
        db=db,
        limit=limit,
    )
    return readings


# ── GET /api/v1/fields/{id}/sensors/history ─────────────────

@router.get(
    "/fields/{field_id}/sensors/history",
    response_model=list[SensorReadingResponse],
    summary="Historical sensor readings for a field",
)
async def get_sensor_history(
    field_id: UUID,
    current_user: Annotated[AuthPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    start_time: datetime | None = Query(default=None, description="Start of time range (ISO 8601)"),
    end_time: datetime | None = Query(default=None, description="End of time range (ISO 8601)"),
    limit: int = Query(default=1000, ge=1, le=10000, description="Max rows to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
) -> list[SensorReadingResponse]:
    """Return historical sensor readings for a field with optional time-range filtering.

    Supports cursor-based pagination via ``offset``.
    """
    tenant_id = UUID(current_user.tenant_id)
    readings = await _ingestion_service.get_history(
        field_id=field_id,
        tenant_id=tenant_id,
        db=db,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
        offset=offset,
    )
    return readings


# ── POST /api/v1/sensors/data ───────────────────────────────

@router.post(
    "/sensors/data",
    response_model=PoisonPillResult,
    status_code=status.HTTP_201_CREATED,
    summary="Submit sensor data directly via HTTP (fallback)",
    responses={
        201: {"description": "Readings processed (some may have been isolated)."},
        400: {"description": "Validation error in request body."},
        422: {"description": "Unprocessable entity: all readings were invalid."},
    },
)
async def submit_sensor_data(
    body: SensorReadingBulkCreate,
    current_user: Annotated[AuthPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PoisonPillResult:
    """Direct HTTP submission of sensor readings.

    This is the **HTTP fallback** path — the primary ingestion channel is MQTT.
    Use this when MQTT is unavailable or for manual data entry.

    The same **poison pill** pattern applies: a single invalid reading does not
    corrupt the batch. Valid readings are stored, invalid ones are isolated.

    **Body** (JSON)::

        {
            "readings": [
                {
                    "ts": "2026-05-10T14:30:00Z",
                    "sensor_id": "uuid",
                    "field_id": "uuid",
                    "temp": 25.5,
                    "humidity": 70.2,
                    "soil_moisture": 45.0,
                    "rain": 0.0
                }
            ]
        }
    """
    tenant_id = UUID(current_user.tenant_id)

    # Validate and process each reading through the poison pill pipeline
    # Convert bulk body to individual SensorReadingCreate objects
    result = await _ingestion_service.ingest_batch(
        readings=body.readings,
        tenant_id=tenant_id,
        db=db,
    )

    if result.stored_count == 0 and result.total_submitted > 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "All readings were rejected or duplicated.",
                "total_submitted": result.total_submitted,
                "isolated_count": result.isolated_count,
                "duplicate_count": result.duplicate_count,
            },
        )

    return result
