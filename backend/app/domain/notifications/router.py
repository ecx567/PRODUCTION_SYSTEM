"""
REST API endpoints for the alert engine: alert rules and alert events.

All endpoints are tenant-scoped via the JWT middleware.
"""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from redis.asyncio import Redis as AsyncRedis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis
from app.domain.auth.middleware import (
    AuthPayload,
    RoleChecker,
    get_current_user,
)
from app.domain.notifications.schemas import (
    AlertEventList,
    AlertEventResponse,
    AlertRuleCreate,
    AlertRuleList,
    AlertRuleResponse,
    AlertRuleUpdate,
)
from app.domain.notifications.service import NotificationService

logger = logging.getLogger("crop.api.alerts")

router = APIRouter(prefix="/alerts", tags=["Alerts"])

# ── Role guards ─────────────────────────────────────────────
farmer_or_higher = RoleChecker("farmer", "agronomist", "admin")
agronomist_or_higher = RoleChecker("agronomist", "admin")

# Singleton service
_notification_service = NotificationService()


# ═══════════════════════════════════════════════════════════════
# Alert Rules
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/rules",
    response_model=AlertRuleList,
    summary="List alert rules",
)
async def list_rules(
    current_user: Annotated[AuthPayload, Depends(farmer_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AlertRuleList:
    """Return all alert rules for the current tenant.

    Rules are returned in reverse chronological order (newest first).
    Both enabled and disabled rules are included.
    """
    tenant_id = UUID(current_user.tenant_id)
    return await _notification_service.list_rules(tenant_id=tenant_id, db=db)


@router.post(
    "/rules",
    response_model=AlertRuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an alert rule",
    responses={
        201: {"description": "Rule created."},
        400: {"description": "Validation error."},
    },
)
async def create_rule(
    body: AlertRuleCreate,
    current_user: Annotated[AuthPayload, Depends(agronomist_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AlertRuleResponse:
    """Create a new alert rule for the current tenant.

    **Body** (JSON)::

        {
            "name": "High Temperature",
            "metric_type": "temp",
            "condition": "gt",
            "threshold": 35.0,
            "severity": "warning",
            "field_id": null,
            "enabled": true,
            "cooldown_minutes": 15
        }

    ``field_id`` is optional — set to ``null`` for a tenant-wide rule.
    ``condition`` must be one of: ``gt``, ``lt``, ``eq``, ``between``.
    If ``condition`` is ``between``, provide ``threshold_max`` as the upper bound.
    """
    tenant_id = UUID(current_user.tenant_id)
    return await _notification_service.create_rule(data=body, tenant_id=tenant_id, db=db)


@router.put(
    "/rules/{rule_id}",
    response_model=AlertRuleResponse,
    summary="Update an alert rule",
    responses={
        200: {"description": "Rule updated."},
        404: {"description": "Rule not found."},
    },
)
async def update_rule(
    rule_id: UUID,
    body: AlertRuleUpdate,
    current_user: Annotated[AuthPayload, Depends(agronomist_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AlertRuleResponse:
    """Partially update an alert rule. Only provided fields are modified."""
    tenant_id = UUID(current_user.tenant_id)
    updated = await _notification_service.update_rule(
        rule_id=rule_id, data=body, tenant_id=tenant_id, db=db,
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found.",
        )
    return updated


@router.delete(
    "/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an alert rule",
    responses={
        204: {"description": "Rule deleted."},
        404: {"description": "Rule not found."},
    },
)
async def delete_rule(
    rule_id: UUID,
    current_user: Annotated[AuthPayload, Depends(agronomist_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Permanently delete an alert rule and its associated events."""
    tenant_id = UUID(current_user.tenant_id)
    deleted = await _notification_service.delete_rule(
        rule_id=rule_id, tenant_id=tenant_id, db=db,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found.",
        )


# ═══════════════════════════════════════════════════════════════
# Alert Events
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/events",
    response_model=AlertEventList,
    summary="List recent alert events",
)
async def list_events(
    current_user: Annotated[AuthPayload, Depends(farmer_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
    cursor: str | None = Query(
        default=None,
        description="Opaque cursor from ``next_cursor`` in the previous response.",
    ),
    page_size: int = Query(default=50, ge=1, le=200, description="Items per page."),
    severity: str | None = Query(
        default=None,
        description="Filter by severity: info, warning, critical.",
    ),
    acknowledged: bool | None = Query(
        default=None,
        description="Filter by acknowledged status: ``true``, ``false``, or omit for all.",
    ),
) -> AlertEventList:
    """Return paginated alert events for the current tenant.

    Events are ordered by ``triggered_at`` descending (newest first).
    Supports filtering by severity and acknowledgement status.
    """
    tenant_id = UUID(current_user.tenant_id)
    return await _notification_service.list_events(
        tenant_id=tenant_id,
        db=db,
        cursor=cursor,
        page_size=page_size,
        severity=severity,
        acknowledged=acknowledged,
    )


@router.post(
    "/events/{event_id}/acknowledge",
    response_model=AlertEventResponse,
    summary="Acknowledge an alert event",
    responses={
        200: {"description": "Event acknowledged."},
        404: {"description": "Event not found."},
    },
)
async def acknowledge_event(
    event_id: UUID,
    current_user: Annotated[AuthPayload, Depends(farmer_or_higher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AlertEventResponse:
    """Mark an alert event as acknowledged by the user.

    Acknowledged events are visually distinguished in the dashboard.
    This does NOT delete the event.
    """
    tenant_id = UUID(current_user.tenant_id)
    event = await _notification_service.acknowledge_event(
        event_id=event_id, tenant_id=tenant_id, db=db,
    )
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert event not found.",
        )
    return event
