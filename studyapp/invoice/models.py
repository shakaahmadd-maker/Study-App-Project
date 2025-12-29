import uuid
from django.db import models
from django.conf import settings

class Invoice(models.Model):
    STATUS_CHOICES = [
        ('request_pending', 'Request Pending'),
        ('pending_payment', 'Pending Payment'),
        ('payment_review', 'Payment Review'),
        ('paid', 'Paid'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_number = models.CharField(max_length=50, unique=True, null=True, blank=True)
    assignment = models.ForeignKey('assingment.Assignment', on_delete=models.CASCADE, related_name='invoices')
    student = models.ForeignKey('account.Student', on_delete=models.CASCADE, related_name='invoices')
    cs_rep = models.ForeignKey('account.CSRep', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_invoices')
    
    charge_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_payable = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_payment')
    invoice_link = models.URLField(max_length=500, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    payment_screenshot = models.ImageField(upload_to='payment_screenshots/', null=True, blank=True)
    
    due_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'invoices'
        ordering = ['-created_at']

    def __str__(self):
        return f"Invoice {self.invoice_number or self.id} - {self.status}"

    def generate_invoice_number(self):
        if not self.invoice_number and self.status != 'request_pending':
            from django.utils import timezone
            year = timezone.now().year
            # Get the count of actual invoices (not requests)
            count = Invoice.objects.exclude(status='request_pending').count() + 1
            self.invoice_number = f"INV-{year}-{str(count).zfill(3)}"
            return self.invoice_number
        return self.invoice_number
