from django.urls import path
from . import views

app_name = 'account'

urlpatterns = [
    # Registration page - serves template on GET, handles registration on POST
    path('api/accounts/register/', views.register_view, name='register'),
    # Login page for staff
    path('login/', views.login_page_view, name='login_page'),
    # API endpoints
    path('api/accounts/login/', views.login_view, name='login'),
    path('api/accounts/logout/', views.logout_view, name='logout'),
    path('api/accounts/profile/', views.profile_view, name='profile'),
    path('api/accounts/change-password/', views.change_password_view, name='change_password'),
    path('api/accounts/settings/', views.notification_settings_api, name='notification_settings'),
    path('api/accounts/create-csrep/', views.create_csrep_view, name='create_csrep'),
    path('api/accounts/create-teacher/', views.create_teacher_view, name='create_teacher'),
    # Student pages
    path('student/dashboard/', views.student_dashboard_view, name='student_dashboard'),
    path('student/profile/', views.student_profile_view, name='student_profile'),
    # Dynamic section loading for student dashboard
    path('student/section/<str:section_name>/', views.student_section_view, name='student_section'),
    # Teacher pages
    path('teacher-dashboard/', views.teacher_dashboard_view, name='teacher_dashboard'),
    path('teacher/profile/', views.teacher_profile_view, name='teacher_profile'),
    # Dynamic section loading for teacher dashboard
    path('teacher/section/<str:section_name>/', views.teacher_section_view, name='teacher_section'),
    # Teacher APIs (used by dynamically loaded teacher sections)
    path('api/teacher/student/<int:student_id>/assignments/', views.teacher_student_assignments_api, name='teacher_student_assignments_api'),
    path('api/teacher/student-feedback/submit/', views.teacher_student_feedback_submit_api, name='teacher_student_feedback_submit_api'),
    path('api/teacher/student-report/submit/', views.teacher_student_report_submit_api, name='teacher_student_report_submit_api'),
    # CS-Rep pages
    path('cs-rep-dashboard/', views.csrep_dashboard_view, name='csrep_dashboard'),
    path('csrep/profile/', views.csrep_profile_view, name='csrep_profile'),
    # Dynamic section loading for CS Rep dashboard
    path('csrep/section/<str:section_name>/', views.csrep_section_view, name='csrep_section'),
    # CS-Rep dashboard APIs
    path('csrep/api/overview-metrics/', views.csrep_overview_metrics_api, name='csrep_overview_metrics_api'),
    # Admin pages
    path('admin-dashboard/', views.admin_dashboard_view, name='admin_dashboard'),
    path('admin/profile/', views.admin_profile_view, name='admin_profile'),
    # Dynamic section loading for admin dashboard
    path('admin/section/<str:section_name>/', views.admin_section_view, name='admin_section'),
    # Admin User Management actions
    path('api/admin/toggle-user-status/', views.toggle_user_status, name='toggle_user_status'),
    path('api/admin/reset-password/', views.admin_reset_password, name='admin_reset_password'),
    path('api/admin/delete-user/', views.admin_delete_user, name='admin_delete_user'),
    path('api/admin/list-teachers/', views.list_teachers_api, name='list_teachers_api'),
    path('api/admin/list-students/', views.list_students_api, name='list_students_api'),
    # Visitor form submission
    path('api/visitor/submit/', views.visitor_form_submit_api, name='visitor_form_submit'),
    path('api/admin/visitor/<uuid:visitor_id>/delete/', views.delete_visitor_api, name='delete_visitor_api'),
    # Content Review APIs
    path('api/admin/content-review/delete/', views.delete_content_review_api, name='delete_content_review_api'),
    # Feedback & Reports APIs
    path('api/admin/feedback/<int:feedback_id>/mark-read/', views.mark_feedback_read_api, name='mark_feedback_read_api'),
    path('api/admin/report/<int:report_id>/mark-read/', views.mark_report_read_api, name='mark_report_read_api'),
    path('api/admin/feedback/<int:feedback_id>/delete/', views.delete_feedback_api, name='delete_feedback_api'),
    path('api/admin/report/<int:report_id>/delete/', views.delete_report_api, name='delete_report_api'),
    path('api/admin/feedback/<int:feedback_id>/detail/', views.get_feedback_detail_api, name='get_feedback_detail_api'),
    path('api/admin/report/<int:report_id>/detail/', views.get_report_detail_api, name='get_report_detail_api'),
    # Masked Link Redirect & Generator
    path('m/<str:token>/', views.masked_redirect_view, name='masked_redirect'),
    path('api/mask/generate/', views.generate_masked_link_api, name='generate_masked_link_api'),
]

