import json
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from .models import Homework, HomeworkSubmission, HomeworkFile
from account.models import Student, Teacher
from assingment.models import Assignment, TeacherAssignment
from account.decorators import student_required, teacher_required
from account.utils import generate_masked_link
from realtime.services import publish_to_users

@login_required
@teacher_required
@require_POST
@csrf_exempt
def create_homework(request):
    """
    Handle teacher creating a new homework assignment for a student.
    """
    try:
        # Check if request is JSON or form data
        if request.content_type == 'application/json':
            data = json.loads(request.body)
        else:
            data = request.POST

        student_id = data.get('student_id')
        assignment_id = data.get('assignment_id')
        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        due_date = data.get('due_date')
        
        if not all([student_id, title, due_date]):
            return JsonResponse({'success': False, 'error': 'Missing required fields (student, title, or due date).'}, status=400)

        teacher = request.user.teacher_profile
        
        # Student lookup - handle both 4-digit student_id (integer) and database PK (int or UUID)
        student = None
        try:
            # 1. Try lookup by database PK (id)
            # Check if it looks like a UUID
            import uuid
            is_uuid = False
            try:
                if len(str(student_id)) > 30: # Typical UUID length
                    uuid.UUID(str(student_id))
                    is_uuid = True
            except (ValueError, TypeError):
                pass
            
            if is_uuid:
                student = Student.objects.filter(id=student_id).first()
            
            # 2. If not found or not UUID, try numeric lookup
            if not student:
                # Try to convert to int for both PK and student_id
                try:
                    numeric_id = int(str(student_id))
                    # Try PK (id) first
                    student = Student.objects.filter(id=numeric_id).first()
                    # Fallback to student_id (4-digit code)
                    if not student:
                        student = Student.objects.filter(student_id=numeric_id).first()
                except (ValueError, TypeError):
                    # Not numeric, maybe it's a string identifier we missed
                    pass
                
            if not student:
                # Last resort: try exact match on student_id as string
                student = Student.objects.filter(student_id__iexact=str(student_id)).first()
                
            if not student:
                return JsonResponse({'success': False, 'error': f'Student with identifier "{student_id}" not found. Please ensure the student exists.'}, status=404)
        except Exception as e:
            return JsonResponse({'success': False, 'error': f'Error finding student: {str(e)}'}, status=500)
            
        assignment = None
        if assignment_id and assignment_id != '':
            assignment = get_object_or_404(Assignment, id=assignment_id)
            
        homework = Homework.objects.create(
            teacher=teacher,
            student=student,
            assignment=assignment,
            title=title,
            description=description,
            due_date=due_date,
            status='pending'
        )

        # --- Notifications ---
        try:
            from notifications.services import create_notification

            create_notification(
                recipient=student.user,
                actor=request.user,
                notification_type="homework",
                title="New homework assigned",
                message=f"{teacher.user.get_full_name()} assigned homework: {homework.title}",
                related_entity_type="homework",
                related_entity_id=str(homework.id),
            )
        except Exception:
            pass

        # --- Real-time UI sync (ws/dashboard/) ---
        try:
            payload = {
                "homework_id": str(homework.id),
                "status": homework.status,
                "action": "created",
            }
            publish_to_users(user_ids=[str(student.user_id), str(teacher.user_id)], event="homework.changed", data=payload)
        except Exception:
            pass
        
        return JsonResponse({
            'success': True,
            'message': 'Homework assigned successfully!',
            'homework_id': str(homework.id)
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@teacher_required
def list_teacher_homeworks(request):
    """
    List all homework assignments created by the teacher.
    """
    teacher = request.user.teacher_profile
    homeworks = Homework.objects.filter(teacher=teacher).select_related('student__user', 'assignment').prefetch_related('submission__attachments')
    
    data = []
    for hw in homeworks:
        submission = None
        if hasattr(hw, 'submission'):
            attachments = []
            for f in hw.submission.attachments.all():
                url = f.file.url
                if request.user.role == 'TEACHER':
                    url = generate_masked_link(request.user, url, 'homework_file')
                attachments.append({'name': f.file_name, 'size': format_file_size(f.file.size), 'url': url})
                
            submission = {
                'notes': hw.submission.notes,
                'submitted_at': hw.submission.submitted_at.isoformat(),
                'attachments': attachments
            }
            
        data.append({
            'id': str(hw.id),
            'title': hw.title,
            'student': hw.student.user.get_full_name(),
            'student_id': str(hw.student.student_id).zfill(4),
            'due': hw.due_date.isoformat(),
            'status': hw.status,
            'description': hw.description,
            'grade': hw.grade,
            'grade_percentage': hw.grade_percentage,
            'feedback': hw.feedback,
            'submission': submission
        })
    return JsonResponse({'success': True, 'homeworks': data})

@login_required
@student_required
def list_student_homeworks(request):
    """
    List all homework assigned to the student.
    """
    student = request.user.student_profile
    homeworks = Homework.objects.filter(student=student).select_related('teacher__user')
    
    data = []
    for hw in homeworks:
        data.append({
            'id': str(hw.id),
            'title': hw.title,
            'teacher': hw.teacher.user.get_full_name(),
            'due': hw.due_date.strftime('%b %d, %Y'),
            'status': hw.status,
            'grade': hw.grade,
            'grade_percentage': hw.grade_percentage
        })
    return JsonResponse({'success': True, 'homeworks': data})

@login_required
@student_required
@require_POST
@csrf_exempt
def submit_homework(request):
    """
    Handle student homework submission with notes and files.
    """
    try:
        homework_id = request.POST.get('homework_id')
        notes = request.POST.get('notes', '').strip()
        files = request.FILES.getlist('files')
        
        print(f"[DEBUG] Submitting homework. ID: {homework_id}")
        print(f"[DEBUG] User: {request.user.email}, Role: {request.user.role}")
        sp = getattr(request.user, 'student_profile', None)
        print(f"[DEBUG] Student Profile: {sp.id if sp else 'NONE'}")
        print(f"[DEBUG] POST keys: {list(request.POST.keys())}")
        
        if not homework_id:
            return JsonResponse({'success': False, 'error': 'homework_id is required.'}, status=400)
        
        try:
            # Explicitly check if the homework exists regardless of student
            hw_check = Homework.objects.filter(id=homework_id).first()
            if hw_check:
                print(f"[DEBUG] HW exists. Assigned to Student ID: {hw_check.student.id}")
            else:
                print(f"[DEBUG] HW does NOT exist in database at all.")

            homework = Homework.objects.get(id=homework_id, student=request.user.student_profile)
        except (Homework.DoesNotExist, ValueError, TypeError) as e:
            exists = Homework.objects.filter(id=homework_id).exists()
            return JsonResponse({
                'success': False, 
                'error': 'Homework not found or access denied.',
                'debug_info': {
                    'exception': str(e),
                    'id_received': str(homework_id),
                    'student_id_in_session': str(request.user.student_profile.id) if hasattr(request.user, 'student_profile') else None,
                    'exists_at_all': exists
                }
            }, status=404)
        
        if homework.status != 'pending':
            return JsonResponse({'success': False, 'error': 'Homework is already submitted or graded.'}, status=400)
        
        # Check if submission already exists
        try:
            submission = HomeworkSubmission.objects.get(homework=homework)
            # Update existing submission
            submission.notes = notes
            submission.save()
            # Delete existing files to replace with new ones
            submission.attachments.all().delete()
        except HomeworkSubmission.DoesNotExist:
            # Create new submission
            submission = HomeworkSubmission.objects.create(
                homework=homework,
                notes=notes
            )
        
        # Add new files
        for f in files:
            HomeworkFile.objects.create(
                submission=submission,
                uploaded_by=request.user,
                file=f,
                file_name=f.name,
                file_type='submission'
            )
            
        homework.status = 'submitted'
        homework.save()

        # --- Notifications ---
        try:
            from notifications.services import create_notification

            create_notification(
                recipient=homework.teacher.user,
                actor=request.user,
                notification_type="homework",
                title="Homework submitted",
                message=f"{request.user.get_full_name()} submitted homework: {homework.title}",
                related_entity_type="homework",
                related_entity_id=str(homework.id),
            )
        except Exception:
            pass

        # --- Real-time UI sync (ws/dashboard/) ---
        try:
            payload = {
                "homework_id": str(homework.id),
                "status": homework.status,
                "action": "updated",
            }
            publish_to_users(user_ids=[str(homework.student.user_id), str(homework.teacher.user_id)], event="homework.changed", data=payload)
        except Exception:
            pass
        
        return JsonResponse({'success': True, 'message': 'Homework submitted successfully!'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@teacher_required
@require_POST
@csrf_exempt
def grade_homework(request):
    """
    Handle teacher grading of a student's homework.
    """
    try:
        data = json.loads(request.body)
        homework_id = data.get('homework_id')
        grade = data.get('grade')
        percentage = data.get('percentage')
        feedback = data.get('feedback', '').strip()
        
        try:
            homework = Homework.objects.get(id=homework_id, teacher=request.user.teacher_profile)
        except Homework.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Homework not found or access denied.'}, status=404)
        
        homework.status = 'graded'
        homework.grade = grade
        homework.grade_percentage = percentage if percentage != '' else None
        homework.feedback = feedback
        homework.graded_at = timezone.now()
        homework.save()

        # --- Notifications ---
        try:
            from notifications.services import create_notification

            create_notification(
                recipient=homework.student.user,
                actor=request.user,
                notification_type="homework",
                title="Homework graded",
                message=f"Your homework '{homework.title}' was graded ({homework.grade or 'Graded'}).",
                related_entity_type="homework",
                related_entity_id=str(homework.id),
            )
        except Exception:
            pass

        # --- Real-time UI sync (ws/dashboard/) ---
        try:
            payload = {
                "homework_id": str(homework.id),
                "status": homework.status,
                "action": "updated",
            }
            publish_to_users(user_ids=[str(homework.student.user_id), str(homework.teacher.user_id)], event="homework.changed", data=payload)
        except Exception:
            pass
        
        return JsonResponse({'success': True, 'message': 'Homework graded successfully!'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
def get_homework_details(request, homework_id):
    """
    Fetch details of a specific homework assignment.
    """
    try:
        try:
            homework = Homework.objects.get(id=homework_id)
        except Homework.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Homework not found.'}, status=404)
        
        # Access control: Must be the student, the teacher, or an admin
        user = request.user
        can_access = False
        if user.role == 'ADMIN' or user.role == 'CS_REP':
            can_access = True
        elif user.role == 'STUDENT' and homework.student.user == user:
            can_access = True
        elif user.role == 'TEACHER' and homework.teacher.user == user:
            can_access = True
            
        if not can_access:
            return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)
            
        submission = None
        if hasattr(homework, 'submission'):
            attachments = []
            for f in homework.submission.attachments.all():
                url = f.file.url
                if user.role == 'TEACHER':
                    url = generate_masked_link(user, url, 'homework_file')
                attachments.append({'name': f.file_name, 'size': format_file_size(f.file.size), 'url': url})
                
            submission = {
                'notes': homework.submission.notes,
                'submitted_at': homework.submission.submitted_at.strftime('%Y-%m-%d %H:%M:%S'),
                'attachments': attachments
            }
            
        data = {
            'success': True,
            'homework': {
                'id': str(homework.id),
                'title': homework.title,
                'description': homework.description,
                'teacher': homework.teacher.user.get_full_name(),
                'teacher_email': homework.teacher.user.email,
                'student': homework.student.user.get_full_name(),
                'student_email': homework.student.user.email,
                'student_id': str(homework.student.student_id).zfill(4),
                'email': homework.student.user.email,  # Flat fallback
                'studentId': str(homework.student.student_id).zfill(4), # Flat fallback
                'due': homework.due_date.isoformat(),
                'due_display': homework.due_date.strftime('%B %d, %Y %I:%M %p'),
                'status': homework.status,
                'status_display': homework.get_status_display(),
                'grade': homework.grade,
                'grade_percentage': homework.grade_percentage,
                'feedback': homework.feedback,
                'submission': submission
            }
        }
        return JsonResponse(data)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@teacher_required
def get_assigned_students(request):
    """
    API for teachers to get a list of students they are currently working with.
    """
    teacher = request.user.teacher_profile
    # Get unique students from assignments assigned to this teacher
    assignments = TeacherAssignment.objects.filter(teacher=teacher).select_related('assignment__student__user')
    
    students_dict = {}
    for ta in assignments:
        student = ta.assignment.student
        if student.id not in students_dict:
            students_dict[student.id] = {
                'id': str(student.id),
                'student_id': str(student.student_id).zfill(4),
                'name': student.user.get_full_name(),
                'assignments': []
            }
        students_dict[student.id]['assignments'].append({
            'id': str(ta.assignment.id),
            'title': ta.assignment.title,
            'code': ta.assignment.assignment_code
        })
        
    return JsonResponse({'success': True, 'students': list(students_dict.values())})

def format_file_size(bytes):
    if bytes == 0: return '0 Bytes'
    import math
    k = 1024
    sizes = ['Bytes', 'KB', 'MB', 'GB']
    i = math.floor(math.log(bytes) / math.log(k))
    return f"{round(bytes / math.pow(k, i), 2)} {sizes[i]}"
