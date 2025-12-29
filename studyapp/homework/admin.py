from django.contrib import admin
from .models import Homework, HomeworkSubmission, HomeworkFile

@admin.register(Homework)
class HomeworkAdmin(admin.ModelAdmin):
    list_display = ('title', 'teacher', 'student', 'status', 'due_date', 'created_at')
    list_filter = ('status', 'due_date', 'created_at')
    search_fields = ('title', 'teacher__user__email', 'student__user__email')
    ordering = ('-created_at',)

@admin.register(HomeworkSubmission)
class HomeworkSubmissionAdmin(admin.ModelAdmin):
    list_display = ('homework', 'submitted_at')
    search_fields = ('homework__title', 'homework__student__user__email')

@admin.register(HomeworkFile)
class HomeworkFileAdmin(admin.ModelAdmin):
    list_display = ('file_name', 'file_type', 'uploaded_by', 'created_at')
    list_filter = ('file_type', 'created_at')
    search_fields = ('file_name', 'uploaded_by__email')
