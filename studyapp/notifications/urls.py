from django.urls import path

from . import views

app_name = "notifications"

urlpatterns = [
    path("notifications/", views.notifications_list, name="notifications_list"),
    path(
        "notifications/<uuid:notification_id>/mark_read/",
        views.mark_notification_read,
        name="mark_notification_read",
    ),
    path(
        "notifications/<uuid:notification_id>/delete/",
        views.delete_notification,
        name="delete_notification",
    ),
    path(
        "notifications/mark_all_read/",
        views.mark_all_notifications_read,
        name="mark_all_notifications_read",
    ),
    path(
        "notifications/delete_all/",
        views.delete_all_notifications,
        name="delete_all_notifications",
    ),
    path("notifications/unread_count/", views.unread_count, name="unread_count"),
]


