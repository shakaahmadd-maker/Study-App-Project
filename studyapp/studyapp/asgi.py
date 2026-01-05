"""
ASGI config for studyapp project.
This project uses Django Channels for WebSocket support (real-time messaging).
"""

import os
from django.core.asgi import get_asgi_application

# 1. Setup Django settings first
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'studyapp.settings')

# 2. Initialize Django EARLY (Crucial: Fixes AppRegistryNotReady error)
django_asgi_app = get_asgi_application()

# 3. Import Routing (Must happen AFTER step 2)
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

# --- Import App Routings ---

# Existing Messages App
import messages.routing

# NEW: Thread App
try:
    import thread.routing
    thread_patterns = thread.routing.websocket_urlpatterns
except ImportError:
    thread_patterns = []

# Optional: Meeting App
try:
    import meeting.routing
    meeting_patterns = meeting.routing.websocket_urlpatterns
except ImportError:
    meeting_patterns = []

# Optional: Pre-Signin Chat App
try:
    import preSigninMessages.routing
    presignin_patterns = preSigninMessages.routing.websocket_urlpatterns
except ImportError:
    presignin_patterns = []

# Optional: Realtime Dashboard
try:
    import realtime.routing
    realtime_patterns = realtime.routing.websocket_urlpatterns
except ImportError:
    realtime_patterns = []

# 4. Combine all URL patterns in one go
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
