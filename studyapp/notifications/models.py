import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    """
    Per-user notification row.

    We intentionally store one row per recipient for simplicity and fast reads
    (unread counts, latest feed). For broadcast notifications, create rows for
    each recipient.
    """

    TYPE_ASSIGNMENT = "assignment"
    TYPE_HOMEWORK = "homework"
    TYPE_EXAM = "exam"
    TYPE_ANNOUNCEMENT = "announcement"
    TYPE_INVOICE = "invoice"
    TYPE_MESSAGE = "message"
    TYPE_MEETING = "meeting"
    TYPE_CONTENT = "content"
    TYPE_SYSTEM = "system"

    NOTIFICATION_TYPE_CHOICES = [
        (TYPE_ASSIGNMENT, "Assignment"),
        (TYPE_HOMEWORK, "Homework"),
        (TYPE_EXAM, "Exam"),
        (TYPE_ANNOUNCEMENT, "Announcement"),
        (TYPE_INVOICE, "Invoice"),
        (TYPE_MESSAGE, "Message"),
        (TYPE_MEETING, "Meeting"),
        (TYPE_CONTENT, "Content"),
        (TYPE_SYSTEM, "System"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications_sent",
    )

    title = models.CharField(max_length=200, blank=True, default="")
    message = models.TextField(blank=True, default="")
    notification_type = models.CharField(
        max_length=30, choices=NOTIFICATION_TYPE_CHOICES, default=TYPE_SYSTEM, db_index=True
    )

    # Optional deep-link target
    action_url = models.CharField(max_length=500, blank=True, default="")
    related_entity_type = models.CharField(max_length=80, blank=True, default="")
    related_entity_id = models.CharField(max_length=80, blank=True, default="")

    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read", "-created_at"]),
            models.Index(fields=["recipient", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"Notification({self.notification_type}) to {self.recipient_id}"

    def mark_read(self) -> None:
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
