/**
 * Sidebar Dashboard Module
 * Handles all sidebar panels: Participants, Notes, Agenda, Resources, Tasks, Recordings, Analytics
 * TODO: Replace MockDataService calls with API/WebSocket calls when backend is integrated
 */

class SidebarDashboard {
    constructor(containerId, dataService, currentUser) {
        this.container = document.getElementById(containerId);
        this.dataService = dataService;
        this.currentUser = currentUser || { id: 'user1', name: 'You', role: 'Host' };
        this.activeTab = 'participants';
        this.isOpen = false;
        
        this.init();
    }

    init() {
        if (!this.container) return;
        
        this.render();
        this.attachEventListeners();
        this.loadActiveTab();
    }

    render() {
        this.container.innerHTML = `
            <div class="sidebar-header">
                <h3>Meeting Dashboard</h3>
                <button type="button" class="sidebar-close-btn" onclick="sidebarDashboard.toggle()" aria-label="Close sidebar">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="sidebar-tabs">
                <button type="button" class="sidebar-tab active" data-tab="participants" onclick="sidebarDashboard.showTab('participants')">
                    <i class="fas fa-users"></i>
                    <span>People</span>
                </button>
                <button type="button" class="sidebar-tab" data-tab="notes" onclick="sidebarDashboard.showTab('notes')">
                    <i class="fas fa-sticky-note"></i>
                    <span>Notes</span>
                </button>
                <button type="button" class="sidebar-tab" data-tab="agenda" onclick="sidebarDashboard.showTab('agenda')">
                    <i class="fas fa-list-check"></i>
                    <span>Agenda</span>
                </button>
                <button type="button" class="sidebar-tab" data-tab="resources" onclick="sidebarDashboard.showTab('resources')">
                    <i class="fas fa-folder"></i>
                    <span>Files</span>
                </button>
                <button type="button" class="sidebar-tab" data-tab="tasks" onclick="sidebarDashboard.showTab('tasks')">
                    <i class="fas fa-tasks"></i>
                    <span>Tasks</span>
                </button>
                <button type="button" class="sidebar-tab" data-tab="recordings" onclick="sidebarDashboard.showTab('recordings')">
                    <i class="fas fa-video"></i>
                    <span>Recordings</span>
                </button>
                <button type="button" class="sidebar-tab" data-tab="analytics" onclick="sidebarDashboard.showTab('analytics')">
                    <i class="fas fa-chart-line"></i>
                    <span>Analytics</span>
                </button>
            </div>
            <div class="sidebar-content" id="sidebarContent">
                <!-- Tab panels will be rendered here -->
            </div>
        `;
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.container.classList.toggle('open', this.isOpen);
        
        // Update button state
        const btn = document.getElementById('sidebarToggleBtn');
        if (btn) {
            btn.classList.toggle('active', this.isOpen);
        }
    }

    showTab(tabName) {
        this.activeTab = tabName;
        
        // Update tab buttons
        document.querySelectorAll('.sidebar-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        this.loadActiveTab();
    }

    loadActiveTab() {
        const content = document.getElementById('sidebarContent');
        if (!content) return;

        switch (this.activeTab) {
            case 'participants':
                content.innerHTML = this.renderParticipants();
                break;
            case 'notes':
                content.innerHTML = this.renderNotes();
                break;
            case 'agenda':
                content.innerHTML = this.renderAgenda();
                break;
            case 'resources':
                content.innerHTML = this.renderResources();
                break;
            case 'tasks':
                content.innerHTML = this.renderTasks();
                break;
            case 'recordings':
                content.innerHTML = this.renderRecordings();
                break;
            case 'analytics':
                content.innerHTML = this.renderAnalytics();
                setTimeout(() => this.initAnalyticsCharts(), 100);
                break;
        }
    }

    // ============ PARTICIPANTS PANEL ============
    renderParticipants() {
        const participants = this.dataService.getParticipants();
        const isHost = this.currentUser.role === 'Host' || this.currentUser.role === 'Co-host';

        return `
            <div class="participants-list" id="participantsList">
                ${participants.map(p => this.renderParticipantItem(p, isHost)).join('')}
            </div>
        `;
    }

    renderParticipantItem(participant, isHost) {
        const roleColors = {
            'Host': 'var(--accent)',
            'Co-host': 'var(--success)',
            'Teacher': 'var(--warning)',
            'Student': 'var(--text-secondary)'
        };

        return `
            <div class="participant-item">
                <div class="participant-avatar" style="background: ${roleColors[participant.role] || roleColors.Student}">
                    ${participant.name.charAt(0).toUpperCase()}
                </div>
                <div class="participant-info">
                    <div class="participant-name">${this.sanitize(participant.name)}</div>
                    <div class="participant-role">${participant.role}</div>
                </div>
                <div class="participant-status">
                    <div class="status-icon ${participant.isMuted ? 'muted' : ''}" title="${participant.isMuted ? 'Muted' : 'Unmuted'}">
                        <i class="fas fa-microphone${participant.isMuted ? '-slash' : ''}"></i>
                    </div>
                    <div class="status-icon ${participant.isVideoOff ? 'video-off' : ''}" title="${participant.isVideoOff ? 'Video off' : 'Video on'}">
                        <i class="fas fa-video${participant.isVideoOff ? '-slash' : ''}"></i>
                    </div>
                </div>
                ${isHost && participant.id !== this.currentUser.id ? `
                    <div class="participant-actions">
                        <button type="button" class="participant-action-btn" onclick="sidebarDashboard.muteParticipant('${participant.id}')" title="Mute">
                            <i class="fas fa-microphone-slash"></i>
                        </button>
                        <button type="button" class="participant-action-btn" onclick="sidebarDashboard.removeParticipant('${participant.id}')" title="Remove">
                            <i class="fas fa-user-times"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    muteParticipant(userId) {
        const participants = this.dataService.getParticipants();
        const participant = participants.find(p => p.id === userId);
        if (participant) {
            this.dataService.updateParticipantStatus(userId, { isMuted: !participant.isMuted });
            this.loadActiveTab();
            toastNotifications.info(`${participant.name} ${participant.isMuted ? 'unmuted' : 'muted'}`);
        }
    }

    removeParticipant(userId) {
        // TODO: Replace with API call when backend is integrated
        toastNotifications.warning('Remove participant functionality (local-only demo)');
    }

    // ============ NOTES PANEL ============
    renderNotes() {
        const personalNotes = this.dataService.getPersonalNotes();
        const sharedNotes = this.dataService.getSharedNotes();
        const currentNote = personalNotes[0] || { id: null, content: '' };

        return `
            <div class="notes-panel">
                <div class="notes-header">
                    <button type="button" class="btn-new-note" onclick="sidebarDashboard.createNewNote()">
                        <i class="fas fa-plus"></i> New Note
                    </button>
                    <label class="notes-share-toggle">
                        <input type="checkbox" id="notesShareToggle" onchange="sidebarDashboard.toggleNotesSharing()">
                        <span>Share my notes</span>
                    </label>
                </div>
                <div class="notes-editor-container">
                    <textarea id="notesEditor" class="note-editor" placeholder="Start typing your notes here..." 
                              oninput="sidebarDashboard.autoSaveNote()">${this.sanitize(currentNote.content || '')}</textarea>
                </div>
                ${sharedNotes.length > 0 ? `
                    <div class="shared-notes-section">
                        <h4>Shared Notes</h4>
                        <div class="notes-list">
                            ${sharedNotes.map(note => `
                                <div class="note-item">
                                    <div class="note-header">
                                        <span class="note-author">${this.sanitize(note.authorName)}</span>
                                        <span class="note-time">${new Date(note.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div class="note-content">${this.sanitize(note.content)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    createNewNote() {
        const editor = document.getElementById('notesEditor');
        if (editor) {
            editor.value = '';
            editor.focus();
        }
    }

    autoSaveNote() {
        const editor = document.getElementById('notesEditor');
        if (!editor) return;

        clearTimeout(this.noteSaveTimeout);
        this.noteSaveTimeout = setTimeout(() => {
            const content = editor.value;
            const personalNotes = this.dataService.getPersonalNotes();
            const noteId = personalNotes[0]?.id || Date.now().toString();
            
            this.dataService.savePersonalNote({ id: noteId, content });
        }, 1000);
    }

    toggleNotesSharing() {
        const editor = document.getElementById('notesEditor');
        const shareToggle = document.getElementById('notesShareToggle');
        if (!editor || !shareToggle) return;

        if (shareToggle.checked && editor.value.trim()) {
            this.dataService.shareNote({ content: editor.value });
            toastNotifications.success('Note shared with participants');
            this.loadActiveTab();
        }
    }

    // ============ AGENDA PANEL ============
    renderAgenda() {
        const agenda = this.dataService.getAgenda();

        return `
            <div class="agenda-panel">
                <div class="agenda-list" id="agendaList">
                    ${agenda.map(item => this.renderAgendaItem(item)).join('')}
                </div>
                <button type="button" class="btn-new-agenda" onclick="sidebarDashboard.addAgendaItem()">
                    <i class="fas fa-plus"></i> Add Item
                </button>
            </div>
        `;
    }

    renderAgendaItem(item) {
        return `
            <div class="agenda-item ${item.completed ? 'completed' : ''}" draggable="true" data-id="${item.id}">
                <input type="checkbox" class="agenda-checkbox" ${item.completed ? 'checked' : ''} 
                       onchange="sidebarDashboard.toggleAgendaItem('${item.id}')">
                <div class="agenda-content">
                    <div class="agenda-title">${this.sanitize(item.title)}</div>
                    <div class="agenda-description">${this.sanitize(item.description || '')}</div>
                </div>
            </div>
        `;
    }

    toggleAgendaItem(id) {
        const agenda = this.dataService.getAgenda();
        const item = agenda.find(a => a.id === id);
        if (item) {
            item.completed = !item.completed;
            this.dataService.saveAgenda(agenda);
            this.loadActiveTab();
        }
    }

    addAgendaItem() {
        const title = prompt('Enter agenda item title:');
        if (title) {
            const agenda = this.dataService.getAgenda();
            agenda.push({
                id: Date.now().toString(),
                title,
                description: '',
                completed: false,
                order: agenda.length
            });
            this.dataService.saveAgenda(agenda);
            this.loadActiveTab();
        }
    }

    // ============ RESOURCES PANEL ============
    renderResources() {
        const resources = this.dataService.getResources();

        return `
            <div class="resources-panel">
                <div class="resources-header">
                    <button type="button" class="btn-upload-resource" onclick="document.getElementById('resourceFileInput').click()">
                        <i class="fas fa-upload"></i> Upload File
                    </button>
                    <input type="file" id="resourceFileInput" multiple hidden onchange="sidebarDashboard.handleResourceUpload(event)">
                </div>
                <div class="resources-list">
                    ${resources.length > 0 ? resources.map(r => this.renderResourceItem(r)).join('') : 
                        '<div class="empty-state">No resources uploaded yet</div>'}
                </div>
            </div>
        `;
    }

    renderResourceItem(resource) {
        const icon = resource.type.startsWith('image/') ? 'fa-image' : 
                    resource.type.includes('pdf') ? 'fa-file-pdf' :
                    resource.type.includes('word') ? 'fa-file-word' : 'fa-file';
        
        const sizeStr = this.formatFileSize(resource.size);

        return `
            <div class="resource-item">
                <div class="resource-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="resource-info">
                    <div class="resource-name">${this.sanitize(resource.name)}</div>
                    <div class="resource-meta">${sizeStr} • ${new Date(resource.uploadedAt).toLocaleDateString()}</div>
                </div>
                <div class="resource-actions">
                    <a href="${resource.dataUrl}" download="${resource.name}" class="resource-download-btn">
                        <i class="fas fa-download"></i>
                    </a>
                </div>
            </div>
        `;
    }

    handleResourceUpload(event) {
        const files = Array.from(event.target.files);
        files.forEach(file => {
            if (file.size > 5 * 1024 * 1024) {
                toastNotifications.error('File size must be less than 5MB');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                this.dataService.addResource({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    dataUrl: e.target.result
                });
                toastNotifications.success(`Uploaded ${file.name}`);
                this.loadActiveTab();
            };
            reader.readAsDataURL(file);
        });

        event.target.value = '';
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // ============ TASKS PANEL ============
    renderTasks() {
        const tasks = this.dataService.getTasks();
        const participants = this.dataService.getParticipants();

        return `
            <div class="tasks-panel">
                <div class="tasks-header">
                    <button type="button" class="btn-new-task" onclick="sidebarDashboard.createNewTask()">
                        <i class="fas fa-plus"></i> New Task
                    </button>
                </div>
                <div class="tasks-list">
                    ${tasks.length > 0 ? tasks.map(t => this.renderTaskItem(t, participants)).join('') : 
                        '<div class="empty-state">No tasks yet</div>'}
                </div>
            </div>
        `;
    }

    renderTaskItem(task, participants) {
        const assignee = participants.find(p => p.id === task.assignedTo);
        const statusColors = {
            'todo': 'var(--text-secondary)',
            'in-progress': 'var(--warning)',
            'done': 'var(--success)'
        };

        return `
            <div class="task-item">
                <div class="task-header">
                    <input type="checkbox" class="task-checkbox" ${task.status === 'done' ? 'checked' : ''} 
                           onchange="sidebarDashboard.updateTaskStatus('${task.id}', this.checked ? 'done' : 'todo')">
                    <div class="task-content">
                        <div class="task-title">${this.sanitize(task.title)}</div>
                        <div class="task-description">${this.sanitize(task.description || '')}</div>
                    </div>
                </div>
                <div class="task-meta">
                    <span>Assigned to: ${assignee ? assignee.name : 'Unassigned'}</span>
                    <span class="task-status-badge ${task.status}" style="background: ${statusColors[task.status]}">
                        ${task.status.replace('-', ' ')}
                    </span>
                </div>
            </div>
        `;
    }

    createNewTask() {
        const title = prompt('Enter task title:');
        if (title) {
            const tasks = this.dataService.getTasks();
            tasks.push({
                id: Date.now().toString(),
                title,
                description: '',
                assignedTo: null,
                dueDate: null,
                status: 'todo',
                createdAt: new Date().toISOString()
            });
            this.dataService.saveTasks(tasks);
            this.loadActiveTab();
            toastNotifications.success('Task created');
        }
    }

    updateTaskStatus(id, status) {
        const tasks = this.dataService.getTasks();
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.status = status;
            this.dataService.saveTasks(tasks);
            this.loadActiveTab();
        }
    }

    // ============ RECORDINGS PANEL ============
    renderRecordings() {
        const recordings = this.dataService.getRecordings();

        return `
            <div class="recordings-panel">
                <div class="recordings-list">
                    ${recordings.length > 0 ? recordings.map(r => this.renderRecordingItem(r)).join('') : 
                        '<div class="empty-state">No recordings available</div>'}
                </div>
            </div>
        `;
    }

    renderRecordingItem(recording) {
        return `
            <div class="recording-item">
                <div class="recording-icon">
                    <i class="fas fa-video"></i>
                </div>
                <div class="recording-info">
                    <div class="recording-name">${this.sanitize(recording.name || 'Recording')}</div>
                    <div class="recording-meta">${new Date(recording.createdAt || Date.now()).toLocaleString()}</div>
                </div>
            </div>
        `;
    }

    // ============ ANALYTICS PANEL ============
    renderAnalytics() {
        return `
            <div class="analytics-panel">
                <div class="analytics-content">
                    <div class="analytics-card">
                        <div class="analytics-card-title">Messages per User</div>
                        <canvas id="messagesChart" width="400" height="200"></canvas>
                    </div>
                    <div class="analytics-card">
                        <div class="analytics-card-title">Participation Timeline</div>
                        <canvas id="timelineChart" width="400" height="200"></canvas>
                    </div>
                </div>
            </div>
        `;
    }

    initAnalyticsCharts() {
        const analytics = this.dataService.getAnalytics();
        const participants = this.dataService.getParticipants();

        // Messages per user chart
        const messagesCtx = document.getElementById('messagesChart');
        if (messagesCtx && typeof Chart !== 'undefined') {
            const userNames = Object.keys(analytics.messagesPerUser).map(userId => {
                const p = participants.find(p => p.id === userId);
                return p ? p.name : userId;
            });
            const messageCounts = Object.values(analytics.messagesPerUser);

            new Chart(messagesCtx, {
                type: 'bar',
                data: {
                    labels: userNames,
                    datasets: [{
                        label: 'Messages',
                        data: messageCounts,
                        backgroundColor: 'var(--accent)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }

        // Timeline chart
        const timelineCtx = document.getElementById('timelineChart');
        if (timelineCtx && typeof Chart !== 'undefined') {
            new Chart(timelineCtx, {
                type: 'line',
                data: {
                    labels: analytics.participationTimeline.map(t => `${t.hour}:00`),
                    datasets: [{
                        label: 'Messages',
                        data: analytics.participationTimeline.map(t => t.count),
                        borderColor: 'var(--accent)',
                        backgroundColor: 'var(--accent-soft)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
    }

    attachEventListeners() {
        // Drag and drop for agenda items
        // TODO: Implement drag-and-drop reordering
    }

    sanitize(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global instance (will be initialized after DOM is ready)
let sidebarDashboard = null;


