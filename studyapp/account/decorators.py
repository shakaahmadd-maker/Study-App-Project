from functools import wraps
from django.http import JsonResponse
from django.contrib.auth.decorators import user_passes_test
from .utils import log_security_event


def role_required(*allowed_roles):
    """
    Decorator to restrict access to views based on user role.
    
    Usage:
        @role_required('STUDENT')
        def student_view(request):
            ...
        
        @role_required('TEACHER', 'ADMIN')
        def staff_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                log_security_event(request, "UNAUTHORIZED_ACCESS", status="FAILURE", details="Not authenticated")
                return JsonResponse({
                    'error': 'Authentication required.',
                    'success': False
                }, status=401)
            
            if request.user.role not in allowed_roles:
                log_security_event(request, "UNAUTHORIZED_ACCESS", user=request.user, status="FAILURE", details=f"Required roles: {allowed_roles}, User role: {request.user.role}")
                return JsonResponse({
                    'error': 'You do not have permission to access this resource.',
                    'success': False
                }, status=403)
            
            return view_func(request, *args, **kwargs)
        return wrapped_view
    return decorator


def student_required(view_func):
    """Decorator to restrict access to students only."""
    return role_required('STUDENT')(view_func)


def teacher_required(view_func):
    """Decorator to restrict access to teachers only."""
    return role_required('TEACHER')(view_func)


def csrep_required(view_func):
    """Decorator to restrict access to CS-Reps only."""
    return role_required('CS_REP')(view_func)


def admin_required(view_func):
    """Decorator to restrict access to admins only."""
    return role_required('ADMIN')(view_func)


def staff_required(view_func):
    """Decorator to restrict access to staff (Teacher, CS-Rep, Admin) only."""
    return role_required('TEACHER', 'CS_REP', 'ADMIN')(view_func)

