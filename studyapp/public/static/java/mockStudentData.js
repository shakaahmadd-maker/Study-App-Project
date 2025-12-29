/**
 * Mock Data for Student Dashboard
 * Minimal data for development and user experience only
 * Most data is hardcoded directly in HTML files
 */

// Minimal mock data - only for functions that need it
const mockAssignments = [
    {
        assignment_id: 1,
        assignment_code: 'ASG-2025-001',
        title: 'Research Paper on Climate Change',
        service_type: 'assignment_solution',
        status: 'in_process',
        due_date: '2025-02-15T23:59:59Z',
        created_at: '2025-01-10T10:30:00Z',
        subject: 'Environmental Science',
        teacher_name: 'Dr. Sarah Chen'
    },
    {
        assignment_id: 2,
        assignment_code: 'ASG-2025-002',
        title: 'Literature Essay - The Great Gatsby',
        service_type: 'writing',
        status: 'completed',
        due_date: '2025-01-20T23:59:59Z',
        created_at: '2025-01-05T14:20:00Z',
        subject: 'English Literature',
        teacher_name: 'Prof. Michael Johnson'
    }
];

const mockTutors = [
    {
        tutor_id: 1,
        first_name: 'Sarah',
        last_name: 'Chen',
        email: 'sarah.chen@example.com',
        subject: 'Environmental Science',
        assignment_code: 'ASG-2025-001',
        assignment_title: 'Research Paper on Climate Change',
        status: 'active',
        rating: 4.8
    }
];

const mockInvoices = [
    {
        invoice_id: 1,
        invoice_number: 'INV-2025-001',
        assignment_code: 'ASG-2025-001',
        total_amount: 200.00,
        status: 'pending_payment',
        created_at: '2025-01-10T10:30:00Z'
    }
];

// Export mock data functions - minimal data only
window.getMockAssignments = function() {
    return [...mockAssignments];
};

window.getMockTutors = function() {
    return [...mockTutors];
};

window.getMockInvoices = function() {
    return [...mockInvoices];
};

// Minimal fallback functions for other data types
window.getMockHomework = function() {
    return [];
};

window.getMockOnlineExams = function() {
    return [];
};

window.getMockAnnouncements = function() {
    return [];
};

window.getMockNotifications = function() {
    return [];
};

window.getMockWritingRecords = function() {
    return [];
};

window.getMockMessages = function() {
    return [];
};

window.getMockThreads = function() {
    return [];
};

window.getMockMeetings = function() {
    return [];
};

