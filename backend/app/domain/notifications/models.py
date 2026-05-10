"""
SQLAlchemy ORM models for the alert engine.

Two tables:
    - ``alert_rules``: user-configurable threshold rules
    - ``alert_events``: triggered alert instances

Both are tenant-scoped via ``tenant_id`` for RLS.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AlertRule(Base):
    """User-configurable alert rule.

    Each rule defines a condition on a sensor metric that triggers an alert
    event when met. Rules can be scoped to a specific field or apply tenant-wide
    (when ``field_id`` is NULL).
    """

    __tablename__ = "alert_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    field_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fields.id", ondelete="SET NULL"),
        nullable=True,
        comment="NULL means the rule applies tenant-wide.",
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    metric_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Metric to monitor: temp, humidity, soil_moisture, rain, etc.",
    )
    condition: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Comparison operator: gt | lt | eq | between.",
    )
    threshold: Mapped[float] = mapped_column(
        Float(),
        nullable=False,
        comment="Primary threshold value.",
    )
    threshold_max: Mapped[float | None] = mapped_column(
        Float(),
        nullable=True,
        comment="Upper bound for 'between' condition.",
    )
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="warning",
        comment="Severity level: info | warning | critical.",
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean(),
        nullable=False,
        default=True,
        server_default="TRUE",
    )
    cooldown_minutes: Mapped[int] = mapped_column(
        Integer(),
        nullable=False,
        default=15,
        server_default="15",
        comment="Minimum minutes between consecutive alerts from this rule+field.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<AlertRule {self.name}: {self.metric_type} {self.condition} {self.threshold}"
            f" ({self.severity})>"
        )


class AlertEvent(Base):
    """A triggered alert instance.

    Created when an enabled rule's condition is met by incoming sensor data.
    Events can be acknowledged by the user.
    """

    __tablename__ = "alert_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("alert_rules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fields.id", ondelete="CASCADE"),
        nullable=False,
    )
    metric_type: Mapped[str] = mapped_column(String(50), nullable=False)
    actual_value: Mapped[float] = mapped_column(Float(), nullable=False)
    threshold: Mapped[float] = mapped_column(Float(), nullable=False)
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="warning",
    )
    message: Mapped[str] = mapped_column(Text(), nullable=False)
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the user acknowledged this alert. NULL = unacknowledged.",
    )

    def __repr__(self) -> str:
        return (
            f"<AlertEvent rule={self.rule_id} {self.metric_type}={self.actual_value}"
            f" ({self.severity})>"
        )
