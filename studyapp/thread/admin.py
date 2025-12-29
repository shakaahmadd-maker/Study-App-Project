from django.contrib import admin
from .models import Thread, ThreadParticipant, ThreadMessage, ThreadAttachment

@admin.register(Thread)
class ThreadAdmin(admin.ModelAdmin):
    list_display = ('subject', 'thread_type', 'status', 'created_by', 'created_at')
    list_filter = ('thread_type', 'status')
    search_fields = ('subject', 'created_by__email')

@admin.register(ThreadParticipant)
class ThreadParticipantAdmin(admin.ModelAdmin):
    list_display = ('thread', 'user', 'joined_at')
    list_filter = ('thread',)

class ThreadAttachmentInline(admin.TabularInline):
    model = ThreadAttachment
    extra = 0

@admin.register(ThreadMessage)
class ThreadMessageAdmin(admin.ModelAdmin):
    list_display = ('thread', 'sender', 'is_system_message', 'created_at')
    list_filter = ('is_system_message', 'thread')
    inlines = [ThreadAttachmentInline]
