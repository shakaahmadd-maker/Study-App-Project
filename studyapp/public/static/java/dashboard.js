// Dashboard JavaScript functionality - Combined with Student_Dash.js

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

// Section to template mapping for dynamic content loading
// Note: This is kept for reference/validation. Actual loading is done via Django views.
if (typeof window.sectionFileMap === 'undefined') {
    window.sectionFileMap = {
        'dashboard': 'dashboard.html',
        'messages': 'messages.html',
        'threads': 'threads.html',
        'meetings': 'meetings.html',
        'assignment': 'request_assignment.html',
        'tracker': 'assignment_tracker.html',
        'assignment-detail': 'assignment_detail.html',
        'tutors': 'tutors.html',
        'onlineExams': 'online_exam.html',
        'invoices': 'invoices.html',
        'homework': 'homework.html',
        'announcements': 'announcements.html',
        'notifications': 'notifications.html',
        'profile': 'profile.html',
        'settings': 'profile_settings.html'
    };
}

// Cache for loaded sections
if (typeof window.loadedSections === 'undefined') {
    window.loadedSections = {};
}

// Get Django URL for loading section content
function getSectionUrl(sectionName) {
    // Use Django URL pattern: /account/student/section/<section_name>/
    return `/account/student/section/${sectionName}/`;
}

// Helper function to load section HTML from Django view
function loadSectionFromDjango(sectionName) {
    return new Promise((resolve, reject) => {
        const url = getSectionUrl(sectionName);

        fetch(url, {
            method: 'GET',
            credentials: 'include', // Include cookies for authentication
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success && data.html) {
                    resolve(data.html);
                } else {
                    reject(new Error(data.error || 'Failed to load section'));
                }
            })
            .catch(error => {
                reject(new Error(`Failed to load section from Django: ${error.message}`));
            });
    });
}

// Show section - loads content dynamically from Django views
async function showSection(sectionName) {
    const dynamicContainer = document.getElementById('dynamicContentContainer');

    try {
        // Save current section to localStorage for page refresh persistence
        if (sectionName && sectionName !== 'assignment-detail') {
            localStorage.setItem('student_last_section', sectionName);
        }

        // Hide all existing sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
            section.style.display = 'none';
        });

        // Hide dynamic content container initially
        if (dynamicContainer) {
            dynamicContainer.style.display = 'none';
        }

        // Get the file path for this section
        const fileName = sectionFileMap[sectionName];

        if (fileName) {
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
                let sectionHTML = loadedSections[sectionName];

                if (!sectionHTML) {
                    // Load the HTML from Django view
                    const djangoUrl = getSectionUrl(sectionName);
                    console.log(`Loading student section "${sectionName}" from Django:`, djangoUrl);

                    try {
                        sectionHTML = await loadSectionFromDjango(sectionName);
                        console.log(`✅ Successfully loaded ${sectionName} from Django (${sectionHTML.length} chars)`);
                    } catch (loadError) {
                        console.error(`❌ Failed to load ${sectionName} from Django:`, loadError);
                        throw loadError;
                    }

                    // Extract content from the loaded HTML (get the block content)
                    // The HTML file extends student_base.html, so we need to extract the section
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(sectionHTML, 'text/html');

                    // Extract scripts from the original HTML BEFORE parsing (DOMParser might strip them)
                    const originalScriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
                    const originalScripts = [];
                    let scriptMatch;
                    while ((scriptMatch = originalScriptRegex.exec(sectionHTML)) !== null) {
                        originalScripts.push(scriptMatch[0]);
                    }
                    console.log(`Extracted ${originalScripts.length} script(s) from original ${sectionName} HTML`);

                    // Find the content section in the loaded HTML
                    const contentSection = doc.querySelector('.content-section, section[id$="Section"]');

                    if (contentSection) {
                        sectionHTML = contentSection.outerHTML;
                        // Re-insert scripts into the section HTML
                        if (originalScripts.length > 0) {
                            // Find where to insert scripts (before closing tag)
                            const closingTagIndex = sectionHTML.lastIndexOf('</');
                            if (closingTagIndex > 0) {
                                const beforeClosing = sectionHTML.substring(0, closingTagIndex);
                                const afterClosing = sectionHTML.substring(closingTagIndex);
                                sectionHTML = beforeClosing + originalScripts.join('\n') + afterClosing;
                            } else {
                                // Append scripts at the end
                                sectionHTML += originalScripts.join('\n');
                            }
                            console.log(`Re-inserted ${originalScripts.length} script(s) into ${sectionName} section HTML`);
                        }
                    } else {
                        // If no section found, try to get the body content
                        const bodyContent = doc.body.innerHTML;
                        if (bodyContent) {
                            sectionHTML = bodyContent;
                            // Re-insert scripts
                            if (originalScripts.length > 0) {
                                sectionHTML += originalScripts.join('\n');
                                console.log(`Re-inserted ${originalScripts.length} script(s) into ${sectionName} body content`);
                            }
                        }
                    }

                    // Cache the loaded content
                    loadedSections[sectionName] = sectionHTML;
                }

                // Inject the content into dynamic container
                if (dynamicContainer) {
                    console.log(`=== PROCESSING ${sectionName.toUpperCase()} SECTION ===`);
                    console.log(`Section HTML length: ${sectionHTML.length} chars`);

                    // Extract and execute scripts BEFORE setting innerHTML
                    // This ensures we capture all scripts from the HTML string
                    // Improved regex to handle script tags with or without attributes
                    const scriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
                    const scriptMatches = [];
                    let match;
                    // Reset regex lastIndex to ensure we start from the beginning
                    scriptRegex.lastIndex = 0;
                    while ((match = scriptRegex.exec(sectionHTML)) !== null) {
                        scriptMatches.push(match[0]); // Full match including tags
                    }
                    console.log(`🔍 Found ${scriptMatches.length} script tag(s) in ${sectionName} HTML string`);
                    if (scriptMatches.length > 0) {
                        console.log(`📄 First script preview (first 300 chars):`, scriptMatches[0].substring(0, 300));
                    } else {
                        // Debug: check if HTML contains script-like text
                        console.log(`⚠️ No scripts found. Checking HTML for script indicators...`);
                        console.log(`   Contains '<script': ${sectionHTML.includes('<script')}`);
                        console.log(`   HTML preview (first 500 chars):`, sectionHTML.substring(0, 500));
                    }

                    // Remove script tags from HTML before inserting (we'll execute them separately)
                    let htmlWithoutScripts = sectionHTML.replace(/<script[\s\S]*?<\/script>/gi, '');

                    // Insert HTML without scripts first
                    dynamicContainer.innerHTML = htmlWithoutScripts;
                    dynamicContainer.style.display = 'block';

                    // Make sure the section inside is visible
                    const injectedSection = dynamicContainer.querySelector('.content-section');
                    if (injectedSection) {
                        injectedSection.classList.add('active');
                        injectedSection.style.display = 'block';
                    }

                    // Now execute the scripts we extracted
                    if (scriptMatches && scriptMatches.length > 0) {
                        scriptMatches.forEach((scriptTag, index) => {
                            // Create a temporary div to parse the script tag
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = scriptTag;
                            const oldScript = tempDiv.querySelector('script');

                            if (oldScript) {
                                const newScript = document.createElement('script');
                                // Copy all attributes
                                Array.from(oldScript.attributes).forEach(attr => {
                                    newScript.setAttribute(attr.name, attr.value);
                                });
                                // Copy script content
                                newScript.textContent = oldScript.textContent || oldScript.innerHTML;

                                console.log(`🚀 Executing script ${index + 1}/${scriptMatches.length} for ${sectionName}`);
                                console.log(`   Content length: ${newScript.textContent.length} chars`);

                                // Append to body to execute
                                document.body.appendChild(newScript);

                                // Script executes immediately when appended
                                console.log(`✅ Script ${index + 1} executed`);

                                // For messages section, verify key functions are available after execution
                                if (sectionName === 'messages' && index === scriptMatches.length - 1) {
                                    setTimeout(() => {
                                        console.log('🔍 Checking for messaging init hook after script execution:');
                                        console.log('   initStudyMessagingOnLoad:', typeof window.initStudyMessagingOnLoad);
                                    }, 300);
                                }

                                // Remove from body after execution (cleanup)
                                setTimeout(() => {
                                    if (newScript.parentNode) {
                                        newScript.parentNode.removeChild(newScript);
                                    }
                                }, 100);
                            }
                        });

                        console.log(`✅ Executed ${scriptMatches.length} script(s) for ${sectionName} section`);
                    } else {
                        // Fallback: try to find scripts in the DOM after insertion
                        setTimeout(() => {
                            const scripts = dynamicContainer.querySelectorAll('script');
                            console.log(`Fallback: Found ${scripts.length} script(s) in DOM after insertion`);
                            if (scripts.length > 0) {
                                scripts.forEach((oldScript, index) => {
                                    const newScript = document.createElement('script');
                                    Array.from(oldScript.attributes).forEach(attr => {
                                        newScript.setAttribute(attr.name, attr.value);
                                    });
                                    newScript.textContent = oldScript.textContent || oldScript.innerHTML;
                                    oldScript.parentNode.removeChild(oldScript);
                                    document.body.appendChild(newScript);
                                    console.log(`✅ Fallback: Executed script ${index + 1}`);
                                });
                            }
                        }, 50);
                    }
                }

                // Initialize section-specific functionality after scripts execute
                // Add a delay to ensure scripts have executed and functions are defined
                // Longer delay for messages section since it has a large script
                const initDelay = sectionName === 'messages' ? 500 : (sectionName === 'homework' ? 400 : 200);
                setTimeout(() => {
                    initializeSectionComponents(sectionName);
                }, initDelay);

                // Update navigation state
                updateNavigationState(sectionName);

                console.log(`Loaded and displayed ${sectionName} section`);

            } catch (error) {
                console.error(`Error loading section ${sectionName}:`, error);
                if (dynamicContainer) {
                    dynamicContainer.innerHTML = `
                        <div style="text-align: center; padding: 3rem; color: #ef4444;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 2rem;"></i>
                            <p style="margin-top: 1rem;">Failed to load ${sectionName}. Please try again.</p>
                        </div>
                    `;
                }
            }
        } else {
            console.warn(`No file mapping found for section: ${sectionName}`);
        }

    } catch (error) {
        console.error('Error in showSection:', error);
    }
}

// Initialize section-specific components
function initializeSectionComponents(sectionName) {
    // Initialize settings if switching to settings section
    if (sectionName === 'settings') {
        console.log('=== INITIALIZING SETTINGS SECTION ===');
        initializeSettings();
    }

    // Initialize homework if switching to homework section
    if (sectionName === 'homework') {
        console.log('=== INITIALIZING HOMEWORK SECTION ===');
        const tryInitHomework = (attempt = 0) => {
            if (typeof window.initializeHomework === 'function') {
                window.initializeHomework();
                return true;
            }
            
            if (attempt < 10) {
                setTimeout(() => tryInitHomework(attempt + 1), 100);
            } else {
                console.error('❌ Failed to find initializeHomework after 10 attempts');
            }
            return false;
        };

        tryInitHomework(0);
    }

    // Initialize messages if switching to messages section
    if (sectionName === 'messages') {
        console.log('=== INITIALIZING MESSAGES SECTION ===');

        const tryInit = (attempt = 0) => {
            if (typeof window.initStudyMessagingOnLoad === 'function') {
                console.log('✅ Found initStudyMessagingOnLoad, initializing...');
                window.initStudyMessagingOnLoad();
                return;
            }
            console.warn(`⚠️ Messaging init hook not found (attempt ${attempt + 1})`);
            if (attempt < 10) {
                setTimeout(() => tryInit(attempt + 1), 150);
            } else {
                console.error('❌ Failed to initialize messaging after 10 attempts');
            }
        };

        setTimeout(() => tryInit(0), 50);
    }

    // Initialize meetings if switching to meetings section
    if (sectionName === 'meetings' && typeof initializeMeetingsInterface === 'function') {
        initializeMeetingsInterface();
    }

    // Initialize assignment tracker if switching to tracker section
    if (sectionName === 'tracker' && typeof initializeAssignmentTracker === 'function') {
        initializeAssignmentTracker();
    }

    // Initialize assigned tutors if switching to tutors section
    if (sectionName === 'tutors' && typeof initializeAssignedTutors === 'function') {
        initializeAssignedTutors();
    }

    if (sectionName === 'invoices') {
        console.log('=== INITIALIZING INVOICES SECTION ===');
        if (typeof window.loadStudentInvoices === 'function') {
            window.loadStudentInvoices();
        }
    }


    // Initialize threads if switching to threads section
    if (sectionName === 'threads') {
        console.log('=== INITIALIZING THREADS SECTION ===');
        if (window.StudyThreads && typeof window.StudyThreads.init === 'function') {
            window.StudyThreads.init();
        }
    }
}

// Settings Functionality
function initializeSettings() {
    console.log('Initializing settings functionality...');

    // Initialize settings tabs
    initializeSettingsTabs();

    // Initialize toggle switches
    initializeToggleSwitches();
}

function initializeSettingsTabs() {
    const settingsTabs = document.querySelectorAll('.settings-tab-btn');

    if (settingsTabs.length === 0) {
        console.log('No settings tabs found');
        return;
    }

    console.log(`Found ${settingsTabs.length} settings tabs`);

    settingsTabs.forEach(tab => {
        tab.addEventListener('click', function (e) {
            e.preventDefault();
            const tabName = this.getAttribute('data-tab');
            switchSettingsTab(tabName);
        });
    });
}

function switchSettingsTab(tabName) {
    console.log(`Switching to ${tabName} tab`);

    // Remove active class from all tabs
    document.querySelectorAll('.settings-tab-btn').forEach(tab => {
        tab.classList.remove('active');
    });

    // Hide all tab content
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Add active class to clicked tab
    const activeTab = document.querySelector(`.settings-tab-btn[data-tab="${tabName}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    // Show corresponding content
    const activeContent = document.getElementById(`${tabName}Tab`);
    if (activeContent) {
        activeContent.classList.add('active');
    }
}

function initializeToggleSwitches() {
    const toggleSwitches = document.querySelectorAll('.toggle-input');

    if (toggleSwitches.length === 0) {
        console.log('No toggle switches found');
        return;
    }

    console.log(`Found ${toggleSwitches.length} toggle switches`);

    toggleSwitches.forEach(toggle => {
        toggle.addEventListener('change', function () {
            const settingName = this.id;
            const isEnabled = this.checked;

            console.log(`${settingName} setting changed to: ${isEnabled}`);

            // Show feedback
            const settingLabels = {
                'teacherMessages': 'Teacher Messages',
                'announcements': 'Announcements',
                'assignmentUpdates': 'Assignment Updates',
                'meetingReminders': 'Meeting Reminders',
                'gradeNotifications': 'Grade Notifications',
                'assignmentDueReminders': 'Assignment Due Date Reminders',
                'examReminders': 'Exam Reminders'
            };

            const label = settingLabels[settingName] || settingName;
            showTemporaryMessage(`${label} notifications ${isEnabled ? 'enabled' : 'disabled'}`);
        });
    });
}

// Update navigation state to highlight active item
function updateNavigationState(sectionName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeLink = Array.from(document.querySelectorAll('.nav-link')).find(
        l => l.getAttribute('data-section') === sectionName
    );
    if (activeLink) {
        activeLink.closest('.nav-item')?.classList.add('active');
    }
}

// Detect current page and highlight the correct nav item
function initializeCurrentPageHighlight() {
    const currentPath = window.location.pathname;
    const currentFile = currentPath.split('/').pop() || '';
    const currentHash = window.location.hash.replace('#', '');

    // First, check if there's a section ID in the current page
    const currentSectionElement = document.querySelector('.content-section.active, .content-section[id$="Section"]');
    if (currentSectionElement && currentSectionElement.id) {
        const sectionId = currentSectionElement.id.replace('Section', '');
        if (sectionFileMap[sectionId]) {
            updateNavigationState(sectionId);
            return;
        }
    }

    // Find which section corresponds to the current file
    let currentSection = null;
    for (const [section, file] of Object.entries(sectionFileMap)) {
        if (file === currentFile || currentFile.includes(section) || currentPath.includes(section)) {
            currentSection = section;
            break;
        }
    }

    // Check hash if no file match
    if (!currentSection && currentHash) {
        const hashSection = currentHash.replace('Section', '');
        if (sectionFileMap[hashSection]) {
            currentSection = hashSection;
        }
    }

    // If we found a matching section, highlight it
    if (currentSection) {
        updateNavigationState(currentSection);
    } else if (currentFile === '' || currentFile === 'student_base.html') {
        // Default to dashboard for base template or empty file
        updateNavigationState('dashboard');
    }
}

// Sidebar Toggle
function initializeSidebarToggle() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function () {
            document.body.classList.toggle('sidebar-open');
        });
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function (e) {
        if (window.innerWidth <= 1024) {
            const sidebar = document.querySelector('.sidebar');
            const toggle = document.getElementById('sidebarToggle');
            if (sidebar && toggle && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
                document.body.classList.remove('sidebar-open');
            }
        }
    });
}

// Header notifications badge (unread count)
function setHeaderNotificationUnreadCount(count) {
    const badge = document.getElementById('notificationsUnreadBadge');
    if (!badge) return;

    const n = Number(count);
    const safeCount = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;

    badge.textContent = safeCount > 99 ? '99+' : String(safeCount);
    badge.style.display = 'inline-flex';
    badge.removeAttribute('aria-hidden');
}

function initializeHeaderNotificationBadge() {
    // WS-driven: badge counts are pushed via ws/dashboard/ (realtimeDashboard.js).
    // Keep a stable global hook for legacy callers; the WS stream will update the badge.
    window.updateStudentNotificationUnreadBadge = function () {};
}

document.addEventListener('DOMContentLoaded', function () {
    initializeDashboard();
});

function initializeDashboard() {
    // Initialize header interactions (includes sidebar toggle)
    initializeHeaderInteractions();

    // Initialize notifications unread badge in the header
    initializeHeaderNotificationBadge();

    // Initialize sidebar toggle
    initializeSidebarToggle();

    // Initialize submenu toggle
    initializeSubmenuToggle();

    // Initialize navigation
    initializeNavigation();

    // Initialize current page highlight
    initializeCurrentPageHighlight();

    // Initialize form handling
    initializeProfileForm();

    // Initialize assignment form
    if (typeof initializeAssignmentForm === 'function') {
        initializeAssignmentForm();
    }

    // Initialize notifications
    initializeNotifications();

    // WS-driven section refresh hooks
    // initializeRealtimeSectionRefresh();

    // Initialize user interactions
    initializeUserInteractions();

    // Check if there's already content loaded (from Jinja2 block)
    const dynamicContainer = document.getElementById('dynamicContentContainer');
    const existingSection = dynamicContainer && dynamicContainer.querySelector('.content-section');

    // If no content is loaded yet, restore last section or show dashboard by default
    if (!existingSection) {
        try {
            // Try to restore the last section the user was on
            const lastSection = localStorage.getItem('student_last_section');
            const sectionToShow = lastSection && sectionFileMap[lastSection] ? lastSection : 'dashboard';
            console.log(`Restoring section: ${sectionToShow}${lastSection ? ' (from localStorage)' : ' (default)'}`);
            showSection(sectionToShow);
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            // Fallback to dashboard if restore fails
            try {
                showSection('dashboard');
            } catch (fallbackError) {
                console.error('Error initializing dashboard fallback:', fallbackError);
            }
        }
    } else {
        // Initialize the currently visible section
        const activeSection = document.querySelector('.content-section.active');
        if (activeSection) {
            const sectionId = activeSection.id;
            if (sectionId) {
                const sectionName = sectionId.replace('Section', '');
                initializeSectionComponents(sectionName);
                updateNavigationState(sectionName);
                // Save to localStorage
                if (sectionName !== 'assignment-detail') {
                    localStorage.setItem('student_last_section', sectionName);
                }
            }
        }
    }
}

function initializeRealtimeSectionRefresh() {
    // Force reload a section by busting the SPA cache
    if (typeof window.forceReloadSection === 'undefined') {
        window.forceReloadSection = async function (sectionName) {
            try { if (window.loadedSections) delete window.loadedSections[sectionName]; } catch (e) {}
            try { return await showSection(sectionName); } catch (e) {}
        };
    }

    if (window.__rtSectionRefreshBound) return;
    window.__rtSectionRefreshBound = true;

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
        if (!sectionName || sectionName === 'assignment-detail') return; // Skip detail views

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
                // Set a flag to indicate this is an auto-refresh
                window._isAutoRefresh = true;
                console.log(`[Auto-refresh] Silently refreshing ${sectionName} section...`);
                
                // Clear cache and reload
                if (window.loadedSections && window.loadedSections[sectionName]) {
                    delete window.loadedSections[sectionName];
                }
                
                await window.forceReloadSection(sectionName);
                
                // Clear flag after refresh
                window._isAutoRefresh = false;
            } catch (error) {
                window._isAutoRefresh = false;
                console.warn(`[Auto-refresh] Failed to refresh ${sectionName}:`, error);
            }
        };

        // Start interval
        autoRefreshInterval = setInterval(refreshCurrentSection, REFRESH_INTERVAL);
        console.log(`[Auto-refresh] Started for section: ${sectionName} (every ${REFRESH_INTERVAL/1000}s)`);
    }

    // Start auto-refresh when section changes
    const originalShowSection = window.showSection;
    if (originalShowSection) {
        window.showSection = async function(sectionName) {
            const result = await originalShowSection.apply(this, arguments);
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

        // Assignments: refresh tracker when visible
        if (eventName === 'assignment.changed') {
            if (activeId === 'trackerSection') {
                window.forceReloadSection('tracker');
            }
        }

        // Homework tab
        if (eventName === 'homework.changed') {
            if (activeId === 'homeworkSection') {
                window.forceReloadSection('homework');
            }
        }

        // Exams tab
        if (eventName === 'exam.changed') {
            if (activeId === 'onlineExamsSection' || activeId === 'online_examSection') {
                // Student section key is "onlineExams" per mapping
                window.forceReloadSection('onlineExams');
            }
        }

        // Announcements tab (has a data loader function, but easiest is to reload section if visible)
        if (eventName === 'announcement.changed') {
            if (activeId === 'announcementsSection') {
                window.forceReloadSection('announcements');
            } else if (typeof window.loadAnnouncements === 'function') {
                // If announcements UI exists on current page, refresh it
                window.loadAnnouncements();
            }
        }
    });
}

function initializeHeaderInteractions() {
    // User profile dropdown
    const userProfileMenu = document.querySelector('.user-profile-menu');
    const dropdown = document.querySelector('.user-dropdown');
    const chevronIcon = userProfileMenu ? userProfileMenu.querySelector('.fa-chevron-down') : null;

    if (userProfileMenu && dropdown) {
        // Initialize dropdown state
        dropdown.style.display = 'none';

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

        // Toggle dropdown when clicking on user profile menu (but NOT on dropdown items)
        userProfileMenu.addEventListener('click', function (e) {
            // Don't toggle if clicking on dropdown items or inside dropdown - let them handle their own clicks
            if (e.target.closest('.dropdown-item') || dropdown.contains(e.target)) {
                // Let the click pass through to dropdown item handlers
                return;
            }

            // Only toggle when clicking on the menu button itself (avatar, info area, or chevron icon, not dropdown)
            e.preventDefault();
            e.stopPropagation();
            const isVisible = dropdown.style.display === 'block' || dropdown.style.display === '';
            const newState = !isVisible;
            dropdown.style.display = newState ? 'block' : 'none';
            userProfileMenu.classList.toggle('active', newState);
            updateChevronIcon(newState);
        });

        // Close dropdown when clicking outside (but not on dropdown items)
        document.addEventListener('click', function (e) {
            // Don't close if clicking on the profile menu button itself
            if (userProfileMenu.contains(e.target) && !dropdown.contains(e.target)) {
                return;
            }
            // If clicking on a dropdown item, let the section switching handler close it
            if (dropdown.contains(e.target) && e.target.closest('.dropdown-item')) {
                // Don't close here - let the section switching handler close it
                return;
            }
            // Close dropdown when clicking outside
            if (!userProfileMenu.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
                userProfileMenu.classList.remove('active');
                updateChevronIcon(false);
            }
        });

        // Also handle keyboard events for accessibility
        userProfileMenu.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                userProfileMenu.click();
            }
        });
    }

    // Dark mode toggle - use id selector to match HTML
    const darkModeToggle = document.getElementById('themeToggle') || document.querySelector('.dark-mode-toggle');
    if (darkModeToggle) {
        const icon = darkModeToggle.querySelector('i');
        const key = 'student-theme';
        const saved = localStorage.getItem(key);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // Initialize theme on load
        if (saved === 'dark' || (!saved && prefersDark)) {
            document.body.classList.add('dark-mode');
            if (icon) {
                icon.classList.replace('fa-moon', 'fa-sun');
            }
        } else {
            document.body.classList.remove('dark-mode');
            if (icon) {
                icon.classList.replace('fa-sun', 'fa-moon');
            }
        }

        // Handle theme toggle click
        darkModeToggle.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem(key, isDark ? 'dark' : 'light');
            if (icon) {
                if (isDark) {
                    icon.classList.replace('fa-moon', 'fa-sun');
                } else {
                    icon.classList.replace('fa-sun', 'fa-moon');
                }
            }
        });
    }

    // Open sections from header/profile (notifications, profile/settings)
    // Use showSection function to load content dynamically
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

        // Use showSection to load content dynamically
        showSection(sectionKey);

        // If opening notifications, refresh the unread badge (it should show 0 when none)
        if (sectionKey === 'notifications' && typeof window.updateStudentNotificationUnreadBadge === 'function') {
            setTimeout(() => window.updateStudentNotificationUnreadBadge(), 0);
        }

        // Close dropdown after section switch
        const currentDropdown = document.querySelector('.user-dropdown');
        if (currentDropdown) {
            currentDropdown.style.display = 'none';
        }
        const currentProfileMenu = document.querySelector('.user-profile-menu');
        if (currentProfileMenu) {
            currentProfileMenu.classList.remove('active');
            // Reset chevron icon
            const chevron = currentProfileMenu.querySelector('.fa-chevron-down');
            if (chevron) {
                chevron.style.transform = 'rotate(0deg)';
            }
        }
    }, true); // Use capture phase to handle early

    // Logout route - handled via hidden form in base template
}

// Profile Form Handling
function initializeProfileForm() {
    const profileForm = document.getElementById('profileForm');
    const passwordForm = document.getElementById('passwordForm');

    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);

        // Add real-time validation for profile form
        const formInputs = profileForm.querySelectorAll('.form-input');
        formInputs.forEach(input => {
            input.addEventListener('blur', validateField);
            input.addEventListener('input', clearFieldError);
        });
    }

    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordUpdate);

        // Add real-time validation for password form
        const passwordInputs = passwordForm.querySelectorAll('.form-input');
        passwordInputs.forEach(input => {
            input.addEventListener('blur', validatePasswordField);
            input.addEventListener('input', clearFieldError);
        });
    }

    // Initialize email edit modal
    initializeEmailEditModal();

    // Initialize profile picture functionality
    initializeProfilePicture();
}

// Email Edit Modal Handling
function initializeEmailEditModal() {
    const editEmailLink = document.getElementById('editEmailLink');
    const emailEditModal = document.getElementById('emailEditModal');
    const emailEditForm = document.getElementById('emailEditForm');
    const currentEmailField = document.getElementById('currentEmail');
    const emailField = document.getElementById('email');

    if (editEmailLink && emailEditModal) {
        // Open modal when clicking edit link
        editEmailLink.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            // Populate current email
            if (currentEmailField && emailField) {
                currentEmailField.value = emailField.value || '';
            }

            // Reset form
            if (emailEditForm) {
                emailEditForm.reset();
                clearEmailEditErrors();
            }

            // Show modal (use class for styling consistency)
            emailEditModal.classList.add('active');
            emailEditModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            // Focus on new email input
            const newEmailInput = document.getElementById('newEmail');
            if (newEmailInput) {
                setTimeout(() => newEmailInput.focus(), 100);
            }
        });
    }

    // Handle email edit form submission
    if (emailEditForm) {
        emailEditForm.addEventListener('submit', handleEmailUpdate);

        // Add validation
        const emailInputs = emailEditForm.querySelectorAll('.form-input');
        emailInputs.forEach(input => {
            input.addEventListener('blur', validateEmailField);
            input.addEventListener('input', clearFieldError);
        });
    }

    // Close modal handlers
    const closeButtons = document.querySelectorAll('[data-modal-close="emailEditModal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            closeEmailEditModal();
        });
    });

    // Close on backdrop click
    if (emailEditModal) {
        emailEditModal.addEventListener('click', function (e) {
            if (e.target === emailEditModal) {
                closeEmailEditModal();
            }
        });
    }

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && emailEditModal && emailEditModal.style.display === 'flex') {
            closeEmailEditModal();
        }
    });
}

function closeEmailEditModal() {
    const emailEditModal = document.getElementById('emailEditModal');
    if (emailEditModal) {
        emailEditModal.classList.remove('active');
        emailEditModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        clearEmailEditErrors();
    }
}

function clearEmailEditErrors() {
    const errorFields = ['newEmailError', 'confirmNewEmailError'];
    errorFields.forEach(id => {
        const errorEl = document.getElementById(id);
        if (errorEl) errorEl.textContent = '';
    });
}

function validateEmailField(e) {
    const field = e.target;
    const fieldName = field.id;
    clearFieldError(e);

    if (fieldName === 'newEmail') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!field.value.trim()) {
            showFieldError('newEmail', 'New email is required');
        } else if (!emailRegex.test(field.value.trim())) {
            showFieldError('newEmail', 'Please enter a valid email address');
        }
    } else if (fieldName === 'confirmNewEmail') {
        const newEmail = document.getElementById('newEmail').value.trim();
        if (!field.value.trim()) {
            showFieldError('confirmNewEmail', 'Please confirm the new email');
        } else if (field.value.trim() !== newEmail) {
            showFieldError('confirmNewEmail', 'Emails do not match');
        }
    }
}

function handleEmailUpdate(e) {
    e.preventDefault();

    const form = e.target;
    const updateBtn = document.getElementById('updateEmailBtn');
    const newEmail = document.getElementById('newEmail').value.trim();
    const confirmNewEmail = document.getElementById('confirmNewEmail').value.trim();
    const currentEmail = document.getElementById('currentEmail').value.trim();

    // Show loading state
    updateBtn.classList.add('loading');
    updateBtn.textContent = 'Updating...';
    updateBtn.disabled = true;

    // Validate
    clearEmailEditErrors();
    let isValid = true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!newEmail) {
        showFieldError('newEmail', 'New email is required');
        isValid = false;
    } else if (!emailRegex.test(newEmail)) {
        showFieldError('newEmail', 'Please enter a valid email address');
        isValid = false;
    }

    if (!confirmNewEmail) {
        showFieldError('confirmNewEmail', 'Please confirm the new email');
        isValid = false;
    } else if (confirmNewEmail !== newEmail) {
        showFieldError('confirmNewEmail', 'Emails do not match');
        isValid = false;
    }

    if (newEmail === currentEmail) {
        showFieldError('newEmail', 'New email must be different from current email');
        isValid = false;
    }

    if (!isValid) {
        updateBtn.classList.remove('loading');
        updateBtn.textContent = 'Update Email';
        updateBtn.disabled = false;
        return;
    }

    // Simulate email update without any backend API
    setTimeout(() => {
        const emailField = document.getElementById('email');
        if (emailField) {
            emailField.value = newEmail;
        }
        alert('Email updated successfully! You will now use ' + newEmail + ' for login credentials. Please log out and log in again with your new email.');
        closeEmailEditModal();
        updateBtn.classList.remove('loading');
        updateBtn.textContent = 'Update Email';
        updateBtn.disabled = false;
    }, 500);
}

function handleProfileUpdate(e) {
    e.preventDefault();

    const form = e.target;
    const updateBtn = form.querySelector('.update-btn');
    const formData = new FormData(form);

    // Show loading state
    updateBtn.classList.add('loading');
    updateBtn.textContent = 'Updating...';
    updateBtn.disabled = true;

    // Validate form
    if (!validateProfileForm(form)) {
        resetUpdateButton(updateBtn);
        return;
    }

    // Build profile data object (used for local updates only in this demo)
    const profileData = {
        first_name: formData.get('firstName') || '',
        last_name: formData.get('lastName') || '',
        phone: formData.get('phoneNumber') || '',
        // Note: student_id is not included - it's system assigned and read-only
        // Note: email update should be handled separately if needed
    };

    // Simulate profile update without any backend API
    setTimeout(() => {
        const firstName = profileData.first_name || '';
        const headerName = document.querySelector('#headerUserName');
        if (headerName && firstName) {
            headerName.textContent = firstName;
        }

        showSuccessMessage('Profile updated successfully!');
        resetUpdateButton(updateBtn);
    }, 500);
}

function handlePasswordUpdate(e) {
    e.preventDefault();

    const form = e.target;
    const updateBtn = form.querySelector('.update-password-btn');
    const formData = new FormData(form);

    // Show loading state
    updateBtn.classList.add('loading');
    updateBtn.textContent = 'Updating...';
    updateBtn.disabled = true;

    // Validate password form
    if (!validatePasswordForm(form)) {
        resetPasswordButton(updateBtn);
        return;
    }

    // Password update - use password reset API
    const currentPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');

    // Note: Backend needs password change endpoint
    // For now, show message that this feature needs backend endpoint
    showSuccessMessage('Password change feature - backend endpoint needed');
    resetPasswordButton(updateBtn);
    form.reset();

    // TODO: Implement when password change endpoint is added
    // if (typeof apiClient !== 'undefined') {
    //     apiClient.post('/accounts/password-change/', {
    //         current_password: currentPassword,
    //         new_password: newPassword
    //     }).then(...)
    // }
}

function validateProfileForm(form) {
    const firstName = form.querySelector('#firstName').value.trim();
    const lastName = form.querySelector('#lastName').value.trim();
    const title = form.querySelector('#title') ? form.querySelector('#title').value.trim() : '';
    const phoneNumber = form.querySelector('#phoneNumber') ? form.querySelector('#phoneNumber').value.trim() : '';
    const studentId = form.querySelector('#studentId') ? form.querySelector('#studentId').value.trim() : '';

    let isValid = true;

    // Validate first name (required)
    if (!firstName || firstName.length < 2) {
        showFieldError('firstName', 'First name is required and must be at least 2 characters long');
        isValid = false;
    }

    // Validate last name (required)
    if (!lastName || lastName.length < 2) {
        showFieldError('lastName', 'Last name is required and must be at least 2 characters long');
        isValid = false;
    }

    // Validate phone number (optional but must be valid if provided)
    if (phoneNumber) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(phoneNumber.replace(/[\s\-\(\)]/g, ''))) {
            showFieldError('phoneNumber', 'Please enter a valid phone number');
            isValid = false;
        }
    }

    // Student ID is optional, no validation needed

    return isValid;
}

function validatePasswordForm(form) {
    const currentPassword = form.querySelector('#currentPassword').value.trim();
    const newPassword = form.querySelector('#newPassword').value.trim();
    const confirmPassword = form.querySelector('#confirmPassword').value.trim();

    let isValid = true;

    // Validate current password
    if (currentPassword.length < 6) {
        showFieldError('currentPassword', 'Current password must be at least 6 characters long');
        isValid = false;
    }

    // Validate new password
    if (newPassword.length < 6) {
        showFieldError('newPassword', 'New password must be at least 6 characters long');
        isValid = false;
    }

    // Validate password confirmation
    if (newPassword !== confirmPassword) {
        showFieldError('confirmPassword', 'Passwords do not match');
        isValid = false;
    }

    // Check if new password is different from current
    if (currentPassword === newPassword) {
        showFieldError('newPassword', 'New password must be different from current password');
        isValid = false;
    }

    return isValid;
}

function validateField(e) {
    const field = e.target;
    const fieldName = field.id;
    const value = field.value.trim();

    clearFieldError(e);

    switch (fieldName) {
        case 'firstName':
            if (!value || value.length < 2) {
                showFieldError(fieldName, 'First name is required and must be at least 2 characters long');
            }
            break;
        case 'lastName':
            if (!value || value.length < 2) {
                showFieldError(fieldName, 'Last name is required and must be at least 2 characters long');
            }
            break;
        case 'phoneNumber':
            if (value) {
                const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
                if (!phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
                    showFieldError(fieldName, 'Please enter a valid phone number');
                }
            }
            break;
        // Email validation is handled separately in email edit modal
        // Student ID is optional, no validation needed
    }
}

function validatePasswordField(e) {
    const field = e.target;
    const fieldName = field.id;
    const value = field.value.trim();

    clearFieldError(e);

    switch (fieldName) {
        case 'currentPassword':
            if (value.length < 6) {
                showFieldError(fieldName, 'Current password must be at least 6 characters long');
            }
            break;
        case 'newPassword':
            if (value.length < 6) {
                showFieldError(fieldName, 'New password must be at least 6 characters long');
            } else {
                // Check if it matches confirm password
                const confirmPassword = document.getElementById('confirmPassword').value.trim();
                if (confirmPassword && value !== confirmPassword) {
                    showFieldError('confirmPassword', 'Passwords do not match');
                }
            }
            break;
        case 'confirmPassword':
            const newPassword = document.getElementById('newPassword').value.trim();
            if (value !== newPassword) {
                showFieldError(fieldName, 'Passwords do not match');
            }
            break;
    }
}

function showFieldError(fieldName, message) {
    const field = document.getElementById(fieldName);
    if (!field) return;

    // Find the container (form-group or input-field)
    const container = field.closest('.form-group') || field.closest('.input-field');
    if (!container) return;

    // Remove existing error (by ID or class)
    const errorId = fieldName + 'Error';
    const existingErrorById = document.getElementById(errorId);
    if (existingErrorById) {
        existingErrorById.textContent = message;
        existingErrorById.style.display = 'block';
    } else {
        // Remove any existing error by class
        const existingError = container.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }

        // Add error styling
        field.style.borderColor = '#dc2626';

        // Add error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.id = errorId;
        errorDiv.style.color = '#dc2626';
        errorDiv.style.fontSize = '0.75rem';
        errorDiv.style.marginTop = '0.25rem';
        errorDiv.textContent = message;

        container.appendChild(errorDiv);
    }

    // Always update border color
    field.style.borderColor = '#dc2626';
}

function clearFieldError(e) {
    const field = e.target;
    if (!field) return;

    // Find the container (form-group or input-field)
    const container = field.closest('.form-group') || field.closest('.input-field');
    if (!container) return;

    // Remove error styling
    field.style.borderColor = '';

    // Remove error message by ID
    const errorId = field.id + 'Error';
    const existingErrorById = document.getElementById(errorId);
    if (existingErrorById) {
        existingErrorById.textContent = '';
        existingErrorById.style.display = 'none';
    }

    // Also remove by class as fallback
    const existingError = container.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

function resetUpdateButton(updateBtn) {
    updateBtn.classList.remove('loading');
    updateBtn.textContent = 'Update Profile';
    updateBtn.disabled = false;
}

function resetPasswordButton(updateBtn) {
    updateBtn.classList.remove('loading');
    updateBtn.textContent = 'Update Password';
    updateBtn.disabled = false;
}

function showSuccessMessage(message) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => msg.remove());

    // Create success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;

    // Insert at the top of the form
    const form = document.getElementById('profileForm');
    form.insertBefore(successDiv, form.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 5000);
}

function showErrorMessage(message) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => msg.remove());

    // Create error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;

    // Insert at the top of the form
    const form = document.getElementById('profileForm');
    form.insertBefore(errorDiv, form.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// Submenu Toggle Handling
function initializeSubmenuToggle() {
    const submenuItems = document.querySelectorAll('.nav-item.has-submenu > .nav-link');

    submenuItems.forEach(link => {
        link.addEventListener('click', function (e) {
            const navItem = this.closest('.nav-item');
            if (navItem && navItem.classList.contains('has-submenu')) {
                // Toggle expanded state
                navItem.classList.toggle('expanded');

                // Prevent default navigation if clicking on parent item with submenu
                // Only navigate if clicking on a direct child link
                if (!this.getAttribute('data-section') || this.querySelector('.nav-submenu')) {
                    e.preventDefault();
                }
            }
        });
    });
}

// Navigation Handling - Shows/hides sections on same page (like admin dashboard)
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link[data-section]');

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            // Don't prevent default if it's a submenu parent
            const navItem = this.closest('.nav-item');
            if (navItem && navItem.classList.contains('has-submenu')) {
                // Let submenu toggle handle it
                return;
            }

            e.preventDefault();

            // Remove active class from all nav items (including submenu items)
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });

            // Add active class to clicked nav item
            navItem?.classList.add('active');

            // Show corresponding section
            const sectionName = this.getAttribute('data-section');
            if (sectionName) {
                showSection(sectionName);
            }
        });
    });
}

// For backward compatibility
function switchSection(sectionName) {
    showSection(sectionName);
}

function openSection(sectionKey) {
    showSection(sectionKey);
}

// Notifications Handling
function initializeNotifications() {
    // Student notifications are loaded inside the Notifications section via `apiClient.getNotifications`.
    // (No mock/placeholder UI here.)
}

// User Interactions
function initializeUserInteractions() {
    // Handle user avatar clicks
    const userAvatars = document.querySelectorAll('.user-avatar-small, .avatar img');
    userAvatars.forEach(avatar => {
        avatar.addEventListener('click', handleUserAvatarClick);
    });

    // Handle logout
    const logoutLink = document.querySelector('.logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', handleLogout);
    }

    // Add hover effects to interactive elements
    addHoverEffects();
}

function handleUserAvatarClick(e) {
    e.preventDefault();

    // Simulate user menu (in real app, show user dropdown menu)
    showTemporaryMessage('User menu coming soon!');
}

function handleLogout(e) {
    e.preventDefault();

    // Show confirmation dialog
    if (confirm('Are you sure you want to logout?')) {
        showTemporaryMessage('Logging out...');

        // Simulate logout process
        setTimeout(() => {
            // In real app, redirect to login page
            console.log('User logged out');
            showTemporaryMessage('Redirecting to login page...');
        }, 1500);
    }
}

function addHoverEffects() {
    // Add subtle animations to interactive elements
    const interactiveElements = document.querySelectorAll('.nav-link, .update-btn, .notification-icon, .user-avatar-small');

    interactiveElements.forEach(element => {
        element.addEventListener('mouseenter', function () {
            this.style.transform = 'translateY(-1px)';
        });

        element.addEventListener('mouseleave', function () {
            this.style.transform = 'translateY(0)';
        });
    });
}

// Utility Functions
function showTemporaryMessage(message) {
    // Remove existing temporary messages
    const existingMessage = document.querySelector('.temporary-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Create temporary message
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

    // Add animation keyframes
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

    // Auto-remove after 3 seconds
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

// Profile Picture Functionality
function initializeProfilePicture() {
    const profilePictureInput = document.getElementById('profilePictureInput');
    const profilePictureImg = document.getElementById('profilePictureImg');
    const profilePictureIcon = document.getElementById('profilePictureIcon');
    const profilePicturePreview = document.getElementById('profilePicturePreview');
    const removeProfilePictureBtn = document.getElementById('removeProfilePictureBtn');
    const profilePictureError = document.getElementById('profilePictureError');

    // Load existing profile picture on page load
    loadProfilePicture();

    // Make preview container clickable
    if (profilePicturePreview) {
        profilePicturePreview.addEventListener('click', function () {
            if (profilePictureInput) {
                profilePictureInput.click();
            }
        });
        profilePicturePreview.style.cursor = 'pointer';
    }

    if (profilePictureInput) {
        // Handle file selection
        profilePictureInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                // Clear previous errors
                if (profilePictureError) {
                    profilePictureError.style.display = 'none';
                    profilePictureError.textContent = '';
                }

                // Validate file type
                if (!file.type.startsWith('image/')) {
                    showError('Please select a valid image file (JPG, PNG, or GIF).', profilePictureError);
                    profilePictureInput.value = '';
                    return;
                }

                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    showError('Image size must be less than 5MB.', profilePictureError);
                    profilePictureInput.value = '';
                    return;
                }

                // Create preview
                const reader = new FileReader();
                reader.onload = function (e) {
                    if (profilePictureImg) {
                        profilePictureImg.src = e.target.result;
                        profilePictureImg.style.display = 'block';
                    }
                    if (profilePictureIcon) {
                        profilePictureIcon.style.display = 'none';
                    }
                    if (removeProfilePictureBtn) {
                        removeProfilePictureBtn.style.display = 'inline-block';
                    }

                    // Upload the image
                    uploadProfilePicture(file);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Handle remove picture button
    if (removeProfilePictureBtn) {
        removeProfilePictureBtn.addEventListener('click', function () {
            removeProfilePicture();
        });
    }

    // Helper function to show error
    function showError(message, errorElement) {
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        } else {
            // Fallback to global error message function if available
            if (typeof showErrorMessage === 'function') {
                showErrorMessage(message);
            } else {
                console.error(message);
                alert(message);
            }
        }
    }

    // Upload profile picture (front-end only, no backend)
    async function uploadProfilePicture(file) {
        try {
            const localUrl = (profilePictureImg && profilePictureImg.src) || URL.createObjectURL(file);
            updateHeaderAvatar(localUrl);
            if (typeof showSuccessMessage === 'function') {
                showSuccessMessage('Profile picture updated successfully!');
            }
            if (profilePictureError) {
                profilePictureError.style.display = 'none';
            }
        } catch (error) {
            console.error('Profile picture update error:', error);
            showError('Failed to update profile picture. Please try again.', profilePictureError);
        }
    }

    // Remove profile picture (front-end only)
    async function removeProfilePicture() {
        try {
            // Reset preview
            if (profilePictureImg) {
                profilePictureImg.src = '';
                profilePictureImg.style.display = 'none';
            }
            if (profilePictureIcon) {
                profilePictureIcon.style.display = 'block';
            }
            if (removeProfilePictureBtn) {
                removeProfilePictureBtn.style.display = 'none';
            }
            if (profilePictureInput) {
                profilePictureInput.value = '';
            }
            // Update header avatar
            updateHeaderAvatar('');
            if (typeof showSuccessMessage === 'function') {
                showSuccessMessage('Profile picture removed successfully!');
            }
        } catch (error) {
            console.error('Remove profile picture error:', error);
            showError('Failed to remove profile picture. Please try again.', profilePictureError);
        }
    }

    // Load profile picture (front-end only)
    async function loadProfilePicture() {
        try {
            if (profilePictureIcon) {
                profilePictureIcon.style.display = 'block';
            }
            if (profilePictureImg) {
                profilePictureImg.style.display = 'none';
            }
            if (removeProfilePictureBtn) {
                removeProfilePictureBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading profile picture:', error);
        }
    }

    // Update profile picture display
    function updateProfilePictureDisplay(url) {
        if (url) {
            if (profilePictureImg) {
                profilePictureImg.src = url;
                profilePictureImg.style.display = 'block';
            }
            if (profilePictureIcon) {
                profilePictureIcon.style.display = 'none';
            }
            if (removeProfilePictureBtn) {
                removeProfilePictureBtn.style.display = 'inline-block';
            }
        } else {
            if (profilePictureImg) {
                profilePictureImg.src = '';
                profilePictureImg.style.display = 'none';
            }
            if (profilePictureIcon) {
                profilePictureIcon.style.display = 'block';
            }
            if (removeProfilePictureBtn) {
                removeProfilePictureBtn.style.display = 'none';
            }
        }
    }

    // Update header avatar
    function updateHeaderAvatar(url) {
        const headerAvatar = document.getElementById('headerProfilePicture');
        const headerIcon = document.getElementById('headerProfileIcon');

        if (headerAvatar && headerIcon) {
            if (url) {
                headerAvatar.src = url;
                headerAvatar.style.display = 'block';
                headerAvatar.onerror = function () {
                    // If image fails to load, show icon instead
                    this.style.display = 'none';
                    if (headerIcon) headerIcon.style.display = 'block';
                };
                if (headerIcon) {
                    headerIcon.style.display = 'none';
                }
            } else {
                headerAvatar.src = '';
                headerAvatar.style.display = 'none';
                if (headerIcon) {
                    headerIcon.style.display = 'block';
                }
            }
        }
    }
}

// Password Toggle Function
function togglePassword(fieldId) {
    const passwordField = document.getElementById(fieldId);
    const toggleButton = passwordField.nextElementSibling;
    const icon = toggleButton.querySelector('i');

    if (passwordField.type === 'password') {
        passwordField.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        passwordField.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Initialize password field enhancement when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    // Password field enhancement is now handled by the togglePassword function
    // and is initialized in initializeProfileForm()
});

// Messages Interface Integration
function initializeMessagesInterface() {
    // Check if messages interface is already initialized
    if (window.messagesInitialized) {
        return;
    }

    // Initialize the messages interface (for contact list, etc.)
    // Note: Composer initialization is handled separately in messages.html
    if (window.MessagesInterface && window.MessagesInterface.initializeMessages) {
        window.MessagesInterface.initializeMessages();
        window.messagesInitialized = true;
    }
}

// Meetings Interface Integration
function initializeMeetingsInterface() {
    // Check if meetings interface is already initialized
    if (window.meetingsInitialized) {
        return;
    }

    // Initialize the meetings interface
    if (window.MeetingsInterface && window.MeetingsInterface.initializeMeetings) {
        window.MeetingsInterface.initializeMeetings();
        window.meetingsInitialized = true;
    }
}

/**
 * Global showToast wrapper for the toastNotifications system
 */
if (typeof window.showToast === 'undefined') {
    window.showToast = function(message, type = 'info', duration = 3000) {
        if (window.toastNotifications && typeof window.toastNotifications.show === 'function') {
            window.toastNotifications.show(message, type, duration);
        } else {
            console.log(`[Toast ${type}] ${message}`);
            // Fallback to simple alert if system not ready
            if (type === 'error') alert(message);
        }
    };
}

function getCookie(name) {
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

function validateAssignmentForm(form) {
    const requiredFields = [
        'writingType',
        'academicLevel',
        'deadline',
        'paperType',
        'englishType',
        'spacing',
        'numberOfPages'
    ];

    let isValid = true;

    requiredFields.forEach(fieldName => {
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (!field) {
            // Field doesn't exist in this form, skip validation
            return;
        }
        if (!field.value || !field.value.trim()) {
            showFieldError(fieldName, `${getFieldLabel(fieldName)} is required`);
            isValid = false;
        } else {
            clearFieldError({ target: field });
        }
    });

    // Validate deadline (should be in the future)
    const deadlineField = form.querySelector('#deadline');
    if (deadlineField && deadlineField.value) {
        const deadline = new Date(deadlineField.value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (deadline <= today) {
            showFieldError('deadline', 'Deadline must be in the future');
            isValid = false;
        }
    }

    return isValid;
}

function getFieldLabel(fieldName) {
    const labels = {
        'writingType': 'Writing Type',
        'academicLevel': 'Academic Level',
        'deadline': 'Deadline',
        'paperType': 'Type of Paper',
        'englishType': 'Type of English',
        'spacing': 'Spacing',
        'numberOfPages': 'Number of Pages'
    };
    return labels[fieldName] || fieldName;
}

function resetSubmitButton(submitBtn) {
    submitBtn.classList.remove('loading');
    submitBtn.textContent = 'Submit Request';
    submitBtn.disabled = false;
    enableFeatureCards();
}

function disableFeatureCards() {
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.classList.add('loading');
        const checkbox = card.querySelector('.feature-checkbox');
        checkbox.disabled = true;
    });
}

function enableFeatureCards() {
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.classList.remove('loading');
        const checkbox = card.querySelector('.feature-checkbox');
        checkbox.disabled = false;
    });
}

function initializeFeatureCards() {
    const featureCards = document.querySelectorAll('.feature-card');

    featureCards.forEach(card => {
        // Handle card click (excluding checkbox click)
        card.addEventListener('click', function (e) {
            // Don't trigger if clicking directly on checkbox
            if (e.target.classList.contains('feature-checkbox')) {
                return;
            }

            const checkbox = this.querySelector('.feature-checkbox');
            checkbox.checked = !checkbox.checked;

            // Update visual state
            updateFeatureCardState(card, checkbox.checked);

            // Trigger change event for form handling
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Handle checkbox change
        const checkbox = card.querySelector('.feature-checkbox');
        checkbox.addEventListener('change', function () {
            updateFeatureCardState(card, this.checked);
        });

        // Initialize visual state based on checkbox state
        updateFeatureCardState(card, checkbox.checked);
    });
}

function updateFeatureCardState(card, isChecked) {
    if (isChecked) {
        card.classList.add('selected');
        // Add visual indicator
        addCheckmarkIndicator(card);
    } else {
        card.classList.remove('selected');
        // Remove visual indicator
        removeCheckmarkIndicator(card);
    }
}

function addCheckmarkIndicator(card) {
    // Remove existing indicator if any
    removeCheckmarkIndicator(card);

    // Add checkmark indicator
    const indicator = document.createElement('div');
    indicator.className = 'feature-checkmark';
    indicator.innerHTML = '<i class="fas fa-check"></i>';
    card.appendChild(indicator);
}

function removeCheckmarkIndicator(card) {
    const existingIndicator = card.querySelector('.feature-checkmark');
    if (existingIndicator) {
        existingIndicator.remove();
    }
}

function getSelectedFeatures() {
    const checkedBoxes = document.querySelectorAll('.feature-checkbox:checked');
    return Array.from(checkedBoxes).map(checkbox => checkbox.value);
}

function clearAssignmentForm() {
    const form = document.getElementById('assignmentForm');
    if (form) {
        // Reset all form fields
        form.reset();

        // Clear all feature checkboxes and visual states
        const featureCards = document.querySelectorAll('.feature-card');
        featureCards.forEach(card => {
            const checkbox = card.querySelector('.feature-checkbox');
            checkbox.checked = false;
            updateFeatureCardState(card, false);
        });

        // Reset pages counter to default
        const pagesInput = document.getElementById('numberOfPages');
        if (pagesInput) {
            pagesInput.value = '1';
        }

        // Clear any error messages
        const errorMessages = form.querySelectorAll('.field-error');
        errorMessages.forEach(error => error.remove());

        // Reset field borders
        const formInputs = form.querySelectorAll('.form-input, .form-select');
        formInputs.forEach(input => {
            input.style.borderColor = '';
        });
    }
}

function initializePagesCounter() {
    // Pages counter functionality is handled by global functions
    // This ensures the functions are available when the HTML calls them
}

// Global functions for pages counter (called from HTML)
function increasePages() {
    const pagesInput = document.getElementById('numberOfPages');
    const currentValue = parseInt(pagesInput.value) || 1;
    const maxValue = parseInt(pagesInput.getAttribute('max')) || 100;

    if (currentValue < maxValue) {
        pagesInput.value = currentValue + 1;
    }
}

function decreasePages() {
    const pagesInput = document.getElementById('numberOfPages');
    const currentValue = parseInt(pagesInput.value) || 1;
    const minValue = parseInt(pagesInput.getAttribute('min')) || 1;

    if (currentValue > minValue) {
        pagesInput.value = currentValue - 1;
    }
}

// Confirmation Modal Functions
function showConfirmationModal() {
    const modal = document.getElementById('confirmationModal');
    if (modal) {
        // Update modal message to include selected features
        updateModalMessage();
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
}

function updateModalMessage() {
    const modalMessage = document.querySelector('.modal-message');
    if (modalMessage && window.lastSelectedFeatures) {
        const selectedFeatures = window.lastSelectedFeatures;
        let featuresText = '';

        if (selectedFeatures.length > 0) {
            const featureNames = selectedFeatures.map(feature => {
                // Convert feature values to readable names
                const featureMap = {
                    'abstract': 'Abstract',
                    'executive-summary': 'Executive Summary',
                    'proofread': 'Proofread by Editor',
                    'draft': 'Draft',
                    'daily-update': 'Daily Delivery Update',
                    'grammarly': 'Grammarly Report',
                    'turnitin-ai': 'Turnitin AI Report',
                    'turnitin-similarity': 'Turnitin Similarity Report',
                    'table-of-contents': 'Table of Contents'
                };
                return featureMap[feature] || feature;
            });

            featuresText = `<br><br><strong>Selected Additional Features:</strong><br>• ${featureNames.join('<br>• ')}`;
        } else {
            featuresText = '<br><br><strong>No additional features selected.</strong>';
        }

        modalMessage.innerHTML = `Your new assignment request has been successfully submitted. You can monitor its progress in the Assignment Tracker.${featuresText}`;
    }
}

function closeConfirmationModal() {
    const modal = document.getElementById('confirmationModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scrolling
    }
}

function goToAssignmentTracker() {
    closeConfirmationModal();
    showTemporaryMessage('Assignment Tracker feature coming soon!');

    // In a real app, this would navigate to the assignment tracker
    // For now, we'll just show a message
    console.log('Navigating to Assignment Tracker');
}

// Close modal when clicking outside
document.addEventListener('click', function (e) {
    const modal = document.getElementById('confirmationModal');
    if (modal && e.target === modal) {
        closeConfirmationModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeConfirmationModal();
    }
});

// Assignment Tracker Functionality
function initializeAssignmentTracker() {
    console.log('Initializing assignment tracker...');
    
    // Initialize tracker tabs
    initializeTrackerTabs();

    // Initialize assignment actions
    initializeAssignmentActions();

    // Initialize filter buttons
    initializeAssignmentFilters();

    // Load assignments when tracker is initialized
    loadAndRenderAssignments();
}

// Load and render assignments in tracker table
async function loadAndRenderAssignments() {
    // Data is hardcoded in HTML, just apply filters to existing table rows
    const trackerTable = document.querySelector('#trackerTable');
    if (trackerTable) {
        // Apply current filter to existing hardcoded data
        applyAssignmentFilter();
    }
}

// Initialize assignment filter buttons
function initializeAssignmentFilters() {
    const filterButtons = document.querySelectorAll('#trackerSection .filter-btn');

    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');

            // Apply filter
            applyAssignmentFilter();
        });
    });
}

// Apply assignment filter based on selected filter button
function applyAssignmentFilter() {
    const activeFilter = document.querySelector('#trackerSection .filter-btn.active');
    const filterValue = activeFilter ? activeFilter.getAttribute('data-filter') : 'all';

    // Map frontend filter values to backend status values
    const statusMap = {
        'all': null,
        'pending': 'pending',
        'assigned': 'assigned',
        'in-process': 'in-process',
        'completed': 'completed',
        'cancelled': 'cancelled',
        'deleted': 'deleted'
    };

    const targetStatus = statusMap[filterValue];
    const rows = document.querySelectorAll('#trackerTable tbody tr');
    const emptyState = document.getElementById('emptyTrackerState');
    let visibleCount = 0;

    rows.forEach(row => {
        if (row.cells.length === 0) return; // Skip empty rows

        const rowStatus = row.getAttribute('data-status');

        if (targetStatus === null || rowStatus === targetStatus) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    // Show/hide empty state
    if (emptyState) {
        if (visibleCount === 0) {
            emptyState.style.display = 'block';
            document.querySelector('#trackerTable')?.style.setProperty('display', 'none');
        } else {
            emptyState.style.display = 'none';
            document.querySelector('#trackerTable')?.style.setProperty('display', 'table');
        }
    }
}

function initializeTrackerTabs() {
    const trackerTabs = document.querySelectorAll('.tracker-tab-btn');

    trackerTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const tabName = this.getAttribute('data-tab');
            switchTrackerTab(tabName);
        });
    });
}

function switchTrackerTab(tabName) {
    // Remove active class from all tabs
    document.querySelectorAll('.tracker-tab-btn').forEach(tab => {
        tab.classList.remove('active');
    });

    // Hide all tab content
    document.querySelectorAll('.tracker-content .tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Add active class to clicked tab
    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    // Show corresponding content
    const activeContent = document.getElementById(`${tabName}Content`);
    if (activeContent) {
        activeContent.classList.add('active');
    }

    console.log(`Switched to ${tabName} tab`);
}

function initializeAssignmentActions() {
    // Assignment actions are handled by onclick handlers in HTML
    // This function can be extended for additional functionality
}

// Assignment Action Functions (called from HTML onclick handlers)
// Store current assignment ID for cancel operation
if (typeof currentAssignmentId === 'undefined') { var currentAssignmentId = null; }
if (typeof currentAssignmentRow === 'undefined') { var currentAssignmentRow = null; }

function cancelAssignment(assignmentId) {
    // Find the row by assignment UUID (data-assignment-id)
    const targetRow = document.querySelector(`#trackerTable tbody tr[data-assignment-id="${assignmentId}"]`);
    
    if (!targetRow) {
        console.error('Assignment row not found for ID:', assignmentId);
        return;
    }

    let assignmentData = {};
    const idCell = targetRow.querySelector('td code');
    const idText = idCell ? idCell.textContent.trim() : 'N/A';
    
    assignmentData = {
        id: idText,
        title: targetRow.cells[1].textContent.trim(),
        serviceType: targetRow.cells[2].textContent.trim(),
        status: targetRow.getAttribute('data-status'),
        submittedDate: targetRow.cells[4].textContent.trim(),
        dueDate: targetRow.cells[5].textContent.trim()
    };

    // Store for confirmation
    currentAssignmentId = assignmentId;
    currentAssignmentRow = targetRow;

    // Show cancel confirmation modal
    showCancelConfirmationModal(assignmentData);
}

function showCancelConfirmationModal(assignmentData) {
    const modal = document.getElementById('cancelAssignmentModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        // Fallback to browser confirm if modal doesn't exist
        if (confirm(`Are you sure you want to cancel "${assignmentData.title}"?\n\nImportant: Any payment made is not refundable.`)) {
            confirmCancelAssignment();
        }
    }
}

function closeCancelModal() {
    const modal = document.getElementById('cancelAssignmentModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentAssignmentId = null;
    currentAssignmentRow = null;
}

async function confirmCancelAssignment() {
    let assignmentId = currentAssignmentId;
    let assignmentTitle = '';

    // If called from detail page, get data from detail page
    if (!currentAssignmentRow) {
        const titleEl = document.getElementById('detailAssignmentTitle');
        const idEl = document.getElementById('detailAssignmentId');
        if (titleEl) assignmentTitle = titleEl.textContent.trim();
        // Use currentAssignmentId which is set in sessionStorage or populateAssignmentDetail
    } else {
        assignmentTitle = currentAssignmentRow.cells[1].textContent.trim();
    }

    if (!assignmentId) {
        console.error('No assignment ID found for cancellation');
        closeCancelModal();
        return;
    }

    const confirmBtn = document.getElementById('confirmCancelBtn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Cancelling...';
    }

    try {
        // Actual server-side cancellation
        const response = await fetch(`/assingment/cancel/${assignmentId}/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to cancel assignment');
        }

        // --- UI Update logic after successful server response ---
        
        // Find the row in tracker table to update it
        let targetRow = currentAssignmentRow;
        if (!targetRow) {
            targetRow = document.querySelector(`#trackerTable tbody tr[data-assignment-id="${assignmentId}"]`);
        }

        if (targetRow) {
            // Update row status to cancelled
            targetRow.setAttribute('data-status', 'cancelled');
            targetRow.style.opacity = '0.6';

            // Update status badge
            const statusCell = targetRow.cells[4]; // Corrected index for Status column (0: ID, 1: Title, 2: Priority, 3: Service, 4: Status)
            if (statusCell) {
                statusCell.innerHTML = '<span class="status-badge cancelled"><i class="fas fa-times-circle"></i> Cancelled</span>';
            }

            // Hide cancel button
            const cancelBtnInRow = targetRow.querySelector('.cancel-btn');
            if (cancelBtnInRow) {
                cancelBtnInRow.style.display = 'none';
            }
        }

        // If on detail page, update it
        const detailSection = document.getElementById('assignmentDetailSection');
        if (detailSection && detailSection.style.display !== 'none') {
            const statusBadgeEl = document.getElementById('detailStatusBadge');
            if (statusBadgeEl) {
                statusBadgeEl.className = 'status-badge cancelled';
                statusBadgeEl.innerHTML = '<i class="fas fa-times-circle"></i> Cancelled';
            }

            const cancelDetailBtn = document.getElementById('cancelDetailBtn');
            if (cancelDetailBtn) {
                cancelDetailBtn.style.display = 'none';
            }
        }

        closeCancelModal();
        showToast(`Assignment "${assignmentTitle}" has been cancelled successfully.`, 'success');

        // Refresh the current section after a delay
        setTimeout(() => {
            if (window.switchSection) {
                window.switchSection('tracker');
            } else {
                location.reload();
            }
        }, 1500);

    } catch (error) {
        console.error(`Error cancelling assignment:`, error);
        showToast(`Failed to cancel assignment: ${error.message}`, 'error');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Yes, Cancel Assignment';
        }
    }
}

async function viewAssignment(assignmentId) {
    // Ensure tracker section is loaded first
    const trackerTable = document.querySelector('#trackerTable');
    if (!trackerTable) {
        showSection('tracker');
        // Wait for tracker to load, then try again
        setTimeout(() => {
            viewAssignment(assignmentId);
        }, 500);
        return;
    }

    try {
        // Show loading toast
        showToast('Loading assignment details...', 'info', 2000);

        // Fetch full assignment details from backend
        const response = await fetch(`/assingment/admin/details/${assignmentId}/`, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to load assignment details');
        }

        const assignmentData = result.assignment;
        // Merge with additional data from the result if needed
        assignmentData.student = result.student;
        assignmentData.assigned_teachers = result.assigned_teachers;
        assignmentData.files = result.files;

        // Store assignment data for detail page
        sessionStorage.setItem('currentAssignment', JSON.stringify(assignmentData));

        // Navigate to assignment detail page
        showSection('assignment-detail');

        // Populate detail page after a short delay to ensure DOM is ready
        setTimeout(() => {
            populateAssignmentDetail(assignmentData);
        }, 100);

    } catch (error) {
        console.error(`Error loading assignment:`, error);
        showToast(`Failed to load assignment: ${error.message}`, 'error');
    }
}

function populateAssignmentDetail(assignmentData) {
    console.log('=== Populating Assignment Detail ===', assignmentData);
    
    // Populate assignment details
    const titleEl = document.getElementById('detailAssignmentTitle');
    const idEl = document.getElementById('detailAssignmentId');
    const serviceTypeEl = document.getElementById('detailServiceType');
    const submittedDateEl = document.getElementById('detailSubmittedDate');
    const dueDateEl = document.getElementById('detailDueDate');
    const descriptionEl = document.getElementById('detailDescription');
    const statusBadgeEl = document.getElementById('detailStatusBadge');
    const cancelBtn = document.getElementById('cancelDetailBtn');

    if (titleEl) titleEl.textContent = assignmentData.title;
    if (idEl) idEl.textContent = assignmentData.code || assignmentData.id;
    if (serviceTypeEl) serviceTypeEl.textContent = assignmentData.service_type || assignmentData.serviceType;
    if (submittedDateEl) submittedDateEl.textContent = assignmentData.created_at || assignmentData.submittedDate;
    if (dueDateEl) dueDateEl.textContent = assignmentData.due_date || assignmentData.exam_date || assignmentData.dueDate || '-';
    
    if (descriptionEl && assignmentData.description) {
        descriptionEl.innerHTML = `<p>${assignmentData.description.replace(/\n/g, '<br>')}</p>`;
    }

    // Update status badge
    if (statusBadgeEl) {
        const statusClass = getStatusClass(assignmentData.status);
        statusBadgeEl.className = `status-badge ${statusClass}`;
        statusBadgeEl.innerHTML = getStatusBadgeHTML(assignmentData.status);
    }

    // Populate assigned teachers
    const teacherCard = document.getElementById('assignedTeacherCard');
    const teacherContent = document.getElementById('teacherInfoContent');
    
    if (teacherCard && teacherContent) {
        if (assignmentData.assigned_teachers && assignmentData.assigned_teachers.length > 0) {
            teacherCard.style.display = 'block';
            teacherContent.innerHTML = assignmentData.assigned_teachers.map(teacher => `
                <div class="teacher-detail-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--surface); border-radius: 8px; margin-bottom: 10px; border: 1px solid var(--divider);">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="teacher-avatar-mini" style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background: #eee; display: flex; align-items: center; justify-content: center;">
                            ${teacher.avatar 
                                ? `<img src="${teacher.avatar}" alt="${teacher.name}" style="width: 100%; height: 100%; object-fit: cover;">`
                                : '<i class="fas fa-user-circle" style="font-size: 40px; color: #ccc;"></i>'
                            }
                        </div>
                        <div class="teacher-text" style="display: flex; flex-direction: column;">
                            <span class="teacher-name" style="font-weight: 600;">${teacher.name}</span>
                            <span class="teacher-role" style="font-size: 0.8rem; color: var(--muted-text);">${teacher.role === 'primary' ? 'Primary Teacher' : 'Helper Teacher'}</span>
                        </div>
                    </div>
                    <div class="teacher-actions">
                        <button class="action-btn chat-btn" onclick="startChat('${teacher.id}')" title="Chat with Teacher" style="padding: 6px 12px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-comment"></i> Chat
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            teacherCard.style.display = 'none';
        }
    }

    // Populate additional features
    const featuresCard = document.getElementById('additionalFeaturesCard');
    const featuresList = document.getElementById('featuresList');
    const noFeatures = document.getElementById('noFeatures');
    
    if (featuresCard && featuresList) {
        if (assignmentData.features && Array.isArray(assignmentData.features) && assignmentData.features.length > 0) {
            featuresCard.style.display = 'block';
            if (noFeatures) noFeatures.style.display = 'none';
            
            const featureLabels = {
                'abstract': { name: 'Abstract', icon: 'fa-file-alt', desc: 'Concise summary of your work' },
                'executive-summary': { name: 'Executive Summary', icon: 'fa-briefcase', desc: 'High-level overview for quick review' },
                'proofread': { name: 'Proofread by Editor', icon: 'fa-spell-check', desc: 'Editorial pass for grammar and flow' },
                'draft': { name: 'Draft', icon: 'fa-file-draft', desc: 'Receive an interim draft for review' },
                'daily-update': { name: 'Daily Delivery Update', icon: 'fa-calendar-day', desc: 'Progress updates as the work proceeds' },
                'grammarly': { name: 'Grammarly Report', icon: 'fa-check-double', desc: 'Quality check with Grammarly' },
                'turnitin-ai': { name: 'Turnitin AI Report', icon: 'fa-robot', desc: 'AI detection insights' },
                'turnitin-similarity': { name: 'Turnitin Similarity Report', icon: 'fa-search', desc: 'Similarity score report' },
                'table-of-contents': { name: 'Table of Contents', icon: 'fa-list', desc: 'Structured contents page' }
            };
            
            featuresList.innerHTML = assignmentData.features.map(feature => {
                const featureInfo = featureLabels[feature] || { name: feature.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), icon: 'fa-check', desc: '' };
                return `
                    <div class="feature-item" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--surface, #f8f9fa); border-radius: 8px; border: 1px solid var(--divider, #e0e0e0);">
                        <i class="fas ${featureInfo.icon}" style="color: var(--primary, #1158e5); font-size: 1.2rem;"></i>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--text, #333);">${featureInfo.name}</div>
                            ${featureInfo.desc ? `<div style="font-size: 0.85rem; color: var(--muted-text, #666); margin-top: 4px;">${featureInfo.desc}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            featuresCard.style.display = 'none';
        }
    }

    // Populate attachments
    const attachmentsList = document.getElementById('attachmentsList');
    const noAttachments = document.getElementById('noAttachments');
    
    if (attachmentsList) {
        if (assignmentData.files && Array.isArray(assignmentData.files) && assignmentData.files.length > 0) {
            if (noAttachments) noAttachments.style.display = 'none';
            attachmentsList.style.display = 'grid';
            attachmentsList.innerHTML = assignmentData.files.map(file => {
                const fileName = file.name || 'Unknown File';
                const fileExt = fileName.split('.').pop().toLowerCase();
                let iconClass = 'fa-file-alt';
                if (['pdf'].includes(fileExt)) iconClass = 'fa-file-pdf';
                else if (['doc', 'docx'].includes(fileExt)) iconClass = 'fa-file-word';
                else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExt)) iconClass = 'fa-file-image';
                else if (['txt'].includes(fileExt)) iconClass = 'fa-file-alt';
                else if (['zip', 'rar'].includes(fileExt)) iconClass = 'fa-file-archive';

                const fileUrl = file.url || '#';
                const fileType = file.type || 'support';
                const fileTypeLabel = fileType === 'support' ? 'Supporting Document' : 
                                     fileType === 'solution' ? 'Solution File' : 
                                     fileType === 'proof' ? 'Proof of Attempt' : 
                                     fileType === 'result' ? 'Result Report' : 'File';

                return `
                    <div class="attachment-item" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--surface); border-radius: 8px; border: 1px solid var(--divider);">
                        <div class="attachment-icon" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(17, 88, 229, 0.1); border-radius: 8px;">
                            <i class="fas ${iconClass}" style="color: var(--primary); font-size: 1.2rem;"></i>
                        </div>
                        <div class="attachment-info" style="flex: 1; min-width: 0;">
                            <div class="attachment-name" style="font-weight: 600; color: var(--text); word-break: break-word;">${escapeHtml(fileName)}</div>
                            <div class="attachment-type" style="font-size: 0.85rem; color: var(--muted-text); margin-top: 4px;">${fileTypeLabel}</div>
                        </div>
                        <a href="${fileUrl}" class="download-btn" target="_blank" title="Download" style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 6px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                            <i class="fas fa-download"></i> Download
                        </a>
                    </div>
                `;
            }).join('');
        } else {
            attachmentsList.style.display = 'none';
            if (noAttachments) noAttachments.style.display = 'block';
        }
    }

    // Show cancel button only for cancellable statuses
    if (cancelBtn) {
        if (assignmentData.status === 'pending') {
            cancelBtn.style.display = 'inline-flex';
            cancelBtn.setAttribute('data-assignment-id', assignmentData.id);
        } else {
            cancelBtn.style.display = 'none';
        }
    }

    // Store assignment ID for actions from detail page
    currentAssignmentId = assignmentData.id;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusClass(status) {
    const statusMap = {
        'pending': 'pending',
        'assigned': 'assigned',
        'in-process': 'in-process',
        'completed': 'completed',
        'cancelled': 'cancelled',
        'deleted': 'deleted'
    };
    return statusMap[status] || 'pending';
}

function getStatusBadgeHTML(status) {
    const badges = {
        'pending': '<i class="fas fa-star"></i> New Submitted',
        'assigned': '<i class="fas fa-user-check"></i> Assigned',
        'in-process': '<i class="fas fa-cog fa-spin"></i> In-Process',
        'completed': '<i class="fas fa-check"></i> Completed',
        'cancelled': '<i class="fas fa-times-circle"></i> Cancelled',
        'deleted': '<i class="fas fa-trash"></i> Deleted'
    };
    return badges[status] || badges['pending'];
}

function goBackToTracker() {
    showSection('tracker');
    currentAssignmentId = null;
    currentAssignmentRow = null;
}

function showCancelConfirmation() {
    // Get assignment data from detail page
    const assignmentData = {
        id: document.getElementById('detailAssignmentId')?.textContent || '',
        title: document.getElementById('detailAssignmentTitle')?.textContent || ''
    };

    // Store assignment ID for cancel operation
    if (assignmentData.id) {
        // Extract numeric ID from assignment ID string (e.g., "ASG-2025-001" -> 1)
        const match = assignmentData.id.match(/(\d+)$/);
        if (match) {
            currentAssignmentId = parseInt(match[1]);
        } else {
            currentAssignmentId = assignmentData.id;
        }
    }

    showCancelConfirmationModal(assignmentData);
}

function downloadAttachment(filename) {
    // Simulate file download
    showTemporaryMessage(`Downloading ${filename}...`);

    // In a real implementation, this would create a download link
    // const link = document.createElement('a');
    // link.href = `/api/assignments/${currentAssignmentId}/attachments/${filename}`;
    // link.download = filename;
    // link.click();

    console.log(`Downloading attachment: ${filename}`);
}

function downloadAssignment(button) {
    const row = button.closest('.assignment-row');
    const assignmentTitle = row.querySelector('.assignment-title').textContent;

    showTemporaryMessage(`Downloading "${assignmentTitle}"...`);
    console.log(`Downloading assignment: ${assignmentTitle}`);
}

function deleteAssignment(button) {
    const row = button.closest('.assignment-row');
    const assignmentTitle = row.querySelector('.assignment-title').textContent;

    if (confirm(`Are you sure you want to permanently delete "${assignmentTitle}"? This action cannot be undone.`)) {
        // Simulate deletion
        showTemporaryMessage(`Assignment "${assignmentTitle}" has been deleted.`);

        // Remove the row from the table
        row.remove();

        console.log(`Deleted assignment: ${assignmentTitle}`);
    }
}

// Assigned Tutors Functionality
function initializeAssignedTutors() {
    // Check if tutors interface is already initialized
    if (window.tutorsInitialized) {
        return;
    }

    // Initialize tutor tabs
    initializeTutorTabs();

    // Initialize search functionality
    initializeTutorSearch();

    // Initialize tutor interactions
    initializeTutorInteractions();

    window.tutorsInitialized = true;
}

function initializeTutorTabs() {
    const tutorTabs = document.querySelectorAll('.tutor-tab-btn');

    tutorTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const tabName = this.getAttribute('data-tab');
            switchTutorTab(tabName);
        });
    });
}

function switchTutorTab(tabName) {
    // Remove active class from all tabs
    document.querySelectorAll('.tutor-tab-btn').forEach(tab => {
        tab.classList.remove('active');
    });

    // Hide all tab content
    document.querySelectorAll('.tutors-content .tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Add active class to clicked tab
    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    // Show corresponding content
    const activeContent = document.getElementById(`${tabName}Content`);
    if (activeContent) {
        activeContent.classList.add('active');
    }

    // Update search to work with current tab
    const searchInput = document.getElementById('tutorSearchInput');
    if (searchInput && searchInput.value.trim()) {
        filterTutors(searchInput.value.toLowerCase().trim());
    }

    console.log(`Switched to ${tabName} tutors tab`);
}

function initializeTutorSearch() {
    const searchInput = document.getElementById('tutorSearchInput');

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase().trim();
            filterTutors(searchTerm);
        });
    }
}

function filterTutors(searchTerm) {
    // Get the currently active tab content
    const activeTabContent = document.querySelector('.tutors-content .tab-content.active');
    if (!activeTabContent) return;

    const tutorCards = activeTabContent.querySelectorAll('.tutor-card');

    tutorCards.forEach(card => {
        const tutorName = card.getAttribute('data-name').toLowerCase();
        const course = card.getAttribute('data-course').toLowerCase();
        const assignment = card.getAttribute('data-assignment').toLowerCase();

        const matchesSearch = tutorName.includes(searchTerm) ||
            course.includes(searchTerm) ||
            assignment.includes(searchTerm);

        if (matchesSearch || searchTerm === '') {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

function initializeTutorInteractions() {
    // Tutor interactions are handled by onclick handlers in HTML
    // This function can be extended for additional functionality
}

// Tutor Action Functions (called from HTML onclick handlers)
function startChat(tutorName) {
    // Find the chat button for this tutor
    const tutorCards = document.querySelectorAll('.tutor-card');
    let chatButton = null;

    tutorCards.forEach(card => {
        if (card.getAttribute('data-name') === tutorName) {
            chatButton = card.querySelector('.chat-btn');
        }
    });

    // Check if chat is active or inactive
    if (chatButton && chatButton.classList.contains('inactive')) {
        showTemporaryMessage(`Chat with ${tutorName} is currently unavailable. Please try again later.`);
        return;
    }

    showTemporaryMessage(`Starting chat with ${tutorName}...`);

    // In a real app, this would open a chat interface
    // For now, we'll simulate opening the messages section
    setTimeout(() => {
        switchSection('messages');
    }, 1000);

    console.log(`Started chat with: ${tutorName}`);
}

// This function is now replaced by the viewAssignment function above that handles assignment IDs
// Keeping this for backward compatibility but it should not be used
function viewAssignmentOld(assignmentName) {
    showTemporaryMessage(`Viewing assignment: ${assignmentName}`);

    // In a real app, this would open assignment details
    // For now, we'll simulate opening the assignment tracker
    setTimeout(() => {
        switchSection('tracker');
    }, 1000);

    console.log(`Viewing assignment: ${assignmentName}`);
}

// Payment History Functions
function viewPaymentDetails(transactionId) {
    // Simulate getting payment details (in real app, fetch from server)
    const paymentDetails = {
        'TX-2024-001': {
            id: 'TX-2024-001',
            date: 'Jan 15, 2024',
            assignment: 'Research Paper - Data Science',
            tutor: 'Dr. Amelia Harper',
            amount: 250.00,
            status: 'Completed',
            method: 'Credit Card',
            card: '**** **** **** 4242'
        },
        'TX-2024-002': {
            id: 'TX-2024-002',
            date: 'Jan 10, 2024',
            assignment: 'Essay Writing - Literature',
            tutor: 'Ms. Olivia Carter',
            amount: 180.00,
            status: 'Completed',
            method: 'Credit Card',
            card: '**** **** **** 4242'
        },
        'TX-2024-003': {
            id: 'TX-2024-003',
            date: 'Jan 8, 2024',
            assignment: 'Math Problem Solving',
            tutor: 'Dr. Ethan Bennett',
            amount: 320.00,
            status: 'Completed',
            method: 'PayPal',
            card: 'N/A'
        },
        'TX-2024-004': {
            id: 'TX-2024-004',
            date: 'Jan 20, 2024',
            assignment: 'Chemistry Lab Report',
            tutor: 'Dr. Noah Davis',
            amount: 200.00,
            status: 'Pending',
            method: 'Credit Card',
            card: '**** **** **** 4242'
        },
        'TX-2024-005': {
            id: 'TX-2024-005',
            date: 'Jan 5, 2024',
            assignment: 'Physics Homework Set',
            tutor: 'Dr. Ethan Bennett',
            amount: 150.00,
            status: 'Completed',
            method: 'Credit Card',
            card: '**** **** **** 4242'
        }
    };

    const details = paymentDetails[transactionId];
    if (!details) {
        showTemporaryMessage('Payment details not found');
        return;
    }

    // Build modal content
    const modalContent = `
        <div class="payment-detail-item">
            <span class="payment-detail-label">Transaction ID</span>
            <span class="payment-detail-value">${details.id}</span>
        </div>
        <div class="payment-detail-item">
            <span class="payment-detail-label">Date</span>
            <span class="payment-detail-value">${details.date}</span>
        </div>
        <div class="payment-detail-item">
            <span class="payment-detail-label">Assignment</span>
            <span class="payment-detail-value">${details.assignment}</span>
        </div>
        <div class="payment-detail-item">
            <span class="payment-detail-label">Tutor</span>
            <span class="payment-detail-value">${details.tutor}</span>
        </div>
        <div class="payment-detail-item">
            <span class="payment-detail-label">Payment Method</span>
            <span class="payment-detail-value">${details.method}</span>
        </div>
        <div class="payment-detail-item">
            <span class="payment-detail-label">Card Number</span>
            <span class="payment-detail-value">${details.card}</span>
        </div>
        <div class="payment-detail-item">
            <span class="payment-detail-label">Amount</span>
            <span class="payment-detail-value amount">$${details.amount.toFixed(2)}</span>
        </div>
        <div class="payment-detail-item">
            <span class="payment-detail-label">Status</span>
            <span class="payment-detail-value status">${details.status}</span>
        </div>
    `;

    // Update modal content
    const modalContentElement = document.getElementById('paymentDetailsContent');
    if (modalContentElement) {
        modalContentElement.innerHTML = modalContent;
    }

    // Show modal
    const modal = document.getElementById('paymentDetailsModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    showTemporaryMessage(`Viewing payment details for ${transactionId}`);
}

function closePaymentDetailsModal() {
    const modal = document.getElementById('paymentDetailsModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function downloadReceipt(transactionId) {
    // Simulate downloading receipt
    showTemporaryMessage(`Downloading receipt for ${transactionId}...`);

    // In a real app, this would trigger a download
    setTimeout(() => {
        showTemporaryMessage(`Receipt for ${transactionId} downloaded successfully!`);
    }, 1500);
}

function exportPaymentHistory() {
    showTemporaryMessage('Exporting payment history...');

    // In a real app, this would export payment history to CSV or PDF
    setTimeout(() => {
        showTemporaryMessage('Payment history exported successfully!');
    }, 1500);
}

// ============ Writing Requests Tracker (inline detail view) ============
if (typeof WRITING_STORAGE_KEY === 'undefined') { var WRITING_STORAGE_KEY = 'demo_writings_records_v2'; }

function seedWritingRecords() {
    return [
        {
            writing_id: 'WR-2025-001',
            assignment_code: 'ASG-2025-001',
            assignment_id: 1,
            title: 'Literature Review - Climate Policy',
            status: 'reviewing',
            student_excerpt: 'Need a concise literature review covering climate policy shifts since 2018...',
            assignment_details: {
                title: 'Literature Review - Climate Policy',
                type: 'Analytical Essay',
                academicLevel: 'Graduate',
                pages: '8-10',
                dueDate: '2025-02-15',
                studentName: 'Alex Johnson',
                teacher: 'Dr. Sarah Chen'
            },
            messages: [
                {
                    id: 1,
                    role: 'student',
                    sender: 'You',
                    content: 'I need help with a literature review on climate policy. Here\'s my initial draft and requirements.',
                    attachments: ['draft_v1.pdf'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 24).toISOString()
                },
                {
                    id: 2,
                    role: 'teacher',
                    sender: 'Dr. Sarah Chen',
                    content: 'Thank you for the draft. I\'ve reviewed it and here are my initial thoughts:\n\n1. The introduction needs a stronger thesis statement\n2. Add 3-5 more recent references (2020-2024)\n3. Consider organizing by policy themes rather than chronologically\n\nI\'ll work on the revision and send it back within 24 hours.',
                    attachments: ['review_notes.pdf'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 20).toISOString()
                },
                {
                    id: 3,
                    role: 'student',
                    sender: 'You',
                    content: 'Thanks for the feedback! Could you also focus more on the economic impacts section?',
                    timestamp: new Date(Date.now() - 3600 * 1000 * 18).toISOString()
                },
                {
                    id: 4,
                    role: 'teacher',
                    sender: 'Dr. Sarah Chen',
                    content: 'Absolutely! I\'ve expanded the economic impacts section significantly. Here\'s the revised version with all requested changes.',
                    attachments: ['revised_draft_v2.pdf'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 6).toISOString()
                }
            ],
            final_file_url: null,
            updated_at: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
            created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
            student_feedback: null,
            is_locked: false
        },
        {
            writing_id: 'WR-2025-002',
            assignment_code: 'ASG-2025-014',
            assignment_id: 14,
            title: 'Personal Statement Editing',
            status: 'completed',
            student_excerpt: 'Personal statement for MSCS application with focus on AI safety.',
            assignment_details: {
                title: 'Personal Statement Editing',
                type: 'Personal Statement',
                academicLevel: 'Graduate',
                pages: '2',
                dueDate: '2025-01-20',
                studentName: 'Emma Wilson',
                teacher: 'Ms. Olivia Carter'
            },
            messages: [
                {
                    id: 1,
                    role: 'student',
                    sender: 'You',
                    content: 'I\'ve attached my personal statement draft. Please help me refine it for my MSCS application.',
                    attachments: ['personal_statement_draft.docx'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 48).toISOString()
                },
                {
                    id: 2,
                    role: 'teacher',
                    sender: 'Ms. Olivia Carter',
                    content: 'I\'ve reviewed your statement. Here\'s the polished version with:\n- Grammar and style improvements\n- Stronger narrative flow\n- Better emphasis on your AI safety research\n- Highlighted your internship outcomes\n\nPlease review and let me know if you\'d like any adjustments.',
                    attachments: ['personal_statement_revised.pdf'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 40).toISOString()
                },
                {
                    id: 3,
                    role: 'student',
                    sender: 'You',
                    content: 'This looks perfect! Thank you so much. I\'m ready to submit.',
                    timestamp: new Date(Date.now() - 3600 * 1000 * 38).toISOString()
                },
                {
                    id: 4,
                    role: 'teacher',
                    sender: 'Ms. Olivia Carter',
                    content: 'Great! I\'ve marked this assignment as completed. Best of luck with your application!',
                    timestamp: new Date(Date.now() - 3600 * 1000 * 36).toISOString()
                }
            ],
            final_file_url: 'https://example.com/final-personal-statement.pdf',
            updated_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
            created_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
            student_feedback: 'Looks great, thanks!',
            is_locked: true
        },
        {
            writing_id: 'WR-2025-003',
            assignment_code: 'ASG-2025-025',
            assignment_id: 25,
            title: 'Research Paper - Machine Learning Ethics',
            status: 'submitted',
            student_excerpt: 'Need help writing a research paper on ethical considerations in machine learning applications.',
            assignment_details: {
                title: 'Research Paper - Machine Learning Ethics',
                type: 'Research Paper',
                academicLevel: 'Undergraduate',
                pages: '12-15',
                dueDate: '2025-02-28',
                studentName: 'Michael Brown',
                teacher: 'Dr. Sarah Chen'
            },
            messages: [
                {
                    id: 1,
                    role: 'student',
                    sender: 'Michael Brown',
                    content: 'I\'ve submitted my research paper topic and initial outline. Could you help me develop the arguments and structure?',
                    attachments: ['research_outline.docx'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 12).toISOString()
                }
            ],
            final_file_url: null,
            updated_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
            created_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
            student_feedback: null,
            is_locked: false
        },
        {
            writing_id: 'WR-2025-004',
            assignment_code: 'ASG-2025-030',
            assignment_id: 30,
            title: 'Essay on Shakespeare\'s Hamlet',
            status: 'revision',
            student_excerpt: 'Literary analysis essay focusing on themes of madness and revenge in Hamlet.',
            assignment_details: {
                title: 'Essay on Shakespeare\'s Hamlet',
                type: 'Literary Analysis',
                academicLevel: 'High School',
                pages: '5-7',
                dueDate: '2025-02-10',
                studentName: 'Sarah Davis',
                teacher: 'Ms. Olivia Carter'
            },
            messages: [
                {
                    id: 1,
                    role: 'student',
                    sender: 'Sarah Davis',
                    content: 'Here\'s my first draft of the Hamlet essay. Please review and provide feedback.',
                    attachments: ['hamlet_essay_draft.pdf'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 36).toISOString()
                },
                {
                    id: 2,
                    role: 'teacher',
                    sender: 'Ms. Olivia Carter',
                    content: 'Good start! However, I noticed a few areas that need improvement:\n\n1. Strengthen the thesis statement - be more specific about your argument\n2. Add more textual evidence from the play\n3. Expand the analysis of Ophelia\'s character\n4. Fix citation format (use MLA style)\n\nI\'ve attached a revised version with comments. Please review and let me know if you have questions.',
                    attachments: ['hamlet_essay_reviewed.pdf', 'citation_guide.pdf'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 30).toISOString()
                },
                {
                    id: 3,
                    role: 'student',
                    sender: 'Sarah Davis',
                    content: 'Thank you for the detailed feedback! I\'m working on the revisions now. Should I focus more on the psychological aspects of Hamlet\'s madness?',
                    timestamp: new Date(Date.now() - 3600 * 1000 * 24).toISOString()
                },
                {
                    id: 4,
                    role: 'teacher',
                    sender: 'Ms. Olivia Carter',
                    content: 'Yes, that would be excellent! The psychological analysis is a strong angle. Make sure to connect it to the revenge theme throughout.',
                    timestamp: new Date(Date.now() - 3600 * 1000 * 20).toISOString()
                }
            ],
            final_file_url: null,
            updated_at: new Date(Date.now() - 3600 * 1000 * 20).toISOString(),
            created_at: new Date(Date.now() - 3600 * 1000 * 36).toISOString(),
            student_feedback: null,
            is_locked: false
        },
        {
            writing_id: 'WR-2025-005',
            assignment_code: 'ASG-2025-042',
            assignment_id: 42,
            title: 'Case Study Analysis - Business Strategy',
            status: 'reviewing',
            student_excerpt: 'Case study analysis of a tech startup\'s business strategy and market positioning.',
            assignment_details: {
                title: 'Case Study Analysis - Business Strategy',
                type: 'Case Study',
                academicLevel: 'Graduate',
                pages: '10-12',
                dueDate: '2025-03-05',
                studentName: 'Jessica Martinez',
                teacher: 'Dr. Sarah Chen'
            },
            messages: [
                {
                    id: 1,
                    role: 'student',
                    sender: 'Jessica Martinez',
                    content: 'I\'ve completed the case study analysis. Could you review it for clarity and depth?',
                    attachments: ['case_study_analysis.pdf'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 8).toISOString()
                },
                {
                    id: 2,
                    role: 'teacher',
                    sender: 'Dr. Sarah Chen',
                    content: 'I\'ve reviewed your case study. Overall, it\'s well-structured. Here are my suggestions:\n\n1. Add more quantitative data to support your analysis\n2. Include a SWOT analysis section\n3. Expand the competitive analysis\n4. Strengthen the recommendations section\n\nI\'ll work on enhancing these sections and send you an updated version.',
                    attachments: ['case_study_feedback.pdf'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 4).toISOString()
                }
            ],
            final_file_url: null,
            updated_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
            created_at: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
            student_feedback: null,
            is_locked: false
        },
        {
            writing_id: 'WR-2025-006',
            assignment_code: 'ASG-2025-055',
            assignment_id: 55,
            title: 'Argumentative Essay - Climate Change Policy',
            status: 'submitted',
            student_excerpt: 'Argumentative essay arguing for stronger climate change policies at the federal level.',
            assignment_details: {
                title: 'Argumentative Essay - Climate Change Policy',
                type: 'Argumentative Essay',
                academicLevel: 'Undergraduate',
                pages: '6-8',
                dueDate: '2025-02-20',
                studentName: 'David Lee',
                teacher: 'Dr. Michael Johnson'
            },
            messages: [
                {
                    id: 1,
                    role: 'student',
                    sender: 'David Lee',
                    content: 'I\'ve submitted my argumentative essay draft. I\'d appreciate your feedback on the argument structure and evidence.',
                    attachments: ['climate_essay_draft.docx'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 2).toISOString()
                }
            ],
            final_file_url: null,
            updated_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
            created_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
            student_feedback: null,
            is_locked: false
        },
        {
            writing_id: 'WR-2025-007',
            assignment_code: 'ASG-2025-061',
            assignment_id: 61,
            title: 'Dissertation Chapter - Literature Review',
            status: 'reviewing',
            student_excerpt: 'Literature review chapter for PhD dissertation on renewable energy technologies.',
            assignment_details: {
                title: 'Dissertation Chapter - Literature Review',
                type: 'Dissertation Chapter',
                academicLevel: 'Doctorate',
                pages: '25-30',
                dueDate: '2025-03-15',
                studentName: 'Emily Watson',
                teacher: 'Dr. Sarah Chen'
            },
            messages: [
                {
                    id: 1,
                    role: 'student',
                    sender: 'Emily Watson',
                    content: 'I\'ve completed the first draft of my literature review chapter. This is a critical part of my dissertation, so I\'d really appreciate thorough feedback.',
                    attachments: ['lit_review_chapter_v1.pdf'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 16).toISOString()
                },
                {
                    id: 2,
                    role: 'teacher',
                    sender: 'Dr. Sarah Chen',
                    content: 'I\'ve reviewed your literature review. It\'s comprehensive, but here are key areas to strengthen:\n\n1. The theoretical framework section needs more depth\n2. Add more recent studies (2023-2024)\n3. Strengthen the gap analysis\n4. Improve transitions between sections\n\nI\'m working on a detailed revision with annotations. This will take a bit longer given the scope - expect it within 48 hours.',
                    attachments: ['lit_review_feedback.pdf'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 10).toISOString()
                },
                {
                    id: 3,
                    role: 'student',
                    sender: 'Emily Watson',
                    content: 'Thank you! I understand this is a large piece. I\'ll wait for your detailed feedback.',
                    timestamp: new Date(Date.now() - 3600 * 1000 * 9).toISOString()
                }
            ],
            final_file_url: null,
            updated_at: new Date(Date.now() - 3600 * 1000 * 10).toISOString(),
            created_at: new Date(Date.now() - 3600 * 1000 * 16).toISOString(),
            student_feedback: null,
            is_locked: false
        },
        {
            writing_id: 'WR-2025-008',
            assignment_code: 'ASG-2025-068',
            assignment_id: 68,
            title: 'Lab Report - Chemistry Experiment',
            status: 'completed',
            student_excerpt: 'Lab report documenting acid-base titration experiment results.',
            assignment_details: {
                title: 'Lab Report - Chemistry Experiment',
                type: 'Lab Report',
                academicLevel: 'Undergraduate',
                pages: '4-5',
                dueDate: '2025-01-25',
                studentName: 'Ryan Thompson',
                teacher: 'Dr. Michael Johnson'
            },
            messages: [
                {
                    id: 1,
                    role: 'student',
                    sender: 'Ryan Thompson',
                    content: 'I\'ve completed my lab report. Could you review it for accuracy and formatting?',
                    attachments: ['lab_report_chemistry.pdf'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 72).toISOString()
                },
                {
                    id: 2,
                    role: 'teacher',
                    sender: 'Dr. Michael Johnson',
                    content: 'Your lab report looks good! I\'ve made minor corrections to:\n- Calculation formatting\n- Graph labels\n- Conclusion section\n\nThe final version is attached. Great work on the data analysis!',
                    attachments: ['lab_report_final.pdf'],
                    timestamp: new Date(Date.now() - 3600 * 1000 * 68).toISOString()
                },
                {
                    id: 3,
                    role: 'student',
                    sender: 'Ryan Thompson',
                    content: 'Perfect! Thank you for the quick turnaround.',
                    timestamp: new Date(Date.now() - 3600 * 1000 * 66).toISOString()
                },
                {
                    id: 4,
                    role: 'teacher',
                    sender: 'Dr. Michael Johnson',
                    content: 'You\'re welcome! Marking this as completed.',
                    timestamp: new Date(Date.now() - 3600 * 1000 * 64).toISOString()
                }
            ],
            final_file_url: 'https://example.com/lab_report_final.pdf',
            updated_at: new Date(Date.now() - 3600 * 1000 * 64).toISOString(),
            created_at: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
            student_feedback: 'Very helpful feedback!',
            is_locked: true
        }
    ];
}

function loadWritingRecords() {
    try {
        // First, try to get from localStorage
        const stored = localStorage.getItem(WRITING_STORAGE_KEY);
        if (stored && stored !== '[]' && stored !== 'null') {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            } catch (e) {
                console.warn('Failed to parse stored writing records:', e);
            }
        }

        // If no stored data, seed it from seedWritingRecords()
        if (typeof seedWritingRecords === 'function') {
            const seeded = seedWritingRecords();
            saveWritingRecords(seeded);
            return seeded;
        }

        // Return empty array as fallback
        return [];
    } catch (error) {
        console.error('Failed to load writing records:', error);
        return [];
    }
}

function saveWritingRecords(records) {
    try {
        localStorage.setItem(WRITING_STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
        console.error('Failed to persist writing records:', error);
    }
}

function initializeWritingTab() {
    if (!window.writingTabInitialized) {
        const filters = document.querySelectorAll('#writingFilters .filter-pill');
        filters.forEach(btn => {
            btn.addEventListener('click', () => {
                filters.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filter = btn.getAttribute('data-filter') || 'all';
                renderWritingTable(filter);
            });
        });
        window.writingTabInitialized = true;
    }
    renderWritingTable();
}

function renderWritingTable(filter = 'all') {
    const tbody = document.querySelector('#writingTable tbody');
    const emptyState = document.getElementById('writingEmptyState');
    const totalCount = document.getElementById('writingTotalCount');
    const tableWrapper = document.querySelector('#writingTable').closest('.table-wrapper');
    const detailView = document.getElementById('writingDetailView');

    if (!tbody) return;

    const records = loadWritingRecords();
    if (totalCount) {
        totalCount.textContent = `${records.length} writing${records.length === 1 ? '' : 's'}`;
    }

    const filtered = records.filter(rec => filter === 'all' || rec.status === filter);

    const assignmentInfo = document.getElementById('writingAssignmentInfo');
    const viewBody = document.getElementById('writingViewBody');

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--muted);">No writings match this filter.</td></tr>';
        if (emptyState) emptyState.style.display = filter === 'all' ? 'block' : 'none';
        if (tableWrapper) tableWrapper.style.display = filter === 'all' ? 'none' : 'table';
        if (detailView) detailView.style.display = 'none';
        if (assignmentInfo) assignmentInfo.style.display = 'none';
        if (viewBody) viewBody.style.display = 'none';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tableWrapper) tableWrapper.style.display = 'table';
    if (detailView) detailView.style.display = 'none';
    if (assignmentInfo) assignmentInfo.style.display = 'none';
    if (viewBody) viewBody.style.display = 'none';

    tbody.innerHTML = filtered.map(rec => {
        const statusBadge = `<span class="writing-status-badge ${rec.status}"><i class="fas fa-circle"></i> ${formatWritingStatus(rec.status)}</span>`;
        const updated = rec.updated_at ? new Date(rec.updated_at).toLocaleString() : '—';
        const dueDate = rec.assignment_details?.dueDate
            ? new Date(rec.assignment_details.dueDate).toLocaleDateString()
            : '—';
        const assignmentCode = rec.assignment_code || rec.writing_id;
        return `
            <tr data-writing-id="${rec.writing_id}">
                <td><code>${assignmentCode}</code></td>
                <td>${rec.title}</td>
                <td>${statusBadge}</td>
                <td>${dueDate}</td>
                <td>${updated}</td>
                <td><button class="action-btn view-btn" onclick="viewWritingDetail('${rec.writing_id}')" title="View Details"><i class="fas fa-arrow-right"></i></button></td>
            </tr>
        `;
    }).join('');
}

function formatWritingStatus(status) {
    const map = {
        submitted: 'Submitted',
        reviewing: 'In Review',
        revision: 'Revision',
        completed: 'Completed'
    };
    return map[status] || status;
}

function showWritingList() {
    const detailView = document.getElementById('writingDetailView');
    const assignmentInfo = document.getElementById('writingAssignmentInfo');
    const viewBody = document.getElementById('writingViewBody');
    const tableWrapper = document.querySelector('#writingTable').closest('.table-wrapper');
    const filters = document.getElementById('writingFilters');
    const header = document.querySelector('#writingsSection .section-header');

    if (detailView) detailView.style.display = 'none';
    if (assignmentInfo) assignmentInfo.style.display = 'none';
    if (viewBody) viewBody.style.display = 'none';
    if (tableWrapper) tableWrapper.style.display = 'table';
    if (filters) filters.style.display = 'flex';
    if (header) header.style.display = 'flex';
}

function viewWritingDetail(writingId) {
    const records = loadWritingRecords();
    const record = records.find(r => r.writing_id === writingId);
    if (!record) {
        alert('Writing not found.');
        return;
    }

    // Hide list view, show detail view
    const detailView = document.getElementById('writingDetailView');
    const assignmentInfo = document.getElementById('writingAssignmentInfo');
    const viewBody = document.getElementById('writingViewBody');
    const tableWrapper = document.querySelector('#writingTable').closest('.table-wrapper');
    const filters = document.getElementById('writingFilters');
    const header = document.querySelector('#writingsSection .section-header');

    if (tableWrapper) tableWrapper.style.display = 'none';
    if (filters) filters.style.display = 'none';
    if (header) header.style.display = 'none';
    if (detailView) detailView.style.display = 'block';
    if (assignmentInfo) assignmentInfo.style.display = 'block';
    if (viewBody) viewBody.style.display = 'flex';

    // Populate header
    document.getElementById('writingViewTitle').textContent = record.title;
    document.getElementById('writingViewStatus').textContent = formatWritingStatus(record.status);
    document.getElementById('writingViewStatus').className = `writing-status-badge ${record.status}`;
    document.getElementById('writingViewAssignmentCode').textContent = record.assignment_code;

    // Populate assignment details
    const details = record.assignment_details || {};
    document.getElementById('writingAssignmentTitle').textContent = details.title || record.title;
    document.getElementById('writingAssignmentType').textContent = details.type || '—';
    document.getElementById('writingAcademicLevel').textContent = details.academicLevel || '—';
    document.getElementById('writingPages').textContent = details.pages || '—';
    document.getElementById('writingDueDate').textContent = details.dueDate ? new Date(details.dueDate).toLocaleDateString() : '—';
    document.getElementById('writingTeacherName').textContent = details.teacher || '—';

    // Render messages
    renderWritingMessages(record.messages || [], writingId);

    // Handle composer visibility
    const composer = document.getElementById('writingComposer');
    const composerNote = document.getElementById('writingComposerNote');
    const replyInput = document.getElementById('writingReplyInput');
    const sendBtn = document.getElementById('writingSendBtn');
    const attachBtn = document.getElementById('writingAttachBtn');
    const fileInput = document.getElementById('writingFileInput');
    const feedbackSection = document.getElementById('writingFeedbackSection');

    if (record.is_locked || record.status === 'completed') {
        if (composerNote) composerNote.style.display = 'flex';
        if (replyInput) replyInput.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
        if (attachBtn) attachBtn.disabled = true;
        if (composer) composer.style.opacity = '0.6';
        if (feedbackSection) feedbackSection.style.display = 'block';
        if (document.getElementById('writingFinalFeedback')) {
            document.getElementById('writingFinalFeedback').value = record.student_feedback || '';
        }
    } else {
        if (composerNote) composerNote.style.display = 'none';
        if (replyInput) replyInput.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        if (attachBtn) attachBtn.disabled = false;
        if (composer) composer.style.opacity = '1';
        if (feedbackSection) feedbackSection.style.display = 'none';
    }

    // Note: File attachment and Enter key handlers are set up in writings.html initWritingComposer()
    // Don't override them here to avoid conflicts

    // Store current writing ID for message sending
    window.currentWritingId = writingId;
}

// Global store for file URLs (writingId -> messageId -> fileUrls)
window.writingFileUrls = window.writingFileUrls || {};

function renderWritingMessages(messages, writingId) {
    const container = document.getElementById('writingMessagesContainer');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:2rem;">No messages yet. Start the conversation!</p>';
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isStudent = msg.role === 'student';
        const time = new Date(msg.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        // Get file URLs for this message if available
        const fileUrls = writingId && window.writingFileUrls[writingId] && window.writingFileUrls[writingId][msg.id]
            ? window.writingFileUrls[writingId][msg.id]
            : null;

        // Use attachmentData if available (has type info), otherwise use attachments (just names)
        const attachmentList = msg.attachmentData || (msg.attachments || []).map(name => ({ name }));

        const attachmentsHtml = attachmentList && attachmentList.length > 0
            ? `<div class="writing-message-attachments">
                ${attachmentList.map((att, index) => {
                // If we have a file URL, use it; otherwise create a placeholder
                const fileUrl = fileUrls && fileUrls[index] ? fileUrls[index] : '#';
                const hasUrl = fileUrl !== '#';
                const fileName = typeof att === 'string' ? att : (att.name || att);
                const fileType = typeof att === 'object' && att.type ? att.type : '';

                // Get file icon based on type or extension
                let icon = 'fa-paperclip';
                if (fileType) {
                    if (fileType.startsWith('image/')) icon = 'fa-image';
                    else if (fileType.startsWith('video/')) icon = 'fa-video';
                    else if (fileType.startsWith('audio/')) icon = 'fa-file-audio';
                    else if (fileType === 'application/pdf') icon = 'fa-file-pdf';
                    else if (fileType.includes('word') || fileType.includes('document')) icon = 'fa-file-word';
                    else if (fileType.includes('zip') || fileType.includes('rar')) icon = 'fa-file-archive';
                } else if (fileName) {
                    const ext = fileName.split('.').pop().toLowerCase();
                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) icon = 'fa-image';
                    else if (['mp4', 'avi', 'mov', 'wmv'].includes(ext)) icon = 'fa-video';
                    else if (['mp3', 'wav', 'ogg'].includes(ext)) icon = 'fa-file-audio';
                    else if (ext === 'pdf') icon = 'fa-file-pdf';
                    else if (['doc', 'docx'].includes(ext)) icon = 'fa-file-word';
                    else if (['zip', 'rar', '7z'].includes(ext)) icon = 'fa-file-archive';
                }

                return `
                        <a href="${fileUrl}" ${hasUrl ? 'target="_blank" rel="noopener noreferrer"' : 'onclick="event.preventDefault(); return false;"'} 
                           class="attachment-item" 
                           ${hasUrl ? 'title="Click to open in new tab"' : 'title="File not available"'} 
                           style="cursor: ${hasUrl ? 'pointer' : 'not-allowed'}; opacity: ${hasUrl ? '1' : '0.6'};">
                            <i class="fas ${icon}"></i> ${fileName}
                        </a>
                    `;
            }).join('')}
               </div>`
            : '';

        return `
            <div class="writing-message ${isStudent ? 'student' : 'teacher'}">
                <div class="writing-message-header">
                    <span class="writing-message-sender">${msg.sender}</span>
                    <span class="writing-message-role">${isStudent ? 'Student' : 'Teacher'}</span>
                    <span class="writing-message-time">${time}</span>
                </div>
                <div class="writing-message-content">${msg.content.replace(/\n/g, '<br>')}</div>
                ${attachmentsHtml}
            </div>
        `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}


function submitWritingFeedback() {
    const writingId = window.currentWritingId;
    if (!writingId) {
        alert('No writing selected.');
        return;
    }

    const feedbackInput = document.getElementById('writingFinalFeedback');
    const feedback = feedbackInput.value.trim();
    if (!feedback) {
        alert('Please add feedback before submitting.');
        return;
    }

    const records = loadWritingRecords();
    const record = records.find(r => r.writing_id === writingId);
    if (!record) {
        alert('Writing not found.');
        return;
    }

    record.student_feedback = feedback;
    record.updated_at = new Date().toISOString();

    saveWritingRecords(records);

    showTemporaryMessage('Feedback submitted successfully!');
}

function addWritingFromAssignment(assignmentData, apiResponse = {}) {
    try {
        const records = loadWritingRecords();
        const assignmentId = apiResponse.assignment_id || apiResponse.id || assignmentData.assignment_id;
        const writingId = apiResponse.assignment_code || `WR-${Date.now()}`;

        // Check if record already exists
        const existing = records.find(r => r.assignment_id === assignmentId || r.writing_id === writingId);
        if (existing) {
            console.log('Writing record already exists for this assignment');
            return;
        }

        const metadata = assignmentData.metadata || {};
        const newRecord = {
            writing_id: writingId,
            assignment_code: apiResponse.assignment_code || writingId,
            assignment_id: assignmentId,
            title: assignmentData.title || 'Writing Assignment',
            status: 'submitted',
            student_excerpt: assignmentData.description || metadata.serviceDetails || 'Student submission attached.',
            assignment_details: {
                title: assignmentData.title || 'Writing Assignment',
                type: metadata.writingType || metadata.paperType || 'General Writing',
                academicLevel: metadata.academicLevel || '—',
                pages: metadata.numberOfPages || '—',
                dueDate: assignmentData.due_date || '—',
                teacher: '—'
            },
            messages: [
                {
                    id: 1,
                    role: 'student',
                    sender: 'You',
                    content: assignmentData.description || metadata.serviceDetails || 'I have submitted my writing assignment. Please review.',
                    attachments: [],
                    timestamp: new Date().toISOString()
                }
            ],
            final_file_url: null,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            student_feedback: null,
            is_locked: false
        };

        records.unshift(newRecord); // Add to beginning
        saveWritingRecords(records);

        // Refresh table if writings tab is visible
        const writingsSection = document.getElementById('writingsSection');
        if (writingsSection && writingsSection.classList.contains('active')) {
            renderWritingTable();
        }
    } catch (error) {
        console.error('Failed to create writing record:', error);
    }
}

// Expose functions for HTML onclick handlers
window.viewWritingDetail = viewWritingDetail;
window.showWritingList = showWritingList;
// sendWritingMessage is now defined in writings.html
window.submitWritingFeedback = submitWritingFeedback;

// ===================== Student Threads (simple mock handlers) =====================

function showCreateThreadModal() {
    const modal = document.getElementById('createThreadModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeCreateThreadModal() {
    const modal = document.getElementById('createThreadModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        const form = document.getElementById('createThreadForm');
        if (form) {
            form.reset();
        }
    }
}

function submitCreateThread() {
    if (window.StudyThreads && typeof window.StudyThreads.submitCreateThread === 'function') {
        window.StudyThreads.submitCreateThread();
    }
}

function openThread(threadId) {
    if (window.StudyThreads && typeof window.StudyThreads.openThread === 'function') {
        window.StudyThreads.openThread(threadId);
    }
}

function filterThreads(filter) {
    const threadCards = document.querySelectorAll('.thread-card');
    threadCards.forEach(card => {
        if (filter === 'all') {
            card.style.display = 'block';
        } else {
            const threadType = card.dataset.threadType;
            const threadStatus = card.dataset.status;
            if (filter === threadType || filter === threadStatus) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        }
    });
}

function showThreadList() {
    const list = document.getElementById('threadsList');
    const detail = document.getElementById('threadDetailView');
    if (detail) detail.style.display = 'none';
    if (list) list.style.display = 'grid';
}

function sendThreadReply() {
    if (window.StudyThreads && typeof window.StudyThreads.sendMessage === 'function') {
        window.StudyThreads.sendMessage();
    }
}

// Initialize thread filters and modal behavior when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Thread filters on the Threads tab
    const threadFilterPills = document.querySelectorAll('#threadsSection .filter-pill');
    if (threadFilterPills.length) {
        threadFilterPills.forEach(pill => {
            pill.addEventListener('click', function () {
                threadFilterPills.forEach(p => p.classList.remove('active'));
                this.classList.add('active');
                const filter = this.dataset.filter || 'all';
                filterThreads(filter);
            });
        });
    }

    // Thread type selection in create-thread modal
    const threadTypeSelect = document.getElementById('threadType');
    if (threadTypeSelect) {
        threadTypeSelect.addEventListener('change', function () {
            const assignmentField = document.getElementById('relatedAssignmentField');
            const invoiceField = document.getElementById('relatedInvoiceField');
            const studentSelectField = document.getElementById('studentSelectField');

            if (this.value === 'assignment') {
                if (assignmentField) assignmentField.style.display = 'block';
                if (invoiceField) invoiceField.style.display = 'none';
                if (studentSelectField) studentSelectField.style.display = (window.currentUserRole === 'ADMIN' || window.currentUserRole === 'CS_REP') ? 'block' : 'none';
            } else if (this.value === 'invoice') {
                if (assignmentField) assignmentField.style.display = 'none';
                if (invoiceField) invoiceField.style.display = 'block';
                if (studentSelectField) studentSelectField.style.display = 'none';
            } else {
                if (assignmentField) assignmentField.style.display = 'none';
                if (invoiceField) invoiceField.style.display = 'none';
                if (studentSelectField) studentSelectField.style.display = 'none';
            }
        });
    }

    // Close create-thread modal when clicking on overlay
    document.addEventListener('click', function (e) {
        const modal = document.getElementById('createThreadModal');
        if (modal && e.target === modal) {
            closeCreateThreadModal();
        }
    });
});

// Exam helpers - these are now implemented in online_exam.html
// The startExam and viewResults functions are defined in the exam template
// to avoid conflicts, we only define them here if they don't already exist
if (typeof window.startExam === 'undefined') {
    window.startExam = function (examId, examType) {
        console.warn('startExam called but not properly initialized. Please ensure online_exam.html is loaded.');
    };
}

if (typeof window.viewResults === 'undefined') {
    window.viewResults = function (attemptId) {
        console.warn('viewResults called but not properly initialized. Please ensure online_exam.html is loaded.');
    };
}

window.closeResultsModal = function () { };
window.showExamDetails = function () { };
window.printExamResults = function () { };
window.downloadExamResults = function () { };

// Export functions for potential external use
window.Dashboard = {
    showSuccessMessage,
    showErrorMessage,
    showTemporaryMessage,
    handleProfileUpdate,
    handlePasswordUpdate,
    validateProfileForm,
    validatePasswordForm,
    validateField,
    validatePasswordField,
    switchSection,
    initializeMessagesInterface,
    initializeMeetingsInterface,
    initializeAssignmentTracker,
    showConfirmationModal,
    closeConfirmationModal,
    goToAssignmentTracker,
    increasePages,
    decreasePages,
    cancelAssignment,
    viewAssignment,
    downloadAssignment,
    deleteAssignment,
    switchTrackerTab,
    initializeAssignedTutors,
    initializeTutorTabs,
    switchTutorTab,
    initializeTutorSearch,
    startChat,
    filterTutors,
    initializeProfilePicture,
    togglePassword,
    viewPaymentDetails,
    closePaymentDetailsModal,
    downloadReceipt,
    exportPaymentHistory,
    initializeWritingTab,
    viewWritingDetail,
    showWritingList,
    // sendWritingMessage is defined in writings.html, not here
    submitWritingFeedback,
    goBackToTracker,
    showCancelConfirmation,
    closeCancelModal,
    confirmCancelAssignment,
    downloadAttachment,
    populateAssignmentDetail
};

async function loadAnnouncements() {
    const container = document.getElementById('announcementsList');
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
                    <div class="announcement-item ${ann.priority === 'urgent' ? 'has-important' : ''}" data-id="${ann.id}">
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

// Make functions globally available
window.cancelAssignment = cancelAssignment;
window.viewAssignment = viewAssignment;
window.viewAssignmentDetails = viewAssignment; // Alias for consistency with other dashboards
window.goBackToTracker = goBackToTracker;
window.showCancelConfirmation = showCancelConfirmation;
window.closeCancelModal = closeCancelModal;
window.confirmCancelAssignment = confirmCancelAssignment;
window.downloadAttachment = downloadAttachment;
window.loadAnnouncements = loadAnnouncements;
