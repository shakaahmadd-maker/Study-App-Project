from django.urls import path
from . import views

app_name = 'study'

urlpatterns = [
    path('home/', views.home, name='home'),
    path('services/', views.services, name='services'),
]