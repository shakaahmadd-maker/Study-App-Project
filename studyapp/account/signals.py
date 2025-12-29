import random
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, Student, Teacher, CSRep, Admin, UserNotificationSettings


from django.utils import timezone

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Automatically create role-specific profile when a user is created.
    """
    if created:
        if instance.role == 'STUDENT':
            # Generate unique 4-digit student_id
            student_id = generate_unique_student_id()
            Student.objects.create(user=instance, student_id=student_id, updated_at=timezone.now())
        elif instance.role == 'TEACHER':
            # Generate unique 4-digit teacher_id
            teacher_id = generate_unique_teacher_id()
            Teacher.objects.create(user=instance, teacher_id=teacher_id, updated_at=timezone.now())
        elif instance.role == 'CS_REP':
            CSRep.objects.create(user=instance, updated_at=timezone.now())
        elif instance.role == 'ADMIN':
            Admin.objects.create(user=instance, updated_at=timezone.now())

        # Create notification settings for all users
        UserNotificationSettings.objects.create(user=instance)


def generate_unique_student_id():
    """
    Generate a unique 4-digit student ID (1000-9999).
    Ensures no collisions by checking existing IDs.
    """
    max_attempts = 1000  # Prevent infinite loop
    attempts = 0
    
    while attempts < max_attempts:
        # Generate a random 4-digit number (1000-9999)
        student_id = random.randint(1000, 9999)
        
        # Check if this ID already exists
        if not Student.objects.filter(student_id=student_id).exists():
            return student_id
        
        attempts += 1
    
    # Fallback: if we can't find a unique ID in 1000 attempts,
    # try sequential search from 1000
    for i in range(1000, 10000):
        if not Student.objects.filter(student_id=i).exists():
            return i
    
    # Last resort: raise an error if we somehow exhaust all possibilities
    raise ValueError("Unable to generate unique student_id. Database may be full.")


def generate_unique_teacher_id():
    """
    Generate a unique 4-digit teacher ID (1000-9999).
    Ensures no collisions by checking existing IDs.
    """
    max_attempts = 1000
    attempts = 0
    
    while attempts < max_attempts:
        teacher_id = random.randint(1000, 9999)
        if not Teacher.objects.filter(teacher_id=teacher_id).exists():
            return teacher_id
        attempts += 1
    
    for i in range(1000, 10000):
        if not Teacher.objects.filter(teacher_id=i).exists():
            return i
    
    raise ValueError("Unable to generate unique teacher_id. Database may be full.")

