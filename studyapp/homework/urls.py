from django.urls import path
from . import views

app_name = 'homework'

urlpatterns = [
    # Common actions
    path('details/<uuid:homework_id>/', views.get_homework_details, name='get_homework_details'),
    
    # Teacher actions
    path('teacher/create/', views.create_homework, name='create_homework'),
    path('teacher/list/', views.list_teacher_homeworks, name='list_teacher_homeworks'),
    path('teacher/grade/', views.grade_homework, name='grade_homework'),
    path('teacher/assigned-students/', views.get_assigned_students, name='get_assigned_students'),
    
    # Student actions
    path('student/list/', views.list_student_homeworks, name='list_student_homeworks'),
    path('student/submit/', views.submit_homework, name='submit_homework'),
]

