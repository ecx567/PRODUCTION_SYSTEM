"""
Fields service: tenant-scoped CRUD with cursor-based pagination and soft-delete.

All queries are scoped to ``tenant_id`` extracted from the JWT to enforce
multi-tenant isolation.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.auth.models_tenant import Tenant
from app.domain.fields.models import Field
from app.domain.fields.schemas import (
    FieldCreate,
    FieldList,
    FieldResponse,
    FieldUpdate,
)

logger = logging.getLogger("crop.fields.service")

# Page size for cursor-based pagination
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


class FieldsService:
    """Tenant-scoped CRUD operations for fields."""

    # ── Create ──────────────────────────────────────────────

    async def create_field(
        self,
        data: FieldCreate,
        tenant_id: UUID | str,
        db: AsyncSession,
    ) -> FieldResponse:
        """Create a new field scoped to the given tenant.

        Args:
            data:       Field creation payload.
            tenant_id:  Tenant UUID (from JWT).
            db:         Async SQLAlchemy session.

        Returns:
            The created field as a ``FieldResponse``.
        """
        field = Field(
            tenant_id=UUID(str(tenant_id)),
            name=data.name,
            crop_type=data.crop_type,
            planted_at=data.planted_at,
            area_ha=data.area_ha,
            location=data.location,
        )
        db.add(field)
        await db.flush()
        await db.refresh(field)
        logger.info("Field created: id=%s name=%s tenant=%s", field.id, field.name, tenant_id)
        return FieldResponse.model_validate(field)

    # ── Read ────────────────────────────────────────────────

    async def get_field(
        self,
        field_id: UUID | str,
        tenant_id: UUID | str,
        db: AsyncSession,
    ) -> FieldResponse | None:
        """Get a single field by ID, scoped to tenant.

        Returns ``None`` if not found or soft-deleted.
        """
        stmt = select(Field).where(
            Field.id == UUID(str(field_id)),
            Field.tenant_id == UUID(str(tenant_id)),
            Field.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        field = result.scalar_one_or_none()
        if field is None:
            return None
        return FieldResponse.model_validate(field)

    async def list_fields(
        self,
        tenant_id: UUID | str,
        db: AsyncSession,
        cursor: str | None = None,
        page_size: int = DEFAULT_PAGE_SIZE,
        q: str | None = None,
        country: str | None = None,
        region: str | None = None,
    ) -> FieldList:
        """List active fields for a tenant with cursor-based pagination.

        The cursor is an opaque string encoding the last seen field ``created_at``
        timestamp. This avoids the offset drift problem of offset-based pagination.

        Args:
            tenant_id: Tenant UUID.
            db:        Async SQLAlchemy session.
            cursor:    Opaque cursor from the previous page (``next_cursor``).
            page_size: Number of items per page (1–100).
            q:         Optional search query — ILIKE match on ``name`` and ``crop_type``.
            country:   Optional filter by tenant country (exact match).
            region:    Optional filter by tenant region (exact match).

        Returns:
            A ``FieldList`` with items, optional next_cursor, and total count.
        """
        page_size = min(max(page_size, 1), MAX_PAGE_SIZE)

        # ── Build base WHERE clause ──────────────────────────
        base_where = [
            Field.tenant_id == UUID(str(tenant_id)),
            Field.deleted_at.is_(None),
        ]

        # Search filter: ILIKE on name OR crop_type
        if q:
            q_clean = q.strip()
            if q_clean:
                like_pattern = f"%{q_clean}%"
                base_where.append(
                    or_(
                        Field.name.ilike(like_pattern),
                        Field.crop_type.ilike(like_pattern),
                    )
                )

        # ── Build count query ────────────────────────────────
        count_stmt = select(func.count(Field.id)).where(*base_where)

        # Join tenants table if country/region filter is needed for count
        if country or region:
            count_stmt = count_stmt.join(Tenant, Field.tenant_id == Tenant.id)
            if country:
                count_stmt = count_stmt.where(Tenant.country == country.strip())
            if region:
                count_stmt = count_stmt.where(Tenant.region == region.strip())

        total_result = await db.execute(count_stmt)
        total = total_result.scalar() or 0

        # ── Build data query ─────────────────────────────────
        stmt = select(Field).where(*base_where)

        # Join tenants table for country/region filtering
        if country or region:
            stmt = stmt.join(Tenant, Field.tenant_id == Tenant.id)
            if country:
                stmt = stmt.where(Tenant.country == country.strip())
            if region:
                stmt = stmt.where(Tenant.region == region.strip())

        if cursor:
            try:
                cursor_dt = datetime.fromisoformat(cursor)
                stmt = stmt.where(Field.created_at < cursor_dt)
            except (ValueError, TypeError):
                logger.warning("Invalid cursor format: %s", cursor)
                # Invalid cursor — ignore and return first page

        stmt = stmt.order_by(Field.created_at.desc()).limit(page_size + 1)

        result = await db.execute(stmt)
        rows = result.scalars().all()

        items = [FieldResponse.model_validate(r) for r in rows[:page_size]]
        next_cursor: str | None = None
        if len(rows) > page_size:
            next_cursor = rows[page_size - 1].created_at.isoformat()

        return FieldList(items=items, next_cursor=next_cursor, total=total)

    # ── Update ──────────────────────────────────────────────

    async def update_field(
        self,
        field_id: UUID | str,
        data: FieldUpdate,
        tenant_id: UUID | str,
        db: AsyncSession,
    ) -> FieldResponse | None:
        """Update a field. Returns ``None`` if not found or soft-deleted.

        Only provided fields are updated (partial update).
        """
        stmt = select(Field).where(
            Field.id == UUID(str(field_id)),
            Field.tenant_id == UUID(str(tenant_id)),
            Field.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        field = result.scalar_one_or_none()
        if field is None:
            return None

        # Apply partial update
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(field, key, value)

        await db.flush()
        await db.refresh(field)
        logger.info("Field updated: id=%s updates=%s", field.id, set(update_data.keys()))
        return FieldResponse.model_validate(field)

    # ── Delete (soft) ───────────────────────────────────────

    async def soft_delete_field(
        self,
        field_id: UUID | str,
        tenant_id: UUID | str,
        db: AsyncSession,
    ) -> bool:
        """Soft-delete a field by setting ``deleted_at``.

        Args:
            field_id:  Field to delete.
            tenant_id: Tenant scope.
            db:        DB session.

        Returns:
            ``True`` if the field was found and soft-deleted, ``False`` otherwise.
        """
        stmt = select(Field).where(
            Field.id == UUID(str(field_id)),
            Field.tenant_id == UUID(str(tenant_id)),
            Field.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        field = result.scalar_one_or_none()
        if field is None:
            return False

        field.deleted_at = datetime.now(timezone.utc)
        await db.flush()
        logger.info("Field soft-deleted: id=%s tenant=%s", field.id, tenant_id)
        return True
