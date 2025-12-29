// Teacher_Dash.js: Core navigation and dynamic content loading for Teacher Dashboard
console.log('Teacher_Dash.js loaded');

/**
 * Global showToast wrapper for the toastNotifications system
 */
if (typeof window.showToast === 'undefined') {
    window.showToast = function (message, type = 'info', duration = 3000) {
        if (window.toastNotifications && typeof window.toastNotifications.show === 'function') {
            window.toastNotifications.show(message, type, duration);
        } else {
            console.log(`[Toast ${type}] ${message}`);
            // Fallback to simple alert if system not ready
            if (type === 'error') alert(message);
        }
    };
}

// Global reference for convenience
var showToast = window.showToast;

// Helper function to get CSRF token
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

// Assignment functions - defined globally so they're always available
// These are used by my_assignments.html buttons
if (typeof window.viewAssignment === 'undefined') {
    window.viewAssignment = function (button) {
        const row = button.closest('.assignment-row');
        if (!row) return;

        const title = row.querySelector('.assignment-title')?.textContent || '';
        const serviceType = row.querySelector('.assignment-service-type')?.textContent || '';
        const submission = row.querySelector('.submission-date')?.textContent || row.querySelector('.completed-date')?.textContent || '';
        const due = row.querySelector('.due-date')?.textContent || '-';
        const brief = row.dataset.brief || '';
        const content = row.dataset.content || '';
        const priority = row.dataset.priority || '-';
        
        // Parse attachments with error handling
        let attachments = [];
        try {
            const attachmentsStr = row.dataset.attachments || '[]';
            if (attachmentsStr && attachmentsStr.trim() !== '') {
                attachments = JSON.parse(attachmentsStr);
            }
        } catch (e) {
            console.error('Error parsing attachments JSON:', e);
            console.error('Raw attachments data:', row.dataset.attachments);
            // If JSON parsing fails, try to extract file info manually as fallback
            attachments = [];
            
            // Try to extract file names from the malformed JSON as a last resort
            if (row.dataset.attachments && row.dataset.attachments !== '[]') {
                try {
                    // Try to extract file names using regex (fallback)
                    const nameMatches = row.dataset.attachments.match(/"name":"([^"]+)"/g);
                    if (nameMatches) {
                        nameMatches.forEach(match => {
                            const name = match.replace(/"name":"/, '').replace(/"$/, '');
                            attachments.push({ name: name, url: '#' });
                        });
                        console.warn('Extracted file names from malformed JSON:', attachments);
                    }
                } catch (fallbackError) {
                    console.error('Fallback parsing also failed:', fallbackError);
                }
            }
        }
        const statusBadge = row.querySelector('.status-badge');
        const status = statusBadge ? (statusBadge.classList.contains('in-process') ? 'in-process' : '') : '';
        const id = row.dataset.id || '';

        const detailTitle = document.getElementById('detailTitle');
        if (detailTitle) detailTitle.textContent = title;
        const detailCourse = document.getElementById('detailCourse');
        if (detailCourse) detailCourse.textContent = serviceType;
        const detailSubmission = document.getElementById('detailSubmission');
        if (detailSubmission) detailSubmission.textContent = submission;
        const detailDue = document.getElementById('detailDue');
        if (detailDue) detailDue.textContent = due;
        const detailBrief = document.getElementById('detailBrief');
        if (detailBrief) detailBrief.value = brief;
        const detailContent = document.getElementById('detailContent');
        if (detailContent) detailContent.value = content;
        const detailPriority = document.getElementById('detailPriority');
        if (detailPriority) detailPriority.textContent = priority;

        window.currentDetailAssignment = { id: id, title: title, serviceType: serviceType };

        const detailCompleteBtn = document.getElementById('detailCompleteBtn');
        const detailDoneBtn = document.getElementById('detailDoneBtn');
        if (status === 'in-process') {
            if (detailCompleteBtn) detailCompleteBtn.style.display = 'inline-flex';
            if (detailDoneBtn) detailDoneBtn.style.display = 'none';
        } else {
            if (detailCompleteBtn) detailCompleteBtn.style.display = 'none';
            if (detailDoneBtn) detailDoneBtn.style.display = 'inline-flex';
        }

        const attachList = document.getElementById('detailAttachments');
        if (attachList) {
            attachList.innerHTML = '';
            if (attachments.length === 0) {
                attachList.innerHTML = '<p class="no-attachments">No attachments found.</p>';
            } else {
                attachments.forEach(file => {
                    const div = document.createElement('div');
                    div.className = 'attachment-item';
                    div.innerHTML = `<div class="attachment-info"><i class="fas fa-file"></i><span>${file.name}</span></div><a href="${file.url}" class="download-attachment-btn" target="_blank" title="Download"><i class="fas fa-download"></i></a>`;
                    attachList.appendChild(div);
                });
            }
        }

        const trackerContent = document.querySelector('.tracker-content');
        if (trackerContent) trackerContent.style.display = 'none';
        const assignmentHeader = document.querySelector('.assignment-header');
        if (assignmentHeader) assignmentHeader.style.display = 'none';
        const trackerTabs = document.querySelector('.tracker-tabs');
        if (trackerTabs) trackerTabs.style.display = 'none';
        const detailSection = document.getElementById('assignmentDetailSection');
        if (detailSection) detailSection.style.display = 'block';
    };
}

if (typeof window.startProcess === 'undefined') {
    window.startProcess = async function (id) {
        if (!confirm('Are you sure you want to start working on this assignment?')) return;
        try {
            const response = await fetch(`/assingment/teacher/start-process/${id}/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCookie('csrftoken') }
            });
            const result = await response.json();
            if (result.success) {
                showToast('Assignment is now In-Process.', 'success');
                if (window.switchSection) window.switchSection('my_assignments');
                else location.reload();
            } else {
                showToast(result.error || 'Failed to update status', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('An error occurred.', 'error');
        }
    };
}

if (typeof window.downloadAssignment === 'undefined') {
    window.downloadAssignment = async function (button) {
        const row = button.closest('.assignment-row');
        if (!row) return;
        
        const id = row.dataset.id || '';
        if (!id) {
            alert('Assignment ID not found.');
            return;
        }

        let downloadUrl = `/assingment/teacher/download-zip/${id}/`;
        
        // Apply masking for teachers
        if (typeof window.apiClient !== 'undefined' && localStorage.getItem('user_role') === 'TEACHER') {
            try {
                const response = await window.apiClient.post('/mask/generate/', { target_url: downloadUrl, link_type: 'assignment_zip' });
                if (response.success) {
                    downloadUrl = response.masked_url;
                }
            } catch (error) {
                console.error('Failed to generate masked link:', error);
            }
        }

        showToast('Preparing your download (ZIP with notes and files)...', 'info');
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
}

// Assignment detail functions
if (typeof window.closeAssignmentDetail === 'undefined') {
    window.closeAssignmentDetail = function () {
        const detailSection = document.getElementById('assignmentDetailSection');
        if (detailSection) detailSection.style.display = 'none';

        const trackerContent = document.querySelector('.tracker-content');
        if (trackerContent) trackerContent.style.display = 'block';

        const assignmentHeader = document.querySelector('.assignment-header');
        if (assignmentHeader) assignmentHeader.style.display = 'block';

        const trackerTabs = document.querySelector('.tracker-tabs');
        if (trackerTabs) trackerTabs.style.display = 'flex';
    };
}

if (typeof window.openMarkCompleteFromDetail === 'undefined') {
    window.openMarkCompleteFromDetail = function () {
        const data = window.currentDetailAssignment;
        if (!data) return;

        const assignmentIdEl = document.getElementById('completeAssignmentId');
        const serviceTypeEl = document.getElementById('completeServiceType');
        if (assignmentIdEl) assignmentIdEl.value = data.id;
        if (serviceTypeEl) serviceTypeEl.value = data.serviceType;
        
        const modalTitle = document.getElementById('markCompleteModalTitle');
        if (modalTitle) modalTitle.textContent = `Mark Complete: ${data.title}`;

        document.querySelectorAll('.service-type-form').forEach(form => form.style.display = 'none');

        const normalizedType = data.serviceType.toLowerCase();
        if (normalizedType.includes('assignment')) {
            const form = document.getElementById('assignmentSolutionForm');
            if (form) form.style.display = 'block';
        } else if (normalizedType.includes('exam') || normalizedType.includes('paper')) {
            const form = document.getElementById('examForm');
            if (form) form.style.display = 'block';
        } else if (normalizedType.includes('it project')) {
            const form = document.getElementById('itProjectForm');
            if (form) form.style.display = 'block';
        } else if (normalizedType.includes('writing')) {
            const form = document.getElementById('writingForm');
            if (form) form.style.display = 'block';
        }

        const modal = document.getElementById('markCompleteModal');
        if (modal) modal.style.display = 'flex';
    };
}

if (typeof window.openMarkCompleteModal === 'undefined') {
    window.openMarkCompleteModal = function (button) {
        const row = button.closest('tr');
        if (!row) return;

        const assignmentId = row.dataset.id || row.querySelector('.assignment-id code')?.textContent.trim() || '';
        const assignmentTitle = row.querySelector('.assignment-title')?.textContent.trim() || '';
        const serviceType = row.querySelector('.assignment-service-type')?.textContent.trim() || '';

        const assignmentIdEl = document.getElementById('completeAssignmentId');
        const serviceTypeEl = document.getElementById('completeServiceType');
        if (assignmentIdEl) assignmentIdEl.value = assignmentId;
        if (serviceTypeEl) serviceTypeEl.value = serviceType;
        
        const modalTitle = document.getElementById('markCompleteModalTitle');
        if (modalTitle) modalTitle.textContent = `Mark Complete: ${assignmentTitle}`;

        document.querySelectorAll('.service-type-form').forEach(form => form.style.display = 'none');

        const normalizedType = serviceType.toLowerCase();
        if (normalizedType.includes('assignment')) {
            const form = document.getElementById('assignmentSolutionForm');
            if (form) form.style.display = 'block';
        } else if (normalizedType.includes('exam') || normalizedType.includes('paper')) {
            const form = document.getElementById('examForm');
            if (form) form.style.display = 'block';
        } else if (normalizedType.includes('it project')) {
            const form = document.getElementById('itProjectForm');
            if (form) form.style.display = 'block';
        } else if (normalizedType.includes('writing')) {
            const form = document.getElementById('writingForm');
            if (form) form.style.display = 'block';
        }

        const modal = document.getElementById('markCompleteModal');
        if (modal) modal.style.display = 'flex';
    };
}

if (typeof window.closeMarkCompleteModal === 'undefined') {
    window.closeMarkCompleteModal = function () {
        const modal = document.getElementById('markCompleteModal');
        if (modal) modal.style.display = 'none';

        const form = document.getElementById('markCompleteForm');
        if (form) form.reset();

        // Clear file lists if they exist (they're defined in the template script)
        if (typeof window.fileLists !== 'undefined' && window.fileLists) {
            Object.keys(window.fileLists).forEach(key => {
                if (window.fileLists[key]) window.fileLists[key] = [];
            });
        }

        // Clear all previews from the UI
        document.querySelectorAll('.document-list').forEach(list => list.innerHTML = '');
    };
}

if (typeof window.submitMarkComplete === 'undefined') {
    window.submitMarkComplete = async function () {
        const form = document.getElementById('markCompleteForm');
        const submitBtn = document.querySelector('#markCompleteModal .save-changes-btn');

        // Basic validation for common notes
        const notes = document.getElementById('completionNotes')?.value.trim();
        if (!notes) {
            showToast('Please provide completion notes.', 'error');
            return;
        }

        const formData = new FormData(form);

        // Add files from fileLists if they exist (defined in template)
        let totalFiles = 0;
        if (typeof window.fileLists !== 'undefined' && window.fileLists) {
            Object.keys(window.fileLists).forEach(key => {
                if (window.fileLists[key] && Array.isArray(window.fileLists[key])) {
                    window.fileLists[key].forEach(file => {
                        formData.append(key, file);
                        totalFiles++;
                    });
                }
            });
        }

        // Specific validation: at least one file for some types
        const serviceTypeEl = document.getElementById('completeServiceType');
        const serviceType = serviceTypeEl ? serviceTypeEl.value.toLowerCase() : '';
        if (totalFiles === 0 && (serviceType.includes('assignment') || serviceType.includes('writing') || serviceType.includes('it project'))) {
            if (!confirm('You haven\'t attached any solution files. Mark as complete anyway?')) {
                return;
            }
        }

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            }

            const response = await fetch('/assingment/teacher/mark-complete/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                }
            });

            const result = await response.json();
            if (result.success) {
                showToast('Assignment marked as complete!', 'success');
                if (typeof window.closeMarkCompleteModal === 'function') {
                    window.closeMarkCompleteModal();
                }
                if (window.switchSection) window.switchSection('my_assignments');
                else location.reload();
            } else {
                showToast(result.error || 'Failed to complete assignment', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('An error occurred.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Mark as Complete';
            }
        }
    };
}

// File handling functions for mark complete modal
if (typeof window.handleFileSelection === 'undefined') {
    window.handleFileSelection = function (inputId, listContainerId) {
        const input = document.getElementById(inputId);
        const listContainer = document.getElementById(listContainerId);
        if (!input || !listContainer) return;

        // Ensure fileLists exists on window (matching template keys)
        if (typeof window.fileLists === 'undefined') {
            window.fileLists = {
                assignmentFile: [],
                additionalDocuments: [],
                examProof: [],
                resultReport: [],
                projectDocuments: [],
                writingDocuments: []
            };
        }

        const files = Array.from(input.files);
        if (!window.fileLists[inputId]) window.fileLists[inputId] = [];

        files.forEach(file => {
            const isDuplicate = window.fileLists[inputId].some(existing =>
                existing.name === file.name && existing.size === file.size
            );
            if (!isDuplicate) window.fileLists[inputId].push(file);
        });

        // Clear input value to allow re-selection of same files if needed
        input.value = '';

        if (typeof window.updateFileList === 'function') {
            window.updateFileList(inputId, listContainerId);
        }
    };
}

if (typeof window.removeFile === 'undefined') {
    window.removeFile = function (inputId, listContainerId, fileIndex) {
        if (typeof window.fileLists !== 'undefined' && window.fileLists[inputId]) {
            window.fileLists[inputId].splice(fileIndex, 1);
            if (typeof window.updateFileList === 'function') {
                window.updateFileList(inputId, listContainerId);
            }
        }
    };
}

if (typeof window.updateFileList === 'undefined') {
    window.updateFileList = function (inputId, listContainerId) {
        const listContainer = document.getElementById(listContainerId);
        if (!listContainer) return;

        const fileList = (typeof window.fileLists !== 'undefined' && window.fileLists[inputId]) ? window.fileLists[inputId] : [];
        if (fileList.length === 0) {
            listContainer.innerHTML = '';
            return;
        }

        let html = '<div class="document-list-header">Attached Documents (' + fileList.length + ')</div>';
        fileList.forEach((file, index) => {
            html += `
                <div class="document-item">
                    <div class="document-info">
                        <i class="fas fa-file"></i>
                        <div class="document-details">
                            <span class="document-name" title="${file.name}">${file.name}</span>
                        </div>
                    </div>
                    <button type="button" class="remove-document-btn" onclick="window.removeFile('${inputId}', '${listContainerId}', ${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });
        listContainer.innerHTML = html;
    };
}

// Online Exam question counter functions
if (typeof window.incrementQuestions === 'undefined') {
    window.incrementQuestions = function (inputId, min, max) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        let currentValue = parseInt(input.value) || min;
        if (currentValue < max) {
            input.value = currentValue + 1;
            // Trigger change event to update questions
            input.dispatchEvent(new Event('change'));
        }
    };
}

if (typeof window.decrementQuestions === 'undefined') {
    window.decrementQuestions = function (inputId, min, max) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        let currentValue = parseInt(input.value) || min;
        if (currentValue > min) {
            input.value = currentValue - 1;
            // Trigger change event to update questions
            input.dispatchEvent(new Event('change'));
        }
    };
}

if (typeof window.updateMCQQuestionsFromCounter === 'undefined') {
    window.updateMCQQuestionsFromCounter = function () {
        const num = parseInt(document.getElementById('numQuestions')?.value) || 5;
        const container = document.getElementById('mcqQuestionsContainer');
        if (!container) return;
        
        const currentCount = container.querySelectorAll('.mcq-question').length;
        
        if (num > currentCount) {
            // Add more questions
            for (let i = currentCount + 1; i <= num; i++) {
                container.appendChild(createMCQQuestionElement(i));
            }
        } else if (num < currentCount) {
            // Remove excess questions
            const questions = container.querySelectorAll('.mcq-question');
            for (let i = questions.length - 1; i >= num; i--) {
                questions[i].remove();
            }
            // Renumber remaining questions
            if (typeof window.renumberQuestions === 'function') {
                window.renumberQuestions('.mcq-question');
            }
        }
    };
}

if (typeof window.updateQAQuestionsFromCounter === 'undefined') {
    window.updateQAQuestionsFromCounter = function () {
        const num = parseInt(document.getElementById('numQAQuestions')?.value) || 1;
        const container = document.getElementById('qaQuestionsContainer');
        if (!container) return;
        
        const currentCount = container.querySelectorAll('.qa-question').length;
        
        if (num > currentCount) {
            // Add more questions
            for (let i = currentCount + 1; i <= num; i++) {
                container.appendChild(createQAQuestionElement(i));
            }
        } else if (num < currentCount) {
            // Remove excess questions
            const questions = container.querySelectorAll('.qa-question');
            for (let i = questions.length - 1; i >= num; i--) {
                questions[i].remove();
            }
            // Renumber remaining questions
            if (typeof window.renumberQuestions === 'function') {
                window.renumberQuestions('.qa-question');
            }
        }
    };
}

// Helper function to remove a question and update counter
if (typeof window.removeQuestion === 'undefined') {
    window.removeQuestion = function (questionElement, selector) {
        if (!questionElement) return;
        
        // Remove the question element
        questionElement.remove();
        
        // Get remaining questions
        const questions = document.querySelectorAll(selector);
        const count = questions.length;
        
        // Renumber remaining questions
        questions.forEach((q, i) => {
            const numberElement = q.querySelector('.question-number');
            if (numberElement) {
                numberElement.textContent = `Question ${i + 1}`;
            }
        });
        
        // Update the counter input based on selector
        if (selector === '.mcq-question') {
            const counterInput = document.getElementById('numQuestions');
            if (counterInput) {
                counterInput.value = count;
            }
        } else if (selector === '.qa-question') {
            const counterInput = document.getElementById('numQAQuestions');
            if (counterInput) {
                counterInput.value = count;
            }
        }
    };
}

// Helper function to renumber questions and update counter
if (typeof window.renumberQuestions === 'undefined') {
    window.renumberQuestions = function (selector) {
        const questions = document.querySelectorAll(selector);
        const count = questions.length;
        
        // Renumber the questions
        questions.forEach((q, i) => {
            const numberElement = q.querySelector('.question-number');
            if (numberElement) {
                numberElement.textContent = `Question ${i + 1}`;
            }
        });
        
        // Update the counter input based on selector
        if (selector === '.mcq-question') {
            const counterInput = document.getElementById('numQuestions');
            if (counterInput) {
                counterInput.value = count;
            }
        } else if (selector === '.qa-question') {
            const counterInput = document.getElementById('numQAQuestions');
            if (counterInput) {
                counterInput.value = count;
            }
        }
    };
}

// Helper functions for creating question elements (needed by update functions)
if (typeof window.createMCQQuestionElement === 'undefined') {
    window.createMCQQuestionElement = function (n) {
        const div = document.createElement('div');
        div.className = 'mcq-question';
        const timeSensitive = document.getElementById('timeSensitiveExam')?.checked || false;
        
        div.innerHTML = `
            <div class="question-header">
                <span class="question-number">Question ${n}</span>
                ${n > 1 ? `<button type="button" class="remove-question-btn" onclick="if (typeof window.removeQuestion === 'function') window.removeQuestion(this.closest('.mcq-question'), '.mcq-question')">Remove</button>` : ''}
            </div>
            <input type="text" class="question-text-input" placeholder="Enter your question here..." required>
            ${timeSensitive ? `
            <div class="form-row time-limit-row">
                <div class="form-column">
                    <label class="form-label">Time Limit</label>
                    <div class="time-input-group">
                        <input type="number" class="time-input minutes-input" value="0" min="0" max="59"> :
                        <input type="number" class="time-input seconds-input" value="30" min="0" max="59">
                    </div>
                </div>
            </div>` : ''}
            <div class="options-container">
                ${[1,2,3,4].map(i => `
                <div class="option-row">
                    <input type="text" class="option-input" placeholder="Option ${String.fromCharCode(64+i)}" required>
                    <input type="checkbox" class="correct-checkbox" id="q${n}_opt${i}">
                    <label for="q${n}_opt${i}" class="correct-label">Correct</label>
                </div>`).join('')}
            </div>
        `;
        return div;
    };
}

if (typeof window.createQAQuestionElement === 'undefined') {
    window.createQAQuestionElement = function (n) {
        const div = document.createElement('div');
        div.className = 'qa-question';
        div.innerHTML = `
            <div class="question-header">
                <span class="question-number">Question ${n}</span>
                ${n > 1 ? `<button type="button" class="remove-question-btn" onclick="if (typeof window.removeQuestion === 'function') window.removeQuestion(this.closest('.qa-question'), '.qa-question')">Remove</button>` : ''}
            </div>
            <textarea class="qa-question-input" placeholder="Enter your open-ended question here..." required></textarea>
        `;
        return div;
    };
}

// Homework attachment download function
if (typeof window.downloadHomeworkAttachment === 'undefined') {
    window.downloadHomeworkAttachment = function(url, filename) {
        try {
            // Create a temporary anchor element to trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || 'attachment';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Show toast notification if available
            if (typeof window.showToast === 'function') {
                window.showToast(`Downloading ${filename || 'file'}...`, 'info');
            }
        } catch (error) {
            console.error('Error downloading attachment:', error);
            // Fallback: open in new tab if download fails
            window.open(url, '_blank');
        }
    };
}

console.log('Assignment functions defined in Teacher_Dash.js:', {
    viewAssignment: typeof window.viewAssignment,
    startProcess: typeof window.startProcess,
    downloadAssignment: typeof window.downloadAssignment,
    closeAssignmentDetail: typeof window.closeAssignmentDetail,
    openMarkCompleteFromDetail: typeof window.openMarkCompleteFromDetail,
    openMarkCompleteModal: typeof window.openMarkCompleteModal,
    closeMarkCompleteModal: typeof window.closeMarkCompleteModal,
    submitMarkComplete: typeof window.submitMarkComplete,
    handleFileSelection: typeof window.handleFileSelection,
    removeFile: typeof window.removeFile,
    updateFileList: typeof window.updateFileList,
    incrementQuestions: typeof window.incrementQuestions,
    decrementQuestions: typeof window.decrementQuestions,
    updateMCQQuestionsFromCounter: typeof window.updateMCQQuestionsFromCounter,
    updateQAQuestionsFromCounter: typeof window.updateQAQuestionsFromCounter,
    downloadHomeworkAttachment: typeof window.downloadHomeworkAttachment
});

// Section to path mapping for dynamic content loading (Django endpoints)
const teacherSectionUrlMap = {
    'dashboard': '/account/teacher/section/dashboard/',
    'my_assignments': '/account/teacher/section/my_assignments/',
    'student_management': '/account/teacher/section/student_management/',
    'messages': '/account/teacher/section/messages/',
    'meetings': '/account/teacher/section/meetings/',
    'notifications': '/account/teacher/section/notifications/',
    'online_exam': '/account/teacher/section/online_exam/',
    'homework': '/account/teacher/section/homework/',
    'announcements': '/account/teacher/section/announcements/',
    'feedback': '/account/teacher/section/feedback/',
    'threads': '/account/teacher/section/threads/',
    'profile': '/account/teacher/section/profile/',
    'settings': '/account/teacher/section/settings/'
};

// Cache for loaded sections
const teacherLoadedSections = {};

// Header notifications badge (unread count) - always show a number (including 0)
function setTeacherHeaderNotificationUnreadCount(count) {
    const badge = document.getElementById('teacherNotificationsUnreadBadge');
    if (!badge) return;

    const n = Number(count);
    const safeCount = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;

    badge.textContent = safeCount > 99 ? '99+' : String(safeCount);
    badge.style.display = 'inline-flex';
    badge.removeAttribute('aria-hidden');
}

function initializeTeacherHeaderNotificationBadge() {
    // WS-driven: badge counts are pushed via ws/dashboard/ (realtimeDashboard.js).
    // Keep a stable global hook for legacy callers; the WS stream will update the badge.
    window.updateTeacherNotificationUnreadBadge = function () { };
}

function initializeTeacherRealtimeSectionRefresh() {
    if (typeof window.forceReloadTeacherSection === 'undefined') {
        window.forceReloadTeacherSection = async function (sectionName) {
            try { delete teacherLoadedSections[sectionName]; } catch (e) { }
            try { return await showTeacherSection(sectionName); } catch (e) { }
        };
    }
    if (window.__teacherRtSectionRefreshBound) return;
    window.__teacherRtSectionRefreshBound = true;

    // Automatic background refresh - refresh current section periodically
    let autoRefreshInterval = null;
    let lastActiveSection = null;
    const REFRESH_INTERVAL = 30000; // 30 seconds

    function startAutoRefresh() {
        // Clear any existing interval
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }

        // Get current active section
        const activeSection = document.querySelector('.content-section.active');
        if (!activeSection) return;

        const sectionId = activeSection.id;
        if (!sectionId) return;

        const sectionName = sectionId.replace('Section', '');
        if (!sectionName) return;

        lastActiveSection = sectionName;

        // Refresh function
        const refreshCurrentSection = async () => {
            // Only refresh if page is visible and section hasn't changed
            if (document.hidden) return;

            const currentActive = document.querySelector('.content-section.active');
            if (!currentActive || currentActive.id !== sectionId) {
                // Section changed, stop this refresh cycle
                if (autoRefreshInterval) {
                    clearInterval(autoRefreshInterval);
                    autoRefreshInterval = null;
                }
                return;
            }

            try {
                // Silently refresh without showing loading state
                console.log(`[Auto-refresh] Refreshing teacher ${sectionName} section...`);
                await window.forceReloadTeacherSection(sectionName);
            } catch (error) {
                console.warn(`[Auto-refresh] Failed to refresh ${sectionName}:`, error);
            }
        };

        // Start interval
        autoRefreshInterval = setInterval(refreshCurrentSection, REFRESH_INTERVAL);
        console.log(`[Auto-refresh] Started for teacher section: ${sectionName} (every ${REFRESH_INTERVAL / 1000}s)`);
    }

    // Start auto-refresh when section changes
    const originalShowTeacherSection = window.showTeacherSection;
    if (originalShowTeacherSection) {
        window.showTeacherSection = async function (sectionName) {
            const result = await originalShowTeacherSection.apply(this, arguments);
            // Start auto-refresh after section loads
            setTimeout(startAutoRefresh, 1000);
            return result;
        };
    }

    // Also start on initial load
    setTimeout(startAutoRefresh, 2000);

    // Pause when tab is hidden, resume when visible
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
                console.log('[Auto-refresh] Paused (tab hidden)');
            }
        } else {
            startAutoRefresh();
            console.log('[Auto-refresh] Resumed (tab visible)');
        }
    });

    window.addEventListener('studyapp:dashboard-event', (ev) => {
        const detail = ev && ev.detail ? ev.detail : {};
        const eventName = detail.event;
        if (!eventName) return;

        const active = document.querySelector('.content-section.active');
        const activeId = active ? active.id : '';

        if (eventName === 'assignment.changed' && activeId === 'my_assignmentsSection') {
            window.forceReloadTeacherSection('my_assignments');
        }
        if (eventName === 'homework.changed' && activeId === 'homeworkSection') {
            window.forceReloadTeacherSection('homework');
        }
        if (eventName === 'exam.changed' && activeId === 'online_examSection') {
            window.forceReloadTeacherSection('online_exam');
        }
        if (eventName === 'announcement.changed') {
            if (activeId === 'announcementsSection') {
                window.forceReloadTeacherSection('announcements');
            } else if (typeof window.loadAnnouncements === 'function') {
                window.loadAnnouncements();
            }
        }
    });
}

// Helper function to load HTML section from Django endpoint
async function loadTeacherHtmlSection(sectionName) {
    const url = teacherSectionUrlMap[sectionName];
    if (!url) throw new Error(`Invalid section: ${sectionName}`);

    try {
        const response = await fetch(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        // Always read the body first so we can surface Django's JSON error payload (including traceback)
        const rawText = await response.text();
        let data = {};
        try {
            data = rawText ? JSON.parse(rawText) : {};
        } catch (e) {
            data = { raw: rawText };
        }

        if (!response.ok) {
            const msg = (data && (data.error || data.detail || data.message)) || `Failed to load section: ${response.status} ${response.statusText}`;
            // If backend returns traceback, log it for fast debugging
            if (data && data.traceback) {
                console.error(`[Teacher Section Error] ${sectionName} traceback:\n${data.traceback}`);
            } else if (rawText) {
                console.error(`[Teacher Section Error] ${sectionName} raw response:\n${rawText}`);
            }
            throw new Error(msg);
        }

        if (data.success && data.html) {
            return data.html;
        } else {
            throw new Error(data.error || 'Failed to load section content');
        }
    } catch (error) {
        console.error(`Error fetching section ${sectionName}:`, error);
        throw error;
    }
}

// Show section - loads content dynamically from Django endpoints
async function showTeacherSection(sectionName) {
    // Save current section to localStorage for page refresh persistence
    if (sectionName) {
        localStorage.setItem('teacher_last_section', sectionName);
    }
    const dynamicContainer = document.getElementById('dynamicContentContainer');

    try {
        // Hide all existing sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
            section.style.display = 'none';
        });

        // Hide dynamic content container initially
        if (dynamicContainer) {
            dynamicContainer.style.display = 'none';
        }

        // Check if section exists in mapping
        if (teacherSectionUrlMap[sectionName]) {
            // Show loading state
            if (dynamicContainer) {
                dynamicContainer.style.display = 'block';
                dynamicContainer.innerHTML = `
                    <div style="text-align: center; padding: 3rem;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #9ca3af;"></i>
                        <p style="margin-top: 1rem; color: #9ca3af;">Loading ${sectionName}...</p>
                    </div>
                `;
            }

            try {
                // Check if already loaded
                let sectionHTML = teacherLoadedSections[sectionName];

                if (!sectionHTML) {
                    // Load the HTML section from Django
                    const htmlContent = await loadTeacherHtmlSection(sectionName);

                    // Extract content and scripts
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');

                    // Find the content section
                    const contentSection = doc.querySelector('.content-section, section[id$="Section"]');

                    // Extract scripts before they get potentially modified
                    const originalScriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
                    const originalScripts = [];
                    let scriptMatch;
                    while ((scriptMatch = originalScriptRegex.exec(htmlContent)) !== null) {
                        const scriptTag = scriptMatch[0];
                        // Skip scripts that are already loaded
                        if (scriptTag.includes('apiClient.js') ||
                            scriptTag.includes('Teacher_Dash.js') ||
                            scriptTag.includes('toastNotifications.js')) {
                            continue;
                        }
                        originalScripts.push(scriptTag);
                    }

                    if (contentSection) {
                        sectionHTML = contentSection.outerHTML;
                        if (originalScripts.length > 0) {
                            const closingTagIndex = sectionHTML.lastIndexOf('</');
                            if (closingTagIndex > 0) {
                                sectionHTML = sectionHTML.substring(0, closingTagIndex) +
                                    originalScripts.join('\n') +
                                    sectionHTML.substring(closingTagIndex);
                            } else {
                                sectionHTML += originalScripts.join('\n');
                            }
                        }
                    } else {
                        sectionHTML = doc.body.innerHTML || htmlContent;
                    }

                    // Cache the loaded content
                    teacherLoadedSections[sectionName] = sectionHTML;
                }

                // Inject content
                if (dynamicContainer) {
                    // Extract and execute scripts
                    const scriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
                    const scriptMatches = [];
                    let match;
                    scriptRegex.lastIndex = 0;
                    while ((match = scriptRegex.exec(sectionHTML)) !== null) {
                        scriptMatches.push(match[0]);
                    }

                    let htmlWithoutScripts = sectionHTML.replace(/<script[\s\S]*?<\/script>/gi, '');
                    dynamicContainer.innerHTML = htmlWithoutScripts;
                    dynamicContainer.style.display = 'block';

                    const injectedSection = dynamicContainer.querySelector('.content-section');
                    if (injectedSection) {
                        injectedSection.classList.add('active');
                        injectedSection.style.display = 'block';
                    }

                    // Execute extracted scripts
                    if (scriptMatches && scriptMatches.length > 0) {
                        scriptMatches.forEach(scriptTag => {
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = scriptTag;
                            const oldScript = tempDiv.querySelector('script');

                            if (oldScript) {
                                const newScript = document.createElement('script');
                                Array.from(oldScript.attributes).forEach(attr => {
                                    newScript.setAttribute(attr.name, attr.value);
                                });
                                newScript.textContent = oldScript.textContent || oldScript.innerHTML;
                                document.body.appendChild(newScript);
                                setTimeout(() => {
                                    if (newScript.parentNode) {
                                        newScript.parentNode.removeChild(newScript);
                                    }
                                }, 100);
                            }
                        });
                    }
                }

                updateTeacherNavigation(sectionName);

                // Initialize real-time messaging when opening Messages section
                if (sectionName === 'messages' && typeof window.initStudyMessagingOnLoad === 'function') {
                    setTimeout(() => {
                        window.initStudyMessagingOnLoad();
                    }, 50);
                }

                // Initialize threads when opening Threads section
                if (sectionName === 'threads') {
                    setTimeout(() => {
                        if (window.StudyThreads && typeof window.StudyThreads.init === 'function') {
                            window.StudyThreads.init();
                        }
                    }, 100);
                }

                if (sectionName === 'feedback' && typeof initializeFeedbackFilters === 'function') {
                    setTimeout(initializeFeedbackFilters, 200);
                }

                // Override renumberQuestions for online_exam section to update counter
                if (sectionName === 'online_exam') {
                    setTimeout(() => {
                        // Override renumberQuestions to also update counter
                        window.renumberQuestions = function (selector) {
                            const questions = document.querySelectorAll(selector);
                            const count = questions.length;
                            
                            // Renumber the questions
                            questions.forEach((q, i) => {
                                const numberElement = q.querySelector('.question-number');
                                if (numberElement) {
                                    numberElement.textContent = `Question ${i + 1}`;
                                }
                            });
                            
                            // Update the counter input based on selector
                            if (selector === '.mcq-question') {
                                const counterInput = document.getElementById('numQuestions');
                                if (counterInput) {
                                    counterInput.value = count;
                                }
                            } else if (selector === '.qa-question') {
                                const counterInput = document.getElementById('numQAQuestions');
                                if (counterInput) {
                                    counterInput.value = count;
                                }
                            }
                        };
                    }, 200); // Wait for template scripts to execute first
                }

                // Initialize homework section - ensure download function is available
                if (sectionName === 'homework') {
                    if (typeof window.downloadHomeworkAttachment === 'undefined') {
                        window.downloadHomeworkAttachment = function(url, filename) {
                            try {
                                // Create a temporary anchor element to trigger download
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = filename || 'attachment';
                                link.style.display = 'none';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                
                                // Show toast notification if available
                                if (typeof window.showToast === 'function') {
                                    window.showToast(`Downloading ${filename || 'file'}...`, 'info');
                                }
                            } catch (error) {
                                console.error('Error downloading attachment:', error);
                                // Fallback: open in new tab if download fails
                                window.open(url, '_blank');
                            }
                        };
                    }
                }

                // Initialize my_assignments section - ensure functions are available
                if (sectionName === 'my_assignments') {
                    setTimeout(() => {
                        console.log('Checking my_assignments functions:', {
                            viewAssignment: typeof window.viewAssignment,
                            startProcess: typeof window.startProcess,
                            downloadAssignment: typeof window.downloadAssignment
                        });
                    }, 150);
                }

            } catch (error) {
                console.error(`Error loading section ${sectionName}:`, error);
                if (dynamicContainer) {
                    dynamicContainer.innerHTML = `
                        <div style="text-align: center; padding: 3rem; color: #ef4444;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                            <h3>Error loading ${sectionName}</h3>
                            <p>${error.message}</p>
                        </div>
                    `;
                    dynamicContainer.style.display = 'block';
                }
            }
        } else {
            console.warn(`No URL mapping found for section: ${sectionName}`);
        }
    } catch (error) {
        console.error('Error in showTeacherSection:', error);
    }
}

// Update navigation active state
function updateTeacherNavigation(activeSection) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const navItem = link.closest('.nav-item');
        if (navItem) {
            navItem.classList.remove('active');
        }
    });

    const activeLink = Array.from(navLinks).find(link => link.getAttribute('data-section') === activeSection);
    if (activeLink) {
        const navItem = activeLink.closest('.nav-item');
        if (navItem) {
            navItem.classList.add('active');
        }
    }
}

// Initialize Teacher Dashboard
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        initializeTeacherDashboard();
    });
} else {
    initializeTeacherDashboard();
}

function initializeTeacherDashboard() {
    // Initialize header interactions
    initializeHeaderInteractions();

    // Initialize notifications unread badge in the header
    initializeTeacherHeaderNotificationBadge();

    // WS-driven section refresh hooks
    // initializeTeacherRealtimeSectionRefresh();

    // Initialize navigation
    initializeNavigation();

    // My Assignments: reliable tab switching (dynamic section injection safe)
    initializeMyAssignmentsTabsOnce();

    const dynamicContainer = document.getElementById('dynamicContentContainer');
    if (!dynamicContainer) {
        console.error('Fatal Error: dynamicContentContainer not found!');
        return;
    }
    const existingSection = dynamicContainer.querySelector('.content-section');
    console.log('Teacher Dashboard Init: existingSection =', existingSection ? existingSection.id : 'null');

    if (!existingSection) {
        // Restore last section or load dashboard by default
        const lastSection = localStorage.getItem('teacher_last_section');
        const defaultSection = lastSection && teacherSectionUrlMap[lastSection] ? lastSection : 'dashboard';
        console.log(`Restoring teacher section: ${defaultSection}${lastSection ? ' (from localStorage)' : ' (default)'}`);
        showTeacherSection(defaultSection);
    } else {
        // Initialize the currently visible section
        const activeSection = dynamicContainer.querySelector('.content-section.active');
        console.log('Teacher Dashboard Init: activeSection =', activeSection ? activeSection.id : 'null');
        if (activeSection) {
            const sectionId = activeSection.id;
            if (sectionId) {
                const sectionName = sectionId.replace('Section', '');
                console.log('Initializing existing section:', sectionName);
                // For teacher, we might need specific initializations
                if (sectionName === 'messages' && typeof window.initStudyMessagingOnLoad === 'function') {
                    setTimeout(() => {
                        window.initStudyMessagingOnLoad();
                    }, 50);
                }
                if (sectionName === 'feedback' && typeof initializeFeedbackFilters === 'function') {
                    setTimeout(initializeFeedbackFilters, 200);
                }
                updateTeacherNavigation(sectionName);
                // Save to localStorage
                localStorage.setItem('teacher_last_section', sectionName);
            }
        }
    }
}

/**
 * My Assignments tab switching
 * - Must work even when section HTML is injected/replaced.
 * - Exposes window.switchTrackerTab used by other flows (e.g. viewRelatedContent()).
 */
function initializeMyAssignmentsTabsOnce() {
    if (window.__teacherMyAssignmentsTabsBound) return;
    window.__teacherMyAssignmentsTabsBound = true;

    // Public helper (used by other scripts)
    window.switchTrackerTab = function (tabKey) {
        const assignmentsSection = document.getElementById('my_assignmentsSection');
        if (!assignmentsSection) return false;

        const key = String(tabKey || '').trim();
        const button = assignmentsSection.querySelector(`.tracker-tab-btn[data-tab="${CSS.escape(key)}"]`);
        if (!button) return false;

        // Activate button
        assignmentsSection.querySelectorAll('.tracker-tab-btn').forEach(b => b.classList.remove('active'));
        button.classList.add('active');

        // Hide all tab contents
        assignmentsSection.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
            content.classList.remove('active');
        });

        const contentIdMap = {
            inProcess: 'inProcessContent',
            completed: 'completedContent',
            cancelled: 'cancelledContent'
        };
        const contentId = contentIdMap[key];
        const contentEl = contentId ? document.getElementById(contentId) : null;
        if (!contentEl) return false;

        contentEl.style.display = 'block';
        contentEl.classList.add('active');
        return true;
    };

    // Delegated click (capture phase so it still works if other handlers stop bubbling)
    document.addEventListener('click', function (e) {
        const btn = e.target && e.target.closest ? e.target.closest('.tracker-tab-btn[data-tab]') : null;
        if (!btn) return;

        const assignmentsSection = btn.closest('#my_assignmentsSection');
        if (!assignmentsSection) return;

        e.preventDefault();
        e.stopPropagation();

        const tab = btn.getAttribute('data-tab');
        window.switchTrackerTab(tab);
    }, true);
}

// Header Interactions
function initializeHeaderInteractions() {
    // Profile dropdown toggle
    const userProfileMenu = document.getElementById('userProfileMenu') || document.querySelector('.user-profile-menu');
    const dropdown = document.getElementById('userDropdown') || document.querySelector('.user-dropdown');
    const chevronIcon = userProfileMenu ? userProfileMenu.querySelector('.fa-chevron-down') : null;

    if (userProfileMenu && dropdown) {
        // Initialize dropdown state
        dropdown.style.display = 'none';
        dropdown.classList.remove('active');
        userProfileMenu.classList.remove('active');

        // Function to update chevron icon state
        function updateChevronIcon(isActive) {
            if (chevronIcon) {
                if (isActive) {
                    chevronIcon.style.transform = 'rotate(180deg)';
                    chevronIcon.style.transition = 'transform 0.3s ease';
                } else {
                    chevronIcon.style.transform = 'rotate(0deg)';
                    chevronIcon.style.transition = 'transform 0.3s ease';
                }
            }
        }

        // Toggle dropdown on click
        userProfileMenu.addEventListener('click', function (e) {
            e.stopPropagation();
            const isVisible = dropdown.style.display === 'block' || dropdown.classList.contains('active');
            const newState = !isVisible;

            if (newState) {
                dropdown.style.display = 'block';
                dropdown.classList.add('active');
                userProfileMenu.classList.add('active');
            } else {
                dropdown.style.display = 'none';
                dropdown.classList.remove('active');
                userProfileMenu.classList.remove('active');
            }
            updateChevronIcon(newState);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function (e) {
            if (!userProfileMenu.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
                dropdown.classList.remove('active');
                userProfileMenu.classList.remove('active');
                updateChevronIcon(false);
            }
        });

        // Note: Dropdown item clicks are handled by the data-open-section handler above
        // This prevents duplicate handling
    }

    // Dark mode toggle
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
        const icon = toggle.querySelector('i');
        const storageKey = 'teacher-dash-theme';
        const storedTheme = localStorage.getItem(storageKey);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // Initialize theme on load
        if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
            document.body.classList.add('dark-mode');
            if (icon) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            }
        } else {
            document.body.classList.remove('dark-mode');
            if (icon) {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            }
        }

        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem(storageKey, isDark ? 'dark' : 'light');
            if (icon) {
                if (isDark) {
                    icon.classList.remove('fa-moon');
                    icon.classList.add('fa-sun');
                } else {
                    icon.classList.remove('fa-sun');
                    icon.classList.add('fa-moon');
                }
            }
        });
    }

    // Header shortcuts (data-open-section)
    // Handle profile menu dropdown items and other data-open-section links
    document.body.addEventListener('click', function (e) {
        // Don't process if clicking on user-profile-menu button itself (only process dropdown items)
        const clickedMenuItem = e.target.closest('.user-profile-menu');
        const clickedDropdownItem = e.target.closest('.dropdown-item');

        if (clickedMenuItem && !clickedDropdownItem) {
            // Clicked on menu button but not on dropdown item - let menu handler deal with it
            return;
        }

        // Check for data-open-section on the clicked element or its parent
        const btn = e.target.closest('[data-open-section]');
        if (!btn) return;

        // Prevent default link behavior
        e.preventDefault();
        e.stopPropagation();

        const sectionKey = btn.getAttribute('data-open-section');
        if (!sectionKey) return;

        // Use showTeacherSection to load content dynamically
        showTeacherSection(sectionKey);

        // If opening notifications, refresh the unread badge (it should show 0 when none)
        if (sectionKey === 'notifications' && typeof window.updateTeacherNotificationUnreadBadge === 'function') {
            setTimeout(() => window.updateTeacherNotificationUnreadBadge(), 0);
        }

        // Close dropdown after section switch
        const currentDropdown = document.querySelector('.user-dropdown');
        if (currentDropdown) {
            currentDropdown.style.display = 'none';
            currentDropdown.classList.remove('active');
        }
        const currentProfileMenu = document.querySelector('.user-profile-menu');
        if (currentProfileMenu) {
            currentProfileMenu.classList.remove('active');
            // Reset chevron icon
            const chevron = currentProfileMenu.querySelector('.fa-chevron-down');
            if (chevron) {
                chevron.style.transform = 'rotate(0deg)';
                chevron.style.transition = 'transform 0.3s ease';
            }
        }
    }, true); // Use capture phase to handle early

    // Dropdown logout handled via hidden form in base template

    // Initialize sidebar toggle
    initializeSidebarToggle();
}

// Sidebar Toggle (for mobile responsive design)
function initializeSidebarToggle() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            document.body.classList.toggle('sidebar-open');

            // Add visual feedback
            if (document.body.classList.contains('sidebar-open')) {
                sidebarToggle.setAttribute('aria-expanded', 'true');
            } else {
                sidebarToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function (e) {
        if (window.innerWidth <= 1024) {
            const isClickInsideSidebar = sidebar && sidebar.contains(e.target);
            const isClickOnToggle = sidebarToggle && sidebarToggle.contains(e.target);

            if (!isClickInsideSidebar && !isClickOnToggle && document.body.classList.contains('sidebar-open')) {
                document.body.classList.remove('sidebar-open');
                if (sidebarToggle) {
                    sidebarToggle.setAttribute('aria-expanded', 'false');
                }
            }
        }
    });

    // Close sidebar when window is resized to desktop size
    window.addEventListener('resize', function () {
        if (window.innerWidth > 1024 && document.body.classList.contains('sidebar-open')) {
            document.body.classList.remove('sidebar-open');
            if (sidebarToggle) {
                sidebarToggle.setAttribute('aria-expanded', 'false');
            }
        }
    });
}

// Navigation Handling
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        // Remove existing listeners to prevent duplicates
        const newLink = link.cloneNode(true);
        link.parentNode.replaceChild(newLink, link);

        newLink.addEventListener('click', handleTeacherNavigation);
    });
}

function handleTeacherNavigation(e) {
    e.preventDefault();
    e.stopPropagation();

    const clickedLink = e.currentTarget;
    const section = clickedLink.getAttribute('data-section');

    if (section) {
        showTeacherSection(section);
    } else {
        console.warn('Navigation link clicked but no data-section attribute found');
    }

    // Close sidebar on mobile when navigating
    if (window.innerWidth <= 1024 && document.body.classList.contains('sidebar-open')) {
        document.body.classList.remove('sidebar-open');
    }
}

// Utility Functions
function showTemporaryMessage(message) {
    const existingMessage = document.querySelector('.temporary-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'temporary-message';
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #1f2937;
        color: white;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        z-index: 1000;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        animation: slideInRight 0.3s ease-out;
    `;
    messageDiv.textContent = message;

    if (!document.querySelector('#temporary-message-styles')) {
        const style = document.createElement('style');
        style.id = 'temporary-message-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 300);
        }
    }, 3000);
}

function showSuccessMessage(message) {
    showTemporaryMessage(message);
}

function showErrorMessage(message) {
    const existingMessage = document.querySelector('.temporary-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'temporary-message';
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #ef4444;
        color: white;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        z-index: 1000;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        animation: slideInRight 0.3s ease-out;
    `;
    messageDiv.textContent = message;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 300);
        }
    }, 3000);
}

// Student Management Action Functions (DB-driven)

function openChatWithStudent(studentUserId) {
    // Navigate to messages section
    showTeacherSection('messages');

    const userId = String(studentUserId || '').trim();
    if (!userId) return;

    // Wait for section to load, then start/open conversation via messaging system
    setTimeout(() => {
        let attempts = 0;
        const maxAttempts = 15;
        const checkInterval = setInterval(async () => {
            attempts++;

            // Ensure messaging is initialized
            if (typeof window.initStudyMessagingOnLoad === 'function') {
                try { window.initStudyMessagingOnLoad(); } catch (e) { }
            }

            if (window.StudyMessaging && typeof window.StudyMessaging.startConversation === 'function') {
                try {
                    await window.StudyMessaging.startConversation(userId);
                    clearInterval(checkInterval);
                    return;
                } catch (e) {
                    // Keep retrying while section loads
                }
            }

            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                showTemporaryMessage('Opening messages... Please select the student from the list.');
            }
        }, 200);
    }, 300);
}

function showStudentAssignments(studentId) {
    // Get student name from the card
    const studentCard = document.querySelector(`.student-card[data-student-id="${studentId}"]`);
    const studentName = studentCard ? studentCard.querySelector('.student-card-name')?.textContent.trim() || 'Student' : 'Student';

    // Update modal title
    const modalTitle = document.getElementById('studentAssignmentsModalTitle');
    if (modalTitle) {
        modalTitle.textContent = `${studentName}'s Assignments`;
    }

    // Populate assignments table from backend
    const tbody = document.getElementById('studentAssignmentsTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--muted);">Loading...</td></tr>';
    }

    fetch(`/account/api/teacher/student/${studentId}/assignments/`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    })
        .then(resp => resp.json())
        .then(data => {
            const assignments = (data && data.success) ? (data.assignments || []) : [];
            if (!tbody) return;

            if (!data || !data.success) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:#ef4444;">${(data && data.error) ? data.error : 'Failed to load assignments'}</td></tr>`;
                return;
            }

            if (assignments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--muted);">No assignments found</td></tr>';
                return;
            }

            tbody.innerHTML = assignments.map(a => `
                <tr class="assignment-row" data-assignment-id="${a.id}">
                    <td class="assignment-id"><code>${a.assignment_code || ''}</code></td>
                    <td class="assignment-title">${a.title || ''}</td>
                    <td class="assignment-service-type">${a.service_type || ''}</td>
                    <td class="assignment-actions-cell">
                        <button class="action-btn track-btn" onclick="trackAssignment('${a.id}', '${a.assignment_code || ''}')" title="Track Assignment">
                            <i class="fas fa-search"></i>
                            Track Assignment
                        </button>
                    </td>
                </tr>
            `).join('');
        })
        .catch(err => {
            console.error('Failed to load student assignments:', err);
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:#ef4444;">Failed to load assignments</td></tr>';
            }
        });

    // Show modal
    const modal = document.getElementById('studentAssignmentsModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeStudentAssignmentsModal() {
    const modal = document.getElementById('studentAssignmentsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function scheduleMeeting(studentId) {
    // Navigate to meetings section
    showTeacherSection('meetings');

    // Wait for section to load, then open form and pre-select student
    setTimeout(() => {
        // Try multiple times as content loads
        let attempts = 0;
        const maxAttempts = 20;
        const checkInterval = setInterval(() => {
            attempts++;
            const modal = document.getElementById('scheduleMeetingModal');
            const studentSelect = document.getElementById('meetingStudentSelect');

            if (modal && studentSelect) {
                // Show the modal
                modal.style.display = 'flex';

                // Pre-select the student
                studentSelect.value = studentId;

                // Ensure the selection is reflected if there are any other listeners
                const event = new Event('change', { bubbles: true });
                studentSelect.dispatchEvent(event);

                clearInterval(checkInterval);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                showTemporaryMessage('Please use the "Schedule Meeting" button in the Meetings section.');
            }
        }, 300);
    }, 500);
}

function openScheduleMeetingForm() {
    const modal = document.getElementById('scheduleMeetingModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeScheduleMeetingForm() {
    const modal = document.getElementById('scheduleMeetingModal');
    const form = document.getElementById('scheduleMeetingForm');
    if (modal) {
        modal.style.display = 'none';
    }
    if (form) {
        form.reset();
    }
}

function openFeedback(studentId) {
    // Get student info from the card
    const studentCard = document.querySelector(`.student-card[data-student-id="${studentId}"]`);
    const studentName = studentCard ? studentCard.querySelector('.student-card-name')?.textContent.trim() || 'Student' : 'Student';
    const studentIdCode = studentCard ? studentCard.querySelector('.student-card-id')?.textContent.replace('ID: ', '').trim() : '';

    // Populate modal
    const feedbackStudentId = document.getElementById('feedbackStudentId');
    const feedbackStudentInfo = document.getElementById('feedbackStudentInfo');

    if (feedbackStudentId) {
        feedbackStudentId.value = studentId;
    }
    if (feedbackStudentInfo) {
        feedbackStudentInfo.textContent = `Student: ${studentName}${studentIdCode ? ' (' + studentIdCode + ')' : ''}`;
    }

    // Show modal
    const modal = document.getElementById('feedbackModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    const form = document.getElementById('feedbackForm');
    if (modal) {
        modal.style.display = 'none';
    }
    if (form) {
        form.reset();
    }
}

function openReport(studentId) {
    // Get student info from the card
    const studentCard = document.querySelector(`.student-card[data-student-id="${studentId}"]`);
    const studentName = studentCard ? studentCard.querySelector('.student-card-name')?.textContent.trim() || 'Student' : 'Student';
    const studentIdCode = studentCard ? studentCard.querySelector('.student-card-id')?.textContent.replace('ID: ', '').trim() : '';

    // Populate modal
    const reportStudentId = document.getElementById('reportStudentId');
    const reportStudentInfo = document.getElementById('reportStudentInfo');
    const reportDate = document.getElementById('reportDate');

    if (reportStudentId) {
        reportStudentId.value = studentId;
    }
    if (reportStudentInfo) {
        reportStudentInfo.textContent = `Student: ${studentName}${studentIdCode ? ' (' + studentIdCode + ')' : ''}`;
    }
    if (reportDate) {
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        reportDate.value = today;
    }

    // Show modal
    const modal = document.getElementById('reportModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');
    const form = document.getElementById('reportForm');
    if (modal) {
        modal.style.display = 'none';
    }
    if (form) {
        form.reset();
    }
}

function trackAssignment(assignmentId, assignmentCode) {
    // Close the modal
    closeStudentAssignmentsModal();

    // Navigate to My Assignments tab
    showTeacherSection('my_assignments');

    // Wait for the assignments section to load, then highlight the assignment
    setTimeout(() => {
        // Find the assignment row by assignment ID or code
        const assignmentRows = document.querySelectorAll('.assignment-row');
        let targetRow = null;

        assignmentRows.forEach(row => {
            const rowAssignmentId = row.querySelector('.assignment-id code')?.textContent.trim();
            if (rowAssignmentId === assignmentCode) {
                targetRow = row;
            }
        });

        if (targetRow) {
            // Highlight the row
            targetRow.style.backgroundColor = 'rgba(17, 88, 229, 0.1)';
            targetRow.style.borderLeft = '4px solid #1158e5';

            // Scroll to the row
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Remove highlight after 3 seconds
            setTimeout(() => {
                targetRow.style.backgroundColor = '';
                targetRow.style.borderLeft = '';
            }, 3000);
        }
    }, 500);
}

// View related content from feedback - navigates to my assignments completed tab
function viewRelatedContent(feedbackId, contentType) {
    // Get the feedback item to extract assignment ID
    const feedbackItem = document.querySelector(`.feedback-item[data-feedback-id="${feedbackId}"]`);
    if (!feedbackItem) {
        console.error('Feedback item not found:', feedbackId);
        return;
    }

    const assignmentId = feedbackItem.getAttribute('data-assignment-id');
    if (!assignmentId) {
        console.error('Assignment ID not found in feedback item:', feedbackId);
        return;
    }

    // Navigate to My Assignments section
    showTeacherSection('my_assignments');

    // Wait for the section to load, then switch to completed tab and highlight assignment
    const checkAndNavigate = (attempts = 0) => {
        const assignmentsSection = document.getElementById('my_assignmentsSection');
        const completedTab = document.querySelector('.tracker-tab-btn[data-tab="completed"]');
        const completedContent = document.getElementById('completedContent');

        if (assignmentsSection && completedTab && completedContent) {
            // Ensure section is visible
            if (assignmentsSection.style.display === 'none') {
                assignmentsSection.style.display = 'block';
            }

            // Switch to completed tab
            if (typeof window.switchTrackerTab === 'function') {
                window.switchTrackerTab('completed');
            } else {
                // Fallback: manually switch tabs
                document.querySelectorAll('.tracker-tab-btn').forEach(tab => {
                    tab.classList.remove('active');
                });
                completedTab.classList.add('active');

                // Hide all tab content
                document.querySelectorAll('.tracker-content .tab-content').forEach(content => {
                    content.classList.remove('active');
                    content.style.display = 'none';
                });

                // Show completed content
                completedContent.classList.add('active');
                completedContent.style.display = 'block';
            }

            // Wait a bit more for tab content to render, then find and highlight assignment
            setTimeout(() => {
                const assignmentRows = document.querySelectorAll('.assignment-row');
                let targetRow = null;

                assignmentRows.forEach(row => {
                    const rowAssignmentId = row.querySelector('.assignment-id code')?.textContent.trim();
                    if (rowAssignmentId === assignmentId) {
                        targetRow = row;
                    }
                });

                if (targetRow) {
                    // Ensure assignment is marked as completed
                    const statusCell = targetRow.querySelector('.assignment-status');
                    if (statusCell) {
                        const statusBadge = statusCell.querySelector('.status-badge');
                        if (statusBadge && !statusBadge.classList.contains('completed')) {
                            // Mark as completed
                            statusBadge.className = 'status-badge completed';
                            statusBadge.innerHTML = '<i class="fas fa-check"></i> <span class="status-text">COMPLETED</span>';
                        }
                    }

                    // Highlight the row with a more prominent style
                    targetRow.style.backgroundColor = 'rgba(17, 88, 229, 0.15)';
                    targetRow.style.borderLeft = '5px solid #1158e5';
                    targetRow.style.boxShadow = '0 2px 8px rgba(17, 88, 229, 0.2)';
                    targetRow.classList.add('highlighted-assignment');

                    // Scroll to the row
                    setTimeout(() => {
                        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);

                    // Remove highlight after 5 seconds
                    setTimeout(() => {
                        targetRow.style.backgroundColor = '';
                        targetRow.style.borderLeft = '';
                        targetRow.style.boxShadow = '';
                        targetRow.classList.remove('highlighted-assignment');
                    }, 5000);
                } else {
                    console.warn('Assignment not found in completed tab:', assignmentId);
                }
            }, 300);
        } else if (attempts < 20) {
            // Retry after 100ms if section not loaded yet
            setTimeout(() => checkAndNavigate(attempts + 1), 100);
        } else {
            console.error('Failed to load assignments section after multiple attempts');
        }
    };

    // Start checking after initial delay
    setTimeout(() => checkAndNavigate(), 300);
}

// Make function globally accessible
window.viewRelatedContent = viewRelatedContent;

// Filter Feedback function - filters by priority, type, and search text
function filterFeedback() {
    const priorityFilter = document.getElementById('feedbackPriorityFilter');
    const typeFilter = document.getElementById('feedbackTypeFilter');
    const searchInput = document.getElementById('feedbackSearchInput');
    const feedbackListContainer = document.getElementById('feedbackListContainer');
    const feedbackEmpty = document.getElementById('feedbackEmpty');

    if (!priorityFilter || !typeFilter || !feedbackListContainer) {
        console.error('Filter elements not found');
        return;
    }

    const selectedPriority = priorityFilter.value;
    const selectedType = typeFilter.value;
    const searchText = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // Get all feedback items
    const feedbackItems = feedbackListContainer.querySelectorAll('.feedback-item');
    let visibleCount = 0;

    feedbackItems.forEach(item => {
        let shouldShow = true;

        // Filter by priority
        if (selectedPriority !== 'all') {
            const itemPriority = item.getAttribute('data-priority');
            if (itemPriority !== selectedPriority) {
                shouldShow = false;
            }
        }

        // Filter by type
        if (shouldShow && selectedType !== 'all') {
            const itemType = item.getAttribute('data-type');
            if (itemType !== selectedType) {
                shouldShow = false;
            }
        }

        // Filter by search text
        if (shouldShow && searchText) {
            const title = item.querySelector('.feedback-content-title')?.textContent.toLowerCase() || '';
            const message = item.querySelector('.feedback-message p')?.textContent.toLowerCase() || '';
            const studentInfo = item.querySelector('.feedback-student-info span')?.textContent.toLowerCase() || '';
            const typeBadge = item.querySelector('.feedback-type-badge')?.textContent.toLowerCase() || '';

            const searchableText = `${title} ${message} ${studentInfo} ${typeBadge}`;
            if (!searchableText.includes(searchText)) {
                shouldShow = false;
            }
        }

        // Show or hide the item
        if (shouldShow) {
            item.style.display = '';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });

    // Show/hide empty state
    if (feedbackEmpty) {
        if (visibleCount === 0) {
            feedbackEmpty.style.display = 'block';
            feedbackListContainer.style.display = 'none';
        } else {
            feedbackEmpty.style.display = 'none';
            feedbackListContainer.style.display = '';
        }
    }
}

// Initialize search input listener
function initializeFeedbackFilters() {
    const searchInput = document.getElementById('feedbackSearchInput');
    if (searchInput) {
        // Remove existing listeners by cloning and replacing
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        // Add event listener for search
        newSearchInput.addEventListener('input', filterFeedback);
        newSearchInput.addEventListener('keyup', filterFeedback);
    }

    // Initial filter application
    filterFeedback();
}

// Make function globally accessible
window.filterFeedback = filterFeedback;
window.initializeFeedbackFilters = initializeFeedbackFilters;

// Initialize filters when feedback section is loaded
document.addEventListener('DOMContentLoaded', function () {
    // Check if feedback section exists and initialize filters
    const feedbackSection = document.getElementById('adminFeedbackSection');
    if (feedbackSection) {
        // Use MutationObserver to detect when section becomes visible
        const observer = new MutationObserver(function (mutations) {
            if (feedbackSection.style.display !== 'none' && feedbackSection.offsetParent !== null) {
                setTimeout(initializeFeedbackFilters, 100);
            }
        });

        observer.observe(feedbackSection, {
            attributes: true,
            attributeFilter: ['style'],
            childList: false,
            subtree: false
        });

        // Also check immediately if section is already visible
        if (feedbackSection.style.display !== 'none') {
            setTimeout(initializeFeedbackFilters, 100);
        }
    }
});

// Initialize form handlers when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Feedback form submission
    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const formData = new FormData(this);
            const feedbackData = {
                student_id: formData.get('student_id'),
                feedback_type: formData.get('feedback_type'),
                subject: formData.get('subject'),
                message: formData.get('message'),
                priority: formData.get('priority'),
                submitted_by: 'teacher',
                submitted_at: new Date().toISOString()
            };

            try {
                const resp = await fetch('/account/api/teacher/student-feedback/submit/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    body: JSON.stringify(feedbackData)
                });
                const data = await resp.json();
                if (data && data.success) {
                    showSuccessMessage('Feedback submitted successfully! Admin has been notified.');
                    closeFeedbackModal();
                } else {
                    showTemporaryMessage((data && data.error) ? data.error : 'Failed to submit feedback.');
                }
            } catch (err) {
                console.error('Feedback submit failed:', err);
                showTemporaryMessage('Failed to submit feedback.');
            }
        });
    }

    // Report form submission
    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const formData = new FormData(this);
            const reportData = {
                student_id: formData.get('student_id'),
                report_type: formData.get('report_type'),
                title: formData.get('title'),
                description: formData.get('description'),
                report_date: formData.get('report_date'),
                severity: formData.get('severity'),
                submitted_by: 'teacher',
                submitted_at: new Date().toISOString()
            };

            try {
                const resp = await fetch('/account/api/teacher/student-report/submit/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    body: JSON.stringify(reportData)
                });
                const data = await resp.json();
                if (data && data.success) {
                    showSuccessMessage('Report submitted successfully! Admin has been notified.');
                    closeReportModal();
                } else {
                    showTemporaryMessage((data && data.error) ? data.error : 'Failed to submit report.');
                }
            } catch (err) {
                console.error('Report submit failed:', err);
                showTemporaryMessage('Failed to submit report.');
            }
        });
    }

    // Close modals when clicking outside
    const feedbackModal = document.getElementById('feedbackModal');
    if (feedbackModal) {
        feedbackModal.addEventListener('click', function (e) {
            if (e.target === feedbackModal) {
                closeFeedbackModal();
            }
        });
    }

    const reportModal = document.getElementById('reportModal');
    if (reportModal) {
        reportModal.addEventListener('click', function (e) {
            if (e.target === reportModal) {
                closeReportModal();
            }
        });
    }

    const assignmentsModal = document.getElementById('studentAssignmentsModal');
    if (assignmentsModal) {
        assignmentsModal.addEventListener('click', function (e) {
            if (e.target === assignmentsModal) {
                closeStudentAssignmentsModal();
            }
        });
    }

    // Announcement Modal Event Listeners
    const announcementModal = document.getElementById('createAnnouncementModal');
    if (announcementModal) {
        announcementModal.addEventListener('click', function (e) {
            if (e.target === announcementModal) {
                closeCreateAnnouncementModal();
            }
        });
    }

    // Character count for announcement content textarea
    const contentTextarea = document.getElementById('announcementContent');
    const characterCount = document.getElementById('contentCharacterCount');
    if (contentTextarea && characterCount) {
        contentTextarea.addEventListener('input', function () {
            const count = this.value.length;
            characterCount.textContent = count;

            if (count > 2000) {
                characterCount.style.color = '#ef4444';
            } else if (count > 1800) {
                characterCount.style.color = '#f59e0b';
            } else {
                characterCount.style.color = 'var(--muted)';
            }
        });
    }

    // Tags input functionality
    const tagsInput = document.getElementById('announcementTags');
    const tagsPreview = document.getElementById('tagsPreview');
    if (tagsInput && tagsPreview) {
        function renderTags() {
            tagsPreview.innerHTML = '';
            announcementTags.forEach((tag, index) => {
                const tagChip = document.createElement('div');
                tagChip.className = 'tag-chip';
                tagChip.innerHTML = `
                    <span>${tag}</span>
                    <button type="button" class="tag-remove" onclick="removeAnnouncementTag(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                tagsPreview.appendChild(tagChip);
            });
        }

        tagsInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && this.value.trim()) {
                e.preventDefault();
                const tag = this.value.trim();
                if (!announcementTags.includes(tag) && tag.length > 0) {
                    announcementTags.push(tag);
                    renderTags();
                    this.value = '';
                }
            }
        });

        window.removeAnnouncementTag = function (index) {
            announcementTags.splice(index, 1);
            renderTags();
        };
    }

    // Recipient checkbox listeners
    const recipientCheckboxes = document.querySelectorAll('.recipient-checkbox-modern');
    recipientCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectedRecipientsCount);
    });

    // Quick select checkboxes
    const selectAllStudents = document.getElementById('selectAllStudents');
    const selectAllTeachers = document.getElementById('selectAllTeachers');
    const selectAllCSReps = document.getElementById('selectAllCSReps');

    if (selectAllStudents) {
        selectAllStudents.addEventListener('change', function () {
            updateSelectedRecipientsCount();
        });
    }

    if (selectAllTeachers) {
        selectAllTeachers.addEventListener('change', function () {
            updateSelectedRecipientsCount();
        });
    }

    if (selectAllCSReps) {
        selectAllCSReps.addEventListener('change', function () {
            updateSelectedRecipientsCount();
        });
    }

    // Close modal with Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && announcementModal && announcementModal.style.display === 'flex') {
            closeCreateAnnouncementModal();
        }
    });
});

// ============================================================================
// Announcement Modal Functions
// ============================================================================

// Global tags array for announcements
let announcementTags = [];

function openCreateAnnouncementModal() {
    try {
        console.log('Opening announcement modal...');
        const modal = document.getElementById('createAnnouncementModal');
        if (!modal) {
            console.error('Announcement modal not found!');
            alert('Error: Announcement modal not found. Please refresh the page.');
            return;
        }

        console.log('Modal found, setting display to flex...');
        // Force display to flex and ensure visibility
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        // Ensure modal is visible
        setTimeout(() => {
            if (modal.style.display !== 'flex') {
                modal.style.display = 'flex';
            }
        }, 10);

        // Reset form
        const form = document.getElementById('announcementForm');
        if (form) {
            form.reset();
        }

        const panel = document.getElementById('specificRecipientsPanel');
        if (panel) {
            panel.style.display = 'none';
        }

        const selectSpecific = document.getElementById('selectSpecific');
        if (selectSpecific) {
            selectSpecific.checked = false;
        }

        // Reset tags
        announcementTags = [];
        const tagsPreview = document.getElementById('tagsPreview');
        if (tagsPreview) {
            tagsPreview.innerHTML = '';
        }

        // Reset character count
        const characterCount = document.getElementById('contentCharacterCount');
        if (characterCount) {
            characterCount.textContent = '0';
        }

        // Update recipient count - wrap in try-catch to prevent blocking
        try {
            if (typeof updateSelectedRecipientsCount === 'function') {
                updateSelectedRecipientsCount();
            }
        } catch (countError) {
            console.warn('Error updating recipient count:', countError);
            // Don't block modal opening if count update fails
        }

        console.log('Modal opened successfully');
    } catch (error) {
        console.error('Error opening announcement modal:', error);
        console.error('Error stack:', error.stack);
        alert('Error opening announcement modal: ' + error.message + '\n\nPlease check the console (F12) for more details.');
    }
}

function closeCreateAnnouncementModal() {
    const modal = document.getElementById('createAnnouncementModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
    }
}

function toggleSpecificRecipients() {
    const selectSpecific = document.getElementById('selectSpecific');
    const panel = document.getElementById('specificRecipientsPanel');
    if (selectSpecific && panel) {
        if (selectSpecific.checked) {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
            document.querySelectorAll('#specificRecipientsPanel .recipient-checkbox-modern').forEach(cb => {
                cb.checked = false;
            });
        }
        updateSelectedRecipientsCount();
    }
}

function switchRecipientTab(tabName) {
    document.querySelectorAll('.recipient-tab-modern').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.recipient-list-modern').forEach(list => {
        list.classList.remove('active');
        list.style.display = 'none';
    });
    const activeTab = document.querySelector(`.recipient-tab-modern[data-tab="${tabName}"]`);
    const activeList = document.getElementById(`${tabName}List`);
    if (activeTab) activeTab.classList.add('active');
    if (activeList) {
        activeList.classList.add('active');
        activeList.style.display = 'block';
    }

    // Clear search when switching tabs
    const searchInput = document.getElementById('recipientSearch');
    if (searchInput) {
        searchInput.value = '';
        clearRecipientSearch();
    }
}

function filterRecipients() {
    const searchQuery = document.getElementById('recipientSearch')?.value.toLowerCase() || '';
    const activeList = document.querySelector('.recipient-list-modern.active');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (!activeList) return;

    const items = activeList.querySelectorAll('.recipient-item-modern');
    items.forEach(item => {
        const name = item.querySelector('.recipient-name-modern')?.textContent.toLowerCase() || '';
        const email = item.querySelector('.recipient-email-modern')?.textContent.toLowerCase() || '';
        item.style.display = (name.includes(searchQuery) || email.includes(searchQuery)) ? 'flex' : 'none';
    });

    // Show/hide clear button
    if (clearBtn) {
        clearBtn.style.display = searchQuery ? 'flex' : 'none';
    }
}

function clearRecipientSearch() {
    const searchInput = document.getElementById('recipientSearch');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (searchInput) {
        searchInput.value = '';
        filterRecipients();
    }

    if (clearBtn) {
        clearBtn.style.display = 'none';
    }
}

function selectAllInList(listType) {
    const list = document.getElementById(`${listType}List`);
    if (!list) return;

    const checkboxes = list.querySelectorAll('.recipient-checkbox-modern');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);

    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });

    updateSelectedRecipientsCount();
}

function updateSelectedRecipientsCount() {
    try {
        const selectAllStudents = document.getElementById('selectAllStudents')?.checked || false;
        const selectAllTeachers = document.getElementById('selectAllTeachers')?.checked || false;
        const selectAllCSReps = document.getElementById('selectAllCSReps')?.checked || false;
        const selectSpecific = document.getElementById('selectSpecific')?.checked || false;
        let count = 0;

        if (selectAllStudents) {
            const studentsList = document.querySelectorAll('#studentsList .recipient-item-modern');
            count += studentsList ? studentsList.length : 0;
        }
        if (selectAllTeachers) {
            const teachersList = document.querySelectorAll('#teachersList .recipient-item-modern');
            count += teachersList ? teachersList.length : 0;
        }
        if (selectAllCSReps) {
            const csrepsList = document.querySelectorAll('#csrepsList .recipient-item-modern');
            count += csrepsList ? csrepsList.length : 0;
        }
        if (selectSpecific) {
            const checkedBoxes = document.querySelectorAll('#specificRecipientsPanel .recipient-checkbox-modern:checked');
            count = checkedBoxes ? checkedBoxes.length : 0;
        }

        const countSpan = document.getElementById('selectedRecipientsCount');
        const summary = document.getElementById('selectedRecipientsSummary');
        if (countSpan) {
            countSpan.textContent = count;
        }
        if (summary) {
            summary.style.display = (count > 0 || selectAllStudents || selectAllTeachers || selectAllCSReps) ? 'flex' : 'none';
        }
    } catch (error) {
        console.warn('Error in updateSelectedRecipientsCount:', error);
        // Don't throw - just log the warning
    }
}

function removeAnnouncementTag(index) {
    if (Array.isArray(announcementTags)) {
        announcementTags.splice(index, 1);
        const tagsPreview = document.getElementById('tagsPreview');
        if (tagsPreview) {
            tagsPreview.innerHTML = '';
            announcementTags.forEach((tag, idx) => {
                const tagChip = document.createElement('div');
                tagChip.className = 'tag-chip';
                tagChip.innerHTML = `
                    <span>${tag}</span>
                    <button type="button" class="tag-remove" onclick="removeAnnouncementTag(${idx})">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                tagsPreview.appendChild(tagChip);
            });
        }
    }
}

async function loadAnnouncements() {
    const container = document.querySelector('.announcements-container');
    const emptyState = document.querySelector('.announcements-empty');
    if (!container) return;

    try {
        const response = await apiClient.getAnnouncements();
        if (response.success) {
            const announcements = response.announcements;
            if (announcements.length === 0) {
                container.innerHTML = '';
                if (emptyState) emptyState.style.display = 'block';
                return;
            }

            if (emptyState) emptyState.style.display = 'none';
            container.innerHTML = announcements.map(ann => {
                const priorityClass = ann.priority;
                const date = new Date(ann.created_at).toLocaleString();
                const tagsHtml = (ann.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('');

                let recipientsArr = [];
                if (ann.all_students) recipientsArr.push('All Students');
                if (ann.all_teachers) recipientsArr.push('All Teachers');
                if (ann.all_csreps) recipientsArr.push('All CS Reps');

                let recipientsText = recipientsArr.join(', ');
                if (recipientsText && ann.specific_recipients_count > 0) {
                    recipientsText += ' & Specific Recipients';
                } else if (!recipientsText && ann.specific_recipients_count > 0) {
                    recipientsText = 'Specific Recipients';
                } else if (!recipientsText) {
                    recipientsText = 'No recipients';
                }

                return `
                    <div class="announcement-item" data-id="${ann.id}">
                        <div class="announcement-header">
                            <div class="announcement-author">
                                <div class="author-avatar">
                                    ${ann.author_avatar ? `<img src="${ann.author_avatar}" alt="${ann.author_name}">` : '<div class="avatar-fallback">👤</div>'}
                                </div>
                                <div class="author-info">
                                    <div class="author-name">${ann.author_name}</div>
                                    <div class="announcement-date">${date}</div>
                                </div>
                            </div>
                            <div class="announcement-badge ${priorityClass}">
                                <i class="fas ${ann.priority === 'urgent' ? 'fa-exclamation-triangle' : (ann.priority === 'important' ? 'fa-star' : 'fa-info-circle')}"></i>
                                ${ann.priority.charAt(0).toUpperCase() + ann.priority.slice(1)}
                            </div>
                            ${ann.is_author ? `
                                <button class="delete-announcement-btn" onclick="confirmDeleteAnnouncement(${ann.id})" title="Delete Announcement">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                        <div class="announcement-content">
                            <h3 class="announcement-title">${ann.title}</h3>
                            <p class="announcement-text">${ann.content}</p>
                        </div>
                        <div class="announcement-footer">
                            <div class="announcement-tags">
                                ${tagsHtml}
                            </div>
                            <div class="announcement-recipients">
                                <i class="fas fa-users"></i>
                                <span>Sent to: ${recipientsText}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

async function confirmDeleteAnnouncement(id) {
    if (confirm('Are you sure you want to delete this announcement?')) {
        try {
            const response = await apiClient.deleteAnnouncement(id);
            if (response.success) {
                if (typeof showSuccessMessage === 'function') {
                    showSuccessMessage('Announcement deleted successfully!');
                } else {
                    alert('Announcement deleted successfully!');
                }
                loadAnnouncements();
            } else {
                if (typeof showErrorMessage === 'function') {
                    showErrorMessage(response.error || 'Failed to delete announcement.');
                } else {
                    alert(response.error || 'Failed to delete announcement.');
                }
            }
        } catch (error) {
            console.error('Error deleting announcement:', error);
            if (typeof showErrorMessage === 'function') {
                showErrorMessage('An error occurred while deleting the announcement.');
            } else {
                alert('An error occurred while deleting the announcement.');
            }
        }
    }
}

async function fetchAnnouncementRecipients() {
    try {
        const response = await apiClient.getAnnouncementRecipients();
        if (response.success) {
            const studentsList = document.getElementById('studentsList')?.querySelector('.recipient-items-wrapper');
            const teachersList = document.getElementById('teachersList')?.querySelector('.recipient-items-wrapper');
            const csrepsList = document.getElementById('csrepsList')?.querySelector('.recipient-items-wrapper');

            if (studentsList) {
                studentsList.innerHTML = response.students.map(s => `
                    <label class="recipient-item-modern">
                        <input type="checkbox" class="recipient-checkbox-modern"
                            value="${s.id}" data-name="${s.name}"
                            data-email="${s.email}">
                        <div class="recipient-avatar-modern">
                            ${s.avatar ? `<img src="${s.avatar}" alt="${s.name}">` : `<div class="avatar-fallback">${s.name.split(' ').map(n => n[0]).join('')}</div>`}
                        </div>
                        <div class="recipient-details-modern">
                            <div class="recipient-name-modern">${s.name}</div>
                            <div class="recipient-email-modern">${s.email}</div>
                        </div>
                    </label>
                `).join('');
            }

            if (teachersList) {
                teachersList.innerHTML = response.teachers.map(t => `
                    <label class="recipient-item-modern">
                        <input type="checkbox" class="recipient-checkbox-modern"
                            value="${t.id}" data-name="${t.name}"
                            data-email="${t.email}">
                        <div class="recipient-avatar-modern">
                            ${t.avatar ? `<img src="${t.avatar}" alt="${t.name}">` : `<div class="avatar-fallback">${t.name.split(' ').map(n => n[0]).join('')}</div>`}
                        </div>
                        <div class="recipient-details-modern">
                            <div class="recipient-name-modern">${t.name}</div>
                            <div class="recipient-email-modern">${t.email}</div>
                        </div>
                    </label>
                `).join('');
            }

            if (csrepsList) {
                csrepsList.innerHTML = (response.csreps || []).map(c => `
                    <label class="recipient-item-modern">
                        <input type="checkbox" class="recipient-checkbox-modern"
                            value="${c.id}" data-name="${c.name}"
                            data-email="${c.email}">
                        <div class="recipient-avatar-modern">
                            ${c.avatar ? `<img src="${c.avatar}" alt="${c.name}">` : `<div class="avatar-fallback">${c.name.split(' ').map(n => n[0]).join('')}</div>`}
                        </div>
                        <div class="recipient-details-modern">
                            <div class="recipient-name-modern">${c.name}</div>
                            <div class="recipient-email-modern">${c.email}</div>
                        </div>
                    </label>
                `).join('');
            }

            // Add event listeners to new checkboxes
            document.querySelectorAll('.recipient-checkbox-modern').forEach(cb => {
                cb.addEventListener('change', updateSelectedRecipientsCount);
            });

            // Update counts in tabs
            const studentCountEl = document.getElementById('studentsCount');
            const teacherCountEl = document.getElementById('teachersCount');
            const csrepCountEl = document.getElementById('csrepsCount');
            const allStudentsCountEl = document.getElementById('allStudentsCount');
            const allTeachersCountEl = document.getElementById('allTeachersCount');
            const allCSRepsCountEl = document.getElementById('allCSRepsCount');

            if (studentCountEl) studentCountEl.textContent = response.students.length;
            if (teacherCountEl) teacherCountEl.textContent = response.teachers.length;
            if (csrepCountEl) csrepCountEl.textContent = (response.csreps || []).length;
            if (allStudentsCountEl) allStudentsCountEl.textContent = response.students.length;
            if (allTeachersCountEl) allTeachersCountEl.textContent = response.teachers.length;
            if (allCSRepsCountEl) allCSRepsCountEl.textContent = (response.csreps || []).length;
        }
    } catch (error) {
        console.error('Error fetching recipients:', error);
    }
}

async function submitAnnouncement() {
    const form = document.getElementById('announcementForm');
    if (!form) return;
    const title = document.getElementById('announcementTitle')?.value.trim();
    const content = document.getElementById('announcementContent')?.value.trim();
    const priority = document.querySelector('input[name="announcementPriority"]:checked')?.value || 'general';
    const tags = announcementTags || [];

    if (!title || !content) {
        if (typeof showErrorMessage === 'function') {
            showErrorMessage('Please fill in all required fields.');
        } else {
            alert('Please fill in all required fields.');
        }
        return;
    }

    const selectAllStudents = document.getElementById('selectAllStudents')?.checked || false;
    const selectAllTeachers = document.getElementById('selectAllTeachers')?.checked || false;
    const selectAllCSReps = document.getElementById('selectAllCSReps')?.checked || false;
    const selectSpecific = document.getElementById('selectSpecific')?.checked || false;

    const specific_ids = selectSpecific ? Array.from(document.querySelectorAll('#specificRecipientsPanel .recipient-checkbox-modern:checked')).map(cb => cb.value) : [];

    if (!selectAllStudents && !selectAllTeachers && !selectAllCSReps && specific_ids.length === 0) {
        if (typeof showErrorMessage === 'function') {
            showErrorMessage('Please select at least one recipient.');
        } else {
            alert('Please select at least one recipient.');
        }
        return;
    }

    // Create announcement data
    const announcementData = {
        title,
        content,
        priority,
        tags: tags,
        all_students: selectAllStudents,
        all_teachers: selectAllTeachers,
        all_csreps: selectAllCSReps,
        specific_ids: specific_ids,
        send_email: true,
        pin_to_dashboard: false,
        scheduled_at: document.querySelector('input[name="scheduleOption"]:checked')?.value === 'later' ? document.getElementById('scheduledDateTime')?.value : null
    };

    try {
        const response = await apiClient.createAnnouncement(announcementData);
        if (response.success) {
            if (typeof showSuccessMessage === 'function') {
                showSuccessMessage('Announcement created successfully!');
            } else {
                alert('Announcement created successfully!');
            }
            closeCreateAnnouncementModal();
            loadAnnouncements();
        } else {
            if (typeof showErrorMessage === 'function') {
                showErrorMessage(response.error || 'Failed to create announcement.');
            } else {
                alert(response.error || 'Failed to create announcement.');
            }
        }
    } catch (error) {
        console.error('Error creating announcement:', error);
        if (typeof showErrorMessage === 'function') {
            showErrorMessage('An error occurred while creating the announcement.');
        } else {
            alert('An error occurred while creating the announcement.');
        }
    }
}

// Export functions for global use
window.showTeacherSection = showTeacherSection;
window.openSection = showTeacherSection; // Alias for compatibility
window.showTemporaryMessage = showTemporaryMessage;
window.showSuccessMessage = showSuccessMessage;
window.showErrorMessage = showErrorMessage;
window.openChatWithStudent = openChatWithStudent;
window.showStudentAssignments = showStudentAssignments;
window.closeStudentAssignmentsModal = closeStudentAssignmentsModal;
window.scheduleMeeting = scheduleMeeting;
window.openScheduleMeetingForm = openScheduleMeetingForm;
window.closeScheduleMeetingForm = closeScheduleMeetingForm;
window.openFeedback = openFeedback;
window.closeFeedbackModal = closeFeedbackModal;
window.openReport = openReport;
window.closeReportModal = closeReportModal;
window.trackAssignment = trackAssignment;
// Announcement modal functions
window.openCreateAnnouncementModal = openCreateAnnouncementModal;
window.closeCreateAnnouncementModal = closeCreateAnnouncementModal;
window.toggleSpecificRecipients = toggleSpecificRecipients;
window.switchRecipientTab = switchRecipientTab;
window.filterRecipients = filterRecipients;
window.clearRecipientSearch = clearRecipientSearch;
window.selectAllInList = selectAllInList;
window.submitAnnouncement = submitAnnouncement;
window.removeAnnouncementTag = removeAnnouncementTag;
window.updateSelectedRecipientsCount = updateSelectedRecipientsCount;
window.loadAnnouncements = loadAnnouncements;
window.confirmDeleteAnnouncement = confirmDeleteAnnouncement;
window.fetchAnnouncementRecipients = fetchAnnouncementRecipients;
