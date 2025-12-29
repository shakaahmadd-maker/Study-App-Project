import json
import uuid
import logging
import os
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST, require_GET
from .models import Thread, ThreadParticipant, ThreadMessage, ThreadAttachment
from account.models import User, Student, Teacher, CSRep, Admin
from account.decorators import admin_required
from assingment.models import Assignment
from invoice.models import Invoice
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from realtime.services import publish_badges

logger = logging.getLogger(__name__)

@login_required
@require_GET
def get_thread_list(request):
    """
    Returns list of threads the current user is participating in.
    Supports filtering by type and status.
    """
    filter_type = request.GET.get('type')
    filter_status = request.GET.get('status')
    
    participations = ThreadParticipant.objects.filter(user=request.user)
    thread_ids = participations.values_list('thread_id', flat=True)
    
    threads = Thread.objects.filter(id__in=thread_ids).select_related('created_by', 'assignment', 'invoice')
    
    if filter_type and filter_type != 'all':
        threads = threads.filter(thread_type=filter_type)
    if filter_status:
        threads = threads.filter(status=filter_status)
    
    data = []
    for t in threads:
        # Get unread count
        try:
            p = participations.get(thread=t)
            if p.last_read_at:
                unread_count = t.messages.filter(created_at__gt=p.last_read_at).count()
            else:
                unread_count = t.messages.count()
        except ThreadParticipant.DoesNotExist:
            unread_count = 0

        # Get participants summary
        part_users = t.participants.select_related('user').all()
        participants_list = []
        for pu in part_users:
            role = pu.user.get_role_display()
            participants_list.append({
                'id': str(pu.user.id),
                'name': pu.user.get_full_name(),
                'role': role,
                'is_me': pu.user == request.user
            })

        # Last message preview
        last_msg = t.messages.order_by('-created_at').first()
        preview = ""
        if last_msg:
            preview = last_msg.content[:100]
            if not preview and last_msg.attachments.exists():
                preview = "[Attachment]"

        data.append({
            'id': str(t.id),
            'subject': t.subject,
            'thread_type': t.thread_type,
            'status': t.status,
            'created_by': t.created_by.get_full_name() if t.created_by else "System",
            'created_at': t.created_at.isoformat(),
            'updated_at': t.updated_at.isoformat(),
            'last_message_at': t.last_message_at.isoformat() if t.last_message_at else None,
            'last_message_preview': preview,
            'unread_count': unread_count,
            'participants': participants_list,
            'assignment_code': t.assignment.assignment_code if t.assignment else None,
            'invoice_id': str(t.invoice.id) if t.invoice else None,
        })
    
    return JsonResponse({'success': True, 'threads': data})

@login_required
@require_POST
def create_thread(request):
    """
    Creates a new thread and adds initial participants.
    Only ADMIN and CS_REP roles are allowed to create threads.
    Teachers and Students are not allowed to create threads.
    """
    # Restrict thread creation to ADMIN and CS_REP only
    if request.user.role not in ['ADMIN', 'CS_REP']:
        return JsonResponse({'success': False, 'error': 'You do not have permission to create threads. Only administrators and CS representatives can create threads.'}, status=403)
    
    try:
        data = request.POST
        subject = data.get('threadSubject')
        thread_type = data.get('threadType')
        initial_message = data.get('threadMessage')
        recipient_ids = request.POST.getlist('threadRecipient') # Multiple recipients
        assignment_id = data.get('relatedAssignment')
        invoice_id = data.get('relatedInvoice')

        if not subject or not thread_type or not initial_message:
            return JsonResponse({'success': False, 'error': 'Missing required fields'})

        with transaction.atomic():
            thread = Thread.objects.create(
                subject=subject,
                thread_type=thread_type,
                created_by=request.user,
                last_message_at=timezone.now()
            )
            
            if assignment_id:
                try:
                    thread.assignment = Assignment.objects.get(id=assignment_id)
                except (Assignment.DoesNotExist, ValueError):
                    pass
            if invoice_id:
                try:
                    thread.invoice = Invoice.objects.get(id=invoice_id)
                except (Invoice.DoesNotExist, ValueError):
                    pass
            thread.save()

            # Add creator as participant
            ThreadParticipant.objects.create(
                thread=thread, 
                user=request.user, 
                last_read_at=timezone.now()
            )

            # Add recipients
            for rid in recipient_ids:
                if not rid: continue
                user_to_add = None
                
                # Check if it's a UUID (User ID) or a prefixed ID (student-1234, teacher-1234)
                try:
                    # Try UUID first
                    import uuid
                    uuid.UUID(str(rid))
                    user_to_add = User.objects.get(id=rid)
                except (ValueError, User.DoesNotExist):
                    # Not a UUID or user not found, try prefixed ID
                    if '-' in rid:
                        parts = rid.split('-')
                        if len(parts) >= 2:
                            role_prefix = parts[0]
                            pk = '-'.join(parts[1:])
                            try:
                                if role_prefix == 'student':
                                    user_to_add = Student.objects.get(student_id=pk).user
                                elif role_prefix == 'teacher':
                                    user_to_add = Teacher.objects.get(teacher_id=pk).user
                            except (Student.DoesNotExist, Teacher.DoesNotExist):
                                pass
                
                if user_to_add and user_to_add != request.user:
                    ThreadParticipant.objects.get_or_create(thread=thread, user=user_to_add)

            # Create initial message
            msg = ThreadMessage.objects.create(
                thread=thread,
                sender=request.user,
                content=initial_message
            )

            # Handle attachments for initial message
            files = request.FILES.getlist('attachments')
            for f in files:
                ThreadAttachment.objects.create(
                    message=msg,
                    file=f,
                    file_name=f.name,
                    file_type='file'
                )

        # Notify via WebSocket
        _notify_thread_created(thread)

        # Badge counts: new thread + initial message affects unread counts for participants
        try:
            participant_ids = list(ThreadParticipant.objects.filter(thread=thread).values_list("user_id", flat=True))
            for uid in participant_ids:
                publish_badges(user_id=uid)
        except Exception:
            pass

        return JsonResponse({'success': True, 'thread_id': str(thread.id)})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
@require_GET
def get_thread_messages(request, thread_id):
    thread = get_object_or_404(Thread, id=thread_id)
    # Security: check if participant
    if not ThreadParticipant.objects.filter(thread=thread, user=request.user).exists():
        return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
    
    messages = thread.messages.all().select_related('sender').prefetch_related('attachments', 'mentions')
    
    data = []
    for m in messages:
        attachments = []
        for a in m.attachments.all():
            attachments.append({
                'url': a.file.url,
                'name': a.file_name,
                'type': a.file_type,
                'duration_ms': a.duration_ms
            })
        
        mentions = [{'id': str(u.id), 'name': u.get_full_name()} for u in m.mentions.all()]
        
        data.append({
            'id': str(m.id),
            'sender_id': str(m.sender.id),
            'sender_name': m.sender.get_full_name(),
            'sender_role': m.sender.get_role_display(),
            'content': m.content,
            'created_at': m.created_at.isoformat(),
            'is_system': m.is_system_message,
            'is_me': m.sender == request.user,
            'attachments': attachments,
            'mentions': mentions
        })
    
    # Mark as read
    ThreadParticipant.objects.filter(thread=thread, user=request.user).update(last_read_at=timezone.now())
    try:
        publish_badges(user_id=request.user.id)
    except Exception:
        pass
    
    return JsonResponse({'success': True, 'messages': data})

@login_required
@require_POST
def send_message(request, thread_id):
    try:
        thread = get_object_or_404(Thread, id=thread_id)
        if not ThreadParticipant.objects.filter(thread=thread, user=request.user).exists():
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        
        content = request.POST.get('content', '').strip()
        mention_ids = request.POST.getlist('mentions')
        
        # Check if we have either content or files (including voicemail)
        has_files = bool(request.FILES)
        has_voice = bool(request.FILES.get('voice'))
        has_regular_files = bool(request.FILES.getlist('files'))
        
        if not content and not has_files:
            return JsonResponse({'success': False, 'error': 'Message cannot be empty'}, status=400)
        
        # Log what we received for debugging
        logger.info(f"Sending message to thread {thread_id}: content={bool(content)}, voice={has_voice}, files={has_regular_files}")

        msg = None
        try:
            with transaction.atomic():
                msg = ThreadMessage.objects.create(
                    thread=thread,
                    sender=request.user,
                    content=content
                )
                
                # Handle mentions with error handling
                if mention_ids:
                    try:
                        valid_users = User.objects.filter(id__in=mention_ids)
                        if valid_users.exists():
                            msg.mentions.set(valid_users)
                    except Exception as e:
                        # Log error but don't fail the message send
                        logger.warning(f"Failed to set mentions for message {msg.id}: {str(e)}")
                
                # Files
                files = request.FILES.getlist('files')
                for f in files:
                    try:
                        # Validate and sanitize file name
                        file_name = getattr(f, 'name', None) or 'unnamed_file'
                        if not file_name or file_name.strip() == '':
                            file_name = f'file_{uuid.uuid4().hex[:8]}.bin'
                        
                        # Truncate if too long (max 255 chars)
                        if len(file_name) > 255:
                            name, ext = os.path.splitext(file_name)
                            if ext:
                                file_name = name[:255-len(ext)] + ext
                            else:
                                file_name = file_name[:255]
                        
                        # Validate file has content
                        if not hasattr(f, 'size') or f.size == 0:
                            logger.warning(f"File {file_name} is empty (0 bytes), skipping")
                            continue
                        
                        # Log file details before saving
                        logger.info(f"Attempting to save file: {file_name} (Size: {f.size} bytes) for message {msg.id}")
                        
                        ThreadAttachment.objects.create(
                            message=msg,
                            file=f,
                            file_name=file_name,
                            file_type='file'
                        )
                        logger.info(f"Successfully saved file: {file_name}")
                    except Exception as e:
                        logger.error(f"Failed to create attachment for message {msg.id}: {str(e)}", exc_info=True)
                        # Continue with other files, but log the error
                        
                # Voicemail
                voice = request.FILES.get('voice')
                if voice:
                    try:
                        # Validate voicemail file has content
                        if not hasattr(voice, 'size') or voice.size == 0:
                            logger.warning(f"Voicemail file is empty (0 bytes), skipping")
                        else:
                            duration_str = request.POST.get('duration_ms', '0')
                            # Convert to int, handle empty string or None
                            try:
                                duration = int(float(duration_str)) if duration_str else 0
                            except (ValueError, TypeError):
                                duration = 0
                            
                            # Log voicemail details before saving
                            logger.info(f"Attempting to save voicemail: Size={voice.size} bytes, Duration={duration}ms for message {msg.id}")
                            
                            # Ensure the file has a name attribute
                            if not hasattr(voice, 'name') or not voice.name:
                                voice.name = 'voicemail.webm'
                            
                            ThreadAttachment.objects.create(
                                message=msg,
                                file=voice,
                                file_name='voicemail.webm',
                                file_type='audio',
                                duration_ms=duration if duration > 0 else None
                            )
                            logger.info(f"Successfully saved voicemail for message {msg.id}")
                    except Exception as e:
                        error_msg = str(e)
                        logger.error(f"Failed to create voicemail attachment for message {msg.id}: {error_msg}", exc_info=True)
                        # Re-raise with more context so outer handler can return specific error
                        raise Exception(f"Voicemail upload failed: {error_msg}") from e
                        
                thread.last_message_at = timezone.now()
                thread.save()
                
            # Reload message with all relationships for broadcasting
            if msg:
                msg = ThreadMessage.objects.select_related('thread', 'sender').prefetch_related(
                    'attachments', 'mentions', 'thread__participants__user'
                ).get(id=msg.id)
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to create message in thread {thread_id}: {error_msg}", exc_info=True)
            # Return more specific error message for debugging, but sanitize for production
            if 'voicemail' in error_msg.lower() or 'attachment' in error_msg.lower():
                return JsonResponse({
                    'success': False, 
                    'error': f'Failed to save voicemail attachment: {error_msg[:100]}'
                }, status=500)
            return JsonResponse({
                'success': False, 
                'error': f'Failed to send message: {error_msg[:100]}'
            }, status=500)
        
        # Broadcast via WebSocket (don't fail if this fails)
        if msg:
            try:
                _broadcast_message(msg)
            except Exception as e:
                logger.warning(f"Failed to broadcast message {msg.id}: {str(e)}")
                # Continue even if broadcast fails

            # Badge counts: unread increased for participants (and potentially reduced for sender via read cursor)
            try:
                participant_ids = list(ThreadParticipant.objects.filter(thread=thread).values_list("user_id", flat=True))
                for uid in participant_ids:
                    publish_badges(user_id=uid)
            except Exception:
                pass
        
        return JsonResponse({'success': True, 'message_id': str(msg.id)})
        
    except Exception as e:
        logger.error(f"Unexpected error in send_message for thread {thread_id}: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': 'An unexpected error occurred. Please try again.'}, status=500)

def _notify_thread_created(thread):
    channel_layer = get_channel_layer()
    participants = thread.participants.all()
    for p in participants:
        async_to_sync(channel_layer.group_send)(
            f"user_thread_list_{p.user.id}",
            {
                "type": "thread_list_update",
                "action": "created",
                "thread_id": str(thread.id)
            }
        )

def _notify_thread_updated(thread):
    channel_layer = get_channel_layer()
    participants = thread.participants.all()
    for p in participants:
        async_to_sync(channel_layer.group_send)(
            f"user_thread_list_{p.user.id}",
            {
                "type": "thread_list_update",
                "action": "updated",
                "thread_id": str(thread.id)
            }
        )

def _broadcast_message(message):
    channel_layer = get_channel_layer()
    attachments = []
    for a in message.attachments.all():
        attachments.append({
            'url': a.file.url,
            'name': a.file_name,
            'type': a.file_type,
            'duration_ms': a.duration_ms
        })
    
    data = {
        'id': str(message.id),
        'thread_id': str(message.thread.id),
        'sender_id': str(message.sender.id),
        'sender_name': message.sender.get_full_name(),
        'sender_role': message.sender.get_role_display(),
        'content': message.content,
        'created_at': message.created_at.isoformat(),
        'is_system': message.is_system_message,
        'attachments': attachments,
        'mentions': [{'id': str(u.id), 'name': u.get_full_name()} for u in message.mentions.all()]
    }
    
    async_to_sync(channel_layer.group_send)(
        f"thread_{message.thread.id}",
        {
            "type": "chat_message",
            "message": data
        }
    )
    
    # Also update thread list for all participants
    for p in message.thread.participants.all():
        preview = message.content[:50] + "..." if len(message.content) > 50 else message.content
        if not preview and attachments:
            preview = "[Attachment]"
            
        async_to_sync(channel_layer.group_send)(
            f"user_thread_list_{p.user.id}",
            {
                "type": "thread_list_update",
                "action": "updated",
                "thread_id": str(message.thread.id),
                "last_message_preview": preview
            }
        )


@login_required
@require_POST
def update_thread_status(request, thread_id):
    """
    Update a thread status (active/resolved/closed).
    Only ADMIN and CS_REP can change status.
    """
    thread = get_object_or_404(Thread, id=thread_id)

    if request.user.role not in ['ADMIN', 'CS_REP']:
        return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)

    if not ThreadParticipant.objects.filter(thread=thread, user=request.user).exists():
        return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)

    status = (request.POST.get('status') or '').strip().lower()
    allowed_statuses = {k for (k, _) in Thread.STATUS_CHOICES}
    if status not in allowed_statuses:
        return JsonResponse({'success': False, 'error': 'Invalid status'}, status=400)

    Thread.objects.filter(id=thread.id).update(status=status, updated_at=timezone.now())
    thread.status = status

    _notify_thread_updated(thread)

    return JsonResponse({'success': True, 'status': status})

@login_required
@admin_required
@require_POST
def delete_thread(request, thread_id):
    """
    Delete a thread. Only ADMIN can delete threads.
    """
    try:
        thread = get_object_or_404(Thread, id=thread_id)
        
        # Get participant IDs before deleting (for notifications)
        participant_ids = list(ThreadParticipant.objects.filter(thread=thread).values_list("user_id", flat=True))
        
        # Delete the thread (this will cascade delete participants, messages, and attachments)
        thread.delete()
        
        # Notify participants via WebSocket
        try:
            channel_layer = get_channel_layer()
            for uid in participant_ids:
                async_to_sync(channel_layer.group_send)(
                    f"user_{uid}",
                    {
                        "type": "thread.deleted",
                        "thread_id": str(thread_id),
                    }
                )
        except Exception:
            pass
        
        # Update badge counts
        try:
            for uid in participant_ids:
                publish_badges(user_id=uid)
        except Exception:
            pass
        
        return JsonResponse({'success': True, 'message': 'Thread deleted successfully'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
