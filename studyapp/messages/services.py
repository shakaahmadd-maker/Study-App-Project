from __future__ import annotations

from dataclasses import dataclass

from django.db import transaction

from account.models import User, Student, Teacher
from assingment.models import TeacherAssignment

from .models import Thread, ThreadParticipant


@dataclass(frozen=True)
class ChatEligibility:
    can_initiate: bool
    reason: str | None = None


def _is_teacher_assigned_to_student(student_user: User, teacher_user: User) -> bool:
    if student_user.role != "STUDENT" or teacher_user.role != "TEACHER":
        return False
    try:
        sp = student_user.student_profile
    except Student.DoesNotExist:
        return False
    try:
        tp = teacher_user.teacher_profile
    except Teacher.DoesNotExist:
        return False
    return TeacherAssignment.objects.filter(assignment__student=sp, teacher=tp).exists()


def _is_student_assigned_to_teacher(teacher_user: User, student_user: User) -> bool:
    return _is_teacher_assigned_to_student(student_user=student_user, teacher_user=teacher_user)


def can_initiate_direct_thread(initiator: User, target: User) -> ChatEligibility:
    if initiator.id == target.id:
        return ChatEligibility(False, "You cannot start a conversation with yourself.")
    if not initiator.is_active or not target.is_active:
        return ChatEligibility(False, "User is inactive.")

    # CS-Rep can initiate with everyone
    if initiator.role == "CS_REP":
        return ChatEligibility(True)

    # Admin can initiate with everyone
    if initiator.role == "ADMIN":
        return ChatEligibility(True)

    # Students: only assigned teachers. Admin/CS-Rep can message students if THEY initiate.
    if initiator.role == "STUDENT":
        if target.role == "TEACHER" and _is_teacher_assigned_to_student(initiator, target):
            return ChatEligibility(True)
        return ChatEligibility(False, "Students can only start chats with assigned teachers.")

    # Teachers: assigned students + admins. CS-Rep only if CS-Rep initiates.
    if initiator.role == "TEACHER":
        if target.role == "STUDENT" and _is_student_assigned_to_teacher(initiator, target):
            return ChatEligibility(True)
        if target.role == "ADMIN":
            return ChatEligibility(True)
        if target.role == "CS_REP":
            return ChatEligibility(False, "Teachers can chat with CS-Reps only when CS-Reps initiate the chat.")
        return ChatEligibility(False, "Not allowed.")

    return ChatEligibility(False, "Not allowed.")


def can_participate(user: User, thread: Thread) -> bool:
    return ThreadParticipant.objects.filter(thread=thread, user=user).exists()


@transaction.atomic
def get_or_create_direct_thread(*, initiator: User, target: User) -> tuple[Thread, bool]:
    """
    Creates or returns the unique direct thread between initiator and target.
    Creation enforces initiation rules.
    """
    eligibility = can_initiate_direct_thread(initiator, target)
    if not eligibility.can_initiate:
        raise PermissionError(eligibility.reason or "Not allowed to start this conversation.")

    direct_key = Thread.make_direct_key(initiator.id, target.id)
    thread, created = Thread.objects.get_or_create(
        direct_key=direct_key,
        defaults={"thread_type": Thread.TYPE_DIRECT, "created_by": initiator},
    )

    # Ensure participants exist
    ThreadParticipant.objects.get_or_create(thread=thread, user=initiator)
    ThreadParticipant.objects.get_or_create(thread=thread, user=target)

    return thread, created

