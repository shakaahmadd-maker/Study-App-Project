from django.urls import path
from . import views

app_name = 'preSigninMessages'

urlpatterns = [
    path('api/sessions/', views.list_sessions, name='list_sessions'),
    path('api/sessions/<uuid:session_id>/messages/', views.get_session_messages, name='get_session_messages'),
    path('api/sessions/<uuid:session_id>/send/', views.send_csrep_message, name='send_csrep_message'),
    path('api/sessions/<uuid:session_id>/close/', views.close_session, name='close_session'),
    path('api/sessions/backup/', views.search_closed_sessions, name='search_closed_sessions'),
]

