from django.db import models
from django.conf import settings
from django.utils import timezone

class Announcement(models.Model):
    PRIORITY_CHOICES = [
        ('general', 'General'),
        ('important', 'Important'),
        ('urgent', 'Urgent'),
    ]

    title = models.CharField(max_length=255)
    content = models.TextField()
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='general')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_announcements')
    
    # Recipient flags
    all_students = models.BooleanField(default=False)
    all_teachers = models.BooleanField(default=False)
    all_csreps = models.BooleanField(default=False)
    # If specific recipients are selected
    specific_recipients = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='received_announcements', blank=True)
    
    tags = models.JSONField(default=list, blank=True)
    
    scheduled_at = models.DateTimeField(default=timezone.now)
    send_email = models.BooleanField(default=True)
    pin_to_dashboard = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        db_table = 'announcements'

    def __str__(self):
        return self.title
