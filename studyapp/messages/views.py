from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import Q
from django.db.models import Prefetch
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone

from account.models import User, Student, Teacher

from .models import Message, MessageAttachment, Thread, ThreadParticipant
from .presence import is_online
from .services import can_initiate_direct_thread, get_or_create_direct_thread
from realtime.services import publish_badges


def _json_error(message: str, status: int = 400, **extra):
    payload = {"success": False, "error": message}
    payload.update(extra)
    return JsonResponse(payload, status=status)


def _json_ok(**data):
    payload = {"success": True}
    payload.update(data)
    return JsonResponse(payload)


def _user_avatar_url(request, user: User) -> str | None:
    if getattr(user, "profile_picture", None) and getattr(user.profile_picture, "url", None):
        return request.build_absolute_uri(user.profile_picture.url)
    return None


def _serialize_user(request, user: User) -> dict:
    name = user.get_full_name() or user.email
    display_id = None
    try:
        if user.role == "STUDENT" and hasattr(user, "student_profile"):
            display_id = str(user.student_profile.student_id).zfill(4)
        elif user.role == "TEACHER" and hasattr(user, "teacher_profile") and user.teacher_profile.teacher_id:
            display_id = str(user.teacher_profile.teacher_id).zfill(4)
    except Exception:
        display_id = None
    if not display_id:
        # Fallback: short UUID
        display_id = str(user.id).split("-")[0]
    return {
        "id": str(user.id),
        "name": name,
        "email": user.email,
        "role": user.role,
        "display_id": display_id,
        "avatar_url": _user_avatar_url(request, user),
    }


def _assigned_teacher_user_ids_for_student(student_user: User):
    try:
        sp = student_user.student_profile
    except Student.DoesNotExist:
        return User.objects.none()
    return (
        User.objects.filter(
            teacher_profile__assigned_tasks__assignment__student=sp,
        )
        .distinct()
        .values_list("id", flat=True)
    )


def _assigned_student_user_ids_for_teacher(teacher_user: User):
    try:
        tp = teacher_user.teacher_profile
    except Teacher.DoesNotExist:
        return User.objects.none()
    return (
        User.objects.filter(
            student_profile__assignments__teacher_assignments__teacher=tp,
        )
        .distinct()
        .values_list("id", flat=True)
    )


@login_required
def allowed_users_api(request):
    """
    Returns users the current user is allowed to START a new direct thread with.
    """
    user: User = request.user
    q = (request.GET.get("q") or "").strip().lower()
    role_filter = (request.GET.get("role") or "").strip().upper()  # optional

    qs = User.objects.filter(is_active=True).exclude(id=user.id)
    if role_filter in {"STUDENT", "TEACHER", "CS_REP", "ADMIN"}:
        qs = qs.filter(role=role_filter)

    if user.role == "ADMIN" or user.role == "CS_REP":
        pass
    elif user.role == "STUDENT":
        qs = qs.filter(id__in=_assigned_teacher_user_ids_for_student(user))
    elif user.role == "TEACHER":
        # Assigned students + admins
        qs = qs.filter(Q(id__in=_assigned_student_user_ids_for_teacher(user)) | Q(role="ADMIN"))
    else:
        return _json_error("Unsupported role.", status=403)

    if q:
        qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(email__icontains=q))

    users = [_serialize_user(request, u) for u in qs.order_by("role", "first_name", "last_name")[:200]]
    return _json_ok(users=users)


@login_required
def list_threads_api(request):
    user: User = request.user

    participants_qs = ThreadParticipant.objects.filter(user=user).select_related("thread")
    thread_ids = participants_qs.values_list("thread_id", flat=True)

    threads = (
        Thread.objects.filter(id__in=thread_ids)
        .prefetch_related(
            Prefetch(
                "participants",
                queryset=ThreadParticipant.objects.select_related("user"),
            ),
        )
        .order_by("-last_message_at", "-updated_at")[:200]
    )

    data = []
    for thread in threads:
        other = None
        my_part = None
        other_part = None
        for p in thread.participants.all():
            if p.user_id == user.id:
                my_part = p
            else:
                other = p.user
                other_part = p

        if not other or not my_part:
            continue

        last_msg = (
            Message.objects.filter(thread=thread)
            .select_related("sender")
            .order_by("-created_at")
            .first()
        )

        # Unread count based on last_read_at cursor
        cursor = my_part.last_read_at or my_part.joined_at
        unread_count = (
            Message.objects.filter(thread=thread, created_at__gt=cursor)
            .exclude(sender=user)
            .count()
        )

        data.append(
            {
                "id": str(thread.id),
                "other_user": _serialize_user(request, other),
                "other_last_read_at": other_part.last_read_at.isoformat() if other_part and other_part.last_read_at else None,
                "other_user_online": is_online(other.id),
                "last_message": (
                    {
                        "id": str(last_msg.id),
                        "sender_id": str(last_msg.sender_id),
                        "content": last_msg.content,
                        "created_at": last_msg.created_at.isoformat(),
                    }
                    if last_msg
                    else None
                ),
                "unread_count": unread_count,
                "last_message_at": thread.last_message_at.isoformat() if thread.last_message_at else None,
            }
        )

    return _json_ok(threads=data)


@login_required
def thread_messages_api(request, thread_id):
    user: User = request.user
    thread = get_object_or_404(Thread, id=thread_id)
    if not ThreadParticipant.objects.filter(thread=thread, user=user).exists():
        return _json_error("You do not have access to this conversation.", status=403)

    limit = int(request.GET.get("limit") or 50)
    limit = max(1, min(limit, 200))

    qs = (
        Message.objects.filter(thread=thread)
        .select_related("sender")
        .prefetch_related("attachments")
        .order_by("-created_at")[:limit]
    )

    messages = []
    for m in reversed(list(qs)):
        messages.append(
            {
                "id": str(m.id),
                "thread_id": str(thread.id),
                "sender": _serialize_user(request, m.sender),
                "content": m.content,
                "created_at": m.created_at.isoformat(),
                "attachments": [
                    {
                        "id": str(a.id),
                        "url": request.build_absolute_uri(a.file.url),
                        "name": a.original_name,
                        "content_type": a.content_type,
                        "size_bytes": a.size_bytes,
                        "duration_ms": a.duration_ms,
                    }
                    for a in m.attachments.all()
                ],
            }
        )

    return _json_ok(messages=messages)


@login_required
def create_direct_thread_api(request):
    if request.method != "POST":
        return _json_error("Method not allowed.", status=405)

    user: User = request.user
    target_user_id = (request.POST.get("target_user_id") or "").strip()
    if not target_user_id:
        return _json_error("target_user_id is required.", status=400)

    try:
        target = User.objects.get(id=target_user_id, is_active=True)
    except User.DoesNotExist:
        return _json_error("User not found.", status=404)

    # If thread already exists between the two users, return it even if user can't initiate
    direct_key = Thread.make_direct_key(user.id, target.id)
    existing = Thread.objects.filter(direct_key=direct_key).first()
    if existing and ThreadParticipant.objects.filter(thread=existing, user=user).exists():
        return _json_ok(thread={"id": str(existing.id), "other_user": _serialize_user(request, target)}, created=False)

    eligibility = can_initiate_direct_thread(user, target)
    if not eligibility.can_initiate:
        return _json_error(eligibility.reason or "Not allowed.", status=403)

    try:
        thread, created = get_or_create_direct_thread(initiator=user, target=target)
    except PermissionError as e:
        return _json_error(str(e), status=403)

    # Notify target via websocket group (best-effort)
    _broadcast_conversation_created(thread_id=thread.id, target_user_id=target.id, actor=user)

    # Badge counts (best-effort): creating a thread can affect thread list + counters.
    try:
        publish_badges(user_id=user.id)
        publish_badges(user_id=target.id)
    except Exception:
        pass

    return _json_ok(thread={"id": str(thread.id), "other_user": _serialize_user(request, target)}, created=created)


def _validate_upload(f) -> tuple[bool, str | None]:
    max_size = 25 * 1024 * 1024  # 25MB
    if f.size > max_size:
        return False, "File too large (max 25MB)."
    return True, None


@login_required
@transaction.atomic
def send_message_api(request, thread_id):
    if request.method != "POST":
        return _json_error("Method not allowed.", status=405)

    user: User = request.user
    thread = get_object_or_404(Thread, id=thread_id)
    if not ThreadParticipant.objects.filter(thread=thread, user=user).exists():
        return _json_error("You do not have access to this conversation.", status=403)

    text = (request.POST.get("content") or "").strip()
    files = request.FILES.getlist("files")

    if not text and not files:
        return _json_error("Message content or attachments are required.", status=400)

    for f in files:
        ok, err = _validate_upload(f)
        if not ok:
            return _json_error(err or "Invalid upload.", status=400)

    msg = Message(thread=thread, sender=user, content=text)
    if files:
        msg._has_attachments = True  # for model validation
    msg.full_clean()
    msg.save()

    attachments = []
    for f in files:
        att = MessageAttachment.objects.create(
            message=msg,
            file=f,
            original_name=f.name,
            content_type=getattr(f, "content_type", "") or "",
            size_bytes=f.size or 0,
        )
        attachments.append(att)

    # Update thread cursors
    now = msg.created_at
    Thread.objects.filter(id=thread.id).update(last_message_at=now, updated_at=timezone.now())
    ThreadParticipant.objects.filter(thread=thread, user=user).update(last_read_at=now)

    payload = {
        "id": str(msg.id),
        "thread_id": str(thread.id),
        "sender": _serialize_user(request, user),
        "content": msg.content,
        "created_at": msg.created_at.isoformat(),
        "attachments": [
            {
                "id": str(a.id),
                "url": request.build_absolute_uri(a.file.url),
                "name": a.original_name,
                "content_type": a.content_type,
                "size_bytes": a.size_bytes,
                "duration_ms": a.duration_ms,
            }
            for a in attachments
        ],
    }

    _broadcast_message(thread_id=thread.id, message=payload, actor=user)

    # Badge counts: recipient(s) now have new unread messages; sender might also change in edge cases.
    try:
        participant_ids = list(
            ThreadParticipant.objects.filter(thread=thread).values_list("user_id", flat=True)
        )
        for uid in participant_ids:
            publish_badges(user_id=uid)
    except Exception:
        pass

    return _json_ok(message=payload)


@login_required
def mark_thread_read_api(request, thread_id):
    if request.method != "POST":
        return _json_error("Method not allowed.", status=405)

    user: User = request.user
    thread = get_object_or_404(Thread, id=thread_id)
    now = timezone.now()
    updated = ThreadParticipant.objects.filter(thread=thread, user=user).update(last_read_at=now)
    if not updated:
        return _json_error("You do not have access to this conversation.", status=403)

    # Broadcast read receipt to the thread (best-effort)
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"thread_{thread.id}",
                {
                    "type": "chat.read",
                    "thread_id": str(thread.id),
                    "reader_id": str(user.id),
                    "read_at": now.isoformat(),
                },
            )
    except Exception:
        pass

    # Badge counts: unread reduced for this user
    try:
        publish_badges(user_id=user.id)
    except Exception:
        pass

    return _json_ok()


@login_required
@transaction.atomic
def delete_thread_api(request, thread_id):
    """
    Deletes a direct conversation for BOTH participants.

    Allowed: Admin / Teacher / CS-Rep participants only. (Students cannot delete.)
    """
    if request.method != "POST":
        return _json_error("Method not allowed.", status=405)

    user: User = request.user
    if user.role == "STUDENT":
        return _json_error("Students cannot delete conversations.", status=403)

    thread = get_object_or_404(Thread, id=thread_id)
    if not ThreadParticipant.objects.filter(thread=thread, user=user).exists():
        return _json_error("You do not have access to this conversation.", status=403)

    # Capture participant IDs before deletion (for best-effort broadcasts)
    participant_ids = list(ThreadParticipant.objects.filter(thread=thread).values_list("user_id", flat=True))

    thread.delete()

    # Broadcast deletion (best-effort)
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if channel_layer:
            # Thread group (connected participants)
            async_to_sync(channel_layer.group_send)(
                f"thread_{thread_id}",
                {"type": "chat.thread_deleted", "thread_id": str(thread_id), "actor_id": str(user.id)},
            )
            # User groups (so clients can drop it even if not currently subscribed)
            for uid in participant_ids:
                async_to_sync(channel_layer.group_send)(
                    f"user_{uid}",
                    {"type": "chat.thread_deleted", "thread_id": str(thread_id), "actor_id": str(user.id)},
                )
    except Exception:
        pass

    # Badge counts: thread removed for both participants
    try:
        for uid in participant_ids:
            publish_badges(user_id=uid)
    except Exception:
        pass

    return _json_ok()


def _broadcast_message(*, thread_id, message: dict, actor: User):
    """
    Best-effort: broadcast message to websocket group for the thread.
    """
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        async_to_sync(channel_layer.group_send)(
            f"thread_{thread_id}",
            {"type": "chat.message", "message": message, "actor_id": str(actor.id)},
        )
    except Exception:
        # Never block the HTTP request on broadcast failures.
        return


def _broadcast_conversation_created(*, thread_id, target_user_id, actor: User):
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        async_to_sync(channel_layer.group_send)(
            f"user_{target_user_id}",
            {"type": "chat.thread_created", "thread_id": str(thread_id), "actor_id": str(actor.id)},
        )
    except Exception:
        return
