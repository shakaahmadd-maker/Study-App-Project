"""
ASGI config for studyapp project.

This project uses Django Channels for WebSocket support (real-time messaging).
"""

import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

import messages.routing
import meeting.routing
import preSigninMessages.routing
import realtime.routing
import thread.routing

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "studyapp.settings")

django_asgi_app = get_asgi_application()

# Combine URL patterns from different apps
websocket_urlpatterns = (
    messages.routing.websocket_urlpatterns + 
    meeting.routing.websocket_urlpatterns +
    preSigninMessages.routing.websocket_urlpatterns +
    realtime.routing.websocket_urlpatterns +
    thread.routing.websocket_urlpatterns
)

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AuthMiddlewareStack(
            URLRouter(websocket_urlpatterns),
        ),
    }
)
