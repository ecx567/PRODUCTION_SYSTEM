"""
REST API endpoints for yield predictions.

Endpoints:
    - ``GET /api/v1/fields/{id}/predictions/yield`` — Current yield forecast
    - ``GET /api/v1/fields/{id}/predictions/history`` — Past predictions vs actual
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domain.auth.middleware import (
    AuthPayload,
    RoleChecker,
    get_current_user,
)
from app.domain.fields.models import Field
from app.domain.analytics.predictions import PredictionService, YieldPrediction
from app.domain.ingestion.service import IngestionService

logger = logging.getLogger("crop.api.predictions")

router = APIRouter(tags=["Predictions"])

# ── Role guards ─────────────────────────────────────────────
farmer_or_higher = RoleChecker("farmer", "agronomist", "admin")
agronomist_or_higher = RoleChecker("agronomist", "admin")

# Singleton services
_prediction_service = PredictionService()
_ingestion_service = IngestionService()


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════

async def _resolve_field(
    field_id: UUID,
    tenant_id: UUID,
    db: AsyncSession,
) -> Field:
    """Resolve a field with tenant scope. Raises 404 if not found."""
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


def _days_since_planting(planted_at: date | datetime | None) -> int:
    """Calculate days since planting."""
    if planted_at is None:
        return 0
    if isinstance(planted_at, datetime):
        planted_at = planted_at.date()
    delta = datetime.now(timezone.utc).date() - planted_at
    return max(0, delta.days)


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/fields/{id}/predictions/yield
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/fields/{field_id}/predictions/yield",
    summary="Yield forecast for the current season",
)
async def get_yield_prediction(
    field_id: UUID,
    current_user: Annotated[AuthPayload, Depends(farmer_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return yield forecast for a field based on current sensor data.

    Uses a Random Forest / XGBoost model if available, or falls back to a
    statistical GDD-based model if the ML model is not deployed.

    Response includes:
        - ``predicted_yield_kg_ha`` — Expected yield in kg per hectare
        - ``lower_bound`` / ``upper_bound`` — 95% confidence interval
        - ``data_quality`` — ``high`` | ``medium`` | ``low`` | ``insufficient``
        - ``model_version`` — Which model generated the prediction

    Requires **farmer**, **agronomist**, or **admin** role.
    """
    tenant_id = UUID(current_user.tenant_id)
    field = await _resolve_field(field_id, tenant_id, db)
    days = _days_since_planting(field.planted_at)

    # Try to load model (caches after first load)
    if not _prediction_service._model_loaded:
        await _prediction_service.load_model()

    readings = await _ingestion_service.get_history(
        field_id=field_id,
        tenant_id=tenant_id,
        db=db,
        limit=500,
    )

    prediction = await _prediction_service.predict_yield(
        field_id=field_id,
        crop_type=field.crop_type,
        days_since_planting=days,
        readings=readings,
        area_ha=field.area_ha,
    )
    return prediction.to_dict()


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/fields/{id}/predictions/history
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/fields/{field_id}/predictions/history",
    summary="Past predictions vs actual yields",
)
async def get_prediction_history(
    field_id: UUID,
    current_user: Annotated[AuthPayload, Depends(farmer_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Number of historical predictions to return.",
    ),
) -> dict:
    """Return historical predictions for a field compared to actual yields.

    Each entry shows:
        - ``predicted_yield_kg_ha``
        - ``actual_yield_kg_ha`` (null if harvest not yet recorded)
        - ``error_pct`` (null if actual not available)
        - ``model_version``
        - ``generated_at``

    Requires **farmer**, **agronomist**, or **admin** role.
    """
    tenant_id = UUID(current_user.tenant_id)
    await _resolve_field(field_id, tenant_id, db)

    history = await _prediction_service.get_prediction_history(
        field_id=field_id,
        db=db,
        limit=limit,
    )

    return {
        "field_id": str(field_id),
        "predictions": history,
        "total": len(history),
    }
