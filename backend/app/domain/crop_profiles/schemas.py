"""
Pydantic models for crop profile data.

Crop profiles are versioned JSON documents that describe crop parameters
for FAO-56 irrigation scheduling, split-N fertilization, pest risk modelling,
and growing-degree-day calculations.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PestProfile(BaseModel):
    """Pest or disease profile for pest risk modelling."""

    name: str = Field(..., description="Common name of the pest or disease.")
    scientific_name: str | None = Field(
        default=None, description="Scientific / binomial name.",
    )
    gdd_threshold: float = Field(
        ..., ge=0.0,
        description="Accumulated GDD threshold for pest emergence or infection.",
    )
    t_base: float = Field(
        ..., description="Base temperature (°C) for GDD calculation.",
    )
    optimal_temp_min: float = Field(
        ..., description="Lower bound of optimal temperature range (°C).",
    )
    optimal_temp_max: float = Field(
        ..., description="Upper bound of optimal temperature range (°C).",
    )
    requires_leaf_wetness: bool = Field(
        default=False,
        description="Whether leaf wetness is required for infection.",
    )
    leaf_wetness_hours_min: float | None = Field(
        default=None, ge=0.0,
        description="Minimum leaf wetness hours required for infection.",
    )
    min_humidity: float | None = Field(
        default=None, ge=0.0, le=100.0,
        description="Minimum relative humidity (%) for infection.",
    )
    recommendation: str = Field(
        default="", description="Actionable recommendation for the farmer.",
    )


class CropProfile(BaseModel):
    """Complete agronomic profile for a single crop type.

    Contains all parameters needed for FAO-56 irrigation, split-N
    fertilization, pest risk assessment, and GDD-based development
    tracking.
    """

    name: str = Field(
        ..., min_length=1,
        description="Crop name (lowercase, matches ALLOWED_CROP_TYPES).",
    )
    display_name: str | None = Field(
        default=None, description="Human-readable display name (e.g., 'Palm Oil').",
    )

    # ── FAO-56 crop coefficients ─────────────────────────────
    kc_initial: float = Field(..., ge=0.0, description="Kc during initial growth stage.")
    kc_mid: float = Field(..., ge=0.0, description="Kc during mid-season stage.")
    kc_end: float = Field(..., ge=0.0, description="Kc during late-season stage.")
    stage_lengths: list[int] = Field(
        ..., min_length=4, max_length=4,
        description="Stage lengths in days: [initial, development, mid, late].",
    )

    # ── Fertilizer recommendations ───────────────────────────
    fertilizer_rates: dict[str, dict[str, float]] = Field(
        ...,
        description=(
            "Fertilizer NPK rates (kg/ha) per growth stage. "
            "Keys: 'planting', 'vegetative', 'reproductive'. "
            "Values: {'n': float, 'p': float, 'k': float}."
        ),
    )

    # ── Pest profiles ────────────────────────────────────────
    pests: list[PestProfile] = Field(
        default_factory=list,
        description="Pests and diseases known to affect this crop.",
    )

    # ── Soil / irrigation defaults ───────────────────────────
    taw_default: float = Field(
        default=150.0, ge=0.0,
        description="Default Total Available Water (mm/m) for this crop.",
    )

    # ── GDD parameters ───────────────────────────────────────
    gdd_base_temp: float = Field(
        default=10.0,
        description="Base temperature (°C) for Growing Degree Day calculation.",
    )
    gdd_upper_temp: float | None = Field(
        default=None,
        description="Optional upper temperature threshold (°C) for GDD calculation.",
    )

    # ── Metadata ─────────────────────────────────────────────
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional crop-specific metadata (references, notes, etc.).",
    )


class CropProfileList(BaseModel):
    """Response wrapper for listing crop profiles."""

    items: list[CropProfile] = Field(
        ..., description="List of crop profiles.",
    )
    total: int = Field(
        ..., ge=0, description="Total number of profiles.",
    )
