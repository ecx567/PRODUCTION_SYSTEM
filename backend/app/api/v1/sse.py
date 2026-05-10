"""
Server-Sent Events (SSE) endpoint for real-time alert delivery.

Architecture:
    Alert Engine (NotificationService) → Redis pub/sub → SSE Endpoint → Client

The SSE endpoint:
    - Subscribes to a Redis pub/sub channel (``sse:alerts``)
    - Forwards alert events to connected clients as SSE messages
    - Sends a heartbeat every 30 seconds to keep the connection alive
    - Filters events by tenant_id (multi-tenant SSE)

Clients connect using the native ``EventSource`` API which handles
auto-reconnection automatically.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Annotated, AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Depends
from redis.asyncio import Redis as AsyncRedis
from sse_starlette.sse import EventSourceResponse

from app.core.redis import get_redis
from app.domain.auth.middleware import (
    AuthPayload,
    get_current_user,
)
from app.domain.notifications.service import REDIS_SSE_CHANNEL

logger = logging.getLogger("crop.api.sse")

router = APIRouter(tags=["SSE"])

# Heartbeat interval (seconds)
HEARTBEAT_INTERVAL = 30

# Redis pub/sub reconnect delay (seconds)
RECONNECT_DELAY = 5


@router.get(
    "/alerts/stream",
    summary="SSE stream for real-time alert events",
    responses={
        200: {
            "description": "SSE event stream. Returns ``text/event-stream``.",
            "content": {
                "text/event-stream": {
                    "example": (
                        "event: alert\\n"
                        'data: {"id":"...","severity":"warning",...}\\n\\n'
                        "event: heartbeat\\n"
                        'data: {"time":"2026-05-10T14:30:00Z"}\\n\\n'
                    ),
                }
            },
        },
    },
)
async def alert_sse_stream(
    current_user: Annotated[AuthPayload, Depends(get_current_user)],
    redis: Annotated[AsyncRedis, Depends(get_redis)],
):
    """Subscribe to real-time alert events via Server-Sent Events.

    This endpoint keeps an open HTTP connection and pushes alert events
    to the client as they are published by the alert engine.

    **Events**:

    - ``alert`` — A new alert event was triggered. ``data`` contains the
      full ``AlertEventResponse`` JSON.
    - ``heartbeat`` — Sent every 30 seconds to keep the connection alive.
      Clients can use this to detect stale connections.

    **Client example** (JavaScript)::

        const source = new EventSource("/api/v1/alerts/stream", {
            withCredentials: true,
        });
        source.addEventListener("alert", (e) => {
            const alert = JSON.parse(e.data);
            console.log("Alert:", alert.message);
        });
        source.addEventListener("heartbeat", (e) => {
            // connection is alive
        });
        source.onerror = () => {
            // EventSource auto-reconnects natively
        };

    **Multi-tenant filtering**: Only alerts belonging to the authenticated
    user's tenant are delivered.
    """
    tenant_id = current_user.tenant_id

    async def event_generator() -> AsyncGenerator[dict, None]:
        """Generate SSE events from the Redis pub/sub channel."""
        pubsub = redis.pubsub()
        await pubsub.subscribe(REDIS_SSE_CHANNEL)
        logger.info(
            "SSE client connected: user=%s tenant=%s",
            current_user.user_id, tenant_id,
        )

        try:
            while True:
                # Wait for either a Redis message or heartbeat timeout
                try:
                    message = await asyncio.wait_for(
                        pubsub.get_message(ignore_subscribe_messages=True),
                        timeout=HEARTBEAT_INTERVAL,
                    )
                except asyncio.TimeoutError:
                    # Heartbeat: keep connection alive
                    yield {
                        "event": "heartbeat",
                        "data": json.dumps({"time": asyncio.get_event_loop().time()}),
                    }
                    continue

                if message is None:
                    continue

                if message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")

                    try:
                        payload = json.loads(data)
                    except json.JSONDecodeError:
                        logger.warning("Invalid SSE payload: %s", data)
                        continue

                    # Multi-tenant filter: only deliver events for this tenant
                    event_tenant = (
                        payload.get("data", {}).get("tenant_id")
                        if isinstance(payload, dict)
                        else None
                    )
                    if event_tenant is not None and event_tenant != tenant_id:
                        continue

                    yield {
                        "event": payload.get("event", "alert"),
                        "data": json.dumps(payload.get("data", payload)),
                    }

        except asyncio.CancelledError:
            logger.info("SSE client disconnected: tenant=%s", tenant_id)
        finally:
            await pubsub.unsubscribe(REDIS_SSE_CHANNEL)
            await pubsub.reset()

    return EventSourceResponse(event_generator())
