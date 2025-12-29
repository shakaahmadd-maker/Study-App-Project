from django.urls import path
from . import views

app_name = 'exam'

urlpatterns = [
    # Teacher views
    path('teacher/create/', views.create_exam_api, name='create_exam_api'),
    path('teacher/list/', views.list_teacher_exams_api, name='list_teacher_exams_api'),
    path('teacher/delete/<uuid:exam_id>/', views.delete_exam_api, name='delete_exam_api'),
    path('teacher/get/<uuid:exam_id>/', views.get_exam_details_api, name='get_exam_details_api'),
    path('teacher/update/<uuid:exam_id>/', views.update_exam_api, name='update_exam_api'),
    path('teacher/grade/<uuid:attempt_id>/', views.grade_exam_api, name='grade_exam_api'),
    
    # Student views
    path('student/list/', views.list_student_exams_api, name='list_student_exams_api'),
    path('student/start/<uuid:exam_id>/', views.start_exam_api, name='start_exam_api'),
    path('student/attempt/<uuid:attempt_id>/', views.attempt_exam_view, name='attempt_exam_view'),
    path('student/submit/<uuid:attempt_id>/', views.submit_exam_api, name='submit_exam_api'),
    path('student/results-view/<uuid:attempt_id>/', views.results_view, name='results_view'),
    path('student/results/<uuid:attempt_id>/', views.get_attempt_results_api, name='get_attempt_results_api'),
]

