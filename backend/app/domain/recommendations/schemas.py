"""
Pydantic schemas for agronomic recommendations: irrigation, fertilization, pest risk.

All schemas are designed to be returned by the API and consumed by the dashboard.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── Enums ───────────────────────────────────────────────────

class RecommendationStatus(str, Enum):
    """Lifecycle status for a recommendation."""

    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    DISMISSED = "dismissed"
    APPLIED = "applied"


class RecommendationSeverity(str, Enum):
    """Severity level for a recommendation."""

    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ── Recommendation Status Schemas (lifecycle) ───────────────

class RecommendationStatusUpdate(BaseModel):
    """Request payload for updating a recommendation's lifecycle status."""

    status: RecommendationStatus = Field(
        ...,
        description="New lifecycle status. Valid transitions:\n"
        "  - active → acknowledged, dismissed, applied\n"
        "  - acknowledged → applied, dismissed\n"
        "  - dismissed → active\n"
        "  - applied → (terminal — no transitions out)",
    )
    comment: str | None = Field(
        default=None, max_length=500,
        description="Optional farmer comment for the status change.",
    )


class RecommendationStatusResponse(BaseModel):
    """Response payload after a lifecycle status update."""

    id: UUID
    field_id: UUID
    type: str
    status: RecommendationStatus
    severity: RecommendationSeverity
    title: str | None = None
    acknowledged_at: datetime | None = None
    dismissed_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Stored Recommendation List (for dashboard) ──────────────

class StoredRecommendationItem(BaseModel):
    """A stored recommendation returned by the list endpoint."""

    id: UUID
    field_id: UUID
    type: str
    payload: dict
    generated_at: datetime
    status: str
    severity: str
    title: str | None = None
    acknowledged_at: datetime | None = None
    dismissed_at: datetime | None = None
    applied_at: datetime | None = None

    model_config = {"from_attributes": True}


class StoredRecommendationList(BaseModel):
    """Paginated list of stored recommendations."""

    items: list[StoredRecommendationItem]
    total: int


# ── Irrigation Recommendation ───────────────────────────────

class IrrigationRecommendation(BaseModel):
    """FAO-56 based irrigation recommendation for a field.

    Uses the soil water balance approach:
        Dr = previous Dr + (ETc - P_effective - I) + deep_percolation

    Where:
        - Dr = root zone depletion (mm)
        - ETc = crop evapotranspiration = ETo × Kc
        - P_effective = effective rainfall
        - I = irrigation applied
    """

    field_id: UUID
    timestamp: datetime
    eto_mm: float = Field(
        ..., ge=0.0,
        description="Reference evapotranspiration (ETo) in mm — Hargreaves method.",
    )
    etc_mm: float = Field(
        ..., ge=0.0,
        description="Crop evapotranspiration (ETc = ETo × Kc) in mm.",
    )
    effective_rain_mm: float = Field(
        default=0.0, ge=0.0,
        description="Effective rainfall in mm.",
    )
    irrigation_needed_mm: float = Field(
        ..., ge=0.0,
        description="Recommended irrigation depth in mm. 0 means no irrigation needed.",
    )
    soil_moisture_current: Optional[float] = Field(
        default=None, ge=0.0, le=100.0,
        description="Current soil moisture reading in %.",
    )
    soil_moisture_target: Optional[float] = Field(
        default=None, ge=0.0, le=100.0,
        description="Target soil moisture at field capacity in %.",
    )
    depletion_percent: float = Field(
        ..., ge=0.0, le=100.0,
        description="Current root zone depletion as % of TAW.",
    )
    recommendation: str = Field(
        ..., pattern=r"^(water|monitor|skip)$",
        description="Action: 'water' = irrigate now, 'monitor' = check soon, 'skip' = not needed.",
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0,
        description="Confidence score based on data completeness and quality.",
    )


# ── Fertilization Recommendation ────────────────────────────

class FertilizationRecommendation(BaseModel):
    """Split-N fertilization recommendation based on crop growth stage.

    Uses crop-specific nutrient removal rates at each growth stage:
        - Planting (establishment): low N, moderate P, moderate K
        - Vegetative (growth): high N, moderate P, high K
        - Reproductive (flowering/fruiting): moderate N, high P, high K
    """

    field_id: UUID
    crop_type: str
    growth_stage: str = Field(
        ..., pattern=r"^(planting|vegetative|reproductive)$",
        description="Current crop growth stage.",
    )
    n_kg_ha: float = Field(
        ..., ge=0.0, description="Recommended nitrogen in kg/ha.",
    )
    p_kg_ha: float = Field(
        ..., ge=0.0, description="Recommended phosphorus (P₂O₅) in kg/ha.",
    )
    k_kg_ha: float = Field(
        ..., ge=0.0, description="Recommended potassium (K₂O) in kg/ha.",
    )
    recommendation: str = Field(
        ..., pattern=r"^(apply|delay|skip)$",
        description="Action: 'apply' = fertilize now, 'delay' = wait, 'skip' = not needed.",
    )
    reasoning: str = Field(
        default="",
        description="Human-readable explanation of the recommendation.",
    )


# ── Pest Risk Alert ─────────────────────────────────────────

class PestRiskAlert(BaseModel):
    """Pest risk assessment using degree-day accumulation models.

    Risk factors:
        - Accumulated Growing Degree Days (GDD) vs pest-specific thresholds
        - Environmental conditions (temperature range, humidity, leaf wetness)
        - Crop susceptibility at current growth stage
    """

    field_id: UUID
    crop_type: str
    pest_name: str = Field(
        ..., description="Name of the pest or disease.",
    )
    risk_level: str = Field(
        ..., pattern=r"^(low|medium|high)$",
        description="Assessed risk level.",
    )
    conditions_favorable: bool = Field(
        default=False,
        description="Whether current environmental conditions favor pest development.",
    )
    accumulated_gdd: float = Field(
        ..., ge=0.0, description="Accumulated Growing Degree Days since planting.",
    )
    gdd_threshold: float = Field(
        ..., ge=0.0, description="GDD threshold for pest emergence or infection.",
    )
    temperature_avg: Optional[float] = Field(
        default=None, description="Average temperature over the assessment period.",
    )
    humidity_avg: Optional[float] = Field(
        default=None, ge=0.0, le=100.0,
        description="Average relative humidity over the assessment period.",
    )
    leaf_wetness_hours: Optional[float] = Field(
        default=None, ge=0.0,
        description="Hours of leaf wetness in the last 24h.",
    )
    recommendation: str = Field(
        default="",
        description="Actionable recommendation for the farmer.",
    )


# ── Summary ─────────────────────────────────────────────────

class RecommendationSummary(BaseModel):
    """Combined recommendation summary for a field's dashboard view."""

    field_id: UUID
    irrigation: Optional[IrrigationRecommendation] = Field(
        default=None,
        description="Current irrigation recommendation (or None if data insufficient).",
    )
    fertilization: Optional[FertilizationRecommendation] = Field(
        default=None,
        description="Current fertilization recommendation (or None if data insufficient).",
    )
    pest_risk: list[PestRiskAlert] = Field(
        default_factory=list,
        description="Active pest risk alerts for this field.",
    )
    generated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When this summary was generated.",
    )
