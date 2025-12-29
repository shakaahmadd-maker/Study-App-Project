// Meetings Interface JavaScript

// Make initializeMeetings available globally
window.MeetingsInterface = {
    initializeMeetings: function () {
        // Initialize the meetings interface
        initializeMeetings();
    }
};

function initializeMeetings() {
    // Get DOM elements
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const scheduleMeetingBtn = document.querySelector('.schedule-meeting-btn');
    const meetingCards = document.querySelectorAll('.meeting-card');

    // Tab switching functionality
    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            const targetTab = this.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // Schedule meeting button functionality
    if (scheduleMeetingBtn) {
        scheduleMeetingBtn.addEventListener('click', handleScheduleMeeting);
    }

    // Meeting card interactions
    meetingCards.forEach(card => {
        card.addEventListener('click', function () {
            handleMeetingCardClick(this);
        });
    });

    // Initialize with upcoming tab active
    switchTab('upcoming');
}

function switchTab(tabName) {
    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));

    // Add active class to clicked tab button
    const activeTabButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeTabButton) {
        activeTabButton.classList.add('active');
    }

    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));

    // Show the selected tab content
    const targetContent = document.getElementById(`${tabName}Content`);
    if (targetContent) {
        targetContent.classList.add('active');
    }

    console.log(`Switched to ${tabName} tab`);
}

function handleScheduleMeeting() {
    // Show a modal or redirect to scheduling page
    // For now, show a temporary message
    if (window.Dashboard && window.Dashboard.showTemporaryMessage) {
        window.Dashboard.showTemporaryMessage('Schedule Meeting feature coming soon!');
    } else {
        alert('Schedule Meeting feature coming soon!');
    }

    // In a real application, this would:
    // 1. Open a modal with meeting scheduling form
    // 2. Or redirect to a dedicated scheduling page
    // 3. Handle form submission and API calls
}

function handleMeetingCardClick(card) {
    // Remove active class from all meeting cards
    const allCards = document.querySelectorAll('.meeting-card');
    allCards.forEach(c => c.classList.remove('selected'));

    // Add active class to clicked card
    card.classList.add('selected');

    // Get meeting information
    const meetingTitle = card.querySelector('.meeting-title').textContent;
    const meetingTime = card.querySelector('.meeting-time span').textContent;

    console.log(`Selected meeting: ${meetingTitle} at ${meetingTime}`);

    // In a real application, this would:
    // 1. Show meeting details in a sidebar or modal
    // 2. Allow joining the meeting if it's in progress
    // 3. Show meeting options (reschedule, cancel, etc.)
}

// Meeting management functions
function createMeetingCard(meetingData) {
    const card = document.createElement('div');
    card.className = 'meeting-card';

    const priorityClass = meetingData.priority === 'urgent' ? 'urgent' : '';
    const statusClass = meetingData.status === 'in-progress' ? 'in-progress' : '';
    const isActive = meetingData.status === 'in-progress' ? 'active-meeting' : '';

    card.innerHTML = `
        <div class="meeting-info">
            <h3 class="meeting-title">${meetingData.title}</h3>
            <div class="meeting-details">
                <div class="meeting-detail ${priorityClass}">
                    <i class="fas fa-chart-bar"></i>
                    <span class="detail-text">${meetingData.priority} Priority</span>
                </div>
                <div class="meeting-detail ${statusClass}">
                    <i class="fas fa-${getStatusIcon(meetingData.status)}"></i>
                    <span class="detail-text">${getStatusText(meetingData.status)}</span>
                </div>
            </div>
        </div>
        <div class="meeting-time ${statusClass}">
            ${meetingData.status === 'in-progress' ?
            '<div class="pulse-dots"><span></span><span></span><span></span></div>' :
            '<i class="fas fa-clock"></i>'
        }
            <span>${meetingData.time}</span>
        </div>
    `;

    if (isActive) {
        card.classList.add(isActive);
    }

    // Add click event listener
    card.addEventListener('click', function () {
        handleMeetingCardClick(this);
    });

    return card;
}

function getStatusIcon(status) {
    const icons = {
        'scheduled': 'calendar',
        'in-progress': 'video',
        'completed': 'check',
        'cancelled': 'times'
    };
    return icons[status] || 'calendar';
}

function getStatusText(status) {
    const texts = {
        'scheduled': 'Scheduled',
        'in-progress': 'In Meeting',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    return texts[status] || 'Scheduled';
}

function addMeetingToTab(tabName, meetingData) {
    const tabContent = document.getElementById(`${tabName}Content`);
    if (tabContent) {
        const meetingsList = tabContent.querySelector('.meetings-list');
        if (meetingsList) {
            const meetingCard = createMeetingCard(meetingData);
            meetingsList.appendChild(meetingCard);
        }
    }
}

function removeMeeting(meetingId) {
    // Find and remove meeting card by ID
    const meetingCard = document.querySelector(`[data-meeting-id="${meetingId}"]`);
    if (meetingCard) {
        meetingCard.remove();
    }
}

function updateMeetingStatus(meetingId, newStatus) {
    const meetingCard = document.querySelector(`[data-meeting-id="${meetingId}"]`);
    if (meetingCard) {
        const statusDetail = meetingCard.querySelector('.meeting-detail:last-child');
        const timeElement = meetingCard.querySelector('.meeting-time');

        if (statusDetail) {
            const icon = statusDetail.querySelector('i');
            const text = statusDetail.querySelector('.detail-text');

            icon.className = `fas fa-${getStatusIcon(newStatus)}`;
            text.textContent = getStatusText(newStatus);

            // Update classes
            statusDetail.className = `meeting-detail ${newStatus === 'in-progress' ? 'in-progress' : ''}`;
            timeElement.className = `meeting-time ${newStatus === 'in-progress' ? 'in-progress' : ''}`;

            // Update time content for in-progress meetings
            if (newStatus === 'in-progress') {
                timeElement.innerHTML = `
                    <div class="pulse-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <span>In Progress</span>
                `;
                meetingCard.classList.add('active-meeting');
            } else {
                meetingCard.classList.remove('active-meeting');
            }
        }
    }
}

// Sample data for demonstration
const sampleMeetings = {
    upcoming: [
        {
            id: 'math-tutoring',
            title: 'Math Tutoring',
            priority: 'standard',
            status: 'scheduled',
            time: 'Today, 3:00 PM'
        },
        {
            id: 'science-review',
            title: 'Science Project Review',
            priority: 'urgent',
            status: 'scheduled',
            time: 'Tomorrow, 10:00 AM'
        }
    ],
    past: [
        {
            id: 'english-feedback',
            title: 'English Essay Feedback',
            priority: 'standard',
            status: 'completed',
            time: 'Yesterday, 2:00 PM (1 hour)'
        }
    ],
    all: [
        {
            id: 'math-tutoring',
            title: 'Math Tutoring',
            priority: 'standard',
            status: 'scheduled',
            time: 'Today, 3:00 PM'
        },
        {
            id: 'science-review',
            title: 'Science Project Review',
            priority: 'urgent',
            status: 'scheduled',
            time: 'Tomorrow, 10:00 AM'
        },
        {
            id: 'history-discussion',
            title: 'History Discussion',
            priority: 'standard',
            status: 'in-progress',
            time: 'In Progress'
        },
        {
            id: 'english-feedback',
            title: 'English Essay Feedback',
            priority: 'standard',
            status: 'completed',
            time: 'Yesterday, 2:00 PM (1 hour)'
        }
    ]
};

// Function to load meetings from API
async function loadSampleMeetings() {
    // Clear existing meetings
    const allTabContents = document.querySelectorAll('.tab-content');
    allTabContents.forEach(content => {
        const meetingsList = content.querySelector('.meetings-list');
        if (meetingsList) {
            meetingsList.innerHTML = '';
        }
    });

    // Try to load from API first
    try {
        if (typeof apiClient !== 'undefined') {
            const meetings = await apiClient.getMeetings();
            const meetingList = meetings.results || meetings || [];
            
            if (meetingList.length > 0) {
                // Group meetings by status
                const now = new Date();
                const upcoming = [];
                const past = [];
                const all = [];
                
                meetingList.forEach(meeting => {
                    const meetingDate = new Date(meeting.scheduled_time);
                    const meetingCard = {
                        id: meeting.meeting_id || meeting.id,
                        title: meeting.title,
                        priority: meeting.priority || 'standard',
                        status: meeting.status,
                        time: formatMeetingTime(meeting.scheduled_time, meeting.duration_minutes),
                        meeting: meeting // Store full meeting object
                    };
                    
                    all.push(meetingCard);
                    if (meetingDate > now && meeting.status !== 'completed' && meeting.status !== 'cancelled') {
                        upcoming.push(meetingCard);
                    } else {
                        past.push(meetingCard);
                    }
                });
                
                // Add to appropriate tabs
                upcoming.forEach(meeting => addMeetingToTab('upcoming', meeting));
                past.forEach(meeting => addMeetingToTab('past', meeting));
                all.forEach(meeting => addMeetingToTab('all', meeting));
                
                return; // Successfully loaded from API
            }
        }
    } catch (error) {
        console.error('Error loading meetings from API:', error);
        // Fall through to sample data
    }
    
    // Fallback: Load sample data if API fails or no meetings found
    Object.keys(sampleMeetings).forEach(tabName => {
        sampleMeetings[tabName].forEach(meeting => {
            addMeetingToTab(tabName, meeting);
        });
    });
}

// Utility function to format time
function formatMeetingTime(date, duration = null) {
    const now = new Date();
    const meetingDate = new Date(date);
    const diffInHours = (meetingDate - now) / (1000 * 60 * 60);

    if (diffInHours < 0) {
        // Past meeting
        const diffInDays = Math.abs(diffInHours) / 24;
        if (diffInDays < 1) {
            return `Yesterday, ${meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${duration ? ` (${duration})` : ''}`;
        } else if (diffInDays < 7) {
            return `${Math.floor(diffInDays)} days ago`;
        } else {
            return meetingDate.toLocaleDateString();
        }
    } else if (diffInHours < 24) {
        // Today
        return `Today, ${meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffInHours < 48) {
        // Tomorrow
        return `Tomorrow, ${meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        // Future
        return meetingDate.toLocaleDateString() + ', ' + meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Export functions for potential use in other modules
window.MeetingsInterface = {
    ...window.MeetingsInterface,
    switchTab,
    handleScheduleMeeting,
    handleMeetingCardClick,
    createMeetingCard,
    addMeetingToTab,
    removeMeeting,
    updateMeetingStatus,
    loadSampleMeetings,
    formatMeetingTime
};
