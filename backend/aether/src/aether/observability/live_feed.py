"""
WebSocket Live Feed Manager for Aether

Provides real-time agent and workflow status updates via WebSockets.

Features:
- Connection management with client metadata
- Broadcast agent updates to all connected clients
- Workflow status updates
- Message history for replay/debugging
- Automatic cleanup of dead connections

Usage:
    # In your FastAPI app
    from aether.observability.live_feed import LiveFeedManager

    feed_manager = LiveFeedManager()

    @app.websocket("/ws/live-feed")
    async def websocket_endpoint(websocket: WebSocket):
        client_id = str(uuid.uuid4())
        await feed_manager.connect(websocket, client_id)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            feed_manager.disconnect(client_id)

    # In your agent/workflow code
    await feed_manager.broadcast_agent_update(
        agent="analyst",
        message="Processing financial data",
        type="progress",
        request_id="req_123"
    )
"""

import asyncio
import structlog
from datetime import datetime
from typing import Any, Dict, List, Optional
from collections import deque

logger = structlog.get_logger(__name__)


class LiveFeedManager:
    """
    Manages WebSocket connections for real-time agent/workflow updates.

    This is a generic implementation that can be used with any WebSocket library
    (FastAPI WebSocket, websockets, etc.)
    """

    def __init__(self, max_history: int = 100):
        """
        Initialize live feed manager.

        Args:
            max_history: Maximum number of messages to keep in history
        """
        self.active_connections: Dict[str, Any] = {}
        self.client_metadata: Dict[str, Dict[str, Any]] = {}
        self.message_history: deque = deque(maxlen=max_history)
        self.max_history = max_history

        logger.info("LiveFeedManager initialized", max_history=max_history)

    async def connect(
        self,
        websocket: Any,
        client_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        Accept and register a new WebSocket connection.

        Args:
            websocket: WebSocket connection object
            client_id: Unique identifier for this client
            metadata: Optional metadata about the client
        """
        # Accept connection if it has an accept method (FastAPI style)
        if hasattr(websocket, "accept"):
            await websocket.accept()

        self.active_connections[client_id] = websocket
        self.client_metadata[client_id] = metadata or {}

        logger.info(
            "websocket_connected",
            client_id=client_id,
            total_connections=len(self.active_connections),
            metadata=metadata,
        )

        # Send recent history to new client
        if self.message_history:
            history_message = {
                "type": "history",
                "messages": list(self.message_history),
                "timestamp": datetime.utcnow().isoformat(),
            }
            await self._send_to_client(client_id, history_message)

    def disconnect(self, client_id: str):
        """
        Remove a client connection.

        Args:
            client_id: Client to disconnect
        """
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            del self.client_metadata[client_id]

            logger.info(
                "websocket_disconnected",
                client_id=client_id,
                remaining_connections=len(self.active_connections),
            )

    async def broadcast_agent_update(
        self,
        agent: str,
        message: str,
        type: str = "info",
        request_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        Broadcast an agent update to all connected clients.

        Args:
            agent: Agent identifier
            message: Update message
            type: Update type (info, progress, success, error, warning)
            request_id: Optional request/workflow ID
            metadata: Optional additional metadata
        """
        update_data = {
            "type": "agent_update",
            "data": {
                "agent": agent,
                "message": message,
                "update_type": type,
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat(),
                "metadata": metadata or {},
            },
        }

        # Add to history
        self.message_history.append(update_data)

        # Broadcast to all clients
        await self._broadcast(update_data)

        logger.debug(
            "agent_update_broadcast",
            agent=agent,
            message=message,
            type=type,
            request_id=request_id,
        )

    async def broadcast_workflow_status(
        self,
        request_id: str,
        status: str,
        progress: Optional[float] = None,
        stage: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        Broadcast workflow status update.

        Args:
            request_id: Workflow/request identifier
            status: Status (running, completed, failed, paused)
            progress: Progress percentage (0-100)
            stage: Current stage name
            metadata: Optional additional metadata
        """
        status_data = {
            "type": "workflow_status",
            "data": {
                "request_id": request_id,
                "status": status,
                "progress": progress,
                "stage": stage,
                "timestamp": datetime.utcnow().isoformat(),
                "metadata": metadata or {},
            },
        }

        # Add to history
        self.message_history.append(status_data)

        # Broadcast to all clients
        await self._broadcast(status_data)

        logger.debug(
            "workflow_status_broadcast",
            request_id=request_id,
            status=status,
            progress=progress,
            stage=stage,
        )

    async def broadcast_custom(
        self,
        message_type: str,
        data: Dict[str, Any],
        add_to_history: bool = True,
    ):
        """
        Broadcast a custom message.

        Args:
            message_type: Type of message
            data: Message data
            add_to_history: Whether to add to message history
        """
        message = {
            "type": message_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        if add_to_history:
            self.message_history.append(message)

        await self._broadcast(message)

    async def _broadcast(self, message: Dict[str, Any]):
        """
        Internal method to broadcast message to all clients.

        Args:
            message: Message to broadcast
        """
        dead_clients = []

        for client_id, connection in self.active_connections.items():
            try:
                await self._send_to_client(client_id, message)
            except Exception as e:
                logger.warning(
                    "failed_to_send_to_client",
                    client_id=client_id,
                    error=str(e),
                )
                dead_clients.append(client_id)

        # Clean up dead connections
        for client_id in dead_clients:
            self.disconnect(client_id)

    async def _send_to_client(self, client_id: str, message: Dict[str, Any]):
        """
        Send message to a specific client.

        Args:
            client_id: Client identifier
            message: Message to send
        """
        connection = self.active_connections.get(client_id)
        if not connection:
            return

        # Try different send methods (FastAPI, websockets library, etc.)
        if hasattr(connection, "send_json"):
            await connection.send_json(message)
        elif hasattr(connection, "send"):
            import json

            await connection.send(json.dumps(message))
        else:
            raise ValueError(f"Unknown WebSocket connection type: {type(connection)}")

    def get_history(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get message history.

        Args:
            limit: Maximum number of messages to return

        Returns:
            List of historical messages
        """
        history = list(self.message_history)
        if limit:
            return history[-limit:]
        return history

    def get_stats(self) -> Dict[str, Any]:
        """
        Get live feed statistics.

        Returns:
            Stats dict with connection count, history size, etc.
        """
        return {
            "active_connections": len(self.active_connections),
            "history_size": len(self.message_history),
            "max_history": self.max_history,
            "clients": {
                client_id: {
                    "connected_at": metadata.get("connected_at"),
                    "metadata": metadata,
                }
                for client_id, metadata in self.client_metadata.items()
            },
        }

    async def close_all(self):
        """Close all connections gracefully."""
        logger.info(
            "Closing all WebSocket connections", count=len(self.active_connections)
        )

        for client_id, connection in list(self.active_connections.items()):
            try:
                if hasattr(connection, "close"):
                    await connection.close()
            except Exception as e:
                logger.warning(f"Error closing connection {client_id}: {e}")

        self.active_connections.clear()
        self.client_metadata.clear()


# Singleton instance for convenience
_default_feed_manager: Optional[LiveFeedManager] = None


def get_live_feed_manager() -> LiveFeedManager:
    """
    Get the default live feed manager instance.

    Returns:
        LiveFeedManager singleton
    """
    global _default_feed_manager
    if _default_feed_manager is None:
        _default_feed_manager = LiveFeedManager()
    return _default_feed_manager
