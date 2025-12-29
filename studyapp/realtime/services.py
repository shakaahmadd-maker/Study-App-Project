from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.db.models import Count, F, IntegerField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce

User = get_user_model()


def publish_to_users(*, user_ids, event: str, data: Optional[Dict[str, Any]] = None) -> None:
    """
    Publish a dashboard event to many users (best-effort).
    """
    if not user_ids:
        return
    for uid in set(str(x) for x in user_ids if x):
        try:
            publish_to_user(user_id=uid, event=event, data=data)
        except Exception:
            continue


def publish_to_role(*, role: str, event: str, data: Optional[Dict[str, Any]] = None) -> int:
    """
    Publish a dashboard event to all active users of a role.
    Returns recipient count.
    """
    r = (role or "").strip().upper()
    if r not in {"STUDENT", "TEACHER", "CS_REP", "ADMIN"}:
        return 0
    ids = list(User.objects.filter(role=r, is_active=True).values_list("id", flat=True))
    publish_to_users(user_ids=ids, event=event, data=data)
    return len(ids)


def user_group_name(user_id: Any) -> str:
    # Groups must be ASCII and reasonably short; UUIDs are safe as strings.
    return f"dashboard_user_{user_id}"


def publish_to_user(*, user_id: Any, event: str, data: Optional[Dict[str, Any]] = None) -> None:
    """
    Publish a single dashboard event to a user's dashboard stream.
    Safe to call from sync Django code.
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    async_to_sync(channel_layer.group_send)(
        user_group_name(user_id),
        {
            "type": "dashboard.event",
            "event": event,
            "data": data or {},
        },
    )


def publish_badges(*, user_id: Any) -> Dict[str, int]:
    """
    Recompute badge counts from DB and publish them to the user.
    Returns the counts used.
    """
    counts = get_badge_counts_for_user_id(user_id)
    publish_to_user(user_id=user_id, event="badges.updated", data={"badges": counts})
    return counts


def get_badge_counts_for_user_id(user_id: Any) -> Dict[str, int]:
    """
    Single source-of-truth badge counts for the whole UI.
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {
            "notifications_unread": 0,
            "messages_unread": 0,
            "threads_unread": 0,
            "meetings_active": 0,
        }
    return get_badge_counts_for_user(user)


def get_badge_counts_for_user(user: User) -> Dict[str, int]:
    from notifications.models import Notification
    from meeting.models import Meeting
    from messages.models import Message, ThreadParticipant as DMParticipant
    from thread.models import ThreadMessage, ThreadParticipant as DiscussionParticipant

    notifications_unread = (
        Notification.objects.filter(recipient=user, is_read=False).count()
    )

    # Direct Messages unread: sum of unread messages across all DM threads
    dm_cursor = Coalesce(OuterRef("last_read_at"), OuterRef("joined_at"))
    dm_unread_subq = (
        Message.objects.filter(thread_id=OuterRef("thread_id"), created_at__gt=dm_cursor)
        .exclude(sender_id=user.id)
        .values("thread_id")
        .annotate(c=Count("*"))
        .values("c")[:1]
    )
    dm_total_unread = (
        DMParticipant.objects.filter(user_id=user.id)
        .annotate(unread=Coalesce(Subquery(dm_unread_subq, output_field=IntegerField()), Value(0)))
        .aggregate(total=Coalesce(Sum("unread"), Value(0)))["total"]
        or 0
    )

    # Discussion Threads unread: sum of unread messages across threads
    disc_cursor = Coalesce(OuterRef("last_read_at"), OuterRef("joined_at"))
    disc_unread_subq = (
        ThreadMessage.objects.filter(thread_id=OuterRef("thread_id"), created_at__gt=disc_cursor)
        .exclude(sender_id=user.id)
        .values("thread_id")
        .annotate(c=Count("*"))
        .values("c")[:1]
    )
    disc_total_unread = (
        DiscussionParticipant.objects.filter(user_id=user.id)
        .annotate(unread=Coalesce(Subquery(disc_unread_subq, output_field=IntegerField()), Value(0)))
        .aggregate(total=Coalesce(Sum("unread"), Value(0)))["total"]
        or 0
    )

    meetings_active = (
        Meeting.objects.filter(
            Q(host_id=user.id) | Q(student_id=user.id) | Q(teacher_id=user.id),
            status__in=[Meeting.STATUS_SCHEDULED, Meeting.STATUS_IN_PROGRESS],
        ).count()
    )

    return {
        "notifications_unread": int(notifications_unread or 0),
        "messages_unread": int(dm_total_unread or 0),
        "threads_unread": int(disc_total_unread or 0),
        "meetings_active": int(meetings_active or 0),
    }


