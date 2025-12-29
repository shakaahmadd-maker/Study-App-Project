import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .models import PreSignInSession, PreSignInMessage
from account.models import User

class PreSignInConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            self.session_id = self.scope['url_route']['kwargs'].get('session_id')
            self.user = self.scope['user']
            
            if self.session_id:
                # Joining a specific session (visitor or CS-Rep)
                # Verify session exists before accepting
                session_exists = await self._session_exists(self.session_id)
                if not session_exists:
                    print(f"Session {self.session_id} does not exist, closing connection")
                    await self.close(code=4004)  # Not found
                    return
                
                self.room_group_name = f'presignin_{self.session_id}'
                await self.channel_layer.group_add(self.room_group_name, self.channel_name)
                await self.accept()
            else:
                # Initial connection (Visitor to create session OR CS-Rep for alerts)
                await self.accept()
                
                # If authenticated CS-Rep, add to alerts group
                if self.user.is_authenticated:
                    user_role = getattr(self.user, 'role', None)
                    if user_role == 'CS_REP' or user_role == 'ADMIN' or self.user.is_staff:
                        self.room_group_name = 'presignin_alerts'
                        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        except Exception as e:
            print(f"Error in connect: {e}")
            import traceback
            traceback.print_exc()
            try:
                await self.close(code=1011)  # Internal error
            except:
                pass

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'chat_message':
                if not self.session_id:
                    print(f"Error: chat_message received but no session_id. User: {self.user}")
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': 'No active session. Please create a new session first.'
                    }))
                    return
                
                content = data.get('content')
                visitor_name = data.get('visitor_name')
                
                if not content:
                    return
                
                # Save message to database
                message, assigned_just_now = await self.save_message(self.session_id, content, visitor_name)
                
                if message:
                    # If CS-Rep responded and chat was unassigned, it's now assigned to them
                    if assigned_just_now:
                        # Notify other CS-Reps to remove this from their dashboards
                        await self.channel_layer.group_send(
                            'presignin_alerts',
                            {
                                'type': 'session_assigned',
                                'session_id': self.session_id,
                                'assigned_to_id': str(self.user.id),
                                'assigned_to_name': str(self.user)
                            }
                        )

                    # Broadcast to group
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'chat_message',
                            'message': {
                                'id': str(message.id),
                                'content': message.content,
                                'sender_role': 'csrep' if message.sender else 'visitor',
                                'sender_name': str(message.sender) if message.sender else message.visitor_name,
                                'created_at': message.created_at.strftime('%I:%M %p'),
                                'is_system': message.is_system
                            }
                        }
                    )
                    
                    # Update last_message_at for session list
                    await self.update_session_activity(self.session_id)

            elif message_type == 'new_session':
                visitor_name = data.get('visitor_name', '').strip()
                visitor_concern = data.get('visitor_concern', '').strip()
                
                if not visitor_name:
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': 'Visitor name is required.'
                    }))
                    return
                
                try:
                    session, first_msg = await self.create_session(visitor_name, visitor_concern)
                    
                    # Notify CS-Reps
                    await self.channel_layer.group_send(
                        'presignin_alerts',
                        {
                            'type': 'new_session_alert',
                            'session': {
                                'id': str(session.id),
                                'ref_number': session.ref_number,
                                'visitor_name': session.visitor_name,
                                'visitor_concern': session.visitor_concern,
                                'created_at': session.created_at.strftime('%I:%M %p')
                            }
                        }
                    )
                    
                    # Send session info and system message back to visitor immediately
                    await self.send(text_data=json.dumps({
                        'type': 'session_created',
                        'session_id': str(session.id),
                        'ref_number': session.ref_number,
                        'system_message': {
                            'id': str(first_msg.id),
                            'content': first_msg.content,
                            'sender_role': 'system',
                            'sender_name': 'System',
                            'created_at': first_msg.created_at.strftime('%I:%M %p'),
                            'is_system': first_msg.is_system
                        }
                    }))
                except Exception as e:
                    error_msg = str(e)
                    print(f"Error creating session: {error_msg}")
                    import traceback
                    traceback.print_exc()
                    # Send more detailed error for debugging (in production, use generic message)
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': f'Failed to create session: {error_msg}'
                    }))
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON in receive: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid message format.'
            }))
        except Exception as e:
            print(f"Error in receive: {e}")
            import traceback
            traceback.print_exc()
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'An error occurred processing your message.'
            }))

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))

    async def new_session_alert(self, event):
        await self.send(text_data=json.dumps(event))

    async def session_assigned(self, event):
        # Notify CS-Reps to remove this session if it's assigned to someone else
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def save_message(self, session_id, content, visitor_name=None):
        try:
            session = PreSignInSession.objects.get(id=session_id)
            sender = self.user if self.user.is_authenticated else None
            assigned_just_now = False
            
            # If CS-Rep is responding and chat is unassigned, assign it
            if sender and not session.assigned_to:
                session.assigned_to = sender
                session.save()
                assigned_just_now = True
            
            message = PreSignInMessage.objects.create(
                session=session,
                sender=sender,
                visitor_name=visitor_name if not sender else None,
                content=content
            )
            return message, assigned_just_now
        except Exception as e:
            print(f"Error saving message: {e}")
            return None, False

    @database_sync_to_async
    def create_session(self, visitor_name, visitor_concern):
        try:
            if not visitor_name or not visitor_name.strip():
                raise ValueError("Visitor name cannot be empty")
            
            # Truncate visitor_name if too long (max 255 chars)
            visitor_name = visitor_name.strip()[:255]
            
            # Generate ref number with retry logic
            max_retries = 10
            ref = None
            for attempt in range(max_retries):
                try:
                    ref = PreSignInSession.generate_ref_number()
                    break
                except Exception as e:
                    print(f"Error generating ref number (attempt {attempt + 1}): {e}")
                    if attempt == max_retries - 1:
                        raise Exception(f"Failed to generate unique ref number after {max_retries} attempts")
            
            if not ref:
                raise Exception("Failed to generate ref number")
            
            # Create session with retry for unique constraint violations
            session = None
            for attempt in range(3):
                try:
                    session = PreSignInSession.objects.create(
                        ref_number=ref,
                        visitor_name=visitor_name,
                        visitor_concern=visitor_concern.strip() if visitor_concern else ""
                    )
                    break
                except Exception as db_error:
                    error_str = str(db_error)
                    # Check if it's a unique constraint violation
                    if 'unique' in error_str.lower() or 'duplicate' in error_str.lower():
                        print(f"Ref number {ref} already exists, generating new one (attempt {attempt + 1})")
                        if attempt < 2:
                            ref = PreSignInSession.generate_ref_number()
                            continue
                        else:
                            raise Exception(f"Failed to create session: unique constraint violation after retries")
                    else:
                        raise
            
            if not session:
                raise Exception("Failed to create session after retries")
            
            # Create system message
            msg = PreSignInMessage.objects.create(
                session=session,
                content="Thanks for providing your name. A live agent will assist you shortly.",
                is_system=True
            )
            
            print(f"Successfully created session {session.id} with ref {ref} for visitor {visitor_name}")
            return session, msg
        except Exception as e:
            error_msg = str(e)
            print(f"Error in create_session: {error_msg}")
            import traceback
            traceback.print_exc()
            # Re-raise with more context
            raise Exception(f"Failed to create session: {error_msg}")

    @database_sync_to_async
    def update_session_activity(self, session_id):
        PreSignInSession.objects.filter(id=session_id).update(last_message_at=timezone.now())
    
    @database_sync_to_async
    def _session_exists(self, session_id):
        try:
            return PreSignInSession.objects.filter(id=session_id).exists()
        except Exception as e:
            print(f"Error checking session existence: {e}")
            return False
