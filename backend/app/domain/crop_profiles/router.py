"""
REST API endpoints for crop profile listing.

Endpoints:
    - ``GET /api/v1/crop-profiles`` — list all crop profiles
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.domain.auth.middleware import (
    AuthPayload,
    RoleChecker,
    get_current_user,
)
from app.domain.crop_profiles.schemas import CropProfile, CropProfileList
from app.domain.crop_profiles.service import get_profile_loader

logger = logging.getLogger("crop.api.crop_profiles")

router = APIRouter(prefix="/crop-profiles", tags=["Crop Profiles"])

# ── Role guards ─────────────────────────────────────────────
farmer_or_higher = RoleChecker("farmer", "agronomist", "admin")

# Singleton loader
_profile_loader = get_profile_loader()


@router.get(
    "",
    response_model=CropProfileList,
    summary="List all crop profiles",
)
async def list_crop_profiles(
    current_user: Annotated[AuthPayload, Depends(farmer_or_higher)],
) -> CropProfileList:
    """Return all available crop profiles.

    Profiles are loaded from the versioned ``crop_profiles.json`` data file
    and validated against Pydantic schemas at startup/first-access time.

    Each profile contains FAO-56 crop coefficients, fertilizer rate
    recommendations, pest profiles, and GDD parameters.

    Requires **farmer**, **agronomist**, or **admin** role.
    """
    try:
        return _profile_loader.get_all()
    except RuntimeError as exc:
        logger.error("Failed to load crop profiles: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Crop profiles are not available. Check server logs.",
        ) from exc
