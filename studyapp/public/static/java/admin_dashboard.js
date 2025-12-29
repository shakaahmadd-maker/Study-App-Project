// Admin Dashboard JavaScript Functionality

document.addEventListener('DOMContentLoaded', function () {
    initializeAdminDashboard();
});

function initializeAdminDashboard() {
    // Initialize navigation
    initializeNavigation();

    // Initialize search functionality
    initializeSearch();

    // Initialize contact filtering
    initializeContactFiltering();

    // Initialize form handlers
    initializeFormHandlers();

    // Initialize password generation
    initializePasswordGeneration();

    // Initialize header interactions
    initializeHeaderInteractions();

    // Initialize writing tracker tab
    initializeAdminWritings();

    // Show the default section (students)
    showSection('students');
}

function initializeHeaderInteractions() {
    // User profile dropdown
    const userProfileMenu = document.querySelector('.user-profile-menu');
    const dropdown = document.querySelector('.user-dropdown');

    if (userProfileMenu && dropdown) {
        userProfileMenu.addEventListener('click', function (e) {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function () {
            dropdown.style.display = 'none';
        });
    }

    // Dark mode toggle
    const darkModeToggle = document.querySelector('.dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', function () {
            document.body.classList.toggle('dark-mode');
            const icon = this.querySelector('i');
            if (document.body.classList.contains('dark-mode')) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            } else {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            }
        });
    }
}

// Navigation functionality
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link[data-section]');

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            // Remove active class from all nav items
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });

            // Add active class to clicked nav item
            this.parentElement.classList.add('active');

            // Show corresponding section
            const sectionName = this.getAttribute('data-section');
            showSection(sectionName);
        });
    });
}

function showSection(sectionName) {
    // Hide all sections using both methods (active class and display style)
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });

    // Show the selected section
    const targetSection = document.getElementById(sectionName + 'Section');
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
    }
}

// Search functionality
function initializeSearch() {
    const studentSearchInput = document.getElementById('studentSearchInput');
    const studentFilter = document.getElementById('studentFilter');

    if (studentSearchInput) {
        studentSearchInput.addEventListener('input', function () {
            filterStudents();
        });
    }

    if (studentFilter) {
        studentFilter.addEventListener('change', function () {
            filterStudents();
        });
    }
}

function filterStudents() {
    const searchTerm = document.getElementById('studentSearchInput')?.value.toLowerCase() || '';
    const filterValue = document.getElementById('studentFilter')?.value || 'all';
    const studentRows = document.querySelectorAll('.student-row');

    studentRows.forEach(row => {
        const studentName = row.querySelector('.student-name')?.textContent.toLowerCase() || '';
        const studentEmail = row.querySelector('.student-email')?.textContent.toLowerCase() || '';
        const isOnline = row.querySelector('.status-badge.online') !== null;

        // Search filter
        const matchesSearch = studentName.includes(searchTerm) || studentEmail.includes(searchTerm);

        // Status filter
        let matchesFilter = true;
        if (filterValue === 'active') {
            matchesFilter = isOnline;
        } else if (filterValue === 'inactive') {
            matchesFilter = !isOnline;
        } else if (filterValue === 'new') {
            // Simulate new students - could be based on registration date
            matchesFilter = studentName.includes('sarah') || studentName.includes('michael');
        }

        if (matchesSearch && matchesFilter) {
            row.style.display = 'table-row';
            // Also hide accordion if it was open
            const accordionRow = row.nextElementSibling;
            if (accordionRow && accordionRow.classList.contains('assignments-accordion')) {
                // Keep accordion visibility as it was
            }
        } else {
            row.style.display = 'none';
            // Hide accordion as well
            const accordionRow = row.nextElementSibling;
            if (accordionRow && accordionRow.classList.contains('assignments-accordion')) {
                accordionRow.style.display = 'none';
            }
        }
    });
}

// Contact filtering for messages
function initializeContactFiltering() {
    const contactTabs = document.querySelectorAll('.contact-tab');

    contactTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            // Remove active class from all tabs
            contactTabs.forEach(t => t.classList.remove('active'));

            // Add active class to clicked tab
            this.classList.add('active');

            // Filter contacts
            const filterType = this.getAttribute('data-type');
            filterContacts(filterType);
        });
    });
}

function filterContacts(type) {
    const contactItems = document.querySelectorAll('.contact-item');

    contactItems.forEach(item => {
        const contactType = item.getAttribute('data-type');

        if (type === 'all' || contactType === type) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Form handlers
function initializeFormHandlers() {
    // Add Teacher Form
    const addTeacherForm = document.getElementById('addTeacherForm');
    if (addTeacherForm) {
        addTeacherForm.addEventListener('submit', function (e) {
            e.preventDefault();
            handleAddTeacher();
        });
    }

    // Profile Form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', function (e) {
            e.preventDefault();
            handleProfileUpdate();
        });
    }

    // Password Form
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', function (e) {
            e.preventDefault();
            handlePasswordUpdate();
        });
    }
}

// Password generation functionality
function initializePasswordGeneration() {
    const generateBtn = document.querySelector('.generate-password-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generatePassword);
    }
}

function generatePassword() {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < 12; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    const passwordInput = document.getElementById('teacherPassword');
    if (passwordInput) {
        passwordInput.value = password;
    }
}

// Student management functions
function viewStudentDetails(studentId) {
    // Show student details modal
    const modal = document.getElementById('studentDetailsModal');
    if (modal) {
        // Here you would typically fetch student data from the server
        // For demo purposes, we'll use static data
        populateStudentModal(studentId);
        modal.style.display = 'flex';
    }
}

async function populateStudentModal(studentId) {
    // Fetch student data from API via assignments
    try {
        if (typeof apiClient !== 'undefined') {
            // Get assignments to find student data
            const assignments = await apiClient.getAssignments();
            const assignmentList = assignments.results || assignments || [];
            
            // Find assignment with matching student
            const assignment = assignmentList.find(a => 
                a.student_detail && (a.student_detail.student_id == studentId || a.student_detail.id == studentId)
            );
            
            if (assignment && assignment.student_detail) {
                const student = assignment.student_detail;
                const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.email;
                document.getElementById('modalStudentName').textContent = fullName;
                document.getElementById('modalStudentEmail').textContent = student.email;
                const avatarEl = document.getElementById('modalStudentAvatar');
                if (avatarEl) {
                    if (student.profile_picture_url) {
                        avatarEl.src = student.profile_picture_url;
                    } else {
                        avatarEl.src = ''; // Use default avatar
                    }
                }
                return;
            }
        }
    } catch (error) {
        console.error('Error loading student data:', error);
    }
    
    // Fallback: Show error message
    document.getElementById('modalStudentName').textContent = 'Student not found';
    document.getElementById('modalStudentEmail').textContent = 'Unable to load student data';
}

function closeStudentDetailsModal() {
    const modal = document.getElementById('studentDetailsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function chatWithStudent(studentId) {
    // Switch to messages section and select the student
    showSection('messages');

    // Update active navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector('[data-section="messages"]').parentElement.classList.add('active');

    // Here you would typically select the specific student in the messages interface
    console.log('Opening chat with student ID:', studentId);
}

function chatWithStudentFromRequest(studentId) {
    chatWithStudent(studentId);
}

// Teacher assignment functions
function assignTeacher(selectElement, assignmentId) {
    const teacherId = selectElement.value;
    const teacherName = selectElement.options[selectElement.selectedIndex].text;

    if (teacherId) {
        showSuccessModal(`Teacher assigned successfully! ${teacherName.split(' - ')[0]} is now assigned to this assignment.`);

        // Update the UI to show assigned teacher
        const row = selectElement.closest('tr');
        const teacherCell = row.querySelector('.assignment-teacher');

        // Replace dropdown with assigned teacher display
        teacherCell.innerHTML = `
            <div class="assigned-teacher-info">
                <div class="current-teacher">
                    <i class="fas fa-user-tie"></i>
                    <span class="teacher-name">${teacherName.split(' - ')[0]}</span>
                </div>
                <button class="teacher-change-btn-small" onclick="changeTeacher(${assignmentId})" title="Change Teacher">
                    <i class="fas fa-exchange-alt"></i>
                </button>
            </div>
        `;

        // Update status badge if it was pending
        const statusBadge = row.querySelector('.status-badge');
        if (statusBadge.classList.contains('pending')) {
            statusBadge.className = 'status-badge assigned';
            statusBadge.innerHTML = '<i class="fas fa-user-check"></i> Assigned';
        }
    }
}

function changeTeacher(assignmentId) {
    // Find the assignment row
    const rows = document.querySelectorAll('.request-row');
    let targetRow = null;

    rows.forEach((row, index) => {
        if (index + 1 === assignmentId) {
            targetRow = row;
        }
    });

    if (targetRow) {
        const teacherCell = targetRow.querySelector('.assignment-teacher');
        const currentTeacher = targetRow.querySelector('.teacher-name').textContent;

        // Replace with dropdown
        teacherCell.innerHTML = `
            <div class="teacher-assignment-section">
                <select class="teacher-select-compact" onchange="assignTeacher(this, ${assignmentId})" data-assignment-id="${assignmentId}">
                    <option value="">Select New Teacher</option>
                    <option value="dr-harper">Dr. Amelia Harper - Mathematics</option>
                    <option value="dr-chen">Dr. Sarah Chen - Physics</option>
                    <option value="dr-johnson">Dr. Michael Johnson - Computer Science</option>
                    <option value="ms-carter">Ms. Olivia Carter - English Literature</option>
                    <option value="dr-brown">Dr. Robert Brown - History</option>
                </select>
            </div>
        `;

        showSuccessModal(`Teacher change initiated. Please select a new teacher for this assignment. Current teacher: ${currentTeacher}`);
    }
}

// Assignment status management functions
function filterAssignmentsByStatus() {
    const filterValue = document.getElementById('assignmentStatusFilter').value;
    const rows = document.querySelectorAll('.request-row');

    rows.forEach(row => {
        const statusBadge = row.querySelector('.status-badge');
        let statusClass = '';

        if (statusBadge.classList.contains('pending')) statusClass = 'pending';
        else if (statusBadge.classList.contains('assigned')) statusClass = 'assigned';
        else if (statusBadge.classList.contains('in-process')) statusClass = 'in-process';
        else if (statusBadge.classList.contains('completed')) statusClass = 'completed';
        else if (statusBadge.classList.contains('cancelled')) statusClass = 'cancelled';
        else if (statusBadge.classList.contains('deleted')) statusClass = 'deleted';

        if (filterValue === 'all' || filterValue === statusClass) {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
        }
    });
}

function cancelAssignment(assignmentId, currentStatus) {
    if (confirm('Are you sure you want to cancel this assignment? This action can be undone later.')) {
        const rows = document.querySelectorAll('.request-row');
        const targetRow = rows[assignmentId - 1];

        if (targetRow) {
            // Update status badge
            const statusCell = targetRow.querySelector('.assignment-status');
            statusCell.innerHTML = `
                <span class="status-badge cancelled">
                    <i class="fas fa-ban"></i>
                    Cancelled
                </span>
            `;

            // Update teacher section
            const teacherCell = targetRow.querySelector('.assignment-teacher');
            teacherCell.innerHTML = `
                <div class="assigned-teacher-info disabled">
                    <div class="current-teacher">
                        <i class="fas fa-user-slash"></i>
                        <span class="teacher-name">No Teacher</span>
                    </div>
                </div>
            `;

            // Update actions
            const actionsCell = targetRow.querySelector('.assignment-actions');
            actionsCell.innerHTML = `
                <div class="action-buttons-group">
                    <button class="action-btn view-btn" onclick="viewAssignmentDetails(${assignmentId}, 1)" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn restore-btn" onclick="restoreAssignment(${assignmentId})" title="Restore Assignment">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteAssignment(${assignmentId}, 'cancelled')" title="Permanently Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            showSuccessModal('Assignment has been cancelled successfully. You can restore it at any time.');
        }
    }
}

function deleteAssignment(assignmentId, currentStatus) {
    if (confirm('Are you sure you want to delete this assignment? You can still restore it later.')) {
        const rows = document.querySelectorAll('.request-row');
        const targetRow = rows[assignmentId - 1];

        if (targetRow) {
            // Add deleted styling
            targetRow.classList.add('deleted-row');
            targetRow.style.opacity = '0.6';

            // Update status badge
            const statusCell = targetRow.querySelector('.assignment-status');
            statusCell.innerHTML = `
                <span class="status-badge deleted">
                    <i class="fas fa-trash-alt"></i>
                    Deleted
                </span>
            `;

            // Update actions
            const actionsCell = targetRow.querySelector('.assignment-actions');
            actionsCell.innerHTML = `
                <div class="action-buttons-group">
                    <button class="action-btn view-btn" onclick="viewAssignmentDetails(${assignmentId}, 1)" title="View Details" disabled>
                        <i class="fas fa-eye-slash"></i>
                    </button>
                    <button class="action-btn restore-btn" onclick="restoreAssignment(${assignmentId})" title="Restore Assignment">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button class="action-btn permanent-delete-btn" onclick="permanentlyDeleteAssignment(${assignmentId})" title="Permanently Remove">
                        <i class="fas fa-times-circle"></i>
                    </button>
                </div>
            `;

            showSuccessModal('Assignment has been moved to deleted. You can still restore it or permanently remove it.');
        }
    }
}

function restoreAssignment(assignmentId) {
    if (confirm('Are you sure you want to restore this assignment?')) {
        const rows = document.querySelectorAll('.request-row');
        const targetRow = rows[assignmentId - 1];

        if (targetRow) {
            // Remove deleted styling
            targetRow.classList.remove('deleted-row');
            targetRow.style.opacity = '1';

            // Update status badge to pending
            const statusCell = targetRow.querySelector('.assignment-status');
            statusCell.innerHTML = `
                <span class="status-badge pending">
                    <i class="fas fa-clock"></i>
                    Pending
                </span>
            `;

            // Update teacher section
            const teacherCell = targetRow.querySelector('.assignment-teacher');
            teacherCell.innerHTML = `
                <div class="teacher-assignment-section">
                    <select class="teacher-select-compact" onchange="assignTeacher(this, ${assignmentId})" data-assignment-id="${assignmentId}">
                        <option value="">Assign Teacher</option>
                        <option value="dr-harper">Dr. Amelia Harper - Mathematics</option>
                        <option value="dr-chen">Dr. Sarah Chen - Physics</option>
                        <option value="dr-johnson">Dr. Michael Johnson - Computer Science</option>
                        <option value="ms-carter">Ms. Olivia Carter - English Literature</option>
                        <option value="dr-brown">Dr. Robert Brown - History</option>
                    </select>
                </div>
            `;

            // Update actions
            const actionsCell = targetRow.querySelector('.assignment-actions');
            actionsCell.innerHTML = `
                <div class="action-buttons-group">
                    <button class="action-btn view-btn" onclick="viewAssignmentDetails(${assignmentId}, 1)" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn chat-btn" onclick="chatWithStudentFromRequest(${assignmentId})" title="Chat">
                        <i class="fas fa-comment"></i>
                    </button>
                    <button class="action-btn cancel-btn" onclick="cancelAssignment(${assignmentId}, 'pending')" title="Cancel Assignment">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;

            showSuccessModal('Assignment has been restored successfully and is now pending.');
        }
    }
}

function permanentlyDeleteAssignment(assignmentId) {
    // PERMANENT DELETION IS DISABLED - Assignments should never be deleted from database
    // This function is kept for backward compatibility but does nothing
    alert('Permanent deletion is not allowed. Assignments are always retained in the database for record-keeping. Use the delete button to mark as deleted instead.');
    console.warn('Permanent deletion attempted but prevented. Assignment ID:', assignmentId);
}

function downloadAssignment(assignmentId) {
    // In a real implementation, this would fetch the actual file
    const rows = document.querySelectorAll('.request-row');
    const targetRow = rows[assignmentId - 1];

    if (targetRow) {
        const assignmentTitle = targetRow.querySelector('.assignment-title').textContent;
        const studentName = targetRow.querySelector('.student-name').textContent;

        // Simulate file download
        showSuccessModal(`Downloading completed assignment: "${assignmentTitle}" by ${studentName}. File will be downloaded shortly.`);

        // In real implementation, you would create a download link:
        // const link = document.createElement('a');
        // link.href = '/path/to/assignment/file';
        // link.download = `${assignmentTitle} - ${studentName}.pdf`;
        // link.click();
    }
}

function reassignTeacher(selectElement) {
    const teacherId = selectElement.value;
    const teacherName = selectElement.options[selectElement.selectedIndex].text;

    if (teacherId) {
        showSuccessModal(`Assignment updated! Now assigned to ${teacherName}`);
    } else {
        showSuccessModal('Teacher assignment removed');
    }
}

// Form submission handlers
function handleAddTeacher() {
    // Get form data
    const formData = new FormData(document.getElementById('addTeacherForm'));

    // Here you would typically send the data to your server
    // For demo purposes, we'll just show a success message

    showSuccessModal('Teacher added successfully! Login credentials have been sent to their email.');

    // Reset the form
    document.getElementById('addTeacherForm').reset();
}

function handleProfileUpdate() {
    // Here you would typically send the profile data to your server
    showSuccessModal('Profile updated successfully!');
}

function handlePasswordUpdate() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match!');
        return;
    }

    // Here you would typically send the password data to your server
    showSuccessModal('Password updated successfully!');

    // Reset the password form
    document.getElementById('passwordForm').reset();
}

// Modal functions
function showSuccessModal(message) {
    const modal = document.getElementById('successModal');
    const messageElement = document.getElementById('successMessage');

    if (modal && messageElement) {
        messageElement.textContent = message;
        modal.style.display = 'flex';
    }
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Utility functions
function viewSpecificAssignment(studentId, assignmentId) {
    // Navigate to assignment request tab and highlight specific assignment
    showSection('assignment-requests');

    // Highlight the specific assignment
    setTimeout(() => {
        const requestRows = document.querySelectorAll('.request-row');
        requestRows.forEach(row => {
            row.classList.remove('highlighted-student');
        });

        // Find student's assignments and highlight the specific one
        const studentName = getStudentNameById(studentId);
        const studentRows = Array.from(requestRows).filter(row => {
            const studentInfo = row.querySelector('.student-name');
            return studentInfo && studentInfo.textContent.includes(studentName);
        });

        // Highlight the specific assignment (using assignment ID as index)
        if (studentRows.length >= assignmentId) {
            const targetAssignment = studentRows[assignmentId - 1];
            if (targetAssignment) {
                targetAssignment.classList.add('highlighted-student');
                targetAssignment.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Add extra emphasis with a pulse effect
                targetAssignment.style.animation = 'highlightPulse 3s ease-in-out';
                setTimeout(() => {
                    targetAssignment.style.animation = '';
                }, 3000);
            }
        }
    }, 100);
}

function getStudentNameById(studentId) {
    const studentNames = {
        1: 'Alex Johnson',
        2: 'Emma Wilson',
        3: 'Sarah Davis'
    };
    return studentNames[studentId] || 'Unknown Student';
}

async function viewAssignmentDetails(studentId, assignmentId) {
    // Open assignment details modal with comprehensive information
    const modal = document.getElementById('assignmentDetailsModal');

    // Get assignment data from API
    const assignmentData = await getAssignmentData(studentId, assignmentId);

    if (assignmentData) {
        populateAssignmentModal(assignmentData);
        modal.style.display = 'flex';
    } else {
        showSuccessModal('Assignment details not found.');
    }
}

async function getAssignmentData(studentId, assignmentId) {
    // Fetch assignment data from API
    try {
        if (typeof apiClient !== 'undefined') {
            // Get assignment by ID
            const assignment = await apiClient.getAssignment(assignmentId);
            
            if (assignment) {
                // Format data to match expected structure
                const studentDetail = assignment.student_detail || {};
                const teacherAssignments = assignment.teacher_assignments || [];
                const primaryTeacher = teacherAssignments.find(ta => ta.status === 'active' || ta.status === 'assigned');
                
                return {
                    student: {
                        name: `${studentDetail.first_name || ''} ${studentDetail.last_name || ''}`.trim() || studentDetail.email,
                        email: studentDetail.email,
                        id: studentDetail.student_id || studentDetail.id,
                        avatar: studentDetail.profile_picture_url || ''
                    },
                    assignment: {
                        assignment_id: assignment.assignment_code || assignment.assignment_id,
                        title: assignment.title,
                        type: assignment.service_type,
                        subject: assignment.service_subtype || assignment.service_type,
                        academicLevel: assignment.metadata?.academicLevel || '',
                        paperType: assignment.metadata?.paperType || '',
                        englishType: assignment.metadata?.englishType || '',
                        pages: assignment.metadata?.numberOfPages ? `${assignment.metadata.numberOfPages} pages` : '',
                        spacing: assignment.metadata?.spacing || '',
                        deadline: assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : '',
                        submissionDate: assignment.created_at ? new Date(assignment.created_at).toLocaleDateString() : '',
                        status: assignment.status,
                        features: assignment.metadata?.features || []
                    },
                    teachers: {
                        primary: primaryTeacher ? `${primaryTeacher.teacher_detail?.first_name || ''} ${primaryTeacher.teacher_detail?.last_name || ''}`.trim() : null,
                        secondary: null
                    }
                };
            }
        }
    } catch (error) {
        console.error('Error loading assignment data:', error);
    }
    
    return null;
}

function populateAssignmentModal(data) {
    // Populate student information
    const studentAvatar = document.getElementById('modalStudentAvatar');
    const studentName = document.getElementById('modalStudentName');
    const studentEmail = document.getElementById('modalStudentEmail');
    const studentId = document.getElementById('modalStudentId');

    studentAvatar.src = data.student.avatar;
    studentName.textContent = data.student.name;
    studentEmail.textContent = data.student.email;
    studentId.textContent = data.student.id;

    // Populate assignment information
    const assignmentIdEl = document.getElementById('modalAssignmentId');
    if (assignmentIdEl) assignmentIdEl.textContent = data.assignment.assignment_id || 'N/A';
    document.getElementById('modalAssignmentTitle').textContent = data.assignment.title;
    document.getElementById('modalAssignmentType').textContent = data.assignment.type;
    document.getElementById('modalAssignmentSubject').textContent = data.assignment.subject;
    document.getElementById('modalAcademicLevel').textContent = data.assignment.academicLevel;
    document.getElementById('modalPaperType').textContent = data.assignment.paperType;
    document.getElementById('modalEnglishType').textContent = data.assignment.englishType;
    document.getElementById('modalPages').textContent = data.assignment.pages;
    document.getElementById('modalSpacing').textContent = data.assignment.spacing;
    document.getElementById('modalDeadline').textContent = data.assignment.deadline;
    document.getElementById('modalSubmissionDate').textContent = data.assignment.submissionDate;

    // Populate features
    const featuresContainer = document.getElementById('modalFeatures');
    featuresContainer.innerHTML = '';
    data.assignment.features.forEach(feature => {
        const featureTag = document.createElement('span');
        featureTag.className = 'feature-tag';
        featureTag.textContent = feature;
        featuresContainer.appendChild(featureTag);
    });

    // Set current status
    const statusElement = document.getElementById('modalCurrentStatus');
    statusElement.className = `status-badge ${data.assignment.status}`;
    statusElement.textContent = data.assignment.status.charAt(0).toUpperCase() + data.assignment.status.slice(1);

    // Set teacher selections
    const primarySelect = document.getElementById('primaryTeacherSelect');
    const secondarySelect = document.getElementById('secondaryTeacherSelect');

    if (data.teachers.primary) {
        primarySelect.value = data.teachers.primary;
    }
    if (data.teachers.secondary) {
        secondarySelect.value = data.teachers.secondary;
    }

    // Update assigned teachers display
    updateAssignedTeachersDisplay(data.teachers);
}

function updateAssignedTeachersDisplay(teachers) {
    const teachersList = document.getElementById('assignedTeachersList');
    teachersList.innerHTML = '';

    const teacherData = {
        'dr-johnson': { name: 'Dr. Michael Johnson', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face', emoji: '👨‍🏫' },
        'dr-harper': { name: 'Dr. Amelia Harper', avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=40&h=40&fit=crop&crop=face', emoji: '👩‍🏫' },
        'dr-chen': { name: 'Dr. Sarah Chen', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=40&h=40&fit=crop&crop=face', emoji: '👩‍🏫' },
        'ms-carter': { name: 'Ms. Olivia Carter', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=40&h=40&fit=crop&crop=face', emoji: '👩‍🏫' },
        'dr-brown': { name: 'Dr. Robert Brown', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face', emoji: '👨‍🏫' }
    };

    if (teachers.primary) {
        const teacher = teacherData[teachers.primary];
        teachersList.innerHTML += createTeacherItem(teacher, 'Primary Teacher', 'primary');
    }

    if (teachers.secondary) {
        const teacher = teacherData[teachers.secondary];
        teachersList.innerHTML += createTeacherItem(teacher, 'Secondary Teacher', 'secondary');
    }

    if (!teachers.primary && !teachers.secondary) {
        teachersList.innerHTML = '<p class="no-teachers">No teachers assigned yet.</p>';
    }
}

function createTeacherItem(teacher, role, type) {
    return `
        <div class="assigned-teacher-item">
            <div class="teacher-info">
                <div class="teacher-avatar-small">
                    <img src="${teacher.avatar}" alt="Teacher" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="avatar-fallback" style="display: none;">${teacher.emoji}</div>
                </div>
                <div class="teacher-details">
                    <span class="teacher-name">${teacher.name}</span>
                    <span class="teacher-role-badge ${type}">${role}</span>
                </div>
            </div>
            <button class="remove-teacher-btn" onclick="removeTeacher('${type}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
}

function closeAssignmentDetailsModal() {
    const modal = document.getElementById('assignmentDetailsModal');
    modal.style.display = 'none';
}

function savePrimaryTeacher() {
    const select = document.getElementById('primaryTeacherSelect');
    if (select.value) {
        showSuccessModal(`Primary teacher assigned: ${select.options[select.selectedIndex].text}`);
        // Update the assigned teachers display
        // In real app, this would save to backend
    }
}

function saveSecondaryTeacher() {
    const select = document.getElementById('secondaryTeacherSelect');
    if (select.value) {
        showSuccessModal(`Secondary teacher assigned: ${select.options[select.selectedIndex].text}`);
        // Update the assigned teachers display
        // In real app, this would save to backend
    }
}

function removeTeacher(type) {
    if (confirm(`Are you sure you want to remove the ${type} teacher?`)) {
        showSuccessModal(`${type.charAt(0).toUpperCase() + type.slice(1)} teacher removed successfully.`);
        // Update the display
        // In real app, this would save to backend
    }
}

function updateAssignmentStatus() {
    const statusSelect = document.getElementById('statusUpdate');
    const newStatus = statusSelect.value;
    showSuccessModal(`Assignment status updated to: ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`);
    // Update the current status display
    // In real app, this would save to backend
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const icon = button.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Filter functionality for assignment requests
function initializeFilters() {
    const filterSelect = document.querySelector('.filter-select');
    if (filterSelect) {
        filterSelect.addEventListener('change', function () {
            const filterValue = this.value;
            filterAssignmentRequests(filterValue);
        });
    }
}

function filterAssignmentRequests(filter) {
    const rows = document.querySelectorAll('.request-row');

    rows.forEach(row => {
        const statusBadge = row.querySelector('.status-badge');
        const status = statusBadge.textContent.trim().toLowerCase();

        if (filter === 'all' || status.includes(filter)) {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
        }
    });
}

// Initialize filters when page loads
document.addEventListener('DOMContentLoaded', function () {
    initializeFilters();
});

// Close modals when clicking outside
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
});

// Prevent modal content clicks from closing the modal
document.addEventListener('click', function (e) {
    if (e.target.closest('.modal-content')) {
        e.stopPropagation();
    }
});

// Keyboard navigation for modals
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        // Close any open modals
        const openModals = document.querySelectorAll('.modal-overlay[style*="flex"]');
        openModals.forEach(modal => {
            modal.style.display = 'none';
        });
    }
});

// Profile picture upload preview
function initializeProfilePictureUpload() {
    const fileInput = document.getElementById('profilePictureInput');
    if (fileInput) {
        fileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const preview = document.getElementById('currentProfilePicture');
                    if (preview) {
                        preview.src = e.target.result;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// Initialize profile picture upload when page loads
document.addEventListener('DOMContentLoaded', function () {
    initializeProfilePictureUpload();
});

// Student accordion functionality
function toggleStudentAssignments(studentId) {
    const accordionRow = document.getElementById(`assignments-${studentId}`);
    const viewButton = document.querySelector(`[onclick="toggleStudentAssignments(${studentId})"]`);
    const icon = viewButton.querySelector('i');

    if (accordionRow.style.display === 'none' || accordionRow.style.display === '') {
        // Close other open accordions
        document.querySelectorAll('.assignments-accordion').forEach(row => {
            if (row.id !== `assignments-${studentId}`) {
                row.style.display = 'none';
                // Reset other buttons
                const otherButtons = document.querySelectorAll('.action-btn-small.primary');
                otherButtons.forEach(btn => {
                    const otherIcon = btn.querySelector('i');
                    if (otherIcon && btn !== viewButton) {
                        otherIcon.classList.remove('fa-chevron-up');
                        otherIcon.classList.add('fa-chevron-down');
                    }
                });
            }
        });

        // Show current accordion
        accordionRow.style.display = 'table-row';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        // Hide current accordion
        accordionRow.style.display = 'none';
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}

image.png// Assignment navigation functionality (accordion removed)

// Teacher assignment functionality
function changeAssignmentTeacher(selectElement, studentId, assignmentId) {
    const teacherId = selectElement.value;
    const teacherName = selectElement.options[selectElement.selectedIndex].text;

    // Enable the save button
    const saveButton = selectElement.parentElement.querySelector('.teacher-change-btn');
    if (saveButton) {
        saveButton.disabled = false;
        saveButton.style.opacity = '1';
    }

    console.log(`Teacher selection changed for Student ${studentId}, Assignment ${assignmentId}: ${teacherName}`);
}

function saveTeacherChange(studentId, assignmentId) {
    const container = document.querySelector(`#assignment-details-${studentId}-${assignmentId} .teacher-selection-container`);
    const selectElement = container.querySelector('.teacher-select-assignment');
    const saveButton = container.querySelector('.teacher-change-btn');
    const teacherId = selectElement.value;
    const teacherName = selectElement.options[selectElement.selectedIndex].text;

    // Simulate saving
    if (teacherId) {
        showSuccessModal(`Teacher assigned successfully! ${teacherName.split(' - ')[0]} is now assigned to this assignment.`);
    } else {
        showSuccessModal('Teacher assignment removed successfully.');
    }

    // Disable save button after saving
    saveButton.disabled = true;
    saveButton.style.opacity = '0.6';

    // Here you would typically send the data to your server
    console.log(`Saving teacher assignment: Student ${studentId}, Assignment ${assignmentId}, Teacher: ${teacherId}`);
}

// ============ Writing Tracker (admin, shared with student localStorage) ============
const ADMIN_WRITING_STORAGE_KEY = 'demo_writings_records_v1';

function seedAdminWritings() {
    return [
        {
            writing_id: 'WR-2025-001',
            title: 'Literature Review - Climate Policy',
            status: 'reviewing',
            assignment_code: 'ASG-2025-001',
            teacher_notes: 'Draft received, focusing on APA formatting and adding 3 more references.',
            review_notes: 'Provide clearer thesis statement in introduction.',
            final_file_url: null,
            updated_at: new Date(Date.now() - 3600 * 1000 * 6).toISOString()
        },
        {
            writing_id: 'WR-2025-002',
            title: 'Personal Statement Editing',
            status: 'completed',
            assignment_code: 'ASG-2025-014',
            teacher_notes: 'Returned polished version with grammar fixes and tightened narrative.',
            review_notes: 'Highlight internship outcome; ready for submission.',
            final_file_url: 'https://example.com/final-personal-statement.pdf',
            updated_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString()
        }
    ];
}

function loadAdminWritingRecords() {
    try {
        const stored = localStorage.getItem(ADMIN_WRITING_STORAGE_KEY);
        if (!stored) {
            const seed = seedAdminWritings();
            saveAdminWritingRecords(seed);
            return seed;
        }
        return JSON.parse(stored);
    } catch (error) {
        console.error('Failed to load admin writing records:', error);
        return seedAdminWritings();
    }
}

function saveAdminWritingRecords(records) {
    try {
        localStorage.setItem(ADMIN_WRITING_STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
        console.error('Failed to save admin writing records:', error);
    }
}

function initializeAdminWritings() {
    const filterBtns = document.querySelectorAll('#adminWritingFilters .filter-pill');
    if (filterBtns.length) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderAdminWritingTable(btn.getAttribute('data-filter') || 'all');
            });
        });
    }
    renderAdminWritingTable();
}

function renderAdminWritingTable(filter = 'all') {
    const tbody = document.querySelector('#adminWritingTable tbody');
    const empty = document.getElementById('adminWritingEmpty');
    const count = document.getElementById('adminWritingCount');
    if (!tbody) return;

    const records = loadAdminWritingRecords();
    if (count) count.textContent = `${records.length} writing${records.length === 1 ? '' : 's'}`;

    const filtered = records.filter(r => filter === 'all' || r.status === filter);
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.25rem;color:var(--muted);">No writings for this filter.</td></tr>';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = filtered.map(rec => {
        const statusBadge = `<span class="writing-status ${rec.status}"><i class="fas fa-circle"></i>${formatAdminWritingStatus(rec.status)}</span>`;
        const updated = rec.updated_at ? new Date(rec.updated_at).toLocaleString() : '—';
        return `
            <tr data-writing-id="${rec.writing_id}">
                <td><code>${rec.writing_id}</code></td>
                <td>${rec.title}</td>
                <td>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        ${statusBadge}
                        <select class="teacher-select-compact" onchange="updateWritingStatusAdmin('${rec.writing_id}', this.value)">
                            <option value="">Update status</option>
                            <option value="submitted">Submitted</option>
                            <option value="reviewing">In Review</option>
                            <option value="revision">Revision</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                </td>
                <td>${updated}</td>
                <td>
                    <div class="action-buttons-group">
                        <button class="action-btn view-btn" onclick="openWritingDetailAdmin('${rec.writing_id}')"><i class="fas fa-eye"></i></button>
                        <button class="action-btn save-btn" onclick="updateWritingStatusAdmin('${rec.writing_id}', 'completed')"><i class="fas fa-check"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function formatAdminWritingStatus(status) {
    const map = {
        submitted: 'Submitted',
        reviewing: 'In Review',
        revision: 'Revision',
        completed: 'Completed'
    };
    return map[status] || status;
}

function updateWritingStatusAdmin(writingId, status) {
    if (!status) return;
    const records = loadAdminWritingRecords();
    const idx = records.findIndex(r => r.writing_id === writingId);
    if (idx === -1) return;
    records[idx].status = status;
    records[idx].updated_at = new Date().toISOString();
    saveAdminWritingRecords(records);
    renderAdminWritingTable();
    showSuccessModal(`Writing ${writingId} updated to ${formatAdminWritingStatus(status)}.`);
}

function applyWritingTeacherUpdates(writingId, updates = {}) {
    const records = loadAdminWritingRecords();
    const idx = records.findIndex(r => r.writing_id === writingId);
    if (idx === -1) return;
    records[idx] = {
        ...records[idx],
        ...updates,
        updated_at: new Date().toISOString()
    };
    saveAdminWritingRecords(records);
    renderAdminWritingTable();
}

function openWritingDetailAdmin(writingId) {
    const records = loadAdminWritingRecords();
    const record = records.find(r => r.writing_id === writingId);
    if (!record) {
        alert('Writing not found');
        return;
    }

    const win = window.open('', '_blank', 'width=920,height=720');
    if (!win) {
        alert('Please allow pop-ups to view writing details.');
        return;
    }

    const statusBadge = `<span class="writing-status ${record.status}" style="margin-left:8px;"><i class="fas fa-circle"></i>${formatAdminWritingStatus(record.status)}</span>`;
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${record.title} - Admin Writing</title>
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet">
            <style>
                body { font-family: Inter, Arial, sans-serif; padding: 20px; background: #f8fafc; color: #0f172a; }
                h1 { margin: 0 0 10px 0; }
                .section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 14px; }
                .muted { color: #475569; }
                textarea, input { width: 100%; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; }
                .btn-row { display:flex; gap:10px; flex-wrap:wrap; }
                .primary-button { padding: 10px 14px; border-radius: 10px; border: none; background: #1158e5; color: #fff; cursor: pointer; font-weight: 700; }
                .ghost-button { padding: 10px 14px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-weight: 700; }
                .note { background:#ecfdf3; border:1px solid #bbf7d0; padding:10px; border-radius:10px; margin-bottom:10px; }
            </style>
        </head>
        <body>
            <h1>${record.title} ${statusBadge}</h1>
            <p class="muted">Assignment: ${record.assignment_code || 'N/A'} · Updated ${record.updated_at ? new Date(record.updated_at).toLocaleString() : '—'}</p>
            <div class="note"><i class="fas fa-info-circle"></i> Updating here will also reflect on the student writing tab.</div>

            <div class="section">
                <h3>Teacher Notes</h3>
                <textarea id="adminTeacherNotes">${record.teacher_notes || ''}</textarea>
            </div>

            <div class="section">
                <h3>Review Notes for Student</h3>
                <textarea id="adminReviewNotes">${record.review_notes || ''}</textarea>
            </div>

            <div class="section">
                <h3>Final Delivery Link (optional)</h3>
                <input id="adminFinalUrl" placeholder="https://..." value="${record.final_file_url || ''}" />
                <p class="muted" style="margin-top:6px;">Provide a downloadable link for the final writing once completed.</p>
            </div>

            <div class="section">
                <h3>Status</h3>
                <select id="adminStatusSelect" style="max-width:240px;">
                    <option value="submitted" ${record.status === 'submitted' ? 'selected' : ''}>Submitted</option>
                    <option value="reviewing" ${record.status === 'reviewing' ? 'selected' : ''}>In Review</option>
                    <option value="revision" ${record.status === 'revision' ? 'selected' : ''}>Revision</option>
                    <option value="completed" ${record.status === 'completed' ? 'selected' : ''}>Completed</option>
                </select>
            </div>

            <div class="btn-row">
                <button class="primary-button" onclick="saveWritingAdmin()">Save & Update</button>
                <button class="ghost-button" onclick="window.close()">Close</button>
            </div>

            <script>
                function saveWritingAdmin() {
                    const updates = {
                        teacher_notes: document.getElementById('adminTeacherNotes').value,
                        review_notes: document.getElementById('adminReviewNotes').value,
                        final_file_url: document.getElementById('adminFinalUrl').value || null,
                        status: document.getElementById('adminStatusSelect').value
                    };
                    if (window.opener && window.opener.applyWritingTeacherUpdates) {
                        window.opener.applyWritingTeacherUpdates('${writingId}', updates);
                        alert('Writing updated successfully.');
                    } else {
                        alert('Could not sync changes back to dashboard.');
                    }
                }
            </script>
        </body>
        </html>
    `);
    win.document.close();
}

// Export functions for use in HTML
window.viewStudentDetails = viewStudentDetails;
window.closeStudentDetailsModal = closeStudentDetailsModal;
window.chatWithStudent = chatWithStudent;
window.chatWithStudentFromRequest = chatWithStudentFromRequest;
window.assignTeacher = assignTeacher;
window.changeTeacher = changeTeacher;
window.reassignTeacher = reassignTeacher;
window.filterAssignmentsByStatus = filterAssignmentsByStatus;
window.cancelAssignment = cancelAssignment;
window.deleteAssignment = deleteAssignment;
window.restoreAssignment = restoreAssignment;
window.permanentlyDeleteAssignment = permanentlyDeleteAssignment;
window.downloadAssignment = downloadAssignment;
window.viewSpecificAssignment = viewSpecificAssignment;
window.viewAssignmentDetails = viewAssignmentDetails;
window.closeAssignmentDetailsModal = closeAssignmentDetailsModal;
window.savePrimaryTeacher = savePrimaryTeacher;
window.saveSecondaryTeacher = saveSecondaryTeacher;
window.removeTeacher = removeTeacher;
window.updateAssignmentStatus = updateAssignmentStatus;
window.togglePassword = togglePassword;
window.generatePassword = generatePassword;
window.closeSuccessModal = closeSuccessModal;
window.toggleStudentAssignments = toggleStudentAssignments;
window.changeAssignmentTeacher = changeAssignmentTeacher;
window.saveTeacherChange = saveTeacherChange;
window.initializeAdminWritings = initializeAdminWritings;
window.renderAdminWritingTable = renderAdminWritingTable;
window.updateWritingStatusAdmin = updateWritingStatusAdmin;
window.openWritingDetailAdmin = openWritingDetailAdmin;
window.applyWritingTeacherUpdates = applyWritingTeacherUpdates;
