/**
 * API Client for Study Companion Backend
 * Handles JWT authentication and API calls
 */

// Prevent redeclaration if script is loaded multiple times
if (typeof APIClient === 'undefined') {
    window.APIClient = class APIClient {
    constructor() {
        this.baseURL = '/api';
        this.accessToken = localStorage.getItem('access_token');
        this.refreshToken = localStorage.getItem('refresh_token');
    }

    /**
     * Get CSRF token from cookies, hidden input, or meta tag
     */
    getCsrfToken() {
        // First, try to get from hidden input field (Django's {% csrf_token %})
        const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
        if (csrfInput && csrfInput.value) {
            return csrfInput.value;
        }
        
        // Second, try to get from cookies (with proper decoding)
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, 'csrftoken'.length + 1) === ('csrftoken' + '=')) {
                    const cookieValue = cookie.substring('csrftoken'.length + 1);
                    return decodeURIComponent(cookieValue);
                }
            }
        }
        
        // Third, try meta tag
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) {
            return metaTag.getAttribute('content');
        }
        
        return '';
    }

    /**
     * Get authorization headers
     */
    getHeaders(includeCSRF = false) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        if (includeCSRF) {
            headers['X-CSRFToken'] = this.getCsrfToken();
        }

        return headers;
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await fetch(`${this.baseURL}/accounts/token/refresh/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    refresh: this.refreshToken,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                this.accessToken = data.access;
                localStorage.setItem('access_token', data.access);
                return data.access;
            } else {
                // Refresh failed, redirect to login
                this.logout();
                throw new Error('Token refresh failed');
            }
        } catch (error) {
            this.logout();
            throw error;
        }
    }

    /**
     * Make API request with automatic token refresh
     */
    async request(endpoint, options = {}) {
        // If endpoint already includes the full path starting with /account, use it as-is
        // Otherwise, prepend baseURL
        // Check if endpoint is an absolute path (starts with /account/ or /api/)
        const trimmedEndpoint = endpoint.trim();
        let url;
        if (trimmedEndpoint.startsWith('/account/')) {
            // Full Django URL path - use as-is (don't prepend baseURL)
            url = trimmedEndpoint;
        } else if (trimmedEndpoint.startsWith('/api/')) {
            // Already has /api/ prefix - use as-is
            url = trimmedEndpoint;
        } else if (trimmedEndpoint.startsWith('/')) {
            // Absolute path but not /account/ or /api/ - use as-is
            url = trimmedEndpoint;
        } else {
            // Relative endpoint - prepend baseURL
            url = `${this.baseURL}${trimmedEndpoint}`;
        }
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(options.includeCSRF),
                ...(options.headers || {}),
            },
        };

        // If body is FormData, ensure Content-Type is NOT set to allow browser to set boundary
        if (options.body instanceof FormData) {
            delete config.headers['Content-Type'];
        }

        console.log(`[API] Endpoint received: ${endpoint}`);
        console.log(`[API] BaseURL: ${this.baseURL}`);
        console.log(`[API] Final URL: ${url}`);
        console.log(`[API] ${options.method || 'GET'} ${url}`);
        console.log('[API] Headers:', config.headers);
        if (options.body) {
            console.log('[API] Body:', options.body);
        }

        let response = await fetch(url, config);

        console.log(`[API] Response status: ${response.status} ${response.statusText}`);
        console.log(`[API] Response headers:`, Object.fromEntries(response.headers.entries()));

        // If 401, try to refresh token and retry
        if (response.status === 401 && this.refreshToken) {
            console.log('[API] 401 Unauthorized, attempting token refresh...');
            try {
                await this.refreshAccessToken();
                config.headers['Authorization'] = `Bearer ${this.accessToken}`;
                console.log('[API] Retrying request with new token...');
                response = await fetch(url, config);
                console.log(`[API] Retry response status: ${response.status} ${response.statusText}`);
            } catch (error) {
                console.error('[API] Token refresh failed:', error);
                // Refresh failed, will redirect to login
                return response;
            }
        }

        return response;
    }

    /**
     * GET request
     */
    async get(endpoint, options = {}) {
        const response = await this.request(endpoint, {
            method: 'GET',
            ...options,
        });

        let responseData;
        try {
            const text = await response.text();
            console.log('[API] Response text:', text);
            responseData = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error('[API] Failed to parse response as JSON:', e);
            responseData = { error: 'Invalid JSON response' };
        }

        // If response is not OK, throw an error
        if (!response.ok) {
            console.error('[API] Request failed:', response.status, responseData);
            const error = new Error(responseData.error || responseData.message || responseData.detail || 'Request failed');
            error.status = response.status;
            error.data = responseData;
            throw error;
        }

        console.log('[API] Request successful:', responseData);
        return responseData;
    }

    /**
     * POST request
     */
    async post(endpoint, data, options = {}) {
        const response = await this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
            includeCSRF: true,
            ...options,
        });

        let responseData;
        try {
            const text = await response.text();
            console.log('[API] Response text:', text);
            responseData = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error('[API] Failed to parse response as JSON:', e);
            responseData = { error: 'Invalid JSON response' };
        }

        // If response is not OK, throw an error
        if (!response.ok) {
            console.error('[API] Request failed:', response.status, responseData);
            const error = new Error(responseData.error || responseData.message || responseData.detail || 'Request failed');
            error.status = response.status;
            error.data = responseData;
            // Also add error_type and error message directly to error object for easier access
            error.error_type = responseData.error_type;
            error.error_message = responseData.error || responseData.message || responseData.detail;
            throw error;
        }

        console.log('[API] Request successful:', responseData);
        return responseData;
    }

    /**
     * POST FormData request (for file uploads)
     */
    async postFormData(endpoint, formData, options = {}) {
        // Do not set Content-Type header, browser will set it with boundary for FormData
        const headers = this.getHeaders(true);
        delete headers['Content-Type'];

        const response = await this.request(endpoint, {
            method: 'POST',
            body: formData,
            headers: headers,
            ...options,
        });

        let responseData;
        try {
            const text = await response.text();
            console.log('[API] Response text:', text);
            responseData = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error('[API] Failed to parse response as JSON:', e);
            responseData = { error: 'Invalid JSON response' };
        }

        if (!response.ok) {
            console.error('[API] Request failed:', response.status, responseData);
            const error = new Error(responseData.error || responseData.message || 'Request failed');
            error.status = response.status;
            error.data = responseData;
            throw error;
        }

        console.log('[API] Request successful:', responseData);
        return responseData;
    }

    /**
     * PUT request
     */
    async put(endpoint, data, options = {}) {
        const response = await this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
            includeCSRF: true,
            ...options,
        });

        let responseData;
        try {
            const text = await response.text();
            console.log('[API] Response text:', text);
            responseData = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error('[API] Failed to parse response as JSON:', e);
            responseData = { error: 'Invalid JSON response' };
        }

        // If response is not OK, throw an error
        if (!response.ok) {
            console.error('[API] Request failed:', response.status, responseData);
            const error = new Error(responseData.error || responseData.message || responseData.detail || 'Request failed');
            error.status = response.status;
            error.data = responseData;
            throw error;
        }

        console.log('[API] Request successful:', responseData);
        return responseData;
    }

    /**
     * DELETE request
     */
    async delete(endpoint, options = {}) {
        const response = await this.request(endpoint, {
            method: 'DELETE',
            includeCSRF: true,
            ...options,
        });
        return response.json();
    }

    /**
     * Login and store tokens
     */
    async login(email, password) {
        const response = await fetch(`${this.baseURL}/accounts/login/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken(),
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            this.accessToken = data.tokens.access;
            this.refreshToken = data.tokens.refresh;
            localStorage.setItem('access_token', data.tokens.access);
            localStorage.setItem('refresh_token', data.tokens.refresh);
            localStorage.setItem('user_role', data.role);
            localStorage.setItem('user_id', data.user_id);
            if (data.email) localStorage.setItem('user_email', data.email);
            if (data.name) localStorage.setItem('user_name', data.name);
        }

        return data;
    }

    /**
     * Logout and clear tokens
     */
    logout() {
        this.accessToken = null;
        this.refreshToken = null;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_name');
        window.location.href = '/login/';
    }

    /**
     * Register new student
     */
    async register(studentData) {
        const response = await fetch(`${this.baseURL}/accounts/register/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken(),
            },
            body: JSON.stringify(studentData),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Auto-login after registration
            return await this.login(studentData.email, studentData.password);
        }

        return data;
    }

    // Assignment methods
    async getAssignments(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        const endpoint = `/assignments/${queryString ? '?' + queryString : ''}`;
        console.log('Getting assignments from:', endpoint);
        return this.get(endpoint);
    }

    async createAssignment(assignmentData) {
        console.log('POST /assignments/ with data:', JSON.stringify(assignmentData, null, 2));
        return this.post('/assignments/', assignmentData);
    }

    async getAssignment(id) {
        return this.get(`/assignments/${id}/`);
    }

    async cancelAssignment(id) {
        return this.post(`/assignments/${id}/cancel/`);
    }

    async assignTeacher(assignmentId, teacherId) {
        return this.post(`/assignments/${assignmentId}/assign-teacher/`, { teacher_id: teacherId });
    }

    // Invoice methods
    async getInvoices(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.get(`/invoices/${queryString ? '?' + queryString : ''}`);
    }

    async createInvoice(invoiceData) {
        return this.post('/invoices/', invoiceData);
    }

    async approveInvoice(invoiceId) {
        return this.post(`/invoices/${invoiceId}/approve/`);
    }

    async createCheckoutSession(invoiceId) {
        return this.post(`/invoices/${invoiceId}/create-checkout/`);
    }

    // Messaging methods
    async getThreads(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.get(`/messaging/threads/${queryString ? '?' + queryString : ''}`);
    }

    async getThreadMessages(threadId) {
        return this.get(`/messaging/threads/${threadId}/messages/`);
    }

    async sendMessage(threadId, content) {
        return this.post(`/messaging/threads/${threadId}/messages/`, { content });
    }

    // Meeting methods
    async getMeetings(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.get(`/meeting/api/list/${queryString ? '?' + queryString : ''}`);
    }

    async createMeeting(meetingData) {
        return this.post('/meeting/api/schedule/', meetingData);
    }

    async getMeetingDetails(meetingId) {
        return this.get(`/meeting/api/${meetingId}/details/`);
    }

    async startMeeting(meetingId) {
        return this.post(`/meeting/api/${meetingId}/start/`);
    }

    async endMeeting(meetingId) {
        return this.post(`/meeting/api/${meetingId}/end/`);
    }

    async downloadMeetingRecording(meetingId) {
        if (localStorage.getItem('user_role') === 'TEACHER') {
            try {
                const targetUrl = `/meeting/api/${meetingId}/download-recording/`;
                const response = await this.post('/mask/generate/', { target_url: targetUrl, link_type: 'recording' });
                if (response.success) {
                    window.open(response.masked_url, '_blank');
                    return;
                }
            } catch (error) {
                console.error('Failed to generate masked link:', error);
            }
        }
        window.open(`/meeting/api/${meetingId}/download-recording/`, '_blank');
    }

    // Notification methods
    async getNotifications(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.get(`/notifications/notifications/${queryString ? '?' + queryString : ''}`);
    }

    async markNotificationRead(notificationId) {
        return this.post(`/notifications/notifications/${notificationId}/mark_read/`);
    }

    async markAllNotificationsRead() {
        return this.post('/notifications/notifications/mark_all_read/');
    }

    async deleteNotification(notificationId) {
        return this.post(`/notifications/notifications/${notificationId}/delete/`);
    }

    async deleteAllNotifications() {
        return this.post('/notifications/notifications/delete_all/');
    }

    async getUnreadNotificationCount() {
        return this.get('/notifications/notifications/unread_count/');
    }

    async getAnnouncements(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.get(`/announcement/api/list/${queryString ? '?' + queryString : ''}`);
    }

    async createAnnouncement(announcementData) {
        return this.post('/announcement/api/create/', announcementData);
    }

    async getAnnouncementRecipients() {
        return this.get('/announcement/api/recipients/');
    }

    async deleteAnnouncement(announcementId) {
        return this.post(`/announcement/api/delete/${announcementId}/`);
    }

    async markAnnouncementRead(announcementId) {
        return this.post(`/announcement/api/mark-read/${announcementId}/`);
    }

    // User profile methods
    /**
     * Refresh tokens from localStorage
     */
    refreshTokens() {
        this.accessToken = localStorage.getItem('access_token');
        this.refreshToken = localStorage.getItem('refresh_token');
        return !!this.accessToken;
    }

    async getProfile() {
        // Use the correct profile endpoint
        // For CS-Rep, use the account profile endpoint
        return this.get('/account/api/accounts/profile/');
    }

    async updateProfile(profileData) {
        // For CS-Rep profile updates, use POST with FormData or JSON to the profile endpoint
        // Note: This method may not be used for CS-Rep, as they use direct FormData submission
        return this.post('/account/api/accounts/profile/', profileData);
    }

    async getSettings() {
        return this.get('/accounts/settings/');
    }

    async updateSettings(settingsData) {
        return this.put('/accounts/settings/', settingsData);
    }

    // Admin methods - User management
    async getStudents() {
        return this.get('/accounts/students/');
    }

    async getTeachers() {
        return this.get('/accounts/teachers/');
    }

    async getCSReps() {
        return this.get('/accounts/csreps/');
    }

    async createTeacher(teacherData) {
        return this.post('/account/api/accounts/create-teacher/', teacherData);
    }

    async createCSRep(csrepData) {
        return this.post('/account/api/accounts/create-csrep/', csrepData);
    }
    };
} else {
    // Use existing class if already declared
    window.APIClient = APIClient;
}

// Create global instance - only create if it doesn't exist
if (typeof apiClient === 'undefined') {
    window.apiClient = new window.APIClient();
} else {
    window.apiClient = apiClient;
}

// WebSocket helper for chat - prevent redeclaration with safer pattern
if (typeof window.ChatWebSocket === 'undefined') {
    window.ChatWebSocket = class {
        constructor(threadId) {
            this.threadId = threadId;
            this.ws = null;
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = 5;
        }

        connect(onMessage, onError) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/chat/${this.threadId}/`;

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('Chat WebSocket connected');
                this.reconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (onMessage) onMessage(data);
            };

            this.ws.onerror = (error) => {
                console.error('Chat WebSocket error:', error);
                if (onError) onError(error);
            };

            this.ws.onclose = () => {
                console.log('Chat WebSocket closed');
                // Attempt to reconnect
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    setTimeout(() => this.connect(onMessage, onError), 1000 * this.reconnectAttempts);
                }
            };
        }

        sendMessage(content) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'message',
                    content: content,
                }));
            }
        }

        disconnect() {
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
        }
    };
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APIClient, ChatWebSocket, apiClient };
}
