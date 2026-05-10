"""
SQLAlchemy ORM model for the Field entity.

Maps to the ``fields`` table created in migration 001.
Supports soft-delete via ``deleted_at``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Field(Base):
    __tablename__ = "fields"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    crop_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Validated by Pydantic schema: banana|maize|cacao|rice.",
    )
    planted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    area_ha: Mapped[float] = mapped_column(
        Float(),
        nullable=False,
        server_default="0.0",
    )
    location: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="WKT or geo coordinates.",
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Soft-delete timestamp. NULL means active.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Field {self.name} ({self.crop_type})>"
