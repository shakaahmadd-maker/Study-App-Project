from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Student, Teacher, CSRep, Admin


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Custom admin interface for User model.
    """
    list_display = ('email', 'username', 'role', 'first_name', 'last_name', 'is_active', 'is_staff', 'created_at')
    list_filter = ('role', 'is_active', 'is_staff', 'created_at')
    search_fields = ('email', 'username', 'first_name', 'last_name')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    
    fieldsets = (
        (None, {'fields': ('id', 'email', 'username', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'profile_picture')}),
        ('Permissions', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('created_at', 'updated_at', 'last_login')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'password1', 'password2', 'role', 'is_staff', 'is_superuser'),
        }),
    )
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  # Editing an existing object
            return self.readonly_fields + ('id',)
        return self.readonly_fields


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    """
    Admin interface for Student profile.
    """
    list_display = ('student_id', 'user', 'phone', 'timezone', 'created_at')
    list_filter = ('timezone', 'created_at')
    search_fields = ('student_id', 'user__email', 'user__first_name', 'user__last_name', 'phone')
    readonly_fields = ('student_id', 'created_at')
    ordering = ('student_id',)


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    """
    Admin interface for Teacher profile.
    """
    list_display = ('user', 'expertise', 'rating', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('user__email', 'user__first_name', 'user__last_name', 'expertise', 'qualifications')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)


@admin.register(CSRep)
class CSRepAdmin(admin.ModelAdmin):
    """
    Admin interface for CS-Rep profile.
    """
    list_display = ('user', 'created_at')
    search_fields = ('user__email', 'user__first_name', 'user__last_name')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)


@admin.register(Admin)
class AdminProfileAdmin(admin.ModelAdmin):
    """
    Admin interface for Admin profile.
    """
    list_display = ('user', 'access_level', 'created_at')
    list_filter = ('access_level', 'created_at')
    search_fields = ('user__email', 'user__first_name', 'user__last_name')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
