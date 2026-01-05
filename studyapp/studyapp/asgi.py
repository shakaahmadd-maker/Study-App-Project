"""
ASGI config for studyapp project.

This project uses Django Channels for WebSocket support (real-time messaging).
"""

import os
from django.core.asgi import get_asgi_application

# 1. Setup Django settings first
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'studyapp.settings')

# 2. Initialize Django EARLY (Fixes the ImproperlyConfigured error)
django_asgi_app = get_asgi_application()

# 3. Import Routing (Must happen AFTER step 2)
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

# Import your app routings
import messages.routing
try:
    import realtime.routing  # Check if this exists for your dashboard
    realtime_patterns = realtime.routing.websocket_urlpatterns
except ImportError:
    realtime_patterns = [] # Fallback if the app doesn't exist or has no routing

# Combine URL patterns
combined_urlpatterns = messages.routing.websocket_urlpatterns + realtime_patterns


import messages.routing

try:
    import meeting.routing
    meeting_patterns = meeting.routing.websocket_urlpatterns
except ImportError:
    meeting_patterns = []

combined_urlpatterns = messages.routing.websocket_urlpatterns + realtime_patterns + meeting_patterns

try:
    import preSigninMessages.routing
    presignin_patterns = preSigninMessages.routing.websocket_urlpatterns
except ImportError:
    presignin_patterns = []

try:
    import thread.routing
    thread_patterns = thread.routing.websocket_urlpatterns
except ImportError:
    thread_patterns = []

combined_urlpatterns = (
    messages.routing.websocket_urlpatterns +
    thread_patterns +
    meeting_patterns +
    presignin_patterns +
    realtime_patterns
)

application = ProtocolTypeRouter({
    # HTTP requests handled by Django
    "http": django_asgi_app,

    # WebSocket requests handled by Channels
    "websocket": AuthMiddlewareStack(
        URLRouter(
            combined_urlpatterns
        )
    ),
})
