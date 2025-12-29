from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # room_name is generated from uuid and can contain '-' (e.g. "a1b2c3d4-e5f")
    re_path(r"^ws/meeting/(?P<room_name>[\w-]+)/$", consumers.MeetingConsumer.as_asgi()),
]

