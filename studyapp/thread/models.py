import uuid
import os
from django.db import models
from django.conf import settings
from django.utils import timezone

class Thread(models.Model):
    THREAD_TYPE_CHOICES = [
        ('assignment', 'Assignment Related'),
        ('invoice', 'Invoice Related'),
        ('general', 'General'),
        ('support', 'Support'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject = models.CharField(max_length=255)
    thread_type = models.CharField(max_length=20, choices=THREAD_TYPE_CHOICES, default='general')
    assignment = models.ForeignKey('assingment.Assignment', on_delete=models.SET_NULL, null=True, blank=True, related_name='discussion_threads')
    invoice = models.ForeignKey('invoice.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='discussion_threads')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='created_discussion_threads'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = 'discussion_threads'
        ordering = ['-last_message_at', '-created_at']

    def __str__(self):
        return f"{self.subject} ({self.get_thread_type_display()})"

class ThreadParticipant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(Thread, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='discussion_participations'
    )
    
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'discussion_thread_participants'
        unique_together = ('thread', 'user')

    def __str__(self):
        return f"{self.user.get_full_name()} in {self.thread.subject}"

class ThreadMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(Thread, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='sent_discussion_messages'
    )
    
    content = models.TextField(blank=True)
    is_system_message = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Mentions feature
    mentions = models.ManyToManyField(
        settings.AUTH_USER_MODEL, 
        related_name='mentioned_in_discussion_messages', 
        blank=True
    )

    class Meta:
        db_table = 'discussion_messages'
        ordering = ['created_at']

    def __str__(self):
        return f"Message by {self.sender.get_full_name()} in {self.thread.subject}"

def thread_attachment_path(instance, filename):
    """
    Generate upload path for thread attachments.
    Handles cases where message or thread might not be fully saved yet.
    """
    try:
        if instance and instance.message and instance.message.thread:
            thread_id = str(instance.message.thread.id)
            message_id = str(instance.message.id)
            # Sanitize filename - remove any path components
            safe_filename = os.path.basename(filename) if filename else 'unnamed'
            return f'threads/{thread_id}/{message_id}/{safe_filename}'
        else:
            # Fallback path if message/thread not available
            safe_filename = os.path.basename(filename) if filename else 'unnamed'
            return f'threads/unknown/{safe_filename}'
    except Exception:
        # Ultimate fallback
        safe_filename = os.path.basename(filename) if filename else 'unnamed'
        return f'threads/fallback/{safe_filename}'

class ThreadAttachment(models.Model):
    ATTACHMENT_TYPE_CHOICES = [
        ('file', 'File'),
        ('audio', 'Audio'), # Voicemail
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(ThreadMessage, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to=thread_attachment_path)
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20, choices=ATTACHMENT_TYPE_CHOICES, default='file')
    
    # For audio attachments
    duration_ms = models.IntegerField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'discussion_attachments'

    def __str__(self):
        return f"Attachment for {self.message.id}"
