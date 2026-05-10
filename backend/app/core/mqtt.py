"""
Async MQTT client for EMQX with automatic reconnect, topic routing, and graceful shutdown.

Uses gmqtt (pure async MQTT 5.0 client). The MQTTManager is initialized during
the FastAPI lifespan and connects to EMQX with TLS support and authentication.

Topic convention::

    farm/{tenant_id}/sensor/{sensor_id}/data   → QoS 1, telemetry payload
"""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Awaitable, Callable, Optional

from gmqtt import Client as MQTTClient  # type: ignore[import-untyped]

logger = logging.getLogger("crop.mqtt")

MessageCallback = Callable[[str, bytes], Awaitable[None]]
"""Signature: async callback(topic: str, payload: bytes) -> None."""


class MQTTManager:
    """Manages the async MQTT connection to EMQX with lifecycle hooks.

    Features:
        - TLS and username/password authentication
        - Automatic reconnect with exponential backoff + jitter
        - QoS 1 subscriptions (at-least-once delivery)
        - Graceful shutdown: flush pending, disconnect cleanly
        - Message callback routing to the ingestion service
    """

    def __init__(self) -> None:
        self._client: MQTTClient | None = None
        self._connected = False
        self._stopped = False
        self._initialized = False
        self._message_callback: MessageCallback | None = None
        self._reconnect_task: asyncio.Task[None] | None = None
        self._subscriptions: list[tuple[str, int]] = []

        # Connection parameters (stored for reconnect)
        self._host: str = ""
        self._port: int = 1883
        self._client_id: str = ""
        self._username: str | None = None
        self._password: str | None = None
        self._use_tls: bool = False

    @property
    def is_connected(self) -> bool:
        return self._connected

    @property
    def is_initialized(self) -> bool:
        return self._initialized

    def set_message_callback(self, callback: MessageCallback) -> None:
        """Register the async callback for incoming MQTT messages.

        The callback receives ``(topic, payload_bytes)`` and is expected to
        handle parsing, validation, and persistence.
        """
        self._message_callback = callback

    async def connect(
        self,
        host: str,
        port: int = 1883,
        client_id: str = "crop-backend",
        username: str | None = None,
        password: str | None = None,
        use_tls: bool = False,
    ) -> None:
        """Connect to the EMQX broker and start the message loop.

        Args:
            host: EMQX hostname or IP.
            port: MQTT port (1883 plain, 8883 TLS).
            client_id: Unique client identifier.
            username: EMQX authentication username.
            password: EMQX authentication password.
            use_tls: Enable TLS encryption.

        Raises:
            ConnectionError: If the initial connection attempt fails.
        """
        self._host = host
        self._port = port
        self._client_id = client_id
        self._username = username
        self._password = password
        self._use_tls = use_tls
        self._stopped = False

        logger.info(
            "Connecting to EMQX at %s:%s (client_id=%s, tls=%s)...",
            host, port, client_id, use_tls,
        )

        self._client = MQTTClient(client_id)

        # ── Register callbacks ───────────────────────────────
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message
        self._client.on_disconnect = self._on_disconnect

        try:
            await self._client.connect(
                host,
                port=port,
                ssl=use_tls,
                username=username,
                password=password,
                version=4,  # MQTT 3.1.1 (widely compatible)
            )
            self._connected = True
            self._initialized = True
            logger.info("Connected to EMQX successfully.")
        except Exception as exc:
            self._client = None
            raise ConnectionError(
                f"Failed to connect to EMQX at {host}:{port}: {exc}"
            ) from exc

    async def disconnect(self, flush: bool = True) -> None:
        """Gracefully shut down the MQTT connection.

        Args:
            flush: If True, wait for pending messages to be delivered
                   before disconnecting (recommended).
        """
        self._stopped = True

        if self._reconnect_task is not None and not self._reconnect_task.done():
            self._reconnect_task.cancel()
            try:
                await self._reconnect_task
            except asyncio.CancelledError:
                pass
            self._reconnect_task = None

        if self._client is not None and self._connected:
            logger.info("Disconnecting from EMQX (flush=%s)...", flush)
            try:
                if flush:
                    # Give a moment for pending ACKs to arrive
                    await asyncio.sleep(0.5)
                await self._client.disconnect()
            except Exception as exc:
                logger.warning("Error during MQTT disconnect: %s", exc)

        self._connected = False
        self._initialized = False
        logger.info("MQTT disconnected.")

    async def subscribe(self, topic: str, qos: int = 1) -> None:
        """Subscribe to an MQTT topic with the given QoS.

        The subscription is stored for automatic resubscription on reconnect.
        """
        self._subscriptions.append((topic, qos))
        if self._client is not None and self._connected:
            self._client.subscribe(topic, qos=qos)
            logger.info("Subscribed to %s (QoS %d).", topic, qos)

    async def publish(
        self, topic: str, payload: bytes | str, qos: int = 1
    ) -> None:
        """Publish a message to an MQTT topic."""
        if self._client is not None and self._connected:
            self._client.publish(topic, payload, qos=qos)

    # ── Internal callbacks ──────────────────────────────────

    def _on_connect(self, client: MQTTClient, flags: dict, rc: int, properties: dict) -> None:  # type: ignore[type-arg]
        """Callback when the client connects/reconnects to the broker.

        On reconnect, we automatically resubscribe to all stored topics.
        """
        self._connected = True
        logger.info(
            "MQTT connected (flags=%s, rc=%d, properties=%s).",
            flags, rc, properties,
        )
        # Resubscribe to all topics after reconnect
        for topic, qos in self._subscriptions:
            client.subscribe(topic, qos=qos)
            logger.debug("Resubscribed to %s (QoS %d).", topic, qos)

    def _on_message(
        self,
        client: MQTTClient,
        topic: str,
        payload: bytes,
        qos: int,
        properties: dict,
    ) -> None:  # type: ignore[type-arg]
        """Callback when a message arrives from the broker.

        Routes the message to the registered async callback via
        ``asyncio.create_task`` so the MQTT event loop is not blocked.
        """
        if self._message_callback is not None:
            asyncio.create_task(self._message_callback(topic, payload))
        else:
            logger.warning("No message callback registered — dropping message on %s.", topic)

    def _on_disconnect(self, client: MQTTClient, packet: Optional[dict], exc: Optional[Exception] = None) -> None:  # type: ignore[type-arg]
        """Callback when the client disconnects from the broker.

        Triggers automatic reconnection with exponential backoff + jitter
        unless a graceful shutdown was requested.
        """
        self._connected = False
        if exc is not None:
            logger.warning("MQTT disconnected unexpectedly: %s", exc)
        else:
            logger.info("MQTT disconnected cleanly.")

        if not self._stopped:
            logger.info("Starting reconnect loop...")
            self._reconnect_task = asyncio.create_task(self._reconnect_loop())

    async def _reconnect_loop(self) -> None:
        """Attempt reconnection with exponential backoff + jitter.

        Backoff starts at 1 second, doubles each attempt, and caps at 60
        seconds. Jitter is ±50% of the current backoff to avoid thundering
        herd.
        """
        backoff = 1.0
        max_backoff = 60.0

        while not self._stopped:
            jitter = random.uniform(0, 0.5 * backoff)
            wait = backoff + jitter
            logger.info("Reconnect attempt in %.1f seconds...", wait)

            await asyncio.sleep(wait)

            try:
                await self._client.connect(
                    self._host,
                    port=self._port,
                    ssl=self._use_tls,
                    username=self._username,
                    password=self._password,
                    version=4,
                )
                # on_connect will handle resubscription
                logger.info("Reconnected to EMQX successfully.")
                return
            except Exception as exc:
                logger.warning("Reconnect attempt failed: %s", exc)
                backoff = min(backoff * 2, max_backoff)

        logger.info("Reconnect loop stopped (shutdown requested).")


# Global singleton
mqtt_manager = MQTTManager()
