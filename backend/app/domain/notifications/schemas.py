"""
Pydantic schemas for the alert engine: alert rules and alert events.

Provides request/response schemas for rule CRUD and event listing.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── Alert Rule Schemas ─────────────────────────────────────

class AlertRuleCreate(BaseModel):
    """Payload for creating a new alert rule."""

    name: str = Field(
        ..., min_length=1, max_length=255,
        description="Human-readable rule name.",
    )
    field_id: UUID | None = Field(
        default=None,
        description="Field to scope the rule to. NULL = tenant-wide.",
    )
    metric_type: str = Field(
        ..., description="Metric to monitor: temp, humidity, soil_moisture, rain, etc.",
    )
    condition: str = Field(
        ..., description="Comparison operator: gt | lt | eq | between.",
    )
    threshold: float = Field(
        ..., description="Primary threshold value.",
    )
    threshold_max: float | None = Field(
        default=None,
        description="Upper bound for 'between' condition.",
    )
    severity: str = Field(
        default="warning",
        description="Severity level: info | warning | critical.",
    )
    enabled: bool = Field(
        default=True,
        description="Whether the rule is active.",
    )
    cooldown_minutes: int = Field(
        default=15, ge=1, le=1440,
        description="Minutes between consecutive alerts from this rule+field.",
    )


class AlertRuleUpdate(BaseModel):
    """Payload for updating an alert rule. All fields optional."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    field_id: UUID | None = None
    metric_type: str | None = None
    condition: str | None = None
    threshold: float | None = None
    threshold_max: float | None = None
    severity: str | None = None
    enabled: bool | None = None
    cooldown_minutes: int | None = Field(default=None, ge=1, le=1440)


class AlertRuleResponse(BaseModel):
    """A single alert rule as returned by the API."""

    id: UUID
    tenant_id: UUID
    field_id: UUID | None = None
    name: str
    metric_type: str
    condition: str
    threshold: float
    threshold_max: float | None = None
    severity: str
    enabled: bool
    cooldown_minutes: int = 15
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Alert Event Schemas ────────────────────────────────────

class AlertEventResponse(BaseModel):
    """A triggered alert event as returned by the API."""

    id: UUID
    rule_id: UUID
    field_id: UUID
    metric_type: str
    actual_value: float
    threshold: float
    severity: str
    message: str
    triggered_at: datetime
    acknowledged_at: datetime | None = None

    model_config = {"from_attributes": True}


class AlertEventList(BaseModel):
    """Paginated list of alert events."""

    items: list[AlertEventResponse]
    next_cursor: str | None = Field(
        default=None,
        description="Opaque cursor for the next page. NULL means last page.",
    )
    total: int = Field(default=0, description="Total number of events matching the filter.")


class AlertRuleList(BaseModel):
    """List of alert rules."""

    items: list[AlertRuleResponse]
    total: int = Field(default=0, description="Total number of rules.")


# ── SSE Event Schema ───────────────────────────────────────

class AlertSSEEvent(BaseModel):
    """Payload published to the Redis SSE channel for real-time delivery."""

    event: str = "alert"
    data: AlertEventResponse
