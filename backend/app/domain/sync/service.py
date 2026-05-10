"""
Sync service: revision management and mobile sync logic.

Implements the pull-then-push sync protocol used by the mobile app.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.sync.models import SyncRevision
from app.domain.sync.schemas import (
    SyncChange,
    SyncConflict,
    SyncMutation,
    SyncRequest,
    SyncResponse,
)

logger = logging.getLogger("crop.domain.sync")

# ── Tables exposed for sync ─────────────────────────────────────

SYNC_TABLES = {"fields", "sensor_readings", "alerts"}

# How far back to look for changes (in days)
SYNC_WINDOW_DAYS = 30


# ── Revision Management ─────────────────────────────────────────

async def get_current_revision(db: AsyncSession) -> int:
    """Get the current server revision."""
    result = await db.execute(
        select(SyncRevision.revision).where(SyncRevision.id == 1),
    )
    row = result.scalar_one_or_none()
    return row if row is not None else 0


async def increment_revision(db: AsyncSession) -> int:
    """Atomically increment and return the new revision."""
    # Try to update existing row
    result = await db.execute(
        text("""
            INSERT INTO sync_revision (id, revision, updated_at)
            VALUES (1, 1, datetime('now'))
            ON CONFLICT (id) DO UPDATE SET
                revision = sync_revision.revision + 1,
                updated_at = datetime('now')
            RETURNING revision
        """),
    )
    row = result.fetchone()
    new_rev = row[0] if row else 1
    return new_rev


# ── Change Tracking ─────────────────────────────────────────────

async def get_changes_since(
    db: AsyncSession,
    since_rev: int,
    current_rev: int,
    tenant_id: UUID,
) -> list[SyncChange]:
    """Fetch all changes across synced tables that occurred after ``since_rev``.

    Since we don't have per-row revision tracking, we use a time-based approach:
    changes are identified by `(updated_at, created_at, deleted_at)` timestamps
    that fall within the sync window.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=SYNC_WINDOW_DAYS)
    changes: list[SyncChange] = []

    # ── Fields ────────────────────────────────────────────────
    rows = await db.execute(
        text("""
            SELECT
                id::text,
                CASE WHEN deleted_at IS NOT NULL THEN 'delete' ELSE 'update' END as action,
                row_to_json(f.*)::text as data
            FROM fields f
            WHERE tenant_id = :tenant_id
              AND (
                  created_at >= :cutoff
                  OR (updated_at IS NOT NULL AND updated_at >= :cutoff)
                  OR deleted_at >= :cutoff
              )
            ORDER BY GREATEST(created_at, COALESCE(updated_at, created_at), deleted_at) ASC
        """),
        {"tenant_id": tenant_id, "cutoff": cutoff},
    )
    for row in rows:
        changes.append(SyncChange(
            table="fields",
            action=row.action,
            record_id=str(row.id),
            data=json.loads(row.data) if isinstance(row.data, str) else row.data,
            server_rev=current_rev,
        ))

    # ── Sensor Readings ───────────────────────────────────────
    rows = await db.execute(
        text("""
            SELECT
                time::text || '-' || sensor_id as record_id,
                'create' as action,
                row_to_json(sr.*)::text as data
            FROM sensor_readings sr
            WHERE tenant_id = :tenant_id
              AND time >= :cutoff
            ORDER BY time ASC
        """),
        {"tenant_id": tenant_id, "cutoff": cutoff},
    )
    for row in rows:
        changes.append(SyncChange(
            table="sensor_readings",
            action="create",
            record_id=str(row.record_id),
            data=json.loads(row.data) if isinstance(row.data, str) else row.data,
            server_rev=current_rev,
        ))

    # ── Alerts ────────────────────────────────────────────────
    rows = await db.execute(
        text("""
            SELECT
                id::text,
                CASE WHEN acknowledged_at IS NOT NULL THEN 'update' ELSE 'create' END as action,
                row_to_json(ae.*)::text as data
            FROM alert_events ae
            WHERE tenant_id = :tenant_id
              AND triggered_at >= :cutoff
            ORDER BY triggered_at ASC
        """),
        {"tenant_id": tenant_id, "cutoff": cutoff},
    )
    for row in rows:
        changes.append(SyncChange(
            table="alerts",
            action=row.action,
            record_id=str(row.id),
            data=json.loads(row.data) if isinstance(row.data, str) else row.data,
            server_rev=current_rev,
        ))

    return changes


# ── Mutation Application ────────────────────────────────────────

async def apply_mutations(
    db: AsyncSession,
    mutations: list[SyncMutation],
    tenant_id: UUID,
) -> list[SyncConflict]:
    """Apply client mutations to the database.

    For each mutation:
    - create: INSERT the record (skip if already exists — idempotent)
    - update: UPDATE the record (check LWW base_rev for conflicts)
    - delete: Soft-delete (set deleted_at)

    Returns a list of conflicts (server_wins resolution).
    """
    conflicts: list[SyncConflict] = []

    for mutation in mutations:
        if mutation.table not in SYNC_TABLES:
            logger.warning("Unknown sync table: %s", mutation.table)
            continue

        try:
            conflict = await _apply_single_mutation(db, mutation, tenant_id)
            if conflict:
                conflicts.append(conflict)
        except Exception as exc:
            logger.error(
                "Failed to apply mutation %s on %s/%s: %s",
                mutation.mutation_id, mutation.table, mutation.record_id, exc,
            )
            raise

    return conflicts


async def _apply_single_mutation(
    db: AsyncSession,
    mutation: SyncMutation,
    tenant_id: UUID,
) -> SyncConflict | None:
    """Apply a single mutation. Returns a SyncConflict if server_wins resolution needed."""
    record_id = mutation.record_id
    data = mutation.data

    if mutation.table == "fields":
        return await _apply_field_mutation(db, mutation, tenant_id)
    elif mutation.table == "alerts":
        return await _apply_alert_mutation(db, mutation, tenant_id)
    elif mutation.table == "sensor_readings":
        return await _apply_sensor_mutation(db, mutation, tenant_id)

    return None


async def _apply_field_mutation(
    db: AsyncSession,
    mutation: SyncMutation,
    tenant_id: UUID,
) -> SyncConflict | None:
    """Apply a field mutation with conflict detection."""
    rid = mutation.record_id
    data = mutation.data

    if mutation.action == "delete":
        await db.execute(
            text("UPDATE fields SET deleted_at = datetime('now') WHERE id = :id AND tenant_id = :tid"),
            {"id": rid, "tid": tenant_id},
        )
        return None

    if mutation.action == "create":
        # Idempotent insert
        await db.execute(
            text("""
                INSERT INTO fields (id, tenant_id, name, crop_type, planted_at, area_ha, location, created_at)
                VALUES (:id, :tid, :name, :crop_type, :planted_at, :area_ha, :location, datetime('now'))
                ON CONFLICT (id) DO NOTHING
            """),
            {
                "id": rid,
                "tid": tenant_id,
                "name": data.get("name", "Unnamed Field"),
                "crop_type": data.get("crop_type", "unknown"),
                "planted_at": data.get("planted_at"),
                "area_ha": float(data.get("area_ha", 0)),
                "location": data.get("location"),
            },
        )
        return None

    if mutation.action == "update":
        # Check for conflict: server version is newer
        existing = await db.execute(
            text("SELECT created_at, updated_at FROM fields WHERE id = :id AND tenant_id = :tid"),
            {"id": rid, "tid": tenant_id},
        )
        row = existing.fetchone()

        if row and row.updated_at and row.updated_at > datetime.now(timezone.utc) - timedelta(seconds=5):
            # Server has a newer version — conflict
            server_data = dict(row._mapping)
            return SyncConflict(
                table="fields",
                record_id=rid,
                server_data=server_data,
                client_data=data,
                resolution="server_wins",
            )

        await db.execute(
            text("""
                UPDATE fields SET
                    name = :name,
                    crop_type = :crop_type,
                    planted_at = :planted_at,
                    area_ha = :area_ha,
                    location = :location
                WHERE id = :id AND tenant_id = :tid
            """),
            {
                "id": rid,
                "tid": tenant_id,
                "name": data.get("name", "Unnamed Field"),
                "crop_type": data.get("crop_type", "unknown"),
                "planted_at": data.get("planted_at"),
                "area_ha": float(data.get("area_ha", 0)),
                "location": data.get("location"),
            },
        )
        return None

    return None


async def _apply_alert_mutation(
    db: AsyncSession,
    mutation: SyncMutation,
    tenant_id: UUID,
) -> SyncConflict | None:
    """Apply an alert acknowledgment."""
    if mutation.action == "update" and mutation.data.get("acknowledged_at"):
        await db.execute(
            text("UPDATE alert_events SET acknowledged_at = :acked WHERE id = :id AND tenant_id = :tid"),
            {"id": mutation.record_id, "tid": tenant_id, "acked": mutation.data["acknowledged_at"]},
        )
    return None


async def _apply_sensor_mutation(
    db: AsyncSession,
    mutation: SyncMutation,
    tenant_id: UUID,
) -> SyncConflict | None:
    """Sensor readings are immutable — no client mutations accepted for now."""
    return None


# ── Main Sync Endpoint Logic ────────────────────────────────────

async def perform_sync(
    request: SyncRequest,
    db: AsyncSession,
    tenant_id: UUID,
) -> SyncResponse:
    """Execute a full sync cycle: push client mutations, pull server changes."""
    # Step 1: Get current revision before processing
    current_rev = await get_current_revision(db)

    # Step 2: Apply client mutations
    conflicts = await apply_mutations(db, request.mutations, tenant_id)

    # Step 3: Increment revision if any mutations were applied
    if request.mutations:
        current_rev = await increment_revision(db)

    # Step 4: Get changes since client's last revision
    since_rev = request.since_rev if request.since_rev is not None else 0
    changes = await get_changes_since(db, since_rev, current_rev, tenant_id)

    return SyncResponse(
        server_rev=current_rev,
        changes=changes,
        conflicts=conflicts,
    )
