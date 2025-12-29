(function () {
    if (window.StudyMessaging) return;

    const StudyMessaging = {
        _initialized: false,
        _activeThreadId: null,
        _threads: [],
        _threadMap: new Map(),
        _threadMeta: new Map(), // threadId -> { other_last_read_at }
        _presenceByUserId: new Map(), // userId -> boolean
        _pendingFiles: [],
        _ws: null,
        _wsReconnectTimer: null,
        _wsReconnectAttempt: 0,
        // No polling: all user-facing updates are WS-driven.
        _sectionEl: null,
        _els: {},

        init() {
            const section = document.getElementById('messagesSection') || document.getElementById('communicationSection');
            if (!section) return;

            // Re-init when section is re-injected by the SPA loader.
            if (this._sectionEl !== section) {
                this._initialized = false;
                this._sectionEl = section;
            }
            if (this._initialized) return;

            this._cacheEls(section);
            if (!this._els.threadList || !this._els.messagesContainer) {
                console.warn('StudyMessaging: Missing required DOM elements.');
                return;
            }

            this._bindUI();
            this._connectWebSocket();

            // If another page (e.g. Student Tutors tab) requested opening a chat, honor it on init.
            const pendingUserId = window.__pendingMessagingUserId;
            if (pendingUserId) {
                window.__pendingMessagingUserId = null;
                this.startConversation(pendingUserId)
                    .catch((e) => {
                        console.error('Failed to start pending conversation:', e);
                        // Fall back to normal load
                        this.refreshThreads().then(() => {
                            if (this._threads.length > 0) this.openThread(this._threads[0].id);
                            else this._renderEmptyThreads();
                        });
                    });
            } else {
                this.refreshThreads().then(() => {
                    // Auto-open first thread (if any)
                    if (this._threads.length > 0) {
                        this.openThread(this._threads[0].id);
                    } else {
                        this._renderEmptyThreads();
                    }
                });
            }

            this._bindVisibilityRefresh();

            this._initialized = true;
            console.log('✅ StudyMessaging initialized');
        },

        _bindVisibilityRefresh() {
            if (this._visibilityBound) return;
            this._visibilityBound = true;
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    this._connectWebSocket();
                    this.refreshThreads().catch(() => {});
                    if (this._activeThreadId) {
                        this._pollActiveThread().catch(() => {});
                    }
                }
            });
            window.addEventListener('focus', () => {
                this._connectWebSocket();
                this.refreshThreads().catch(() => {});
            });
        },

        _cacheEls(section) {
            this._els = {
                threadList: section.querySelector('#messagesContactList') || section.querySelector('#communicationThreadList'),
                messagesContainer: section.querySelector('#messagesContainer'),
                threadHeaderName: section.querySelector('#threadHeaderName'),
                searchInput: section.querySelector('#messagesSearchInput'),
                deleteThreadBtn: section.querySelector('#deleteThreadBtn'),

                newConvBtn: section.querySelector('#newConversationBtn'),
                newConvMenu: section.querySelector('#newConversationMenu'),
                newConvSearch: section.querySelector('#newConversationSearch'),
                newConvList: section.querySelector('#newConversationList'),

                messageInput: section.querySelector('#messageInput') || section.querySelector('#communicationMessageInput'),
                fileInput: section.querySelector('#fileInput') || section.querySelector('#communicationFileInput'),
                sendBtn: section.querySelector('#sendMessageBtn') || section.querySelector('#communicationSendBtn'),
                attachBtn: section.querySelector('#attachmentBtn') || section.querySelector('#communicationAttachmentBtn'),

                attachmentPreview: section.querySelector('#attachmentPreview'),
                attachmentList: section.querySelector('#attachmentList'),
            };
        },

        _bindUI() {
            const els = this._els;
            const section = this._sectionEl;

            // Thread click (event delegation)
            els.threadList.removeEventListener('click', this._onThreadClickBound);
            this._onThreadClickBound = (e) => {
                const item = e.target.closest('.thread-item');
                if (!item) return;
                const threadId = item.dataset.threadId;
                if (threadId) this.openThread(threadId);
            };
            els.threadList.addEventListener('click', this._onThreadClickBound);

            // Delete thread (Admin/Teacher/CS Rep only; student UI doesn't include the button)
            if (els.deleteThreadBtn) {
                els.deleteThreadBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await this.deleteActiveThread();
                });
            }

            if (els.searchInput) {
                els.searchInput.addEventListener('input', () => {
                    const q = (els.searchInput.value || '').trim().toLowerCase();
                    els.threadList.querySelectorAll('.thread-item').forEach(item => {
                        const name = (item.dataset.name || '').toLowerCase();
                        const role = (item.dataset.role || '').toLowerCase();
                        item.style.display = (!q || name.includes(q) || role.includes(q)) ? 'flex' : 'none';
                    });
                });
            }

            // New conversation dropdown
            if (els.newConvBtn && els.newConvMenu) {
                els.newConvBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const isOpen = els.newConvMenu.style.display === 'block';
                    els.newConvMenu.style.display = isOpen ? 'none' : 'block';
                    if (!isOpen) {
                        this._loadAllowedUsers();
                        if (els.newConvSearch) els.newConvSearch.focus();
                    }
                });
                document.addEventListener('click', () => {
                    if (els.newConvMenu) els.newConvMenu.style.display = 'none';
                });
            }

            if (els.newConvSearch) {
                els.newConvSearch.addEventListener('input', () => {
                    this._filterNewConvList();
                });
            }

            // User tabs in dropdown
            section.querySelectorAll('.user-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    section.querySelectorAll('.user-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    this._filterNewConvList();
                });
            });

            // Attachments
            if (els.attachBtn && els.fileInput) {
                els.attachBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (els.fileInput.disabled) return;
                    els.fileInput.value = '';
                    els.fileInput.click();
                });
                els.fileInput.addEventListener('change', () => {
                    const files = Array.from(els.fileInput.files || []);
                    if (files.length) this._addPendingFiles(files);
                });
            }

            // Send
            if (els.sendBtn) {
                els.sendBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.sendMessage();
                });
            }
            if (els.messageInput) {
                els.messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.sendMessage();
                    }
                });
            }
        },

        _filterNewConvList() {
            const els = this._els;
            if (!els.newConvList) return;

            const q = (els.newConvSearch?.value || '').trim().toLowerCase();
            const activeTab = this._sectionEl?.querySelector('.user-tab.active')?.dataset.tab || 'all';

            els.newConvList.querySelectorAll('.user-dropdown-item').forEach(item => {
                const name = (item.dataset.name || '').toLowerCase();
                const email = (item.dataset.email || '').toLowerCase();
                const role = (item.dataset.role || '').toUpperCase();
                
                const matchesSearch = !q || name.includes(q) || email.includes(q);
                const matchesTab = activeTab === 'all' || role === activeTab;

                item.style.display = (matchesSearch && matchesTab) ? 'flex' : 'none';
            });
        },

        async _loadAllowedUsers() {
            const els = this._els;
            if (!els.newConvList) return;
            els.newConvList.innerHTML = '<div style="padding:12px;color:var(--muted);">Loading...</div>';
            try {
                const resp = await this._apiGet('/messages/api/allowed-users/');
                const users = (resp && resp.users) || [];
                els.newConvList.innerHTML = '';
                if (users.length === 0) {
                    els.newConvList.innerHTML = '<div style="padding:12px;color:var(--muted);">No available users.</div>';
                    return;
                }
                users.forEach(u => {
                    const div = document.createElement('div');
                    div.className = 'user-dropdown-item';
                    div.dataset.userId = u.id;
                    div.dataset.name = u.name || '';
                    div.dataset.email = u.email || '';
                    div.dataset.role = u.role || '';
                    div.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-radius:10px;';
                    div.innerHTML = `
                        <div style="width:34px;height:34px;border-radius:50%;background:#eef2ff;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                            ${u.avatar_url ? `<img src="${u.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover;">` : `<i class="fas fa-user" style="color:#64748b;"></i>`}
                        </div>
                        <div style="min-width:0;flex:1;">
                            <div style="font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._escape(u.name || u.email)}</div>
                            <div style="font-size:0.8rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._escape(u.role || '')}</div>
                        </div>
                    `;
                    div.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        await this.startConversation(u.id);
                        if (els.newConvMenu) els.newConvMenu.style.display = 'none';
                    });
                    els.newConvList.appendChild(div);
                });
                this._filterNewConvList(); // Apply initial filter
            } catch (e) {
                console.error('Allowed users load failed:', e);
                els.newConvList.innerHTML = '<div style="padding:12px;color:#ef4444;">Failed to load users.</div>';
            }
        },

        async refreshThreads() {
            const resp = await this._apiGet('/messages/api/threads/');
            this._threads = (resp && resp.threads) || [];
            this._threadMap = new Map(this._threads.map(t => [t.id, t]));
            this._threadMeta = new Map(this._threads.map(t => [t.id, { other_last_read_at: t.other_last_read_at || null }]));
            // Seed presence cache from API
            this._threads.forEach(t => {
                const uid = t?.other_user?.id;
                if (uid) this._presenceByUserId.set(uid, !!t.other_user_online);
            });
            this._renderThreads();
            // Sidebar badges are driven by ws/dashboard/ (realtimeDashboard.js)
            this._updateTicksForActiveThread();
        },

        _renderEmptyThreads() {
            const els = this._els;
            if (!els.threadList) return;
            els.threadList.innerHTML = '<div style="padding:16px;color:var(--muted);">No conversations yet.</div>';
            if (els.threadHeaderName) els.threadHeaderName.textContent = 'Select a conversation';
            if (els.messagesContainer) {
                els.messagesContainer.innerHTML = '<div style="padding:16px;color:var(--muted);text-align:center;">No messages yet.</div>';
            }
            this._activeThreadId = null;
            this._updateDeleteButtonVisibility();
        },

        _renderThreads() {
            const els = this._els;
            if (!els.threadList) return;
            els.threadList.innerHTML = '';

            if (!this._threads.length) {
                this._renderEmptyThreads();
                return;
            }

            this._threads.forEach(t => {
                const u = t.other_user;
                const item = document.createElement('div');
                item.className = 'thread-item';
                if (t.id === this._activeThreadId) item.classList.add('active');
                item.dataset.threadId = t.id;
                item.dataset.name = u?.name || '';
                item.dataset.role = u?.role || '';

                const unread = Number(t.unread_count || 0);
                const online = u?.id ? !!this._presenceByUserId.get(u.id) : false;
                const presenceColor = online ? '#22c55e' : '#ef4444';
                const presenceTitle = online ? 'Online' : 'Offline';
                const displayId = u?.display_id ? String(u.display_id) : '';

                // Force consistent alignment regardless of role-specific template CSS.
                item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;cursor:pointer;';

                item.innerHTML = `
                    <div style="position:relative;width:44px;height:44px;flex:0 0 44px;">
                        <div class="avatar" style="width:44px;height:44px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#eef2ff;">
                            ${u?.avatar_url ? `<img src="${u.avatar_url}" alt="${this._escape(u.name || '')}" style="width:100%;height:100%;object-fit:cover;" />` : `<i class="fas fa-user" style="color:#64748b;"></i>`}
                        </div>
                        <span class="presence-dot" title="${presenceTitle}" style="position:absolute;top:-1px;right:-1px;width:12px;height:12px;border-radius:50%;background:${presenceColor};border:2px solid var(--surface,#fff);"></span>
                    </div>
                    <div class="meta" style="min-width:0;flex:1;display:flex;flex-direction:column;gap:2px;">
                        <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                            <span class="name" style="font-weight:800;color:var(--text,#0f172a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._escape(u?.name || u?.email || 'Unknown')}</span>
                            ${displayId ? `<span class="user-id" style="font-size:0.75rem;color:var(--muted,#64748b);flex:0 0 auto;">#${this._escape(displayId)}</span>` : ``}
                        </div>
                        <span class="role" style="font-size:0.8rem;color:var(--muted,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._escape(u?.role || '')}</span>
                    </div>
                    <div style="flex:0 0 auto;display:flex;align-items:center;gap:8px;">
                        ${unread > 0 ? `<span class="unread-badge" style="min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#ef4444;color:#fff;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;">${unread > 99 ? '99+' : unread}</span>` : ``}
                    </div>
                `;
                els.threadList.appendChild(item);
            });
        },

        async openThread(threadId) {
            if (!threadId) return;
            this._activeThreadId = threadId;
            this._renderThreads();

            const thread = this._threadMap.get(threadId);
            if (this._els.threadHeaderName) {
                this._els.threadHeaderName.textContent = thread?.other_user?.name || 'Conversation';
            }

            this._els.messagesContainer.innerHTML = '<div style="padding:16px;color:var(--muted);">Loading...</div>';
            const resp = await this._apiGet(`/messages/api/threads/${threadId}/messages/?limit=80`);
            const msgs = (resp && resp.messages) || [];
            this._renderMessages(msgs);

            // Mark read (best-effort)
            this._apiPost(`/messages/api/threads/${threadId}/mark-read/`, {}).catch(() => {});

            // Update local unread count
            if (thread) {
                thread.unread_count = 0;
                // Sidebar badges are driven by ws/dashboard/ (realtimeDashboard.js)
                this._renderThreads();
            }

            // Update ticks based on latest thread metadata
            this._updateTicksForActiveThread();

            // Show/hide delete button
            this._updateDeleteButtonVisibility();
        },

        _renderMessages(messages) {
            const el = this._els.messagesContainer;
            el.innerHTML = '';
            if (!messages.length) {
                el.innerHTML = '<div style="padding:16px;color:var(--muted);text-align:center;">No messages yet.</div>';
                return;
            }
            messages.forEach(m => this._appendMessage(m));
            el.scrollTop = el.scrollHeight;
        },

        _appendMessage(m) {
            const el = this._els.messagesContainer;
            if (!el) return;
            if (el.querySelector(`[data-message-id="${m.id}"]`)) return;

            const isMine = (m.sender && m.sender.id) && (window.currentUserId && m.sender.id === window.currentUserId);

            const row = document.createElement('div');
            row.className = 'msg-row' + (isMine ? ' right' : '');
            row.dataset.messageId = m.id;

            const senderAvatar = m.sender?.avatar_url;
            const attachments = Array.isArray(m.attachments) ? m.attachments : [];
            const attachmentsHtml = attachments.length
                ? `<div class="message-attachments">${attachments.map(a => {
                    const name = this._escape(a.name || 'file');
                    const url = a.url;
                    return `<div class="attachment-item" title="${name}">
                                <div class="attachment-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                                    <a href="${url}" target="_blank" rel="noopener noreferrer" class="attachment-link attachment-view"
                                       style="color:inherit;text-decoration:none;display:inline-flex;gap:8px;align-items:center;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,0.05);">
                                        <i class="fas fa-paperclip" style="color:var(--primary);"></i>
                                        <span class="attachment-name" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</span>
                                    </a>
                                    <a href="${url}" download class="attachment-link attachment-download"
                                       style="color:inherit;text-decoration:none;display:inline-flex;gap:6px;align-items:center;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,0.05);">
                                        <i class="fas fa-download" style="color:var(--muted-text);"></i>
                                        <span>Download</span>
                                    </a>
                                </div>
                            </div>`;
                }).join('')}</div>`
                : '';

            const createdAt = m.created_at || null;
            const tickHtml = isMine
                ? `<div class="msg-ticks" data-created-at="${this._escape(createdAt || '')}" style="display:flex;justify-content:flex-end;gap:4px;margin-top:4px;font-size:12px;line-height:12px;">
                        <span class="tick tick-1" style="color:#94a3b8;">✓</span>
                        <span class="tick tick-2" style="color:#94a3b8;">✓</span>
                   </div>`
                : '';

            row.innerHTML = `
                ${!isMine ? `<div class="avatar">${senderAvatar ? `<img src="${senderAvatar}" alt="">` : `<div class="avatar-fallback"><i class="fas fa-user"></i></div>`}</div>` : ''}
                <div class="bubble ${isMine ? 'user' : 'admin'}">
                    ${m.content ? this._escape(m.content) : ''}
                    ${attachmentsHtml}
                    ${tickHtml}
                </div>
                ${isMine ? `<div class="avatar">${senderAvatar ? `<img src="${senderAvatar}" alt="">` : `<div class="avatar-fallback"><i class="fas fa-user"></i></div>`}</div>` : ''}
            `;
            el.appendChild(row);

            if (isMine) this._updateTicksForActiveThread();
        },

        async startConversation(targetUserId) {
            const form = new FormData();
            form.append('target_user_id', targetUserId);
            const resp = await this._apiPostForm('/messages/api/threads/create/', form);
            const threadId = resp?.thread?.id;
            if (!threadId) return;
            await this.refreshThreads();
            await this.openThread(threadId);
        },

        _addPendingFiles(files) {
            files.forEach(f => {
                const exists = this._pendingFiles.some(x => x.name === f.name && x.size === f.size);
                if (!exists) this._pendingFiles.push(f);
            });
            this._renderPendingFiles();
        },

        _renderPendingFiles() {
            const preview = this._els.attachmentPreview;
            const list = this._els.attachmentList;
            if (!preview || !list) return;

            if (!this._pendingFiles.length) {
                preview.style.display = 'none';
                list.innerHTML = '';
                return;
            }
            preview.style.display = 'block';
            list.innerHTML = '';

            this._pendingFiles.forEach((f, idx) => {
                const item = document.createElement('div');
                item.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 8px;background:var(--surface);border:1px solid var(--divider);border-radius:6px;font-size:0.8rem;';
                item.innerHTML = `
                    <i class="fas fa-paperclip" style="color:var(--primary);"></i>
                    <span style="max-width: 160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this._escape(f.name)}</span>
                    <button type="button" data-idx="${idx}" style="background:none;border:none;color:var(--muted);cursor:pointer;padding:0;margin-left:4px;">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                item.querySelector('button').addEventListener('click', () => {
                    this._pendingFiles.splice(idx, 1);
                    this._renderPendingFiles();
                });
                list.appendChild(item);
            });
        },

        async sendMessage() {
            if (!this._activeThreadId) {
                this._toast('Please select a conversation first.', 'error');
                return;
            }
            const content = (this._els.messageInput?.value || '').trim();
            if (!content && !this._pendingFiles.length) {
                return;
            }

            const form = new FormData();
            form.append('content', content);
            this._pendingFiles.forEach(f => form.append('files', f));

            try {
                const resp = await this._apiPostForm(`/messages/api/threads/${this._activeThreadId}/send/`, form);
                const msg = resp?.message;
                if (msg) this._appendMessage(msg);
                if (this._els.messageInput) this._els.messageInput.value = '';
                this._pendingFiles = [];
                this._renderPendingFiles();
                this._els.messagesContainer.scrollTop = this._els.messagesContainer.scrollHeight;
                await this.refreshThreads();
            } catch (e) {
                console.error('Send failed:', e);
                this._toast('Failed to send message.', 'error');
            }
        },

        _connectWebSocket() {
            if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) {
                return;
            }
            const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${proto}//${window.location.host}/ws/messages/`;

            try {
                this._ws = new WebSocket(wsUrl);
            } catch (e) {
                console.warn('WS connection failed:', e);
                this._scheduleWsReconnect();
                return;
            }

            this._ws.onmessage = async (ev) => {
                let data;
                try { data = JSON.parse(ev.data); } catch { return; }

                if (data.type === 'message' && data.message) {
                    const m = data.message;
                    const threadId = m.thread_id;

                    // Update local thread cache
                    if (!this._threadMap.has(threadId)) {
                        await this.refreshThreads();
                    } else {
                        const t = this._threadMap.get(threadId);
                        t.last_message = { id: m.id, sender_id: m.sender?.id, content: m.content, created_at: m.created_at };
                        if (threadId !== this._activeThreadId) {
                            t.unread_count = (Number(t.unread_count || 0) + 1);
                        }
                        // Move to top
                        this._threads = [t, ...this._threads.filter(x => x.id !== threadId)];
                        this._threadMap = new Map(this._threads.map(x => [x.id, x]));
                        this._renderThreads();
                        // Sidebar badges are driven by ws/dashboard/ (realtimeDashboard.js)
                    }

                    if (threadId === this._activeThreadId) {
                        this._appendMessage(m);
                        this._apiPost(`/messages/api/threads/${threadId}/mark-read/`, {}).catch(() => {});
                        this._els.messagesContainer.scrollTop = this._els.messagesContainer.scrollHeight;
                    }
                }

                if (data.type === 'read') {
                    const threadId = data.thread_id;
                    const readAt = data.read_at;
                    if (threadId && readAt) {
                        this._threadMeta.set(threadId, { other_last_read_at: readAt });
                        if (threadId === this._activeThreadId) {
                            this._updateTicksForActiveThread();
                        }
                    }
                }

                if (data.type === 'presence') {
                    const uid = data.user_id;
                    if (uid) {
                        this._presenceByUserId.set(uid, !!data.is_online);
                        this._renderThreads();
                    }
                }

                if (data.type === 'thread_deleted') {
                    const threadId = data.thread_id;
                    if (threadId) {
                        this._removeThreadLocally(threadId);
                    }
                }

                if (data.type === 'thread_created') {
                    await this.refreshThreads();
                }
            };

            this._ws.onopen = () => {
                console.log('✅ Messaging WS connected');
                this._wsReconnectAttempt = 0;
                if (this._wsReconnectTimer) {
                    clearTimeout(this._wsReconnectTimer);
                    this._wsReconnectTimer = null;
                }
                // Presence keepalive ping every 30s while connected
                if (!this._presencePingTimer) {
                    this._presencePingTimer = setInterval(() => {
                        try {
                            if (this._ws && this._ws.readyState === WebSocket.OPEN) {
                                this._ws.send(JSON.stringify({ type: 'presence_ping' }));
                            }
                        } catch (_) { }
                    }, 30000);
                }
            };
            this._ws.onclose = () => {
                console.log('ℹ️ Messaging WS closed');
                this._ws = null;
                this._scheduleWsReconnect();
            };
            this._ws.onerror = () => {
                // Some browsers call onerror before onclose
                try { this._ws && this._ws.close(); } catch (_) {}
            };
        },

        _scheduleWsReconnect() {
            if (this._wsReconnectTimer) return;
            // Exponential backoff (max ~15s)
            const attempt = Math.min(this._wsReconnectAttempt, 7);
            const delay = Math.min(15000, 500 * Math.pow(2, attempt));
            this._wsReconnectAttempt += 1;
            this._wsReconnectTimer = setTimeout(() => {
                this._wsReconnectTimer = null;
                this._connectWebSocket();
            }, delay);
        },

        async _pollActiveThread() {
            const threadId = this._activeThreadId;
            if (!threadId || !this._els.messagesContainer) return;

            // Fetch the latest ~30 messages and append any we don't have yet.
            const resp = await this._apiGet(`/messages/api/threads/${threadId}/messages/?limit=30`);
            const msgs = (resp && resp.messages) || [];
            msgs.forEach(m => this._appendMessage(m));
            // If we’re viewing it, mark read (best-effort)
            this._apiPost(`/messages/api/threads/${threadId}/mark-read/`, {}).catch(() => {});

            // Polling also refreshes thread metadata (incl. other_last_read_at)
            this.refreshThreads().catch(() => {});
        },

        _updateTicksForActiveThread() {
            const threadId = this._activeThreadId;
            if (!threadId) return;
            const meta = this._threadMeta.get(threadId);
            const otherLastReadAt = meta?.other_last_read_at ? new Date(meta.other_last_read_at) : null;
            if (!otherLastReadAt || isNaN(otherLastReadAt.getTime())) {
                // No read info -> keep grey
                return;
            }
            const container = this._els.messagesContainer;
            if (!container) return;
            container.querySelectorAll('.msg-row.right .msg-ticks').forEach(ticksEl => {
                const createdAtStr = ticksEl.getAttribute('data-created-at') || '';
                const createdAt = createdAtStr ? new Date(createdAtStr) : null;
                if (!createdAt || isNaN(createdAt.getTime())) return;
                const seen = otherLastReadAt.getTime() >= createdAt.getTime();
                const color = seen ? '#1d4ed8' : '#94a3b8'; // blue if seen, grey otherwise
                ticksEl.querySelectorAll('.tick').forEach(t => { t.style.color = color; });
            });
        },

        // Sidebar badges are driven by ws/dashboard/ (realtimeDashboard.js)

        _updateDeleteButtonVisibility() {
            const btn = this._els.deleteThreadBtn;
            if (!btn) return;
            const role = (window.currentUserRole || '').toUpperCase();
            const allowed = role && role !== 'STUDENT';
            btn.style.display = (allowed && !!this._activeThreadId) ? 'inline-flex' : 'none';
        },

        async deleteActiveThread() {
            const threadId = this._activeThreadId;
            if (!threadId) return;
            const role = (window.currentUserRole || '').toUpperCase();
            if (role === 'STUDENT') return;

            const ok = confirm('Delete this chat for everyone? This will remove all messages in this conversation.');
            if (!ok) return;

            try {
                await this._apiPost(`/messages/api/threads/${threadId}/delete/`, {});
                this._removeThreadLocally(threadId);
            } catch (e) {
                console.error('Delete thread failed:', e);
                this._toast('Failed to delete chat.', 'error');
            }
        },

        _removeThreadLocally(threadId) {
            this._threads = this._threads.filter(t => t.id !== threadId);
            this._threadMap.delete(threadId);
            this._threadMeta.delete(threadId);

            if (this._activeThreadId === threadId) {
                this._activeThreadId = null;
                if (this._threads.length > 0) {
                    this.openThread(this._threads[0].id);
                } else {
                    this._renderEmptyThreads();
                }
            }

            this._renderThreads();
            // Sidebar badges are driven by ws/dashboard/ (realtimeDashboard.js)
            this._updateDeleteButtonVisibility();
        },

        async _apiGet(url) {
            if (window.apiClient && typeof window.apiClient.get === 'function') {
                const resp = await window.apiClient.get(url);
                if (resp && resp.success === false) throw new Error(resp.error || 'Request failed');
                return resp;
            }
            const resp = await fetch(url, { credentials: 'include' });
            const data = await resp.json();
            if (!resp.ok || data.success === false) throw new Error(data.error || 'Request failed');
            return data;
        },

        async _apiPost(url, bodyJson) {
            if (window.apiClient && typeof window.apiClient.post === 'function') {
                const resp = await window.apiClient.post(url, bodyJson);
                if (resp && resp.success === false) throw new Error(resp.error || 'Request failed');
                return resp;
            }
            const resp = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyJson || {}),
            });
            const data = await resp.json();
            if (!resp.ok || data.success === false) throw new Error(data.error || 'Request failed');
            return data;
        },

        async _apiPostForm(url, formData) {
            if (window.apiClient && typeof window.apiClient.postFormData === 'function') {
                const resp = await window.apiClient.postFormData(url, formData);
                if (resp && resp.success === false) throw new Error(resp.error || 'Request failed');
                return resp;
            }
            const resp = await fetch(url, { method: 'POST', credentials: 'include', body: formData });
            const data = await resp.json();
            if (!resp.ok || data.success === false) throw new Error(data.error || 'Request failed');
            return data;
        },

        _escape(s) {
            const div = document.createElement('div');
            div.textContent = s == null ? '' : String(s);
            return div.innerHTML;
        },

        _toast(message, type) {
            if (window.showToast) return window.showToast(message, type || 'info');
            if (type === 'error') alert(message);
            else console.log(message);
        },
    };

    window.StudyMessaging = StudyMessaging;
    window.initStudyMessagingOnLoad = function () {
        try { StudyMessaging.init(); } catch (e) { console.error('Messaging init failed:', e); }
    };
})();
