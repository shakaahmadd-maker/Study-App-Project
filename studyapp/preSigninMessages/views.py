from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from .models import PreSignInSession, PreSignInMessage
from account.decorators import role_required
from django.utils import timezone
import json
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

@login_required
@role_required('CS_REP', 'ADMIN')
def list_sessions(request):
    from django.db.models import Q
    # Show only unassigned active sessions OR sessions assigned to the current user
    sessions = PreSignInSession.objects.filter(
        is_active=True
    ).filter(
        Q(assigned_to__isnull=True) | Q(assigned_to=request.user)
    ).values(
        'id', 'ref_number', 'visitor_name', 'visitor_concern', 'created_at', 'last_message_at', 'assigned_to'
    )
    return JsonResponse(list(sessions), safe=False)

def get_session_messages(request, session_id):
    try:
        session = PreSignInSession.objects.get(id=session_id)
        messages = session.messages.all().order_by('created_at')
        message_list = []
        for msg in messages:
            message_list.append({
                'id': str(msg.id),
                'content': msg.content,
                'sender_role': 'csrep' if msg.sender else 'visitor',
                'sender_name': str(msg.sender) if msg.sender else msg.visitor_name,
                'created_at': msg.created_at.strftime('%I:%M %p'),
                'attachment': msg.attachment.url if msg.attachment else None,
                'is_system': msg.is_system
            })
        return JsonResponse({
            'session': {
                'id': str(session.id),
                'ref_number': session.ref_number,
                'visitor_name': session.visitor_name,
                'is_active': session.is_active
            },
            'messages': message_list
        })
    except PreSignInSession.DoesNotExist:
        return JsonResponse({'error': 'Session not found'}, status=404)

@csrf_exempt
@login_required
@role_required('CS_REP', 'ADMIN')
def send_csrep_message(request, session_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    
    try:
        session = PreSignInSession.objects.get(id=session_id)
        content = request.POST.get('content', '')
        attachment = request.FILES.get('attachment')
        
        message = PreSignInMessage.objects.create(
            session=session,
            sender=request.user,
            content=content,
            attachment=attachment
        )

        # Broadcast (so visitor/CS-Rep sees it in real-time, including attachment URL)
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'presignin_{session_id}',
                {
                    'type': 'chat_message',
                    'message': {
                        'id': str(message.id),
                        'content': message.content,
                        'sender_role': 'csrep',
                        'sender_name': str(message.sender),
                        'created_at': message.created_at.strftime('%I:%M %p'),
                        'attachment': message.attachment.url if message.attachment else None,
                        'attachment_name': message.attachment.name.split('/')[-1] if message.attachment else None,
                        'attachment_size': message.attachment.size if message.attachment else None,
                        'is_system': message.is_system
                    }
                }
            )
            PreSignInSession.objects.filter(id=session_id).update(last_message_at=timezone.now())
        except Exception as e:
            # Don't fail the request if WS broadcast fails
            print(f"PreSignIn broadcast failed: {e}")
        
        return JsonResponse({
            'success': True,
            'message': {
                'id': str(message.id),
                'content': message.content,
                'sender_role': 'csrep',
                'sender_name': str(message.sender),
                'created_at': message.created_at.strftime('%I:%M %p'),
                'attachment': message.attachment.url if message.attachment else None,
                'attachment_name': message.attachment.name.split('/')[-1] if message.attachment else None,
                'attachment_size': message.attachment.size if message.attachment else None
            }
        })
    except PreSignInSession.DoesNotExist:
        return JsonResponse({'error': 'Session not found'}, status=404)

@csrf_exempt
@login_required
@role_required('CS_REP', 'ADMIN')
def close_session(request, session_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    try:
        session = PreSignInSession.objects.get(id=session_id)
        session.is_active = False
        session.save()
        
        # Send closing message to visitor via system message
        msg_content = f"Thank you for contacting Nano Problem. Your chat has been closed. Please save your reference number for future record: {session.ref_number}"
        
        # In views.py, we can include the is_closed flag in the broadcast
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'presignin_{session_id}',
            {
                'type': 'chat_message',
                'message': {
                    'content': msg_content,
                    'sender_role': 'system',
                    'sender_name': 'System',
                    'created_at': timezone.now().strftime('%I:%M %p'),
                    'is_system': True,
                    'is_closed': True
                }
            }
        )
        
        return JsonResponse({'success': True})
    except PreSignInSession.DoesNotExist:
        return JsonResponse({'error': 'Session not found'}, status=404)

@login_required
@role_required('CS_REP', 'ADMIN')
def search_closed_sessions(request):
    query = request.GET.get('q', '')
    sessions = PreSignInSession.objects.filter(is_active=False, ref_number__icontains=query).values(
        'id', 'ref_number', 'visitor_name', 'visitor_concern', 'created_at', 'last_message_at'
    )
    return JsonResponse(list(sessions), safe=False)
