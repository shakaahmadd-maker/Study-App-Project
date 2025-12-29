(function () {
    if (window.StudyThreads) return;

    const StudyThreads = {
        _initialized: false,
        _activeThreadId: null,
        _isSending: false,
        _threads: [],
        _threadMap: new Map(),
        _ws: null,
        _listWs: null,
        _participants: [],
        _sectionEl: null,
        _role: null,
        _els: {},
        _activeFilter: 'all',
        _mediaRecorder: null,
        _audioChunks: [],
        _recordingStartTime: 0,
        _filesBeforePicker: null,
        _isSettingFilesProgrammatically: false,
        _isSubmittingThread: false,

        init() {
            const section = document.getElementById('threadsSection');
            if (!section) return;

            this._sectionEl = section;
            this._role = (window.currentUserRole || '').toUpperCase();
            
            this._cacheEls(section);
            this._bindUI();
            this._connectListWebSocket();
            
            this.refreshThreads();
            this._initialized = true;
            console.log('✅ StudyThreads initialized for role:', this._role);
        },

        _cacheEls(section) {
            this._els = {
                threadsList: section.querySelector('.threads-list') || section.querySelector('#teacherThreadsList') || 
                             section.querySelector('#adminThreadsList') || section.querySelector('#csrepThreadsList') || 
                             section.querySelector('#threadsList'),
                detailView: section.querySelector('.thread-detail-view') || section.querySelector('#teacherThreadDetailView') ||
                            section.querySelector('#adminThreadDetailView') || section.querySelector('#csrepThreadDetailView') ||
                            section.querySelector('#threadDetailView'),
                noThreadsMsg: section.querySelector('#noTeacherThreadsMessage') ||
                             section.querySelector('#noAdminThreadsMessage') || 
                             section.querySelector('#noCSRepThreadsMessage') || 
                             section.querySelector('#noThreadsMessage'),
                
                // Details
                subjectTitle: section.querySelector('.thread-detail-subject'),
                viewTypeBadge: section.querySelector('.thread-type-badge'),
                viewAssignment: section.querySelector('[id*="ThreadViewAssignment"]'),
                viewInvoice: section.querySelector('[id*="ThreadViewInvoice"]'),
                participantsList: section.querySelector('.thread-participants-list'),
                messagesContainer: section.querySelector('.thread-messages-container'),
                
                // Composer
                replyInput: section.querySelector('#teacherThreadReplyInput') ||
                           section.querySelector('textarea[id*="ReplyInput"]'),
                sendBtn:
                    section.querySelector('#teacherThreadReplySendBtn') ||
                    section.querySelector('#studentThreadReplySendBtn') ||
                    section.querySelector('#adminThreadReplySendBtn') ||
                    section.querySelector('#csrepThreadReplySendBtn') ||
                    section.querySelector('#threadReplySendBtn') ||
                    section.querySelector('#threadViewSendBtn') ||
                    section.querySelector('button[onclick*="Reply"]') ||
                    section.querySelector('button[id*="ReplySendBtn"]') ||
                    section.querySelector('button.primary-button[id*="Send"]'),
                attachBtn:
                    section.querySelector('#teacherThreadAttachBtn') ||
                    section.querySelector('#studentThreadAttachBtn') ||
                    section.querySelector('#adminThreadAttachBtn') ||
                    section.querySelector('#csrepThreadAttachBtnFull') ||
                    section.querySelector('#csrepThreadAttachBtn') ||
                    section.querySelector('.icon-btn[title="Attach file"]'),
                voiceBtn: section.querySelector('.voice-record-btn'),
                fileInput:
                    section.querySelector('#teacherThreadFileInput') ||
                    section.querySelector('#studentThreadFileInput') ||
                    section.querySelector('#adminThreadFileInput') ||
                    section.querySelector('#csrepThreadFileInputFull') ||
                    section.querySelector('#csrepThreadFileInput') ||
                    section.querySelector('input[type="file"]'),
                attachmentsPreview:
                    section.querySelector('#composerAttachmentsPreview') ||
                    section.querySelector('.composer-attachments-preview'),

                // Filters
                filters: section.querySelectorAll('.filter-pill'),
                
                // Status actions (Admin / CS-Rep only)
                statusActions:
                    document.getElementById('adminThreadStatusActions') ||
                    document.getElementById('csrepThreadStatusActions') ||
                    document.getElementById('teacherThreadStatusActions'),
                resolveBtn:
                    document.getElementById('adminResolveThreadBtn') ||
                    document.getElementById('csrepResolveThreadBtn') ||
                    document.getElementById('teacherResolveThreadBtn'),
                closeBtn:
                    document.getElementById('adminCloseThreadBtn') ||
                    document.getElementById('csrepCloseThreadBtn') ||
                    document.getElementById('teacherCloseThreadBtn'),

                // Create Modal (CS-Rep / Admin only - not for teachers/students)
                createModal: document.getElementById('createThreadModal'),
                createForm: document.getElementById('createThreadForm'),
                createSubmitBtn: document.getElementById('createThreadSubmitBtn'),
                showCreateBtn: section.querySelector('#showCreateThreadModalBtn') || section.querySelector('button[onclick*="showCreateThreadModal"]') || section.querySelector('#createThreadBtn')
            };
        },

        _bindUI() {
            const els = this._els;
            if (!els.threadsList) return;

            // Handle type change to show/hide assignment/invoice fields
            const typeSelect = document.getElementById('threadType');
            if (typeSelect) {
                typeSelect.addEventListener('change', (e) => {
                    const val = e.target.value;
                    const assignmentField = document.getElementById('relatedAssignmentField');
                    const invoiceField = document.getElementById('relatedInvoiceField');
                    const studentSelectField = document.getElementById('studentSelectField');
                    
                    if (assignmentField) assignmentField.style.display = val === 'assignment' ? 'block' : 'none';
                    if (invoiceField) invoiceField.style.display = val === 'invoice' ? 'block' : 'none';
                    
                    // Show student select only for assignment related threads and for CS-Rep/Admin
                    if (studentSelectField) {
                        studentSelectField.style.display = (val === 'assignment' && (this._role === 'ADMIN' || this._role === 'CS_REP')) ? 'block' : 'none';
                    }
                });
            }

            // Handle student selection to filter assignments
            const studentSelect = document.getElementById('studentSelect');
            if (studentSelect) {
                studentSelect.addEventListener('change', (e) => {
                    this._loadAssignments(e.target.value);
                });
            }

            // Filters
            els.filters.forEach(f => {
                f.addEventListener('click', () => {
                    els.filters.forEach(x => x.classList.remove('active'));
                    f.classList.add('active');
                    this.refreshThreads(f.dataset.filter);
                });
            });
            
            // Status actions
            if (els.resolveBtn) {
                els.resolveBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.updateThreadStatus('resolved');
                });
            }
            if (els.closeBtn) {
                els.closeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.updateThreadStatus('closed');
                });
            }
            
            // Delete button (Admin only)
            const deleteBtn = document.getElementById('adminDeleteThreadBtn') || 
                             document.getElementById('teacherDeleteThreadBtn') ||
                             document.getElementById('csrepDeleteThreadBtn');
            if (deleteBtn && this._role === 'ADMIN') {
                deleteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (this._activeThreadId) {
                        this.deleteThread(this._activeThreadId);
                    }
                });
            }

            // Reply input @mention
            if (els.replyInput) {
                els.replyInput.addEventListener('input', (e) => this._handleMention(e));
                // Add styling for mention span in textarea is hard, usually needs a contenteditable.
                // For now we just use @[Name] in textarea.
            }

            // Create Thread (only for ADMIN and CS_REP)
            // Hide create button for teachers and students
            if (els.showCreateBtn && (this._role === 'TEACHER' || this._role === 'STUDENT')) {
                els.showCreateBtn.style.display = 'none';
            }
            if (els.showCreateBtn && (this._role === 'ADMIN' || this._role === 'CS_REP')) {
                els.showCreateBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showCreateModal();
                });
            }
            if (els.createSubmitBtn && (this._role === 'ADMIN' || this._role === 'CS_REP')) {
                // Remove any existing listeners to prevent duplicates
                const newBtn = els.createSubmitBtn.cloneNode(true);
                els.createSubmitBtn.parentNode.replaceChild(newBtn, els.createSubmitBtn);
                // Update reference
                this._els.createSubmitBtn = newBtn;
                
                // Add single event listener
                this._els.createSubmitBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.submitCreateThread();
                });
            }
            
            // Back button handler
            const section = this._sectionEl;
            const backBtn = section ? (section.querySelector('#backToThreadsListBtn') || 
                           section.querySelector('button:has(.fa-arrow-left)') ||
                           section.querySelector('button[onclick*="showThreadList"]')) : null;
            if (backBtn) {
                backBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (els.detailView) els.detailView.style.display = 'none';
                    if (els.threadsList) {
                        els.threadsList.style.display = '';
                        const container = els.threadsList.closest('.threads-list-container');
                        if (container) container.style.display = '';
                    }
                    const noThreadsMsg = els.noThreadsMsg;
                    if (noThreadsMsg && this._threads.length === 0) {
                        noThreadsMsg.style.display = 'flex';
                    }
                    this._activeThreadId = null;
                    if (this._ws) {
                        this._ws.close();
                        this._ws = null;
                    }
                    // Scroll back to top of threads section
                    const section = this._sectionEl;
                    if (section) {
                        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            }

            if (els.sendBtn) {
                els.sendBtn.onclick = null; // Remove inline
                els.sendBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.sendMessage();
                });
            }

            if (els.attachBtn && els.fileInput) {
                els.attachBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Support attaching multiple times without replacing previous selection
                    this._filesBeforePicker = Array.from(els.fileInput.files || []);
                    els.fileInput.click();
                });
                
                els.fileInput.addEventListener('change', () => {
                    // Skip merge logic when we are setting FileList programmatically (remove/clear)
                    if (this._isSettingFilesProgrammatically) {
                        this._isSettingFilesProgrammatically = false;
                        this._renderAttachmentPreview();
                        return;
                    }

                    const previous = Array.from(this._filesBeforePicker || []);
                    const selectedNow = Array.from(els.fileInput.files || []);
                    this._filesBeforePicker = null;

                    // Merge unique (name + size + lastModified)
                    const seen = new Set();
                    const merged = [];
                    [...previous, ...selectedNow].forEach(f => {
                        const key = `${f.name}|${f.size}|${f.lastModified}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            merged.push(f);
                        }
                    });
                    if (merged.length) {
                        this._setFileInputFiles(els.fileInput, merged);
                    }

                    if (els.fileInput.files.length > 0) {
                        if (window.showToast) window.showToast(`${els.fileInput.files.length} files attached`, 'info');
                        els.attachBtn.style.color = 'var(--primary)';
                    } else {
                        els.attachBtn.style.color = '';
                    }
                    this._renderAttachmentPreview();
                });
            }

            this._bindVoiceUI();
        },

        _bindVoiceUI() {
            const els = this._els;
            if (els.voiceBtn && els.voiceBtn.parentNode) {
                try {
                    // Remove any existing listeners to prevent duplicates
                    const newBtn = els.voiceBtn.cloneNode(true);
                    els.voiceBtn.parentNode.replaceChild(newBtn, els.voiceBtn);
                    this._els.voiceBtn = newBtn;
                    
                    // Click-to-toggle recording (no hold required)
                    newBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
                            this.stopRecording();
                        } else {
                            this.startRecording();
                        }
                    });
                } catch (err) {
                    console.warn('Failed to re-bind voice button, using existing:', err);
                    // Fallback: just add listener without cloning
                    els.voiceBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
                            this.stopRecording();
                        } else {
                            this.startRecording();
                        }
                    });
                }
            }
        },

        _reCacheComposerElements() {
            // Re-cache composer elements to handle modals and dynamic views
            const section = this._sectionEl;
            const detailView = this._els.detailView;
            const threadViewModal = document.getElementById('threadViewModal');
            
            // Try to find elements in detail view first, then modal, then section
            const searchScope = detailView || threadViewModal || section || document;
            
            this._els.replyInput = 
                searchScope.querySelector('#teacherThreadReplyInput') ||
                searchScope.querySelector('#studentThreadReplyInput') ||
                searchScope.querySelector('#adminThreadReplyInput') ||
                searchScope.querySelector('#csrepThreadReplyInput') ||
                searchScope.querySelector('#csrepThreadReplyInput') ||
                searchScope.querySelector('#threadReplyInput') ||
                searchScope.querySelector('textarea[id*="ReplyInput"]');
            
            this._els.sendBtn =
                searchScope.querySelector('#teacherThreadReplySendBtn') ||
                searchScope.querySelector('#studentThreadReplySendBtn') ||
                searchScope.querySelector('#adminThreadReplySendBtn') ||
                searchScope.querySelector('#csrepThreadReplySendBtn') ||
                searchScope.querySelector('#threadReplySendBtn') ||
                searchScope.querySelector('#threadViewSendBtn') ||
                searchScope.querySelector('button[id*="ReplySendBtn"]') ||
                searchScope.querySelector('button.primary-button[id*="Send"]');
            
            this._els.attachBtn =
                searchScope.querySelector('#teacherThreadAttachBtn') ||
                searchScope.querySelector('#studentThreadAttachBtn') ||
                searchScope.querySelector('#adminThreadAttachBtn') ||
                searchScope.querySelector('#csrepThreadAttachBtnFull') ||
                searchScope.querySelector('#csrepThreadAttachBtn') ||
                searchScope.querySelector('.icon-btn[title="Attach file"]');
            
            this._els.voiceBtn = 
                searchScope.querySelector('.voice-record-btn');
            
            this._els.fileInput =
                searchScope.querySelector('#teacherThreadFileInput') ||
                searchScope.querySelector('#studentThreadFileInput') ||
                searchScope.querySelector('#adminThreadFileInput') ||
                searchScope.querySelector('#csrepThreadFileInputFull') ||
                searchScope.querySelector('#csrepThreadFileInput') ||
                searchScope.querySelector('input[type="file"]');
            
            this._els.messagesContainer =
                searchScope.querySelector('#teacherThreadViewMessages') ||
                searchScope.querySelector('#studentThreadViewMessages') ||
                searchScope.querySelector('#adminThreadViewMessages') ||
                searchScope.querySelector('#csrepThreadViewMessages') ||
                searchScope.querySelector('#threadViewMessages') ||
                searchScope.querySelector('.thread-messages-container');
        },

        _reBindComposerListeners() {
            // Re-bind composer event listeners to ensure they work after thread opens
            const els = this._els;
            
            // Remove old listeners and re-attach send button
            if (els.sendBtn && els.sendBtn.parentNode) {
                try {
                    // Clone to remove all listeners
                    const newSendBtn = els.sendBtn.cloneNode(true);
                    els.sendBtn.parentNode.replaceChild(newSendBtn, els.sendBtn);
                    this._els.sendBtn = newSendBtn;
                    
                    newSendBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.sendMessage();
                    });
                } catch (err) {
                    console.warn('Failed to re-bind send button, using existing:', err);
                    // Fallback: just add listener without cloning
                    els.sendBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.sendMessage();
                    });
                }
            }
            
            // Re-bind attachment button
            if (els.attachBtn && els.fileInput && els.attachBtn.parentNode) {
                try {
                    // Clone to remove all listeners
                    const newAttachBtn = els.attachBtn.cloneNode(true);
                    els.attachBtn.parentNode.replaceChild(newAttachBtn, els.attachBtn);
                    this._els.attachBtn = newAttachBtn;
                    
                    newAttachBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!els.fileInput) {
                            console.error('File input not found');
                            return;
                        }
                        // Support attaching multiple times without replacing previous selection
                        this._filesBeforePicker = Array.from(els.fileInput.files || []);
                        els.fileInput.click();
                    });
                } catch (err) {
                    console.warn('Failed to re-bind attach button, using existing:', err);
                    // Fallback: just add listener without cloning
                    els.attachBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!els.fileInput) {
                            console.error('File input not found');
                            return;
                        }
                        this._filesBeforePicker = Array.from(els.fileInput.files || []);
                        els.fileInput.click();
                    });
                }
                
                // Re-bind file input change handler
                if (els.fileInput && els.fileInput.parentNode) {
                    try {
                        // Clone to remove all listeners
                        const newFileInput = els.fileInput.cloneNode(true);
                        els.fileInput.parentNode.replaceChild(newFileInput, els.fileInput);
                        this._els.fileInput = newFileInput;
                        
                        newFileInput.addEventListener('change', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // Skip merge logic when we are setting FileList programmatically (remove/clear)
                            if (this._isSettingFilesProgrammatically) {
                                this._isSettingFilesProgrammatically = false;
                                this._renderAttachmentPreview();
                                return;
                            }

                            const previous = Array.from(this._filesBeforePicker || []);
                            const selectedNow = Array.from(newFileInput.files || []);
                            this._filesBeforePicker = null;

                            // Merge unique (name + size + lastModified)
                            const seen = new Set();
                            const merged = [];
                            [...previous, ...selectedNow].forEach(f => {
                                const key = `${f.name}|${f.size}|${f.lastModified}`;
                                if (!seen.has(key)) {
                                    seen.add(key);
                                    merged.push(f);
                                }
                            });
                            if (merged.length) {
                                this._setFileInputFiles(newFileInput, merged);
                            }

                            if (newFileInput.files.length > 0) {
                                if (window.showToast) window.showToast(`${newFileInput.files.length} files attached`, 'info');
                                if (this._els.attachBtn) this._els.attachBtn.style.color = 'var(--primary)';
                            } else {
                                if (this._els.attachBtn) this._els.attachBtn.style.color = '';
                            }
                            this._renderAttachmentPreview();
                        });
                    } catch (err) {
                        console.warn('Failed to re-bind file input, using existing:', err);
                        // Fallback: just add listener without cloning
                        els.fileInput.addEventListener('change', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (this._isSettingFilesProgrammatically) {
                                this._isSettingFilesProgrammatically = false;
                                this._renderAttachmentPreview();
                                return;
                            }
                            const previous = Array.from(this._filesBeforePicker || []);
                            const selectedNow = Array.from(els.fileInput.files || []);
                            this._filesBeforePicker = null;
                            const seen = new Set();
                            const merged = [];
                            [...previous, ...selectedNow].forEach(f => {
                                const key = `${f.name}|${f.size}|${f.lastModified}`;
                                if (!seen.has(key)) {
                                    seen.add(key);
                                    merged.push(f);
                                }
                            });
                            if (merged.length) {
                                this._setFileInputFiles(els.fileInput, merged);
                            }
                            if (els.fileInput.files.length > 0) {
                                if (window.showToast) window.showToast(`${els.fileInput.files.length} files attached`, 'info');
                                if (this._els.attachBtn) this._els.attachBtn.style.color = 'var(--primary)';
                            } else {
                                if (this._els.attachBtn) this._els.attachBtn.style.color = '';
                            }
                            this._renderAttachmentPreview();
                        });
                    }
                }
            }
            
            // Re-bind voice button
            this._bindVoiceUI();
            
            // Re-bind reply input Enter key handler
            if (els.replyInput && els.replyInput.parentNode) {
                try {
                    // Remove old listeners by cloning
                    const newReplyInput = els.replyInput.cloneNode(true);
                    els.replyInput.parentNode.replaceChild(newReplyInput, els.replyInput);
                    this._els.replyInput = newReplyInput;
                    
                    newReplyInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            this.sendMessage();
                        }
                    });
                    
                    newReplyInput.addEventListener('input', (e) => this._handleMention(e));
                } catch (err) {
                    console.warn('Failed to re-bind reply input, using existing:', err);
                    // Fallback: just add listeners without cloning
                    els.replyInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            this.sendMessage();
                        }
                    });
                    els.replyInput.addEventListener('input', (e) => this._handleMention(e));
                }
            }
        },

        _ensureAttachmentPreviewContainer() {
            if (this._els.attachmentsPreview) return this._els.attachmentsPreview;

            const composer = this._sectionEl?.querySelector('.thread-composer');
            if (!composer) return null;

            const container = document.createElement('div');
            container.id = 'composerAttachmentsPreview';
            container.className = 'composer-attachments-preview';
            container.style.display = 'none';

            // Prefer placing preview BELOW the input wrapper (so it doesn't overlap floating actions)
            const wrapper = composer.querySelector('.composer-input-wrapper');
            if (wrapper) {
                wrapper.insertAdjacentElement('afterend', container);
            } else {
                const textarea = composer.querySelector('textarea');
                if (textarea) textarea.insertAdjacentElement('afterend', container);
                else composer.appendChild(container);
            }

            this._els.attachmentsPreview = container;
            return container;
        },

        _formatBytes(bytes) {
            const b = Number(bytes || 0);
            if (!b) return '0 B';
            const units = ['B', 'KB', 'MB', 'GB'];
            const i = Math.min(units.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
            const v = b / Math.pow(1024, i);
            return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
        },

        _setFileInputFiles(fileInput, files) {
            try {
                this._isSettingFilesProgrammatically = true;
                const dt = new DataTransfer();
                (files || []).forEach(f => dt.items.add(f));
                fileInput.files = dt.files;
            } catch (e) {
                console.warn('DataTransfer not supported; cannot remove individual attachments reliably.');
                this._isSettingFilesProgrammatically = false;
            }
        },

        _removeAttachmentAt(index) {
            const fileInput = this._els.fileInput;
            if (!fileInput || !fileInput.files) return;
            const current = Array.from(fileInput.files);
            if (index < 0 || index >= current.length) return;
            current.splice(index, 1);
            this._setFileInputFiles(fileInput, current);
            if (this._els.attachBtn) this._els.attachBtn.style.color = current.length ? 'var(--primary)' : '';
            this._renderAttachmentPreview();
        },

        _clearAttachments() {
            const fileInput = this._els.fileInput;
            if (!fileInput) return;
            fileInput.value = '';
            if (this._els.attachBtn) this._els.attachBtn.style.color = '';
            this._renderAttachmentPreview();
        },

        _renderAttachmentPreview() {
            const fileInput = this._els.fileInput;
            const container = this._ensureAttachmentPreviewContainer();
            if (!fileInput || !container) return;

            const files = Array.from(fileInput.files || []);
            if (files.length === 0) {
                container.innerHTML = '';
                container.style.display = 'none';
                return;
            }

            container.style.display = 'block';
            container.innerHTML = `
                <div class="composer-attachments-header">
                    <span>Attachments (${files.length})</span>
                    <button type="button" class="composer-attachments-clear" title="Clear attachments">Clear</button>
                </div>
                <div class="composer-attachments-list">
                    ${files.map((f, idx) => `
                        <div class="composer-attachment-chip" title="${this._escape(f.name)}">
                            <span class="composer-attachment-name">${this._escape(f.name)}</span>
                            <span class="composer-attachment-size">${this._formatBytes(f.size)}</span>
                            <button type="button" class="composer-attachment-remove" data-idx="${idx}" aria-label="Remove attachment">×</button>
                        </div>
                    `).join('')}
                </div>
            `;

            const clearBtn = container.querySelector('.composer-attachments-clear');
            if (clearBtn) {
                clearBtn.onclick = (e) => {
                    e.preventDefault();
                    this._clearAttachments();
                };
            }

            container.querySelectorAll('.composer-attachment-remove').forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    const idx = parseInt(btn.getAttribute('data-idx'), 10);
                    this._removeAttachmentAt(Number.isFinite(idx) ? idx : -1);
                };
            });
        },

        async startRecording() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this._mediaRecorder = new MediaRecorder(stream);
                this._audioChunks = [];
                this._recordingStartTime = Date.now();

                this._mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) this._audioChunks.push(e.data);
                };

                this._mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(this._audioChunks, { type: 'audio/webm' });
                    const duration = Date.now() - this._recordingStartTime;
                    if (duration > 500) { // Min 0.5s
                        this.sendVoicemail(audioBlob, duration);
                    }
                };

                this._mediaRecorder.start();
                this._els.voiceBtn.classList.add('recording');
                if (window.showToast) window.showToast('Recording voice...', 'info', 1000);
            } catch (e) {
                console.error('Recording failed:', e);
                if (window.showToast) window.showToast('Microphone access denied', 'error');
            }
        },

        stopRecording() {
            if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
                this._mediaRecorder.stop();
                this._mediaRecorder.stream.getTracks().forEach(t => t.stop());
                this._els.voiceBtn.classList.remove('recording');
            }
        },

        async sendVoicemail(blob, durationMs) {
            const threadId = this._activeThreadId;
            if (!threadId) {
                if (window.showToast) window.showToast('No active thread selected', 'error');
                return;
            }
            
            // Check if thread is resolved or closed
            const t = this._threadMap.get(threadId);
            if (t && (t.status === 'resolved' || t.status === 'closed')) {
                if (window.showToast) window.showToast('Cannot send voicemail: Thread is resolved/closed', 'error');
                return;
            }
            
            // Validate blob
            if (!blob || blob.size === 0) {
                if (window.showToast) window.showToast('Recording is empty. Please try recording again.', 'error');
                return;
            }
            
            // Check blob size (max 10MB for voicemail)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (blob.size > maxSize) {
                if (window.showToast) window.showToast('Recording is too large. Maximum size is 10MB.', 'error');
                return;
            }
            
            const formData = new FormData();
            formData.append('voice', blob, 'voicemail.webm');
            // Ensure duration_ms is a number
            formData.append('duration_ms', String(Math.max(0, Math.floor(durationMs || 0))));
            
            // Log for debugging
            console.log('Sending voicemail:', {
                threadId,
                blobSize: blob.size,
                duration: durationMs,
                blobType: blob.type
            });
            
            // Disable voice button during send
            if (this._els.voiceBtn) {
                this._els.voiceBtn.disabled = true;
                this._els.voiceBtn.classList.add('sending');
            }
            
            try {
                const resp = await this._apiPostForm(`/threads/api/${threadId}/send/`, formData);
                if (resp.success) {
                    if (window.showToast) window.showToast('Voicemail sent', 'success');
                    
                    // Reload messages to show the new voicemail
                    if (threadId === this._activeThreadId && this._els.messagesContainer) {
                        try {
                            const data = await this._apiGet(`/threads/api/${threadId}/messages/`);
                            if (data.success) {
                                this._renderMessages(data.messages);
                            }
                        } catch (reloadError) {
                            // Ignore reload errors - WebSocket should handle it
                            console.warn('Failed to reload messages after voicemail send:', reloadError);
                        }
                    }
                } else {
                    const errorMsg = resp.error || 'Failed to send voicemail. Please try again.';
                    if (window.showToast) {
                        window.showToast(errorMsg, 'error');
                    } else {
                        alert(errorMsg);
                    }
                }
            } catch (e) {
                console.error('Voicemail send failed:', e);
                // Try to extract more specific error from response
                let errorMsg = 'Failed to send voicemail. Please try again.';
                if (e.message) {
                    errorMsg = e.message;
                } else if (e.response && e.response.error) {
                    errorMsg = e.response.error;
                }
                
                // Show more helpful error messages
                if (errorMsg.includes('voicemail') || errorMsg.includes('attachment')) {
                    errorMsg = 'Failed to upload voicemail. Please check your recording and try again.';
                } else if (errorMsg.includes('size') || errorMsg.includes('too large')) {
                    errorMsg = 'Recording is too large. Please record a shorter message.';
                }
                
                if (window.showToast) {
                    window.showToast(errorMsg, 'error');
                } else {
                    alert(errorMsg);
                }
            } finally {
                // Re-enable voice button
                if (this._els.voiceBtn) {
                    this._els.voiceBtn.disabled = false;
                    this._els.voiceBtn.classList.remove('sending');
                }
            }
        },

        async refreshThreads(filter = 'all') {
            this._activeFilter = filter || 'all';
            const statusFilters = new Set(['active', 'resolved', 'closed']);
            const typeFilters = new Set(['assignment', 'invoice', 'general', 'support']);
            let url = '/threads/api/list/';
            if (statusFilters.has(this._activeFilter)) {
                url = `/threads/api/list/?status=${encodeURIComponent(this._activeFilter)}`;
            } else if (typeFilters.has(this._activeFilter)) {
                url = `/threads/api/list/?type=${encodeURIComponent(this._activeFilter)}`;
            } else {
                url = '/threads/api/list/';
            }
            try {
                const data = await this._apiGet(url);
                this._threads = data.threads || [];
                this._threadMap = new Map(this._threads.map(t => [t.id, t]));
                this._renderThreadList();
            } catch (e) {
                console.error('Failed to load threads:', e);
            }
        },

        _renderThreadList() {
            const els = this._els;
            if (!els.threadsList) return;
            els.threadsList.innerHTML = '';

            // Filter threads based on active filter
            let filteredThreads = this._threads;
            if (this._activeFilter === 'active') {
                filteredThreads = this._threads.filter(t => t.status === 'active');
            } else if (this._activeFilter === 'resolved') {
                filteredThreads = this._threads.filter(t => t.status === 'resolved');
            } else if (this._activeFilter === 'closed') {
                filteredThreads = this._threads.filter(t => t.status === 'closed');
            } else if (['assignment', 'invoice', 'general', 'support'].includes(this._activeFilter)) {
                filteredThreads = this._threads.filter(t => t.thread_type === this._activeFilter);
            }

            if (filteredThreads.length === 0) {
                if (els.noThreadsMsg) els.noThreadsMsg.style.display = 'flex';
                if (els.threadsList) {
                    els.threadsList.style.display = 'none';
                    const container = els.threadsList.closest('.threads-list-container');
                    if (container) container.style.display = 'none';
                }
                return;
            }
            if (els.noThreadsMsg) els.noThreadsMsg.style.display = 'none';
            if (els.threadsList) {
                els.threadsList.style.display = '';
                const container = els.threadsList.closest('.threads-list-container');
                if (container) container.style.display = '';
            }

            filteredThreads.forEach(t => {
                const card = document.createElement('div');
                card.className = 'thread-card';
                card.dataset.threadId = t.id;
                card.dataset.type = t.thread_type;
                card.dataset.status = t.status;

                const unreadBadge = t.unread_count > 0 ? `<div class="thread-new-badge">NEW</div>` : '';

                card.innerHTML = `
                    <div class="thread-card-header">
                        <div class="thread-type-badge ${t.thread_type}">
                            <i class="fas ${this._getIconForType(t.thread_type)}"></i> ${t.thread_type.toUpperCase()}
                        </div>
                        <div class="thread-card-badges">
                            <div class="thread-status-badge ${t.status}">${t.status.toUpperCase()}</div>
                            ${unreadBadge}
                        </div>
                    </div>
                    <div class="thread-card-body">
                        <h3 class="thread-subject">${this._escape(t.subject)}</h3>
                        <p class="thread-preview">${this._escape(t.last_message_preview || "No messages yet")}</p>
                        <div class="thread-meta">
                            <span class="thread-participants">
                                <i class="fas fa-users"></i> ${t.participants.map(p => p.is_me ? 'You' : p.name).join(', ')}
                            </span>
                            ${t.assignment_code ? `<span class="thread-assignment"><i class="fas fa-link"></i> Assignment: ${t.assignment_code}</span>` : ''}
                        </div>
                    </div>
                    <div class="thread-card-footer">
                        <div class="thread-stats">
                            <span><i class="fas fa-clock"></i> Updated ${this._formatTime(t.updated_at)}</span>
                            <span><i class="fas fa-user"></i> By: ${t.created_by}</span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="thread-action-btn" onclick="StudyThreads.openThread('${t.id}')">
                                <i class="fas fa-eye"></i> View Thread
                            </button>
                            ${(this._role === 'ADMIN') ? `<button class="thread-action-btn danger-btn" onclick="StudyThreads.deleteThread('${t.id}')" title="Delete Thread" style="background: #ef4444; color: white;">
                                <i class="fas fa-trash-alt"></i> Delete
                            </button>` : ''}
                        </div>
                    </div>
                `;
                els.threadsList.appendChild(card);
            });
        },

        async openThread(threadId) {
            this._activeThreadId = threadId;
            const t = this._threadMap.get(threadId);
            if (!t) return;

            const els = this._els;
            if (els.detailView) {
                els.detailView.style.display = 'block';
                if (els.threadsList) {
                    els.threadsList.style.display = 'none';
                    const container = els.threadsList.closest('.threads-list-container');
                    if (container) container.style.display = 'none';
                }
                if (els.noThreadsMsg) els.noThreadsMsg.style.display = 'none';
                
                // Scroll to thread detail view
                setTimeout(() => {
                    els.detailView.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
                
                if (els.subjectTitle) els.subjectTitle.textContent = t.subject;
                if (els.viewTypeBadge) {
                    els.viewTypeBadge.textContent = t.thread_type.toUpperCase();
                    els.viewTypeBadge.className = 'thread-type-badge ' + t.thread_type;
                }

                // Show status actions for Admin / CS-Rep
                if (els.statusActions) {
                    const canChangeStatus = (this._role === 'ADMIN' || this._role === 'CS_REP');
                    els.statusActions.style.display = canChangeStatus ? 'flex' : 'none';
                }
                if (els.resolveBtn) els.resolveBtn.disabled = (t.status === 'resolved' || t.status === 'closed');
                if (els.closeBtn) els.closeBtn.disabled = (t.status === 'closed');
                
                // Show delete button only for Admin
                const deleteBtn = document.getElementById('adminDeleteThreadBtn') || 
                                 document.getElementById('teacherDeleteThreadBtn') ||
                                 document.getElementById('csrepDeleteThreadBtn');
                if (deleteBtn) {
                    deleteBtn.style.display = (this._role === 'ADMIN') ? 'inline-block' : 'none';
                }
                
                if (els.viewAssignment) {
                    if (t.assignment_code) {
                        els.viewAssignment.style.display = 'inline-block';
                        const span = els.viewAssignment.querySelector('span');
                        if (span) span.textContent = t.assignment_code;
                    } else els.viewAssignment.style.display = 'none';
                }

                this._participants = t.participants;
                this._renderParticipants(t.participants);
                
                // Re-cache composer elements and re-bind listeners when opening thread
                // This ensures elements are found even if they're in modals or dynamically shown
                this._reCacheComposerElements();
                this._reBindComposerListeners();
                
                // Disable composer if thread is resolved or closed
                const isResolvedOrClosed = t.status === 'resolved' || t.status === 'closed';
                this._toggleComposer(!isResolvedOrClosed);
                
                this._renderMessages([]); 
                const data = await this._apiGet(`/threads/api/${threadId}/messages/`);
                if (data.success) {
                    this._renderMessages(data.messages);
                }
                
                this._connectThreadWebSocket(threadId);
            } else if (this._role === 'CS_REP' || this._role === 'ADMIN') {
                // Some layouts might use a modal or different view
                // Check if there's a modal view
                const threadViewModal = document.getElementById('threadViewModal');
                if (threadViewModal) {
                    threadViewModal.style.display = 'flex';
                    
                    // Re-cache composer elements for modal view
                    this._reCacheComposerElements();
                    this._reBindComposerListeners();
                    
                    // Update modal content
                    const modalSubject = document.getElementById('threadViewSubject');
                    if (modalSubject) modalSubject.textContent = t.subject;
                    
                    const modalType = document.getElementById('threadViewType');
                    if (modalType) {
                        modalType.textContent = t.thread_type.toUpperCase();
                        modalType.className = 'thread-type-badge ' + t.thread_type;
                    }
                    
                    this._participants = t.participants;
                    const modalParticipants = document.getElementById('threadViewParticipants');
                    if (modalParticipants) {
                        modalParticipants.innerHTML = t.participants.map(p => `
                            <div class="participant-tag" title="${p.role}">
                                ${p.name} ${p.is_me ? '(You)' : ''}
                            </div>
                        `).join('');
                    }
                    
                    // Disable composer if thread is resolved or closed
                    const isResolvedOrClosed = t.status === 'resolved' || t.status === 'closed';
                    this._toggleComposer(!isResolvedOrClosed);
                    
                    // Load messages
                    this._renderMessages([]);
                    const data = await this._apiGet(`/threads/api/${threadId}/messages/`);
                    if (data.success) {
                        this._renderMessages(data.messages);
                    }
                    
                    this._connectThreadWebSocket(threadId);
                } else {
                    console.log('Opening thread in separate view/modal');
                }
            }
        },

        async updateThreadStatus(status) {
            const threadId = this._activeThreadId;
            if (!threadId) return;
            if (!(this._role === 'ADMIN' || this._role === 'CS_REP')) return;

            const fd = new FormData();
            fd.append('status', status);
            try {
                const resp = await this._apiPostForm(`/threads/api/${threadId}/status/`, fd);
                if (resp && resp.success) {
                    // Update local cache
                    const t = this._threadMap.get(threadId);
                    if (t) {
                        t.status = resp.status || status;
                        // Disable composer if thread is resolved or closed
                        const isResolvedOrClosed = t.status === 'resolved' || t.status === 'closed';
                        this._toggleComposer(!isResolvedOrClosed);
                    }

                    // Re-render list + keep current filter selection
                    await this.refreshThreads(this._activeFilter || 'all');

                    if (window.showToast) window.showToast(`Thread marked as ${status}`, 'success');
                } else {
                    if (window.showToast) window.showToast(resp.error || 'Failed to update thread status', 'error');
                }
            } catch (e) {
                console.error('Status update failed:', e);
                if (window.showToast) window.showToast('Failed to update thread status', 'error');
            }
        },

        _renderParticipants(participants) {
            const el = this._els.participantsList;
            if (!el) return;
            el.innerHTML = participants.map(p => `
                <div class="participant-tag" title="${p.role}">
                    ${p.name} ${p.is_me ? '(You)' : ''}
                </div>
            `).join('');
        },

        _renderMessages(messages) {
            const container = this._els.messagesContainer;
            if (!container) return;
            container.innerHTML = '';
            messages.forEach(m => this._appendMessage(m));
            container.scrollTop = container.scrollHeight;
        },

        _appendMessage(m) {
            const container = this._els.messagesContainer;
            if (!container) return;

            const isMe = m.is_me;
            const div = document.createElement('div');
            div.className = `thread-message ${isMe ? 'message-me' : 'message-other'} ${m.is_system ? 'system-message' : ''}`;
            
            let attachmentsHtml = '';
            if (m.attachments && m.attachments.length > 0) {
                attachmentsHtml = `<div class="message-attachments">` + 
                    m.attachments.map(a => {
                        if (a.type === 'audio') {
                            return `
                                <div class="voice-message">
                                    <audio controls src="${a.url}" style="height: 30px; width: 200px;"></audio>
                                    <span style="font-size: 0.7rem; color: var(--muted-text); margin-left: 8px;">Voicemail</span>
                                </div>
                            `;
                        }
                        return `
                            <div class="attachment-item">
                                <div class="attachment-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                                    <a href="${a.url}" target="_blank" rel="noopener" class="attachment-link attachment-view">
                                        <i class="fas fa-file"></i> ${this._escape(a.name)}
                                    </a>
                                    <a href="${a.url}" download class="attachment-link attachment-download">
                                        <i class="fas fa-download"></i> Download
                                    </a>
                                </div>
                            </div>
                        `;
                    }).join('') + `</div>`;
            }

            div.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-user-circle"></i>
                </div>
                <div class="message-content-wrapper">
                    <div class="message-sender">${this._escape(m.sender_name)} <span class="sender-role">(${this._escape(m.sender_role)})</span></div>
                    <div class="message-bubble">${this._parseMentions(m.content)}</div>
                    ${attachmentsHtml}
                    <div class="message-time">${this._formatTime(m.created_at)}</div>
                </div>
            `;
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        },

        _parseMentions(content) {
            return this._escape(content).replace(/@\[([^\]]+)\]/g, '<span class="mention" style="color:var(--primary);font-weight:bold;">@$1</span>');
        },

        _toggleComposer(enabled) {
            const els = this._els;
            // Try to find composer in multiple locations (detail view, modal, section)
            const detailView = this._els.detailView;
            const threadViewModal = document.getElementById('threadViewModal');
            const searchScope = detailView || threadViewModal || this._sectionEl || document;
            const composer = searchScope.querySelector('.thread-composer');
            
            // Check for disabled message with various IDs (teacher, student, generic)
            const disabledMsg = document.getElementById('teacherThreadComposerDisabled') ||
                               document.getElementById('studentThreadComposerDisabled') ||
                               document.getElementById('threadComposerDisabled') ||
                               (composer ? composer.querySelector('[id*="ComposerDisabled"]') : null);
            
            if (disabledMsg) {
                disabledMsg.style.display = enabled ? 'none' : 'block';
            }
            
            // Re-cache elements if they're null to ensure we have the latest references
            if (!els.replyInput || !els.sendBtn || !els.attachBtn || !els.fileInput || !els.voiceBtn) {
                this._reCacheComposerElements();
            }
            
            if (els.replyInput) {
                els.replyInput.disabled = !enabled;
                els.replyInput.placeholder = enabled ? 'Type your reply...' : 'Thread is resolved/closed. No further messages can be sent.';
            }
            if (els.sendBtn) els.sendBtn.disabled = !enabled;
            if (els.attachBtn) els.attachBtn.disabled = !enabled;
            if (els.fileInput) els.fileInput.disabled = !enabled;
            if (els.voiceBtn) els.voiceBtn.disabled = !enabled;
            
            if (composer) {
                composer.style.opacity = enabled ? '1' : '0.6';
            }
        },

        async sendMessage() {
            // Prevent double-clicks and concurrent sends
            if (this._isSending) {
                console.log('Message send already in progress, ignoring duplicate request');
                return;
            }

            const threadId = this._activeThreadId;
            if (!threadId) return;
            
            // Check if thread is resolved or closed
            const t = this._threadMap.get(threadId);
            if (t && (t.status === 'resolved' || t.status === 'closed')) {
                if (window.showToast) window.showToast('Cannot send message: Thread is resolved/closed', 'error');
                return;
            }
            
            // Re-cache elements if they're null to ensure we have the latest references
            if (!this._els.replyInput || !this._els.sendBtn || !this._els.fileInput) {
                this._reCacheComposerElements();
            }
            
            const content = this._els.replyInput ? this._els.replyInput.value.trim() : '';
            if (!content && (!this._els.fileInput || !this._els.fileInput.files || !this._els.fileInput.files.length)) return;

            this._isSending = true;
            
            // Disable send button during send
            let originalButtonContent = null;
            if (this._els.sendBtn) {
                this._els.sendBtn.disabled = true;
                originalButtonContent = this._els.sendBtn.innerHTML;
                this._els.sendBtn.innerHTML = 'Sending...';
            }

            const formData = new FormData();
            formData.append('content', content);
            
            // Extract mentions from @[Name]
            const mentionMatches = content.match(/@\[([^\]]+)\]/g) || [];
            mentionMatches.forEach(m => {
                const name = m.substring(2, m.length - 1);
                const user = this._participants.find(p => p.name === name);
                if (user) formData.append('mentions', user.id);
            });

            if (this._els.fileInput && this._els.fileInput.files.length) {
                for (let f of this._els.fileInput.files) {
                    formData.append('files', f);
                }
            }

            try {
                const resp = await this._apiPostForm(`/threads/api/${threadId}/send/`, formData);
                if (resp.success) {
                    this._els.replyInput.value = '';
                    if (this._els.fileInput) this._els.fileInput.value = '';
                    this._renderAttachmentPreview();
                    
                    // Messages will appear via WebSocket, but reload if we're in the thread view
                    // to ensure it appears even if WebSocket fails
                    if (threadId === this._activeThreadId && this._els.messagesContainer) {
                        try {
                            const data = await this._apiGet(`/threads/api/${threadId}/messages/`);
                            if (data.success) {
                                this._renderMessages(data.messages);
                            }
                        } catch (reloadError) {
                            // Ignore reload errors - WebSocket should handle it
                            console.warn('Failed to reload messages after send:', reloadError);
                        }
                    }
                } else {
                    const errorMsg = resp.error || 'Failed to send message. Please try again.';
                    if (window.showToast) {
                        window.showToast(errorMsg, 'error');
                    } else {
                        alert(errorMsg);
                    }
                }
            } catch (e) {
                console.error('Send failed:', e);
                const errorMsg = e.message || 'Failed to send message. Please try again.';
                if (window.showToast) {
                    window.showToast(errorMsg, 'error');
                } else {
                    alert(errorMsg);
                }
            } finally {
                this._isSending = false;
                // Re-enable send button
                if (this._els.sendBtn) {
                    this._els.sendBtn.disabled = false;
                    // Restore original button content
                    if (originalButtonContent !== null) {
                        this._els.sendBtn.innerHTML = originalButtonContent;
                    } else {
                        // Fallback to default if we didn't store original
                        this._els.sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
                    }
                }
            }
        },

        hideCreateModal() {
            if (this._els.createModal) {
                this._els.createModal.style.display = 'none';
            }
        },

        showCreateModal() {
            if (this._els.createModal) {
                this._els.createModal.style.display = 'flex';
                // Reset form
                if (this._els.createForm) this._els.createForm.reset();
                
                // Clear hidden select
                const recipientSelect = document.getElementById('threadRecipient');
                if (recipientSelect) recipientSelect.innerHTML = '';
                
                this._loadRecipients();
                this._loadAssignments();
                this._loadInvoices();
                this._loadStudents();
            } else if (typeof window.showCreateThreadModal === 'function') {
                window.showCreateThreadModal();
            }
        },

        async deleteThread(threadId) {
            if (!confirm('Are you sure you want to delete this thread? This action cannot be undone. All messages and attachments will be permanently deleted.')) {
                return;
            }

            try {
                const csrfToken = this._getCookie('csrftoken');
                if (!csrfToken) {
                    throw new Error('CSRF token not found. Please refresh the page.');
                }

                const response = await fetch(`/threads/api/${threadId}/delete/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'same-origin'
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    let errorMessage = 'Failed to delete thread.';
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorMessage = errorJson.error || errorJson.message || errorMessage;
                    } catch (e) {
                        if (response.status === 403) {
                            errorMessage = 'You do not have permission to delete threads.';
                        } else {
                            errorMessage = `Server error (${response.status}). Please try again.`;
                        }
                    }
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                if (data.success) {
                    // Close detail view if open
                    if (this._els.detailView) {
                        this._els.detailView.style.display = 'none';
                    }
                    if (this._els.threadsList) {
                        this._els.threadsList.style.display = 'block';
                    }
                    
                    // Refresh threads list
                    await this.refreshThreads();
                    
                    if (window.showToast) {
                        window.showToast('Thread deleted successfully', 'success');
                    } else {
                        alert('Thread deleted successfully');
                    }
                } else {
                    throw new Error(data.error || 'Failed to delete thread');
                }
            } catch (e) {
                console.error('Delete thread failed:', e);
                const errorMessage = e.message || 'Failed to delete thread. Please try again.';
                if (window.showToast) {
                    window.showToast(errorMessage, 'error');
                } else {
                    alert(errorMessage);
                }
            }
        },

        async _loadRecipients() {
            const listContainer = document.getElementById('recipientSelectionList');
            if (!listContainer) return;
            
            try {
                const data = await this._apiGet('/messages/api/allowed-users/');
                if (data && data.users) {
                    listContainer.innerHTML = '';
                    data.users.forEach(u => {
                        const card = document.createElement('div');
                        card.className = 'recipient-card';
                        card.dataset.userId = u.id;
                        card.onclick = () => this.toggleRecipient(u.id, card);
                        
                        card.innerHTML = `
                            <div class="recipient-avatar">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="recipient-info">
                                <span class="recipient-name">${u.name}</span>
                                <span class="recipient-role">${u.role}</span>
                            </div>
                            <div class="selection-tick">
                                <i class="fas fa-check"></i>
                            </div>
                        `;
                        listContainer.appendChild(card);
                    });
                }
            } catch (e) {
                console.error('Failed to load recipients:', e);
            }
        },

        toggleRecipient(userId, cardEl) {
            const select = document.getElementById('threadRecipient');
            if (!select) return;

            const isSelected = cardEl.classList.toggle('selected');
            
            if (isSelected) {
                const opt = document.createElement('option');
                opt.value = userId;
                opt.selected = true;
                opt.dataset.userId = userId;
                select.appendChild(opt);
            } else {
                const opt = Array.from(select.options).find(o => o.value === userId);
                if (opt) opt.remove();
            }
        },

        async _loadStudents() {
            const select = document.getElementById('studentSelect');
            if (!select) return;
            
            try {
                const data = await this._apiGet('/account/api/admin/list-students/');
                if (data && data.success) {
                    select.innerHTML = '<option value="">Select student...</option>';
                    data.students.forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s.id;
                        opt.textContent = `${s.name} (${s.student_id})`;
                        select.appendChild(opt);
                    });
                }
            } catch (e) {
                console.error('Failed to load students:', e);
            }
        },

        async _loadAssignments(studentId = null) {
            const select = document.getElementById('relatedAssignment');
            if (!select) return;
            try {
                let url = '/assingment/api/list/';
                if (studentId) url += `?student_id=${studentId}`;
                
                const data = await this._apiGet(url);
                if (data && data.assignments) {
                    select.innerHTML = '<option value="">Select assignment...</option>';
                    data.assignments.forEach(a => {
                        const opt = document.createElement('option');
                        opt.value = a.id;
                        opt.textContent = `${a.assignment_code} - ${a.title}`;
                        select.appendChild(opt);
                    });
                }
            } catch (e) {
                console.error('Failed to load assignments:', e);
            }
        },

        async _loadInvoices() {
            const select = document.getElementById('relatedInvoice');
            if (!select) return;
            try {
                const data = await this._apiGet('/invoice/api/list/');
                if (data && data.invoices) {
                    select.innerHTML = '<option value="">Select invoice...</option>';
                    data.invoices.forEach(i => {
                        const opt = document.createElement('option');
                        opt.value = i.id;
                        opt.textContent = `INV - $${i.amount} (${i.status})`;
                        select.appendChild(opt);
                    });
                }
            } catch (e) {
                console.error('Failed to load invoices:', e);
            }
        },

        async submitCreateThread() {
            // Prevent multiple simultaneous submissions
            if (this._isSubmittingThread) {
                console.log('Thread submission already in progress, ignoring duplicate call');
                return;
            }
            
            const form = this._els.createForm;
            if (!form) return;
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            
            // Set flag to prevent duplicate submissions
            this._isSubmittingThread = true;

            const formData = new FormData(form);
            
            // Explicitly add recipients from the selected cards to be sure
            const selectedCards = document.querySelectorAll('.recipient-card.selected');
            formData.delete('threadRecipient'); // Clear any existing
            selectedCards.forEach(card => {
                formData.append('threadRecipient', card.dataset.userId);
            });

            try {
                console.log('Submitting thread creation...');
                const data = await this._apiPostForm('/threads/api/create/', formData);
                console.log('Thread creation response:', data);
                
                if (data && data.success) {
                    console.log('Thread created successfully, closing modal and refreshing...');
                    if (this._els.createModal) {
                        this._els.createModal.style.display = 'none';
                    }
                    // Reset form
                    if (this._els.createForm) {
                        this._els.createForm.reset();
                    }
                    // Clear selected recipients
                    document.querySelectorAll('.recipient-card.selected').forEach(card => {
                        card.classList.remove('selected');
                    });
                    // Refresh threads list
                    await this.refreshThreads();
                    if (window.showToast) {
                        window.showToast('Thread created successfully', 'success');
                    } else {
                        alert('Thread created successfully');
                    }
                } else {
                    console.error('Thread creation failed:', data);
                    const errorMsg = (data && data.error) ? data.error : 'Failed to create thread';
                    if (window.showToast) {
                        window.showToast(errorMsg, 'error');
                    } else {
                        alert(errorMsg);
                    }
                }
            } catch (e) {
                console.error('Create thread failed with exception:', e);
                const errorMessage = e.message || 'Failed to create thread. Please try again.';
                if (window.showToast) {
                    window.showToast(errorMessage, 'error');
                } else {
                    alert(errorMessage);
                }
            } finally {
                // Reset flag after submission completes (success or error)
                this._isSubmittingThread = false;
            }
        },

        _connectThreadWebSocket(threadId) {
            if (this._ws) this._ws.close();
            const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
            this._ws = new WebSocket(`${proto}//${location.host}/ws/threads/${threadId}/`);
            
            this._ws.onmessage = (e) => {
                const data = JSON.parse(e.data);
                if (data.type === 'message') {
                    const msg = data.message || {};
                    // Ensure immediate correct alignment without refresh (server WS payload may not include is_me)
                    if (typeof msg.is_me === 'undefined' && msg.sender_id && window.currentUserId) {
                        msg.is_me = String(msg.sender_id) === String(window.currentUserId);
                    }
                    this._appendMessage(msg);
                }
            };
        },

        _connectListWebSocket() {
            const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
            this._listWs = new WebSocket(`${proto}//${location.host}/ws/thread-list/`);
            this._listWs.onmessage = (e) => {
                const data = JSON.parse(e.data);
                if (data.type === 'thread_list_update') {
                    this.refreshThreads();
                }
            };
        },

        _handleMention(e) {
            const val = e.target.value;
            const pos = e.target.selectionStart;
            const lastAt = val.lastIndexOf('@', pos - 1);
            
            if (lastAt !== -1 && !val.substring(lastAt, pos).includes(' ')) {
                const query = val.substring(lastAt + 1, pos).toLowerCase();
                this._showMentionPopup(query, lastAt);
            } else {
                this._hideMentionPopup();
            }
        },

        _showMentionPopup(query, atPos) {
            let popup = document.getElementById('mentionPopup');
            if (!popup) {
                popup = document.createElement('div');
                popup.id = 'mentionPopup';
                popup.className = 'mention-popup';
                popup.style.cssText = 'position:fixed;background:var(--surface,#fff);border:1px solid var(--divider,#ddd);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:9999;max-height:200px;overflow-y:auto;min-width:150px;';
                document.body.appendChild(popup);
            }

            const filtered = this._participants.filter(p => 
                !p.is_me && p.name.toLowerCase().includes(query)
            );

            if (filtered.length === 0) {
                this._hideMentionPopup();
                return;
            }

            const rect = this._els.replyInput.getBoundingClientRect();
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.top - Math.min(200, filtered.length * 40)}px`;
            popup.style.display = 'block';

            popup.innerHTML = filtered.map((p, idx) => `
                <div class="mention-item" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--divider,#eee);" 
                     onmouseover="this.style.background='var(--primary-light,#eef2ff)'" 
                     onmouseout="this.style.background='none'"
                     onclick="StudyThreads.insertMention('${p.name}', ${atPos})">
                    <span style="font-weight:bold;">${p.name}</span> <small style="color:var(--muted);">${p.role}</small>
                </div>
            `).join('');
        },

        insertMention(name, atPos) {
            const input = this._els.replyInput;
            const val = input.value;
            const pos = input.selectionStart;
            const newVal = val.substring(0, atPos) + `@[${name}] ` + val.substring(pos);
            input.value = newVal;
            this._hideMentionPopup();
            input.focus();
        },

        _hideMentionPopup() {
            const popup = document.getElementById('mentionPopup');
            if (popup) popup.style.display = 'none';
        },

        _getIconForType(type) {
            switch(type) {
                case 'assignment': return 'fa-clipboard-list';
                case 'invoice': return 'fa-file-invoice-dollar';
                case 'support': return 'fa-headset';
                default: return 'fa-question-circle';
            }
        },

        _formatTime(iso) {
            if (!iso) return '';
            const d = new Date(iso);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        },

        async _apiGet(url) {
            const r = await fetch(url);
            return await r.json();
        },

        async _apiPostForm(url, formData) {
            const csrfToken = this._getCookie('csrftoken');
            if (!csrfToken) {
                console.error('CSRF token not found. Cannot make API request.');
                throw new Error('CSRF token not found. Please refresh the page.');
            }
            
            const r = await fetch(url, {
                method: 'POST',
                body: formData,
                headers: { 'X-CSRFToken': csrfToken },
                credentials: 'same-origin' // Include cookies
            });
            
            console.log('API response status:', r.status, r.statusText);
            console.log('API response headers:', Object.fromEntries(r.headers.entries()));
            
            if (!r.ok) {
                const errorText = await r.text();
                console.error('API request failed:', r.status, errorText);
                let errorMessage = 'Request failed.';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error || errorJson.message || errorMessage;
                } catch (e) {
                    if (r.status === 403) {
                        errorMessage = 'Access forbidden. Please ensure you are logged in and have permission.';
                    } else {
                        errorMessage = `Server error (${r.status}). Please try again.`;
                    }
                }
                throw new Error(errorMessage);
            }
            
            // Parse JSON response
            const contentType = r.headers.get('content-type');
            console.log('Response content-type:', contentType);
            
            if (contentType && contentType.includes('application/json')) {
                const jsonData = await r.json();
                console.log('API response parsed as JSON:', jsonData);
                return jsonData;
            } else {
                const textData = await r.text();
                console.warn('Non-JSON response received, attempting to parse:', textData);
                // Try to parse as JSON anyway
                try {
                    const parsed = JSON.parse(textData);
                    console.log('Successfully parsed as JSON:', parsed);
                    return parsed;
                } catch (e) {
                    console.error('Failed to parse response as JSON:', e);
                    throw new Error('Invalid response format from server');
                }
            }
        },

        _getCookie(name) {
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
        },

        _escape(s) {
            if (!s) return "";
            const div = document.createElement('div');
            div.textContent = s;
            return div.innerHTML;
        }
    };

    window.StudyThreads = StudyThreads;
    // Initial load
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        StudyThreads.init();
    } else {
        document.addEventListener('DOMContentLoaded', () => StudyThreads.init());
    }
    
    // Global wrapper functions for modal operations
    window.showCreateThreadModal = function() {
        if (window.StudyThreads && window.StudyThreads.showCreateModal) {
            window.StudyThreads.showCreateModal();
        } else {
            const modal = document.getElementById('createThreadModal');
            if (modal) {
                modal.style.display = 'flex';
            } else {
                console.error('Create thread modal not found');
            }
        }
    };
    
    window.closeCreateThreadModal = function() {
        if (window.StudyThreads && window.StudyThreads.hideCreateModal) {
            window.StudyThreads.hideCreateModal();
        } else {
            const modal = document.getElementById('createThreadModal');
            if (modal) {
                modal.style.display = 'none';
            }
        }
    };
    
    window.submitCreateThread = function() {
        if (window.StudyThreads && window.StudyThreads.submitCreateThread) {
            window.StudyThreads.submitCreateThread();
        } else {
            console.error('StudyThreads not initialized');
        }
    };
    
    // Global handle for back buttons
    window.showAdminThreadList = window.showCSRepThreadList = window.showTeacherThreadList = window.showThreadList = function() {
        const els = StudyThreads._els;
        if (els.detailView) els.detailView.style.display = 'none';
        if (els.threadsList) els.threadsList.style.display = 'block';
        StudyThreads._activeThreadId = null;
        if (StudyThreads._ws) StudyThreads._ws.close();
    };

    // Global handle for opening thread from card
    window.openThread = function(id) {
        StudyThreads.openThread(id);
    };
    
    // Global handle for deleting thread
    window.deleteThread = function(id) {
        if (window.StudyThreads && window.StudyThreads.deleteThread) {
            window.StudyThreads.deleteThread(id);
        } else {
            console.error('StudyThreads not initialized');
        }
    };

})();

