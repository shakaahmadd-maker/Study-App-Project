import uuid
from django.db import models
from django.conf import settings

class PreSignInSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ref_number = models.CharField(max_length=20, unique=True, db_index=True)
    visitor_name = models.CharField(max_length=255)
    visitor_concern = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    last_message_at = models.DateTimeField(auto_now_add=True)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='assigned_presignin_sessions')

    class Meta:
        ordering = ['-last_message_at']

    def __str__(self):
        return f"{self.ref_number} - {self.visitor_name}"

    @classmethod
    def generate_ref_number(cls):
        import random
        import string
        max_attempts = 100
        attempts = 0
        while attempts < max_attempts:
            ref = 'PS-' + ''.join(random.choices(string.digits, k=6))
            if not cls.objects.filter(ref_number=ref).exists():
                return ref
            attempts += 1
        # Fallback: use timestamp-based ref if random generation fails
        import time
        ref = f'PS-{int(time.time()) % 1000000:06d}'
        if not cls.objects.filter(ref_number=ref).exists():
            return ref
        # Last resort: use UUID
        import uuid
        return f'PS-{str(uuid.uuid4())[:6].upper()}'

class PreSignInMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(PreSignInSession, related_name='messages', on_delete=models.CASCADE)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    visitor_name = models.CharField(max_length=255, null=True, blank=True)
    content = models.TextField()
    attachment = models.FileField(upload_to='pre_signin_attachments/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_system = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message from {self.visitor_name or self.sender} in {self.session.ref_number}"
