import json
import uuid
from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.core.exceptions import PermissionDenied
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from .models import Exam, Question, Option, ExamAttempt, Answer
from account.models import Student, Teacher, User
from assingment.models import Assignment, TeacherAssignment
from account.decorators import student_required, teacher_required, admin_required
from realtime.services import publish_to_users

# --- Teacher Views ---

@login_required
@teacher_required
@csrf_exempt
@require_POST
def create_exam_api(request):
    """
    Handle new exam creation from teacher.
    """
    try:
        data = json.loads(request.body)
        student_id = data.get('studentId')
        assignment_id = data.get('assignmentId')
        exam_type = data.get('type')
        deadline = data.get('deadline')
        is_time_sensitive = data.get('is_time_sensitive', False)
        questions_data = data.get('questions', [])

        if not all([student_id, assignment_id, exam_type, deadline]):
            return JsonResponse({'success': False, 'error': 'Missing required fields.'}, status=400)

        teacher = request.user.teacher_profile
        
        # Resolve student
        try:
            student = Student.objects.get(student_id=student_id)
        except (Student.DoesNotExist, ValueError):
            student = get_object_or_404(Student, id=student_id)

        assignment = get_object_or_404(Assignment, id=assignment_id)

        # Create exam
        exam = Exam.objects.create(
            title=assignment.title,
            teacher=teacher,
            student=student,
            assignment=assignment,
            exam_type=exam_type,
            deadline=deadline,
            is_time_sensitive=is_time_sensitive,
            status='pending'
        )

        # Create questions
        for idx, q_data in enumerate(questions_data):
            question = Question.objects.create(
                exam=exam,
                text=q_data.get('question'),
                order=idx,
                minutes=q_data.get('minutes', 0),
                seconds=q_data.get('seconds', 30)
            )

            # Create options for MCQ
            if exam_type == 'mcq':
                options = q_data.get('options', [])
                correct_indices = q_data.get('correctAnswers', [])
                for opt_idx, opt_text in enumerate(options):
                    Option.objects.create(
                        question=question,
                        text=opt_text,
                        is_correct=(opt_idx in correct_indices)
                    )

        # --- Notifications ---
        try:
            from notifications.services import create_notification

            create_notification(
                recipient=student.user,
                actor=request.user,
                notification_type="exam",
                title="New exam assigned",
                message=f"You have a new {exam_type.upper()} exam for '{assignment.title}'.",
                related_entity_type="exam",
                related_entity_id=str(exam.id),
            )
        except Exception:
            pass

        # --- Real-time UI sync (ws/dashboard/) ---
        try:
            payload = {
                "exam_id": str(exam.id),
                "status": exam.status,
                "action": "created",
            }
            publish_to_users(user_ids=[str(student.user_id), str(teacher.user_id)], event="exam.changed", data=payload)
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'message': 'Exam created successfully!',
            'exam_id': str(exam.id)
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@teacher_required
def list_teacher_exams_api(request):
    """
    List all exams created by the current teacher.
    """
    teacher = request.user.teacher_profile
    exams = Exam.objects.filter(teacher=teacher).select_related('student__user', 'assignment').prefetch_related('attempts')
    
    data = []
    for exam in exams:
        # Check if any attempt has results
        latest_attempt = exam.attempts.order_by('-start_time').first()
        results = None
        if latest_attempt and latest_attempt.status in ['submitted', 'graded']:
            results = {
                'id': str(latest_attempt.id),
                'score': latest_attempt.score,
                'totalGrade': latest_attempt.total_grade,
                'status': latest_attempt.status,
                'submittedAt': latest_attempt.end_time.isoformat() if latest_attempt.end_time else None
            }

        data.append({
            'id': str(exam.id),
            'title': exam.title,
            'student': exam.student.user.get_full_name(),
            'studentId': exam.student.student_id,
            'assignment': exam.assignment.title,
            'assignmentId': str(exam.assignment.id),
            'type': exam.exam_type,
            'deadline': exam.deadline.isoformat(),
            'status': exam.status,
            'results': results,
            'createdAt': exam.created_at.isoformat()
        })
    
    return JsonResponse({'success': True, 'exams': data})

@login_required
@teacher_required
@csrf_exempt
@require_POST
def delete_exam_api(request, exam_id):
    """
    Delete an exam.
    """
    exam = get_object_or_404(Exam, id=exam_id, teacher=request.user.teacher_profile)
    student_user_id = str(exam.student.user_id)
    teacher_user_id = str(exam.teacher.user_id)
    exam.delete()
    try:
        publish_to_users(
            user_ids=[student_user_id, teacher_user_id],
            event="exam.changed",
            data={"exam_id": str(exam_id), "status": "deleted", "action": "deleted"},
        )
    except Exception:
        pass
    return JsonResponse({'success': True, 'message': 'Exam deleted successfully.'})

@login_required
def get_exam_details_api(request, exam_id):
    """
    Get detailed information about an exam.
    """
    exam = get_object_or_404(Exam, id=exam_id)
    
    # Permission check
    can_access = False
    if request.user.role == 'ADMIN':
        can_access = True
    elif hasattr(request.user, 'teacher_profile') and exam.teacher == request.user.teacher_profile:
        can_access = True
    elif hasattr(request.user, 'student_profile') and exam.student == request.user.student_profile:
        can_access = True
        
    if not can_access:
        return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)

    questions = []
    for q in exam.questions.all():
        q_data = {
            'id': q.id,
            'question': q.text,
            'minutes': q.minutes,
            'seconds': q.seconds,
        }
        if exam.exam_type == 'mcq':
            options = []
            correct_answers = []
            for idx, opt in enumerate(q.options.all()):
                options.append(opt.text)
                if opt.is_correct:
                    correct_answers.append(idx)
            q_data['options'] = options
            q_data['correctAnswers'] = correct_answers
        questions.append(q_data)

    data = {
        'id': str(exam.id),
        'title': exam.title,
        'student': exam.student.user.get_full_name(),
        'studentId': exam.student.student_id,
        'assignment': exam.assignment.title,
        'assignmentId': str(exam.assignment.id),
        'type': exam.exam_type,
        'deadline': exam.deadline.isoformat(),
        'is_time_sensitive': exam.is_time_sensitive,
        'status': exam.status,
        'questions': questions
    }
    
    return JsonResponse({'success': True, 'exam': data})

@login_required
@teacher_required
@csrf_exempt
@require_POST
def update_exam_api(request, exam_id):
    """
    Update an existing exam.
    """
    try:
        exam = get_object_or_404(Exam, id=exam_id, teacher=request.user.teacher_profile)
        data = json.loads(request.body)
        
        exam.exam_type = data.get('type', exam.exam_type)
        exam.deadline = data.get('deadline', exam.deadline)
        exam.is_time_sensitive = data.get('is_time_sensitive', exam.is_time_sensitive)
        exam.save()

        # Update questions (simple approach: delete and recreate)
        exam.questions.all().delete()
        questions_data = data.get('questions', [])
        for idx, q_data in enumerate(questions_data):
            question = Question.objects.create(
                exam=exam,
                text=q_data.get('question'),
                order=idx,
                minutes=q_data.get('minutes', 0),
                seconds=q_data.get('seconds', 30)
            )

            if exam.exam_type == 'mcq':
                options = q_data.get('options', [])
                correct_indices = q_data.get('correctAnswers', [])
                for opt_idx, opt_text in enumerate(options):
                    Option.objects.create(
                        question=question,
                        text=opt_text,
                        is_correct=(opt_idx in correct_indices)
                    )

        try:
            publish_to_users(
                user_ids=[str(exam.student.user_id), str(exam.teacher.user_id)],
                event="exam.changed",
                data={"exam_id": str(exam.id), "status": exam.status, "action": "updated"},
            )
        except Exception:
            pass
        return JsonResponse({'success': True, 'message': 'Exam updated successfully!'})

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@teacher_required
@csrf_exempt
@require_POST
def grade_exam_api(request, attempt_id):
    """
    Grade a Q&A exam attempt.
    """
    try:
        attempt = get_object_or_404(ExamAttempt, id=attempt_id, exam__teacher=request.user.teacher_profile)
        data = json.loads(request.body)
        
        question_grades = data.get('questionGrades', [])
        question_feedback = data.get('questionFeedback', [])
        total_grade = data.get('totalGrade')
        overall_feedback = data.get('overallFeedback')

        # Update individual answers
        for idx, grade in enumerate(question_grades):
            answer = attempt.answers.filter(question__order=idx).first()
            if answer:
                answer.grade = grade
                if idx < len(question_feedback):
                    answer.feedback = question_feedback[idx]
                answer.save()

        attempt.total_grade = total_grade
        attempt.score = total_grade # For consistent display
        attempt.overall_feedback = overall_feedback
        attempt.status = 'graded'
        attempt.save()
        
        # Mark exam as completed if it wasn't already
        exam = attempt.exam
        if exam.status != 'completed':
            exam.status = 'completed'
            exam.save()

        # --- Notifications ---
        try:
            from notifications.services import create_notification

            create_notification(
                recipient=attempt.student.user,
                actor=request.user,
                notification_type="exam",
                title="Exam graded",
                message=f"Your exam '{exam.title}' has been graded.",
                related_entity_type="exam_attempt",
                related_entity_id=str(attempt.id),
            )
        except Exception:
            pass

        # --- Real-time UI sync (ws/dashboard/) ---
        try:
            publish_to_users(
                user_ids=[str(attempt.student.user_id), str(exam.teacher.user_id)],
                event="exam.changed",
                data={"exam_id": str(exam.id), "attempt_id": str(attempt.id), "status": exam.status, "action": "graded"},
            )
        except Exception:
            pass

        return JsonResponse({'success': True, 'message': 'Grades and feedback saved successfully!'})

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# --- Student Views ---

@login_required
@student_required
def list_student_exams_api(request):
    """
    List all exams assigned to the current student.
    """
    student = request.user.student_profile
    exams = Exam.objects.filter(student=student).select_related('teacher__user', 'assignment').prefetch_related('attempts')
    
    data = []
    for exam in exams:
        latest_attempt = exam.attempts.order_by('-start_time').first()
        
        exam_data = {
            'id': str(exam.id),
            'title': exam.title,
            'teacher': exam.teacher.user.get_full_name(),
            'assignment': exam.assignment.title,
            'type': exam.exam_type,
            'deadline': exam.deadline.isoformat(),
            'status': exam.status,
        }
        
        if latest_attempt:
            exam_data['attempt'] = {
                'id': str(latest_attempt.id),
                'status': latest_attempt.status,
                'score': latest_attempt.score,
                'totalGrade': latest_attempt.total_grade,
                'submittedAt': latest_attempt.end_time.isoformat() if latest_attempt.end_time else None
            }
            
        data.append(exam_data)
        
    return JsonResponse({'success': True, 'exams': data})

@login_required
@student_required
@csrf_exempt
@require_POST
def start_exam_api(request, exam_id):
    """
    Start an exam attempt.
    """
    exam = get_object_or_404(Exam, id=exam_id, student=request.user.student_profile)
    
    # Check if there's already an active attempt
    attempt = ExamAttempt.objects.filter(exam=exam, student=request.user.student_profile, status='in-progress').first()
    if not attempt:
        attempt = ExamAttempt.objects.create(
            exam=exam,
            student=request.user.student_profile,
            status='in-progress'
        )
        try:
            publish_to_users(
                user_ids=[str(exam.student.user_id), str(exam.teacher.user_id)],
                event="exam.changed",
                data={"exam_id": str(exam.id), "attempt_id": str(attempt.id), "status": exam.status, "action": "attempt_started"},
            )
        except Exception:
            pass
        
    return JsonResponse({
        'success': True,
        'attempt_id': str(attempt.id)
    })

@login_required
@student_required
@csrf_exempt
@require_POST
def submit_exam_api(request, attempt_id):
    """
    Submit an exam attempt.
    """
    try:
        attempt = get_object_or_404(ExamAttempt, id=attempt_id, student=request.user.student_profile)
        if attempt.status != 'in-progress':
            return JsonResponse({'success': False, 'error': 'Attempt already submitted.'}, status=400)
            
        data = json.loads(request.body)
        answers_data = data.get('answers', {}) # Dict of question_id -> answer_data
        
        correct_count = 0
        total_questions = attempt.exam.questions.count()
        
        for q_id_str, a_data in answers_data.items():
            question = get_object_or_404(Question, id=q_id_str, exam=attempt.exam)
            
            if attempt.exam.exam_type == 'mcq':
                # a_data is option index
                option = question.options.all()[int(a_data)]
                Answer.objects.create(
                    attempt=attempt,
                    question=question,
                    selected_option=option
                )
                if option.is_correct:
                    correct_count += 1
            else:
                # a_data is text
                Answer.objects.create(
                    attempt=attempt,
                    question=question,
                    answer_text=a_data
                )
        
        attempt.status = 'submitted'
        attempt.end_time = timezone.now()
        
        if attempt.exam.exam_type == 'mcq':
            attempt.score = (correct_count / total_questions) * 100 if total_questions > 0 else 0
            # MCQ is automatically completed/graded
            attempt.status = 'graded'
            attempt.exam.status = 'completed'
            attempt.exam.save()
            
        attempt.save()

        # --- Notifications ---
        try:
            from notifications.services import create_notification

            # Notify teacher on submission
            create_notification(
                recipient=attempt.exam.teacher.user,
                actor=request.user,
                notification_type="exam",
                title="Exam submitted",
                message=f"{request.user.get_full_name()} submitted exam '{attempt.exam.title}'.",
                related_entity_type="exam_attempt",
                related_entity_id=str(attempt.id),
            )

            # For MCQ auto-grading, notify student score immediately
            if attempt.exam.exam_type == 'mcq':
                create_notification(
                    recipient=attempt.student.user,
                    actor=request.user,
                    notification_type="exam",
                    title="Exam submitted",
                    message=f"Your MCQ exam was submitted. Score: {attempt.score:.0f}%",
                    related_entity_type="exam_attempt",
                    related_entity_id=str(attempt.id),
                )
        except Exception:
            pass

        # --- Real-time UI sync (ws/dashboard/) ---
        try:
            publish_to_users(
                user_ids=[str(attempt.student.user_id), str(attempt.exam.teacher.user_id)],
                event="exam.changed",
                data={"exam_id": str(attempt.exam.id), "attempt_id": str(attempt.id), "status": attempt.exam.status, "action": "attempt_submitted"},
                )
        except Exception:
            pass
        
        return JsonResponse({
            'success': True,
            'message': 'Exam submitted successfully!',
            'score': attempt.score if attempt.exam.exam_type == 'mcq' else None
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
def get_attempt_results_api(request, attempt_id):
    """
    Get results for a specific attempt.
    """
    attempt = get_object_or_404(ExamAttempt, id=attempt_id)
    
    # Permission check
    can_access = False
    if request.user.role == 'ADMIN':
        can_access = True
    elif hasattr(request.user, 'teacher_profile') and attempt.exam.teacher == request.user.teacher_profile:
        can_access = True
    elif hasattr(request.user, 'student_profile') and attempt.student == request.user.student_profile:
        can_access = True
        
    if not can_access:
        return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)

    answers = []
    for ans in attempt.answers.all():
        ans_data = {
            'questionId': str(ans.question.id),
            'questionText': ans.question.text,
            'order': ans.question.order,
        }
        if attempt.exam.exam_type == 'mcq':
            ans_data['selectedOption'] = ans.selected_option.text if ans.selected_option else None
            ans_data['selectedOptionIndex'] = list(ans.question.options.all()).index(ans.selected_option) if ans.selected_option else -1
            ans_data['isCorrect'] = ans.selected_option.is_correct if ans.selected_option else False
            ans_data['correctOptionIndex'] = list(ans.question.options.all()).index(ans.question.options.filter(is_correct=True).first())
            ans_data['correctOptionText'] = ans.question.options.filter(is_correct=True).first().text
        else:
            ans_data['answerText'] = ans.answer_text
            ans_data['grade'] = ans.grade
            ans_data['feedback'] = ans.feedback
            
        answers.append(ans_data)

    # Calculate time spent
    time_spent = ""
    if attempt.end_time and attempt.start_time:
        duration = attempt.end_time - attempt.start_time
        minutes = duration.seconds // 60
        seconds = duration.seconds % 60
        time_spent = f"{minutes} minutes {seconds} seconds"

    data = {
        'id': str(attempt.id),
        'examId': str(attempt.exam.id),
        'examTitle': attempt.exam.title,
        'studentName': attempt.student.user.get_full_name(),
        'studentEmail': attempt.student.user.email,
        'studentId': str(attempt.student.student_id).zfill(4),
        'teacherName': attempt.exam.teacher.user.get_full_name(),
        'teacherEmail': attempt.exam.teacher.user.email,
        'type': attempt.exam.exam_type,
        'status': attempt.status,
        'score': attempt.score,
        'totalGrade': attempt.total_grade,
        'overallFeedback': attempt.overall_feedback,
        'submittedAt': attempt.end_time.isoformat() if attempt.end_time else None,
        'timeSpent': time_spent,
        'answers': answers,
    }
    
    # Correcting questions format for the frontend
    questions_list = []
    for q in attempt.exam.questions.all():
        q_item = {
            'text': q.text,
            'order': q.order
        }
        if attempt.exam.exam_type == 'mcq':
            q_item['options'] = [o.text for o in q.options.all()]
            q_item['correctAnswers'] = [i for i, o in enumerate(q.options.all()) if o.is_correct]
        questions_list.append(q_item)
    data['questions'] = questions_list

    return JsonResponse({'success': True, 'results': data})

@login_required
@student_required
def attempt_exam_view(request, attempt_id):
    """
    Render the attempt exam page (MCQ or Q&A).
    """
    attempt = get_object_or_404(ExamAttempt, id=attempt_id, student=request.user.student_profile)
    if attempt.status != 'in-progress':
        # If already submitted, redirect to results
        return redirect('exam:results_view', attempt_id=attempt.id)
    
    exam = attempt.exam
    questions = exam.questions.all().prefetch_related('options')
    
    template = 'student/MCQ_attempt_exam.html' if exam.exam_type == 'mcq' else 'student/Q&A_attempt_exam.html'
    
    context = {
        'attempt': attempt,
        'exam': exam,
        'questions': questions,
        'total_questions': questions.count(),
    }
    
    return render(request, template, context)

@login_required
def results_view(request, attempt_id):
    """
    Render the results page for an attempt.
    """
    attempt = get_object_or_404(ExamAttempt, id=attempt_id)
    
    # Permission check
    can_access = False
    if request.user.role == 'ADMIN':
        can_access = True
    elif hasattr(request.user, 'teacher_profile') and attempt.exam.teacher == request.user.teacher_profile:
        can_access = True
    elif hasattr(request.user, 'student_profile') and attempt.student == request.user.student_profile:
        can_access = True
        
    if not can_access:
        from django.core.exceptions import PermissionDenied
        raise PermissionDenied

    # For MCQ, we can use the existing MCQ_attempt_exam.html which has a results view
    # For Q&A, we can use Q&A_attempt_exam.html which has a review view
    # But those templates expect JS to handle the view switch.
    # To keep it simple and consistent with the existing templates, we'll render the same template
    # but pass a state that tells it to show results.
    
    exam = attempt.exam
    questions = exam.questions.all().prefetch_related('options')
    
    template = 'student/MCQ_attempt_exam.html' if exam.exam_type == 'mcq' else 'student/Q&A_attempt_exam.html'
    
    context = {
        'attempt': attempt,
        'exam': exam,
        'questions': questions,
        'total_questions': questions.count(),
        'show_results': True
    }
    
    return render(request, template, context)
