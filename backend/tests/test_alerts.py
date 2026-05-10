"""
Tests for the Alert Engine: rule CRUD, evaluation, dedup, tenant isolation.

Covers tasks 3.2 and 3.5 from the apply spec.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


# ═══════════════════════════════════════════════════════════════
# Service-level tests — Alert Rule CRUD
# ═══════════════════════════════════════════════════════════════

class TestAlertRulesService:
    """Tests for NotificationService alert rule CRUD."""

    async def test_create_rule(
        self,
        notification_service,
        tenant_id: UUID,
        db_session: AsyncSession,
        sample_alert_rule_create: dict,
    ):
        """A valid alert rule is created and returned with an ID."""
        from app.domain.notifications.schemas import AlertRuleCreate
        data = AlertRuleCreate(**sample_alert_rule_create)
        result = await notification_service.create_rule(data, tenant_id, db_session)
        assert result.id is not None
        assert result.name == "High Temperature"
        assert result.metric_type == "temp"
        assert result.condition == "gt"
        assert result.threshold == 35.0
        assert result.severity == "warning"
        assert result.enabled is True

    async def test_list_rules(
        self,
        notification_service,
        tenant_id: UUID,
        db_session: AsyncSession,
        sample_alert_rule_create: dict,
        sample_alert_rule_low_humidity: dict,
    ):
        """Listing rules returns all created rules for the tenant."""
        from app.domain.notifications.schemas import AlertRuleCreate
        await notification_service.create_rule(
            AlertRuleCreate(**sample_alert_rule_create), tenant_id, db_session,
        )
        await notification_service.create_rule(
            AlertRuleCreate(**sample_alert_rule_low_humidity), tenant_id, db_session,
        )

        rule_list = await notification_service.list_rules(tenant_id, db_session)
        assert rule_list.total == 2
        assert len(rule_list.items) == 2

    async def test_update_rule(
        self,
        notification_service,
        tenant_id: UUID,
        db_session: AsyncSession,
        sample_alert_rule_create: dict,
    ):
        """Updating a rule changes only specified fields."""
        from app.domain.notifications.schemas import AlertRuleCreate, AlertRuleUpdate
        created = await notification_service.create_rule(
            AlertRuleCreate(**sample_alert_rule_create), tenant_id, db_session,
        )
        updated = await notification_service.update_rule(
            created.id,
            AlertRuleUpdate(threshold=40.0, severity="critical"),
            tenant_id, db_session,
        )
        assert updated is not None
        assert updated.threshold == 40.0
        assert updated.severity == "critical"
        assert updated.name == "High Temperature"  # unchanged

    async def test_delete_rule(
        self,
        notification_service,
        tenant_id: UUID,
        db_session: AsyncSession,
        sample_alert_rule_create: dict,
    ):
        """Deleting a rule removes it from the list."""
        from app.domain.notifications.schemas import AlertRuleCreate
        created = await notification_service.create_rule(
            AlertRuleCreate(**sample_alert_rule_create), tenant_id, db_session,
        )
        deleted = await notification_service.delete_rule(created.id, tenant_id, db_session)
        assert deleted is True

        rule_list = await notification_service.list_rules(tenant_id, db_session)
        assert rule_list.total == 0

    async def test_tenant_isolation_rules(
        self,
        notification_service,
        tenant_id: UUID,
        other_tenant_id: UUID,
        db_session: AsyncSession,
        sample_alert_rule_create: dict,
        sample_alert_rule_low_humidity: dict,
    ):
        """Rules from one tenant are invisible to another."""
        from app.domain.notifications.schemas import AlertRuleCreate
        await notification_service.create_rule(
            AlertRuleCreate(**sample_alert_rule_create), tenant_id, db_session,
        )
        await notification_service.create_rule(
            AlertRuleCreate(**sample_alert_rule_low_humidity), other_tenant_id, db_session,
        )

        tenant_a_rules = await notification_service.list_rules(tenant_id, db_session)
        assert tenant_a_rules.total == 1
        assert tenant_a_rules.items[0].name == "High Temperature"

        tenant_b_rules = await notification_service.list_rules(other_tenant_id, db_session)
        assert tenant_b_rules.total == 1
        assert tenant_b_rules.items[0].name == "Low Humidity"


# ═══════════════════════════════════════════════════════════════
# Service-level tests — Alert Evaluation & Dedup
# ═══════════════════════════════════════════════════════════════

class TestAlertEvaluation:
    """Tests for the alert evaluation engine."""

    async def test_evaluate_gt_triggers_alert(
        self,
        notification_service,
        tenant_id: UUID,
        db_session: AsyncSession,
        sample_alert_rule_create: dict,
    ):
        """A reading exceeding a gt threshold triggers an alert."""
        from app.domain.notifications.schemas import AlertRuleCreate
        await notification_service.create_rule(
            AlertRuleCreate(**sample_alert_rule_create), tenant_id, db_session,
        )

        field_id = UUID("660e8400-e29b-41d4-a716-446655440001")
        events = await notification_service.evaluate_sensor_reading(
            tenant_id=tenant_id,
            field_id=field_id,
            metrics={"temp": 38.0},  # threshold is 35.0
            db=db_session,
        )
        assert len(events) == 1
        assert events[0].metric_type == "temp"
        assert events[0].actual_value == 38.0
        assert events[0].severity == "warning"

    async def test_evaluate_lt_triggers_alert(
        self,
        notification_service,
        tenant_id: UUID,
        db_session: AsyncSession,
        sample_alert_rule_low_humidity: dict,
    ):
        """A reading below a lt threshold triggers an alert."""
        from app.domain.notifications.schemas import AlertRuleCreate
        await notification_service.create_rule(
            AlertRuleCreate(**sample_alert_rule_low_humidity), tenant_id, db_session,
        )

        field_id = UUID("660e8400-e29b-41d4-a716-446655440001")
        events = await notification_service.evaluate_sensor_reading(
            tenant_id=tenant_id,
            field_id=field_id,
            metrics={"humidity": 20.0},  # threshold is 30.0
            db=db_session,
        )
        assert len(events) == 1
        assert events[0].metric_type == "humidity"
        assert events[0].severity == "critical"

    async def test_no_alert_when_within_threshold(
        self,
        notification_service,
        tenant_id: UUID,
        db_session: AsyncSession,
        sample_alert_rule_create: dict,
    ):
        """A reading within threshold does NOT trigger an alert."""
        from app.domain.notifications.schemas import AlertRuleCreate
        await notification_service.create_rule(
            AlertRuleCreate(**sample_alert_rule_create), tenant_id, db_session,
        )

        field_id = UUID("660e8400-e29b-41d4-a716-446655440001")
        events = await notification_service.evaluate_sensor_reading(
            tenant_id=tenant_id,
            field_id=field_id,
            metrics={"temp": 25.0},  # below 35.0
            db=db_session,
        )
        assert len(events) == 0

    async def test_tenant_wide_rule_applies_to_all_fields(
        self,
        notification_service,
        tenant_id: UUID,
        db_session: AsyncSession,
        sample_alert_rule_create: dict,
    ):
        """A rule with field_id=NULL applies tenant-wide."""
        from app.domain.notifications.schemas import AlertRuleCreate
        # Explicitly set field_id=None
        data = AlertRuleCreate(**{**sample_alert_rule_create, "field_id": None})
        await notification_service.create_rule(data, tenant_id, db_session)

        field_a = UUID("660e8400-e29b-41d4-a716-446655440001")
        field_b = UUID("770e8400-e29b-41d4-a716-446655440002")

        events_a = await notification_service.evaluate_sensor_reading(
            tenant_id=tenant_id, field_id=field_a,
            metrics={"temp": 38.0}, db=db_session,
        )
        events_b = await notification_service.evaluate_sensor_reading(
            tenant_id=tenant_id, field_id=field_b,
            metrics={"temp": 38.0}, db=db_session,
        )
        assert len(events_a) == 1
        assert len(events_b) == 1

    async def test_dedup_within_cooldown(
        self,
        notification_service,
        tenant_id: UUID,
        db_session: AsyncSession,
    ):
        """Same rule+field does NOT trigger duplicate alerts within cooldown."""
        from app.domain.notifications.schemas import AlertRuleCreate
        data = AlertRuleCreate(
            name="Test Dedup",
            metric_type="temp",
            condition="gt",
            threshold=30.0,
            severity="warning",
            cooldown_minutes=15,
        )
        await notification_service.create_rule(data, tenant_id, db_session)

        field_id = UUID("660e8400-e29b-41d4-a716-446655440001")

        # First trigger
        events1 = await notification_service.evaluate_sensor_reading(
            tenant_id=tenant_id, field_id=field_id,
            metrics={"temp": 35.0}, db=db_session,
        )
        assert len(events1) == 1

        # Second trigger (within cooldown) — should be deduped
        events2 = await notification_service.evaluate_sensor_reading(
            tenant_id=tenant_id, field_id=field_id,
            metrics={"temp": 40.0}, db=db_session,
        )
        assert len(events2) == 0

    async def test_no_dedup_across_different_fields(
        self,
        notification_service,
        tenant_id: UUID,
        db_session: AsyncSession,
    ):
        """Different fields under the same tenant-wide rule both trigger alerts."""
        from app.domain.notifications.schemas import AlertRuleCreate
        data = AlertRuleCreate(
            name="Cross Field",
            metric_type="temp",
            condition="gt",
            threshold=30.0,
            severity="warning",
            field_id=None,
            cooldown_minutes=15,
        )
        await notification_service.create_rule(data, tenant_id, db_session)

        field_a = UUID("660e8400-e29b-41d4-a716-446655440001")
        field_b = UUID("770e8400-e29b-41d4-a716-446655440002")

        events_a = await notification_service.evaluate_sensor_reading(
            tenant_id=tenant_id, field_id=field_a,
            metrics={"temp": 35.0}, db=db_session,
        )
        events_b = await notification_service.evaluate_sensor_reading(
            tenant_id=tenant_id, field_id=field_b,
            metrics={"temp": 35.0}, db=db_session,
        )
        assert len(events_a) == 1
        assert len(events_b) == 1

    async def test_publishes_to_redis(
        self,
        notification_service,
        tenant_id: UUID,
        db_session: AsyncSession,
        sample_alert_rule_create: dict,
    ):
        """Alert events are published to Redis when a Redis client is provided."""
        from app.domain.notifications.schemas import AlertRuleCreate
        await notification_service.create_rule(
            AlertRuleCreate(**sample_alert_rule_create), tenant_id, db_session,
        )

        mock_redis = AsyncMock()
        field_id = UUID("660e8400-e29b-41d4-a716-446655440001")

        events = await notification_service.evaluate_sensor_reading(
            tenant_id=tenant_id,
            field_id=field_id,
            metrics={"temp": 38.0},
            db=db_session,
            redis=mock_redis,
        )
        assert len(events) == 1
        # Redis publish should have been called
        mock_redis.publish.assert_awaited_once()

    async def test_acknowledge_event(
        self,
        notification_service,
        tenant_id: UUID,
        db_session: AsyncSession,
        sample_alert_rule_create: dict,
    ):
        """Acknowledging an event sets its acknowledged_at timestamp."""
        from app.domain.notifications.schemas import AlertRuleCreate
        await notification_service.create_rule(
            AlertRuleCreate(**sample_alert_rule_create), tenant_id, db_session,
        )

        field_id = UUID("660e8400-e29b-41d4-a716-446655440001")
        events = await notification_service.evaluate_sensor_reading(
            tenant_id=tenant_id, field_id=field_id,
            metrics={"temp": 38.0}, db=db_session,
        )
        assert len(events) == 1
        event_id = events[0].id

        # Acknowledge
        ack = await notification_service.acknowledge_event(event_id, tenant_id, db_session)
        assert ack is not None
        assert ack.acknowledged_at is not None

    async def test_list_events_pagination(
        self,
        notification_service,
        tenant_id: UUID,
        db_session: AsyncSession,
    ):
        """Alert events support cursor-based pagination."""
        from app.domain.notifications.schemas import AlertRuleCreate
        data = AlertRuleCreate(
            name="Pagination Test",
            metric_type="temp",
            condition="gt",
            threshold=20.0,
            severity="info",
        )
        await notification_service.create_rule(data, tenant_id, db_session)

        field_id = UUID("660e8400-e29b-41d4-a716-446655440001")
        # Trigger multiple events with different metrics
        for temp in [25.0, 26.0, 27.0, 28.0, 29.0]:
            # Need a new session state — use different field to avoid dedup
            # OR just rely on the dedup being per-rule+field; since same field, this won't
            # create new events. Let's use the field-specific approach.
            pass

        # Trigger 3 events on different fields to avoid dedup
        events_created = []
        for i in range(3):
            fid = UUID(f"660e8400-e29b-41d4-a716-44665544000{i}")
            ev = await notification_service.evaluate_sensor_reading(
                tenant_id=tenant_id, field_id=fid,
                metrics={"temp": 30.0}, db=db_session,
            )
            events_created.extend(ev)

        assert len(events_created) >= 3

        # First page: 2 items
        page1 = await notification_service.list_events(tenant_id, db_session, page_size=2)
        assert len(page1.items) == 2
        assert page1.next_cursor is not None
        assert page1.total >= 3

        # Second page
        page2 = await notification_service.list_events(
            tenant_id, db_session, cursor=page1.next_cursor, page_size=2,
        )
        assert len(page2.items) >= 1


# ═══════════════════════════════════════════════════════════════
# API-level tests
# ═══════════════════════════════════════════════════════════════

class TestAlertsAPI:
    """Tests for the Alert REST API endpoints."""

    async def test_create_rule_api(
        self,
        client: AsyncClient,
        agronomist_token: str,
        sample_alert_rule_create: dict,
    ):
        """POST /api/v1/alerts/rules returns 201 for agronomist."""
        headers = {"Authorization": f"Bearer {agronomist_token}"}
        response = await client.post(
            "/api/v1/alerts/rules",
            json=sample_alert_rule_create,
            headers=headers,
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "High Temperature"
        assert data["metric_type"] == "temp"
        assert "id" in data

    async def test_create_rule_requires_agronomist(
        self,
        client: AsyncClient,
        farmer_token: str,
        sample_alert_rule_create: dict,
    ):
        """POST /api/v1/alerts/rules with farmer role returns 403."""
        headers = {"Authorization": f"Bearer {farmer_token}"}
        response = await client.post(
            "/api/v1/alerts/rules",
            json=sample_alert_rule_create,
            headers=headers,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    async def test_list_rules_api(
        self,
        client: AsyncClient,
        farmer_token: str,
        agronomist_token: str,
        sample_alert_rule_create: dict,
    ):
        """GET /api/v1/alerts/rules returns rules list."""
        # Create rule as agronomist (farmers cannot create rules)
        agronomist_headers = {"Authorization": f"Bearer {agronomist_token}"}
        await client.post(
            "/api/v1/alerts/rules",
            json=sample_alert_rule_create,
            headers=agronomist_headers,
        )

        # List as farmer (reading is allowed for all authenticated)
        headers = {"Authorization": f"Bearer {farmer_token}"}
        response = await client.get("/api/v1/alerts/rules", headers=headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "items" in data
        assert len(data["items"]) >= 1

    async def test_delete_rule_api(
        self,
        client: AsyncClient,
        agronomist_token: str,
        sample_alert_rule_create: dict,
    ):
        """DELETE /api/v1/alerts/rules/{id} returns 204."""
        headers = {"Authorization": f"Bearer {agronomist_token}"}
        create_resp = await client.post(
            "/api/v1/alerts/rules",
            json=sample_alert_rule_create,
            headers=headers,
        )
        rule_id = create_resp.json()["id"]

        response = await client.delete(
            f"/api/v1/alerts/rules/{rule_id}",
            headers=headers,
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

    async def test_list_events_api(
        self,
        client: AsyncClient,
        farmer_token: str,
        sample_alert_rule_create: dict,
    ):
        """GET /api/v1/alerts/events returns paginated events."""
        headers = {"Authorization": f"Bearer {farmer_token}"}
        response = await client.get("/api/v1/alerts/events", headers=headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "items" in data
        assert "next_cursor" in data
