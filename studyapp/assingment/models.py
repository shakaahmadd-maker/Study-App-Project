from django.db import models
from django.conf import settings
from account.models import Student, Teacher, User
import uuid

class Assignment(models.Model):
    SERVICE_TYPE_CHOICES = [
        ('assignment', 'Assignment Solution'),
        ('solve-paper', 'Solve Online Paper'),
        ('do-exam', 'Do My Exam'),
        ('it-projects', 'IT Projects'),
        ('writing', 'Writing (All Types)'),
    ]

    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('assigned', 'Assigned'),
        ('in-process', 'In Process'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('on-hold', 'On Hold'),
        ('deleted', 'Deleted'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment_code = models.CharField(max_length=50, unique=True, db_index=True)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='assignments')
    title = models.CharField(max_length=255)
    service_type = models.CharField(max_length=50, choices=SERVICE_TYPE_CHOICES)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    due_date = models.DateTimeField(null=True, blank=True)
    exam_date = models.DateTimeField(null=True, blank=True) # For exams
    description = models.TextField()
    
    # Writing specific
    writing_type = models.CharField(max_length=100, blank=True, null=True)
    num_pages = models.IntegerField(null=True, blank=True)
    
    # Online paper specific
    online_paper_type = models.CharField(max_length=100, blank=True, null=True)
    other_paper_type = models.CharField(max_length=100, blank=True, null=True)
    
    # Additional features stored as JSON
    additional_features = models.JSONField(default=list, blank=True)
    
    # Mark Complete info (from Teacher)
    completion_notes = models.TextField(blank=True, null=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'assignments'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.assignment_code} - {self.title}"

    def delete(self, using=None, keep_parents=False):
        """
        Override delete to prevent actual deletion from database.
        Assignments should NEVER be deleted from the database for record-keeping purposes.
        Instead, mark as 'deleted' status (soft delete).
        """
        # Only allow soft delete - set status to 'deleted'
        if self.status != 'deleted':
            self.status = 'deleted'
            self.save(using=using)
        # Do NOT call super().delete() - this prevents actual database deletion
        # This ensures assignments are always retained in the database
    
    def hard_delete(self):
        """
        This method is intentionally disabled.
        Assignments should never be permanently deleted from the database.
        """
        raise PermissionError("Assignments cannot be permanently deleted. Use soft delete (status='deleted') instead.")

    @classmethod
    def generate_assignment_code(cls, student):
        """
        Generates a unique assignment code: {Initials}-{StudentID}-{Sequence}
        Example: AJ-0001-0001
        """
        user = student.user
        initials = "".join([n[0] for n in user.get_full_name().split() if n]).upper()
        if not initials:
            initials = "ST"
        
        student_id_str = str(student.student_id).zfill(4)
        
        # Count existing assignments for this student to get sequence
        count = cls.objects.filter(student=student).count() + 1
        sequence = str(count).zfill(4)
        
        return f"{initials}-{student_id_str}-{sequence}"

class TeacherAssignment(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='teacher_assignments')
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='assigned_tasks')
    is_helper = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    assigned_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'teacher_assignments'
        unique_together = ('assignment', 'teacher')

    def __str__(self):
        return f"{self.teacher.user.get_full_name()} -> {self.assignment.assignment_code}"

class AssignmentFile(models.Model):
    FILE_TYPE_CHOICES = [
        ('support', 'Supporting Document'),
        ('solution', 'Solution'),
        ('proof', 'Proof of Attempt'),
        ('result', 'Result Report'),
    ]

    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='files')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    file = models.FileField(upload_to='assignment_files/')
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20, choices=FILE_TYPE_CHOICES, default='support')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'assignment_files'

    def __str__(self):
        return f"{self.file_name} ({self.get_file_type_display()})"

class AssignmentFeedback(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='feedbacks')
    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='given_feedbacks')
    to_teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='received_feedbacks')
    message = models.TextField()
    priority = models.CharField(max_length=20, default='normal') # normal, high, urgent
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'assignment_feedbacks'
        ordering = ['-created_at']

    def __str__(self):
        return f"Feedback for {self.assignment.assignment_code} to {self.to_teacher.user.get_full_name()}"
