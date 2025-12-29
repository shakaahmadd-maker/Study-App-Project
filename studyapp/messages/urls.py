from django.urls import path

from . import views

app_name = "messages"


urlpatterns = [
    # Allowed contacts for "Start New Conversation"
    path("api/allowed-users/", views.allowed_users_api, name="allowed_users"),
    # Threads
    path("api/threads/", views.list_threads_api, name="list_threads"),
    path("api/threads/create/", views.create_direct_thread_api, name="create_thread"),
    path("api/threads/<uuid:thread_id>/messages/", views.thread_messages_api, name="thread_messages"),
    path("api/threads/<uuid:thread_id>/send/", views.send_message_api, name="send_message"),
    path("api/threads/<uuid:thread_id>/mark-read/", views.mark_thread_read_api, name="mark_thread_read"),
    path("api/threads/<uuid:thread_id>/delete/", views.delete_thread_api, name="delete_thread"),
]


