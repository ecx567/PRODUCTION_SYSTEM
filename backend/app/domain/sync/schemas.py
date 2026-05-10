"""
Pydantic schemas for the offline-first sync protocol.

Flow:
1. Mobile sends ``SyncRequest`` with its current revision + pending mutations
2. Server applies client mutations, returns ``SyncResponse`` with changes since requested revision
3. Mobile merges changes (LWW via updated_at) and acks pushed mutations
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


# ── Request Schemas ─────────────────────────────────────────────

class SyncMutation(BaseModel):
    """A single offline mutation from the mobile client."""

    table: str = Field(
        description="Affected table: fields | sensor_readings | alerts",
    )
    mutation_id: str = Field(description="Client-generated unique mutation ID.")
    action: str = Field(
        description="Mutation type: create | update | delete",
    )
    record_id: str = Field(description="UUID of the affected record.")
    data: dict[str, Any] = Field(
        default_factory=dict,
        description="JSON payload with the record data.",
    )
    base_rev: int = Field(
        default=0,
        description="Server revision at which the client last saw this record.",
    )
    client_rev: int = Field(
        default=1,
        description="Client-side revision for conflict detection.",
    )


class SyncRequest(BaseModel):
    """Body of the mobile sync request."""

    since_rev: int | None = Field(
        default=None,
        description="Server revision cursor. None = full initial sync.",
    )
    mutations: list[SyncMutation] = Field(
        default_factory=list,
        description="Pending mutations from the offline outbox.",
    )


# ── Response Schemas ────────────────────────────────────────────

class SyncChange(BaseModel):
    """A single changed record returned to the client."""

    table: str = Field(description="Table name.")
    action: str = Field(description="create | update | delete")
    record_id: str = Field(description="UUID of the record.")
    data: dict[str, Any] = Field(description="Full record data.")
    server_rev: int = Field(description="Server revision for this change.")


class SyncConflict(BaseModel):
    """A conflict where server version won but client data is preserved."""

    table: str
    record_id: str
    server_data: dict[str, Any]
    client_data: dict[str, Any]
    resolution: str = "server_wins"


class SyncResponse(BaseModel):
    """Response to a mobile sync request."""

    server_rev: int = Field(description="Current server revision after processing.")
    changes: list[SyncChange] = Field(
        description="All changes since the client's ``since_rev``.",
    )
    conflicts: list[SyncConflict] = Field(
        default_factory=list,
        description="Conflicts where server version was chosen.",
    )
