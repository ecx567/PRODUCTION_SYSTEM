"""
Notification service: alert rule management, condition evaluation, dedup, Redis SSE publish.

The alert engine evaluates incoming sensor readings against enabled alert rules
and triggers events when conditions are met. Events are:
    1. Persisted to the ``alert_events`` table
    2. Published to Redis pub/sub channel for real-time SSE delivery
    3. Deduplicated: same rule + field won't re-trigger within the cooldown period
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from redis.asyncio import Redis as AsyncRedis
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.fields.schemas import ALLOWED_CROP_TYPES
from app.domain.notifications.models import AlertEvent, AlertRule
from app.domain.notifications.schemas import (
    AlertEventList,
    AlertEventResponse,
    AlertRuleCreate,
    AlertRuleList,
    AlertRuleResponse,
    AlertRuleUpdate,
    AlertSSEEvent,
)

logger = logging.getLogger("crop.notifications.service")

# Redis pub/sub channel for SSE alert delivery
REDIS_SSE_CHANNEL = "sse:alerts"

# Metric names we know how to evaluate
KNOWN_METRICS = {"temp", "humidity", "soil_moisture", "rain"}


class NotificationService:
    """Alert rule management and sensor reading evaluation."""

    # ═══════════════════════════════════════════════════════════
    # Alert Rule CRUD
    # ═══════════════════════════════════════════════════════════

    async def create_rule(
        self,
        data: AlertRuleCreate,
        tenant_id: UUID | str,
        db: AsyncSession,
    ) -> AlertRuleResponse:
        """Create a new alert rule."""
        rule = AlertRule(
            tenant_id=UUID(str(tenant_id)),
            field_id=data.field_id,
            name=data.name,
            metric_type=data.metric_type,
            condition=data.condition,
            threshold=data.threshold,
            threshold_max=data.threshold_max,
            severity=data.severity,
            enabled=data.enabled,
            cooldown_minutes=data.cooldown_minutes,
        )
        db.add(rule)
        await db.flush()
        await db.refresh(rule)
        logger.info("Alert rule created: id=%s name=%s", rule.id, rule.name)
        return AlertRuleResponse.model_validate(rule)

    async def update_rule(
        self,
        rule_id: UUID | str,
        data: AlertRuleUpdate,
        tenant_id: UUID | str,
        db: AsyncSession,
    ) -> AlertRuleResponse | None:
        """Update an alert rule. Returns ``None`` if not found."""
        stmt = select(AlertRule).where(
            AlertRule.id == UUID(str(rule_id)),
            AlertRule.tenant_id == UUID(str(tenant_id)),
        )
        result = await db.execute(stmt)
        rule = result.scalar_one_or_none()
        if rule is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(rule, key, value)

        await db.flush()
        await db.refresh(rule)
        logger.info("Alert rule updated: id=%s", rule.id)
        return AlertRuleResponse.model_validate(rule)

    async def delete_rule(
        self,
        rule_id: UUID | str,
        tenant_id: UUID | str,
        db: AsyncSession,
    ) -> bool:
        """Delete an alert rule. Returns ``True`` if deleted."""
        stmt = select(AlertRule).where(
            AlertRule.id == UUID(str(rule_id)),
            AlertRule.tenant_id == UUID(str(tenant_id)),
        )
        result = await db.execute(stmt)
        rule = result.scalar_one_or_none()
        if rule is None:
            return False

        await db.delete(rule)
        await db.flush()
        logger.info("Alert rule deleted: id=%s", rule_id)
        return True

    async def list_rules(
        self,
        tenant_id: UUID | str,
        db: AsyncSession,
    ) -> AlertRuleList:
        """List all alert rules for a tenant."""
        stmt = (
            select(AlertRule)
            .where(AlertRule.tenant_id == UUID(str(tenant_id)))
            .order_by(AlertRule.created_at.desc())
        )
        result = await db.execute(stmt)
        rows = result.scalars().all()
        return AlertRuleList(
            items=[AlertRuleResponse.model_validate(r) for r in rows],
            total=len(rows),
        )

    # ═══════════════════════════════════════════════════════════
    # Alert Event Management
    # ═══════════════════════════════════════════════════════════

    async def list_events(
        self,
        tenant_id: UUID | str,
        db: AsyncSession,
        cursor: str | None = None,
        page_size: int = 50,
        severity: str | None = None,
        acknowledged: bool | None = None,
    ) -> AlertEventList:
        """List alert events with cursor-based pagination and optional filters.

        Args:
            tenant_id:    Tenant scope.
            db:           DB session.
            cursor:       Opaque cursor (triggered_at ISO datetime).
            page_size:    Items per page (1–200).
            severity:     Optional filter by severity (info, warning, critical).
            acknowledged: Optional filter: ``True`` (acknowledged only),
                         ``False`` (unacknowledged only), ``None`` (all).

        Returns:
            Paginated ``AlertEventList``.
        """
        page_size = min(max(page_size, 1), 200)

        # Count query
        count_conditions = [AlertEvent.tenant_id == UUID(str(tenant_id))]
        if severity:
            count_conditions.append(AlertEvent.severity == severity)
        if acknowledged is True:
            count_conditions.append(AlertEvent.acknowledged_at.isnot(None))
        elif acknowledged is False:
            count_conditions.append(AlertEvent.acknowledged_at.is_(None))

        count_stmt = select(func.count(AlertEvent.id)).where(*count_conditions)
        total_result = await db.execute(count_stmt)
        total = total_result.scalar() or 0

        # Data query
        conditions = [AlertEvent.tenant_id == UUID(str(tenant_id))]
        if severity:
            conditions.append(AlertEvent.severity == severity)
        if acknowledged is True:
            conditions.append(AlertEvent.acknowledged_at.isnot(None))
        elif acknowledged is False:
            conditions.append(AlertEvent.acknowledged_at.is_(None))

        stmt = select(AlertEvent).where(*conditions)

        if cursor:
            try:
                cursor_dt = datetime.fromisoformat(cursor)
                stmt = stmt.where(AlertEvent.triggered_at < cursor_dt)
            except (ValueError, TypeError):
                logger.warning("Invalid event cursor: %s", cursor)

        stmt = stmt.order_by(AlertEvent.triggered_at.desc()).limit(page_size + 1)

        result = await db.execute(stmt)
        rows = result.scalars().all()

        items = [AlertEventResponse.model_validate(r) for r in rows[:page_size]]
        next_cursor: str | None = None
        if len(rows) > page_size:
            next_cursor = rows[page_size - 1].triggered_at.isoformat()

        return AlertEventList(items=items, next_cursor=next_cursor, total=total)

    async def acknowledge_event(
        self,
        event_id: UUID | str,
        tenant_id: UUID | str,
        db: AsyncSession,
    ) -> AlertEventResponse | None:
        """Mark an alert event as acknowledged. Returns ``None`` if not found."""
        stmt = select(AlertEvent).where(
            AlertEvent.id == UUID(str(event_id)),
            AlertEvent.tenant_id == UUID(str(tenant_id)),
        )
        result = await db.execute(stmt)
        event = result.scalar_one_or_none()
        if event is None:
            return None

        event.acknowledged_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(event)
        logger.info("Alert event acknowledged: id=%s", event.id)
        return AlertEventResponse.model_validate(event)

    # ═══════════════════════════════════════════════════════════
    # Direct Alert Event Creation (recommendation bridge)
    # ═══════════════════════════════════════════════════════════

    async def create_event(
        self,
        tenant_id: UUID | str,
        field_id: UUID | str,
        severity: str,
        message: str,
        db: AsyncSession,
        rule_id: UUID | None = None,
        metric_type: str = "recommendation",
        actual_value: float = 0.0,
        threshold: float = 0.0,
        redis: AsyncRedis | None = None,
    ) -> AlertEventResponse | None:
        """Create a direct alert event, bypassing rule evaluation.

        This is used by the recommendation engine's alert bridge to fire
        events for high/critical severity recommendations without requiring
        a pre-configured alert rule.

        If ``rule_id`` is not provided, the method attempts to find any
        enabled rule for the tenant. If none exists, the event is logged
        but not persisted.

        Returns the created ``AlertEventResponse`` or ``None`` if the
        event could not be persisted (e.g., no rule found, DB error).

        This method is intentionally non-blocking — callers should not
        depend on its result for their core logic.
        """
        tenant_uuid = UUID(str(tenant_id))
        field_uuid = UUID(str(field_id))

        try:
            # Resolve or find a rule
            if rule_id is not None:
                resolved_rule_id = UUID(str(rule_id))
            else:
                stmt = select(AlertRule).where(
                    AlertRule.tenant_id == tenant_uuid,
                    AlertRule.enabled.is_(True),
                ).limit(1)
                result = await db.execute(stmt)
                rule = result.scalar_one_or_none()
                if rule is None:
                    logger.warning(
                        "Cannot create alert event: no enabled alert rule found "
                        "for tenant %s",
                        tenant_id,
                    )
                    return None
                resolved_rule_id = rule.id

            now = datetime.now(timezone.utc)
            event = AlertEvent(
                tenant_id=tenant_uuid,
                rule_id=resolved_rule_id,
                field_id=field_uuid,
                metric_type=metric_type,
                actual_value=actual_value,
                threshold=threshold,
                severity=severity,
                message=message,
                triggered_at=now,
            )
            db.add(event)
            await db.flush()
            await db.refresh(event)

            event_response = AlertEventResponse.model_validate(event)
            logger.info(
                "Alert event created via bridge: field=%s severity=%s message='%s'",
                field_id, severity, message,
            )

            # Publish to Redis SSE if client provided
            if redis is not None:
                await self._publish_alert(redis, event_response)

            return event_response

        except Exception:
            logger.exception(
                "Failed to create alert event for field=%s severity=%s",
                field_id, severity,
            )
            return None

    # ═══════════════════════════════════════════════════════════
    # Alert Evaluation Engine
    # ═══════════════════════════════════════════════════════════

    async def evaluate_sensor_reading(
        self,
        tenant_id: UUID | str,
        field_id: UUID | str,
        metrics: dict[str, float | None],
        db: AsyncSession,
        redis: AsyncRedis | None = None,
    ) -> list[AlertEventResponse]:
        """Evaluate a sensor reading against all enabled rules for this tenant.

        This is called by the ingestion pipeline after a new sensor reading
        is persisted. Each metric in the reading is checked against matching
        rules. Triggered events are:
            - Persisted to the database
            - Published to the Redis SSE channel (if ``redis`` client is provided)

        Args:
            tenant_id: Tenant UUID.
            field_id:  Field UUID the reading belongs to.
            metrics:   Dict of metric_name → value (e.g., {"temp": 25.5, "humidity": 70.0}).
            db:        Async SQLAlchemy session.
            redis:     Optional Redis client for SSE publishing.

        Returns:
            List of newly triggered alert events.
        """
        tenant_uuid = UUID(str(tenant_id))
        field_uuid = UUID(str(field_id))

        # Find all enabled rules that apply to this field+tenant
        stmt = select(AlertRule).where(
            AlertRule.tenant_id == tenant_uuid,
            AlertRule.enabled.is_(True),
        ).where(
            # Rule applies to this field specifically OR is tenant-wide (field_id is NULL)
            (AlertRule.field_id == field_uuid) | (AlertRule.field_id.is_(None)),
        )
        result = await db.execute(stmt)
        rules = result.scalars().all()

        triggered: list[AlertEventResponse] = []
        now = datetime.now(timezone.utc)

        for rule in rules:
            metric_value = metrics.get(rule.metric_type)
            if metric_value is None:
                # Metric not reported in this reading — skip
                continue

            if not self._check_condition(
                condition=rule.condition,
                value=metric_value,
                threshold=rule.threshold,
                threshold_max=rule.threshold_max,
            ):
                continue

            # ── Dedup check ──────────────────────────────────
            if await self._is_duplicate(rule.id, field_uuid, rule.cooldown_minutes, db):
                logger.debug(
                    "Skipping duplicate alert: rule=%s field=%s (cooldown=%d min)",
                    rule.id, field_uuid, rule.cooldown_minutes,
                )
                continue

            # ── Build message ────────────────────────────────
            message = self._build_alert_message(
                rule_name=rule.name,
                metric_type=rule.metric_type,
                actual_value=metric_value,
                condition=rule.condition,
                threshold=rule.threshold,
            )

            # ── Persist event ────────────────────────────────
            event = AlertEvent(
                tenant_id=tenant_uuid,
                rule_id=rule.id,
                field_id=field_uuid,
                metric_type=rule.metric_type,
                actual_value=metric_value,
                threshold=rule.threshold,
                severity=rule.severity,
                message=message,
                triggered_at=now,
            )
            db.add(event)
            await db.flush()
            await db.refresh(event)

            event_response = AlertEventResponse.model_validate(event)
            triggered.append(event_response)

            logger.info(
                "Alert triggered: rule=%s field=%s %s=%.2f condition=%s threshold=%.2f severity=%s",
                rule.id, field_uuid, rule.metric_type, metric_value,
                rule.condition, rule.threshold, rule.severity,
            )

            # ── Publish to Redis SSE channel ─────────────────
            if redis is not None:
                await self._publish_alert(redis, event_response)

        return triggered

    # ═══════════════════════════════════════════════════════════
    # Internal Helpers
    # ═══════════════════════════════════════════════════════════

    @staticmethod
    def _check_condition(
        condition: str,
        value: float,
        threshold: float,
        threshold_max: float | None = None,
    ) -> bool:
        """Evaluate a single condition against a value."""
        if condition == "gt":
            return value > threshold
        elif condition == "lt":
            return value < threshold
        elif condition == "eq":
            return abs(value - threshold) < 0.001  # fuzzy compare
        elif condition == "between":
            if threshold_max is None:
                return False
            return threshold <= value <= threshold_max
        else:
            logger.warning("Unknown condition: %s", condition)
            return False

    @staticmethod
    async def _is_duplicate(
        rule_id: UUID,
        field_id: UUID,
        cooldown_minutes: int,
        db: AsyncSession,
    ) -> bool:
        """Check if an alert was recently triggered for this rule+field pair.

        Returns ``True`` if a matching event exists within the cooldown window.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=cooldown_minutes)
        stmt = select(func.count(AlertEvent.id)).where(
            AlertEvent.rule_id == rule_id,
            AlertEvent.field_id == field_id,
            AlertEvent.triggered_at >= cutoff,
        )
        result = await db.execute(stmt)
        count = result.scalar() or 0
        return count > 0

    @staticmethod
    def _build_alert_message(
        rule_name: str,
        metric_type: str,
        actual_value: float,
        condition: str,
        threshold: float,
    ) -> str:
        """Build a human-readable alert message."""
        metric_labels = {
            "temp": "Temperature",
            "humidity": "Humidity",
            "soil_moisture": "Soil Moisture",
            "rain": "Rainfall",
        }
        label = metric_labels.get(metric_type, metric_type.capitalize())

        condition_labels = {
            "gt": f"exceeded {threshold}",
            "lt": f"dropped below {threshold}",
            "eq": f"reached {threshold}",
            "between": "out of expected range",
        }
        cond_label = condition_labels.get(condition, condition)
        units = {
            "temp": "°C",
            "humidity": "%",
            "soil_moisture": "%",
            "rain": "mm",
        }
        unit = units.get(metric_type, "")

        return (
            f"[{rule_name}] {label} {actual_value}{unit} {cond_label}{unit}. "
            f"Current value: {actual_value}{unit}, Threshold: {threshold}{unit}."
        )

    @staticmethod
    async def _publish_alert(redis: AsyncRedis, event: AlertEventResponse) -> None:
        """Publish an alert event to the Redis SSE channel."""
        sse_payload = AlertSSEEvent(
            event="alert",
            data=event,
        )
        message = sse_payload.model_dump_json()
        await redis.publish(REDIS_SSE_CHANNEL, message)
        logger.debug("Published alert to Redis channel %s: id=%s", REDIS_SSE_CHANNEL, event.id)
