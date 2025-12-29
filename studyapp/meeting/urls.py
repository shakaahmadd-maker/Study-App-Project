from django.urls import path
from . import views

app_name = 'meeting'

urlpatterns = [
    path('api/list/', views.list_meetings, name='list_meetings'),
    path('api/schedule/', views.schedule_meeting, name='schedule_meeting'),
    path('api/<uuid:meeting_id>/details/', views.get_meeting_details, name='get_meeting_details'),
    path('api/<uuid:meeting_id>/start/', views.start_meeting, name='start_meeting'),
    path('api/<uuid:meeting_id>/end/', views.end_meeting, name='end_meeting'),
    path('api/<uuid:meeting_id>/download-recording/', views.download_recording, name='download_recording'),
    path('api/<uuid:meeting_id>/upload-recording/', views.upload_recording, name='upload_recording'),
    path('api/<uuid:meeting_id>/delete/', views.delete_meeting, name='delete_meeting'),

    # Meeting pages
    path('prejoin/', views.meeting_prejoin_page, name='prejoin'),
    path('room/', views.meeting_room_page, name='room'),
]

