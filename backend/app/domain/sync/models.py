"""
SQLAlchemy model for the sync_revision tracker.

A single-row table that holds a monotonically increasing revision counter.
Every data mutation increments this counter, allowing efficient "changes since X"
queries for the mobile offline-first sync protocol.
"""

from __future__ import annotations

from sqlalchemy import BigInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SyncRevision(Base):
    """Global revision counter for incremental sync.

    This table stores a single row with a monotonically increasing integer.
    Every mutation (field create/update/delete, alert trigger, sensor write)
    increments this value BEFORE committing.

    The mobile client tracks its last known revision and sends it with each
    sync request. The server returns all changes that occurred after that revision.

    Strategy:
        - ``SELECT ... FOR UPDATE`` to atomically increment
        - Single-row pattern: ``INSERT ... ON CONFLICT DO UPDATE``
        - Initial value = 0 (no changes since epoch)
    """

    __tablename__ = "sync_revision"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=False,
        default=1,
        doc="Always 1 — single-row pattern.",
    )
    revision: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
        doc="Monotonically increasing revision counter.",
    )
    updated_at: Mapped[str] = mapped_column(
        String(32),
        server_default=func.datetime("now"),
        nullable=False,
        doc="Last update timestamp (ISO 8601).",
    )
