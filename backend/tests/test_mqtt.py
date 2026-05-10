"""
Tests for the MQTT client: connection, reconnection, graceful shutdown.

Uses mocked gmqtt Client to avoid requiring a running EMQX broker.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.mqtt import MQTTManager


class TestMQTTManager:
    """Test MQTTManager connection lifecycle."""

    @pytest.mark.asyncio
    async def test_connect_success(self, mock_mqtt_manager):
        """Connect to EMQX → is_connected must be True."""
        await mock_mqtt_manager.connect(
            host="localhost",
            port=1883,
            client_id="test-client",
            username="admin",
            password="admin",
        )
        # After connect, the on_connect callback would fire
        mock_mqtt_manager._client.connect.assert_called_once()
        # Simulate on_connect
        mock_mqtt_manager._on_connect(
            mock_mqtt_manager._client, {}, 0, {}
        )
        assert mock_mqtt_manager.is_connected is True
        assert mock_mqtt_manager.is_initialized is True

    @pytest.mark.asyncio
    async def test_connect_failure_raises(self):
        """Connection failure must raise ConnectionError."""
        with patch("app.core.mqtt.MQTTClient") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.connect = AsyncMock(
                side_effect=ConnectionError("EMQX unreachable")
            )
            mock_client_cls.return_value = mock_client

            manager = MQTTManager()
            with pytest.raises(ConnectionError):
                await manager.connect(
                    host="unreachable",
                    port=1883,
                    client_id="test-client",
                )

    @pytest.mark.asyncio
    async def test_subscribe(self, mock_mqtt_manager):
        """Subscribe must call client.subscribe with correct QoS."""
        # Connect first
        await mock_mqtt_manager.connect("localhost", 1883, "test-client")
        mock_mqtt_manager._on_connect(mock_mqtt_manager._client, {}, 0, {})

        await mock_mqtt_manager.subscribe("farm/+/sensor/+/data", qos=1)

        assert ("farm/+/sensor/+/data", 1) in mock_mqtt_manager._subscriptions
        mock_mqtt_manager._client.subscribe.assert_called_with(
            "farm/+/sensor/+/data", qos=1
        )

    @pytest.mark.asyncio
    async def test_disconnect_graceful(self, mock_mqtt_manager):
        """Disconnect with flush=True must call client.disconnect."""
        await mock_mqtt_manager.connect("localhost", 1883, "test-client")
        mock_mqtt_manager._on_connect(mock_mqtt_manager._client, {}, 0, {})

        await mock_mqtt_manager.disconnect(flush=True)

        assert mock_mqtt_manager.is_connected is False
        assert mock_mqtt_manager.is_initialized is False
        mock_mqtt_manager._client.disconnect.assert_called_once()

    @pytest.mark.asyncio
    async def test_reconnect_on_disconnect(self, mock_mqtt_manager):
        """Unexpected disconnect must trigger reconnect loop."""
        await mock_mqtt_manager.connect("localhost", 1883, "test-client")
        mock_mqtt_manager._on_connect(mock_mqtt_manager._client, {}, 0, {})

        # Simulate unexpected disconnect
        mock_mqtt_manager._client.connect = AsyncMock()
        mock_mqtt_manager._on_disconnect(
            mock_mqtt_manager._client, None, Exception("Connection lost")
        )

        # Allow reconnect task to run briefly
        await asyncio.sleep(0.1)

        # Verify reconnect was attempted
        assert mock_mqtt_manager._reconnect_task is not None
        assert not mock_mqtt_manager._reconnect_task.done() or mock_mqtt_manager.is_connected

        # Clean up
        mock_mqtt_manager._stopped = True
        if mock_mqtt_manager._reconnect_task and not mock_mqtt_manager._reconnect_task.done():
            mock_mqtt_manager._reconnect_task.cancel()
            try:
                await mock_mqtt_manager._reconnect_task
            except asyncio.CancelledError:
                pass

    @pytest.mark.asyncio
    async def test_message_routing(self, mock_mqtt_manager):
        """Incoming MQTT message must trigger registered callback."""
        received = []

        async def callback(topic: str, payload: bytes):
            received.append((topic, payload))

        mock_mqtt_manager.set_message_callback(callback)

        await mock_mqtt_manager.connect("localhost", 1883, "test-client")
        mock_mqtt_manager._on_connect(mock_mqtt_manager._client, {}, 0, {})

        # Simulate incoming message
        test_topic = "farm/tenant1/sensor/sensor1/data"
        test_payload = b'{"ts": "2026-05-10T14:30:00Z", "temp": 25.5}'
        mock_mqtt_manager._on_message(
            mock_mqtt_manager._client,
            test_topic,
            test_payload,
            1,
            {},
        )

        # Allow the create_task to execute
        await asyncio.sleep(0.05)
        assert len(received) == 1
        assert received[0][0] == test_topic
        assert received[0][1] == test_payload

    @pytest.mark.asyncio
    async def test_disconnect_while_reconnecting(self, mock_mqtt_manager):
        """Shutdown must cancel pending reconnect and disconnect cleanly."""
        await mock_mqtt_manager.connect("localhost", 1883, "test-client")
        mock_mqtt_manager._on_connect(mock_mqtt_manager._client, {}, 0, {})

        # Trigger disconnect (simulate broken connection)
        mock_mqtt_manager._client.connect = AsyncMock(
            side_effect=ConnectionError("Still down")
        )
        mock_mqtt_manager._on_disconnect(
            mock_mqtt_manager._client, None, Exception("Lost connection")
        )

        # Let reconnect loop start
        await asyncio.sleep(0.05)

        # Now ask for graceful shutdown
        mock_mqtt_manager._client.disconnect = AsyncMock()
        await mock_mqtt_manager.disconnect(flush=True)

        assert mock_mqtt_manager.is_initialized is False
        assert mock_mqtt_manager.is_connected is False

    @pytest.mark.asyncio
    async def test_publish(self, mock_mqtt_manager):
        """Publish must call client.publish with correct args."""
        await mock_mqtt_manager.connect("localhost", 1883, "test-client")
        mock_mqtt_manager._on_connect(mock_mqtt_manager._client, {}, 0, {})

        await mock_mqtt_manager.publish("test/topic", b"hello", qos=1)
        mock_mqtt_manager._client.publish.assert_called_with(
            "test/topic", b"hello", qos=1
        )

    @pytest.mark.asyncio
    async def test_resubscribe_on_reconnect(self, mock_mqtt_manager):
        """On reconnect, all previous subscriptions must be restored."""
        await mock_mqtt_manager.connect("localhost", 1883, "test-client")
        mock_mqtt_manager._on_connect(mock_mqtt_manager._client, {}, 0, {})

        # Subscribe to a topic
        await mock_mqtt_manager.subscribe("farm/+/sensor/+/data", qos=1)

        # Clear the call history
        mock_mqtt_manager._client.subscribe.reset_mock()

        # Simulate reconnect
        mock_mqtt_manager._on_connect(mock_mqtt_manager._client, {}, 0, {})

        # Must resubscribe
        mock_mqtt_manager._client.subscribe.assert_called_with(
            "farm/+/sensor/+/data", qos=1
        )
