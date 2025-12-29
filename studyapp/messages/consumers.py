from __future__ import annotations

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import ThreadParticipant
from .presence import refresh_online, set_offline, set_online


class MessagesConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for real-time direct messages.

    We do NOT accept message sends over WS for now (attachments require multipart);
    messages are persisted via HTTP and broadcast over WS.
    """

    async def connect(self):
        user = self.scope.get("user")
        if not user or user.is_anonymous:
            await self.close(code=4401)  # unauthorized
            return

        self.user = user
        self.user_group = f"user_{user.id}"

        # Presence: mark online
        try:
            set_online(user.id)
        except Exception:
            pass

        await self.channel_layer.group_add(self.user_group, self.channel_name)

        # Subscribe to all thread groups the user participates in.
        thread_ids = await self._get_user_thread_ids()
        self.thread_groups = [f"thread_{tid}" for tid in thread_ids]
        for g in self.thread_groups:
            await self.channel_layer.group_add(g, self.channel_name)

        await self.accept()

        await self.send_json({"type": "connected", "thread_ids": [str(tid) for tid in thread_ids]})

        # Broadcast presence to all threads (best-effort)
        await self._broadcast_presence(is_online=True)

    async def disconnect(self, code):
        # Best-effort cleanup
        try:
            # Presence: mark offline
            try:
                set_offline(self.user.id)
            except Exception:
                pass

            await self._broadcast_presence(is_online=False)

            if getattr(self, "user_group", None):
                await self.channel_layer.group_discard(self.user_group, self.channel_name)
            for g in getattr(self, "thread_groups", []) or []:
                await self.channel_layer.group_discard(g, self.channel_name)
        except Exception:
            return

    async def receive_json(self, content, **kwargs):
        """
        Client -> server events (typing/presence).
        """
        event_type = content.get("type")
        if event_type == "presence_ping":
            try:
                refresh_online(self.user.id)
            except Exception:
                pass
            return
        if event_type == "typing":
            thread_id = content.get("thread_id")
            is_typing = bool(content.get("is_typing"))
            if not thread_id:
                return
            # Only broadcast within that thread group
            await self.channel_layer.group_send(
                f"thread_{thread_id}",
                {
                    "type": "chat.typing",
                    "thread_id": str(thread_id),
                    "user_id": str(self.user.id),
                    "is_typing": is_typing,
                },
            )

    async def chat_message(self, event):
        await self.send_json({"type": "message", "message": event.get("message")})

    async def chat_thread_created(self, event):
        thread_id = event.get("thread_id")
        if thread_id:
            group = f"thread_{thread_id}"
            # Subscribe this socket to the new thread group immediately.
            try:
                await self.channel_layer.group_add(group, self.channel_name)
                self.thread_groups = getattr(self, "thread_groups", []) or []
                if group not in self.thread_groups:
                    self.thread_groups.append(group)
            except Exception:
                pass
        await self.send_json({"type": "thread_created", "thread_id": thread_id})

    async def chat_thread_deleted(self, event):
        await self.send_json(
            {
                "type": "thread_deleted",
                "thread_id": event.get("thread_id"),
                "actor_id": event.get("actor_id"),
            }
        )

    async def chat_typing(self, event):
        # Don't echo typing back to sender
        if event.get("user_id") == str(self.user.id):
            return
        await self.send_json(
            {
                "type": "typing",
                "thread_id": event.get("thread_id"),
                "user_id": event.get("user_id"),
                "is_typing": event.get("is_typing"),
            }
        )

    async def chat_read(self, event):
        # Don't echo read receipt back to reader
        if event.get("reader_id") == str(self.user.id):
            return
        await self.send_json(
            {
                "type": "read",
                "thread_id": event.get("thread_id"),
                "reader_id": event.get("reader_id"),
                "read_at": event.get("read_at"),
            }
        )

    async def chat_presence(self, event):
        # Don't echo presence back to the actor (optional, but reduces noise)
        if event.get("user_id") == str(self.user.id):
            return
        await self.send_json(
            {
                "type": "presence",
                "user_id": event.get("user_id"),
                "is_online": bool(event.get("is_online")),
            }
        )

    async def _get_user_thread_ids(self):
        return await self._get_user_thread_ids_sync()

    @database_sync_to_async
    def _get_user_thread_ids_sync(self):
        return list(
            ThreadParticipant.objects.filter(user=self.user).values_list("thread_id", flat=True)
        )

    async def _broadcast_presence(self, *, is_online: bool):
        try:
            for group in getattr(self, "thread_groups", []) or []:
                await self.channel_layer.group_send(
                    group,
                    {
                        "type": "chat.presence",
                        "user_id": str(self.user.id),
                        "is_online": bool(is_online),
                    },
                )
        except Exception:
            return


