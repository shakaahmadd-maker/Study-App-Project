from django.urls import path
from . import views

app_name = 'thread'

urlpatterns = [
    path('api/list/', views.get_thread_list, name='list'),
    path('api/create/', views.create_thread, name='create'),
    path('api/<uuid:thread_id>/messages/', views.get_thread_messages, name='messages'),
    path('api/<uuid:thread_id>/send/', views.send_message, name='send'),
    path('api/<uuid:thread_id>/status/', views.update_thread_status, name='status'),
    path('api/<uuid:thread_id>/delete/', views.delete_thread, name='delete'),
]

