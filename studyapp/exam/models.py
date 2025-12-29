import uuid
from django.db import models
from django.conf import settings
from account.models import Student, Teacher, User
from assingment.models import Assignment

class Exam(models.Model):
    EXAM_TYPE_CHOICES = [
        ('mcq', 'Multiple Choice Questions (MCQ)'),
        ('qa', 'Question & Answer (Q&A)'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='created_exams')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='exams')
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='exams')
    exam_type = models.CharField(max_length=10, choices=EXAM_TYPE_CHOICES)
    deadline = models.DateTimeField()
    is_time_sensitive = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'exams'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.student.user.get_full_name()}"

class Question(models.Model):
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField()
    order = models.IntegerField(default=0)
    minutes = models.IntegerField(default=0, blank=True, null=True)
    seconds = models.IntegerField(default=30, blank=True, null=True)

    class Meta:
        db_table = 'exam_questions'
        ordering = ['order']

    def __str__(self):
        return f"Q: {self.text[:50]}..."

class Option(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    class Meta:
        db_table = 'exam_options'

    def __str__(self):
        return self.text

class ExamAttempt(models.Model):
    STATUS_CHOICES = [
        ('in-progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('graded', 'Graded'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='attempts')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='exam_attempts')
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    score = models.FloatField(null=True, blank=True) # For MCQ (percentage)
    total_grade = models.FloatField(null=True, blank=True) # For Q&A
    overall_feedback = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in-progress')

    class Meta:
        db_table = 'exam_attempts'

    def __str__(self):
        return f"{self.student.user.get_full_name()} - {self.exam.title}"

class Answer(models.Model):
    attempt = models.ForeignKey(ExamAttempt, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='answers')
    selected_option = models.ForeignKey(Option, on_delete=models.CASCADE, null=True, blank=True) # For MCQ
    answer_text = models.TextField(blank=True, null=True) # For Q&A
    grade = models.FloatField(null=True, blank=True) # For Q&A
    feedback = models.TextField(blank=True, null=True) # For Q&A

    class Meta:
        db_table = 'exam_answers'
