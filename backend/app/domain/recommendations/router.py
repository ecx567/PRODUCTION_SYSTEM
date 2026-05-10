"""
REST API endpoints for agronomic recommendations.

Endpoints:
    - ``GET /api/v1/fields/{id}/recommendations`` — Combined recommendation summary
    - ``GET /api/v1/fields/{id}/recommendations/irrigation`` — FAO-56 irrigation detail
    - ``GET /api/v1/fields/{id}/recommendations/fertilization`` — Split-N fertilization detail
    - ``GET /api/v1/fields/{id}/recommendations/pest-risk`` — Pest risk detail
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domain.auth.middleware import (
    AuthPayload,
    RoleChecker,
    get_current_user,
)
from app.domain.fields.models import Field
from app.domain.recommendations.schemas import (
    FertilizationRecommendation,
    IrrigationRecommendation,
    PestRiskAlert,
    RecommendationSummary,
)
from app.domain.recommendations.service import RecommendationService
from app.domain.ingestion.service import IngestionService

logger = logging.getLogger("crop.api.recommendations")

router = APIRouter(tags=["Recommendations"])

# ── Role guards ─────────────────────────────────────────────
farmer_or_higher = RoleChecker("farmer", "agronomist", "admin")
agronomist_or_higher = RoleChecker("agronomist", "admin")

# Singleton services
_recommendation_service = RecommendationService()
_ingestion_service = IngestionService()


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════

async def _resolve_field(
    field_id: UUID,
    tenant_id: UUID,
    db: AsyncSession,
) -> Field:
    """Resolve a field by ID with tenant scope. Raises 404 if not found."""
    stmt = select(Field).where(
        Field.id == field_id,
        Field.tenant_id == tenant_id,
        Field.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    field = result.scalar_one_or_none()
    if field is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found.",
        )
    return field


async def _get_sensor_readings(
    field_id: UUID,
    db: AsyncSession,
    lookback_hours: int = 72,
) -> list[dict]:
    """Fetch recent sensor readings for a field."""
    rows = await _ingestion_service.get_history(
        field_id=field_id,
        tenant_id=field_id,  # will be overridden by tenant context
        db=db,
        limit=500,
    )
    return [
        {
            "temp": r.temp,
            "humidity": r.humidity,
            "soil_moisture": r.soil_moisture,
            "rain": r.rain,
        }
        for r in rows
    ]


def _days_since_planting(planted_at: date | datetime | None) -> int:
    """Calculate days since planting. Returns 0 if no planting date."""
    if planted_at is None:
        return 0
    if isinstance(planted_at, datetime):
        planted_at = planted_at.date()
    delta = datetime.now(timezone.utc).date() - planted_at
    return max(0, delta.days)


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/fields/{id}/recommendations
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/fields/{field_id}/recommendations",
    response_model=RecommendationSummary,
    summary="Combined recommendation summary for a field",
)
async def get_recommendations(
    field_id: UUID,
    current_user: Annotated[AuthPayload, Depends(farmer_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
    lookback_hours: int = Query(
        default=72,
        ge=1,
        le=720,
        description="Hours of sensor data to use for calculations.",
    ),
) -> RecommendationSummary:
    """Return agronomic recommendations for a field: irrigation, fertilization, pest risk.

    Combines FAO-56 irrigation, split-N fertilization, and degree-day pest models
    into a single summary for the dashboard.

    Requires **farmer**, **agronomist**, or **admin** role.
    """
    tenant_id = UUID(current_user.tenant_id)
    field = await _resolve_field(field_id, tenant_id, db)
    days = _days_since_planting(field.planted_at)

    readings = await _ingestion_service.get_history(
        field_id=field_id,
        tenant_id=tenant_id,
        db=db,
        limit=500,
    )
    reading_dicts = [
        {
            "temp": r.temp,
            "humidity": r.humidity,
            "soil_moisture": r.soil_moisture,
            "rain": r.rain,
        }
        for r in readings
    ]

    summary = await _recommendation_service.get_summary(
        field_id=field_id,
        crop_type=field.crop_type,
        days_since_planting=days,
        sensor_readings=reading_dicts,
        db=db,
    )
    return summary


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/fields/{id}/recommendations/irrigation
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/fields/{field_id}/recommendations/irrigation",
    response_model=IrrigationRecommendation,
    summary="FAO-56 irrigation recommendation detail",
)
async def get_irrigation_recommendation(
    field_id: UUID,
    current_user: Annotated[AuthPayload, Depends(agronomist_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IrrigationRecommendation:
    """Return detailed FAO-56 irrigation recommendation for a field.

    Includes ETo (Hargreaves), ETc, effective rainfall, soil moisture balance,
    depletion percentage, and actionable recommendation.

    Requires **agronomist** or **admin** role.
    """
    tenant_id = UUID(current_user.tenant_id)
    field = await _resolve_field(field_id, tenant_id, db)
    days = _days_since_planting(field.planted_at)

    readings = await _ingestion_service.get_history(
        field_id=field_id,
        tenant_id=tenant_id,
        db=db,
        limit=500,
    )
    reading_dicts = [
        {
            "temp": r.temp,
            "humidity": r.humidity,
            "soil_moisture": r.soil_moisture,
            "rain": r.rain,
        }
        for r in readings
    ]

    result = await _recommendation_service.calculate_irrigation(
        field_id=field_id,
        crop_type=field.crop_type,
        days_since_planting=days,
        sensor_readings=reading_dicts,
        db=db,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_204_NO_CONTENT,
            detail="Insufficient sensor data for irrigation calculation.",
        )
    return result


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/fields/{id}/recommendations/fertilization
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/fields/{field_id}/recommendations/fertilization",
    response_model=FertilizationRecommendation,
    summary="Split-N fertilization recommendation detail",
)
async def get_fertilization_recommendation(
    field_id: UUID,
    current_user: Annotated[AuthPayload, Depends(agronomist_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
    soil_test_n: float | None = Query(
        default=None,
        description="Soil test nitrogen (kg/ha). If omitted, estimated from crop requirement.",
    ),
    soil_test_p: float | None = Query(
        default=None,
        description="Soil test phosphorus (kg/ha).",
    ),
    soil_test_k: float | None = Query(
        default=None,
        description="Soil test potassium (kg/ha).",
    ),
) -> FertilizationRecommendation:
    """Return split-N fertilization recommendation for a field.

    Uses crop-specific removal rates per growth stage. Optional soil test
    values improve accuracy.

    Requires **agronomist** or **admin** role.
    """
    tenant_id = UUID(current_user.tenant_id)
    field = await _resolve_field(field_id, tenant_id, db)
    days = _days_since_planting(field.planted_at)

    result = await _recommendation_service.calculate_fertilization(
        field_id=field_id,
        crop_type=field.crop_type,
        days_since_planting=days,
        soil_test_n=soil_test_n,
        soil_test_p=soil_test_p,
        soil_test_k=soil_test_k,
    )
    return result


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/fields/{id}/recommendations/pest-risk
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/fields/{field_id}/recommendations/pest-risk",
    response_model=list[PestRiskAlert],
    summary="Pest risk assessment detail",
)
async def get_pest_risk(
    field_id: UUID,
    current_user: Annotated[AuthPayload, Depends(agronomist_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PestRiskAlert]:
    """Return pest risk assessment for a field.

    Uses degree-day accumulation models for crop-specific pests:
        - Banana: Black Sigatoka
        - Maize: Fall Armyworm
        - Cacao: Witches' Broom
        - Rice: Blast

    Risk factors: GDD accumulation, temperature range, humidity, leaf wetness.

    Requires **agronomist** or **admin** role.
    """
    tenant_id = UUID(current_user.tenant_id)
    field = await _resolve_field(field_id, tenant_id, db)
    days = _days_since_planting(field.planted_at)

    readings = await _ingestion_service.get_history(
        field_id=field_id,
        tenant_id=tenant_id,
        db=db,
        limit=500,
    )
    reading_dicts = [
        {
            "temp": r.temp,
            "humidity": r.humidity,
            "soil_moisture": r.soil_moisture,
            "rain": r.rain,
        }
        for r in readings
    ]

    alerts = await _recommendation_service.assess_pest_risk(
        field_id=field_id,
        crop_type=field.crop_type,
        days_since_planting=days,
        sensor_readings=reading_dicts,
    )
    return alerts
