from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from .models import Invoice
from account.models import Student, CSRep, User
from account.utils import generate_masked_link
from account.decorators import admin_required, student_required, staff_required
from assingment.models import Assignment
from notifications.services import create_notification
from realtime.services import publish_to_user, publish_to_role
import json
from decimal import Decimal

@login_required
def get_invoice_details(request, invoice_id):
    """
    Returns full details for a single invoice.
    """
    invoice = get_object_or_404(Invoice, id=invoice_id)
    
    # Check permissions
    if request.user.role == 'STUDENT' and invoice.student.user != request.user:
        return JsonResponse({'success': False, 'message': 'Permission denied.'}, status=403)
    if request.user.role == 'CS_REP' and invoice.cs_rep and invoice.cs_rep.user != request.user:
        # CS-Rep can see their own requests
        pass
    elif request.user.role == 'CS_REP' and not (invoice.cs_rep and invoice.cs_rep.user == request.user):
         return JsonResponse({'success': False, 'message': 'Permission denied.'}, status=403)

    invoice_link = invoice.invoice_link
    screenshot_url = invoice.payment_screenshot.url if invoice.payment_screenshot else None
    
    if request.user.role == 'TEACHER':
        if invoice_link:
            invoice_link = generate_masked_link(request.user, invoice_link, 'invoice')
        if screenshot_url:
            screenshot_url = generate_masked_link(request.user, screenshot_url, 'payment_screenshot')

    data = {
        'id': str(invoice.id),
        'invoice_number': invoice.invoice_number or str(invoice.id)[:8],
        'status': invoice.status,
        'status_display': invoice.get_status_display(),
        'created_at': invoice.created_at.strftime('%b %d, %Y'),
        'due_date': invoice.due_date.strftime('%b %d, %Y') if invoice.due_date else '-',
        'student_name': invoice.student.user.get_full_name(),
        'student_email': invoice.student.user.email,
        'student_id': str(invoice.student.id),
        'student_id_code': str(invoice.student.student_id).zfill(4),
        'assignment_title': invoice.assignment.title,
        'assignment_id': str(invoice.assignment.id),
        'charge_amount': str(invoice.charge_amount),
        'discount_percentage': str(invoice.discount_percentage),
        'discount_amount': str(invoice.discount_amount),
        'total_payable': str(invoice.total_payable),
        'invoice_link': invoice_link,
        'notes': invoice.notes,
        'has_screenshot': bool(invoice.payment_screenshot),
        'screenshot_url': screenshot_url,
    }
    
    if invoice.cs_rep:
        data['cs_rep_name'] = invoice.cs_rep.user.get_full_name()
        data['cs_rep_email'] = invoice.cs_rep.user.email

    return JsonResponse({'success': True, 'invoice': data})

@login_required
@require_POST
@transaction.atomic
def create_invoice(request):
    """
    Creates an invoice (Admin) or an invoice request (CS-Rep).
    """
    try:
        if request.content_type == 'application/json':
            data = json.loads(request.body)
        else:
            data = request.POST

        student_id = data.get('student_id')
        assignment_id = data.get('assignment_id')
        charge_amount = Decimal(str(data.get('charge_amount', 0)))
        discount_type = data.get('discount_type', 'amount') # 'amount' or 'percentage'
        discount_val = Decimal(str(data.get('discount_value', 0)))
        notes = data.get('notes', '')
        request_id = data.get('request_id')
        
        student = get_object_or_404(Student, id=student_id)
        assignment = get_object_or_404(Assignment, id=assignment_id)
        
        # Calculate discounts
        discount_amount = Decimal('0.00')
        discount_percentage = Decimal('0.00')
        
        if discount_type == 'percentage':
            discount_percentage = discount_val
            discount_amount = (charge_amount * discount_percentage / 100).quantize(Decimal('0.01'))
        else:
            discount_amount = discount_val
            if charge_amount > 0:
                discount_percentage = (discount_amount / charge_amount * 100).quantize(Decimal('0.01'))
        
        total_payable = charge_amount - discount_amount
        
        invoice = Invoice(
            student=student,
            assignment=assignment,
            charge_amount=charge_amount,
            discount_percentage=discount_percentage,
            discount_amount=discount_amount,
            total_payable=total_payable,
            notes=notes,
        )
        
        if request.user.role == 'ADMIN':
            invoice_link = data.get('invoice_link')
            if not invoice_link:
                return JsonResponse({'success': False, 'message': 'Invoice payment link is required.'})
            invoice.invoice_link = invoice_link
            invoice.status = 'pending_payment'
            invoice.save()
            invoice.generate_invoice_number()
            invoice.save()
            
            # If this was from a CS-Rep request, delete the request
            if request_id:
                Invoice.objects.filter(id=request_id).delete()
            
            # Notify student
            create_notification(
                recipient=student.user,
                notification_type='invoice_created',
                title='New Invoice Received',
                message=f'You have received a new invoice for {assignment.title}. Total: ${total_payable}',
                actor=request.user,
                action_url='/student/invoices/',
                related_entity_type='invoice',
                related_entity_id=str(invoice.id)
            )
            
            publish_to_user(user_id=student.user.id, event='invoice.changed', data={'id': str(invoice.id), 'action': 'created'})
            publish_to_role(role='ADMIN', event='invoice.changed', data={'id': str(invoice.id), 'action': 'created'})
            
        elif request.user.role == 'CS_REP':
            invoice.cs_rep = request.user.csrep_profile
            invoice.status = 'request_pending'
            invoice.save()
            
            # Notify Admins
            admins = User.objects.filter(role='ADMIN')
            for admin_user in admins:
                create_notification(
                    recipient=admin_user,
                    notification_type='invoice_request',
                    title='New Invoice Request',
                    message=f'CS-Rep {request.user.get_full_name()} has requested an invoice for student {student.user.get_full_name()}.',
                    actor=request.user,
                    action_url='/admin/invoices/',
                    related_entity_type='invoice',
                    related_entity_id=str(invoice.id)
                )
            
            publish_to_role(role='ADMIN', event='invoice.changed', data={'id': str(invoice.id), 'action': 'request_created'})
            publish_to_user(user_id=request.user.id, event='invoice.changed', data={'id': str(invoice.id), 'action': 'request_created'})
        else:
            return JsonResponse({'success': False, 'message': 'Unauthorized.'}, status=403)

        return JsonResponse({'success': True, 'message': 'Invoice created successfully.', 'invoice_id': str(invoice.id)})
        
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})

@login_required
@require_POST
def student_confirm_payment(request, invoice_id):
    """
    Student uploads proof of payment.
    """
    invoice = get_object_or_404(Invoice, id=invoice_id, student__user=request.user)
    
    if 'payment_screenshot' not in request.FILES:
        return JsonResponse({'success': False, 'message': 'Payment screenshot is required.'})
    
    invoice.payment_screenshot = request.FILES['payment_screenshot']
    invoice.status = 'payment_review'
    invoice.save()
    
    # Notify Admin
    admins = User.objects.filter(role='ADMIN')
    for admin_user in admins:
        create_notification(
            recipient=admin_user,
            notification_type='payment_submitted',
            title='Payment Proof Submitted',
            message=f'Student {request.user.get_full_name()} has submitted payment proof for invoice {invoice.invoice_number}.',
            actor=request.user,
            action_url='/admin/invoices/',
            related_entity_type='invoice',
            related_entity_id=str(invoice.id)
        )
    
    publish_to_role(role='ADMIN', event='invoice.changed', data={'id': str(invoice.id), 'action': 'payment_confirmed'})
    publish_to_user(user_id=request.user.id, event='invoice.changed', data={'id': str(invoice.id), 'action': 'payment_confirmed'})
        
    return JsonResponse({'success': True, 'message': 'Payment confirmation submitted successfully.'})

@login_required
@admin_required
@require_POST
def admin_mark_paid(request, invoice_id):
    """
    Admin verifies payment and marks as paid.
    """
    invoice = get_object_or_404(Invoice, id=invoice_id)
    invoice.status = 'paid'
    invoice.save()
    
    # Notify student
    create_notification(
        recipient=invoice.student.user,
        notification_type='invoice_paid',
        title='Invoice Paid',
        message=f'Your payment for invoice {invoice.invoice_number} has been verified. Thank you!',
        actor=request.user,
        action_url='/student/invoices/',
        related_entity_type='invoice',
        related_entity_id=str(invoice.id)
    )
    
    publish_to_user(user_id=invoice.student.user.id, event='invoice.changed', data={'id': str(invoice.id), 'action': 'marked_paid'})
    publish_to_role(role='ADMIN', event='invoice.changed', data={'id': str(invoice.id), 'action': 'marked_paid'})
    
    return JsonResponse({'success': True, 'message': 'Invoice marked as paid.'})

@login_required
@admin_required
@require_POST
def admin_send_reminder(request, invoice_id):
    """
    Admin sends a high-priority reminder to the student.
    """
    invoice = get_object_or_404(Invoice, id=invoice_id)
    
    create_notification(
        recipient=invoice.student.user,
        notification_type='invoice_reminder',
        title='URGENT: Payment Reminder',
        message=f'This is a reminder that payment for invoice {invoice.invoice_number} (${invoice.total_payable}) is pending.',
        actor=request.user,
        action_url='/student/invoices/',
        related_entity_type='invoice',
        related_entity_id=str(invoice.id)
    )
    
    return JsonResponse({'success': True, 'message': 'Reminder sent.'})

@login_required
@admin_required
@require_POST
def admin_delete_invoice(request, invoice_id):
    """
    Admin deletes an invoice or request.
    """
    invoice = get_object_or_404(Invoice, id=invoice_id)
    invoice.delete()
    
    publish_to_role(role='ADMIN', event='invoice.changed', data={'action': 'deleted'})
    
    return JsonResponse({'success': True, 'message': 'Invoice/Request deleted.'})

@login_required
def list_invoices_api(request):
    """
    List invoices with filtering.
    """
    status_filter = request.GET.get('status', 'all')
    invoices = Invoice.objects.all().order_by('-created_at')
    
    if request.user.role == 'STUDENT':
        invoices = invoices.filter(student__user=request.user).exclude(status='request_pending')
        # Apply status filter for students if provided
        if status_filter != 'all':
            invoices = invoices.filter(status=status_filter)
    elif request.user.role == 'CS_REP':
        invoices = invoices.filter(cs_rep__user=request.user)
        # Apply status filter for CS-Reps if provided
        if status_filter != 'all':
            invoices = invoices.filter(status=status_filter)
    elif request.user.role == 'TEACHER':
        # Teachers should only see invoices related to their assignments
        invoices = invoices.filter(assignment__teacher_assignments__teacher__user=request.user)
        # Apply status filter for teachers if provided
        if status_filter != 'all':
            invoices = invoices.filter(status=status_filter)
    elif request.user.role == 'ADMIN':
        # For admin, apply status filter only if not 'all'
        # When 'all', show all invoices including paid ones
        if status_filter != 'all':
            invoices = invoices.filter(status=status_filter)
        # If filtering for request_pending, only show invoices created by CS-Reps
        if status_filter == 'request_pending':
            invoices = invoices.filter(cs_rep__isnull=False)
    else:
        return JsonResponse({'success': False, 'message': 'Unauthorized.'}, status=403)
        
    data = [{
        'id': str(i.id),
        'invoice_number': i.invoice_number or str(i.id)[:8],
        'student_name': i.student.user.get_full_name(),
        'assignment_title': i.assignment.title,
        'total_payable': str(i.total_payable),
        'charge_amount': str(i.charge_amount),
        'discount_amount': str(i.discount_amount),
        'discount_percentage': str(i.discount_percentage),
        'status': i.status,
        'status_display': i.get_status_display(),
        'created_at': i.created_at.strftime('%Y-%m-%d'),
        'due_date': i.due_date.strftime('%Y-%m-%d') if i.due_date else '-',
        'invoice_link': i.invoice_link,
        'has_screenshot': bool(i.payment_screenshot),
        'cs_rep_name': i.cs_rep.user.get_full_name() if i.cs_rep else None,
    } for i in invoices]
    
    return JsonResponse({'success': True, 'invoices': data})
