from django.urls import path
from . import views

app_name = 'todo'

urlpatterns = [
    path('list/', views.list_todos, name='list'),
    path('add/', views.add_todo, name='add'),
    path('toggle/<uuid:todo_id>/', views.toggle_todo, name='toggle'),
    path('delete/<uuid:todo_id>/', views.delete_todo, name='delete'),
]
