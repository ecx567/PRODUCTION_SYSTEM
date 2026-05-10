"""
REST endpoint for mobile offline-first sync protocol.

POST /api/v1/mobile/sync
  Body: SyncRequest { since_rev, mutations[] }
  Response: SyncResponse { server_rev, changes[], conflicts[] }
"""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domain.auth.middleware import AuthPayload, RoleChecker, get_current_user
from app.domain.sync.schemas import SyncRequest, SyncResponse
from app.domain.sync.service import perform_sync

logger = logging.getLogger("crop.api.sync")

router = APIRouter(prefix="/mobile", tags=["Mobile Sync"])

farmer_or_higher = RoleChecker("farmer", "agronomist", "admin")


@router.post(
    "/sync",
    response_model=SyncResponse,
    summary="Perform full sync cycle (push mutations + pull changes).",
)
async def mobile_sync(
    body: SyncRequest,
    current_user: Annotated[AuthPayload, Depends(farmer_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SyncResponse:
    """Execute the offline-first sync protocol.

    **Push phase**: Client sends pending mutations from its outbox. The server
    applies them with conflict detection (LWW, server_wins on conflict).

    **Pull phase**: Server returns all changes (fields, sensor_readings, alerts)
    that occurred since the client's last known revision (``since_rev``).

    **Conflicts**: When the server detects a version conflict, the server version
    wins, but the client data is preserved in the ``conflicts`` array for the
    mobile app to handle (e.g., store as a divergent copy for user review).
    """
    tenant_id = UUID(current_user.tenant_id)
    return await perform_sync(body, db, tenant_id)
