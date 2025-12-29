from django.db import models
from django.conf import settings
import uuid

class Todo(models.Model):
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]
    
    VARIETY_CHOICES = [
        ('academic', 'Academic'),
        ('administrative', 'Administrative'),
        ('meeting', 'Meeting'),
        ('grading', 'Grading'),
        ('preparation', 'Preparation'),
        ('personal', 'Personal'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='todos')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    variety = models.CharField(max_length=20, choices=VARIETY_CHOICES, default='other')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    due_date = models.DateField(blank=True, null=True)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'todos'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({'Completed' if self.is_completed else 'Pending'})"
