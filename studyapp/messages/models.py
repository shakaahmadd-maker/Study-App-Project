import uuid
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Thread(models.Model):
    """
    ERD: THREADS

    This app implements **direct one-to-one** threads only (no groups).
    """

    TYPE_DIRECT = "direct"
    TYPE_CHOICES = [(TYPE_DIRECT, "Direct")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_DIRECT)

    # Uniqueness key for direct threads: "<min_user_uuid>:<max_user_uuid>"
    direct_key = models.CharField(max_length=80, unique=True, db_index=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_threads",
    )

    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = "threads"
        ordering = ["-last_message_at", "-updated_at"]

    def __str__(self) -> str:
        return f"Thread {self.id} ({self.thread_type})"

    @staticmethod
    def make_direct_key(user_a_id, user_b_id) -> str:
        a = str(user_a_id)
        b = str(user_b_id)
        lo, hi = (a, b) if a < b else (b, a)
        return f"{lo}:{hi}"

    def clean(self):
        super().clean()
        if self.thread_type != self.TYPE_DIRECT:
            raise ValidationError("Only direct threads are supported.")
        if not self.direct_key:
            raise ValidationError("direct_key is required for direct threads.")


class ThreadParticipant(models.Model):
    """
    ERD: THREAD_PARTICIPANTS
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(Thread, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="thread_participations")

    joined_at = models.DateTimeField(default=timezone.now, db_index=True)
    # Read cursor for unread counts (per-thread, per-user)
    last_read_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = "thread_participants"
        constraints = [
            models.UniqueConstraint(fields=["thread", "user"], name="uniq_thread_participant"),
        ]
        indexes = [
            models.Index(fields=["user", "thread"]),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} in {self.thread_id}"


class Message(models.Model):
    """
    ERD: MESSAGES
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(Thread, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages")

    content = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "messages"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["thread", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"Message {self.id} in {self.thread_id}"

    def clean(self):
        super().clean()
        if not self.content and not getattr(self, "_has_attachments", False):
            raise ValidationError("Message must have text content or at least one attachment.")


def message_attachment_upload_to(instance: "MessageAttachment", filename: str) -> str:
    # public/media/messages/<thread>/<message>/<filename>
    return f"messages/{instance.message.thread_id}/{instance.message_id}/{filename}"


class MessageAttachment(models.Model):
    """
    ERD: MESSAGE_ATTACHMENTS
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="attachments")

    file = models.FileField(upload_to=message_attachment_upload_to)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=255, blank=True)
    size_bytes = models.BigIntegerField(default=0)

    # Optional: for voice messages (ms)
    duration_ms = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "message_attachments"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["message", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"Attachment {self.id} for {self.message_id}"
