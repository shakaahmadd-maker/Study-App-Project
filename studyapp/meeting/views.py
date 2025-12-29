import tempfile
import subprocess
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.http import FileResponse, Http404
from django.core.files.base import ContentFile
from django.views.decorators.clickjacking import xframe_options_deny
from django.contrib.auth.decorators import login_required
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Meeting, MeetingParticipant
from .serializers import MeetingSerializer
from notifications.services import create_notification
from account.models import User
from account.utils import generate_masked_link
from realtime.services import publish_badges
import os
import uuid

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_meetings(request):
    """List meetings for the current user."""
    user = request.user
    if user.role == 'STUDENT':
        meetings = Meeting.objects.filter(student=user)
    elif user.role == 'TEACHER':
        meetings = Meeting.objects.filter(teacher=user)
    else:
        meetings = Meeting.objects.filter(host=user)
        
    serializer = MeetingSerializer(meetings, many=True, context={'request': request})
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def schedule_meeting(request):
    """Schedule a new meeting."""
    data = request.data.copy()
    user = request.user
    
    # If student is scheduling, set them as student and the teacher from selected ID
    # If teacher is scheduling, set them as teacher and the student from selected ID
    if user.role == 'STUDENT':
        data['student'] = user.id
        if 'teacher' not in data:
             return Response({"error": "Teacher selection is required"}, status=status.HTTP_400_BAD_REQUEST)
        # Make the teacher the host by default (so teacher can start/end meeting consistently)
        try:
            teacher_user = User.objects.get(id=data.get('teacher'))
        except User.DoesNotExist:
            return Response({"error": "Teacher not found"}, status=status.HTTP_400_BAD_REQUEST)
        data['host'] = str(teacher_user.id)
    elif user.role == 'TEACHER':
        data['teacher'] = user.id
        if 'student' not in data:
             return Response({"error": "Student selection is required"}, status=status.HTTP_400_BAD_REQUEST)
        data['host'] = user.id
    else:
        data['host'] = user.id
    
    serializer = MeetingSerializer(data=data, context={'request': request})
    if serializer.is_valid():
        meeting = serializer.save()
        
        # Notify both parties (student + teacher)
        when = timezone.localtime(meeting.scheduled_at).strftime('%Y-%m-%d %H:%M')
        actor = user
        if meeting.student:
            create_notification(
                recipient=meeting.student,
                notification_type="meeting",
                title="Meeting Scheduled",
                message=f"Meeting '{meeting.title}' scheduled for {when}.",
                actor=actor,
                related_entity_type="meeting",
                related_entity_id=meeting.id,
            )
        if meeting.teacher:
            create_notification(
                recipient=meeting.teacher,
                notification_type="meeting",
                title="Meeting Scheduled",
                message=f"Meeting '{meeting.title}' scheduled for {when}.",
                actor=actor,
                related_entity_type="meeting",
                related_entity_id=meeting.id,
            )

        # Badge counts: meeting becomes active (scheduled) for relevant users
        try:
            user_ids = {str(meeting.host_id)}
            if meeting.student_id:
                user_ids.add(str(meeting.student_id))
            if meeting.teacher_id:
                user_ids.add(str(meeting.teacher_id))
            for uid in user_ids:
                publish_badges(user_id=uid)
        except Exception:
            pass
            
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_meeting_details(request, meeting_id):
    """Get details for a specific meeting."""
    meeting = get_object_or_404(Meeting, id=meeting_id)
    
    # Check permission
    if request.user != meeting.student and request.user != meeting.teacher and request.user != meeting.host:
        return Response({"error": "You do not have permission to view this meeting"}, status=status.HTTP_403_FORBIDDEN)
        
    serializer = MeetingSerializer(meeting, context={'request': request})
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def start_meeting(request, meeting_id):
    """Mark meeting as in progress when host joins."""
    meeting = get_object_or_404(Meeting, id=meeting_id)
    
    if request.user != meeting.host:
        return Response({"error": "Only the host can start the meeting"}, status=status.HTTP_403_FORBIDDEN)
        
    if meeting.status == Meeting.STATUS_SCHEDULED:
        meeting.status = Meeting.STATUS_IN_PROGRESS
        meeting.actual_start = timezone.now()
        meeting.save()
        try:
            user_ids = {str(meeting.host_id)}
            if meeting.student_id:
                user_ids.add(str(meeting.student_id))
            if meeting.teacher_id:
                user_ids.add(str(meeting.teacher_id))
            for uid in user_ids:
                publish_badges(user_id=uid)
        except Exception:
            pass
        
    return Response({"status": meeting.status, "actual_start": meeting.actual_start})

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def end_meeting(request, meeting_id):
    """Mark meeting as completed and calculate duration."""
    meeting = get_object_or_404(Meeting, id=meeting_id)
    
    if request.user != meeting.host and request.user.role != 'TEACHER':
        return Response({"error": "Unauthorized to end meeting"}, status=status.HTTP_403_FORBIDDEN)
        
    if meeting.status == Meeting.STATUS_IN_PROGRESS:
        meeting.status = Meeting.STATUS_COMPLETED
        meeting.actual_end = timezone.now()
        
        if meeting.actual_start:
            diff = meeting.actual_end - meeting.actual_start
            meeting.duration_minutes = int(diff.total_seconds() / 60)
            
        meeting.save()
        
        # Notify both parties
        dur = meeting.duration_minutes or 0
        if meeting.student:
            msg = f"Meeting '{meeting.title}' completed. Duration: {dur} mins."
            if getattr(request.user, "role", "") == "TEACHER":
                msg = f"Teacher has ended the meeting '{meeting.title}'. Duration: {dur} mins."
            create_notification(
                recipient=meeting.student,
                notification_type="meeting",
                title="Meeting Completed",
                message=msg,
                actor=request.user,
                related_entity_type="meeting",
                related_entity_id=meeting.id,
            )
        if meeting.teacher:
            create_notification(
                recipient=meeting.teacher,
                notification_type="meeting",
                title="Meeting Completed",
                message=f"Meeting '{meeting.title}' completed. Duration: {dur} mins.",
                actor=request.user,
                related_entity_type="meeting",
                related_entity_id=meeting.id,
            )

        # Badge counts: meeting no longer active for relevant users
        try:
            user_ids = {str(meeting.host_id)}
            if meeting.student_id:
                user_ids.add(str(meeting.student_id))
            if meeting.teacher_id:
                user_ids.add(str(meeting.teacher_id))
            for uid in user_ids:
                publish_badges(user_id=uid)
        except Exception:
            pass
        
    return Response({
        "status": meeting.status, 
        "duration_minutes": meeting.duration_minutes,
        "recording_url": meeting.recording.url if meeting.recording else None
    })

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def download_recording(request, meeting_id):
    """Download the meeting recording."""
    meeting = get_object_or_404(Meeting, id=meeting_id)
    
    if not meeting.recording:
        raise Http404("No recording available for this meeting")
        
    # Check permission (only teacher or host or admin)
    if request.user != meeting.teacher and request.user != meeting.host and request.user.role != 'ADMIN':
        return Response({"error": "Unauthorized. Only the teacher or host can access recordings."}, status=status.HTTP_403_FORBIDDEN)
        
    return FileResponse(meeting.recording, as_attachment=True, filename=os.path.basename(meeting.recording.name))


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def upload_recording(request, meeting_id):
    """
    Upload an MP4 recording for a meeting.
    Note: In standard WebRTC P2P, recording is produced client-side and uploaded here.
    """
    meeting = get_object_or_404(Meeting, id=meeting_id)
    user = request.user

    # Only teacher or host can upload recordings
    if user != meeting.teacher and user != meeting.host:
        return Response({"error": "Only the teacher/host can upload recordings"}, status=status.HTTP_403_FORBIDDEN)

    if meeting.status != Meeting.STATUS_COMPLETED:
        return Response({"error": "Meeting must be completed before uploading recording."}, status=status.HTTP_400_BAD_REQUEST)

    file = request.FILES.get('recording')
    if not file:
        return Response({"error": "Missing recording file"}, status=status.HTTP_400_BAD_REQUEST)

    # Allow common browser recording formats (.mp4, .webm). Prefer mp4 storage when possible.
    name_lower = (file.name or '').lower()
    if not (name_lower.endswith('.mp4') or name_lower.endswith('.webm')):
        return Response({"error": "Recording must be a .mp4 or .webm file"}, status=status.HTTP_400_BAD_REQUEST)

    # If webm, attempt to transcode to mp4 using ffmpeg if installed.
    if name_lower.endswith('.webm'):
        try:
            with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp_in:
                for chunk in file.chunks():
                    tmp_in.write(chunk)
                tmp_in_path = tmp_in.name

            tmp_out = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
            tmp_out_path = tmp_out.name
            tmp_out.close()

            # ffmpeg -y -i in.webm -c:v libx264 -preset veryfast -c:a aac out.mp4
            subprocess.run(
                ['ffmpeg', '-y', '-i', tmp_in_path, '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', tmp_out_path],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            with open(tmp_out_path, 'rb') as f:
                meeting.recording.save(f"meeting_{meeting.id}.mp4", ContentFile(f.read()), save=False)
            meeting.save(update_fields=['recording'])
            return Response({"success": True, "recording_url": meeting.recording.url})
        except FileNotFoundError:
            # ffmpeg not installed; store original webm
            meeting.recording = file
            meeting.save(update_fields=['recording'])
            return Response({"success": True, "recording_url": meeting.recording.url})
        except Exception:
            # Any conversion error: store original
            meeting.recording = file
            meeting.save(update_fields=['recording'])
            return Response({"success": True, "recording_url": meeting.recording.url})
        finally:
            try:
                if 'tmp_in_path' in locals() and os.path.exists(tmp_in_path):
                    os.unlink(tmp_in_path)
            except Exception:
                pass
            try:
                if 'tmp_out_path' in locals() and os.path.exists(tmp_out_path):
                    os.unlink(tmp_out_path)
            except Exception:
                pass

    meeting.recording = file
    meeting.save(update_fields=['recording'])
    return Response({"success": True, "recording_url": meeting.recording.url})


@api_view(['DELETE', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def delete_meeting(request, meeting_id):
    """Delete a meeting record."""
    if request.user.role != 'ADMIN':
        return Response({"error": "Unauthorized. Only admins can delete meeting records."}, status=status.HTTP_403_FORBIDDEN)

    meeting = get_object_or_404(Meeting, id=meeting_id)
    meeting.delete()
    return Response({"success": True, "message": "Meeting record deleted successfully."})


@login_required
@xframe_options_deny
def meeting_prejoin_page(request):
    """
    Render pre-join page. Meeting ID is passed as query param: ?meeting_id=<uuid>
    """
    meeting_id = request.GET.get('meeting_id')
    if not meeting_id:
        raise Http404("Missing meeting_id")
    meeting = get_object_or_404(Meeting, id=meeting_id)
    if request.user not in [meeting.student, meeting.teacher, meeting.host]:
        raise Http404("Meeting not found")
        
    # Prevent rejoining if meeting is already completed
    if meeting.status == Meeting.STATUS_COMPLETED:
        return render(request, 'meetings/meeting_ended_notice.html', {'meeting': meeting})
        
    return render(request, 'meetings/meeting_prejoin.html')


@login_required
@xframe_options_deny
def meeting_room_page(request):
    """
    Render meeting room page. Meeting ID is passed as query param: ?meeting_id=<uuid>
    """
    meeting_id = request.GET.get('meeting_id')
    if not meeting_id:
        raise Http404("Missing meeting_id")
    meeting = get_object_or_404(Meeting, id=meeting_id)
    if request.user not in [meeting.student, meeting.teacher, meeting.host]:
        raise Http404("Meeting not found")
        
    # Prevent rejoining if meeting is already completed
    if meeting.status == Meeting.STATUS_COMPLETED:
        return render(request, 'meetings/meeting_ended_notice.html', {'meeting': meeting})
        
    return render(request, 'meetings/meeting_room.html')
