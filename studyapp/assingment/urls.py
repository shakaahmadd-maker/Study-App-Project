from django.urls import path
from . import views

app_name = 'assingment'

urlpatterns = [
    # Student actions
    path('create/', views.create_assignment, name='create_assignment'),
    path('cancel/<uuid:assignment_id>/', views.cancel_assignment, name='cancel_assignment'),
    path('student/list/', views.student_assignment_list, name='student_assignment_list'),
    path('student/feedback/submit/', views.submit_student_feedback, name='submit_student_feedback'),
    
    # Admin actions
    path('admin/assign-teacher/', views.assign_teacher, name='assign_teacher'),
    path('admin/details/<uuid:assignment_id>/', views.get_assignment_details, name='get_assignment_details'),
    path('admin/review/submit/', views.submit_content_review, name='submit_content_review'),
    path('admin/feedback/submit/', views.submit_admin_feedback, name='submit_admin_feedback'),
    
    # Teacher actions
    path('teacher/mark-complete/', views.mark_assignment_complete, name='mark_assignment_complete'),
    path('teacher/start-process/<uuid:assignment_id>/', views.start_assignment_process, name='start_assignment_process'),
    path('teacher/download-zip/<uuid:assignment_id>/', views.download_assignment_zip, name='download_assignment_zip'),
    path('api/list/', views.list_assignments_api, name='list_assignments_api'),
]

