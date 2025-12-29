(function () {
    if (window.RealtimeDashboard) return;

    const RealtimeDashboard = {
        _ws: null,
        _reconnectTimer: null,
        _reconnectAttempt: 0,
        _lastBadges: {},

        init() {
            this.connect();
            // Bind notification list actions (delete, view/mark read) using delegation where possible.
            this._bindNotificationDelegation();
        },

        connect() {
            try {
                if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) {
                    return;
                }
            } catch (e) {}

            const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
            const url = `${proto}://${window.location.host}/ws/dashboard/`;
            const ws = new WebSocket(url);
            this._ws = ws;

            ws.onopen = () => {
                this._reconnectAttempt = 0;
                this._clearReconnect();
                // Optional keepalive
                try { ws.send(JSON.stringify({ type: 'ping' })); } catch (e) {}
            };

            ws.onmessage = (evt) => {
                let msg = null;
                try { msg = JSON.parse(evt.data); } catch (e) { return; }
                this._handleMessage(msg);
            };

            ws.onclose = () => {
                this._scheduleReconnect();
            };

            ws.onerror = () => {
                // Let onclose trigger reconnect
            };
        },

        _scheduleReconnect() {
            this._clearReconnect();
            const attempt = ++this._reconnectAttempt;
            const delay = Math.min(15000, 500 + attempt * 750);
            this._reconnectTimer = setTimeout(() => this.connect(), delay);
        },

        _clearReconnect() {
            if (this._reconnectTimer) {
                clearTimeout(this._reconnectTimer);
                this._reconnectTimer = null;
            }
        },

        _handleMessage(msg) {
            if (!msg) return;
            if (msg.type === 'bootstrap' && msg.badges) {
                this._applyBadges(msg.badges);
                return;
            }
            if (msg.type === 'event') {
                this._handleEvent(msg.event, msg.data || {});
            }
        },

        _handleEvent(eventName, data) {
            if (!eventName) return;
            if (eventName === 'badges.updated') {
                const badges = (data && data.badges) || {};
                this._applyBadges(badges);
                this._emit(eventName, data);
                return;
            }

            // Notifications
            if (eventName === 'notification.created') {
                this._insertNotification(data);
                this._emit(eventName, data);
                return;
            }
            if (eventName === 'notification.updated') {
                this._markNotificationUpdated(data);
                this._emit(eventName, data);
                return;
            }
            if (eventName === 'notification.deleted') {
                this._removeNotification(data && data.notification_id);
                this._emit(eventName, data);
                return;
            }
            if (eventName === 'notifications.cleared') {
                this._clearNotifications();
                this._emit(eventName, data);
                return;
            }
            if (eventName === 'notifications.all_read') {
                this._markAllNotificationsRead();
                this._emit(eventName, data);
                return;
            }

            // Other domain events (assignments/homework/exams/announcements/invoices/etc.)
            this._emit(eventName, data);
        },

        _emit(eventName, data) {
            try {
                window.dispatchEvent(new CustomEvent('studyapp:dashboard-event', {
                    detail: { event: eventName, data: data || {} }
                }));
            } catch (e) {}
        },

        _applyBadges(badges) {
            this._lastBadges = badges || {};
            const n = Number(badges.notifications_unread || 0);
            const m = Number(badges.messages_unread || 0);
            const t = Number(badges.threads_unread || 0);
            const meet = Number(badges.meetings_active || 0);

            this._setNotificationHeaderBadge(n);
            this._setNavBadge(['messages', 'communication'], m);
            this._setNavBadge(['threads'], t);
            this._setNavBadge(['meetings'], meet);
            this._setNavBadge(['notifications', 'notification'], n);
        },

        _formatCount(count) {
            const n = Number(count);
            const safe = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
            return safe > 99 ? '99+' : String(safe);
        },

        _setNotificationHeaderBadge(count) {
            const formatted = this._formatCount(count);

            // Student header badge
            const studentBadge = document.getElementById('notificationsUnreadBadge');
            if (studentBadge) {
                studentBadge.textContent = formatted;
                studentBadge.style.display = 'inline-flex';
            }

            // Teacher header badge
            const teacherBadge = document.getElementById('teacherNotificationsUnreadBadge');
            if (teacherBadge) {
                teacherBadge.textContent = formatted;
                teacherBadge.style.display = 'inline-flex';
            }

            // Admin / CS-Rep bell counter badge
            const btn = document.getElementById('notificationButton');
            if (btn) {
                let badge = btn.querySelector('.notification-counter-badge');
                if (!badge) {
                    // Create badge if it doesn't exist
                    badge = document.createElement('span');
                    badge.className = 'notification-counter-badge';
                    badge.id = 'notificationCounterBadge';
                    btn.appendChild(badge);
                }
                const n = Number(count) || 0;
                if (n > 0) {
                    badge.textContent = this._formatCount(n);
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                    badge.textContent = '';
                }
            }
        },

        _setNavBadge(sectionNames, count) {
            const n = Number(count) || 0;
            const formatted = this._formatCount(n);
            (sectionNames || []).forEach(section => {
                const links = document.querySelectorAll(`.nav-link[data-section="${section}"]`);
                links.forEach(link => {
                    const dot = link.querySelector('.notification-dot[data-badge-dot], .notification-dot');
                    const badge = link.querySelector('.nav-badge[data-badge-key], .nav-badge');
                    if (badge) {
                        if (n > 0) {
                            badge.textContent = formatted;
                            badge.style.display = 'inline-flex';
                        } else {
                            badge.textContent = '0';
                            badge.style.display = 'none';
                        }
                    }
                    if (dot) {
                        dot.style.display = n > 0 ? 'block' : 'none';
                    }
                });
            });
        },

        _bindNotificationDelegation() {
            // Student notifications page list
            const studentList = document.getElementById('notificationsList');
            if (studentList && !studentList.dataset.rtBound) {
                studentList.dataset.rtBound = '1';
                studentList.addEventListener('click', async (e) => {
                    const btn = e.target.closest('button[data-action]');
                    const li = e.target.closest('li[data-id]');
                    if (!li) return;
                    const id = li.getAttribute('data-id');
                    if (!id) return;

                    if (btn && btn.dataset.action === 'delete') {
                        e.preventDefault();
                        if (window.apiClient?.deleteNotification) {
                            try { await window.apiClient.deleteNotification(id); } catch (err) {}
                        }
                        return;
                    }
                });
            }

            // CS-Rep notifications list
            const csList = document.getElementById('notificationsAlertsList');
            if (csList && !csList.dataset.rtBound) {
                csList.dataset.rtBound = '1';
                csList.addEventListener('click', async (e) => {
                    const btn = e.target.closest('button[data-action]');
                    const li = e.target.closest('li[data-id]');
                    if (!li) return;
                    const id = li.getAttribute('data-id');
                    if (!id) return;
                    if (btn && btn.dataset.action === 'delete') {
                        e.preventDefault();
                        if (window.apiClient?.deleteNotification) {
                            try { await window.apiClient.deleteNotification(id); } catch (err) {}
                        }
                    }
                });
            }

            // Admin / Teacher notifications pages (div cards)
            ['adminNotificationsPageList', 'teacherNotificationsPageList'].forEach((containerId) => {
                const el = document.getElementById(containerId);
                if (!el || el.dataset.rtBound) return;
                el.dataset.rtBound = '1';
                el.addEventListener('click', async (e) => {
                    const btn = e.target.closest('button[data-action]');
                    const item = e.target.closest('.notification-item[data-id]');
                    if (!item) return;
                    const id = item.getAttribute('data-id');
                    if (!id) return;

                    if (btn && btn.dataset.action === 'delete') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.apiClient?.deleteNotification) {
                            try { await window.apiClient.deleteNotification(id); } catch (err) {}
                        }
                    }
                });
            });

            // Admin notifications dropdown list
            const adminDropdown = document.getElementById('adminNotificationDropdownList');
            if (adminDropdown && !adminDropdown.dataset.rtBound) {
                adminDropdown.dataset.rtBound = '1';
                adminDropdown.addEventListener('click', async (e) => {
                    const btn = e.target.closest('button[data-action="delete"]');
                    const item = e.target.closest('.notification-dropdown-item[data-id]');
                    if (!item) return;
                    const id = item.getAttribute('data-id');
                    if (!id) return;
                    if (btn) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.apiClient?.deleteNotification) {
                            try { await window.apiClient.deleteNotification(id); } catch (err) {}
                        }
                    }
                });
            }
        },

        _insertNotification(n) {
            if (!n || !n.notification_id) return;

            // If the current page has a notifications list, insert immediately.
            this._insertStudentNotification(n);
            this._insertAdminTeacherNotification(n);
            this._insertAdminDropdownNotification(n);
            this._insertCSRepNotification(n);
        },

        _insertStudentNotification(n) {
            const list = document.getElementById('notificationsList');
            if (!list) return;

            const li = document.createElement('li');
            li.setAttribute('data-id', n.notification_id);
            li.setAttribute('data-type', n.notification_type || 'system');
            if (!n.is_read) li.classList.add('unread');

            const title = this._escape(n.title || n.message || 'Notification');
            const meta = `${new Date(n.created_at).toLocaleString()} · ${this._escape(n.notification_type || 'system')}`;

            li.innerHTML = `
                <span class="alert-badge ${n.is_read ? '' : 'unread'}"></span>
                <div>
                    <p class="alert-text">${title}</p>
                    <p class="alert-meta">${meta}</p>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="ghost-button" type="button" data-action="view">View</button>
                    <button class="ghost-button" type="button" data-action="delete">Delete</button>
                </div>
            `;

            list.prepend(li);
            const empty = document.getElementById('noNotificationsMessage');
            if (empty) empty.style.display = 'none';

            // Bind view click (mark read)
            const viewBtn = li.querySelector('button[data-action="view"]');
            if (viewBtn) {
                viewBtn.addEventListener('click', async () => {
                    try { await window.apiClient?.markNotificationRead?.(n.notification_id); } catch (e) {}
                });
            }
        },

        _insertCSRepNotification(n) {
            const list = document.getElementById('notificationsAlertsList');
            if (!list) return;

            const li = document.createElement('li');
            li.setAttribute('data-id', n.notification_id);
            if (!n.is_read) li.classList.add('unread');

            const title = this._escape(n.title || n.message || 'Notification');
            const meta = `${new Date(n.created_at).toLocaleString()} · ${this._escape(n.notification_type || 'system')}`;

            li.innerHTML = `
                <span class="alert-badge neutral ${n.is_read ? '' : 'unread'}"></span>
                <div>
                    <p class="alert-text">${title}</p>
                    <p class="alert-meta">${meta}</p>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="ghost-button" type="button" data-action="view">View</button>
                    <button class="ghost-button" type="button" data-action="delete">Delete</button>
                </div>
            `;
            list.prepend(li);

            const viewBtn = li.querySelector('button[data-action="view"]');
            if (viewBtn) {
                viewBtn.addEventListener('click', async () => {
                    try { await window.apiClient?.markNotificationRead?.(n.notification_id); } catch (e) {}
                });
            }
        },

        _insertAdminTeacherNotification(n) {
            const containers = [
                document.getElementById('adminNotificationsPageList'),
                document.getElementById('teacherNotificationsPageList'),
            ].filter(Boolean);
            if (!containers.length) return;

            const id = n.notification_id;
            const type = n.notification_type || 'system';
            const unread = n.is_read ? '' : 'unread';
            const title = this._escape(n.title || 'Notification');
            const msg = this._escape(n.message || '');
            const time = n.created_at ? new Date(n.created_at).toLocaleString() : '';

            containers.forEach(container => {
                const div = document.createElement('div');
                div.className = `notification-item ${unread}`;
                div.setAttribute('data-type', type);
                div.setAttribute('data-id', id);
                div.innerHTML = `
                    <div class="notification-icon ${type}">
                        <i class="fas fa-bell"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-header">
                            <h4 class="notification-title">${title}</h4>
                            <span class="notification-time">${time}</span>
                        </div>
                        <p class="notification-message">${msg}</p>
                        <div class="notification-actions" style="display:flex;gap:12px;align-items:center;">
                            <button class="action-link" type="button" data-mark-read="${id}">
                                <i class="fas fa-check"></i>
                                Mark as Read
                            </button>
                            <button class="action-link" type="button" data-action="delete">
                                <i class="fas fa-trash"></i>
                                Delete
                            </button>
                        </div>
                    </div>
                `;
                container.prepend(div);

                const markBtn = div.querySelector('button[data-mark-read]');
                if (markBtn) {
                    markBtn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        try { await window.apiClient?.markNotificationRead?.(id); } catch (err) {}
                    });
                }

                // Click-to-open (except buttons)
                div.style.cursor = 'pointer';
                div.addEventListener('click', (e) => {
                    if (e.target.closest('button') || e.target.closest('a')) return;
                    try { window.apiClient?.markNotificationRead?.(id); } catch (err) {}
                });
            });
        },

        _insertAdminDropdownNotification(n) {
            const container = document.getElementById('adminNotificationDropdownList');
            if (!container) return;

            // Remove placeholder (if any)
            const loading = container.querySelector('.notification-loading');
            if (loading) loading.remove();

            const id = n.notification_id;
            const type = n.notification_type || 'system';
            const unread = n.is_read ? '' : 'unread';
            const title = this._escape(n.title || 'Notification');
            const msg = this._escape(n.message || '');
            const time = n.created_at ? new Date(n.created_at).toLocaleString() : '';

            const div = document.createElement('div');
            div.className = `notification-dropdown-item ${unread}`;
            div.setAttribute('data-type', type);
            div.setAttribute('data-id', id);
            div.style.cursor = 'pointer';
            div.innerHTML = `
                <div class="dropdown-notification-icon ${type}">
                    <i class="fas fa-bell"></i>
                </div>
                <div class="dropdown-notification-content">
                    <div class="dropdown-notification-header">
                        <h4 class="dropdown-notification-title">${title}</h4>
                        <span class="dropdown-notification-time">${time}</span>
                    </div>
                    <p class="dropdown-notification-message">${msg}</p>
                </div>
                <button class="dropdown-notification-close" type="button" data-action="delete" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            `;

            div.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                try { window.apiClient?.markNotificationRead?.(id); } catch (err) {}
            });

            container.prepend(div);
        },

        _markNotificationUpdated(data) {
            const id = data && data.notification_id;
            if (!id) return;

            // Student list
            document.querySelectorAll(`#notificationsList li[data-id="${CSS.escape(id)}"]`).forEach(li => {
                li.classList.remove('unread');
                const badge = li.querySelector('.alert-badge');
                if (badge) badge.classList.remove('unread');
            });

            // CS-Rep list
            document.querySelectorAll(`#notificationsAlertsList li[data-id="${CSS.escape(id)}"]`).forEach(li => {
                li.classList.remove('unread');
                const badge = li.querySelector('.alert-badge');
                if (badge) badge.classList.remove('unread');
            });

            // Admin/Teacher cards
            document.querySelectorAll(`.notification-item[data-id="${CSS.escape(id)}"]`).forEach(el => {
                el.classList.remove('unread');
            });
        },

        _removeNotification(id) {
            if (!id) return;
            document.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach(el => {
                // Only remove notification rows/cards
                if (el.classList.contains('notification-item') || el.tagName === 'LI') {
                    el.remove();
                }
            });
        },

        _clearNotifications() {
            const studentList = document.getElementById('notificationsList');
            if (studentList) studentList.innerHTML = '';

            const csList = document.getElementById('notificationsAlertsList');
            if (csList) csList.innerHTML = '';

            const admin = document.getElementById('adminNotificationsPageList');
            if (admin) admin.innerHTML = '';

            const teacher = document.getElementById('teacherNotificationsPageList');
            if (teacher) teacher.innerHTML = '';
        },

        _markAllNotificationsRead() {
            document.querySelectorAll('.notification-item.unread').forEach(el => el.classList.remove('unread'));
            document.querySelectorAll('#notificationsList li.unread').forEach(el => el.classList.remove('unread'));
            document.querySelectorAll('#notificationsAlertsList li.unread').forEach(el => el.classList.remove('unread'));
            document.querySelectorAll('.alert-badge.unread').forEach(el => el.classList.remove('unread'));
        },

        _escape(str) {
            const s = String(str == null ? '' : str);
            return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        },

        _escapeAttr(str) {
            const s = String(str == null ? '' : str);
            return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        },
    };

    window.RealtimeDashboard = RealtimeDashboard;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => RealtimeDashboard.init());
    } else {
        RealtimeDashboard.init();
    }
})();


