from django.urls import path
from . import views

app_name = 'announcement'

urlpatterns = [
    path('api/list/', views.get_announcements, name='list_announcements'),
    path('api/create/', views.create_announcement, name='create_announcement'),
    path('api/delete/<int:announcement_id>/', views.delete_announcement, name='delete_announcement'),
    path('api/recipients/', views.get_recipients_list, name='get_recipients_list'),
]

