import logging
from django.utils.deprecation import MiddlewareMixin
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from .utils import log_security_event

class SecurityAuditMiddleware(MiddlewareMixin):
    """
    Middleware to log security-related events like unauthorized access.
    """
    def process_response(self, request, response):
        # Log unauthorized access attempts (401, 403)
        if response.status_code in [401, 403]:
            details = f"Response status: {response.status_code}"
            if hasattr(response, 'content'):
                try:
                    import json
                    content = json.loads(response.content)
                    details += f" | Error: {content.get('error', 'N/A')}"
                except:
                    pass
            
            log_security_event(
                request, 
                "UNAUTHORIZED_ACCESS", 
                user=request.user if request.user.is_authenticated else None,
                status="FAILURE",
                details=details
            )
        
        return response

    def process_exception(self, request, exception):
        # Log critical security exceptions if any
        from django.core.exceptions import PermissionDenied
        if isinstance(exception, PermissionDenied):
            log_security_event(
                request,
                "PERMISSION_DENIED",
                user=request.user if request.user.is_authenticated else None,
                status="FAILURE",
                details=str(exception)
            )
        return None

