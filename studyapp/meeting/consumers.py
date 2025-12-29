import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Meeting, MeetingParticipant
from django.utils import timezone
from account.models import User

class MeetingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'meeting_{self.room_name}'
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        allowed = await self._is_user_allowed()
        if not allowed:
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        
        # Track participant join
        await self.track_participant_join()

        # Send active participant snapshot to this user
        await self.send(text_data=json.dumps({
            'type': 'participants_snapshot',
            'participants': await self._get_active_participants(),
        }))
        
        # Notify others that a new participant joined
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'participant_event',
                'event': 'joined',
                'user_id': str(self.user.id),
                'user_name': f"{self.user.first_name} {self.user.last_name}",
                'sender_channel_name': self.channel_name
            }
        )

    async def disconnect(self, close_code):
        # Notify others that a participant left
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'participant_event',
                'event': 'left',
                'user_id': str(self.user.id),
                'sender_channel_name': self.channel_name
            }
        )
        
        # Track participant leave
        await self.track_participant_leave()
        
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except Exception:
            return
        message_type = data.get('type')
        
        # Handle signaling: offer, answer, candidate, negotiation_needed
        if message_type in ['offer', 'answer', 'candidate', 'negotiation_needed']:
            target_user_id = data.get('target_user_id')
            if target_user_id and not await self._is_target_participant(target_user_id):
                return
            # Do not trust client sender info
            data['sender_id'] = str(self.user.id)
            data['user_name'] = f"{self.user.first_name} {self.user.last_name}"
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'webrtc_signal',
                    'message': data,
                    'sender_channel_name': self.channel_name,
                    'target_user_id': target_user_id
                }
            )
        
        # Handle meeting features: chat, whiteboard, reaction, screen_share, meeting end, per-user board clear
        elif message_type in ['chat', 'whiteboard', 'whiteboard_clear_own', 'reaction', 'screen_share', 'toggle_audio', 'toggle_video', 'meeting_end']:
            # Enforce screen share permission (best-effort; real track replacement is client-side in P2P WebRTC)
            if message_type == 'screen_share' and data.get('active'):
                allowed = await self._can_screen_share()
                if not allowed:
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': 'You do not have permission to share your screen.'
                    }))
                    return
            # Enforce server-sourced identity
            data['sender_id'] = str(self.user.id)
            data['user_name'] = f"{self.user.first_name} {self.user.last_name}"
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'meeting_event',
                    'message': data,
                    'sender_channel_name': self.channel_name
                }
            )

    async def webrtc_signal(self, event):
        # Only send if it's for this specific user or it's a broadcast (unlikely for signaling)
        target_user_id = event.get('target_user_id')
        if self.channel_name != event['sender_channel_name']:
            if not target_user_id or str(self.user.id) == str(target_user_id):
                await self.send(text_data=json.dumps(event['message']))

    async def meeting_event(self, event):
        # Broadcast to everyone else
        if self.channel_name != event['sender_channel_name']:
            await self.send(text_data=json.dumps(event['message']))

    async def participant_event(self, event):
        # Notify about participant joining/leaving
        if self.channel_name != event['sender_channel_name']:
            await self.send(text_data=json.dumps({
                'type': 'participant_event',
                'event': event['event'],
                'user_id': event.get('user_id'),
                'user_name': event.get('user_name')
            }))

    @database_sync_to_async
    def _is_user_allowed(self):
        meeting = Meeting.objects.filter(room_name=self.room_name).first()
        if not meeting:
            return False
            
        # If meeting is completed, nobody can join the active room
        if meeting.status == Meeting.STATUS_COMPLETED:
            return False
            
        return self.user in [meeting.student, meeting.teacher, meeting.host]

    @database_sync_to_async
    def _is_target_participant(self, target_user_id: str):
        meeting = Meeting.objects.filter(room_name=self.room_name).first()
        if not meeting:
            return False
        return str(meeting.student_id) == str(target_user_id) or str(meeting.teacher_id) == str(target_user_id) or str(meeting.host_id) == str(target_user_id)

    @database_sync_to_async
    def _can_screen_share(self):
        meeting = Meeting.objects.filter(room_name=self.room_name).first()
        if not meeting:
            return False
        # Allow all valid participants to share their screen
        return self.user in [meeting.student, meeting.teacher, meeting.host]

    @database_sync_to_async
    def _get_active_participants(self):
        meeting = Meeting.objects.filter(room_name=self.room_name).first()
        if not meeting:
            return []
        qs = MeetingParticipant.objects.filter(meeting=meeting, left_at__isnull=True).select_related('user')
        return [
            {
                'user_id': str(p.user_id),
                'user_name': f"{p.user.first_name} {p.user.last_name}".strip() or p.user.email,
            }
            for p in qs
        ]

    @database_sync_to_async
    def track_participant_join(self):
        meeting = Meeting.objects.filter(room_name=self.room_name).first()
        if meeting:
            MeetingParticipant.objects.update_or_create(
                meeting=meeting,
                user=self.user,
                defaults={'joined_at': timezone.now(), 'left_at': None}
            )
            # If first participant joins, mark meeting in progress (no mock state)
            if meeting.status == Meeting.STATUS_SCHEDULED:
                meeting.status = Meeting.STATUS_IN_PROGRESS
                if not meeting.actual_start:
                    meeting.actual_start = timezone.now()
                meeting.save(update_fields=['status', 'actual_start'])

    @database_sync_to_async
    def track_participant_leave(self):
        meeting = Meeting.objects.filter(room_name=self.room_name).first()
        if meeting:
            MeetingParticipant.objects.filter(
                meeting=meeting,
                user=self.user
            ).update(left_at=timezone.now())

