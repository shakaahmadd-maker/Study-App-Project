/**
 * Mock Data Service
 * Handles localStorage persistence for meeting data (frontend-only)
 * TODO: Replace localStorage calls with API/WebSocket calls when backend is integrated
 */

class MockDataService {
    constructor(meetingId) {
        this.meetingId = meetingId || 'demo-meeting';
        this.storagePrefix = `meeting_${this.meetingId}_`;
        this.initDemoData();
    }

    // Initialize demo data if not exists
    initDemoData() {
        if (!this.getChatMessages().length) {
            this.seedDemoData();
        }
    }

    // ============ CHAT MESSAGES ============
    getChatMessages(filterUserId = null) {
        const key = `${this.storagePrefix}chat`;
        const messages = JSON.parse(localStorage.getItem(key) || '[]');
        
        if (filterUserId) {
            return messages.filter(msg => 
                msg.userId === filterUserId || msg.recipientId === filterUserId
            );
        }
        return messages;
    }

    addChatMessage(message) {
        const key = `${this.storagePrefix}chat`;
        const messages = this.getChatMessages();
        const newMessage = {
            id: Date.now().toString(),
            userId: message.userId,
            username: message.username,
            message: this.sanitizeMessage(message.message),
            timestamp: new Date().toISOString(),
            recipientId: message.recipientId || null, // null = group message
            attachments: message.attachments || [],
            reactions: message.reactions || []
        };
        messages.push(newMessage);
        localStorage.setItem(key, JSON.stringify(messages));
        return newMessage;
    }

    // TODO: Replace with WebSocket.send when backend is integrated
    sendMessage(message) {
        return this.addChatMessage(message);
    }

    sanitizeMessage(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============ PARTICIPANTS ============
    getParticipants() {
        const key = `${this.storagePrefix}participants`;
        const stored = localStorage.getItem(key);
        if (stored) {
            return JSON.parse(stored);
        }
        return this.getMockParticipants();
    }

    getMockParticipants() {
        return [
            { id: 'user1', name: 'You', role: 'Host', isOnline: true, isMuted: false, isVideoOff: false },
            { id: 'user2', name: 'Dr. Sarah Chen', role: 'Co-host', isOnline: true, isMuted: false, isVideoOff: false },
            { id: 'user3', name: 'Alex Johnson', role: 'Student', isOnline: true, isMuted: true, isVideoOff: false },
            { id: 'user4', name: 'Maria Garcia', role: 'Student', isOnline: true, isMuted: false, isVideoOff: true },
            { id: 'user5', name: 'Prof. David Kim', role: 'Teacher', isOnline: false, isMuted: false, isVideoOff: false },
            { id: 'user6', name: 'Emma Wilson', role: 'Student', isOnline: true, isMuted: false, isVideoOff: false }
        ];
    }

    updateParticipantStatus(userId, updates) {
        const key = `${this.storagePrefix}participants`;
        const participants = this.getParticipants();
        const index = participants.findIndex(p => p.id === userId);
        if (index !== -1) {
            participants[index] = { ...participants[index], ...updates };
            localStorage.setItem(key, JSON.stringify(participants));
        }
    }

    // ============ NOTES ============
    getPersonalNotes() {
        const key = `${this.storagePrefix}notes_personal`;
        return JSON.parse(localStorage.getItem(key) || '[]');
    }

    savePersonalNote(note) {
        const key = `${this.storagePrefix}notes_personal`;
        const notes = this.getPersonalNotes();
        const noteData = {
            id: note.id || Date.now().toString(),
            content: note.content,
            updatedAt: new Date().toISOString()
        };
        const index = notes.findIndex(n => n.id === noteData.id);
        if (index !== -1) {
            notes[index] = noteData;
        } else {
            notes.push(noteData);
        }
        localStorage.setItem(key, JSON.stringify(notes));
        return noteData;
    }

    getSharedNotes() {
        const key = `${this.storagePrefix}notes_shared`;
        return JSON.parse(localStorage.getItem(key) || '[]');
    }

    shareNote(note) {
        const key = `${this.storagePrefix}notes_shared`;
        const notes = this.getSharedNotes();
        const sharedNote = {
            id: Date.now().toString(),
            authorId: 'user1',
            authorName: 'You',
            content: note.content,
            createdAt: new Date().toISOString()
        };
        notes.push(sharedNote);
        localStorage.setItem(key, JSON.stringify(notes));
        return sharedNote;
    }

    // ============ AGENDA ============
    getAgenda() {
        const key = `${this.storagePrefix}agenda`;
        const stored = localStorage.getItem(key);
        if (stored) {
            return JSON.parse(stored);
        }
        return this.getMockAgenda();
    }

    getMockAgenda() {
        return [
            { id: '1', title: 'Welcome & Introductions', description: 'Brief introductions from all participants', completed: true, order: 0 },
            { id: '2', title: 'Review Assignment Progress', description: 'Discuss current progress on the project', completed: false, order: 1 },
            { id: '3', title: 'Q&A Session', description: 'Address questions and concerns', completed: false, order: 2 }
        ];
    }

    saveAgenda(agenda) {
        const key = `${this.storagePrefix}agenda`;
        localStorage.setItem(key, JSON.stringify(agenda));
    }

    // ============ TASKS ============
    getTasks() {
        const key = `${this.storagePrefix}tasks`;
        const stored = localStorage.getItem(key);
        if (stored) {
            return JSON.parse(stored);
        }
        return this.getMockTasks();
    }

    getMockTasks() {
        return [
            { 
                id: '1', 
                title: 'Complete Chapter 5 Reading', 
                description: 'Read and summarize key points',
                assignedTo: 'user3',
                assignedToName: 'Alex Johnson',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'todo',
                createdAt: new Date().toISOString()
            },
            { 
                id: '2', 
                title: 'Submit Project Proposal', 
                description: 'Finalize and submit the project proposal document',
                assignedTo: 'user4',
                assignedToName: 'Maria Garcia',
                dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'in-progress',
                createdAt: new Date().toISOString()
            }
        ];
    }

    saveTasks(tasks) {
        const key = `${this.storagePrefix}tasks`;
        localStorage.setItem(key, JSON.stringify(tasks));
    }

    // ============ RESOURCES ============
    getResources() {
        const key = `${this.storagePrefix}resources`;
        return JSON.parse(localStorage.getItem(key) || '[]');
    }

    addResource(resource) {
        const key = `${this.storagePrefix}resources`;
        const resources = this.getResources();
        const newResource = {
            id: Date.now().toString(),
            name: resource.name,
            type: resource.type,
            size: resource.size,
            dataUrl: resource.dataUrl,
            uploadedBy: resource.uploadedBy || 'user1',
            uploadedByName: resource.uploadedByName || 'You',
            uploadedAt: new Date().toISOString()
        };
        resources.push(newResource);
        localStorage.setItem(key, JSON.stringify(resources));
        return newResource;
    }

    // ============ RECORDINGS ============
    getRecordings() {
        const key = `${this.storagePrefix}recordings`;
        return JSON.parse(localStorage.getItem(key) || '[]');
    }

    // ============ ANALYTICS ============
    getAnalytics() {
        const messages = this.getChatMessages();
        const participants = this.getParticipants();
        
        // Calculate messages per user
        const messagesPerUser = {};
        messages.forEach(msg => {
            messagesPerUser[msg.userId] = (messagesPerUser[msg.userId] || 0) + 1;
        });

        // Generate participation timeline (last 24 hours, hourly buckets)
        const timeline = [];
        const now = new Date();
        for (let i = 23; i >= 0; i--) {
            const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
            const hourStart = new Date(hour.setMinutes(0, 0, 0));
            const hourEnd = new Date(hour.getTime() + 60 * 60 * 1000);
            const count = messages.filter(msg => {
                const msgTime = new Date(msg.timestamp);
                return msgTime >= hourStart && msgTime < hourEnd;
            }).length;
            timeline.push({
                hour: hourStart.getHours(),
                count
            });
        }

        return {
            messagesPerUser,
            participationTimeline: timeline,
            totalMessages: messages.length,
            activeParticipants: participants.filter(p => p.isOnline).length,
            totalParticipants: participants.length
        };
    }

    // ============ DEMO DATA SEED ============
    seedDemoData() {
        // Seed chat messages
        const demoMessages = [
            { userId: 'user2', username: 'Dr. Sarah Chen', message: 'Welcome everyone! Let\'s get started.', timestamp: new Date(Date.now() - 3600000).toISOString() },
            { userId: 'user1', username: 'You', message: 'Thanks for joining!', timestamp: new Date(Date.now() - 3500000).toISOString() },
            { userId: 'user3', username: 'Alex Johnson', message: 'Excited to be here!', timestamp: new Date(Date.now() - 3400000).toISOString() },
            { userId: 'user4', username: 'Maria Garcia', message: 'Looking forward to the discussion.', timestamp: new Date(Date.now() - 3300000).toISOString() },
            { userId: 'user2', username: 'Dr. Sarah Chen', message: 'Let\'s review the agenda items.', timestamp: new Date(Date.now() - 3200000).toISOString() },
            { userId: 'user6', username: 'Emma Wilson', message: 'I have a question about the assignment.', timestamp: new Date(Date.now() - 3100000).toISOString() },
            { userId: 'user2', username: 'Dr. Sarah Chen', message: 'Feel free to ask!', timestamp: new Date(Date.now() - 3000000).toISOString() },
            { userId: 'user1', username: 'You', message: 'I\'ll share the document in resources.', timestamp: new Date(Date.now() - 2900000).toISOString() },
            { userId: 'user3', username: 'Alex Johnson', message: 'Got it, thanks!', timestamp: new Date(Date.now() - 2800000).toISOString() },
            { userId: 'user5', username: 'Prof. David Kim', message: 'Great progress everyone!', timestamp: new Date(Date.now() - 2700000).toISOString() }
        ];

        const key = `${this.storagePrefix}chat`;
        localStorage.setItem(key, JSON.stringify(demoMessages));

        // Seed participants
        const participantsKey = `${this.storagePrefix}participants`;
        localStorage.setItem(participantsKey, JSON.stringify(this.getMockParticipants()));

        // Seed agenda
        const agendaKey = `${this.storagePrefix}agenda`;
        localStorage.setItem(agendaKey, JSON.stringify(this.getMockAgenda()));

        // Seed tasks
        const tasksKey = `${this.storagePrefix}tasks`;
        localStorage.setItem(tasksKey, JSON.stringify(this.getMockTasks()));
    }

    // ============ UTILITY ============
    clearMeetingData() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.storagePrefix)) {
                localStorage.removeItem(key);
            }
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MockDataService;
}


