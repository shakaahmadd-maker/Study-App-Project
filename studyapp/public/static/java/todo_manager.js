// Todo Manager - Front-end functionality with dynamic data from backend
(function () {
    'use strict';

    let todos = [];

    // Initialize
    async function init() {
        // Dashboard sections are injected dynamically. Only run the render fetch if the todo list exists.
        if (!document.getElementById('todoList')) return;

        await fetchTodos();
    }

    window.fetchTodos = fetchTodos;

    // Fetch todos from backend
    async function fetchTodos() {
        try {
            const response = await fetch('/todo/list/', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });
            const data = await response.json();
            if (data.success) {
                todos = data.todos;
                renderTodos();
            }
        } catch (error) {
            console.error('Error fetching todos:', error);
        }
    }

    // One-time delegated listeners (needed because dashboard HTML is injected/replaced)
    function setupDelegatedEventListenersOnce() {
        if (window.__todoManagerDelegatedListenersAttached) return;
        window.__todoManagerDelegatedListenersAttached = true;

        // Add button (delegated)
        document.addEventListener('click', function (e) {
            const btn = e.target && e.target.closest ? e.target.closest('#addTodoBtn') : null;
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.openAddTodoModal === 'function') {
                window.openAddTodoModal();
            }
        }, true);

        // Modal overlay close (click outside modal content)
        document.addEventListener('click', function (e) {
            const modal = document.getElementById('todoModal');
            if (!modal || modal.style.display === 'none') return;
            if (e.target === modal) {
                closeTodoModal();
            }
        }, true);

        // Escape closes modal
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            const modal = document.getElementById('todoModal');
            if (modal && modal.style.display !== 'none') {
                closeTodoModal();
            }
        }, true);

        // Due date input toggles clear button
        document.addEventListener('input', function (e) {
            if (!e.target || e.target.id !== 'todoDueDate') return;
            const dateClearBtn = document.querySelector('.date-clear-btn');
            if (!dateClearBtn) return;
            dateClearBtn.style.opacity = e.target.value ? '1' : '0';
            dateClearBtn.style.pointerEvents = e.target.value ? 'all' : 'none';
        }, true);

        // Form submit (delegated)
        document.addEventListener('submit', function (e) {
            if (!e.target || e.target.id !== 'todoForm') return;
            handleFormSubmit(e);
        }, true);

        // Checkbox toggle (delegated)
        document.addEventListener('change', async function (e) {
            if (!e.target || !e.target.classList || !e.target.classList.contains('todo-checkbox')) return;

            // UUIDs are strings, do NOT use parseInt
            const todoId = e.target.getAttribute('data-todo-id');
            if (!todoId) return;

            e.preventDefault();
            e.stopPropagation();

            if (typeof window.toggleTodoComplete === 'function') {
                await window.toggleTodoComplete(todoId);
            }
        }, true);
    }

    function renderTodos() {
        const todoList = document.getElementById('todoList');
        const todoEmptyState = document.getElementById('todoEmptyState');
        if (!todoList) return;

        while (todoList.firstChild) {
            todoList.removeChild(todoList.firstChild);
        }

        const activeTodos = todos.filter(todo => !todo.completed);
        const completedTodos = todos.filter(todo => todo.completed);

        if (todos.length === 0) {
            if (todoEmptyState) todoEmptyState.style.display = 'flex';
            return;
        }

        if (todoEmptyState) todoEmptyState.style.display = 'none';

        activeTodos.forEach(todo => {
            todoList.appendChild(createTodoElement(todo));
        });

        if (completedTodos.length > 0) {
            const completedSection = document.createElement('div');
            completedSection.className = 'todo-completed-section';
            completedSection.innerHTML = `
                <div class="todo-completed-header" onclick="toggleCompletedTodos()">
                    <span class="todo-completed-title">
                        <i class="fas fa-chevron-down" id="completedChevron"></i>
                        Completed (${completedTodos.length})
                    </span>
                </div>
                <div class="todo-completed-list" id="completedTodoList" style="display: none;">
                </div>
            `;
            const completedListContainer = completedSection.querySelector('#completedTodoList');
            completedTodos.forEach(todo => {
                completedListContainer.appendChild(createTodoElement(todo));
            });
            todoList.appendChild(completedSection);
        }
    }

    function createTodoElement(todo) {
        const todoDiv = document.createElement('div');
        todoDiv.className = `todo-item ${todo.completed ? 'completed' : ''} priority-${todo.priority}`;
        todoDiv.dataset.todoId = todo.id;

        const dueDate = todo.due_date ? formatDate(todo.due_date) : null;
        const isOverdue = dueDate && new Date(todo.due_date) < new Date() && !todo.completed;
        const daysUntilDue = dueDate ? getDaysUntilDue(todo.due_date) : null;

        todoDiv.innerHTML = `
            <div class="todo-item-content">
                <div class="todo-checkbox-wrapper">
                    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} data-todo-id="${todo.id}">
                    <span class="todo-checkmark"></span>
                </div>
                <div class="todo-details">
                    <div class="todo-header-row">
                        <h4 class="todo-title">${escapeHtml(todo.title)}</h4>
                        <div class="todo-badges">
                            <span class="todo-priority-badge priority-${todo.priority}">${capitalizeFirst(todo.priority)}</span>
                            <span class="todo-category-badge category-${todo.variety}">${capitalizeFirst(todo.variety)}</span>
                        </div>
                    </div>
                    ${todo.description ? `<p class="todo-description">${escapeHtml(todo.description)}</p>` : ''}
                    <div class="todo-meta">
                        ${dueDate ? `
                            <span class="todo-due-date ${isOverdue ? 'overdue' : ''}">
                                <i class="fas fa-calendar-alt"></i>
                                ${dueDate}
                                ${daysUntilDue !== null ? `<span class="days-indicator">${getDaysText(daysUntilDue)}</span>` : ''}
                            </span>
                        ` : ''}
                        <div class="todo-actions">
                            <button class="todo-action-btn edit-btn" onclick="editTodo('${todo.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="todo-action-btn delete-btn" onclick="deleteTodo('${todo.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return todoDiv;
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        const formEl = e && e.target ? e.target : document.getElementById('todoForm');
        if (!formEl) return;

        const formData = new FormData(formEl);
        const todoIdEl = document.getElementById('todoId');
        const todoId = todoIdEl ? todoIdEl.value : '';
        const payload = {
            todo_id: todoId || null,
            title: formData.get('title'),
            description: formData.get('description'),
            variety: formData.get('variety'),
            priority: formData.get('priority'),
            due_date: formData.get('due_date') || null
        };

        try {
            const csrfToken = getCookie('csrftoken');
            if (!csrfToken) {
                showToast('CSRF token not found. Please refresh the page and try again.', 'error');
                console.error('CSRF token not found');
                return;
            }

            const response = await fetch('/todo/add/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error:', response.status, errorText);
                showToast('Failed to save todo. Please try again.', 'error');
                return;
            }

            const data = await response.json();
            if (data.success) {
                showToast(todoId ? 'Todo updated successfully!' : 'Todo created successfully!', 'success');
                await fetchTodos();
                closeTodoModal();
            } else {
                showToast(data.error || 'Failed to save todo.', 'error');
            }
        } catch (error) {
            console.error('Error saving todo:', error);
            showToast('An error occurred while saving the todo. Please try again.', 'error');
        }
    }

    window.toggleTodoComplete = async function (todoId) {
        try {
            const csrfToken = getCookie('csrftoken');
            if (!csrfToken) {
                console.error('CSRF token not found');
                return false;
            }

            const response = await fetch(`/todo/toggle/${todoId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken
                }
            });

            if (!response.ok) {
                console.error('Server error:', response.status);
                return false;
            }

            const data = await response.json();
            if (data.success) {
                await fetchTodos();
                return true;
            }
        } catch (error) {
            console.error('Error toggling todo:', error);
        }
        return false;
    };

    window.editTodo = function (todoId) {
        const todo = todos.find(t => t.id === todoId);
        if (!todo) return;

        document.getElementById('todoId').value = todo.id;
        document.getElementById('todoTitle').value = todo.title;
        document.getElementById('todoDescription').value = todo.description || '';
        document.getElementById('todoVariety').value = todo.variety;
        document.getElementById('todoPriority').value = todo.priority;

        const dateInput = document.getElementById('todoDueDate');
        if (dateInput) {
            dateInput.value = todo.due_date || '';
            const dateClearBtn = document.querySelector('.date-clear-btn');
            if (dateClearBtn) {
                dateClearBtn.style.opacity = todo.due_date ? '1' : '0';
                dateClearBtn.style.pointerEvents = todo.due_date ? 'all' : 'none';
            }
        }

        document.getElementById('todoModalTitle').textContent = 'Edit Todo';
        document.getElementById('todoModalSubtitle').textContent = 'Update task details';
        document.getElementById('submitButtonText').textContent = 'Update Todo';
        openAddTodoModal();
    };

    window.deleteTodo = async function (todoId) {
        if (confirm('Are you sure you want to delete this todo?')) {
            try {
                const csrfToken = getCookie('csrftoken');
                if (!csrfToken) {
                    showToast('CSRF token not found. Please refresh the page and try again.', 'error');
                    console.error('CSRF token not found');
                    return;
                }

                const response = await fetch(`/todo/delete/${todoId}/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Server error:', response.status, errorText);
                    showToast('Failed to delete todo. Please try again.', 'error');
                    return;
                }

                const data = await response.json();
                if (data.success) {
                    await fetchTodos();
                    showToast('Todo deleted successfully!', 'success');
                } else {
                    showToast(data.error || 'Failed to delete todo.', 'error');
                }
            } catch (error) {
                console.error('Error deleting todo:', error);
                showToast('An error occurred while deleting the todo. Please try again.', 'error');
            }
        }
    };

    function resetForm() {
        const todoForm = document.getElementById('todoForm');
        if (todoForm) {
            todoForm.reset();
            document.getElementById('todoId').value = '';
            document.getElementById('todoModalTitle').textContent = 'Add New Todo';
            document.getElementById('todoModalSubtitle').textContent = 'Create a new task to stay organized';
            document.getElementById('todoPriority').value = 'medium';
            const submitText = document.getElementById('submitButtonText');
            if (submitText) submitText.textContent = 'Save Todo';

            const dateInput = document.getElementById('todoDueDate');
            const dateClearBtn = document.querySelector('.date-clear-btn');
            if (dateInput) dateInput.value = '';
            if (dateClearBtn) {
                dateClearBtn.style.opacity = '0';
                dateClearBtn.style.pointerEvents = 'none';
            }
        }
    }

    window.clearDueDate = function () {
        const dateInput = document.getElementById('todoDueDate');
        const dateClearBtn = document.querySelector('.date-clear-btn');
        if (dateInput) {
            dateInput.value = '';
            if (dateClearBtn) {
                dateClearBtn.style.opacity = '0';
                dateClearBtn.style.pointerEvents = 'none';
            }
            dateInput.focus();
        }
    };

    window.toggleCompletedTodos = function () {
        const completedList = document.getElementById('completedTodoList');
        const chevron = document.getElementById('completedChevron');
        if (completedList && chevron) {
            const isHidden = completedList.style.display === 'none';
            completedList.style.display = isHidden ? 'block' : 'none';
            chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    };

    function formatDate(dateString) {
        if (!dateString) return null;
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function getDaysUntilDue(dateString) {
        if (!dateString) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(dateString);
        dueDate.setHours(0, 0, 0, 0);
        const diffTime = dueDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    function getDaysText(days) {
        if (days < 0) return 'Overdue';
        if (days === 0) return 'Today';
        if (days === 1) return 'Tomorrow';
        return `${days} days`;
    }

    function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getCookie(name) {
        // First, try to get from hidden input field (Django's {% csrf_token %})
        if (name === 'csrftoken') {
            const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
            if (csrfInput && csrfInput.value) {
                return csrfInput.value;
            }
        }
        
        // Second, try to get from cookies (with proper decoding)
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    function showToast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else if (typeof showTemporaryMessage === 'function') {
            showTemporaryMessage(message);
        }
    }

    function showModal(modal) {
        if (!modal) return;
        const todoId = document.getElementById('todoId');
        if (!todoId || !todoId.value) resetForm();

        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            const modalContent = modal.querySelector('.todo-modal-content');
            if (modalContent) {
                modalContent.style.transform = 'scale(1)';
                modalContent.style.opacity = '1';
            }
        }, 10);

        setTimeout(() => {
            const firstInput = document.getElementById('todoTitle');
            if (firstInput) firstInput.focus();
        }, 150);
    }

    window.openAddTodoModal = function () {
        let modal = document.getElementById('todoModal');
        if (modal) {
            showModal(modal);
        } else {
            console.error('Todo modal not found');
        }
    };

    window.closeTodoModal = function () {
        const modal = document.getElementById('todoModal');
        if (!modal) return;

        const modalContent = modal.querySelector('.todo-modal-content');
        if (modalContent) {
            modalContent.style.transform = 'scale(0.95)';
            modalContent.style.opacity = '0';
        }

        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('active');
            document.body.style.overflow = '';
            resetForm();
        }, 200);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Must be attached immediately for dynamically injected dashboard HTML
    setupDelegatedEventListenersOnce();
})();
