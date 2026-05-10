"""
Pydantic schemas for Field CRUD operations.

Crop types are validated against the allowed ENUM: banana, maize, cacao, rice.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ── Allowed crop types ──────────────────────────────────────
ALLOWED_CROP_TYPES = {"banana", "maize", "cacao", "rice"}


# ── Create / Update Schemas ─────────────────────────────────

class FieldCreate(BaseModel):
    """Payload for creating a new field."""

    name: str = Field(
        ..., min_length=1, max_length=255,
        description="Human-readable field name.",
    )
    crop_type: str = Field(
        ..., description="Crop type: banana | maize | cacao | rice.",
    )
    planted_at: datetime | None = Field(
        default=None,
        description="When the crop was planted (ISO 8601).",
    )
    area_ha: float = Field(
        ..., gt=0.0, le=1_000_000.0,
        description="Field area in hectares.",
    )
    location: str | None = Field(
        default=None, max_length=500,
        description="WKT or geo coordinates.",
    )

    @field_validator("crop_type")
    @classmethod
    def validate_crop_type(cls, v: str) -> str:
        """Reject crop types outside the allowed set."""
        if v.lower() not in ALLOWED_CROP_TYPES:
            raise ValueError(
                f"Invalid crop type '{v}'. Must be one of: {', '.join(sorted(ALLOWED_CROP_TYPES))}."
            )
        return v.lower()


class FieldUpdate(BaseModel):
    """Payload for updating an existing field. All fields optional."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    crop_type: str | None = Field(default=None)
    planted_at: datetime | None = None
    area_ha: float | None = Field(default=None, gt=0.0, le=1_000_000.0)
    location: str | None = Field(default=None, max_length=500)

    @field_validator("crop_type")
    @classmethod
    def validate_crop_type(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if v.lower() not in ALLOWED_CROP_TYPES:
            raise ValueError(
                f"Invalid crop type '{v}'. Must be one of: {', '.join(sorted(ALLOWED_CROP_TYPES))}."
            )
        return v.lower()


# ── Response Schemas ────────────────────────────────────────

class FieldResponse(BaseModel):
    """A single field as returned by the API."""

    id: UUID
    tenant_id: UUID
    name: str
    crop_type: str
    planted_at: datetime | None = None
    area_ha: float
    location: str | None = None
    created_at: datetime | None = None
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class FieldList(BaseModel):
    """Paginated list of fields."""

    items: list[FieldResponse]
    next_cursor: str | None = Field(
        default=None,
        description="Opaque cursor for the next page. NULL means last page.",
    )
    total: int = Field(default=0, description="Total number of active fields.")
