from django.db import models
from account.models import Student, Teacher, User
from assingment.models import Assignment
import uuid

class Homework(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Submission'),
        ('submitted', 'Awaiting Grading'),
        ('graded', 'Graded'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='created_homeworks')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='assigned_homeworks')
    assignment = models.ForeignKey(Assignment, on_delete=models.SET_NULL, null=True, blank=True, related_name='homeworks')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    due_date = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Grading info
    grade = models.CharField(max_length=10, blank=True, null=True)
    grade_percentage = models.IntegerField(null=True, blank=True)
    feedback = models.TextField(blank=True, null=True)
    graded_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'homeworks'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.student.user.get_full_name()}"

class HomeworkSubmission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    homework = models.OneToOneField(Homework, on_delete=models.CASCADE, related_name='submission')
    notes = models.TextField(blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'homework_submissions'

    def __str__(self):
        return f"Submission for {self.homework.title}"

class HomeworkFile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    FILE_TYPE_CHOICES = [
        ('task', 'Task Description'), # Added by teacher (optional for future)
        ('submission', 'Student Submission'), # Added by student
    ]

    homework = models.ForeignKey(Homework, on_delete=models.CASCADE, related_name='files', null=True, blank=True)
    submission = models.ForeignKey(HomeworkSubmission, on_delete=models.CASCADE, related_name='attachments', null=True, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    file = models.FileField(upload_to='homework_files/')
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20, choices=FILE_TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'homework_files'

    def __str__(self):
        return f"{self.file_name} ({self.get_file_type_display()})"
