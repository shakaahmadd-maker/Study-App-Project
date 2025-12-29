from django.urls import re_path

from .consumers import MessagesConsumer

websocket_urlpatterns = [
    re_path(r"^ws/messages/$", MessagesConsumer.as_asgi()),
]


