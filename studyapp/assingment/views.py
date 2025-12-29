import json
import os
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from .models import Assignment, AssignmentFile, TeacherAssignment, AssignmentFeedback
from account.models import Student, Teacher, User
from account.decorators import student_required, teacher_required, admin_required
from account.utils import generate_masked_link
from realtime.services import publish_to_role, publish_to_users

@login_required
@csrf_exempt
@require_POST
def create_assignment(request):
    """
    Handle new assignment request submission from student.
    """
    try:
        # Check if user has a student profile, otherwise use a placeholder for staff/admins
        if hasattr(request.user, 'student_profile'):
            student = request.user.student_profile
        elif request.user.role in ['ADMIN', 'TEACHER', 'CS_REP']:
            # For testing purposes, staff can create assignments if they have a student profile
            # or we can auto-create one for them if missing (convenient for development)
            from account.models import Student
            student, _ = Student.objects.get_or_create(
                user=request.user,
                defaults={'student_id': 9999} # Placeholder ID
            )
        else:
            return JsonResponse({'success': False, 'error': 'Only students can request assignments.'}, status=403)
        
        # Handle multipart/form-data
        title = request.POST.get('assignmentTitle', '').strip()
        service_type = request.POST.get('serviceType', '').strip()
        priority = request.POST.get('priority', 'medium').strip()
        due_date_str = request.POST.get('dueDate', '').strip()
        description = request.POST.get('serviceDetails', '').strip()
        
        # Optional fields based on service type
        writing_type = request.POST.get('writingType', '').strip()
        num_pages = request.POST.get('numPages', '').strip()
        solve_paper_type = request.POST.get('solvePaperType', '').strip()
        other_paper_input = request.POST.get('otherPaperInput', '').strip()
        exam_date_str = request.POST.get('examDate', '').strip()
        
        # Additional features
        features = request.POST.getlist('features')
        
        # Parse dates - due_date is date input, exam_date is datetime-local
        due_date = None
        if due_date_str:
            try:
                # Parse date string (YYYY-MM-DD) and convert to datetime
                from datetime import datetime
                due_date = datetime.strptime(due_date_str, '%Y-%m-%d')
                # Set to end of day
                due_date = due_date.replace(hour=23, minute=59, second=59)
                due_date = timezone.make_aware(due_date) if timezone.is_naive(due_date) else due_date
            except (ValueError, TypeError) as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to parse due_date '{due_date_str}': {e}")
        
        exam_date = None
        if exam_date_str:
            try:
                # Parse datetime-local string (YYYY-MM-DDTHH:MM)
                from datetime import datetime
                exam_date = datetime.strptime(exam_date_str, '%Y-%m-%dT%H:%M')
                exam_date = timezone.make_aware(exam_date) if timezone.is_naive(exam_date) else exam_date
            except (ValueError, TypeError) as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to parse exam_date '{exam_date_str}': {e}")
        
        # Generate unique assignment code
        assignment_code = Assignment.generate_assignment_code(student)
        
        # Create assignment
        assignment = Assignment.objects.create(
            assignment_code=assignment_code,
            student=student,
            title=title,
            service_type=service_type,
            priority=priority,
            due_date=due_date,
            exam_date=exam_date,
            description=description,
            writing_type=writing_type if writing_type else None,
            num_pages=int(num_pages) if num_pages and num_pages.isdigit() else None,
            online_paper_type=solve_paper_type if solve_paper_type else None,
            other_paper_type=other_paper_input if other_paper_input else None,
            additional_features=features,
            status='pending'
        )
        
        # Handle supporting file uploads
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"=== Assignment Creation Debug ===")
        logger.info(f"Assignment ID: {assignment.id}")
        logger.info(f"Assignment Code: {assignment_code}")
        logger.info(f"Request Content-Type: {request.content_type}")
        logger.info(f"Request Method: {request.method}")
        logger.info(f"request.FILES keys: {list(request.FILES.keys())}")
        logger.info(f"request.POST keys: {list(request.POST.keys())}")
        
        files = request.FILES.getlist('supportFiles')
        uploaded_file_count = 0
        saved_file_ids = []
        file_errors = []
        
        logger.info(f"Received {len(files)} file(s) from request.FILES.getlist('supportFiles')")
        
        # Log each file received
        for idx, f in enumerate(files, 1):
            logger.info(f"  File {idx}: {f.name} (Size: {f.size} bytes, Content-Type: {getattr(f, 'content_type', 'unknown')})")
        
        if len(files) == 0:
            logger.warning("⚠ WARNING: No files received in request.FILES.getlist('supportFiles')")
            logger.warning("This could mean:")
            logger.warning("  1. Files were not included in FormData")
            logger.warning("  2. FormData was not sent as multipart/form-data")
            logger.warning("  3. File input name mismatch (expected 'supportFiles')")
            logger.warning(f"  4. All available FILES keys: {list(request.FILES.keys())}")
        
        for f in files:
            try:
                # Validate file before saving
                file_name = getattr(f, 'name', None) or 'unnamed_file'
                if not file_name or file_name.strip() == '':
                    file_name = f'file_{uploaded_file_count + 1}'
                
                # Ensure file_name doesn't exceed max length
                if len(file_name) > 255:
                    # Truncate and preserve extension if possible
                    name, ext = os.path.splitext(file_name)
                    if ext:
                        file_name = name[:255-len(ext)] + ext
                    else:
                        file_name = file_name[:255]
                
                # Validate file has content
                if not hasattr(f, 'size') or f.size == 0:
                    error_msg = f"File {file_name} is empty (0 bytes)"
                    logger.warning(error_msg)
                    file_errors.append(error_msg)
                    continue
                
                # Log file details before saving
                logger.info(f"Attempting to save file: {file_name} (Size: {f.size} bytes)")
                logger.info(f"Assignment ID: {assignment.id}, Assignment Code: {assignment.assignment_code}")
                logger.info(f"User ID: {request.user.id}, Username: {request.user.username}")
                logger.info(f"File object type: {type(f)}, File name attribute: {getattr(f, 'name', 'N/A')}")
                
                # Ensure assignment is saved (should already be, but double-check)
                if assignment.pk is None:
                    assignment.save()
                    logger.info(f"Assignment saved with ID: {assignment.id}")
                
                # Ensure user exists and has a valid ID
                if not request.user.pk:
                    raise ValueError("User must be saved before creating file")
                
                # Validate file object
                if not f:
                    raise ValueError("File object is None")
                
                # Use database transaction to ensure atomicity
                from django.db import transaction
                from django.core.files.base import ContentFile
                
                with transaction.atomic():
                    # Read file content to ensure it's accessible
                    try:
                        # Reset file pointer to beginning
                        if hasattr(f, 'seek'):
                            f.seek(0)
                        
                        # Create the file object using .create() which properly handles FileField
                        # Django's FileField will handle the file storage automatically
                        file_obj = AssignmentFile.objects.create(
                            assignment=assignment,
                            uploaded_by=request.user,
                            file=f,
                            file_name=file_name,
                            file_type='support'
                        )
                    except Exception as save_error:
                        # If save fails, log detailed info and re-raise to be caught by outer handler
                        logger.error(f"Error during file save: {save_error}")
                        logger.error(f"Assignment: {assignment.id} (type: {type(assignment.id)})")
                        logger.error(f"User: {request.user.id} (type: {type(request.user.id)})")
                        logger.error(f"File name: {file_name}")
                        logger.error(f"File object: {f} (type: {type(f)})")
                        raise
                
                uploaded_file_count += 1
                saved_file_ids.append(file_obj.id)
                logger.info(f"✓ File saved successfully: {file_name} (ID: {file_obj.id}, Size: {f.size} bytes)")
            except Exception as file_error:
                # Log file upload error but don't fail the entire request
                file_name = getattr(f, 'name', 'unknown_file')
                file_size = getattr(f, 'size', 0)
                error_type = type(file_error).__name__
                error_full_msg = str(file_error)
                
                # Try to extract more details from database errors
                if 'null value' in error_full_msg.lower() or 'not null' in error_full_msg.lower():
                    logger.error("="*60)
                    logger.error("DATABASE CONSTRAINT ERROR DETECTED")
                    logger.error("="*60)
                    logger.error(f"Error type: {error_type}")
                    logger.error(f"Full error message: {error_full_msg}")
                    logger.error(f"Assignment ID: {assignment.id}")
                    logger.error(f"Assignment PK: {assignment.pk}")
                    logger.error(f"User ID: {request.user.id}")
                    logger.error(f"User PK: {request.user.pk}")
                    logger.error(f"File name: {file_name}")
                    logger.error(f"File size: {file_size}")
                    logger.error("="*60)
                
                error_msg = f"Failed to save file {file_name}: {error_type} - {error_full_msg}"
                logger.error(error_msg)
                logger.error(f"File details - Name: {file_name}, Size: {file_size}, Type: {getattr(f, 'content_type', 'unknown')}")
                import traceback
                logger.error("Full traceback:")
                logger.error(traceback.format_exc())
                
                # Include more details in the error message sent to client (truncate if too long)
                detailed_error = f"{file_name}: {error_full_msg[:300]}"  # Increased length to see more
                file_errors.append(detailed_error)
        
        # Verify files were actually saved to database
        verified_files = AssignmentFile.objects.filter(assignment=assignment, file_type='support')
        logger.info(f"Database verification: Found {verified_files.count()} file(s) for assignment {assignment.assignment_code}")
        
        # Log each saved file for verification
        for file_obj in verified_files:
            try:
                file_url = file_obj.file.url if file_obj.file else "No file path"
                logger.info(f"  - File in DB: {file_obj.file_name} (ID: {file_obj.id}, Type: {file_obj.file_type}, URL: {file_url})")
            except Exception as e:
                logger.warning(f"  - File in DB: {file_obj.file_name} (ID: {file_obj.id}, Type: {file_obj.file_type}, URL Error: {str(e)})")
            
        # --- Notifications ---
        try:
            from notifications.services import create_notification, notify_role

            student_user = student.user
            # Notify student (confirmation)
            create_notification(
                recipient=student_user,
                actor=request.user,
                notification_type="assignment",
                title="Assignment request submitted",
                message=f"Your request ({assignment.assignment_code}) was submitted successfully.",
                related_entity_type="assignment",
                related_entity_id=str(assignment.id),
            )
            # Notify admins & CS reps (new request)
            notify_role(
                role="ADMIN",
                actor=request.user,
                notification_type="assignment",
                title="New assignment request",
                message=f"{student_user.get_full_name()} submitted {assignment.assignment_code}: {assignment.title}",
                related_entity_type="assignment",
                related_entity_id=str(assignment.id),
            )
            notify_role(
                role="CS_REP",
                actor=request.user,
                notification_type="assignment",
                title="New assignment request",
                message=f"{student_user.get_full_name()} submitted {assignment.assignment_code}: {assignment.title}",
                related_entity_type="assignment",
                related_entity_id=str(assignment.id),
            )
        except Exception:
            # Notifications should never block core workflow
            pass

        # --- Real-time UI sync (ws/dashboard/) ---
        try:
            payload = {
                "assignment_id": str(assignment.id),
                "assignment_code": assignment.assignment_code,
                "status": assignment.status,
                "action": "created",
            }
            publish_to_users(user_ids=[student.user_id], event="assignment.changed", data=payload)
            publish_to_role(role="ADMIN", event="assignment.changed", data=payload)
            publish_to_role(role="CS_REP", event="assignment.changed", data=payload)
        except Exception:
            pass

        # Prepare response with file verification
        response_data = {
            'success': True,
            'message': 'Assignment request submitted successfully!',
            'assignment_id': str(assignment.id),
            'assignment_code': assignment.assignment_code,
            'files_uploaded': uploaded_file_count,
            'files_received': len(files),
            'files_saved_ids': saved_file_ids,
            'file_errors': file_errors if file_errors else []
        }
        
        # Verify and add file details to response
        if verified_files.exists():
            response_data['saved_files'] = [
                {
                    'id': f.id,
                    'name': f.file_name,
                    'type': f.file_type,
                    'created_at': f.created_at.isoformat()
                }
                for f in verified_files
            ]
        
        return JsonResponse(response_data)
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@teacher_required
@require_POST
def start_assignment_process(request, assignment_id):
    """
    Handle teacher changing assignment status to 'in-process'.
    """
    try:
        assignment = get_object_or_404(Assignment, id=assignment_id)
        
        # Check if this teacher is assigned to this assignment
        if not TeacherAssignment.objects.filter(assignment=assignment, teacher=request.user.teacher_profile).exists():
            return JsonResponse({'success': False, 'error': 'You are not assigned to this assignment.'}, status=403)
            
        if assignment.status != 'assigned':
            return JsonResponse({'success': False, 'error': f'Cannot start process. Current status is {assignment.status}.'}, status=400)
            
        assignment.status = 'in-process'
        assignment.save()

        # --- Notifications ---
        try:
            from notifications.services import create_notification, notify_role

            student_user = assignment.student.user
            teacher_user = request.user
            create_notification(
                recipient=student_user,
                actor=teacher_user,
                notification_type="assignment",
                title="Assignment is in progress",
                message=f"Your assignment {assignment.assignment_code} is now in progress.",
                related_entity_type="assignment",
                related_entity_id=str(assignment.id),
            )
            notify_role(
                role="ADMIN",
                actor=teacher_user,
                notification_type="assignment",
                title="Assignment moved to in-progress",
                message=f"{assignment.assignment_code} was started by {teacher_user.get_full_name()}",
                related_entity_type="assignment",
                related_entity_id=str(assignment.id),
            )
        except Exception:
            pass

        # --- Real-time UI sync (ws/dashboard/) ---
        try:
            recipient_ids = {str(assignment.student.user_id)}
            tas = TeacherAssignment.objects.filter(assignment=assignment).select_related("teacher__user")
            recipient_ids.update([str(ta.teacher.user_id) for ta in tas])
            payload = {
                "assignment_id": str(assignment.id),
                "assignment_code": assignment.assignment_code,
                "status": assignment.status,
                "action": "updated",
            }
            publish_to_users(user_ids=recipient_ids, event="assignment.changed", data=payload)
            publish_to_role(role="ADMIN", event="assignment.changed", data=payload)
            publish_to_role(role="CS_REP", event="assignment.changed", data=payload)
        except Exception:
            pass
        
        return JsonResponse({
            'success': True,
            'message': 'Assignment status updated to In-Process.'
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@csrf_exempt
@require_POST
def cancel_assignment(request, assignment_id):
    """
    Handle assignment cancellation or deletion.
    """
    try:
        assignment = get_object_or_404(Assignment, id=assignment_id)
        action = request.GET.get('action', 'cancel')
        
        # Security check: Ensure the assignment belongs to the logged-in student or user is admin
        is_owner = hasattr(request.user, 'student_profile') and assignment.student == request.user.student_profile
        is_admin = request.user.role == 'ADMIN'
        
        if not (is_owner or is_admin):
            return JsonResponse({'success': False, 'error': 'You do not have permission to perform this action.'}, status=403)
        
        if action == 'delete':
            if not is_admin:
                return JsonResponse({'success': False, 'error': 'Only admins can delete assignments.'}, status=403)
            
            # Deletion logic: Move to 'deleted' status
            assignment.status = 'deleted'
            assignment.save()

            # --- Notifications ---
            try:
                from notifications.services import notify_role, notify_users
                # Admin deletion should notify student + assigned teachers (if any)
                recipients = []
                if assignment.student_id:
                    recipients.append(assignment.student.user)
                tas = TeacherAssignment.objects.filter(assignment=assignment).select_related("teacher__user")
                recipients.extend([ta.teacher.user for ta in tas])
                notify_users(
                    recipients=recipients,
                    actor=request.user,
                    notification_type="assignment",
                    title="Assignment deleted",
                    message=f"{assignment.assignment_code} was moved to deleted.",
                    related_entity_type="assignment",
                    related_entity_id=str(assignment.id),
                )
                notify_role(
                    role="CS_REP",
                    actor=request.user,
                    notification_type="assignment",
                    title="Assignment deleted",
                    message=f"{assignment.assignment_code} was moved to deleted.",
                    related_entity_type="assignment",
                    related_entity_id=str(assignment.id),
                )
            except Exception:
                pass

            # --- Real-time UI sync (ws/dashboard/) ---
            try:
                recipient_ids = {str(assignment.student.user_id)} if assignment.student_id else set()
                tas = TeacherAssignment.objects.filter(assignment=assignment).select_related("teacher__user")
                recipient_ids.update([str(ta.teacher.user_id) for ta in tas])
                payload = {
                    "assignment_id": str(assignment.id),
                    "assignment_code": assignment.assignment_code,
                    "status": assignment.status,
                    "action": "updated",
                }
                publish_to_users(user_ids=recipient_ids, event="assignment.changed", data=payload)
                publish_to_role(role="ADMIN", event="assignment.changed", data=payload)
                publish_to_role(role="CS_REP", event="assignment.changed", data=payload)
            except Exception:
                pass

            return JsonResponse({'success': True, 'message': 'Assignment marked as deleted. It will remain in the database and can be viewed in the Assignment Requests tab.'})
            
        else: # Default: cancel
            if assignment.status in ['completed', 'cancelled', 'deleted']:
                return JsonResponse({'success': False, 'error': f'Assignment is already {assignment.status}.'}, status=400)
                
            assignment.status = 'cancelled'
            assignment.save()

            # --- Notifications ---
            try:
                from notifications.services import notify_role, notify_users

                recipients = []
                if assignment.student_id:
                    recipients.append(assignment.student.user)
                tas = TeacherAssignment.objects.filter(assignment=assignment).select_related("teacher__user")
                recipients.extend([ta.teacher.user for ta in tas])
                notify_users(
                    recipients=recipients,
                    actor=request.user,
                    notification_type="assignment",
                    title="Assignment cancelled",
                    message=f"{assignment.assignment_code} was cancelled.",
                    related_entity_type="assignment",
                    related_entity_id=str(assignment.id),
                )
                notify_role(
                    role="ADMIN",
                    actor=request.user,
                    notification_type="assignment",
                    title="Assignment cancelled",
                    message=f"{assignment.assignment_code} was cancelled.",
                    related_entity_type="assignment",
                    related_entity_id=str(assignment.id),
                )
                notify_role(
                    role="CS_REP",
                    actor=request.user,
                    notification_type="assignment",
                    title="Assignment cancelled",
                    message=f"{assignment.assignment_code} was cancelled.",
                    related_entity_type="assignment",
                    related_entity_id=str(assignment.id),
                )
            except Exception:
                pass

            # --- Real-time UI sync (ws/dashboard/) ---
            try:
                recipient_ids = {str(assignment.student.user_id)} if assignment.student_id else set()
                tas = TeacherAssignment.objects.filter(assignment=assignment).select_related("teacher__user")
                recipient_ids.update([str(ta.teacher.user_id) for ta in tas])
                payload = {
                    "assignment_id": str(assignment.id),
                    "assignment_code": assignment.assignment_code,
                    "status": assignment.status,
                    "action": "updated",
                }
                publish_to_users(user_ids=recipient_ids, event="assignment.changed", data=payload)
                publish_to_role(role="ADMIN", event="assignment.changed", data=payload)
                publish_to_role(role="CS_REP", event="assignment.changed", data=payload)
            except Exception:
                pass
            
            return JsonResponse({
                'success': True,
                'message': 'Assignment cancelled successfully!'
            })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@student_required
def student_assignment_list(request):
    """
    Get assignments for the current student.
    """
    student = request.user.student_profile
    assignments = Assignment.objects.filter(student=student).order_by('-created_at')
    # This might be used by a tracker or similar
    data = []
    for a in assignments:
        data.append({
            'id': str(a.id),
            'code': a.assignment_code,
            'title': a.title,
            'status': a.status,
            'due_date': a.due_date.strftime('%Y-%m-%d') if a.due_date else None,
            'created_at': a.created_at.strftime('%Y-%m-%d')
        })
    return JsonResponse({'success': True, 'assignments': data})

@login_required
@admin_required
@csrf_exempt
@require_POST
def assign_teacher(request):
    """
    Admin assigns a primary or helper teacher to an assignment.
    """
    try:
        data = json.loads(request.body)
        assignment_id = data.get('assignment_id')
        teacher_id = data.get('teacher_id') # Can be integer ID or UUID
        is_helper = data.get('is_helper', False)
        
        # Look up assignment and teacher
        if len(str(assignment_id)) > 20: # Likely UUID
            assignment = get_object_or_404(Assignment, id=assignment_id)
        else:
             assignment = get_object_or_404(Assignment, assignment_code=assignment_id)
             
        # Teacher lookup (Try by PK id first, then fallback to teacher_id)
        if not teacher_id:
            return JsonResponse({'success': False, 'error': 'Teacher ID is required.'}, status=400)
            
        try:
            # Check if teacher_id is a valid database PK (integer)
            teacher = Teacher.objects.get(id=teacher_id)
        except (Teacher.DoesNotExist, ValueError, TypeError):
            # Fallback to the 4-digit teacher_id
            teacher = get_object_or_404(Teacher, teacher_id=teacher_id)
        
        # Create or update assignment
        TeacherAssignment.objects.update_or_create(
            assignment=assignment,
            teacher=teacher,
            defaults={'is_helper': is_helper, 'status': 'active'}
        )
        
        # Update assignment status if it was pending
        if assignment.status == 'pending':
            assignment.status = 'assigned'
            assignment.save()

        # --- Notifications ---
        try:
            from notifications.services import create_notification, notify_users

            role_label = "Helper" if is_helper else "Primary"
            teacher_user = teacher.user
            student_user = assignment.student.user

            create_notification(
                recipient=teacher_user,
                actor=request.user,
                notification_type="assignment",
                title="New assignment assigned",
                message=f"You were assigned as {role_label} teacher for {assignment.assignment_code}: {assignment.title}",
                related_entity_type="assignment",
                related_entity_id=str(assignment.id),
            )
            create_notification(
                recipient=student_user,
                actor=request.user,
                notification_type="assignment",
                title="Teacher assigned",
                message=f"{teacher_user.get_full_name()} was assigned to {assignment.assignment_code}. Your assignment status is now 'Assigned'.",
                related_entity_type="assignment",
                related_entity_id=str(assignment.id),
            )

            # Notify other admins (optional) without notifying actor twice
            other_admins = User.objects.filter(role="ADMIN", is_active=True).exclude(id=request.user.id)
            notify_users(
                recipients=other_admins,
                actor=request.user,
                notification_type="assignment",
                title="Teacher assigned",
                message=f"{teacher_user.get_full_name()} assigned to {assignment.assignment_code}",
                related_entity_type="assignment",
                related_entity_id=str(assignment.id),
            )
        except Exception:
            pass

        # --- Real-time UI sync (ws/dashboard/) ---
        try:
            recipient_ids = {str(assignment.student.user_id)}
            tas = TeacherAssignment.objects.filter(assignment=assignment).select_related("teacher__user")
            recipient_ids.update([str(ta.teacher.user_id) for ta in tas])
            payload = {
                "assignment_id": str(assignment.id),
                "assignment_code": assignment.assignment_code,
                "status": assignment.status,
                "action": "updated",
            }
            publish_to_users(user_ids=recipient_ids, event="assignment.changed", data=payload)
            publish_to_role(role="ADMIN", event="assignment.changed", data=payload)
            publish_to_role(role="CS_REP", event="assignment.changed", data=payload)
        except Exception:
            pass
        
        return JsonResponse({
            'success': True,
            'message': f'Teacher {teacher.user.get_full_name()} assigned successfully!'
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@teacher_required
@csrf_exempt
@require_POST
def mark_assignment_complete(request):
    """
    Teacher marks an assignment as complete and uploads necessary files.
    """
    try:
        assignment_id_or_code = request.POST.get('assignmentId')
        service_type = request.POST.get('serviceType', '')
        
        # Robust lookup: Try UUID first, then assignment_code
        try:
            # Check if it's a valid UUID
            import uuid
            uuid.UUID(str(assignment_id_or_code))
            assignment = get_object_or_404(Assignment, id=assignment_id_or_code)
        except (ValueError, TypeError, Assignment.DoesNotExist):
            # Fallback to assignment_code
            assignment = get_object_or_404(Assignment, assignment_code=assignment_id_or_code)
        
        # Security check
        if not TeacherAssignment.objects.filter(assignment=assignment, teacher=request.user.teacher_profile).exists():
            return JsonResponse({'success': False, 'error': 'You are not assigned to this assignment.'}, status=403)
        
        # Basic completion info
        assignment.status = 'completed'
        assignment.completed_at = timezone.now()
        
        # Notes based on service type or common field
        common_notes = request.POST.get('completionNotes', '').strip()
        if common_notes:
            assignment.completion_notes = common_notes
        elif 'writing' in service_type.lower():
            assignment.completion_notes = request.POST.get('writingNotes', '').strip()
        elif 'it project' in service_type.lower():
            assignment.completion_notes = request.POST.get('projectNotes', '').strip()
        
        # Handle exam specific fields
        if 'exam' in service_type.lower() or 'paper' in service_type.lower():
            exam_attempt_date = request.POST.get('examAttemptDate')
            exam_status = request.POST.get('examStatus')
            # For now, append to notes
            assignment.completion_notes = f"Exam Attempted: {exam_attempt_date}. Status: {exam_status}. {assignment.completion_notes or ''}"
            
        assignment.save()

        # --- Notifications ---
        try:
            from notifications.services import create_notification, notify_role

            student_user = assignment.student.user
            teacher_user = request.user
            create_notification(
                recipient=student_user,
                actor=teacher_user,
                notification_type="assignment",
                title="Assignment completed",
                message=f"Your assignment {assignment.assignment_code} has been completed.",
                related_entity_type="assignment",
                related_entity_id=str(assignment.id),
            )
            notify_role(
                role="ADMIN",
                actor=teacher_user,
                notification_type="assignment",
                title="Assignment completed",
                message=f"{assignment.assignment_code} completed by {teacher_user.get_full_name()}",
                related_entity_type="assignment",
                related_entity_id=str(assignment.id),
            )
            notify_role(
                role="CS_REP",
                actor=teacher_user,
                notification_type="assignment",
                title="Assignment completed",
                message=f"{assignment.assignment_code} completed by {teacher_user.get_full_name()}",
                related_entity_type="assignment",
                related_entity_id=str(assignment.id),
            )
        except Exception:
            pass

        # --- Real-time UI sync (ws/dashboard/) ---
        try:
            recipient_ids = {str(assignment.student.user_id)}
            tas = TeacherAssignment.objects.filter(assignment=assignment).select_related("teacher__user")
            recipient_ids.update([str(ta.teacher.user_id) for ta in tas])
            payload = {
                "assignment_id": str(assignment.id),
                "assignment_code": assignment.assignment_code,
                "status": assignment.status,
                "action": "updated",
            }
            publish_to_users(user_ids=recipient_ids, event="assignment.changed", data=payload)
            publish_to_role(role="ADMIN", event="assignment.changed", data=payload)
            publish_to_role(role="CS_REP", event="assignment.changed", data=payload)
        except Exception:
            pass
        
        # Handle file uploads
        file_fields = {
            'assignmentFile': 'solution',
            'additionalDocuments': 'solution',
            'examProof': 'proof',
            'resultReport': 'result',
            'projectDocuments': 'solution',
            'writingDocuments': 'solution'
        }
        
        for field, file_type in file_fields.items():
            files = request.FILES.getlist(field)
            for f in files:
                AssignmentFile.objects.create(
                    assignment=assignment,
                    uploaded_by=request.user,
                    file=f,
                    file_name=f.name,
                    file_type=file_type
                )
        
        return JsonResponse({
            'success': True,
            'message': 'Assignment marked as complete successfully!'
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@student_required
def submit_student_feedback(request):
    """
    Handle feedback submission from student to teacher.
    """
    try:
        data = json.loads(request.body)
        tutor_id = data.get('tutor_id')
        assignment_id = data.get('assignment_id')
        message = data.get('message', '').strip()
        
        if not all([tutor_id, assignment_id, message]):
            return JsonResponse({'success': False, 'error': 'Missing required fields.'}, status=400)
            
        assignment = get_object_or_404(Assignment, id=assignment_id, student=request.user.student_profile)
        teacher = get_object_or_404(Teacher, id=tutor_id)
        
        # Verify teacher is actually assigned to this assignment
        if not TeacherAssignment.objects.filter(assignment=assignment, teacher=teacher).exists():
            return JsonResponse({'success': False, 'error': 'Tutor is not assigned to this assignment.'}, status=403)
            
        AssignmentFeedback.objects.create(
            assignment=assignment,
            from_user=request.user,
            to_teacher=teacher,
            message=message
        )
        
        return JsonResponse({'success': True, 'message': 'Feedback submitted successfully!'})
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON data.'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
def download_assignment_zip(request, assignment_id):
    """
    Generate and download a ZIP file containing assignment solution files and completion notes.
    """
    import io
    import zipfile
    from django.http import FileResponse
    
    try:
        assignment = get_object_or_404(Assignment, id=assignment_id)
        
        # Access control: Student (owner), Admin, or Assigned Teacher
        user = request.user
        can_access = False
        if user.role in ['ADMIN', 'CS_REP']:
            can_access = True
        elif user.role == 'STUDENT' and hasattr(user, 'student_profile') and assignment.student == user.student_profile:
            can_access = True
        elif user.role == 'TEACHER' and hasattr(user, 'teacher_profile') and TeacherAssignment.objects.filter(assignment=assignment, teacher=user.teacher_profile).exists():
            can_access = True
            
        if not can_access:
            return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)

        # Create ZIP in memory
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # 1. Add completion notes
            notes_content = f"Assignment: {assignment.title}\n"
            notes_content += f"Code: {assignment.assignment_code}\n"
            notes_content += f"Status: {assignment.get_status_display()}\n"
            notes_content += f"Completed At: {assignment.completed_at}\n\n"
            notes_content += "--- TEACHER COMPLETION NOTES ---\n"
            notes_content += assignment.completion_notes or "No notes provided."
            
            zip_file.writestr("completion_notes.txt", notes_content)
            
            # 2. Add all files (support and solution)
            for asg_file in assignment.files.all():
                if asg_file.file:
                    try:
                        # Use the actual file path on disk
                        file_path = asg_file.file.path
                        # Use the type name as folder and preserve original filename
                        folder = asg_file.get_file_type_display().replace(' ', '_')
                        zip_file.write(file_path, arcname=f"{folder}/{asg_file.file_name}")
                    except Exception as e:
                        print(f"Error adding file {asg_file.file_name} to ZIP: {e}")

        buffer.seek(0)
        filename = f"Assignment_{assignment.assignment_code}.zip"
        response = FileResponse(buffer, as_attachment=True, filename=filename)
        response['Content-Type'] = 'application/zip'
        return response
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@admin_required
@csrf_exempt
@require_POST
def submit_content_review(request):
    """
    Admin reviews completed work (placeholder for status update or audit log).
    """
    try:
        data = json.loads(request.body)
        assignment_id = data.get('content_id')
        status = data.get('status') # approved, rejected, etc.
        
        assignment = get_object_or_404(Assignment, id=assignment_id)
        # Update status or log the review
        # For now, we can just log it or add a field to Assignment
        return JsonResponse({'success': True, 'message': f'Content marked as {status}.'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@admin_required
@csrf_exempt
@require_POST
def submit_admin_feedback(request):
    """
    Admin sends feedback to a teacher regarding an assignment.
    """
    try:
        data = json.loads(request.body)
        assignment_id = data.get('content_id')
        message = data.get('message')
        priority = data.get('priority', 'normal')
        
        assignment = get_object_or_404(Assignment, id=assignment_id)
        
        # Find the primary teacher for this assignment
        primary_ta = TeacherAssignment.objects.filter(assignment=assignment, is_helper=False).first()
        if not primary_ta:
            return JsonResponse({'success': False, 'error': 'No primary teacher assigned to this assignment.'}, status=400)
            
        AssignmentFeedback.objects.create(
            assignment=assignment,
            from_user=request.user,
            to_teacher=primary_ta.teacher,
            message=message,
            priority=priority
        )

        # --- Notifications ---
        try:
            from notifications.services import create_notification

            teacher_user = primary_ta.teacher.user
            create_notification(
                recipient=teacher_user,
                actor=request.user,
                notification_type="content",
                title="Admin feedback received",
                message=f"Feedback on {assignment.assignment_code}: {message}",
                related_entity_type="assignment",
                related_entity_id=str(assignment.id),
            )
        except Exception:
            pass
        
        return JsonResponse({'success': True, 'message': 'Feedback sent to teacher successfully!'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
def get_assignment_details(request, assignment_id):
    """
    Get detailed information about an assignment for the modal or detail view.
    Accessible by Admin, Student (if owner), and Teacher (if assigned).
    """
    try:
        assignment = get_object_or_404(Assignment, id=assignment_id)
        
        # Access control
        user = request.user
        can_access = False
        
        if user.role == 'ADMIN' or user.role == 'CS_REP':
            can_access = True
        elif user.role == 'STUDENT':
            if hasattr(user, 'student_profile') and assignment.student == user.student_profile:
                can_access = True
        elif user.role == 'TEACHER':
            if hasattr(user, 'teacher_profile') and TeacherAssignment.objects.filter(assignment=assignment, teacher=user.teacher_profile).exists():
                can_access = True
        
        if not can_access:
            return JsonResponse({'success': False, 'error': 'You do not have permission to view this assignment.'}, status=403)
            
        # Get assigned teachers
        teacher_assignments = TeacherAssignment.objects.filter(assignment=assignment).select_related('teacher__user')
        assigned_teachers = []
        for ta in teacher_assignments:
            assigned_teachers.append({
                'id': ta.teacher.id,
                'teacher_id': ta.teacher.teacher_id,
                'name': ta.teacher.user.get_full_name(),
                'avatar': ta.teacher.user.profile_picture.url if ta.teacher.user.profile_picture else None,
                'role': 'helper' if ta.is_helper else 'primary',
                'status': ta.status
            })
            
        # Get files - include all file types (support, solution, proof, result)
        files = AssignmentFile.objects.filter(assignment=assignment).order_by('created_at')
        file_list = []
        
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"=== Assignment Details API Debug ===")
        logger.info(f"Assignment: {assignment.assignment_code} (ID: {assignment.id})")
        logger.info(f"Querying files for assignment...")
        logger.info(f"Found {files.count()} file(s) in database")
        
        for f in files:
            try:
                file_url = f.file.url if f.file else None
                if user.role == 'TEACHER' and file_url:
                    file_url = generate_masked_link(user, file_url, 'assignment_file')
                logger.info(f"  File: {f.file_name} (ID: {f.id}, Type: {f.file_type}, URL: {file_url})")
            except (ValueError, AttributeError) as e:
                # File might not exist or path issue
                logger.warning(f"File URL error for {f.file_name}: {str(e)}")
                file_url = None
            
            file_list.append({
                'id': f.id,
                'name': f.file_name,
                'url': file_url,
                'type': f.file_type
            })
        
        logger.info(f"Returning {len(file_list)} files in API response")
        logger.info(f"================================")
            
        data = {
            'success': True,
            'assignment': {
                'id': str(assignment.id),
                'code': assignment.assignment_code,
                'title': assignment.title,
                'service_type': assignment.get_service_type_display(),
                'status': assignment.status,
                'status_display': assignment.get_status_display(),
                'priority': assignment.priority,
                'priority_display': assignment.get_priority_display(),
                'due_date': assignment.due_date.strftime('%B %d, %Y') if assignment.due_date else None,
                'exam_date': assignment.exam_date.strftime('%B %d, %Y %I:%M %p') if assignment.exam_date else None,
                'description': assignment.description,
                'writing_type': assignment.writing_type,
                'num_pages': assignment.num_pages,
                'created_at': assignment.created_at.strftime('%B %d, %Y'),
                'features': assignment.additional_features,
            },
            'student': {
                'id': str(assignment.student.id),
                'student_id': str(assignment.student.student_id).zfill(4),
                'name': assignment.student.user.get_full_name(),
                'email': assignment.student.user.email,
                'avatar': assignment.student.user.profile_picture.url if assignment.student.user.profile_picture else None,
            },
            'assigned_teachers': assigned_teachers,
            'files': file_list
        }
        return JsonResponse(data)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
def list_assignments_api(request):
    """
    API to list assignments for the thread creation form.
    """
    student_id = request.GET.get('student_id')
    assignments = Assignment.objects.all().order_by('-created_at')
    
    if student_id:
        assignments = assignments.filter(student__id=student_id)
    elif request.user.role == 'STUDENT':
        assignments = assignments.filter(student__user=request.user)
    elif request.user.role == 'TEACHER':
        assignments = assignments.filter(teacher_assignments__teacher__user=request.user)
    
    data = [{
        'id': str(a.id),
        'assignment_code': a.assignment_code,
        'title': a.title
    } for a in assignments[:50]]
    
    return JsonResponse({'success': True, 'assignments': data})
