import json
import uuid
import random
import logging
import traceback
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.utils import timezone
from datetime import timedelta
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.views import View
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from .models import User, Student, Teacher, CSRep, Admin, TeacherFeedback, TeacherReport, MaskedLink, Visitor
from .decorators import student_required, teacher_required, csrep_required, admin_required
from .utils import log_security_event, generate_masked_link
from assingment.models import Assignment, TeacherAssignment, AssignmentFile, AssignmentFeedback
from invoice.models import Invoice
from todo.models import Todo
from django.views.decorators.http import require_GET


def login_page_view(request):
    """
    Render the login page template for staff (Teacher, CS-Rep, Admin).
    """
    return render(request, 'login/login.html')


@csrf_exempt
def register_view(request):
    """
    Student registration view.
    - GET: Renders the registration.html template (contains both signup and signin forms)
    - POST: Handles student registration API endpoint
    """
    # Handle GET request - render the template
    if request.method == 'GET':
        return render(request, 'login/registration.html')
    
    # Handle POST request - process registration
    if request.method != 'POST':
        return JsonResponse({
            'error': 'Method not allowed.',
            'success': False
        }, status=405)
    
    try:
        data = json.loads(request.body)
        
        email = data.get('email', '').strip()
        password = data.get('password', '')
        password2 = data.get('password2', '')
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        # Handle phone - it might be None, empty string, or a value
        phone_value = data.get('phone')
        if phone_value:
            phone = phone_value.strip() or None
        else:
            phone = None
        
        # Validation
        if not all([email, password, password2, first_name, last_name]):
            return JsonResponse({
                'error': 'All required fields must be provided.',
                'success': False
            }, status=400)
        
        # Validate email format
        try:
            validate_email(email)
        except ValidationError:
            return JsonResponse({
                'error': 'Invalid email format.',
                'success': False
            }, status=400)
        
        # Check password match
        if password != password2:
            return JsonResponse({
                'error': 'Passwords do not match.',
                'success': False
            }, status=400)
        
        # Check password length
        if len(password) < 8:
            return JsonResponse({
                'error': 'Password must be at least 8 characters long.',
                'success': False
            }, status=400)
        
        # Check if email already exists
        if User.objects.filter(email=email).exists():
            return JsonResponse({
                'error': 'A user with this email already exists.',
                'success': False
            }, status=400)
        
        # Generate unique username from email
        base_username = email.split('@')[0]
        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1
        
        # Create user with STUDENT role (active by default)
        user = User.objects.create_user(
            email=email,
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role='STUDENT',
            is_active=True  # Account is active immediately
        )

        # Update student profile with phone if provided
        if phone and hasattr(user, 'student_profile'):
            user.student_profile.phone = phone
            user.student_profile.save()

        # Create session for the newly registered user (auto-login)
        from django.contrib.auth import login
        login(request, user)

        # Log registration and session creation
        log_security_event(request, "REGISTRATION", user=user, status="SUCCESS", details="New student registered")
        log_security_event(request, "SESSION_CREATED", user=user, status="SUCCESS", details=f"Session key: {request.session.session_key}")

        session_key = request.session.session_key
        if not session_key:
            request.session.save()
            session_key = request.session.session_key

        return JsonResponse({
            'success': True,
            'message': 'Registration successful! Welcome to Nano Problem.',
            'student': {
                'id': str(user.id),
                'email': user.email,
                'student_id': user.student_profile.student_id if hasattr(user, 'student_profile') else None,
                'first_name': user.first_name,
                'last_name': user.last_name,
            },
            'tokens': {
                'access': session_key,
                'refresh': session_key,
            }
        }, status=201)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'error': 'Invalid JSON data.',
            'success': False
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'error': f'Registration failed: {str(e)}',
            'success': False
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    """
    Login endpoint for all user roles.
    Handles both student login (email) and staff login (user_id).
    Receives data from login.html form.
    """
    try:
        data = json.loads(request.body)
        
        role = data.get('role', '').strip()
        password = data.get('password', '')
        
        # Determine identifier type
        email = data.get('email', '').strip()
        user_id = data.get('user_id', '').strip()
        
        identifier = email or user_id
        
        if not identifier or not password:
            return JsonResponse({
                'error': 'Email/User ID and password are required.',
                'success': False
            }, status=400)
        
        if not role:
            return JsonResponse({
                'error': 'Role selection is required.',
                'success': False
            }, status=400)
        
        # Find user based on identifier and authenticate
        user = None
        auth_email = None
        
        try:
            if email:
                # Student login with email
                auth_email = email
                user = User.objects.get(email=email)
                # Ensure student is logging in (allow if role is student or if no role specified)
                if role and role.lower() == 'student' and user.role != 'STUDENT':
                    return JsonResponse({
                        'error': 'This account is not a student account.',
                        'success': False
                    }, status=403)
                # If no role specified but user is not a student, still allow (for flexibility)
                # But if role is specified and doesn't match, reject
                if role and role.lower() != 'student' and user.role == 'STUDENT':
                    return JsonResponse({
                        'error': 'Students must use the registration page to sign in.',
                        'success': False
                    }, status=403)
            elif user_id:
                # Staff login with user_id (UUID or username)
                user = None
                
                # Check if user_id is a valid UUID format
                try:
                    # Try to parse as UUID first
                    uuid.UUID(user_id)
                    # If successful, it's a valid UUID format, try to get user by UUID
                    try:
                        user = User.objects.get(id=user_id)
                    except User.DoesNotExist:
                        pass
                except (ValueError, AttributeError):
                    # Not a valid UUID format, try username lookup
                    pass
                
                # If user not found by UUID, try username
                if user is None:
                    try:
                        user = User.objects.get(username=user_id)
                    except User.DoesNotExist:
                        log_security_event(request, "LOGIN", status="FAILURE", details=f"Invalid User ID: {user_id}")
                        return JsonResponse({
                            'error': 'Invalid credentials. Please check your User ID/Username and password.',
                            'success': False
                        }, status=401)
                
                # Block student login on staff login page
                if user.role == 'STUDENT':
                    log_security_event(request, "LOGIN", user=user, status="FAILURE", details="Student attempting staff login")
                    return JsonResponse({
                        'error': 'Students cannot login here. Please use the registration page.',
                        'success': False
                    }, status=403)
                
                # Verify role matches if provided
                normalized_role = role.upper().replace('-', '_')
                if role and user.role != normalized_role:
                    log_security_event(request, "LOGIN", user=user, status="FAILURE", details=f"Role mismatch. Expected: {normalized_role}, Actual: {user.role}")
                    return JsonResponse({
                        'error': 'Role mismatch. Please check your role selection.',
                        'success': False
                    }, status=403)
                
                # Verify password directly since we already have the user object
                if not user.check_password(password):
                    log_security_event(request, "LOGIN", user=user, status="FAILURE", details="Incorrect password")
                    return JsonResponse({
                        'error': 'Invalid credentials. Please check your User ID/Username and password.',
                        'success': False
                    }, status=401)
                
                # Use user's email for authentication (for session creation)
                auth_email = user.email
            else:
                return JsonResponse({
                    'error': 'Email or User ID is required.',
                    'success': False
                }, status=400)
        except User.DoesNotExist:
            return JsonResponse({
                'error': 'Invalid credentials.',
                'success': False
            }, status=401)
        
        # For email-based login (students), use authenticate
        if email:
            authenticated_user = authenticate(request, username=auth_email, password=password)
            if authenticated_user is None:
                log_security_event(request, "LOGIN", status="FAILURE", details=f"Invalid email login: {auth_email}")
                return JsonResponse({
                    'error': 'Invalid credentials. Please check your email and password.',
                    'success': False
                }, status=401)
            user = authenticated_user
        
        if not user.is_active:
            log_security_event(request, "LOGIN", user=user, status="FAILURE", details="Account blocked")
            return JsonResponse({
                'error': 'You are blocked from this site. Please reach out to the admin.',
                'success': False
            }, status=403)
        
        # Login user (creates session)
        login(request, user)
        
        # Log successful login and session creation
        log_security_event(request, "LOGIN", user=user, status="SUCCESS", details="User logged in successfully")
        log_security_event(request, "SESSION_CREATED", user=user, status="SUCCESS", details=f"Session key: {request.session.session_key}")
        
        # Generate session-based tokens for frontend compatibility
        session_key = request.session.session_key
        if not session_key:
            request.session.save()
            session_key = request.session.session_key
        
        # Prepare response data
        response_data = {
            'success': True,
            'message': 'Login successful.',
            'role': user.role,
            'user_id': str(user.id),
            'email': user.email,
            'tokens': {
                'access': session_key,
                'refresh': session_key,
            }
        }
        
        # Add role-specific data
        if user.role == 'STUDENT' and hasattr(user, 'student_profile'):
            response_data['student_id'] = user.student_profile.student_id
        
        return JsonResponse(response_data, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'error': 'Invalid JSON data.',
            'success': False
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'error': f'Login failed: {str(e)}',
            'success': False
        }, status=500)


@login_required
def logout_view(request):
    """
    Logout endpoint for all user roles with role-based redirection.
    """
    user = request.user
    user_role = getattr(user, 'role', 'STUDENT')
    
    # Log logout and session invalidation
    if user.is_authenticated:
        log_security_event(request, "LOGOUT", user=user, status="SUCCESS", details="User logged out")
        log_security_event(request, "SESSION_INVALIDATED", user=user, status="SUCCESS", details=f"Session key: {request.session.session_key}")
    
    logout(request)
    
    # Redirection logic
    if user_role == 'STUDENT':
        redirect_url = '/study/home/'
    else:
        # For Admin, Teacher, CS-Rep
        redirect_url = '/account/login/'
    
    # Check if it's an AJAX request (for frontend redirection)
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or \
       (request.content_type and 'application/json' in request.content_type):
        return JsonResponse({
            'success': True,
            'message': 'Logged out successfully.',
            'redirect_url': redirect_url
        }, status=200)
    
    # Standard redirection for form submits
    return redirect(redirect_url)


@login_required
@ensure_csrf_cookie
@require_http_methods(["GET", "POST"])
def profile_view(request):
    """
    Profile view for viewing and updating user information.
    Supports all roles.
    """
    user = request.user
    
    if request.method == 'GET':
        # Return current profile data
        profile_data = {
            'id': str(user.id),
            'email': user.email,
            'username': user.username,
            'role': user.role,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'profile_picture': user.profile_picture.url if user.profile_picture else None,
            'created_at': user.created_at.isoformat(),
        }
        
        # Add role-specific data
        if user.role == 'STUDENT' and hasattr(user, 'student_profile'):
            profile_data['student_id'] = user.student_profile.student_id
            profile_data['phone'] = user.student_profile.phone
            profile_data['timezone'] = user.student_profile.timezone
        elif user.role == 'TEACHER' and hasattr(user, 'teacher_profile'):
            tp = user.teacher_profile
            profile_data['phone'] = tp.phone
            profile_data['title'] = tp.title
            profile_data['qualifications'] = tp.qualifications
            profile_data['primary_subject'] = tp.primary_subject
            profile_data['years_of_experience'] = tp.years_of_experience
            profile_data['bio'] = tp.bio
        elif user.role == 'CS_REP' and hasattr(user, 'csrep_profile'):
            profile_data['csrep_id'] = user.csrep_profile.id
        elif user.role == 'ADMIN' and hasattr(user, 'admin_profile'):
            profile_data['access_level'] = user.admin_profile.access_level
        
        return JsonResponse({
            'success': True,
            'profile': profile_data
        }, status=200)
    
    elif request.method == 'POST':
        try:
            if request.content_type and 'application/json' in request.content_type:
                data = json.loads(request.body)
            else:
                data = request.POST
            
            if 'first_name' in data:
                user.first_name = data['first_name'].strip()
            if 'last_name' in data:
                user.last_name = data['last_name'].strip()
            # Track email change for notification
            old_email = None
            new_email = None
            if 'email' in data:
                new_email = data['email'].strip()
                try:
                    validate_email(new_email)
                except ValidationError:
                    return JsonResponse({'error': 'Invalid email format.', 'success': False}, status=400)
                if User.objects.filter(email=new_email).exclude(id=user.id).exists():
                    return JsonResponse({'error': 'This email is already in use.', 'success': False}, status=400)
                old_email = user.email
                user.email = new_email
            
            user.save()

            if user.role == 'STUDENT' and hasattr(user, 'student_profile'):
                sp = user.student_profile
                if 'phone' in data: sp.phone = data['phone'].strip() if data['phone'] else None
                if 'phoneNumber' in data: sp.phone = data['phoneNumber'].strip() if data['phoneNumber'] else None
                if 'timezone' in data: sp.timezone = data['timezone'].strip() or 'UTC'
                sp.save()
            elif user.role == 'TEACHER' and hasattr(user, 'teacher_profile'):
                tp = user.teacher_profile
                if 'phone' in data: tp.phone = data['phone'].strip() if data['phone'] else None
                if 'title' in data: tp.title = data['title'].strip() if data['title'] else None
                if 'qualifications' in data: tp.qualifications = data['qualifications'].strip() if data['qualifications'] else None
                if 'primary_subject' in data: tp.primary_subject = data['primary_subject'].strip() if data['primary_subject'] else None
                if 'years_of_experience' in data:
                    try:
                        tp.years_of_experience = int(data['years_of_experience']) if data['years_of_experience'] else 0
                    except (ValueError, TypeError):
                        tp.years_of_experience = 0
                if 'bio' in data: tp.bio = data['bio'].strip() if data['bio'] else None
                tp.save()
            elif user.role == 'ADMIN' and hasattr(user, 'admin_profile'):
                ap = user.admin_profile
                if 'access_level' in data: ap.access_level = data['access_level'].strip()
                if 'title' in data: ap.access_level = data['title'].strip()
                ap.save()
            
            profile_picture_url = None
            if 'profile_picture' in request.FILES:
                user.profile_picture = request.FILES['profile_picture']
                user.save()
                profile_picture_url = user.profile_picture.url if user.profile_picture else None
            elif 'remove_profile_picture' in data and data['remove_profile_picture'] == 'true':
                if user.profile_picture: user.profile_picture.delete(save=False)
                user.profile_picture = None
                user.save()
            else:
                # Return existing profile picture URL if no new picture was uploaded
                profile_picture_url = user.profile_picture.url if user.profile_picture else None
            
            response_data = {
                'success': True, 
                'message': 'Profile updated successfully.',
                'profile_picture_url': profile_picture_url
            }
            return JsonResponse(response_data, status=200)
        except Exception as e:
            return JsonResponse({'error': f'Profile update failed: {str(e)}', 'success': False}, status=500)


@login_required
@student_required
def student_dashboard_view(request):
    user = request.user
    sp = getattr(user, 'student_profile', None)
    
    context = {
        'user': user,
        'student_profile': sp,
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'email': user.email or '',
        'student_id': str(sp.student_id).zfill(4) if sp and sp.student_id else '',
        'phone': sp.phone if sp else '',
        'profile_picture_url': user.profile_picture.url if user.profile_picture else None,
    }
    
    if sp:
        from meeting.models import Meeting
        from django.db.models import Max
        
        # Fetch assigned teachers with their assignments
        teacher_assignments = TeacherAssignment.objects.filter(
            assignment__student=sp,
            status='active'
        ).select_related('teacher__user', 'assignment').distinct()
        
        # Get unique teachers
        teachers_dict = {}
        for ta in teacher_assignments:
            teacher = ta.teacher
            if teacher.id not in teachers_dict:
                teachers_dict[teacher.id] = {
                    'teacher': teacher,
                    'assignments': []
                }
            teachers_dict[teacher.id]['assignments'].append(ta.assignment)
        
        context['assigned_teachers'] = list(teachers_dict.values())
        
        # Fetch scheduled meetings (upcoming and recent)
        context['scheduled_meetings'] = Meeting.objects.filter(
            student=user,
            status__in=['scheduled', 'in_progress']
        ).select_related('teacher', 'host').order_by('scheduled_at')[:5]
        
        # Fetch recent assignment actions
        recent_assignments = Assignment.objects.filter(
            student=sp
        ).annotate(
            last_file_upload=Max('files__created_at'),
            last_activity=Max('updated_at')
        ).order_by('-updated_at')[:5]
        
        recent_actions = []
        for assignment in recent_assignments:
            if assignment.updated_at:
                recent_actions.append({
                    'type': 'status_update',
                    'assignment': assignment,
                    'action': f"Status updated to {assignment.get_status_display()}",
                    'timestamp': assignment.updated_at,
                    'user': None
                })
            
            recent_files = AssignmentFile.objects.filter(
                assignment=assignment
            ).select_related('uploaded_by').order_by('-created_at')[:3]
            
            for file_obj in recent_files:
                recent_actions.append({
                    'type': 'file_upload',
                    'assignment': assignment,
                    'action': f"{file_obj.get_file_type_display()} uploaded: {file_obj.file_name}",
                    'timestamp': file_obj.created_at,
                    'user': file_obj.uploaded_by
                })
        
        recent_actions.sort(key=lambda x: x['timestamp'], reverse=True)
        context['recent_actions'] = recent_actions[:10]
    
    return render(request, 'student/dashboard.html', context)


@login_required
@student_required
def student_profile_view(request):
    """
    Student profile page with user data pre-filled.
    """
    user = request.user
    context = {
        'user': user,
        'student_profile': user.student_profile if hasattr(user, 'student_profile') else None,
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'email': user.email or '',
        'student_id': str(user.student_profile.student_id).zfill(4) if hasattr(user, 'student_profile') else '',
        'phone': user.student_profile.phone if hasattr(user, 'student_profile') else '',
        'profile_picture_url': user.profile_picture.url if user.profile_picture else None,
    }
    return render(request, 'student/profile.html', context)


@login_required
def student_section_view(request, section_name):
    section_template_map = {
        'dashboard': 'student/dashboard.html',
        'messages': 'student/messages.html',
        'threads': 'student/threads.html',
        'meetings': 'student/meetings.html',
        'assignment': 'student/request_assignment.html',
        'tracker': 'student/assignment_tracker.html',
        'assignment-detail': 'student/assignment_detail.html',
        'writings': 'student/writings.html',
        'tutors': 'student/tutors.html',
        'onlineExams': 'student/online_exam.html',
        'invoices': 'student/invoices.html',
        'paymentHistory': 'student/payment_history.html',
        'homework': 'student/homework.html',
        'announcements': 'student/announcements.html',
        'notifications': 'student/notifications.html',
        'profile': 'student/profile.html',
        'settings': 'student/profile_settings.html',
    }
    
    template_name = section_template_map.get(section_name)
    if not template_name:
        return JsonResponse({'error': f'Section "{section_name}" not found.', 'success': False}, status=404)
    
    user = request.user
    sp = getattr(user, 'student_profile', None)
    
    # Import necessary models here at function level to avoid UnboundLocalError
    # or rely on top-level imports. The top-level imports already exist.
    from assingment.models import TeacherAssignment, Assignment, AssignmentFile, AssignmentFeedback
    
    context = {
        'user': user,
        'student_profile': sp,
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'email': user.email or '',
        'student_id': str(sp.student_id).zfill(4) if sp and sp.student_id else '',
        'phone': sp.phone if sp else '',
        'profile_picture_url': user.profile_picture.url if user.profile_picture else None,
    }
    
    if section_name == 'dashboard' and sp:
        from meeting.models import Meeting
        from django.db.models import Max
        
        # Fetch assigned teachers with their assignments
        teacher_assignments = TeacherAssignment.objects.filter(
            assignment__student=sp,
            status='active'
        ).select_related('teacher__user', 'assignment').distinct()
        
        # Get unique teachers
        teachers_dict = {}
        for ta in teacher_assignments:
            teacher = ta.teacher
            if teacher.id not in teachers_dict:
                teachers_dict[teacher.id] = {
                    'teacher': teacher,
                    'assignments': []
                }
            teachers_dict[teacher.id]['assignments'].append(ta.assignment)
        
        context['assigned_teachers'] = list(teachers_dict.values())
        
        # Fetch scheduled meetings (upcoming and recent)
        context['scheduled_meetings'] = Meeting.objects.filter(
            student=user,
            status__in=['scheduled', 'in_progress']
        ).select_related('teacher', 'host').order_by('scheduled_at')[:5]
        
        # Fetch recent assignment actions
        # Get recent assignments with their latest activity
        recent_assignments = Assignment.objects.filter(
            student=sp
        ).annotate(
            last_file_upload=Max('files__created_at'),
            last_activity=Max('updated_at')
        ).order_by('-updated_at')[:5]
        
        # Build action list combining assignment updates and file uploads
        recent_actions = []
        for assignment in recent_assignments:
            # Add assignment status change as action
            if assignment.updated_at:
                recent_actions.append({
                    'type': 'status_update',
                    'assignment': assignment,
                    'action': f"Status updated to {assignment.get_status_display()}",
                    'timestamp': assignment.updated_at,
                    'user': None  # System update
                })
            
            # Add file uploads as actions
            recent_files = AssignmentFile.objects.filter(
                assignment=assignment
            ).select_related('uploaded_by').order_by('-created_at')[:3]
            
            for file_obj in recent_files:
                recent_actions.append({
                    'type': 'file_upload',
                    'assignment': assignment,
                    'action': f"{file_obj.get_file_type_display()} uploaded: {file_obj.file_name}",
                    'timestamp': file_obj.created_at,
                    'user': file_obj.uploaded_by
                })
        
        # Sort by timestamp and get most recent
        recent_actions.sort(key=lambda x: x['timestamp'], reverse=True)
        context['recent_actions'] = recent_actions[:10]
    
    if section_name == 'tracker' and sp:
        context['assignments'] = Assignment.objects.filter(student=sp).order_by('-created_at')
    
    if section_name == 'meetings' and sp:
        from django.db.models import Prefetch
        # Fetch tutors for the schedule dropdown
        tutors = Teacher.objects.filter(
            assigned_tasks__assignment__student=sp
        ).select_related('user').distinct()
        context['tutors'] = tutors
        
        # Sourcing meetings strictly from database
        from meeting.models import Meeting
        context['meetings'] = Meeting.objects.filter(student=user).order_by('-scheduled_at')
    
    if section_name == 'onlineExams' and sp:
        from exam.models import Exam, ExamAttempt
        from django.db.models import Avg
        exams = Exam.objects.filter(student=sp).select_related('teacher__user', 'assignment').prefetch_related('attempts')
        context['exams_list'] = exams
        
        # Calculate stats
        context['total_exams'] = exams.count()
        context['completed_exams'] = exams.filter(status='completed').count()
        context['pending_exams'] = exams.filter(status='pending').count()
        
        # Average score (only for graded attempts)
        avg_score = ExamAttempt.objects.filter(student=sp, status='graded').aggregate(Avg('score'))['score__avg']
        context['avg_score'] = round(avg_score) if avg_score else 0

    if section_name == 'tutors':
        logger = logging.getLogger(__name__)
        # Always initialize tutors in context to prevent template errors
        context['tutors'] = []
        
        # Fetch unique teachers assigned to this student's assignments
        if sp:
            try:
                # Use TeacherAssignment to find all teachers and their tasks for this student
                # We fetch all related assignments for this student to ensure we get all tutors
                
                # Debug logging
                logger.info(f"Fetching tutors for student profile ID: {sp.id}")
                
                # Use the global TeacherAssignment import
                teacher_assignments = TeacherAssignment.objects.filter(
                    assignment__student=sp
                ).select_related('teacher__user', 'assignment')
                
                logger.info(f"Found {teacher_assignments.count()} teacher assignments for student {sp.id}")
                
                # Group teacher assignments by teacher
                tutor_map = {}
                for ta in teacher_assignments:
                    tutor = ta.teacher
                    logger.info(f"Processing TA: {ta.id}, Teacher: {tutor.user.get_full_name()}, Assignment: {ta.assignment.assignment_code}")
                    if tutor.id not in tutor_map:
                        tutor.student_tasks = []  # Initialize tasks list for template
                        tutor_map[tutor.id] = tutor
                    tutor_map[tutor.id].student_tasks.append(ta)
                
                context['tutors'] = list(tutor_map.values())
                logger.info(f"Final tutors list count: {len(context['tutors'])}")
            except Exception as e:
                # Log error but provide empty list to prevent template errors
                logger.error(f"Error fetching tutors for student {sp.id if sp else 'N/A'}: {str(e)}", exc_info=True)
                context['tutors'] = []

    try:
        html_content = render(request, template_name, context).content.decode('utf-8')
        return JsonResponse({'success': True, 'html': html_content}, status=200)
    except Exception as e:
        logger = logging.getLogger(__name__)
        error_trace = traceback.format_exc()
        logger.error(f'Error rendering section "{section_name}": {str(e)}\n{error_trace}')
        return JsonResponse({'error': f'Error rendering section: {str(e)}', 'success': False}, status=500)


@login_required
@teacher_required
def teacher_dashboard_view(request):
    user = request.user
    tp = getattr(user, 'teacher_profile', None)
    context = {
        'user': user,
        'teacher_profile': tp,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'email': user.email,
        'profile_picture_url': user.profile_picture.url if user.profile_picture else None,
        'title': tp.title if tp else '',
        'expertise': tp.expertise if tp else '',
        'qualifications': tp.qualifications if tp else '',
        'teacher_id': tp.teacher_id if tp else None,
    }

    if tp:
        # Dashboard summary counts
        try:
            assigned_students_count = Student.objects.filter(
                assignments__teacher_assignments__teacher=tp
            ).distinct().count()
        except Exception:
            assigned_students_count = 0

        pending_assigned_count = TeacherAssignment.objects.filter(
            teacher=tp,
            assignment__status='assigned'
        ).count()

        in_process_assignments_count = TeacherAssignment.objects.filter(
            teacher=tp,
            assignment__status__in=['in-process', 'on-hold']
        ).count()

        context.update({
            'assigned_students_count': assigned_students_count,
            'pending_assigned_count': pending_assigned_count,
            'in_process_assignments_count': in_process_assignments_count,
        })

    return render(request, 'teacher/dashboard.html', context)


@login_required
@teacher_required
def teacher_profile_view(request):
    """
    Teacher profile page with user data pre-filled.
    """
    user = request.user
    tp = user.teacher_profile if hasattr(user, 'teacher_profile') else None
    context = {
        'user': user,
        'teacher_profile': tp,
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'email': user.email or '',
        'teacher_id': str(tp.teacher_id).zfill(4) if tp and tp.teacher_id else '',
        'profile_picture_url': user.profile_picture.url if user.profile_picture else None,
        'phone': tp.phone if tp else '',
        'title': tp.title if tp else '',
        'qualifications': tp.qualifications if tp else '',
        'primary_subject': tp.primary_subject if tp else '',
        'years_of_experience': tp.years_of_experience if tp else 0,
        'bio': tp.bio if tp else '',
        'expertise': tp.expertise if tp else '',
    }
    return render(request, 'teacher/profile.html', context)


@login_required
@teacher_required
def teacher_section_view(request, section_name):
    section_template_map = {
        'dashboard': 'teacher/dashboard.html',
        'my_assignments': 'teacher/my_assignments.html',
        'writings': 'teacher/writings.html',
        'student_management': 'teacher/student_management.html',
        'messages': 'teacher/messages.html',
        'meetings': 'teacher/meetings.html',
        'notifications': 'teacher/notifications.html',
        'online_exam': 'teacher/online_exam.html',
        'homework': 'teacher/homework.html',
        'announcements': 'teacher/announcements.html',
        'feedback': 'teacher/feedback.html',
        'threads': 'teacher/threads.html',
        'profile': 'teacher/profile.html',
        'settings': 'teacher/settings.html',
    }
    
    template_name = section_template_map.get(section_name)
    if not template_name:
        return JsonResponse({'error': f'Section "{section_name}" not found.', 'success': False}, status=404)
    
    user = request.user
    tp = user.teacher_profile if hasattr(user, 'teacher_profile') else None
    context = {
        'user': user,
        'teacher_profile': tp,
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'email': user.email or '',
        # Keep formatting consistent with teacher_profile_view / UI expectations
        'teacher_id': str(tp.teacher_id).zfill(4) if tp and tp.teacher_id else '',
        'profile_picture_url': user.profile_picture.url if user.profile_picture else None,
        # Profile fields (needed by teacher/profile.html when loaded dynamically)
        'phone': tp.phone if tp else '',
        'title': tp.title if tp else '',
        'qualifications': tp.qualifications if tp else '',
        'primary_subject': tp.primary_subject if tp else '',
        'years_of_experience': tp.years_of_experience if tp else 0,
        'bio': tp.bio if tp else '',
        'expertise': tp.expertise if tp else '',
    }
    
    if tp:
        if section_name == 'dashboard':
            # Dashboard summary counts
            try:
                assigned_students_count = Student.objects.filter(
                    assignments__teacher_assignments__teacher=tp
                ).distinct().count()
            except Exception:
                assigned_students_count = 0

            # "Pending assignments (newly assigned but not started yet)" => Assignment.status == 'assigned'
            pending_assigned_count = TeacherAssignment.objects.filter(
                teacher=tp,
                assignment__status='assigned'
            ).count()

            # "In-process assignments" => Assignment.status == 'in-process' (include 'on-hold' since it is treated
            # as active work in the My Assignments tab)
            in_process_assignments_count = TeacherAssignment.objects.filter(
                teacher=tp,
                assignment__status__in=['in-process', 'on-hold']
            ).count()

            context.update({
                'assigned_students_count': assigned_students_count,
                'pending_assigned_count': pending_assigned_count,
                'in_process_assignments_count': in_process_assignments_count,
            })
        elif section_name == 'student_management':
            # Student Management: only students assigned to this teacher (primary/helper)
            from django.db.models import Count
            from django.utils import timezone
            from datetime import timedelta

            # Heuristic "online" based on recent activity (DB-driven).
            online_cutoff = timezone.now() - timedelta(minutes=10)

            assigned_students = (
                Student.objects.filter(assignments__teacher_assignments__teacher=tp)
                .select_related('user')
                .annotate(
                    assignment_count=Count(
                        'assignments',
                        filter=Q(assignments__teacher_assignments__teacher=tp),
                        distinct=True
                    )
                )
                .distinct()
                .order_by('student_id')
            )

            # Add derived flags for template use (keeps template simple)
            for s in assigned_students:
                last_login = getattr(s.user, 'last_login', None)
                s.is_online = bool(last_login and last_login >= online_cutoff)

            context.update({
                'assigned_students': assigned_students,
            })
        if section_name == 'my_assignments':
            import json as json_lib
            assigned_tasks = TeacherAssignment.objects.filter(teacher=tp).select_related('assignment__student__user')
            # Pre-serialize attachments as JSON to avoid template JSON escaping issues
            for task in assigned_tasks:
                attachments_list = []
                for file in task.assignment.files.all():
                    if file.file:
                        # Generate masked link for teachers
                        if request.user.role == 'TEACHER':
                            from account.utils import generate_masked_link
                            file_url = generate_masked_link(request.user, file.file.url, 'assignment_file')
                        else:
                            file_url = file.file.url
                        attachments_list.append({
                            'name': file.file_name,
                            'url': file_url
                        })
                # Store as JSON string to avoid template escaping issues
                task.assignment.attachments_json = json_lib.dumps(attachments_list)
            context['assigned_tasks'] = assigned_tasks
        elif section_name == 'feedback':
            context['feedbacks'] = AssignmentFeedback.objects.filter(to_teacher=tp).select_related('assignment', 'from_user')
        elif section_name == 'meetings' and tp:
            # Fetch assigned students for the schedule dropdown
            assigned_students = Student.objects.filter(
                assignments__teacher_assignments__teacher=tp
            ).select_related('user').distinct()
            context['students'] = assigned_students
            
            # Sourcing meetings strictly from database
            from meeting.models import Meeting
            context['meetings'] = Meeting.objects.filter(teacher=user).order_by('-scheduled_at')
        elif section_name == 'online_exam':
            # Fetch assignments assigned to this teacher, with student info
            assigned_assignments = TeacherAssignment.objects.filter(teacher=tp).select_related('assignment__student__user')
            
            # Group assignments by student for the dropdown
            students_dict = {}
            for ta in assigned_assignments:
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
            
            context['assigned_students_data'] = list(students_dict.values())

    try:
        html_content = render(request, template_name, context).content.decode('utf-8')
        return JsonResponse({'success': True, 'html': html_content}, status=200)
    except Exception as e:
        return JsonResponse({'error': f'Error rendering section: {str(e)}', 'traceback': traceback.format_exc(), 'success': False}, status=500)


@login_required
@teacher_required
@require_GET
def teacher_student_assignments_api(request, student_id: int):
    """
    Return assignments for a specific student that are assigned to the current teacher.
    Used by Teacher Student Management -> "Show Assignments" modal.
    """
    user = request.user
    tp = user.teacher_profile if hasattr(user, 'teacher_profile') else None
    if not tp:
        return JsonResponse({'success': False, 'error': 'Teacher profile not found.'}, status=400)

    # Ensure student exists and is assigned to this teacher (security)
    if not Student.objects.filter(id=student_id, assignments__teacher_assignments__teacher=tp).exists():
        return JsonResponse({'success': False, 'error': 'Student not found or not assigned to you.'}, status=404)

    tasks = (
        TeacherAssignment.objects.filter(teacher=tp, assignment__student_id=student_id)
        .select_related('assignment')
        .order_by('-assigned_at')
    )

    assignments = []
    for ta in tasks:
        a = ta.assignment
        assignments.append({
            'id': str(a.id),
            'assignment_code': a.assignment_code,
            'title': a.title,
            'service_type': a.get_service_type_display(),
            'status': a.status,
        })

    return JsonResponse({'success': True, 'assignments': assignments}, status=200)


@login_required
@teacher_required
@require_http_methods(["POST"])
def teacher_student_feedback_submit_api(request):
    """
    Teacher submits feedback about a student -> stored as Notification(s) for Admin (DB-backed).
    """
    try:
        payload = json.loads(request.body or "{}")
    except Exception:
        payload = {}

    student_id = payload.get('student_id')
    feedback_type = (payload.get('feedback_type') or '').strip()
    subject = (payload.get('subject') or '').strip()
    message = (payload.get('message') or '').strip()
    priority = (payload.get('priority') or '').strip()

    if not student_id or not subject or not message or not feedback_type:
        return JsonResponse({'success': False, 'error': 'Missing required fields.'}, status=400)

    tp = request.user.teacher_profile if hasattr(request.user, 'teacher_profile') else None
    if not tp:
        return JsonResponse({'success': False, 'error': 'Teacher profile not found.'}, status=400)

    # Security: only allow feedback for students assigned to this teacher
    try:
        student = Student.objects.select_related('user').get(id=student_id)
    except Student.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Student not found.'}, status=404)

    if not TeacherAssignment.objects.filter(teacher=tp, assignment__student=student).exists():
        return JsonResponse({'success': False, 'error': 'Student is not assigned to you.'}, status=403)

    try:
        # Save to database
        TeacherFeedback.objects.create(
            teacher=tp,
            student=student,
            feedback_type=feedback_type,
            subject=subject,
            message=message,
            priority=priority or 'normal'
        )
        
        from notifications.services import notify_role
        teacher_name = request.user.get_full_name() or request.user.username
        student_name = student.user.get_full_name() or f"Student {student.student_id}"
        notify_role(
            role="ADMIN",
            actor=request.user,
            notification_type="content",
            title=f"Teacher feedback: {subject}",
            message=f"From: {teacher_name}\nStudent: {student_name}\nType: {feedback_type}\nPriority: {priority}\n\n{message}",
            related_entity_type="student",
            related_entity_id=str(student.id),
        )
    except Exception as e:
        # Still return success if only notification fails, but fail if DB save fails
        if not TeacherFeedback.objects.filter(teacher=tp, student=student, subject=subject).exists():
             return JsonResponse({'success': False, 'error': f'Failed to save feedback: {str(e)}'}, status=500)

    return JsonResponse({'success': True}, status=200)


@login_required
@teacher_required
@require_http_methods(["POST"])
def teacher_student_report_submit_api(request):
    """
    Teacher submits a report about a student -> stored in TeacherReport table and sends notification.
    """
    try:
        payload = json.loads(request.body or "{}")
    except Exception:
        payload = {}

    student_id = payload.get('student_id')
    report_type = (payload.get('report_type') or '').strip()
    title = (payload.get('title') or '').strip()
    description = (payload.get('description') or '').strip()
    report_date_str = (payload.get('report_date') or '').strip()
    severity = (payload.get('severity') or '').strip()

    if not student_id or not title or not description or not report_type:
        return JsonResponse({'success': False, 'error': 'Missing required fields.'}, status=400)

    tp = request.user.teacher_profile if hasattr(request.user, 'teacher_profile') else None
    if not tp:
        return JsonResponse({'success': False, 'error': 'Teacher profile not found.'}, status=400)

    try:
        student = Student.objects.select_related('user').get(id=student_id)
    except Student.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Student not found.'}, status=404)

    if not TeacherAssignment.objects.filter(teacher=tp, assignment__student=student).exists():
        return JsonResponse({'success': False, 'error': 'Student is not assigned to you.'}, status=403)

    try:
        # Parse date
        from django.utils.dateparse import parse_date
        report_date = parse_date(report_date_str) if report_date_str else timezone.now().date()
        
        # Save to database
        TeacherReport.objects.create(
            teacher=tp,
            student=student,
            report_type=report_type,
            title=title,
            description=description,
            severity=severity or 'normal',
            report_date=report_date or timezone.now().date()
        )

        from notifications.services import notify_role
        teacher_name = request.user.get_full_name() or request.user.username
        student_name = student.user.get_full_name() or f"Student {student.student_id}"
        notify_role(
            role="ADMIN",
            actor=request.user,
            notification_type="content",
            title=f"Teacher report: {title}",
            message=f"From: {teacher_name}\nStudent: {student_name}\nType: {report_type}\nSeverity: {severity}\nDate: {report_date_str}\n\n{description}",
            related_entity_type="student",
            related_entity_id=str(student.id),
        )
    except Exception as e:
        if not TeacherReport.objects.filter(teacher=tp, student=student, title=title).exists():
            return JsonResponse({'success': False, 'error': f'Failed to save report: {str(e)}'}, status=500)

    return JsonResponse({'success': True}, status=200)


@login_required
@csrep_required
def csrep_dashboard_view(request):
    user = request.user
    context = {
        'user': user,
        'profile_picture_url': user.profile_picture.url if user.profile_picture else None,
        'csrep_profile': user.csrep_profile if hasattr(user, 'csrep_profile') else None,
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'email': user.email or '',
    }
    return render(request, 'csrep/overview.html', context)


@login_required
@csrep_required
def csrep_profile_view(request):
    """
    CS-Rep profile page with user data pre-filled.
    """
    user = request.user
    context = {
        'user': user,
        'csrep_profile': user.csrep_profile if hasattr(user, 'csrep_profile') else None,
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'email': user.email or '',
        'profile_picture_url': user.profile_picture.url if user.profile_picture else None,
    }
    return render(request, 'csrep/profile.html', context)


@login_required
@csrep_required
def csrep_section_view(request, section_name):
    section_template_map = {
        'overview': 'csrep/overview.html',
        'preSignIn': 'csrep/pre_sign_in_chat.html',
        'communication': 'csrep/communication.html',
        'threads': 'csrep/threads.html',
        'invoices': 'csrep/invoice_management.html',
        'announcements': 'csrep/announcement.html',
        'notifications': 'csrep/notifications.html',
        'profile': 'csrep/profile.html',
        'settings': 'csrep/settings.html',
    }
    
    template_name = section_template_map.get(section_name)
    if not template_name:
        return JsonResponse({'error': f'Section "{section_name}" not found.', 'success': False}, status=404)
    
    user = request.user
    context = {
        'user': user,
        'csrep_profile': user.csrep_profile if hasattr(user, 'csrep_profile') else None,
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'email': user.email or '',
        'profile_picture_url': user.profile_picture.url if user.profile_picture else None,
    }
    
    try:
        html_content = render(request, template_name, context).content.decode('utf-8')
        return JsonResponse({'success': True, 'html': html_content}, status=200)
    except Exception as e:
        return JsonResponse({'error': f'Error rendering section: {str(e)}', 'success': False}, status=500)


@login_required
@csrep_required
@require_GET
def csrep_overview_metrics_api(request):
    """
    CS-Rep Overview metrics API.
    Returns counts for:
    - live chats: pre-sign-in sessions created in the selected range
    - invoices created: invoices created in the selected range
    - active threads: threads that are currently active and created in the selected range
    """
    from preSigninMessages.models import PreSignInSession
    from invoice.models import Invoice
    from thread.models import Thread

    range_key = (request.GET.get('range') or 'today').strip().lower()
    now = timezone.now()

    if range_key in ('today', 'day', '1d'):
        local_now = timezone.localtime(now)
        start = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range_key in ('7d', '7days', '7_days', 'week'):
        start = now - timedelta(days=7)
    elif range_key in ('30d', '30days', '30_days', 'month'):
        start = now - timedelta(days=30)
    else:
        return JsonResponse({'success': False, 'error': 'Invalid range. Use today, 7d, or 30d.'}, status=400)

    live_chats_count = PreSignInSession.objects.filter(created_at__gte=start, created_at__lte=now).count()
    invoices_created_count = Invoice.objects.filter(created_at__gte=start, created_at__lte=now).count()
    active_threads_count = Thread.objects.filter(status='active', created_at__gte=start, created_at__lte=now).count()

    return JsonResponse({
        'success': True,
        'range': range_key,
        'start': start.isoformat(),
        'end': now.isoformat(),
        'metrics': {
            'live_chats': live_chats_count,
            'invoices_created': invoices_created_count,
            'active_threads': active_threads_count,
        }
    }, status=200)


@login_required
@admin_required
def admin_dashboard_view(request):
    user = request.user
    context = {
        'user': user,
        'profile_picture_url': user.profile_picture.url if user.profile_picture else None,
    }

    from django.db.models import Count
    
    # Recent Students
    recent_students = Student.objects.select_related('user').order_by('-created_at')[:5]
    
    # Recent Completed Assignments
    completed_assignments = Assignment.objects.filter(status='completed').select_related('student__user').order_by('-updated_at')[:5]
    
    # Recent Payments (Paid Invoices)
    recent_payments = Invoice.objects.filter(status='paid').select_related('student__user').order_by('-updated_at')[:5]
    
    # Recent Teacher Assignments
    recent_teacher_assignments = TeacherAssignment.objects.select_related('teacher__user', 'assignment').order_by('-assigned_at')[:5]
    
    activities = []
    for s in recent_students:
        activities.append({
            'type': 'student',
            'text': f"<strong>{s.user.get_full_name()}</strong> registered as a new student",
            'time': s.created_at or s.user.created_at,
            'icon': 'fas fa-user-plus'
        })
    for a in completed_assignments:
        activities.append({
            'type': 'assignment',
            'text': f"Assignment <strong>{a.assignment_code}</strong> completed",
            'time': a.completed_at or a.updated_at or a.created_at,
            'icon': 'fas fa-clipboard-check'
        })
    for p in recent_payments:
        activities.append({
            'type': 'payment',
            'text': f"Payment of <strong>${p.total_payable}</strong> received from {p.student.user.get_full_name()}",
            'time': p.updated_at or p.created_at,
            'icon': 'fas fa-credit-card'
        })
    for ta in recent_teacher_assignments:
        activities.append({
            'type': 'teacher',
            'text': f"<strong>{ta.teacher.user.get_full_name()}</strong> assigned to {ta.assignment.assignment_code}",
            'time': ta.assigned_at or ta.updated_at,
            'icon': 'fas fa-user-tie'
        })
    
    # Sort activities by time descending, filtering out any items without time
    activities = [a for a in activities if a.get('time')]
    activities.sort(key=lambda x: x['time'], reverse=True)
    
    context.update({
        'total_students': Student.objects.count(),
        'active_teachers': Teacher.objects.filter(user__is_active=True).count(),
        'pending_assignments': Assignment.objects.filter(status='pending').count(),
        'recent_activities': activities[:10],
        'todos': Todo.objects.filter(user=user).order_by('-created_at'),
    })

    return render(request, 'admin/dashboard.html', context)


@login_required
@admin_required
def admin_profile_view(request):
    """
    Admin profile page with user data pre-filled.
    """
    user = request.user
    context = {
        'user': user,
        'admin_profile': user.admin_profile if hasattr(user, 'admin_profile') else None,
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'email': user.email or '',
        'access_level': user.admin_profile.access_level if hasattr(user, 'admin_profile') else 'full',
        'profile_picture_url': user.profile_picture.url if user.profile_picture else None,
    }
    return render(request, 'admin/profile.html', context)


@login_required
@admin_required
def admin_section_view(request, section_name):
    section_template_map = {
        'dashboard': 'admin/dashboard.html',
        'students': 'admin/student_management.html',
        'messages': 'admin/messages.html',
        'threads': 'admin/threads.html',
        'assignment-requests': 'admin/assignment_requests.html',
        'add-teacher': 'admin/add_teacher.html',
        'user-management': 'admin/user_management.html',
        'analytics': 'admin/analytics.html',
        'invoice-management': 'admin/invoices.html',
        'cs-rep-management': 'admin/add_cs_rep.html',
        'content-review': 'admin/content_review.html',
        'notification': 'admin/notifications.html',
        'announcements': 'admin/announcements.html',
        'feedback-reports': 'admin/feedback_report.html',
        'meetings-record': 'admin/meetings_record.html',
        'visitors': 'admin/visitors.html',
        'profile': 'admin/profile.html',
        'settings': 'admin/profile_settings.html',
    }
    
    template_name = section_template_map.get(section_name)
    if not template_name:
        return JsonResponse({'error': f'Section "{section_name}" not found.', 'success': False}, status=404)
    
    user = request.user
    context = {
        'user': user,
        'admin_profile': user.admin_profile if hasattr(user, 'admin_profile') else None,
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'email': user.email or '',
        'access_level': user.admin_profile.access_level if hasattr(user, 'admin_profile') else 'full',
        'profile_picture_url': user.profile_picture.url if user.profile_picture else None,
    }
    
    if section_name == 'dashboard':
        from django.db.models import Count
        
        # Recent Students
        recent_students = Student.objects.select_related('user').order_by('-created_at')[:5]
        
        # Recent Completed Assignments
        completed_assignments = Assignment.objects.filter(status='completed').select_related('student__user').order_by('-updated_at')[:5]
        
        # Recent Payments (Paid Invoices)
        recent_payments = Invoice.objects.filter(status='paid').select_related('student__user').order_by('-updated_at')[:5]
        
        # Recent Teacher Assignments
        recent_teacher_assignments = TeacherAssignment.objects.select_related('teacher__user', 'assignment').order_by('-assigned_at')[:5]
        
        # Combine activities for a unified list if needed, or just pass them separately
        # For simplicity in template, we'll pass them separately or as a combined sorted list
        activities = []
        for s in recent_students:
            activities.append({
                'type': 'student',
                'text': f"<strong>{s.user.get_full_name()}</strong> registered as a new student",
                'time': s.created_at or s.user.created_at,
                'icon': 'fas fa-user-plus'
            })
        for a in completed_assignments:
            activities.append({
                'type': 'assignment',
                'text': f"Assignment <strong>{a.assignment_code}</strong> completed",
                'time': a.completed_at or a.updated_at or a.created_at,
                'icon': 'fas fa-clipboard-check'
            })
        for p in recent_payments:
            activities.append({
                'type': 'payment',
                'text': f"Payment of <strong>${p.total_payable}</strong> received from {p.student.user.get_full_name()}",
                'time': p.updated_at or p.created_at,
                'icon': 'fas fa-credit-card'
            })
        for ta in recent_teacher_assignments:
            activities.append({
                'type': 'teacher',
                'text': f"<strong>{ta.teacher.user.get_full_name()}</strong> assigned to {ta.assignment.assignment_code}",
                'time': ta.assigned_at or ta.updated_at,
                'icon': 'fas fa-user-tie'
            })
        
        # Sort activities by time descending, filtering out any items without time
        activities = [a for a in activities if a.get('time')]
        activities.sort(key=lambda x: x['time'], reverse=True)
        
        context.update({
            'total_students': Student.objects.count(),
            'active_teachers': Teacher.objects.filter(user__is_active=True).count(),
            'pending_assignments': Assignment.objects.filter(status='pending').count(),
            'recent_activities': activities[:10],
            'todos': Todo.objects.filter(user=user).order_by('-created_at'),
        })
    
    if section_name == 'user-management':
        context.update({
            'students': Student.objects.select_related('user').all(),
            'teachers': Teacher.objects.select_related('user').all(),
            'csreps': CSRep.objects.select_related('user').all(),
        })
    elif section_name == 'students':
        from django.db.models import Count, Prefetch
        from django.utils import timezone
        from datetime import timedelta
        
        seven_days_ago = timezone.now() - timedelta(days=7)
        
        students = Student.objects.select_related('user').prefetch_related(
            Prefetch('assignments', queryset=Assignment.objects.all().order_by('-created_at'))
        ).annotate(
            assignment_count=Count('assignments', distinct=True),
            teacher_count=Count('assignments__teacher_assignments__teacher', distinct=True)
        )
        
        context.update({
            'students_list': students,
            'seven_days_ago': seven_days_ago
        })
    elif section_name == 'assignment-requests':
        from django.db.models import Prefetch
        context.update({
            'all_assignments': Assignment.objects.all().select_related('student__user').prefetch_related(
                Prefetch('teacher_assignments', queryset=TeacherAssignment.objects.select_related('teacher__user'))
            ),
            'teachers': Teacher.objects.select_related('user').all(),
        })
    elif section_name == 'visitors':
        context.update({
            'visitors': Visitor.objects.all().order_by('-created_at'),
        })
    elif section_name == 'content-review':
        from exam.models import ExamAttempt
        from homework.models import Homework
        from django.db.models import Prefetch
        
        # Completed assignments for the first table
        completed_assignments = Assignment.objects.filter(status='completed').select_related('student__user').prefetch_related(
            Prefetch('teacher_assignments', queryset=TeacherAssignment.objects.select_related('teacher__user'))
        )
        
        # Graded exam attempts for the new table
        graded_exams = ExamAttempt.objects.filter(status='graded').select_related(
            'exam__assignment', 'exam__teacher__user', 'student__user'
        ).prefetch_related('answers')

        # Graded homework for the new table
        graded_homeworks = Homework.objects.filter(status='graded').select_related(
            'teacher__user', 'student__user', 'assignment'
        ).prefetch_related('submission__attachments')
        
        context.update({
            'completed_assignments': completed_assignments,
            'graded_exams': graded_exams,
            'graded_homeworks': graded_homeworks,
        })
    elif section_name == 'feedback-reports':
        # Fetch all feedback and reports for the admin
        feedbacks = TeacherFeedback.objects.select_related('teacher__user', 'student__user').all()
        reports = TeacherReport.objects.select_related('teacher__user', 'student__user').all()
        
        context.update({
            'feedbacks': feedbacks,
            'reports': reports,
            'feedback_count': feedbacks.count(),
            'reports_count': reports.count(),
            'unread_feedback_count': feedbacks.filter(is_read=False).count(),
            'unread_reports_count': reports.filter(is_read=False).count(),
        })
    elif section_name == 'meetings-record':
        from meeting.models import Meeting
        meetings = Meeting.objects.all().select_related('student', 'teacher').order_by('-scheduled_at')
        context['meetings_record'] = meetings
        
        # Get unique student and teacher names for filtering
        students_list = set()
        teachers_list = set()
        for m in meetings:
            if m.student:
                students_list.add(m.student.get_full_name() or m.student.username)
            if m.teacher:
                teachers_list.add(m.teacher.get_full_name() or m.teacher.username)
        context['students'] = sorted(list(students_list))
        context['teachers'] = sorted(list(teachers_list))

    try:
        html_content = render(request, template_name, context).content.decode('utf-8')
        return JsonResponse({'success': True, 'html': html_content}, status=200)
    except Exception as e:
        return JsonResponse({'error': f'Error rendering section: {str(e)}', 'success': False}, status=500)


@login_required
@admin_required
@require_http_methods(["POST"])
def toggle_user_status(request):
    try:
        data = json.loads(request.body)
        user_id, action = data.get('user_id'), data.get('action')
        if not user_id or not action: return JsonResponse({'success': False, 'error': 'Required fields missing.'}, status=400)
        user = User.objects.get(id=user_id)
        if user == request.user or user.role == 'ADMIN': return JsonResponse({'success': False, 'error': 'Cannot block admins.'}, status=403)
        user.is_active = (action == 'unblock')
        user.save()
        return JsonResponse({'success': True, 'message': 'Status updated.', 'is_active': user.is_active})
    except Exception as e: return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@admin_required
@csrf_exempt
@require_http_methods(["POST"])
def admin_reset_password(request):
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        temp_password = data.get('temp_password')
        
        if not user_id: 
            return JsonResponse({'success': False, 'error': 'User ID required.'}, status=400)
        
        if not temp_password:
            return JsonResponse({'success': False, 'error': 'Temporary password is required.'}, status=400)
        
        if len(temp_password) < 6:
            return JsonResponse({'success': False, 'error': 'Password must be at least 6 characters long.'}, status=400)
        
        user = User.objects.get(id=user_id)
        
        # Set the custom password provided by admin
        user.set_password(temp_password)
        # Do not block the account - admin can reset password without blocking
        user.save()
        
        return JsonResponse({
            'success': True, 
            'message': 'Password reset successfully. Temporary password has been set.', 
            'temp_password': temp_password,
            'user_email': user.email,
            'user_name': user.get_full_name()
        })
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'User not found.'}, status=404)
    except Exception as e: 
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@admin_required
@csrf_exempt
@require_http_methods(["POST"])
def admin_delete_user(request):
    """
    Permanently delete a user account.
    Only admins can delete users. Cannot delete admins or yourself.
    """
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        
        if not user_id:
            return JsonResponse({'success': False, 'error': 'User ID required.'}, status=400)
        
        user_to_delete = User.objects.get(id=user_id)
        admin_user = request.user
        
        # Prevent deleting yourself
        if user_to_delete.id == admin_user.id:
            return JsonResponse({
                'success': False, 
                'error': 'You cannot delete your own account.'
            }, status=403)
        
        # Prevent deleting other admins
        if user_to_delete.role == 'ADMIN':
            return JsonResponse({
                'success': False, 
                'error': 'Cannot delete admin accounts.'
            }, status=403)
        
        # Store user info for response before deletion
        user_email = user_to_delete.email
        user_name = user_to_delete.get_full_name()
        user_role = user_to_delete.get_role_display()
        
        # Delete the user (CASCADE will handle related models)
        user_to_delete.delete()
        
        return JsonResponse({
            'success': True,
            'message': f'{user_role} account ({user_email}) has been permanently deleted.',
            'deleted_user': {
                'email': user_email,
                'name': user_name,
                'role': user_role
            }
        })
        
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'User not found.'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@admin_required
@csrf_exempt
@require_http_methods(["POST"])
def create_csrep_view(request):
    try:
        data = json.loads(request.body)
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()

        if not all([username, email, password, first_name, last_name]):
            return JsonResponse({'error': 'All fields are required.', 'success': False}, status=400)

        # Validate email
        try:
            validate_email(email)
        except DjangoValidationError:
            return JsonResponse({
                'error': 'Invalid email format.',
                'error_type': 'invalid_email',
                'success': False
            }, status=400)

        # Check if username exists
        if User.objects.filter(username=username).exists():
            return JsonResponse({
                'error': 'Username already exists.',
                'error_type': 'username_exists',
                'success': False
            }, status=400)

        # Check if email exists
        if User.objects.filter(email=email).exists():
            existing_user = User.objects.get(email=email)
            if existing_user.username != username:
                return JsonResponse({
                    'error': f'A user with this email already exists with a different username ("{existing_user.username}").',
                    'error_type': 'email_exists',
                    'success': False
                }, status=400)
            return JsonResponse({
                'error': 'A user with this email already exists.',
                'error_type': 'email_exists',
                'success': False
            }, status=400)

        # Validate password
        try:
            validate_password(password)
        except DjangoValidationError as e:
            return JsonResponse({
                'error': 'Password does not meet requirements: ' + ', '.join(e.messages),
                'error_type': 'invalid_password',
                'success': False
            }, status=400)

        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                username=username,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role='CS_REP',
                is_active=True,
                is_staff=True
            )
        return JsonResponse({'success': True, 'message': 'CS Rep created.'}, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e), 'success': False}, status=500)


@login_required
@admin_required
@csrf_exempt
@require_http_methods(["POST"])
def create_teacher_view(request):
    try:
        data = json.loads(request.body)
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()

        if not all([username, email, password, first_name, last_name]):
            return JsonResponse({'error': 'All fields are required.', 'success': False}, status=400)

        # Validate email
        try:
            validate_email(email)
        except DjangoValidationError:
            return JsonResponse({
                'error': 'Invalid email format.',
                'error_type': 'invalid_email',
                'success': False
            }, status=400)

        # Check if username exists
        if User.objects.filter(username=username).exists():
            return JsonResponse({
                'error': 'Username already exists.',
                'error_type': 'username_exists',
                'success': False
            }, status=400)

        # Check if email exists
        if User.objects.filter(email=email).exists():
            existing_user = User.objects.get(email=email)
            if existing_user.username != username:
                return JsonResponse({
                    'error': f'A user with this email already exists with a different username ("{existing_user.username}").',
                    'error_type': 'email_exists',
                    'success': False
                }, status=400)
            return JsonResponse({
                'error': 'A user with this email already exists.',
                'error_type': 'email_exists',
                'success': False
            }, status=400)

        # Validate password
        try:
            validate_password(password)
        except DjangoValidationError as e:
            return JsonResponse({
                'error': 'Password does not meet requirements: ' + ', '.join(e.messages),
                'error_type': 'invalid_password',
                'success': False
            }, status=400)

        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                username=username,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role='TEACHER',
                is_active=True,
                is_staff=True
            )
        return JsonResponse({'success': True, 'message': 'Teacher created.'}, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e), 'success': False}, status=500)


@login_required
@require_http_methods(["POST"])
def change_password_view(request):
    try:
        data = json.loads(request.body)
        curr, new, cnf = data.get('current_password'), data.get('new_password'), data.get('confirm_password')
        user = request.user
        if not user.check_password(curr): return JsonResponse({'error': 'Incorrect current password.', 'success': False}, status=400)
        if new != cnf: return JsonResponse({'error': 'Passwords mismatch.', 'success': False}, status=400)
        validate_password(new, user=user)
        user.set_password(new)
        user.save()
        update_session_auth_hash(request, user)

        return JsonResponse({'success': True, 'message': 'Password updated.'})
    except Exception as e: return JsonResponse({'error': str(e), 'success': False}, status=500)

@login_required
@admin_required
def list_teachers_api(request):
    """
    API endpoint to list all teachers for dropdowns.
    """
    teachers = Teacher.objects.select_related('user').all()
    data = []
    for t in teachers:
        data.append({
            'id': t.id,  # Database primary key
            'teacher_id': t.teacher_id,  # 4-digit ID
            'name': t.user.get_full_name(),
            'expertise': t.expertise or t.primary_subject or '',
            'avatar': t.user.profile_picture.url if t.user.profile_picture else None,
        })
    return JsonResponse({'success': True, 'teachers': data})

@login_required
def list_students_api(request):
    """
    API endpoint to list all students for dropdowns.
    """
    if request.user.role not in ['ADMIN', 'CS_REP']:
        return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)
        
    students = Student.objects.select_related('user').all().order_by('user__first_name')
    data = []
    for s in students:
        data.append({
            'id': str(s.id),
            'student_id': str(s.student_id).zfill(4),
            'name': s.user.get_full_name(),
            'email': s.user.email,
        })
    return JsonResponse({'success': True, 'students': data})

@login_required
@admin_required
@require_http_methods(["POST"])
def mark_feedback_read_api(request, feedback_id):
    try:
        feedback = TeacherFeedback.objects.get(id=feedback_id)
        feedback.is_read = True
        feedback.save()
        return JsonResponse({'success': True})
    except TeacherFeedback.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Feedback not found.'}, status=404)

@login_required
@admin_required
@require_http_methods(["POST"])
def mark_report_read_api(request, report_id):
    try:
        report = TeacherReport.objects.get(id=report_id)
        report.is_read = True
        report.save()
        return JsonResponse({'success': True})
    except TeacherReport.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Report not found.'}, status=404)

@login_required
@admin_required
@require_http_methods(["POST"])
def delete_feedback_api(request, feedback_id):
    try:
        feedback = TeacherFeedback.objects.get(id=feedback_id)
        feedback.delete()
        return JsonResponse({'success': True})
    except TeacherFeedback.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Feedback not found.'}, status=404)

@login_required
@admin_required
@require_http_methods(["POST"])
def delete_report_api(request, report_id):
    try:
        report = TeacherReport.objects.get(id=report_id)
        report.delete()
        return JsonResponse({'success': True})
    except TeacherReport.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Report not found.'}, status=404)

@login_required
@admin_required
def get_feedback_detail_api(request, feedback_id):
    try:
        feedback = TeacherFeedback.objects.select_related('teacher__user', 'student__user').get(id=feedback_id)
        return JsonResponse({
            'success': True,
            'feedback': {
                'id': feedback.id,
                'teacher': feedback.teacher.user.get_full_name(),
                'teacher_avatar': feedback.teacher.user.profile_picture.url if feedback.teacher.user.profile_picture else None,
                'student': f"{feedback.student.user.get_full_name()} ({str(feedback.student.student_id).zfill(4)})",
                'type': feedback.feedback_type,
                'subject': feedback.subject,
                'message': feedback.message,
                'priority': feedback.priority,
                'created_at': feedback.created_at.strftime('%b %d, %Y'),
                'is_read': feedback.is_read
            }
        })
    except TeacherFeedback.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Feedback not found.'}, status=404)

@login_required
@admin_required
def get_report_detail_api(request, report_id):
    try:
        report = TeacherReport.objects.select_related('teacher__user', 'student__user').get(id=report_id)
        return JsonResponse({
            'success': True,
            'report': {
                'id': report.id,
                'teacher': report.teacher.user.get_full_name(),
                'teacher_avatar': report.teacher.user.profile_picture.url if report.teacher.user.profile_picture else None,
                'student': f"{report.student.user.get_full_name()} ({str(report.student.student_id).zfill(4)})",
                'type': report.report_type,
                'title': report.title,
                'description': report.description,
                'severity': report.severity,
                'date': report.report_date.strftime('%b %d, %Y'),
                'is_read': report.is_read
            }
        })
    except TeacherReport.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Report not found.'}, status=404)


@login_required
def generate_masked_link_api(request):
    """
    API to generate a masked link for a given target URL.
    Only accessible by Teachers as per requirements.
    """
    if request.user.role != 'TEACHER':
        return JsonResponse({'success': False, 'error': 'Unauthorized.'}, status=403)
    
    try:
        data = json.loads(request.body)
        target_url = data.get('target_url')
        link_type = data.get('link_type', 'general')
        
        if not target_url:
            return JsonResponse({'success': False, 'error': 'Target URL is required.'}, status=400)
        
        masked_url = generate_masked_link(request.user, target_url, link_type)
        return JsonResponse({'success': True, 'masked_url': masked_url})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
def masked_redirect_view(request, token):
    """
    Handles masked links, validates them, and redirects to the target URL.
    """
    try:
        masked_link = MaskedLink.objects.get(token=token)

        # Check if the link belongs to the current user
        if masked_link.user != request.user:
            log_security_event(request, "UNAUTHORIZED_ACCESS", user=request.user, status="FAILURE", details=f"Attempted to use masked link of user {masked_link.user.email}")
            return JsonResponse({'success': False, 'error': 'Unauthorized.'}, status=403)

        # Check if expired
        if not masked_link.is_valid():
            return JsonResponse({'success': False, 'error': 'Link expired.'}, status=410)

        target_url = masked_link.target_url

        # Log access
        log_security_event(request, "MASKED_LINK_ACCESS", user=request.user, details=f"Accessing {masked_link.link_type}: {target_url}")

        # For sensitive resources like meetings, we might want to proxy or redirect
        return redirect(target_url)

    except MaskedLink.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Link not found.'}, status=404)


@login_required
@require_http_methods(["GET", "POST"])
def notification_settings_api(request):
    """
    API endpoint for getting and updating user notification settings.
    Supports all user roles with role-appropriate settings.
    """
    user = request.user

    try:
        # Get or create settings for the user
        settings, created = UserNotificationSettings.objects.get_or_create(user=user)
    except Exception as e:
        return JsonResponse({'success': False, 'error': f'Failed to access settings: {str(e)}'}, status=500)

    if request.method == 'GET':
        # Return current settings based on user role
        settings_data = {
            'email_notifications': settings.email_notifications,
            'push_notifications': settings.push_notifications,
            'desktop_notifications': settings.desktop_notifications,
            'sound_alerts': settings.sound_alerts,
        }

        if user.role == 'STUDENT':
            settings_data.update({
                'student_messages': settings.student_messages,
                'announcements': settings.announcements,
                'assignment_updates': settings.assignment_updates,
                'meeting_reminders': settings.meeting_reminders,
                'grade_notifications': settings.grade_notifications,
                'assignment_due_reminders': settings.assignment_due_reminders,
                'meeting_reminders_enabled': settings.meeting_reminders_enabled,
                'meeting_reminder_time': settings.meeting_reminder_time,
                'exam_reminders': settings.exam_reminders,
            })
        elif user.role == 'TEACHER':
            settings_data.update({
                'teacher_messages': settings.teacher_messages,
                'new_announcements': settings.new_announcements,
                'assignment_submissions': settings.assignment_submissions,
                'meeting_reminders_teacher': settings.meeting_reminders_teacher,
                'grade_submissions': settings.grade_submissions,
                'assignment_due_reminders': settings.assignment_due_reminders,
                'meeting_reminders_enabled': settings.meeting_reminders_enabled,
                'meeting_reminder_time': settings.meeting_reminder_time,
                'grade_submission_reminders': settings.grade_submission_reminders,
            })
        elif user.role == 'ADMIN':
            settings_data.update({
                'assignment_requests': settings.assignment_requests,
                'invoice_notifications': settings.invoice_notifications,
                'content_review_alerts': settings.content_review_alerts,
                'system_alerts': settings.system_alerts,
                'assignment_due_reminders': settings.assignment_due_reminders,
                'meeting_reminders_enabled': settings.meeting_reminders_enabled,
                'meeting_reminder_time': settings.meeting_reminder_time,
                'payment_reminders': settings.payment_reminders,
                'reminder_frequency': settings.reminder_frequency,
                'reminder_time': settings.reminder_time.strftime('%H:%M') if settings.reminder_time else '09:00',
                'auto_refresh_dashboard': settings.auto_refresh_dashboard,
                'refresh_interval': settings.refresh_interval,
                'default_date_range': settings.default_date_range,
                'two_factor_auth': settings.two_factor_auth,
                'session_timeout': settings.session_timeout,
                'activity_log': settings.activity_log,
            })
        elif user.role == 'CS_REP':
            settings_data.update({
                'csrep_notifications_enabled': settings.csrep_notifications_enabled,
            })

        return JsonResponse({
            'success': True,
            'settings': settings_data,
            'role': user.role
        }, status=200)

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)

            # Update settings based on user role
            if user.role == 'STUDENT':
                # Student-specific settings
                for field in ['student_messages', 'announcements', 'assignment_updates',
                            'meeting_reminders', 'grade_notifications', 'assignment_due_reminders',
                            'meeting_reminders_enabled', 'exam_reminders']:
                    if field in data:
                        setattr(settings, field, bool(data[field]))

                if 'meeting_reminder_time' in data:
                    settings.meeting_reminder_time = int(data['meeting_reminder_time'])

            elif user.role == 'TEACHER':
                # Teacher-specific settings
                for field in ['teacher_messages', 'new_announcements', 'assignment_submissions',
                            'meeting_reminders_teacher', 'grade_submissions', 'assignment_due_reminders',
                            'meeting_reminders_enabled', 'grade_submission_reminders']:
                    if field in data:
                        setattr(settings, field, bool(data[field]))

                if 'meeting_reminder_time' in data:
                    settings.meeting_reminder_time = int(data['meeting_reminder_time'])

            elif user.role == 'ADMIN':
                # Admin-specific settings
                for field in ['assignment_requests', 'invoice_notifications', 'content_review_alerts',
                            'system_alerts', 'assignment_due_reminders', 'meeting_reminders_enabled',
                            'payment_reminders', 'auto_refresh_dashboard', 'two_factor_auth', 'activity_log']:
                    if field in data:
                        setattr(settings, field, bool(data[field]))

                if 'meeting_reminder_time' in data:
                    settings.meeting_reminder_time = int(data['meeting_reminder_time'])
                if 'reminder_frequency' in data:
                    settings.reminder_frequency = data['reminder_frequency']
                if 'reminder_time' in data:
                    from django.utils.dateparse import parse_time
                    parsed_time = parse_time(data['reminder_time'])
                    if parsed_time:
                        settings.reminder_time = parsed_time
                if 'refresh_interval' in data:
                    settings.refresh_interval = int(data['refresh_interval'])
                if 'default_date_range' in data:
                    settings.default_date_range = data['default_date_range']
                if 'session_timeout' in data:
                    settings.session_timeout = data['session_timeout']

            elif user.role == 'CS_REP':
                # CS-Rep specific settings (simple)
                if 'csrep_notifications_enabled' in data:
                    settings.csrep_notifications_enabled = bool(data['csrep_notifications_enabled'])

            # Global settings that apply to all roles
            for field in ['email_notifications', 'push_notifications', 'desktop_notifications', 'sound_alerts']:
                if field in data:
                    setattr(settings, field, bool(data[field]))

            settings.save()

            return JsonResponse({
                'success': True,
                'message': 'Settings updated successfully.'
            }, status=200)

        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': 'Invalid JSON data.'}, status=400)
        except Exception as e:
            return JsonResponse({'success': False, 'error': f'Failed to update settings: {str(e)}'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def visitor_form_submit_api(request):
    """
    API endpoint for visitor form submission from the home page.
    """
    try:
        data = json.loads(request.body)
        
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        email = data.get('email', '').strip()
        details = data.get('details', '').strip()
        
        # Validation
        if not first_name:
            return JsonResponse({'success': False, 'error': 'First name is required.'}, status=400)
        if not last_name:
            return JsonResponse({'success': False, 'error': 'Last name is required.'}, status=400)
        if not email:
            return JsonResponse({'success': False, 'error': 'Email is required.'}, status=400)
        if not details:
            return JsonResponse({'success': False, 'error': 'Details are required.'}, status=400)
        
        # Validate email format
        try:
            validate_email(email)
        except ValidationError:
            return JsonResponse({'success': False, 'error': 'Invalid email format.'}, status=400)
        
        # Create visitor record
        visitor = Visitor.objects.create(
            first_name=first_name,
            last_name=last_name,
            email=email,
            details=details
        )
        
        return JsonResponse({
            'success': True,
            'message': 'We have received your concern and will get back to you in a moment.'
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON data.'}, status=400)
    except Exception as e:
        logging.error(f'Error submitting visitor form: {str(e)}')
        return JsonResponse({'success': False, 'error': 'Failed to submit form. Please try again.'}, status=500)


@login_required
@admin_required
@require_http_methods(["POST"])
def delete_visitor_api(request, visitor_id):
    """
    API endpoint to delete a visitor record.
    """
    try:
        visitor = Visitor.objects.get(id=visitor_id)
        visitor.delete()
        return JsonResponse({'success': True, 'message': 'Visitor deleted successfully.'})
    except Visitor.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Visitor not found.'}, status=404)
    except Exception as e:
        logging.error(f'Error deleting visitor: {str(e)}')
        return JsonResponse({'success': False, 'error': 'Failed to delete visitor. Please try again.'}, status=500)


@login_required
@admin_required
@require_http_methods(["POST"])
def delete_content_review_api(request):
    """
    API endpoint to delete content review records (assignments, exam attempts, or homework).
    """
    try:
        data = json.loads(request.body)
        content_id = data.get('content_id')
        content_type = data.get('content_type')
        
        if not content_id or not content_type:
            return JsonResponse({'success': False, 'error': 'Missing content_id or content_type.'}, status=400)
        
        if content_type == 'assignment':
            from assingment.models import Assignment
            try:
                assignment = Assignment.objects.get(id=content_id)
                # Soft delete only - assignments should never be permanently deleted
                if assignment.status != 'deleted':
                    assignment.status = 'deleted'
                    assignment.save()
                return JsonResponse({'success': True, 'message': 'Assignment marked as deleted. It will remain in the database for record-keeping.'})
            except Assignment.DoesNotExist:
                return JsonResponse({'success': False, 'error': 'Assignment not found.'}, status=404)
                
        elif content_type == 'exam_attempt':
            from exam.models import ExamAttempt
            try:
                attempt = ExamAttempt.objects.get(id=content_id)
                attempt.delete()
                return JsonResponse({'success': True, 'message': 'Exam attempt deleted successfully.'})
            except ExamAttempt.DoesNotExist:
                return JsonResponse({'success': False, 'error': 'Exam attempt not found.'}, status=404)
                
        elif content_type == 'homework':
            from homework.models import Homework
            try:
                homework = Homework.objects.get(id=content_id)
                homework.delete()
                return JsonResponse({'success': True, 'message': 'Homework deleted successfully.'})
            except Homework.DoesNotExist:
                return JsonResponse({'success': False, 'error': 'Homework not found.'}, status=404)
        else:
            return JsonResponse({'success': False, 'error': 'Invalid content_type.'}, status=400)
            
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON data.'}, status=400)
    except Exception as e:
        logging.error(f'Error deleting content review: {str(e)}')
        return JsonResponse({'success': False, 'error': 'Failed to delete content. Please try again.'}, status=500)


