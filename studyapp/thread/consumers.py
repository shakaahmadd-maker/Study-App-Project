import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Thread, ThreadParticipant

class ThreadConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.thread_id = self.scope['url_route']['kwargs']['thread_id']
        self.thread_group_name = f'thread_{self.thread_id}'
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        # Check if user is participant
        if not await self._is_participant(self.thread_id, self.user):
            await self.close()
            return

        await self.channel_layer.group_add(
            self.thread_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'thread_group_name'):
            await self.channel_layer.group_discard(
                self.thread_group_name,
                self.channel_name
            )

    async def receive_json(self, content):
        # We handle typing indicators via WS
        msg_type = content.get('type')
        if msg_type == 'typing':
            await self.channel_layer.group_send(
                self.thread_group_name,
                {
                    'type': 'chat_typing',
                    'user_id': str(self.user.id),
                    'user_name': self.user.get_full_name(),
                    'is_typing': content.get('is_typing', False)
                }
            )

    async def chat_message(self, event):
        await self.send_json({
            'type': 'message',
            'message': event['message']
        })

    async def chat_typing(self, event):
        # Don't send typing indicator back to the sender
        if event['user_id'] != str(self.user.id):
            await self.send_json({
                'type': 'typing',
                'user_id': event['user_id'],
                'user_name': event['user_name'],
                'is_typing': event['is_typing']
            })

    @database_sync_to_async
    def _is_participant(self, thread_id, user):
        try:
            return ThreadParticipant.objects.filter(thread_id=thread_id, user=user).exists()
        except:
            return False

class ThreadListConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        if not self.user.is_authenticated:
            await self.close()
            return

        self.group_name = f'user_thread_list_{self.user.id}'
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def thread_list_update(self, event):
        await self.send_json(event)

