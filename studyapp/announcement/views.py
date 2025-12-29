from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db.models import Q
import json
from .models import Announcement
from account.models import User, Student, Teacher, CSRep
from realtime.services import publish_to_role, publish_to_users

@login_required
def get_announcements(request):
    """
    API endpoint to list announcements based on user role.
    """
    user = request.user
    now = timezone.now()
    
    if user.role == 'ADMIN':
        announcements = Announcement.objects.all()
    elif user.role == 'CS_REP':
        announcements = Announcement.objects.filter(
            Q(all_csreps=True) | Q(specific_recipients=user) | Q(author=user)
        ).distinct()
    elif user.role == 'TEACHER':
        # Teachers see what is for all teachers, or specific to them, or created by them
        announcements = Announcement.objects.filter(
            Q(all_teachers=True) | Q(specific_recipients=user) | Q(author=user)
        ).distinct()
    elif user.role == 'STUDENT':
        announcements = Announcement.objects.filter(
            Q(all_students=True) | Q(specific_recipients=user)
        ).distinct()
    else:
        announcements = Announcement.objects.none()
        
    # Filter by scheduled time (unless author is looking at their own draft)
    announcements = announcements.filter(
        Q(scheduled_at__lte=now) | Q(author=user)
    ).select_related('author').order_by('-created_at')
    
    data = []
    for ann in announcements:
        data.append({
            'id': ann.id,
            'title': ann.title,
            'content': ann.content,
            'priority': ann.priority,
            'author_name': ann.author.get_full_name() or ann.author.username,
            'author_role': ann.author.get_role_display(),
            'author_avatar': ann.author.profile_picture.url if ann.author.profile_picture else None,
            'tags': ann.tags,
            'scheduled_at': ann.scheduled_at.isoformat(),
            'created_at': ann.created_at.isoformat(),
            'pin_to_dashboard': ann.pin_to_dashboard,
            'all_students': ann.all_students,
            'all_teachers': ann.all_teachers,
            'all_csreps': ann.all_csreps,
            'specific_recipients_count': ann.specific_recipients.count(),
            'is_author': ann.author == user or user.role == 'ADMIN'
        })
        
    return JsonResponse({'success': True, 'announcements': data})

@csrf_exempt
@login_required
def create_announcement(request):
    """
    API endpoint to create a new announcement.
    """
    if request.user.role not in ['ADMIN', 'TEACHER']:
        return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)
        
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed.'}, status=405)
        
    try:
        data = json.loads(request.body)
        title = data.get('title')
        content = data.get('content')
        priority = data.get('priority', 'general')
        tags = data.get('tags', [])
        
        all_students = data.get('all_students', False)
        all_teachers = data.get('all_teachers', False)
        all_csreps = data.get('all_csreps', False)
        specific_ids = data.get('specific_ids', [])
        
        scheduled_at_str = data.get('scheduled_at')
        send_email = data.get('send_email', True)
        pin_to_dashboard = data.get('pin_to_dashboard', False)
        
        if not title or not content:
            return JsonResponse({'success': False, 'error': 'Title and content are required.'}, status=400)
            
        ann = Announcement.objects.create(
            title=title,
            content=content,
            priority=priority,
            author=request.user,
            tags=tags,
            all_students=all_students,
            all_teachers=all_teachers,
            all_csreps=all_csreps,
            send_email=send_email,
            pin_to_dashboard=pin_to_dashboard
        )
        
        if scheduled_at_str:
            scheduled_dt = parse_datetime(scheduled_at_str)
            if scheduled_dt:
                if timezone.is_naive(scheduled_dt):
                    scheduled_dt = timezone.make_aware(scheduled_dt)
                ann.scheduled_at = scheduled_dt
        
        if specific_ids:
            # Handle list of IDs which can be UUIDs or integers as strings
            users = User.objects.filter(id__in=specific_ids)
            ann.specific_recipients.set(users)
        
        ann.save()

        # --- Notifications (only if announcement is effectively published now) ---
        try:
            now = timezone.now()
            is_published_now = (ann.scheduled_at is None) or (ann.scheduled_at <= now)
            if is_published_now:
                from notifications.services import notify_users

                recipients_qs = User.objects.none()
                if ann.all_students:
                    recipients_qs = recipients_qs | User.objects.filter(role="STUDENT", is_active=True)
                if ann.all_teachers:
                    recipients_qs = recipients_qs | User.objects.filter(role="TEACHER", is_active=True)
                if ann.all_csreps:
                    recipients_qs = recipients_qs | User.objects.filter(role="CS_REP", is_active=True)

                specific_qs = ann.specific_recipients.all()
                recipients_qs = (recipients_qs | specific_qs).exclude(id=request.user.id).distinct()

                notify_users(
                    recipients=recipients_qs,
                    actor=request.user,
                    notification_type="announcement",
                    title="New announcement",
                    message=f"{ann.title}",
                    related_entity_type="announcement",
                    related_entity_id=str(ann.id),
                )

                # Real-time UI sync: prompt recipients to refresh announcements instantly
                try:
                    recipient_ids = list(recipients_qs.values_list("id", flat=True))
                    publish_to_users(
                        user_ids=[str(uid) for uid in recipient_ids],
                        event="announcement.changed",
                        data={"announcement_id": str(ann.id), "action": "published"},
                    )
                    # Admins can always see announcements list; include them too (excluding author already handled client-side)
                    publish_to_role(
                        role="ADMIN",
                        event="announcement.changed",
                        data={"announcement_id": str(ann.id), "action": "published"},
                    )
                except Exception:
                    pass
        except Exception:
            # Never block announcement creation if notification fanout fails
            pass
        
        return JsonResponse({'success': True, 'message': 'Announcement created successfully.', 'announcement_id': ann.id})
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@login_required
def delete_announcement(request, announcement_id):
    """
    API endpoint to delete an announcement.
    Only the author or an Admin can delete.
    """
    ann = get_object_or_404(Announcement, id=announcement_id)
    
    if request.user.role != 'ADMIN' and ann.author != request.user:
        return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)
        
    # Capture recipients for real-time removal before delete
    try:
        recipient_ids = set(ann.specific_recipients.values_list("id", flat=True))
        if ann.all_students:
            recipient_ids.update(User.objects.filter(role="STUDENT", is_active=True).values_list("id", flat=True))
        if ann.all_teachers:
            recipient_ids.update(User.objects.filter(role="TEACHER", is_active=True).values_list("id", flat=True))
        if ann.all_csreps:
            recipient_ids.update(User.objects.filter(role="CS_REP", is_active=True).values_list("id", flat=True))
        recipient_ids.add(ann.author_id)
        # Admins always have visibility
        recipient_ids.update(User.objects.filter(role="ADMIN", is_active=True).values_list("id", flat=True))
        publish_to_users(
            user_ids=[str(uid) for uid in recipient_ids if uid],
            event="announcement.changed",
            data={"announcement_id": str(ann.id), "action": "deleted"},
        )
    except Exception:
        pass

    ann.delete()
    return JsonResponse({'success': True, 'message': 'Announcement deleted successfully.'})

@login_required
def get_recipients_list(request):
    """
    API to get all students and teachers for specific recipient selection.
    """
    if request.user.role not in ['ADMIN', 'TEACHER']:
        return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)
        
    students = Student.objects.select_related('user').all()
    teachers = Teacher.objects.select_related('user').all()
    csreps = CSRep.objects.select_related('user').all()
    
    students_data = []
    for s in students:
        students_data.append({
            'id': str(s.user.id),
            'name': s.user.get_full_name() or s.user.username,
            'email': s.user.email,
            'avatar': s.user.profile_picture.url if s.user.profile_picture else None,
            'role': 'Student'
        })
        
    teachers_data = []
    for t in teachers:
        teachers_data.append({
            'id': str(t.user.id),
            'name': t.user.get_full_name() or t.user.username,
            'email': t.user.email,
            'avatar': t.user.profile_picture.url if t.user.profile_picture else None,
            'role': 'Teacher'
        })
        
    csreps_data = []
    for c in csreps:
        csreps_data.append({
            'id': str(c.user.id),
            'name': c.user.get_full_name() or c.user.username,
            'email': c.user.email,
            'avatar': c.user.profile_picture.url if c.user.profile_picture else None,
            'role': 'CS Rep'
        })
        
    return JsonResponse({
        'success': True, 
        'students': students_data, 
        'teachers': teachers_data,
        'csreps': csreps_data
    })
