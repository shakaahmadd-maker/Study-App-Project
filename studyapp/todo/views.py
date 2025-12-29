import json
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST, require_GET
from django.shortcuts import get_object_or_404
from .models import Todo

@login_required
@require_GET
def list_todos(request):
    try:
        todos = Todo.objects.filter(user=request.user)
        data = []
        for todo in todos:
            data.append({
                'id': str(todo.id),
                'title': todo.title,
                'description': todo.description,
                'variety': todo.variety,
                'priority': todo.priority,
                'due_date': todo.due_date.isoformat() if todo.due_date else None,
                'completed': todo.is_completed,
                'created_at': todo.created_at.isoformat()
            })
        return JsonResponse({'success': True, 'todos': data})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@require_POST
def add_todo(request):
    try:
        data = json.loads(request.body)
        todo_id = data.get('todo_id')
        
        title = data.get('title')
        description = data.get('description')
        variety = data.get('variety')
        priority = data.get('priority')
        due_date = data.get('due_date') or None

        if not title:
            return JsonResponse({'success': False, 'error': 'Title is required'}, status=400)
        
        if todo_id:
            todo = get_object_or_404(Todo, id=todo_id, user=request.user)
            todo.title = title
            todo.description = description
            todo.variety = variety
            todo.priority = priority
            todo.due_date = due_date
            todo.save()
        else:
            todo = Todo.objects.create(
                user=request.user,
                title=title,
                description=description,
                variety=variety,
                priority=priority,
                due_date=due_date
            )
            
        return JsonResponse({
            'success': True,
            'todo': {
                'id': str(todo.id),
                'title': todo.title,
                'completed': todo.is_completed
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@require_POST
def toggle_todo(request, todo_id):
    try:
        todo = get_object_or_404(Todo, id=todo_id, user=request.user)
        todo.is_completed = not todo.is_completed
        todo.save()
        return JsonResponse({'success': True, 'completed': todo.is_completed})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@require_POST
def delete_todo(request, todo_id):
    try:
        todo = get_object_or_404(Todo, id=todo_id, user=request.user)
        todo.delete()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
