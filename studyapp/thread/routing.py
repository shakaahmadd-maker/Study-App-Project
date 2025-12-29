from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/threads/(?P<thread_id>[^/]+)/$', consumers.ThreadConsumer.as_asgi()),
    re_path(r'ws/thread-list/$', consumers.ThreadListConsumer.as_asgi()),
]

