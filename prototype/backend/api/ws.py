"""WebSocket endpoint for real-time event streaming to the dashboard."""
import asyncio
import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..ingestion.pipeline import get_pipeline

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)
        logger.info(f"WS connected. Total: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)
        logger.info(f"WS disconnected. Total: {len(self.active)}")

    async def broadcast(self, payload: dict):
        if not self.active:
            return
        msg = json.dumps(payload, default=str)
        dead: list[WebSocket] = []
        for ws in self.active:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for d in dead:
            self.active.discard(d)


manager = ConnectionManager()


def register_ws_broadcaster():
    """Hook the WS manager into the ingestion pipeline as a callback."""
    pipeline = get_pipeline()

    async def broadcaster(payload: dict):
        await manager.broadcast(payload)

    def sync_broadcaster(payload: dict):
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(broadcaster(payload))
            else:
                loop.run_until_complete(broadcaster(payload))
        except Exception:
            logger.exception("WS broadcast failed")

    pipeline.subscribe(sync_broadcaster)


@router.websocket("/ws/stream")
async def stream(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            # Keep the connection alive; we don't expect incoming messages
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(ws)
