"""
SQLAlchemy ORM model for the Recommendation entity.

Maps to the ``recommendations`` table created in migration 004, with
lifecycle columns added in migration 007.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, String, Text, func
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Recommendation(Base):
    """A stored agronomic recommendation for a field.

    Lifecycle status (migration 007):
        - ``active`` (default): newly generated, awaiting farmer action
        - ``acknowledged``: farmer has seen the recommendation
        - ``dismissed``: farmer dismissed (not relevant / wrong timing)
        - ``applied``: farmer acted on the recommendation
    """

    __tablename__ = "recommendations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Recommendation type: irrigation | fertilization | pest_risk",
    )
    payload: Mapped[dict] = mapped_column(
        JSON(),
        nullable=False,
        comment="Full recommendation payload as JSON (JSONB in Postgres).",
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    applied_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the recommendation was applied by the farmer (null = pending).",
    )

    # ── Lifecycle columns (migration 007) ─────────────────────
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active",
        server_default="active",
        comment="Lifecycle status: active | acknowledged | dismissed | applied",
    )
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="info",
        server_default="info",
        comment="Severity level: info | low | medium | high | critical",
    )
    title: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Human-readable recommendation title.",
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the farmer acknowledged the recommendation.",
    )
    dismissed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the farmer dismissed the recommendation.",
    )

    def __repr__(self) -> str:
        return f"<Recommendation {self.id} ({self.type}) [{self.status}]>"
