from __future__ import annotations

from typing import Iterable, Optional

from django.contrib.auth import get_user_model
from django.db import transaction

from .models import Notification
from account.models import UserNotificationSettings

# Centralized real-time publishing (best-effort)
try:
    from realtime.services import publish_badges, publish_to_user
except Exception:  # pragma: no cover
    publish_badges = None
    publish_to_user = None

User = get_user_model()


def should_send_notification(recipient: User, notification_type: str) -> bool:
    """
    Check if a user should receive a notification based on their settings.
    Returns True if the notification should be sent, False otherwise.
    """
    try:
        settings = recipient.notification_settings
    except UserNotificationSettings.DoesNotExist:
        # If no settings exist, default to sending notifications
        return True

    # Check general notification preferences first
    if not settings.email_notifications and not settings.push_notifications:
        return False

    # Check role-specific and type-specific preferences
    if recipient.role == 'STUDENT':
        if notification_type == 'message' and not settings.student_messages:
            return False
        elif notification_type == 'announcement' and not settings.announcements:
            return False
        elif notification_type == 'assignment' and not settings.assignment_updates:
            return False
        elif notification_type == 'meeting' and not settings.meeting_reminders:
            return False
        elif notification_type == 'exam' and not settings.exam_reminders:
            return False

    elif recipient.role == 'TEACHER':
        if notification_type == 'message' and not settings.teacher_messages:
            return False
        elif notification_type == 'announcement' and not settings.new_announcements:
            return False
        elif notification_type == 'assignment' and not settings.assignment_submissions:
            return False
        elif notification_type == 'meeting' and not settings.meeting_reminders_teacher:
            return False

    elif recipient.role == 'ADMIN':
        if notification_type == 'assignment' and not settings.assignment_requests:
            return False
        elif notification_type == 'invoice' and not settings.invoice_notifications:
            return False
        elif notification_type == 'content' and not settings.content_review_alerts:
            return False
        elif notification_type == 'system' and not settings.system_alerts:
            return False

    elif recipient.role == 'CS_REP':
        # CS-Reps have a simple all-or-nothing setting
        if not settings.csrep_notifications_enabled:
            return False

    return True


def _serialize_notification(n: Notification) -> dict:
    return {
        "notification_id": str(n.id),
        "title": n.title,
        "message": n.message,
        "notification_type": n.notification_type,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "is_read": n.is_read,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "action_url": n.action_url,
        "related_entity_type": n.related_entity_type,
        "related_entity_id": n.related_entity_id,
        "actor": {
            "id": str(n.actor_id) if n.actor_id else None,
            "name": n.actor.get_full_name() if n.actor_id else None,
        },
    }


def _broadcast_created(n: Notification) -> None:
    if not publish_to_user or not publish_badges:
        return
    try:
        publish_to_user(user_id=n.recipient_id, event="notification.created", data=_serialize_notification(n))
        publish_badges(user_id=n.recipient_id)
    except Exception:
        return


def create_notification(
    *,
    recipient: User,
    notification_type: str,
    title: str = "",
    message: str = "",
    actor: Optional[User] = None,
    action_url: str = "",
    related_entity_type: str = "",
    related_entity_id: str = "",
) -> Optional[Notification]:
    # Check if the user wants to receive this type of notification
    if not should_send_notification(recipient, notification_type):
        return None

    n = Notification.objects.create(
        recipient=recipient,
        actor=actor,
        notification_type=notification_type,
        title=title or "",
        message=message or "",
        action_url=action_url or "",
        related_entity_type=related_entity_type or "",
        related_entity_id=str(related_entity_id) if related_entity_id else "",
    )
    _broadcast_created(n)
    return n


@transaction.atomic
def notify_users(
    *,
    recipients: Iterable[User],
    notification_type: str,
    title: str = "",
    message: str = "",
    actor: Optional[User] = None,
    action_url: str = "",
    related_entity_type: str = "",
    related_entity_id: str = "",
) -> int:
    recipients_list = [u for u in recipients if u]
    if not recipients_list:
        return 0

    # Filter recipients based on their notification preferences
    filtered_recipients = [u for u in recipients_list if should_send_notification(u, notification_type)]
    if not filtered_recipients:
        return 0

    rows = [
        Notification(
            recipient=u,
            actor=actor,
            notification_type=notification_type,
            title=title or "",
            message=message or "",
            action_url=action_url or "",
            related_entity_type=related_entity_type or "",
            related_entity_id=str(related_entity_id) if related_entity_id else "",
        )
        for u in filtered_recipients
    ]
    Notification.objects.bulk_create(rows, batch_size=500)

    # Broadcast events per created notification (best-effort).
    # Django/Postgres returns IDs for bulk_create in modern versions; if not, clients will still
    # get correct badge counts via the follow-up badge event.
    if publish_to_user and publish_badges:
        try:
            for n in rows:
                if getattr(n, "id", None):
                    publish_to_user(user_id=n.recipient_id, event="notification.created", data=_serialize_notification(n))
                    publish_badges(user_id=n.recipient_id)
        except Exception:
            pass
    return len(rows)


def notify_role(
    *,
    role: str,
    notification_type: str,
    title: str = "",
    message: str = "",
    actor: Optional[User] = None,
    action_url: str = "",
    related_entity_type: str = "",
    related_entity_id: str = "",
) -> int:
    # account.User.role values are: STUDENT, TEACHER, CS_REP, ADMIN
    recipients = User.objects.filter(role=role, is_active=True)
    return notify_users(
        recipients=recipients,
        notification_type=notification_type,
        title=title,
        message=message,
        actor=actor,
        action_url=action_url,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
    )


