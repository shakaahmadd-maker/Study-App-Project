from rest_framework import serializers
from .models import Meeting
from account.models import User
from account.utils import generate_masked_link

class UserBriefSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'full_name', 'role', 'profile_picture']
        
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"

class MeetingSerializer(serializers.ModelSerializer):
    host_details = UserBriefSerializer(source='host', read_only=True)
    student_details = UserBriefSerializer(source='student', read_only=True)
    teacher_details = UserBriefSerializer(source='teacher', read_only=True)
    masked_recording_url = serializers.SerializerMethodField()
    masked_join_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Meeting
        fields = [
            'id', 'title', 'agenda', 'scheduled_at', 'host', 'student', 'teacher',
            'status', 'room_name', 'actual_start', 'actual_end', 'duration_minutes',
            'recording', 'created_at', 'updated_at', 'host_details', 'student_details', 'teacher_details',
            'masked_recording_url', 'masked_join_url'
        ]
        read_only_fields = ['id', 'status', 'room_name', 'actual_start', 'actual_end', 'duration_minutes', 'recording', 'created_at', 'updated_at']
        
    def get_masked_recording_url(self, obj):
        request = self.context.get('request')
        if request and request.user.role == 'TEACHER' and obj.recording:
            return generate_masked_link(request.user, obj.recording.url, 'recording')
        return obj.recording.url if obj.recording else None

    def get_masked_join_url(self, obj):
        request = self.context.get('request')
        if request and request.user.role == 'TEACHER':
            from django.urls import reverse
            target = f"{reverse('meeting:prejoin')}?meeting_id={obj.id}"
            return generate_masked_link(request.user, target, 'meeting')
        return None

