"""
REST API endpoints for Field CRUD operations.

All endpoints are tenant-scoped via the JWT middleware. Soft-deleted fields
are excluded from list and get responses.
"""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domain.auth.middleware import (
    AuthPayload,
    RoleChecker,
    get_current_user,
)
from app.domain.fields.schemas import (
    FieldCreate,
    FieldList,
    FieldResponse,
    FieldUpdate,
)
from app.domain.fields.service import FieldsService

logger = logging.getLogger("crop.api.fields")

router = APIRouter(prefix="/fields", tags=["Fields"])

# ── Role guards ─────────────────────────────────────────────
farmer_or_higher = RoleChecker("farmer", "agronomist", "admin")

# Singleton service
_fields_service = FieldsService()


# ── GET /api/v1/fields ───────────────────────────────────────

@router.get(
    "",
    response_model=FieldList,
    summary="List active fields for the current tenant",
)
async def list_fields(
    current_user: Annotated[AuthPayload, Depends(farmer_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
    cursor: str | None = Query(
        default=None,
        description="Opaque cursor for pagination. Pass ``next_cursor`` from the previous response.",
    ),
    page_size: int = Query(
        default=20, ge=1, le=100,
        description="Number of fields per page (1–100).",
    ),
    q: str | None = Query(
        default=None,
        max_length=100,
        description="Search query — ILIKE match on name and crop_type.",
    ),
    country: str | None = Query(
        default=None,
        max_length=100,
        description="Filter by tenant country (exact match).",
    ),
    region: str | None = Query(
        default=None,
        max_length=100,
        description="Filter by tenant region (exact match).",
    ),
) -> FieldList:
    """Return a paginated list of active (non-deleted) fields for the current tenant.

    Results are ordered by ``created_at`` descending (newest first).
    Use the ``next_cursor`` field in the response to fetch the next page.

    Optional filters:
        - ``q``: ILIKE search on field name and crop type.
        - ``country``: Filter by the tenant's country (exact match).
        - ``region``: Filter by the tenant's region (exact match).
    """
    tenant_id = UUID(current_user.tenant_id)
    return await _fields_service.list_fields(
        tenant_id=tenant_id,
        db=db,
        cursor=cursor,
        page_size=page_size,
        q=q,
        country=country,
        region=region,
    )


# ── POST /api/v1/fields ─────────────────────────────────────

@router.post(
    "",
    response_model=FieldResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new field",
    responses={
        201: {"description": "Field created successfully."},
        400: {"description": "Validation error (e.g., invalid crop type)."},
    },
)
async def create_field(
    body: FieldCreate,
    current_user: Annotated[AuthPayload, Depends(farmer_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FieldResponse:
    """Create a new field scoped to the current tenant.

    **Body** (JSON)::

        {
            "name": "North Field",
            "crop_type": "maize",
            "planted_at": "2026-03-15T08:00:00Z",
            "area_ha": 12.5,
            "location": "POINT(-82.5 23.1)"
        }

    ``crop_type`` must be one of: ``banana``, ``maize``, ``cacao``, ``rice``.
    """
    tenant_id = UUID(current_user.tenant_id)
    return await _fields_service.create_field(
        data=body,
        tenant_id=tenant_id,
        db=db,
    )


# ── GET /api/v1/fields/{id} ─────────────────────────────────

@router.get(
    "/{field_id}",
    response_model=FieldResponse,
    summary="Get field details",
    responses={
        200: {"description": "Field details."},
        404: {"description": "Field not found or has been deleted."},
    },
)
async def get_field(
    field_id: UUID,
    current_user: Annotated[AuthPayload, Depends(farmer_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FieldResponse:
    """Return details for a single field by ID.

    The field must belong to the current tenant and not be soft-deleted.
    """
    tenant_id = UUID(current_user.tenant_id)
    field = await _fields_service.get_field(
        field_id=field_id,
        tenant_id=tenant_id,
        db=db,
    )
    if field is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found or has been deleted.",
        )
    return field


# ── PUT /api/v1/fields/{id} ─────────────────────────────────

@router.put(
    "/{field_id}",
    response_model=FieldResponse,
    summary="Update a field (partial)",
    responses={
        200: {"description": "Field updated."},
        404: {"description": "Field not found."},
    },
)
async def update_field(
    field_id: UUID,
    body: FieldUpdate,
    current_user: Annotated[AuthPayload, Depends(farmer_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FieldResponse:
    """Partially update a field. Only provided fields are modified.

    All fields in the request body are optional. Omitted fields keep
    their current value.
    """
    tenant_id = UUID(current_user.tenant_id)
    updated = await _fields_service.update_field(
        field_id=field_id,
        data=body,
        tenant_id=tenant_id,
        db=db,
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found or has been deleted.",
        )
    return updated


# ── DELETE /api/v1/fields/{id} ──────────────────────────────

@router.delete(
    "/{field_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a field",
    responses={
        204: {"description": "Field soft-deleted."},
        404: {"description": "Field not found."},
    },
)
async def delete_field(
    field_id: UUID,
    current_user: Annotated[AuthPayload, Depends(farmer_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Soft-delete a field by setting its ``deleted_at`` timestamp.

    The field becomes invisible to list and get operations but is NOT
    removed from the database. This preserves referential integrity for
    historical sensor readings.
    """
    tenant_id = UUID(current_user.tenant_id)
    deleted = await _fields_service.soft_delete_field(
        field_id=field_id,
        tenant_id=tenant_id,
        db=db,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found or has been deleted.",
        )
