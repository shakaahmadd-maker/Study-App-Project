from __future__ import annotations

from typing import Optional

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .models import Notification
from realtime.services import publish_badges, publish_to_user


def _normalize_role(role: Optional[str]) -> Optional[str]:
    if not role:
        return None
    r = role.strip().lower()
    mapping = {
        "student": "STUDENT",
        "teacher": "TEACHER",
        "cs_rep": "CS_REP",
        "csrep": "CS_REP",
        "admin": "ADMIN",
    }
    return mapping.get(r, None)


def _require_authenticated_user(request):
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Authentication required"}, status=401)
    return None


def _serialize_notification(n: Notification) -> dict:
    return {
        "notification_id": str(n.id),
        "title": n.title,
        "message": n.message,
        "notification_type": n.notification_type,
        "created_at": n.created_at.isoformat(),
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


def _push_notification_created(n: Notification) -> None:
    try:
        publish_to_user(user_id=n.recipient_id, event="notification.created", data=_serialize_notification(n))
        publish_badges(user_id=n.recipient_id)
    except Exception:
        # Best-effort: never break the HTTP response
        return


def _push_notification_updated(n: Notification) -> None:
    try:
        publish_to_user(
            user_id=n.recipient_id,
            event="notification.updated",
            data={
                "notification_id": str(n.id),
                "is_read": bool(n.is_read),
                "read_at": n.read_at.isoformat() if n.read_at else None,
            },
        )
        publish_badges(user_id=n.recipient_id)
    except Exception:
        return


def _push_notification_deleted(*, user_id: str, notification_id: str) -> None:
    try:
        publish_to_user(
            user_id=user_id,
            event="notification.deleted",
            data={"notification_id": str(notification_id)},
        )
        publish_badges(user_id=user_id)
    except Exception:
        return


def _push_notifications_cleared(*, user_id: str, deleted_count: int) -> None:
    try:
        publish_to_user(
            user_id=user_id,
            event="notifications.cleared",
            data={"deleted_count": int(deleted_count or 0)},
        )
        publish_badges(user_id=user_id)
    except Exception:
        return


@require_http_methods(["GET"])
def notifications_list(request):
    auth = _require_authenticated_user(request)
    if auth:
        return auth

    requested_role = _normalize_role(request.GET.get("role"))
    if requested_role and getattr(request.user, "role", None) != requested_role:
        return JsonResponse({"success": False, "error": "Forbidden for role"}, status=403)

    try:
        limit = int(request.GET.get("limit", "50"))
    except ValueError:
        limit = 50
    limit = max(1, min(limit, 200))

    notif_type = request.GET.get("type") or request.GET.get("notification_type")
    unread_only = request.GET.get("unread") in ("1", "true", "True", "yes")

    qs = Notification.objects.filter(recipient=request.user)
    if notif_type:
        qs = qs.filter(notification_type=notif_type)
    if unread_only:
        qs = qs.filter(is_read=False)

    notifs = list(qs.order_by("-created_at")[:limit])
    return JsonResponse([_serialize_notification(n) for n in notifs], safe=False)


@require_http_methods(["POST"])
def mark_notification_read(request, notification_id):
    auth = _require_authenticated_user(request)
    if auth:
        return auth

    try:
        n = Notification.objects.get(id=notification_id, recipient=request.user)
    except Notification.DoesNotExist:
        return JsonResponse({"success": False, "error": "Notification not found"}, status=404)

    if not n.is_read:
        n.is_read = True
        n.read_at = timezone.now()
        n.save(update_fields=["is_read", "read_at"])
        _push_notification_updated(n)

    return JsonResponse({"success": True})


@require_http_methods(["POST"])
def mark_all_notifications_read(request):
    auth = _require_authenticated_user(request)
    if auth:
        return auth

    now = timezone.now()
    updated = Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True, read_at=now)
    if updated:
        try:
            publish_to_user(user_id=request.user.id, event="notifications.all_read", data={"read_at": now.isoformat()})
        except Exception:
            pass
        publish_badges(user_id=request.user.id)
    return JsonResponse({"success": True})


@require_http_methods(["POST"])
def delete_notification(request, notification_id):
    auth = _require_authenticated_user(request)
    if auth:
        return auth

    try:
        n = Notification.objects.get(id=notification_id, recipient=request.user)
    except Notification.DoesNotExist:
        return JsonResponse({"success": False, "error": "Notification not found"}, status=404)

    n_id = str(n.id)
    n.delete()
    _push_notification_deleted(user_id=str(request.user.id), notification_id=n_id)
    return JsonResponse({"success": True})


@require_http_methods(["POST"])
def delete_all_notifications(request):
    auth = _require_authenticated_user(request)
    if auth:
        return auth

    qs = Notification.objects.filter(recipient=request.user)
    deleted_count = qs.count()
    qs.delete()
    _push_notifications_cleared(user_id=str(request.user.id), deleted_count=deleted_count)
    return JsonResponse({"success": True, "deleted_count": deleted_count})


@require_http_methods(["GET"])
def unread_count(request):
    auth = _require_authenticated_user(request)
    if auth:
        return auth

    requested_role = _normalize_role(request.GET.get("role"))
    if requested_role and getattr(request.user, "role", None) != requested_role:
        return JsonResponse({"success": False, "error": "Forbidden for role"}, status=403)

    count = Notification.objects.filter(recipient=request.user, is_read=False).count()
    return JsonResponse({"success": True, "count": count})

# Create your views here.
