from django.urls import path
from . import views

app_name = 'invoice'

urlpatterns = [
    path('api/list/', views.list_invoices_api, name='list_invoices_api'),
    path('api/details/<uuid:invoice_id>/', views.get_invoice_details, name='get_invoice_details'),
    path('api/create/', views.create_invoice, name='create_invoice'),
    path('api/student/confirm-payment/<uuid:invoice_id>/', views.student_confirm_payment, name='student_confirm_payment'),
    path('api/admin/mark-paid/<uuid:invoice_id>/', views.admin_mark_paid, name='admin_mark_paid'),
    path('api/admin/send-reminder/<uuid:invoice_id>/', views.admin_send_reminder, name='admin_send_reminder'),
    path('api/admin/delete/<uuid:invoice_id>/', views.admin_delete_invoice, name='admin_delete_invoice'),
]
