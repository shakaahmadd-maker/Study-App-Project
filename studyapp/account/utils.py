import logging
import secrets
from datetime import timedelta
from django.utils import timezone

audit_logger = logging.getLogger('audit')



def log_security_event(request, event_type, user=None, status="SUCCESS", details=""):
    """
    Logs a security event for audit purposes.

    event_type: LOGIN, LOGOUT, UNAUTHORIZED_ACCESS, SESSION_CREATED, SESSION_INVALIDATED
    """
    timestamp = timezone.now().isoformat()
    client_ip = get_client_ip(request) if request else "Unknown"
    username = user.email if user else "Anonymous"
    user_id = str(user.id) if user else "None"
    path = request.path if request else "N/A"
    method = request.method if request else "N/A"

    message = f"[{event_type}] | Time: {timestamp} | User: {username} ({user_id}) | IP: {client_ip} | Status: {status} | Path: {path} | Method: {method} | Details: {details}"
    
    if status == "FAILURE" or event_type == "UNAUTHORIZED_ACCESS":
        audit_logger.warning(message)
    else:
        audit_logger.info(message)

def get_client_ip(request):
    if not request:
        return "Unknown"
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def generate_masked_link(user, target_url, link_type=None, expiry_hours=24):
    """
    Generates a tokenized masked link for a user.
    """
    from .models import MaskedLink
    
    token = secrets.token_urlsafe(32)
    expires_at = timezone.now() + timedelta(hours=expiry_hours)
    
    MaskedLink.objects.create(
        token=token,
        target_url=target_url,
        user=user,
        expires_at=expires_at,
        link_type=link_type
    )
    
    return f"/account/m/{token}/"







