import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
import django.utils.timezone
from django.utils import timezone
from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model with UUID primary key and role-based authentication.
    """
    
    ROLE_CHOICES = [
        ('STUDENT', 'Student'),
        ('TEACHER', 'Teacher'),
        ('CS_REP', 'CS-Rep'),
        ('ADMIN', 'Admin'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    username = models.CharField(max_length=150, unique=True, db_index=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='STUDENT')
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"
    
    def get_full_name(self):
        """Return the full name of the user."""
        return f"{self.first_name} {self.last_name}".strip() or self.email
    
    def get_short_name(self):
        """Return the short name of the user."""
        return self.first_name or self.email


class Student(models.Model):
    """
    Student profile model with 4-digit unique student_id.
    """
    student_id = models.IntegerField(unique=True, db_index=True, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    phone = models.CharField(max_length=20, blank=True, null=True)
    timezone = models.CharField(max_length=50, default='UTC')
    created_at = models.DateTimeField(default=django.utils.timezone.now) # ai do not update this field as it's correctly working with my project
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'students'
        verbose_name = 'Student'
        verbose_name_plural = 'Students'
        ordering = ['student_id']
    
    def __str__(self):
        return f"Student {self.student_id} - {self.user.get_full_name()}"


class Teacher(models.Model):
    """
    Teacher profile model.
    """
    teacher_id = models.IntegerField(unique=True, db_index=True, editable=False, null=True)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='teacher_profile')
    suffix = models.CharField(max_length=20, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    title = models.CharField(max_length=100, blank=True, null=True)
    primary_subject = models.CharField(max_length=100, blank=True, null=True)
    qualifications = models.TextField(blank=True, null=True)
    expertise = models.CharField(max_length=255, blank=True, null=True)
    years_of_experience = models.IntegerField(default=0, blank=True, null=True)
    experience_details = models.TextField(blank=True, null=True)
    bio = models.TextField(blank=True, null=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'teachers'
        verbose_name = 'Teacher'
        verbose_name_plural = 'Teachers'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Teacher - {self.user.get_full_name()}"


class CSRep(models.Model):
    """
    CS-Rep profile model.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='csrep_profile')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'cs_reps'
        verbose_name = 'CS-Rep'
        verbose_name_plural = 'CS-Reps'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"CS-Rep - {self.user.get_full_name()}"


class Admin(models.Model):
    """
    Admin profile model.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='admin_profile')
    access_level = models.CharField(max_length=50, default='full')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'admins'
        verbose_name = 'Admin'
        verbose_name_plural = 'Admins'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Admin - {self.user.get_full_name()}"


class MaskedLink(models.Model):
    """
    Stores tokenized links for teachers to mask real URLs and IDs.
    """
    token = models.CharField(max_length=255, unique=True, db_index=True)
    target_url = models.TextField()
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    link_type = models.CharField(max_length=50, blank=True, null=True) # e.g., 'meeting', 'recording', 'invoice'

    class Meta:
        db_table = 'masked_links'
        verbose_name = 'Masked Link'
        verbose_name_plural = 'Masked Links'

    def is_valid(self):
        return timezone.now() < self.expires_at

    def __str__(self):
        return f"Masked Link for {self.user.email} - {self.link_type}"


class TeacherFeedback(models.Model):
    """
    Feedback submitted by teachers about students.
    """
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='submitted_feedbacks')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='received_teacher_feedbacks')
    feedback_type = models.CharField(max_length=100)
    subject = models.CharField(max_length=255)
    message = models.TextField()
    priority = models.CharField(max_length=20, default='normal') # normal, high, urgent
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'teacher_feedbacks'
        verbose_name = 'Teacher Feedback'
        verbose_name_plural = 'Teacher Feedbacks'
        ordering = ['-created_at']

    def __str__(self):
        return f"Feedback from {self.teacher.user.get_full_name()} about {self.student.user.get_full_name()}"


class TeacherReport(models.Model):
    """
    Structured reports submitted by teachers about students.
    """
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='submitted_reports')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='received_teacher_reports')
    report_type = models.CharField(max_length=100)
    title = models.CharField(max_length=255)
    description = models.TextField()
    severity = models.CharField(max_length=20, default='normal') # normal, high, critical
    report_date = models.DateField(default=timezone.now)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'teacher_reports'
        verbose_name = 'Teacher Report'
        verbose_name_plural = 'Teacher Reports'
        ordering = ['-created_at']

    def __str__(self):
        return f"Report from {self.teacher.user.get_full_name()} about {self.student.user.get_full_name()}"


class UserNotificationSettings(models.Model):
    """
    User notification and reminder preferences for all roles.
    Stores granular settings for different types of notifications.
    """

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='notification_settings')

    # Email notifications
    email_notifications = models.BooleanField(default=True)

    # Push/browser notifications
    push_notifications = models.BooleanField(default=True)

    # Desktop notifications
    desktop_notifications = models.BooleanField(default=False)

    # Sound alerts
    sound_alerts = models.BooleanField(default=False)

    # Role-specific notification settings

    # Student notifications
    student_messages = models.BooleanField(default=True)  # Teacher messages to student
    announcements = models.BooleanField(default=True)    # School announcements
    assignment_updates = models.BooleanField(default=True)  # Assignment status changes
    meeting_reminders = models.BooleanField(default=True)   # Meeting notifications
    grade_notifications = models.BooleanField(default=True)  # Grade postings

    # Teacher notifications
    teacher_messages = models.BooleanField(default=True)    # Student messages to teacher
    new_announcements = models.BooleanField(default=True)   # New announcements
    assignment_submissions = models.BooleanField(default=True)  # Student submissions
    meeting_reminders_teacher = models.BooleanField(default=True)  # Meeting notifications
    grade_submissions = models.BooleanField(default=True)   # Grade submission reminders

    # Admin notifications
    assignment_requests = models.BooleanField(default=True)     # New assignment requests
    invoice_notifications = models.BooleanField(default=True)   # Invoice submissions
    content_review_alerts = models.BooleanField(default=True)   # Content needing review
    system_alerts = models.BooleanField(default=True)           # System maintenance alerts

    # CS-Rep notifications (simple - just enable/disable all)
    csrep_notifications_enabled = models.BooleanField(default=True)

    # Reminder settings

    # Assignment due date reminders
    assignment_due_reminders = models.BooleanField(default=True)

    # Meeting reminders
    meeting_reminders_enabled = models.BooleanField(default=True)
    meeting_reminder_time = models.IntegerField(default=30, choices=[
        (15, '15 minutes before'),
        (30, '30 minutes before'),
        (60, '1 hour before'),
        (1440, '1 day before'),
    ])

    # Grade submission reminders (for teachers)
    grade_submission_reminders = models.BooleanField(default=True)

    # Exam reminders (for students)
    exam_reminders = models.BooleanField(default=True)

    # Invoice payment reminders (for admin)
    payment_reminders = models.BooleanField(default=True)

    # General settings (for admin)
    auto_refresh_dashboard = models.BooleanField(default=True)
    refresh_interval = models.IntegerField(default=10, choices=[
        (5, 'Every 5 minutes'),
        (10, 'Every 10 minutes'),
        (15, 'Every 15 minutes'),
        (30, 'Every 30 minutes'),
    ])
    default_date_range = models.CharField(max_length=10, default='30', choices=[
        ('7', 'Last 7 days'),
        ('30', 'Last 30 days'),
        ('90', 'Last 90 days'),
        ('365', 'Last year'),
    ])

    # Reminder frequency (for admin)
    reminder_frequency = models.CharField(max_length=20, default='weekly', choices=[
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ])

    # Preferred reminder time (for admin)
    reminder_time = models.TimeField(default='09:00')

    # Privacy & Security (for admin)
    two_factor_auth = models.BooleanField(default=False)
    session_timeout = models.CharField(max_length=20, default='60', choices=[
        ('15', '15 minutes'),
        ('30', '30 minutes'),
        ('60', '1 hour'),
        ('120', '2 hours'),
        ('never', 'Never'),
    ])
    activity_log = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_notification_settings'
        verbose_name = 'User Notification Settings'
        verbose_name_plural = 'User Notification Settings'

    def __str__(self):
        return f"Notification settings for {self.user.get_full_name()} ({self.user.get_role_display()})"


class Visitor(models.Model):
    """
    Visitor form submissions from the home page contact form.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField()
    details = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'visitors'
        verbose_name = 'Visitor'
        verbose_name_plural = 'Visitors'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} - {self.email}"