from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/presignin/$', consumers.PreSignInConsumer.as_asgi()),
    re_path(r'ws/presignin/(?P<session_id>[^/]+)/$', consumers.PreSignInConsumer.as_asgi()),
]

