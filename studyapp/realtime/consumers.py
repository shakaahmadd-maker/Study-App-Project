from __future__ import annotations

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .services import get_badge_counts_for_user, user_group_name


class DashboardConsumer(AsyncJsonWebsocketConsumer):
    """
    Centralized per-user dashboard event stream.

    All dashboards (Admin/Student/Teacher/CS-Rep) connect here to receive:
    - notification CRUD events
    - badge count updates
    - cross-app state-change events
    """

    async def connect(self):
        user = self.scope.get("user")
        if not user or user.is_anonymous:
            await self.close(code=4401)
            return

        self.user = user
        self.group = user_group_name(user.id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

        badges = await self._get_badges()
        await self.send_json({"type": "bootstrap", "badges": badges})

    async def disconnect(self, code):
        try:
            if getattr(self, "group", None):
                await self.channel_layer.group_discard(self.group, self.channel_name)
        except Exception:
            return

    async def receive_json(self, content, **kwargs):
        # Keepalive / client pings (best-effort)
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def dashboard_event(self, event):
        await self.send_json(
            {
                "type": "event",
                "event": event.get("event"),
                "data": event.get("data") or {},
            }
        )

    @database_sync_to_async
    def _get_badges(self):
        return get_badge_counts_for_user(self.user)


