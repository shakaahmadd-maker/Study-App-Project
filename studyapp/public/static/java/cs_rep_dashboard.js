// Get Django URL for loading CS Rep sections dynamically
function getCSRepSectionUrl(sectionName) {
    // Use Django URL pattern: /account/csrep/section/<section_name>/
    return `/account/csrep/section/${sectionName}/`;
}

// Use window object to prevent redeclaration errors when script loads multiple times
if (!window.csrepSectionFileMap) {
    window.csrepSectionFileMap = {
        'overview': 'overview.html',
        'preSignIn': 'pre_sign_in_chat.html',
        'communication': 'communication.html',
        'threads': 'threads.html',
        'invoices': 'invoice_management.html',
        'announcements': 'announcement.html',
        'notifications': 'notifications.html',
        'profile': 'profile.html',
        'settings': 'settings.html'
    };
}

// Cache for loaded sections
if (!window.csrepLoadedSections) {
    window.csrepLoadedSections = {};
}

// ----------------------------------------------------------------------------
// Viewport height helpers (fix composer being pushed off-screen on some layouts)
// ----------------------------------------------------------------------------
function updateCSRepViewportVars() {
    try {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--cs-vh', `${vh}px`);

        const header = document.querySelector('.top-header');
        const headerH = header ? header.offsetHeight : 60;
        document.documentElement.style.setProperty('--cs-header-h', `${headerH}px`);
    } catch (e) {
        // no-op
    }
}

// Run once and on resize/orientation changes
updateCSRepViewportVars();
window.addEventListener('resize', updateCSRepViewportVars);
window.addEventListener('orientationchange', updateCSRepViewportVars);

// Helper function to load HTML section from Django endpoint
async function loadCSRepHtmlSection(sectionName) {
    try {
        const url = getCSRepSectionUrl(sectionName);
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load section: HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load section');
        }

        return data.html;
    } catch (error) {
        console.error('Error loading section:', error);
        throw error;
    }
}

// Define openSection function - loads content dynamically from Django endpoints
async function openSection(sectionKey) {
    console.log('openSection called with:', sectionKey);

    if (!sectionKey) {
        console.error('openSection: sectionKey is empty');
        return;
    }

    // Save current section to localStorage for page refresh persistence
    localStorage.setItem('csrep_last_section', sectionKey);

    const dynamicContainer = document.getElementById('dynamicContentContainer');
    const mainContent = document.getElementById('mainContent');

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
    } catch (error) {
        console.error('Error in openSection:', error);
        return;
    }

    // Check if section exists in mapping
    const sectionExists = window.csrepSectionFileMap.hasOwnProperty(sectionKey);

    if (sectionExists) {
        // Show loading state
        if (dynamicContainer) {
            dynamicContainer.style.display = 'block';
            dynamicContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #9ca3af;"></i>
                    <p style="margin-top: 1rem; color: #9ca3af;">Loading ${sectionKey}...</p>
                </div>
            `;
        }

        try {
            // Some sections contain inline scripts and are actively iterated during development.
            // To avoid stale UI (e.g., missing buttons), we bypass the HTML cache for these sections.
            const noCacheSections = new Set(['preSignIn', 'communication', 'threads']);
            if (noCacheSections.has(sectionKey)) {
                try { delete window.csrepLoadedSections[sectionKey]; } catch (e) {}
            }

            // Check if already loaded
            let sectionHTML = window.csrepLoadedSections[sectionKey];

            if (!sectionHTML) {
                // Load the HTML section from Django endpoint
                console.log('Loading section:', sectionKey);
                console.log('Django URL:', getCSRepSectionUrl(sectionKey));

                // Fetch HTML content from Django endpoint
                let htmlContent = await loadCSRepHtmlSection(sectionKey);
                console.log(`✅ Successfully loaded ${sectionKey} from Django (${htmlContent.length} chars)`);

                // Extract scripts from the original HTML BEFORE parsing (DOMParser might strip them)
                const originalScriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
                const originalScripts = [];
                let scriptMatch;
                while ((scriptMatch = originalScriptRegex.exec(htmlContent)) !== null) {
                    const scriptTag = scriptMatch[0];
                    // Skip core scripts that are already loaded in base template
                    if (scriptTag.includes('apiClient.js') || 
                        scriptTag.includes('cs_rep_dashboard.js') || 
                        scriptTag.includes('toastNotifications.js') ||
                        scriptTag.includes('chatIntegration.js')) {
                        continue;
                    }
                    originalScripts.push(scriptTag);
                }

                // Extract content from the loaded HTML (Django renders the full template)
                // Find the content section in the loaded HTML (same approach as student/admin dashboard)
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlContent, 'text/html');
                const contentSection = doc.querySelector('.content-section, section[id$="Section"]');
                console.log('Content section found:', contentSection ? 'Yes' : 'No');

                if (contentSection) {
                    sectionHTML = contentSection.outerHTML;
                    console.log(`Extracted content section (${sectionHTML.length} chars)`);
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
                    }
                } else {
                    // If no section found, try to get content from main element
                    const mainElement = doc.querySelector('main.main-content, main');
                    if (mainElement) {
                        // Get content from main, excluding header/sidebar
                        const mainContent = mainElement.querySelector('#dynamicContentContainer, .main-content');
                        if (mainContent) {
                            sectionHTML = mainContent.innerHTML;
                        } else {
                            // Clone main and remove header/sidebar
                            const mainClone = mainElement.cloneNode(true);
                            const header = mainClone.querySelector('header, .top-header');
                            const sidebar = mainClone.querySelector('aside, .sidebar');
                            if (header) header.remove();
                            if (sidebar) sidebar.remove();
                            sectionHTML = mainClone.innerHTML;
                        }
                        // Re-insert scripts
                        if (originalScripts.length > 0) {
                            sectionHTML += originalScripts.join('\n');
                        }
                    } else {
                        // Fallback: try to get the body content
                        const bodyContent = doc.body ? doc.body.innerHTML : '';
                        if (bodyContent) {
                            sectionHTML = bodyContent;
                            // Re-insert scripts
                            if (originalScripts.length > 0) {
                                sectionHTML += originalScripts.join('\n');
                            }
                        } else {
                            // Last resort: use HTML as-is (shouldn't happen)
                            console.warn('Could not extract content section, using full HTML');
                            sectionHTML = htmlContent;
                        }
                    }
                }

                // Cache the processed HTML
                window.csrepLoadedSections[sectionKey] = sectionHTML;
            }

            // Insert the loaded HTML into the dynamic container
            if (dynamicContainer) {
                // Extract and execute scripts BEFORE setting innerHTML
                const scriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
                const scriptMatches = [];
                let match;
                scriptRegex.lastIndex = 0;
                while ((match = scriptRegex.exec(sectionHTML)) !== null) {
                    scriptMatches.push(match[0]); // Full match including tags
                }

                // Remove script tags from HTML before inserting (we'll execute them separately)
                let htmlWithoutScripts = sectionHTML.replace(/<script[\s\S]*?<\/script>/gi, '');

                // Insert HTML without scripts first
                dynamicContainer.innerHTML = htmlWithoutScripts;
                dynamicContainer.style.display = 'block';

                // Initialize Threads if needed
                if (sectionKey === 'threads') {
                    setTimeout(() => {
                        if (window.StudyThreads && typeof window.StudyThreads.init === 'function') {
                            window.StudyThreads.init();
                        }
                    }, 100);
                }

                // Make sure the section inside is visible
                const innerSections = dynamicContainer.querySelectorAll('.content-section');
                innerSections.forEach(sec => {
                    sec.classList.add('active');
                    sec.style.display = 'block';
                });

                // Now execute the scripts we extracted
                if (scriptMatches && scriptMatches.length > 0) {
                    scriptMatches.forEach((scriptTag, index) => {
                        try {
                            // Create a temporary div to parse the script tag
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = scriptTag;
                            const oldScript = tempDiv.querySelector('script');

                            if (oldScript) {
                                let scriptContent = oldScript.textContent || oldScript.innerHTML;

                                // Wrap in try-catch to prevent errors from breaking execution
                                scriptContent = `try { ${scriptContent} } catch(e) { console.error('Script execution error:', e); }`;

                                const newScript = document.createElement('script');
                                // Copy all attributes
                                Array.from(oldScript.attributes).forEach(attr => {
                                    newScript.setAttribute(attr.name, attr.value);
                                });
                                // Set wrapped script content
                                newScript.textContent = scriptContent;
                                // Append to body to execute (not container, to avoid DOM issues)
                                document.body.appendChild(newScript);

                                // Clean up after execution
                                setTimeout(() => {
                                    if (newScript.parentNode) {
                                        newScript.parentNode.removeChild(newScript);
                                    }
                                }, 100);
                            }
                        } catch (error) {
                            console.error(`Error executing script ${index + 1} for section ${sectionKey}:`, error);
                        }
                    });
                }
            }

            // Update navigation state
            updateNavigationState(sectionKey);
            // Initialize section components
            initializeSectionComponents(sectionKey);

        } catch (error) {
            console.error('Error loading section:', error);
            console.error('Section name:', sectionKey);
            console.error('Django URL:', getCSRepSectionUrl(sectionKey));

            let errorMessage = error.message;
            let helpText = '';

            // Provide helpful error message
            if (error.message.includes('Failed to load') || error.message.includes('Network error')) {
                const djangoUrl = getCSRepSectionUrl(sectionKey);
                errorMessage = `Failed to load section: ${sectionKey}`;
                helpText = `
                    <p style="font-size: 0.85rem; color: #9ca3af; margin-top: 1rem;">
                        <strong>Django URL:</strong> ${djangoUrl}<br>
                        <strong>Current page:</strong> ${window.location.href}<br>
                        <strong>Section name:</strong> ${sectionKey}
                    </p>
                `;
            }

            if (dynamicContainer) {
                dynamicContainer.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: #e74c3c;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                        <p><strong>Error loading ${sectionKey}</strong></p>
                        <p style="font-size: 0.9rem; color: #9ca3af; margin-top: 0.5rem;">${errorMessage}</p>
                        ${helpText}
                        <p style="font-size: 0.8rem; color: #9ca3af; margin-top: 1rem;">
                            Attempted URL: <code style="background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px;">${getCSRepSectionUrl(sectionKey)}</code>
                        </p>
                    </div>
                `;
                dynamicContainer.style.display = 'block';
            }
        }
    } else {
        // Section not found in map
        console.warn(`No file mapping found for section: ${sectionKey}`);
        if (dynamicContainer) {
            dynamicContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #9ca3af;">
                    <i class="fas fa-info-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Section "${sectionKey}" not found</p>
                </div>
            `;
            dynamicContainer.style.display = 'block';
        }
    }
}

function initializeCSRepRealtimeSectionRefresh() {
    // Auto-refresh is intentionally disabled for CS-Rep dashboard (per product request).
    // This prevents periodic section reloads and WS-driven force reloads that can disrupt UX.
    return;

    if (typeof window.forceReloadCSRepSection === 'undefined') {
        window.forceReloadCSRepSection = async function (sectionKey) {
            try { if (window.csrepLoadedSections) delete window.csrepLoadedSections[sectionKey]; } catch (e) {}
            try { return await openSection(sectionKey); } catch (e) {}
        };
    }

    if (window.__csrepRtSectionRefreshBound) return;
    window.__csrepRtSectionRefreshBound = true;

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

        const sectionKey = sectionId.replace('Section', '');
        if (!sectionKey) return;

        lastActiveSection = sectionKey;

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
                console.log(`[Auto-refresh] Refreshing CS rep ${sectionKey} section...`);
                await window.forceReloadCSRepSection(sectionKey);
            } catch (error) {
                console.warn(`[Auto-refresh] Failed to refresh ${sectionKey}:`, error);
            }
        };

        // Start interval
        autoRefreshInterval = setInterval(refreshCurrentSection, REFRESH_INTERVAL);
        console.log(`[Auto-refresh] Started for CS rep section: ${sectionKey} (every ${REFRESH_INTERVAL/1000}s)`);
    }

    // Start auto-refresh when section changes
    const originalOpenSection = window.openSection;
    if (originalOpenSection) {
        window.openSection = async function(sectionKey) {
            const result = await originalOpenSection.apply(this, arguments);
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

        // CS-Rep overview contains assignments/invoices widgets; refresh it if visible
        if (eventName === 'assignment.changed' && activeId === 'overviewSection') {
            window.forceReloadCSRepSection('overview');
        }
        if (eventName === 'announcement.changed') {
            if (activeId === 'announcementsSection') {
                window.forceReloadCSRepSection('announcements');
            } else if (typeof window.loadAnnouncements === 'function') {
                window.loadAnnouncements();
            }
        }
        if (eventName === 'threads.changed' && activeId === 'threadsSection') {
            window.forceReloadCSRepSection('threads');
        }
    });
}

// Make openSection globally available immediately (for onclick handlers)
// Also create a synchronous wrapper for onclick handlers
window.openSection = openSection;
window.openSectionSync = function (sectionKey) {
    // Wrapper for onclick handlers that can't handle async directly
    if (typeof openSection === 'function') {
        Promise.resolve(openSection(sectionKey)).catch(error => {
            console.error('Error opening section:', error);
            alert('Failed to load section. Please try again.');
        });
    }
};

// Helper function to update navigation state
function updateNavigationState(sectionKey) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(l => {
        const navItem = l.closest('.nav-item');
        if (navItem) navItem.classList.remove('active');
    });

    const activeLink = Array.from(navLinks).find(l => l.getAttribute('data-section') === sectionKey);
    if (activeLink) {
        const navItem = activeLink.closest('.nav-item');
        if (navItem) {
            navItem.classList.add('active');
            console.log('✓ Nav item activated for:', sectionKey);
        }
    }
}

// Helper function to initialize section-specific components
function initializeSectionComponents(sectionKey) {
    setTimeout(() => {
        if (sectionKey === 'preSignIn') {
            if (typeof initializeChatSelection === 'function') initializeChatSelection();
            if (typeof initializeChatComposers === 'function') initializeChatComposers();
        }
        if (sectionKey === 'communication') {
            if (typeof window.initStudyMessagingOnLoad === 'function') {
                setTimeout(() => window.initStudyMessagingOnLoad(), 50);
            }
        }
        if (sectionKey === 'threads') {
            if (typeof initializeThreadManagement === 'function') initializeThreadManagement();
        }
        if (sectionKey === 'profile') {
            if (typeof loadUserProfile === 'function') loadUserProfile();
            if (typeof initializeProfileForm === 'function') initializeProfileForm();
        }
        if (sectionKey === 'overview') {
            if (typeof initializeCSRepOverview === 'function') initializeCSRepOverview();
        }
        if (sectionKey === 'invoices') {
            if (typeof initializeFilterChips === 'function') initializeFilterChips();
            // Initialize the new invoice request modal and data
            setTimeout(() => {
                initializeInvoiceRequestModal();
                if (typeof window.loadCSRepInvoices === 'function') {
                    window.loadCSRepInvoices();
                }
            }, 100);
        }
        if (sectionKey === 'announcements') {
            if (typeof loadAnnouncements === 'function') loadAnnouncements();
        }
        if (sectionKey === 'notifications') {
            if (typeof loadNotifications === 'function') loadNotifications();
        }
    }, 100);
}

// ==============================
// CS-Rep Overview (Daily Pulse)
// ==============================
function getActiveOverviewRange() {
    const section = document.getElementById('overviewSection');
    if (!section) return 'today';
    const active = section.querySelector('.header-filters .filter-chip.active[data-range]');
    return (active && active.getAttribute('data-range')) ? active.getAttribute('data-range') : 'today';
}

async function loadCSRepOverviewMetrics(rangeKey = 'today') {
    const liveChatsEl = document.getElementById('liveChatsCount');
    const invoicesCreatedEl = document.getElementById('invoicesCreatedCount');
    const activeThreadsEl = document.getElementById('activeThreadsCount');

    // Basic loading state
    if (liveChatsEl) liveChatsEl.textContent = '…';
    if (invoicesCreatedEl) invoicesCreatedEl.textContent = '…';
    if (activeThreadsEl) activeThreadsEl.textContent = '…';

    try {
        const res = await fetch(`/account/csrep/api/overview-metrics/?range=${encodeURIComponent(rangeKey)}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin'
        });
        const data = await res.json();
        if (!data || data.success !== true) {
            throw new Error((data && data.error) ? data.error : 'Failed to load overview metrics');
        }

        const metrics = data.metrics || {};
        if (liveChatsEl) liveChatsEl.textContent = String(metrics.live_chats ?? 0);
        if (invoicesCreatedEl) invoicesCreatedEl.textContent = String(metrics.invoices_created ?? 0);
        if (activeThreadsEl) activeThreadsEl.textContent = String(metrics.active_threads ?? 0);
    } catch (e) {
        console.error('Failed to load CS-Rep overview metrics:', e);
        if (liveChatsEl) liveChatsEl.textContent = '—';
        if (invoicesCreatedEl) invoicesCreatedEl.textContent = '—';
        if (activeThreadsEl) activeThreadsEl.textContent = '—';
    }
}

function initializeCSRepOverview() {
    const section = document.getElementById('overviewSection');
    if (!section) return;

    // Bind filter chip clicks once
    if (!window.__csrepOverviewFiltersBound) {
        window.__csrepOverviewFiltersBound = true;
        section.addEventListener('click', function (e) {
            const chip = e.target.closest('.filter-chip[data-range]');
            if (!chip) return;
            const chips = section.querySelectorAll('.header-filters .filter-chip');
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const rangeKey = chip.getAttribute('data-range') || 'today';
            loadCSRepOverviewMetrics(rangeKey);
        }, true);
    }

    // Load metrics for current active filter
    loadCSRepOverviewMetrics(getActiveOverviewRange());

    // Load notifications list for the panel (no auto-refresh)
    if (typeof loadNotifications === 'function') {
        try { loadNotifications(); } catch (e) {}
    }
}

// Already assigned above, just mark as loaded
window.csRepDashboardLoaded = true;

console.log('CS-REP DASHBOARD JS FILE LOADED');

// Add a global document-level click handler as ultimate fallback for nav links
// This ensures clicks are always captured even if other handlers fail
// Use a function that can be called immediately or on DOMContentLoaded
function setupGlobalNavHandler() {
    // Add a test handler to verify ANY clicks are being captured
    document.addEventListener('click', function (event) {
        // Only log nav-link clicks to avoid spam, but verify clicks work
        const navLink = event.target.closest('.nav-link');
        if (navLink) {
            console.log('🔵🔵🔵 CLICK DETECTED ON NAV LINK!', event.target, navLink);
        }
    }, true);

    document.addEventListener('click', function (event) {
        // Check if click is on a nav-link or its children (icon, span, etc.)
        const navLink = event.target.closest('.nav-link');
        if (navLink) {
            const sectionKey = navLink.getAttribute('data-section');
            console.log('🔵 Global handler - navLink found:', navLink, 'sectionKey:', sectionKey);
            if (sectionKey) {
                console.log('🔵 GLOBAL nav link click handler triggered:', sectionKey);
                event.preventDefault();
                event.stopPropagation();
                if (typeof openSection === 'function') {
                    console.log('🔵 Calling openSection with:', sectionKey);
                    Promise.resolve(openSection(sectionKey)).catch(error => {
                        console.error('Error opening section:', error);
                    });
                } else {
                    console.error('openSection function not available in global handler!');
                }
                return;
            }
        }
    }, true); // Use capture phase to catch early
    console.log('✓ Global nav click handler registered');
}

// Try to set up immediately if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupGlobalNavHandler);
} else {
    // DOM is already loaded
    setupGlobalNavHandler();
}

// Initialize CS Rep profile display (name and picture from database)
function initializeCSRepProfile() {
    // Profile name and picture are already set in the template via Django context
    // This function ensures they're displayed correctly and can be updated dynamically
    const profilePicture = document.getElementById('headerProfilePicture');
    const profileIcon = document.getElementById('headerProfileIcon');
    const headerName = document.getElementById('headerUserName');

    // Initialize header name - ALWAYS load from database to ensure it's up-to-date
    if (headerName) {
        const currentText = headerName.textContent || headerName.innerText || '';
        // Remove any Django template artifacts that might have been rendered incorrectly
        if (currentText.includes('{%') || currentText.includes('%}')) {
            // Template wasn't processed correctly, set temporary default
            headerName.textContent = 'CS Rep';
        }

        // ALWAYS load from database to get the latest first name
        // This ensures the header name is always correct, even after refresh
        if (typeof loadUserProfile === 'function') {
            loadUserProfile().catch(err => {
                console.error('Error loading user profile for header:', err);
            });
        } else {
            // If loadUserProfile is not available yet, try direct fetch
            loadUserProfileDirect().catch(err => {
                console.error('Error loading user profile directly:', err);
            });
        }
    }

    if (profilePicture) {
        // Check if profile picture has a valid src (not empty and not just the base URL)
        const pictureSrc = profilePicture.src || profilePicture.getAttribute('src') || '';
        const hasValidPicture = pictureSrc &&
            pictureSrc.trim() !== '' &&
            pictureSrc.includes('http');

        if (hasValidPicture && profilePicture.complete && profilePicture.naturalWidth > 0) {
            // Profile picture exists and loaded successfully, show it and hide icon
            profilePicture.style.display = 'block';
            if (profileIcon) {
                profileIcon.style.display = 'none';
            }
        } else {
            // No profile picture or failed to load, show icon
            profilePicture.style.display = 'none';
            if (profileIcon) {
                profileIcon.style.display = 'flex';
            }

            // Handle image load error
            profilePicture.onerror = function () {
                profilePicture.style.display = 'none';
                if (profileIcon) {
                    profileIcon.style.display = 'flex';
                }
            };

            // Handle image load success
            profilePicture.onload = function () {
                if (profilePicture.naturalWidth > 0) {
                    profilePicture.style.display = 'block';
                    if (profileIcon) {
                        profileIcon.style.display = 'none';
                    }
                }
            };
        }
    }
}

// Update CS Rep header avatar (called when profile picture is updated)
function updateCSRepHeaderAvatar(imageUrl) {
    const profilePicture = document.getElementById('headerProfilePicture');
    const profileIcon = document.getElementById('headerProfileIcon');

    if (imageUrl && imageUrl.trim() !== '') {
        if (profilePicture) {
            profilePicture.src = imageUrl;
            profilePicture.style.display = 'block';
        }
        if (profileIcon) {
            profileIcon.style.display = 'none';
        }
    } else {
        // Remove profile picture
        if (profilePicture) {
            profilePicture.src = '';
            profilePicture.style.display = 'none';
        }
        if (profileIcon) {
            profileIcon.style.display = 'flex';
        }
    }
}

// Update CS Rep header name (called when profile is updated)
function updateCSRepHeaderName(firstName) {
    const profileName = document.getElementById('headerUserName');
    if (profileName && firstName) {
        profileName.textContent = firstName;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    console.log('=== CS-Rep Dashboard Initialization Started ===');
    console.log('Script file loaded successfully, DOM ready');

    // Initialize CS Rep profile display
    initializeCSRepProfile();

    // Ensure openSection is available globally
    if (typeof window.openSection === 'undefined') {
        console.error('openSection function not found! Script may have failed to load.');
        // Create a fallback function
        window.openSection = function (sectionKey) {
            console.error('openSection fallback called - original function not available');
            alert('Navigation is not working. Please refresh the page.');
        };
    }

    try {
        initializeThemeToggle();
        console.log('✓ Theme toggle initialized');
    } catch (e) {
        console.error('✗ Theme toggle failed:', e);
    }

    // Auto-refresh intentionally disabled (see initializeCSRepRealtimeSectionRefresh)

    try {
        console.log('🔵 About to initialize navigation...');
        initializeNavigation();
        console.log('✓ Navigation initialized');

        // Check if there's already content loaded (from server-side rendering)
        const dynamicContainer = document.getElementById('dynamicContentContainer');
        const existingSection = dynamicContainer && dynamicContainer.querySelector('.content-section');

        if (!existingSection) {
            // Restore last section or show overview by default
            try {
                const lastSection = localStorage.getItem('csrep_last_section');
                const sectionToShow = lastSection && window.csrepSectionFileMap && window.csrepSectionFileMap.hasOwnProperty(lastSection) ? lastSection : 'overview';
                console.log(`Restoring CS rep section: ${sectionToShow}${lastSection ? ' (from localStorage)' : ' (default)'}`);
                openSection(sectionToShow);
            } catch (error) {
                console.error('Error initializing section:', error);
                // Fallback to overview
                try {
                    openSection('overview');
                } catch (fallbackError) {
                    console.error('Error initializing overview fallback:', fallbackError);
                }
            }
        } else {
            // Initialize the currently visible section
            const activeSection = document.querySelector('.content-section.active');
            if (activeSection) {
                const sectionId = activeSection.id;
                if (sectionId) {
                    const sectionName = sectionId.replace('Section', '');
                    updateNavigationState(sectionName);
                    // Save to localStorage
                    localStorage.setItem('csrep_last_section', sectionName);
                }
            }
        }

        // Test: Log all nav links found
        const testLinks = document.querySelectorAll('.nav-link');
        console.log('🔵 Test: Found', testLinks.length, 'nav links after init');
        testLinks.forEach((link, i) => {
            console.log(`🔵 Link ${i}:`, link.getAttribute('data-section'), link);
        });
    } catch (e) {
        console.error('✗ Navigation failed:', e);
        console.error('Navigation error details:', e.stack);
    }

    try {
        initializeFilterChips();
        console.log('✓ Filter chips initialized');
    } catch (e) {
        console.error('✗ Filter chips failed:', e);
    }

    try {
        initializeChatSelection();
        console.log('✓ Chat selection initialized');
    } catch (e) {
        console.error('✗ Chat selection failed:', e);
    }

    try {
        initializeThreadSelection();
        console.log('✓ Thread selection initialized');
    } catch (e) {
        console.error('✗ Thread selection failed:', e);
    }

    try {
        initializePaymentConfirmation();
        console.log('✓ Payment confirmation initialized');
    } catch (e) {
        console.error('✗ Payment confirmation failed:', e);
    }

    try {
        initializeHeaderShortcuts();
        console.log('✓ Header shortcuts initialized');
    } catch (e) {
        console.error('✗ Header shortcuts failed:', e);
    }

    try {
        initializeAssignTeacherModal();
        console.log('✓ Assign teacher modal initialized');
    } catch (e) {
        console.error('✗ Assign teacher modal failed:', e);
    }

    try {
        initializeCreateInvoiceModal();
        console.log('✓ Create invoice modal initialized');
    } catch (e) {
        console.error('✗ Create invoice modal failed:', e);
    }

    try {
        initializeChatComposers();
        console.log('✓ Chat composers initialized');
    } catch (e) {
        console.error('✗ Chat composers failed:', e);
    }

    try {
        initializeProfileForm();
        console.log('✓ Profile form initialized');
    } catch (e) {
        console.error('✗ Profile form failed:', e);
    }

    try {
        initializeThreadManagement();
        console.log('✓ Thread management initialized');
    } catch (e) {
        console.error('✗ Thread management failed:', e);
    }

    // Load user profile immediately (for header name display)
    // ALWAYS load from database to ensure header name is correct
    // Use setTimeout to ensure DOM is ready and apiClient might be available
    setTimeout(() => {
        try {
            // First, ensure header name is clean (remove any template artifacts)
            const headerName = document.getElementById('headerUserName');
            if (headerName) {
                const currentText = headerName.textContent || headerName.innerText || '';
                if (currentText.includes('{%') || currentText.includes('%}')) {
                    // Template wasn't processed correctly, set temporary default
                    headerName.textContent = 'CS Rep';
                }
            }

            // ALWAYS load profile from database to get the latest first name
            // This ensures the header name is always correct, even after refresh
            if (typeof loadUserProfile === 'function') {
                loadUserProfile().then((data) => {
                    if (data) {
                        console.log('✓ User profile loaded and header updated:', data.first_name);
                    } else {
                        console.warn('Profile data not available, trying direct fetch...');
                        // Fallback to direct fetch if loadUserProfile didn't return data
                        if (typeof loadUserProfileDirect === 'function') {
                            loadUserProfileDirect();
                        }
                    }
                }).catch(err => {
                    console.error('✗ User profile loading failed, trying direct fetch:', err);
                    // Fallback to direct fetch
                    if (typeof loadUserProfileDirect === 'function') {
                        loadUserProfileDirect().catch(directErr => {
                            console.error('✗ Direct fetch also failed:', directErr);
                        });
                    }
                });
            } else {
                console.warn('loadUserProfile function not available, trying direct fetch...');
                // Fallback to direct fetch
                if (typeof loadUserProfileDirect === 'function') {
                    loadUserProfileDirect().catch(err => {
                        console.error('✗ Direct fetch failed:', err);
                    });
                }
            }
        } catch (e) {
            console.error('✗ User profile loading failed:', e);
        }
    }, 100);

    // Initial section loading is handled by openSection(sectionToShow) above.
    // We intentionally avoid extra dashboard-wide loads here to prevent "auto refresh" UX.

    console.log('=== CS-Rep Dashboard Initialization Complete ===');
});

function initializeThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    console.log('Initializing theme toggle:', toggle);

    if (!toggle) {
        console.error('Theme toggle button not found');
        return;
    }

    const icon = toggle.querySelector('i');
    const storageKey = 'cs-rep-theme';
    const storedTheme = localStorage.getItem(storageKey);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
        document.body.classList.add('dark-mode');
        if (icon) {
            icon.classList.replace('fa-moon', 'fa-sun');
        }
    }

    // Add multiple event handlers to ensure it works
    toggle.onclick = function (e) {
        console.log('Theme toggle ONCLICK fired');
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem(storageKey, isDark ? 'dark' : 'light');
        if (icon) {
            if (isDark) {
                icon.classList.replace('fa-moon', 'fa-sun');
            } else {
                icon.classList.replace('fa-sun', 'fa-moon');
            }
        }
    };

    toggle.addEventListener('click', function (e) {
        console.log('Theme toggle clicked (addEventListener)');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem(storageKey, isDark ? 'dark' : 'light');

        console.log('Theme toggled to:', isDark ? 'dark' : 'light');

        if (icon) {
            if (isDark) {
                icon.classList.replace('fa-moon', 'fa-sun');
            } else {
                icon.classList.replace('fa-sun', 'fa-moon');
            }
        }
    }, true); // Use capture phase to ensure it fires first

    // Ensure button is clickable
    toggle.style.cursor = 'pointer';
    toggle.style.pointerEvents = 'auto';
}

function initializeNavigation() {
    const navMenu = document.querySelector('.nav-menu');
    const navList = document.querySelector('.nav-list');
    const navLinks = document.querySelectorAll('.nav-link');

    console.log('=== Navigation Initialization ===');
    console.log('Nav menu found:', !!navMenu);
    console.log('Nav list found:', !!navList);
    console.log('Nav links found:', navLinks.length);

    if (!navLinks.length) {
        console.error('Navigation initialization failed: no nav links found');
        return;
    }

    // Primary: Use event delegation on nav-list for better reliability
    if (navList) {
        navList.addEventListener('click', function (event) {
            // Find the closest nav-link that was clicked (handles clicks on icon, span, etc.)
            const clickedLink = event.target.closest('.nav-link');
            if (!clickedLink) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            const sectionKey = clickedLink.getAttribute('data-section');
            console.log('🔵 Nav link clicked! Section:', sectionKey);

            if (!sectionKey) {
                console.warn('Clicked nav-link has no data-section attribute');
                return;
            }

            if (typeof openSection === 'function') {
                console.log('🔵 Calling openSection with:', sectionKey);
                // openSection is async, handle promise
                Promise.resolve(openSection(sectionKey)).catch(error => {
                    console.error('Error opening section:', error);
                });
            } else {
                console.error('openSection function is not available!');
            }
        }, true); // Use capture phase to catch early

        console.log('✓ Event delegation attached to .nav-list (capture phase)');
    }

    // Backup: Add individual handlers to each link
    Array.from(navLinks).forEach((link, index) => {
        const sectionKey = link.getAttribute('data-section');
        console.log(`Setting up nav link ${index}:`, sectionKey);

        if (!sectionKey) {
            console.warn(`Nav link ${index} has no data-section attribute`);
            return;
        }

        // Remove any existing listeners by cloning
        const newLink = link.cloneNode(true);
        link.parentNode.replaceChild(newLink, link);

        // Add direct click handler
        newLink.addEventListener('click', function (event) {
            console.log('🔵 Individual nav link handler fired:', sectionKey);
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            if (typeof openSection === 'function') {
                // openSection is async, handle promise
                Promise.resolve(openSection(sectionKey)).catch(error => {
                    console.error('Error opening section:', error);
                });
            } else {
                console.error('openSection function not available in individual handler');
            }
        }, true); // Use capture phase

        // Make sure link is clickable
        newLink.style.cursor = 'pointer';
        newLink.style.pointerEvents = 'auto';

        console.log(`✓ Handler attached to link ${index}:`, sectionKey);
    });

    console.log('=== Navigation Initialization Complete ===');
}

function initializeFilterChips() {
    document.querySelectorAll('.header-filters').forEach(group => {
        group.addEventListener('click', event => {
            const chip = event.target.closest('.filter-chip');
            if (!chip) return;
            group.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
            chip.classList.add('active');

            // If this filter group is inside the Invoices section, filter table rows
            const inInvoices = !!group.closest('#invoicesSection');
            if (inInvoices) {
                const label = chip.textContent.trim().toLowerCase();
                const filter = (label === 'all') ? null : label; // null shows all
                const rows = document.querySelectorAll('#invoiceTable tbody tr');
                rows.forEach(row => {
                    const status = row.getAttribute('data-invoice-status');
                    const match = !filter || status === filter;
                    // For non-matching statuses hide; also hide drafts unless All
                    const isDraft = status === 'draft';
                    const visible = match && (!isDraft || filter === null);
                    row.style.display = visible ? '' : 'none';
                });
            }
        });
    });
}

function initializeChatSelection() {
    const chatList = document.getElementById('preChatList');
    if (!chatList) return;

    chatList.addEventListener('click', event => {
        const item = event.target.closest('.chat-item');
        if (!item) return;
        chatList.querySelectorAll('.chat-item').forEach(btn => btn.classList.remove('active'));
        item.classList.add('active');

        // Switch conversation for Pre-Sign-in Chat
        const sessionId = item.getAttribute('data-session');
        const studentName = item.querySelector('.chat-title')?.textContent.replace('Name: ', '') || '';
        if (sessionId) {
            switchPreSignInContact(sessionId, studentName);
        }
    });
}

// Initialize thread selection for Communication tab
function initializeThreadSelection() {
    const threadList = document.querySelector('.thread-list');
    if (!threadList) return;

    threadList.addEventListener('click', event => {
        const threadCard = event.target.closest('.thread-card');
        if (!threadCard) return;
        threadList.querySelectorAll('.thread-card').forEach(card => card.classList.remove('active'));
        threadCard.classList.add('active');

        // Switch conversation for Communication tab
        const studentName = threadCard.querySelector('.thread-title')?.textContent || '';
        if (studentName) {
            switchCommunicationContact(studentName);
        }
    });
}

function initializePaymentConfirmation() {
    const cards = document.querySelectorAll('.payment-card');
    if (!cards.length) return;

    cards.forEach(card => {
        card.addEventListener('click', event => {
            const button = event.target.closest('.confirm-payment');
            if (!button) return;

            event.preventDefault();
            const status = card.querySelector('.status-pill');
            if (!status) return;

            status.classList.remove('warm', 'followup');
            status.classList.add('converted');
            status.textContent = 'Paid';

            button.replaceWith(createGhostButton('View receipt'));
            card.classList.add('paid');
        });
    });
}

function createGhostButton(label) {
    const btn = document.createElement('button');
    btn.className = 'ghost-button';
    btn.type = 'button';
    btn.textContent = label;
    return btn;
}

function initializeHeaderShortcuts() {
    console.log('Initializing header shortcuts');

    // Initialize profile dropdown toggle
    const userProfileMenu = document.querySelector('.user-profile-menu');
    const dropdown = document.querySelector('.user-dropdown');
    const chevronIcon = userProfileMenu ? userProfileMenu.querySelector('.fa-chevron-down') : null;

    console.log('Profile menu elements:', { userProfileMenu, dropdown, chevronIcon });

    // Function to update chevron icon state (defined outside if block for accessibility)
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

    if (userProfileMenu && dropdown) {
        // Initialize dropdown state
        dropdown.style.display = 'none';

        // Handle profile menu click - but not dropdown items
        userProfileMenu.addEventListener('click', function (e) {
            // If clicking on dropdown item, let it handle navigation
            if (e.target.closest('.dropdown-item')) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            const isVisible = dropdown.style.display === 'block' || dropdown.style.display === '';
            const newState = !isVisible;
            dropdown.style.display = newState ? 'block' : 'none';
            userProfileMenu.classList.toggle('active', newState);
            updateChevronIcon(newState);
            console.log('Profile dropdown toggled:', newState);
        });

        userProfileMenu.style.cursor = 'pointer';
        userProfileMenu.style.pointerEvents = 'auto';
    }

    // Add direct handlers to dropdown items
    if (dropdown) {
        const dropdownItems = dropdown.querySelectorAll('.dropdown-item');
        dropdownItems.forEach(item => {
            item.style.cursor = 'pointer';
            item.style.pointerEvents = 'auto';

            item.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                // Check if it's a logout link (handled via hidden form in base template)
                if (item.classList.contains('logout-link')) {
                    if (confirm('Are you sure you want to logout?')) {
                        const logoutForm = document.getElementById('logoutForm');
                        if (logoutForm) {
                            logoutForm.submit();
                        } else {
                            // Fallback if form not found
                            window.location.href = '/account/api/accounts/logout/';
                        }
                    }
                    return;
                }

                // Otherwise, check for data-open-section
                const key = item.getAttribute('data-open-section');
                console.log('Dropdown item clicked:', key);

                if (key && typeof openSection === 'function') {
                    Promise.resolve(openSection(key)).catch(error => {
                        console.error('Error opening section:', error);
                    });
                    dropdown.style.display = 'none';
                    if (userProfileMenu) {
                        userProfileMenu.classList.remove('active');
                        updateChevronIcon(false);
                    }
                }
            }, true); // Use capture phase to ensure it runs first
        });
    }

    // Handle all data-open-section buttons (bell icon, ghost buttons in content, etc.)
    // Use event delegation for better performance and to catch dynamically added buttons
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-open-section]');
        if (!btn) return;

        // Skip if it's a dropdown item (already handled separately above)
        if (btn.closest('.user-dropdown')) return;

        e.preventDefault();
        e.stopPropagation();
        const key = btn.getAttribute('data-open-section');
        console.log('data-open-section button clicked:', key);
        if (key && typeof openSection === 'function') {
            Promise.resolve(openSection(key)).catch(error => {
                console.error('Error opening section:', error);
            });
        }
    }, true); // Use capture phase to ensure it runs early

    // Close dropdown when clicking outside (use a separate listener with lower priority)
    document.addEventListener('click', function (e) {
        if (userProfileMenu && dropdown) {
            // If clicking outside the profile menu and dropdown, close it
            if (!userProfileMenu.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
                if (userProfileMenu) {
                    userProfileMenu.classList.remove('active');
                    updateChevronIcon(false);
                }
            }
        }
    });
}

// Make openAssignTeacherModal globally available
window.openAssignTeacherModal = function (assignmentId) {
    const openBtn = document.getElementById('openAssignModal');
    if (openBtn) {
        openBtn.click();
        // TODO: Pre-select assignment if assignmentId is provided
    }
};

// Assign Teacher modal
function initializeAssignTeacherModal() {
    const openBtn = document.getElementById('openAssignModal');
    const overlay = document.getElementById('assignModalOverlay');
    const closeBtn = document.getElementById('closeAssignModal');
    const cancelBtn = document.getElementById('cancelAssignModal');
    const submitBtn = document.getElementById('submitAssignModal');

    if (!openBtn || !overlay) return;

    const studentInput = document.getElementById('assignStudentInput');
    const studentList = document.getElementById('assignStudentList');
    const workInput = document.getElementById('assignWorkInput');
    const workList = document.getElementById('assignWorkList');
    const tutorInput = document.getElementById('assignTutorInput');
    const tutorList = document.getElementById('assignTutorList');

    let allAssignments = [];
    let allStudents = [];
    let allTeachers = [];

    let selectedStudent = null;
    let selectedAssignment = null;
    let selectedTutor = null;

    // Fetch assignments, students, and teachers from API
    async function fetchData() {
        try {
            // Load assignments
            if (typeof loadAllAssignments === 'function') {
                allAssignments = await loadAllAssignments();
            } else if (typeof apiClient !== 'undefined') {
                const data = await apiClient.getAssignments();
                allAssignments = data.results || data || [];
            }

            // Extract unique students from assignments
            const studentMap = new Map();
            allAssignments.forEach(assignment => {
                if (assignment.student_detail) {
                    const studentId = assignment.student_detail.student_id || assignment.student_detail.id;
                    const studentName = assignment.student_detail.first_name && assignment.student_detail.last_name ?
                        `${assignment.student_detail.first_name} ${assignment.student_detail.last_name}`.trim() :
                        assignment.student_detail.email || assignment.student_name || 'Unknown';
                    const studentEmail = assignment.student_detail.email || assignment.student_email;

                    if (studentId && !studentMap.has(studentId)) {
                        studentMap.set(studentId, {
                            id: studentId,
                            name: studentName,
                            email: studentEmail
                        });
                    }
                } else if (assignment.student_name) {
                    // Fallback if student_detail not available
                    const studentId = assignment.student__username || assignment.student_id;
                    if (studentId && !studentMap.has(studentId)) {
                        studentMap.set(studentId, {
                            id: studentId,
                            name: assignment.student_name,
                            email: assignment.student_email || assignment.student__email
                        });
                    }
                }
            });
            allStudents = Array.from(studentMap.values());

            // Load teachers from assignments (they're referenced in teacher_assignments)
            // For now, extract from assignments since there's no direct teachers endpoint
            // TODO: Create /api/accounts/teachers/ endpoint if needed
            const teacherMap = new Map();
            allAssignments.forEach(assignment => {
                if (assignment.teacher_assignments && assignment.teacher_assignments.length > 0) {
                    assignment.teacher_assignments.forEach(ta => {
                        if (ta.teacher) {
                            const teacherId = ta.teacher.teacher_id || ta.teacher.id;
                            if (teacherId && !teacherMap.has(teacherId)) {
                                teacherMap.set(teacherId, ta.teacher);
                            }
                        }
                    });
                }
            });
            allTeachers = Array.from(teacherMap.values());

            // Try to get teachers from API if endpoint exists
            if (typeof apiClient !== 'undefined') {
                try {
                    const teachersData = await apiClient.get('/accounts/teachers/');
                    if (teachersData && (teachersData.results || teachersData.length > 0)) {
                        allTeachers = teachersData.results || teachersData || [];
                    }
                } catch (error) {
                    // Teachers API might not exist yet, that's okay
                    console.log('Teachers endpoint not available, using assignments data');
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }

    function openModal() {
        overlay.style.display = 'grid';
        document.body.classList.add('modal-open');
        resetForm();
        fetchData().then(() => {
            studentInput.focus();
        });
    }

    function closeModal() {
        overlay.style.display = 'none';
        document.body.classList.remove('modal-open');
        hideLists();
    }

    function hideLists() {
        studentList.classList.remove('show');
        workList.classList.remove('show');
        tutorList.classList.remove('show');
    }

    function resetForm() {
        selectedStudent = null;
        selectedAssignment = null;
        selectedTutor = null;
        studentInput.value = '';
        workInput.value = '';
        tutorInput.value = '';
        workInput.disabled = true;
        tutorInput.disabled = true;
    }

    function renderStudentList(listEl, items, onPick) {
        listEl.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<div style="font-weight: 600;">${item.name}</div><div style="font-size: 0.85rem; color: var(--muted-text);">${item.email || ''}</div>`;
            li.addEventListener('click', () => onPick(item));
            listEl.appendChild(li);
        });
        if (items.length) listEl.classList.add('show'); else listEl.classList.remove('show');
    }

    function renderAssignmentList(listEl, items, onPick) {
        listEl.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            const assignmentId = item.assignment_id || `ID-${item.id}`;
            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <code style="background: rgba(17, 88, 229, 0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; color: var(--primary);">${assignmentId}</code>
                    <div>
                        <div style="font-weight: 600;">${item.title}</div>
                        <div style="font-size: 0.85rem; color: var(--muted-text);">${item.subject || ''}</div>
                    </div>
                </div>
            `;
            li.addEventListener('click', () => onPick(item));
            listEl.appendChild(li);
        });
        if (items.length) listEl.classList.add('show'); else listEl.classList.remove('show');
    }

    function renderTutorList(listEl, items, onPick) {
        listEl.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            if (typeof item === 'object') {
                const name = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.email || 'Unknown';
                const email = item.email ? ` (${item.email})` : '';
                li.innerHTML = `<div style="font-weight: 600;">${name}</div>${email ? `<div style="font-size: 0.85rem; color: var(--muted-text);">${email}</div>` : ''}`;
            } else {
                li.textContent = item;
            }
            li.addEventListener('click', () => onPick(item));
            listEl.appendChild(li);
        });
        if (items.length) listEl.classList.add('show'); else listEl.classList.remove('show');
    }

    // Student typeahead
    studentInput.addEventListener('input', () => {
        const q = studentInput.value.toLowerCase();
        const matches = allStudents.filter(s =>
            s.name.toLowerCase().includes(q) ||
            (s.email && s.email.toLowerCase().includes(q))
        );
        renderStudentList(studentList, matches, (s) => {
            selectedStudent = s;
            studentInput.value = s.name;
            studentList.classList.remove('show');
            workInput.disabled = false;
            workInput.value = '';
            workInput.placeholder = 'Select assignment for ' + s.name;
            tutorInput.disabled = true;
            tutorInput.value = '';
            selectedAssignment = null;
            selectedTutor = null;
            workInput.focus();
        });
    });
    studentInput.addEventListener('focus', () => {
        if (allStudents.length === 0) {
            fetchData().then(() => studentInput.dispatchEvent(new Event('input')));
        } else {
            studentInput.dispatchEvent(new Event('input'));
        }
    });

    // Assignment typeahead (depends on student)
    workInput.addEventListener('input', async () => {
        if (!selectedStudent) {
            workList.classList.remove('show');
            return;
        }

        const q = workInput.value.toLowerCase();
        // Filter assignments by selected student
        const studentAssignments = allAssignments.filter(a => {
            const studentName = (a.student_name || a.student__username || '').toLowerCase();
            const studentId = (a.student__username || '').toLowerCase();
            const selectedName = selectedStudent.name.toLowerCase();
            const selectedId = selectedStudent.id.toLowerCase();

            return studentName === selectedName ||
                studentName === selectedId ||
                studentId === selectedName ||
                studentId === selectedId;
        });

        const matches = studentAssignments.filter(a => {
            const title = (a.title || '').toLowerCase();
            const subject = (a.subject || '').toLowerCase();
            const assignmentId = (a.assignment_id || '').toLowerCase();
            return title.includes(q) || subject.includes(q) || assignmentId.includes(q);
        });

        renderAssignmentList(workList, matches, (assignment) => {
            selectedAssignment = assignment;
            const assignmentId = assignment.assignment_id || `ID-${assignment.id}`;
            workInput.value = `${assignmentId} - ${assignment.title}`;
            workList.classList.remove('show');
            tutorInput.disabled = false;
            tutorInput.focus();
        });
    });
    workInput.addEventListener('focus', () => {
        if (selectedStudent) {
            workInput.dispatchEvent(new Event('input'));
        }
    });

    // Tutor typeahead - load from API
    tutorInput.addEventListener('input', () => {
        const q = tutorInput.value.toLowerCase();
        const matches = allTeachers.filter(teacher => {
            const name = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email || '';
            return name.toLowerCase().includes(q) || (teacher.email && teacher.email.toLowerCase().includes(q));
        });
        renderTutorList(tutorList, matches, (t) => {
            selectedTutor = t;
            const displayName = typeof t === 'object' ?
                `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email :
                t;
            tutorInput.value = displayName;
            tutorList.classList.remove('show');
        });
    });
    tutorInput.addEventListener('focus', () => tutorInput.dispatchEvent(new Event('input')));

    // Submit
    submitBtn.addEventListener('click', () => {
        if (!selectedStudent || !selectedAssignment || !selectedTutor) {
            // Validation guard
            if (!selectedStudent) {
                studentInput.focus();
                alert('Please select a student');
                return;
            }
            if (!selectedAssignment) {
                workInput.focus();
                alert('Please select an assignment');
                return;
            }
            if (!selectedTutor) {
                tutorInput.focus();
                alert('Please select a tutor');
                return;
            }
            return;
        }

        // Assign teacher via API
        if (typeof apiClient !== 'undefined') {
            // Get teacher ID from selected tutor
            let teacherId = null;
            if (typeof selectedTutor === 'object') {
                teacherId = selectedTutor.teacher_id || selectedTutor.id;
            } else {
                // Try to find teacher by name
                const foundTeacher = allTeachers.find(t => {
                    const name = `${t.first_name || ''} ${t.last_name || ''}`.trim();
                    return name === selectedTutor;
                });
                if (foundTeacher) {
                    teacherId = foundTeacher.teacher_id || foundTeacher.id;
                }
            }

            if (!teacherId) {
                alert('Could not find teacher ID. Please select a teacher from the list.');
                return;
            }

            const assignmentId = selectedAssignment.id || selectedAssignment.assignment_id;

            apiClient.assignTeacher(assignmentId, teacherId)
                .then(data => {
                    const tutorName = typeof selectedTutor === 'object' ?
                        `${selectedTutor.first_name || ''} ${selectedTutor.last_name || ''}`.trim() :
                        selectedTutor;
                    showSuccessMessage(`Teacher ${tutorName} assigned successfully!`);

                    // Reload assignments table
                    if (typeof loadAllAssignments === 'function') {
                        loadAllAssignments().then(assignments => {
                            renderCSRepAssignmentsTable(assignments);
                        });
                    }

                    closeModal();
                })
                .catch(error => {
                    console.error('Assign teacher error:', error);
                    const errorMsg = error.data?.error || error.data?.message || 'Failed to assign teacher. Please try again.';
                    alert(errorMsg);
                });
        } else {
            alert('API client not available. Please refresh the page.');
        }
    });

    // Wire open/close
    openBtn.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Hide lists on outside click
    document.addEventListener('click', (e) => {
        if (!overlay.contains(e.target)) return;
        if (!studentList.contains(e.target) && e.target !== studentInput) studentList.classList.remove('show');
        if (!workList.contains(e.target) && e.target !== workInput) workList.classList.remove('show');
        if (!tutorList.contains(e.target) && e.target !== tutorInput) tutorList.classList.remove('show');
    });
}

// Create Invoice modal
function initializeCreateInvoiceModal() {
    const openBtn = document.getElementById('openCreateInvoiceModal');
    const overlay = document.getElementById('createInvoiceModalOverlay');
    const closeBtn = document.getElementById('closeCreateInvoiceModal');
    const cancelBtn = document.getElementById('cancelCreateInvoiceModal');
    const submitBtn = document.getElementById('submitCreateInvoiceModal');

    if (!openBtn || !overlay) return;

    const assignmentSelect = document.getElementById('invoiceAssignmentSelect');
    const studentNameInput = document.getElementById('invoiceStudentName');
    const studentEmailInput = document.getElementById('invoiceStudentEmail');
    const amountInput = document.getElementById('invoiceAmount');

    let selectedAssignment = null;
    let assignments = [];

    // Mock assignments data (front-end only, no backend dependency)
    async function fetchAssignments() {
        // Return mock assignments for UI demonstration
        return [
            {
                id: 1,
                assignment_id: 'ASG-2025-001',
                title: 'Research Paper on Machine Learning',
                subject: 'Computer Science',
                student_name: 'Alex Johnson',
                student__username: 'alex.johnson@email.com'
            },
            {
                id: 2,
                assignment_id: 'ASG-2025-002',
                title: 'Physics Lab Report - Quantum Mechanics',
                subject: 'Physics',
                student_name: 'Emma Wilson',
                student__username: 'emma.wilson@email.com'
            },
            {
                id: 3,
                assignment_id: 'ASG-2025-003',
                title: 'Mathematics Problem Set',
                subject: 'Mathematics',
                student_name: 'Maya Chen',
                student__username: 'maya.chen@email.com'
            },
            {
                id: 4,
                assignment_id: 'ASG-2025-004',
                title: 'Software Engineering Project',
                subject: 'Computer Science',
                student_name: 'Sarah Martinez',
                student__username: 'sarah.martinez@email.com'
            }
        ];
    }

    // Populate dropdown with assignments (using mock data)
    async function populateAssignmentDropdown() {
        // Always fetch fresh mock data
        assignments = await fetchAssignments();

        // Clear existing options except the first one
        if (assignmentSelect) {
            assignmentSelect.innerHTML = '<option value="">Select an assignment...</option>';

            // Add assignments to dropdown
            assignments.forEach(assignment => {
                const option = document.createElement('option');
                option.value = assignment.id;
                const assignmentId = assignment.assignment_id || '';
                const assignmentIdDisplay = assignmentId ? `[${assignmentId}] ` : '';
                const displayText = `${assignmentIdDisplay}${assignment.title} (${assignment.subject}) - ${assignment.student_name || assignment.student__username || 'Unknown Student'}`;
                option.textContent = displayText;
                option.dataset.assignment = JSON.stringify(assignment);
                assignmentSelect.appendChild(option);
            });
        }
    }

    // Handle assignment selection change
    function handleAssignmentChange() {
        const selectedOption = assignmentSelect.options[assignmentSelect.selectedIndex];
        if (!selectedOption || !selectedOption.value) {
            selectedAssignment = null;
            studentNameInput.value = '';
            studentEmailInput.value = '';
            return;
        }

        try {
            selectedAssignment = JSON.parse(selectedOption.dataset.assignment);

            // Auto-populate student info
            if (selectedAssignment.student_name) {
                studentNameInput.value = selectedAssignment.student_name;
            } else if (selectedAssignment.student__first_name || selectedAssignment.student__last_name) {
                studentNameInput.value = `${selectedAssignment.student__first_name || ''} ${selectedAssignment.student__last_name || ''}`.trim();
            } else {
                studentNameInput.value = selectedAssignment.student__username || '';
            }

            studentEmailInput.value = selectedAssignment.student__email || selectedAssignment.student__username || '';
            amountInput.focus();
        } catch (error) {
            console.error('Error parsing assignment data:', error);
        }
    }

    function openModal() {
        overlay.style.display = 'grid';
        document.body.classList.add('modal-open');
        resetForm();
        populateAssignmentDropdown().then(() => {
            assignmentSelect.focus();
        });
    }

    function closeModal() {
        overlay.style.display = 'none';
        document.body.classList.remove('modal-open');
    }

    function resetForm() {
        selectedAssignment = null;
        assignmentSelect.value = '';
        studentNameInput.value = '';
        studentEmailInput.value = '';
        amountInput.value = '';
    }

    // Submit invoice
    submitBtn.addEventListener('click', async () => {
        if (!selectedAssignment || !amountInput.value || parseFloat(amountInput.value) <= 0) {
            alert('Please select an assignment and enter a valid amount.');
            if (!selectedAssignment) assignmentSelect.focus();
            else amountInput.focus();
            return;
        }

        // Simulate API call delay
        setTimeout(() => {
            // Mock response - simulate successful submission (front-end only)
            const mockData = {
                success: true,
                invoice_number: 'INV-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
                invoice_request_id: 'INV-REQ-' + Date.now()
            };

            // Show success message
            if (typeof showSuccessMessage === 'function') {
                showSuccessMessage('Invoice request sent to admin successfully!');
            } else {
                alert('Invoice request sent to admin successfully!');
            }

            // Optionally add to invoice table
            const tbody = document.querySelector('#invoiceTable tbody');
            if (tbody) {
                const tr = document.createElement('tr');
                tr.setAttribute('data-invoice-status', 'pending_admin');
                tr.innerHTML = `
                    <td><code>${mockData.invoice_number}</code></td>
                    <td>${studentNameInput.value}</td>
                    <td>$${parseFloat(amountInput.value).toFixed(2)}</td>
                    <td><span class="status-pill warm">Pending Admin Approval</span></td>
                    <td>${new Date().toLocaleDateString()}</td>
                    <td><button class="ghost-button small">View</button></td>
                `;
                tbody.prepend(tr);
            }

            closeModal();
        }, 500); // Simulate 500ms API delay
    });

    // Wire up assignment change event
    assignmentSelect.addEventListener('change', handleAssignmentChange);

    // Wire open/close
    openBtn.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
}

// Helper function to get CSRF token (defined in HTML template, fallback here)
if (typeof getCsrfToken === 'undefined') {
    function getCsrfToken() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }
        // Fallback: try to get from meta tag if available
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) {
            return metaTag.getAttribute('content');
        }
        return '';
    }
}

// Helper function to show success message
function showSuccessMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #10b981;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        z-index: 10000;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        animation: slideInRight 0.3s ease-out;
    `;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

// Store conversations for Pre-Sign-in Chat and Communication (loaded from API) - prevent redeclaration
if (typeof window.preSignInConversations === 'undefined') {
    window.preSignInConversations = {};
}
if (typeof window.communicationConversations === 'undefined') {
    window.communicationConversations = {};
}
const preSignInConversations = window.preSignInConversations;
const communicationConversations = window.communicationConversations;

// Current active contacts
let currentPreSignInContact = null;
let currentCommunicationContact = null;

// Switch Pre-Sign-in Chat contact
function switchPreSignInContact(sessionId, studentName) {
    currentPreSignInContact = sessionId;
    const transcriptContainer = document.querySelector('#preSignInSection .chat-transcript');
    const chatSession = document.querySelector('#preSignInSection .chat-session');
    const chatStudent = document.querySelector('#preSignInSection .chat-student');
    const messageInput = document.getElementById('preSignInMessageInput');

    if (!transcriptContainer) return;

    // Update header
    if (chatSession) {
        chatSession.textContent = `Ref #${sessionId} · Session ID ${sessionId.slice(-4)}`;
    }
    if (chatStudent) {
        chatStudent.textContent = `Name: ${studentName}`;
    }
    if (messageInput) {
        messageInput.placeholder = `Respond to ${studentName}...`;
    }

    // Load conversation
    const conversation = preSignInConversations[sessionId] || [];
    transcriptContainer.innerHTML = '';

    conversation.forEach(msg => {
        let messageDiv;
        if (msg.audioUrl) {
            messageDiv = createVoiceMessageElement(msg.audioUrl);
        } else if (msg.fileName) {
            // Recreate file message with stored file URL
            messageDiv = createFileMessageElement({
                name: msg.fileName,
                size: msg.fileSize || 0,
                fileUrl: msg.fileUrl || null
            });
        } else {
            messageDiv = createTextMessageElement(msg.message, msg.isUser, studentName);
        }
        transcriptContainer.appendChild(messageDiv);
    });

    scrollToBottom(transcriptContainer);
}

// Switch Communication tab contact
function switchCommunicationContact(studentName) {
    currentCommunicationContact = studentName;
    const transcriptContainer = document.querySelector('#communicationSection .chat-transcript');
    const chatSession = document.querySelector('#communicationSection .chat-session');
    const chatStudent = document.querySelector('#communicationSection .chat-student');
    const messageInput = document.getElementById('communicationMessageInput');

    if (!transcriptContainer) return;

    // Update header - try to find invoice ref from thread card
    const activeThreadCard = document.querySelector('.thread-card.active');
    const threadMeta = activeThreadCard?.querySelector('.thread-meta')?.textContent || '';
    const invoiceMatch = threadMeta.match(/INV-\d+/);
    const invoiceRef = invoiceMatch ? invoiceMatch[0] : 'INV-2478';

    if (chatSession) {
        chatSession.textContent = `Ref #${invoiceRef} · Thread`;
    }
    if (chatStudent) {
        chatStudent.textContent = `Name: ${studentName}`;
    }
    if (messageInput) {
        messageInput.placeholder = `Respond to ${studentName}...`;
    }

    // Load conversation
    const conversation = communicationConversations[studentName] || [];
    transcriptContainer.innerHTML = '';

    conversation.forEach(msg => {
        let messageDiv;
        if (msg.audioUrl) {
            messageDiv = createVoiceMessageElement(msg.audioUrl);
        } else if (msg.fileName) {
            // Recreate file message with stored file URL
            messageDiv = createFileMessageElement({
                name: msg.fileName,
                size: msg.fileSize || 0,
                fileUrl: msg.fileUrl || null
            });
        } else {
            messageDiv = createTextMessageElement(msg.message, msg.isUser, studentName);
        }
        transcriptContainer.appendChild(messageDiv);
    });

    scrollToBottom(transcriptContainer);
}

// Initialize chat composers for Pre-Sign-in Chat and Communication sections
function initializeChatComposers() {
    // Initialize Pre-Sign-in Chat composer
    initializeChatComposer(
        'preSignInMessageInput',
        'preSignInMicrophoneBtn',
        'preSignInAttachmentBtn',
        'preSignInSendBtn',
        'preSignInFileInput',
        '#preSignInSection .chat-transcript',
        'preSignIn'
    );

    // Initialize Communication composer
    initializeChatComposer(
        'communicationMessageInput',
        'communicationMicrophoneBtn',
        'communicationAttachmentBtn',
        'communicationSendBtn',
        'communicationFileInput',
        '#communicationSection .chat-transcript',
        'communication'
    );
}

// Generic function to initialize chat composer functionality
function initializeChatComposer(messageInputId, microphoneBtnId, attachmentBtnId, sendBtnId, fileInputId, transcriptSelector, chatType) {
    const messageInput = document.getElementById(messageInputId);
    const microphoneBtn = document.getElementById(microphoneBtnId);
    const attachmentBtn = document.getElementById(attachmentBtnId);
    const sendBtn = document.getElementById(sendBtnId);
    const fileInput = document.getElementById(fileInputId);
    const transcriptContainer = document.querySelector(transcriptSelector);

    if (!messageInput || !sendBtn) return;

    // Load initial conversation
    if (transcriptContainer && chatType === 'preSignIn') {
        const activeChatItem = document.querySelector('#preChatList .chat-item.active');
        const studentName = activeChatItem?.querySelector('.chat-title')?.textContent.replace('Name: ', '') || 'Student';
        const conversation = preSignInConversations[currentPreSignInContact] || [];
        conversation.forEach(msg => {
            let messageDiv;
            if (msg.audioUrl) {
                messageDiv = createVoiceMessageElement(msg.audioUrl);
            } else if (msg.fileName) {
                messageDiv = createFileMessageElement({
                    name: msg.fileName,
                    size: msg.fileSize || 0,
                    fileUrl: msg.fileUrl || null
                });
            } else {
                messageDiv = createTextMessageElement(msg.message, msg.isUser, studentName);
            }
            transcriptContainer.appendChild(messageDiv);
        });
        scrollToBottom(transcriptContainer);
    } else if (transcriptContainer && chatType === 'communication') {
        const conversation = communicationConversations[currentCommunicationContact] || [];
        conversation.forEach(msg => {
            let messageDiv;
            if (msg.audioUrl) {
                messageDiv = createVoiceMessageElement(msg.audioUrl);
            } else if (msg.fileName) {
                messageDiv = createFileMessageElement({
                    name: msg.fileName,
                    size: msg.fileSize || 0,
                    fileUrl: msg.fileUrl || null
                });
            } else {
                messageDiv = createTextMessageElement(msg.message, msg.isUser, currentCommunicationContact);
            }
            transcriptContainer.appendChild(messageDiv);
        });
        scrollToBottom(transcriptContainer);
    }

    // Microphone/Voice message functionality
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    if (microphoneBtn) {
        microphoneBtn.addEventListener('click', async function () {
            if (!isRecording) {
                // Start recording
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = function (event) {
                        audioChunks.push(event.data);
                    };

                    mediaRecorder.onstop = function () {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        const audioUrl = URL.createObjectURL(audioBlob);

                        // Create voice message element
                        if (transcriptContainer) {
                            const messageDiv = createVoiceMessageElement(audioUrl);
                            transcriptContainer.appendChild(messageDiv);
                            scrollToBottom(transcriptContainer);

                            // Save voice message to conversation storage
                            if (chatType === 'preSignIn') {
                                if (!preSignInConversations[currentPreSignInContact]) {
                                    preSignInConversations[currentPreSignInContact] = [];
                                }
                                preSignInConversations[currentPreSignInContact].push({ message: '[Voice Message]', isUser: true, audioUrl });
                            } else if (chatType === 'communication') {
                                if (!communicationConversations[currentCommunicationContact]) {
                                    communicationConversations[currentCommunicationContact] = [];
                                }
                                communicationConversations[currentCommunicationContact].push({ message: '[Voice Message]', isUser: true, audioUrl });
                            }
                        }

                        // Stop all tracks
                        stream.getTracks().forEach(track => track.stop());
                    };

                    mediaRecorder.start();
                    isRecording = true;
                    microphoneBtn.classList.add('recording');
                    microphoneBtn.style.background = '#ff5c5c';
                    microphoneBtn.title = 'Stop recording';

                    // Visual feedback
                    const icon = microphoneBtn.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-microphone');
                        icon.classList.add('fa-stop');
                    }
                } catch (error) {
                    console.error('Error accessing microphone:', error);
                    alert('Could not access microphone. Please check your permissions.');
                }
            } else {
                // Stop recording
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                    isRecording = false;
                    microphoneBtn.classList.remove('recording');
                    microphoneBtn.style.background = '';
                    microphoneBtn.title = 'Voicemail';

                    const icon = microphoneBtn.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-stop');
                        icon.classList.add('fa-microphone');
                    }
                }
            }
        });
    }

    // Attachment functionality
    if (attachmentBtn && fileInput) {
        attachmentBtn.addEventListener('click', function () {
            fileInput.click();
        });

        fileInput.addEventListener('change', function (e) {
            const files = e.target.files;
            if (files.length > 0 && transcriptContainer) {
                Array.from(files).forEach(file => {
                    // Create object URL for the file
                    const fileUrl = URL.createObjectURL(file);
                    const messageDiv = createFileMessageElement(file, fileUrl);
                    transcriptContainer.appendChild(messageDiv);
                    scrollToBottom(transcriptContainer);

                    // Save file attachment to conversation storage with file URL
                    if (chatType === 'preSignIn') {
                        if (!preSignInConversations[currentPreSignInContact]) {
                            preSignInConversations[currentPreSignInContact] = [];
                        }
                        preSignInConversations[currentPreSignInContact].push({
                            message: `[File: ${file.name}]`,
                            isUser: true,
                            fileName: file.name,
                            fileSize: file.size,
                            fileUrl: fileUrl,
                            fileType: file.type
                        });
                    } else if (chatType === 'communication') {
                        if (!communicationConversations[currentCommunicationContact]) {
                            communicationConversations[currentCommunicationContact] = [];
                        }
                        communicationConversations[currentCommunicationContact].push({
                            message: `[File: ${file.name}]`,
                            isUser: true,
                            fileName: file.name,
                            fileSize: file.size,
                            fileUrl: fileUrl,
                            fileType: file.type
                        });
                    }
                });
            }
            // Reset file input
            fileInput.value = '';
        });
    }

    // Send message functionality
    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        if (transcriptContainer) {
            // Get current student name for proper message display
            let studentName = null;
            if (chatType === 'preSignIn') {
                const activeChatItem = document.querySelector('#preChatList .chat-item.active');
                studentName = activeChatItem?.querySelector('.chat-title')?.textContent.replace('Name: ', '') || null;
            } else if (chatType === 'communication') {
                studentName = currentCommunicationContact;
            }

            const messageDiv = createTextMessageElement(message, true, studentName);
            transcriptContainer.appendChild(messageDiv);
            scrollToBottom(transcriptContainer);

            // Save to conversation storage
            if (chatType === 'preSignIn') {
                if (!preSignInConversations[currentPreSignInContact]) {
                    preSignInConversations[currentPreSignInContact] = [];
                }
                preSignInConversations[currentPreSignInContact].push({ message, isUser: true });
            } else if (chatType === 'communication') {
                if (!communicationConversations[currentCommunicationContact]) {
                    communicationConversations[currentCommunicationContact] = [];
                }
                communicationConversations[currentCommunicationContact].push({ message, isUser: true });
            }
        }

        messageInput.value = '';

        // Send message via API if available
        if (chatType === 'communication' && typeof apiClient !== 'undefined') {
            // Try to get thread ID from active thread card
            const activeThreadCard = document.querySelector('.thread-card.active');
            const threadId = activeThreadCard?.getAttribute('data-thread-id');

            if (threadId) {
                try {
                    await apiClient.sendMessage(threadId, message);
                    // Message already displayed, just reload to get any server-side processing
                    // Optionally reload messages to show server timestamp
                    if (currentCommunicationContact) {
                        selectCommunicationThread(threadId, currentCommunicationContact);
                    }
                } catch (error) {
                    console.error('Error sending message:', error);
                    alert('Failed to send message. Please try again.');
                }
            } else {
                alert('Please select a communication thread first.');
            }
        } else if (chatType === 'preSignIn') {
            // Pre-sign-in chat - would need pre-sign-in chat API
            console.log('Pre-sign-in chat message sent:', message);
            // TODO: Implement pre-sign-in chat API when available
        }
    }

    sendBtn.addEventListener('click', sendMessage);

    messageInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

// Helper function to create text message element
function createTextMessageElement(text, isOutbound, senderName = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOutbound ? 'outbound' : 'inbound'}`;

    const metaSpan = document.createElement('span');
    metaSpan.className = 'message-meta';

    if (isOutbound) {
        metaSpan.textContent = 'You · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        // Use sender name if provided, otherwise extract from current contact
        let name = senderName;
        if (!name) {
            // Try to get name from active chat item or thread card
            const activeChatItem = document.querySelector('#preChatList .chat-item.active');
            const activeThreadCard = document.querySelector('.thread-card.active');
            if (activeChatItem) {
                name = activeChatItem.querySelector('.chat-title')?.textContent.replace('Name: ', '') || 'Student';
            } else if (activeThreadCard) {
                name = activeThreadCard.querySelector('.thread-title')?.textContent || 'Student';
            } else {
                name = 'Student';
            }
        }
        metaSpan.textContent = name + ' · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const textP = document.createElement('p');
    textP.className = 'message-text';
    textP.textContent = text;

    messageDiv.appendChild(metaSpan);
    messageDiv.appendChild(textP);

    return messageDiv;
}

// Helper function to create voice message element
function createVoiceMessageElement(audioUrl) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message outbound';

    const metaSpan = document.createElement('span');
    metaSpan.className = 'message-meta';
    metaSpan.textContent = 'You · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const audioContainer = document.createElement('div');
    audioContainer.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-top: 8px;';

    const audio = document.createElement('audio');
    audio.src = audioUrl;
    audio.controls = true;
    audio.style.cssText = 'flex: 1; max-width: 300px;';

    audioContainer.appendChild(audio);

    messageDiv.appendChild(metaSpan);
    messageDiv.appendChild(audioContainer);

    return messageDiv;
}

// Helper function to create file message element
function createFileMessageElement(file, fileUrl = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message outbound';

    const metaSpan = document.createElement('span');
    metaSpan.className = 'message-meta';
    metaSpan.textContent = 'You · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const fileContainer = document.createElement('div');
    fileContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-top: 8px; padding: 10px; background: rgba(17, 88, 229, 0.05); border-radius: 8px;';

    const fileInfoRow = document.createElement('div');
    fileInfoRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    const fileIcon = document.createElement('i');
    fileIcon.className = 'fas fa-paperclip';
    fileIcon.style.cssText = 'color: var(--primary); font-size: 1.2rem;';

    const fileInfo = document.createElement('div');
    fileInfo.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 4px;';

    // Get file name - handle both File objects and plain objects
    const fileNameValue = (file instanceof File) ? file.name : (file.name || file.fileName || 'Unknown file');
    const fileSizeValue = (file instanceof File) ? file.size : (file.size || 0);
    const storedFileUrl = fileUrl || (typeof file === 'object' ? file.fileUrl : null);

    const fileName = document.createElement('span');
    fileName.textContent = fileNameValue;
    fileName.style.cssText = 'font-weight: 600; font-size: 0.9rem;';

    const fileSize = document.createElement('span');
    fileSize.textContent = `(${(fileSizeValue / (1024 * 1024)).toFixed(2)} MB)`;
    fileSize.style.cssText = 'font-size: 0.8rem; color: var(--muted-text);';

    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);

    fileInfoRow.appendChild(fileIcon);
    fileInfoRow.appendChild(fileInfo);

    // View/Open button
    const viewBtn = document.createElement('button');
    viewBtn.className = 'ghost-button';
    viewBtn.style.cssText = 'margin-top: 4px; padding: 6px 12px; font-size: 0.85rem; align-self: flex-start;';
    viewBtn.innerHTML = '<i class="fas fa-external-link-alt"></i> View File';

    // Handle view/open in new tab
    if (storedFileUrl) {
        // If we have a stored file URL, open it in a new tab
        viewBtn.addEventListener('click', function (e) {
            e.preventDefault();
            window.open(storedFileUrl, '_blank');
        });
    } else if (file && file instanceof File) {
        // If we have a File object, create URL and open in new tab
        const url = URL.createObjectURL(file);
        viewBtn.addEventListener('click', function (e) {
            e.preventDefault();
            window.open(url, '_blank');
        });
    } else {
        // No file available - disable button or show message
        viewBtn.disabled = true;
        viewBtn.style.opacity = '0.5';
        viewBtn.title = 'File not available';
    }

    fileContainer.appendChild(fileInfoRow);
    fileContainer.appendChild(viewBtn);

    messageDiv.appendChild(metaSpan);
    messageDiv.appendChild(fileContainer);

    return messageDiv;
}

// Helper function to scroll to bottom
function scrollToBottom(container) {
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// Initialize Profile Picture functionality
function initializeProfilePicture() {
    const profilePictureInput = document.getElementById('profilePictureInput');
    const profilePictureImg = document.getElementById('profilePictureImg');
    const profilePictureIcon = document.getElementById('profilePictureIcon');
    const profilePicturePreview = document.getElementById('profilePicturePreview');
    const removeProfilePictureBtn = document.getElementById('removeProfilePictureBtn');
    const profilePictureError = document.getElementById('profilePictureError');

    // Load existing profile picture on page load
    if (typeof apiClient !== 'undefined' && apiClient.getProfile) {
        apiClient.getProfile()
            .then(data => {
                if (data && data.profile_picture_url) {
                    updateProfilePictureDisplay(data.profile_picture_url);
                    updateHeaderAvatar(data.profile_picture_url);
                }
            })
            .catch(error => {
                console.error('Error loading profile picture:', error);
            });
    }

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
                    showProfilePictureError('Please select a valid image file (JPG, PNG, or GIF).');
                    profilePictureInput.value = '';
                    return;
                }

                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    showProfilePictureError('Image size must be less than 5MB.');
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
        removeProfilePictureBtn.addEventListener('click', function (e) {
            e.preventDefault();
            removeProfilePicture();
        });
    }

    function showProfilePictureError(message) {
        if (profilePictureError) {
            profilePictureError.textContent = message;
            profilePictureError.style.display = 'block';
        } else if (typeof showErrorMessage === 'function') {
            showErrorMessage(message);
        } else {
            alert(message);
        }
    }

    // Upload profile picture to server
    async function uploadProfilePicture(file) {
        try {
            // Clear any previous errors first
            if (profilePictureError) {
                profilePictureError.style.display = 'none';
                profilePictureError.textContent = '';
            }

            const formData = new FormData();
            formData.append('profile_picture', file);

            // Get CSRF token - try multiple methods
            function getCsrfToken() {
                // First, try to get from hidden input field (Django's {% csrf_token %})
                const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
                if (csrfInput && csrfInput.value) {
                    return csrfInput.value;
                }
                
                // Second, try to get from meta tag
                const csrfMeta = document.querySelector('meta[name="csrf-token"]');
                if (csrfMeta && csrfMeta.content) {
                    return csrfMeta.content;
                }
                
                // Third, try to get from cookies (may not work if HTTPONLY is True)
                if (document.cookie && document.cookie !== '') {
                    const cookies = document.cookie.split(';');
                    for (let i = 0; i < cookies.length; i++) {
                        const cookie = cookies[i].trim();
                        if (cookie.substring(0, 'csrftoken'.length + 1) === ('csrftoken' + '=')) {
                            return decodeURIComponent(cookie.substring('csrftoken'.length + 1));
                        }
                    }
                }
                
                return null;
            }

            const csrftoken = getCsrfToken();
            if (!csrftoken) {
                showProfilePictureError('CSRF token not found. Please refresh the page and try again.');
                return;
            }

            const response = await fetch('/account/api/accounts/profile/', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'X-CSRFToken': csrftoken
                },
                body: formData
            });

            // Check if response is ok before parsing JSON
            if (!response.ok) {
                const text = await response.text();
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = JSON.parse(text);
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    if (text && !text.includes('<!DOCTYPE')) {
                        errorMessage = text;
                    }
                }
                showProfilePictureError(errorMessage);
                return;
            }

            const data = await response.json();

            if (response.ok && data.success) {
                console.log('Profile picture uploaded successfully:', data);

                // Clear error message
                if (profilePictureError) {
                    profilePictureError.style.display = 'none';
                    profilePictureError.textContent = '';
                }

                // Use profile picture URL from response if available
                let profilePictureUrl = null;
                if (data.profile_picture_url) {
                    profilePictureUrl = data.profile_picture_url;
                } else if (data.profile_picture) {
                    profilePictureUrl = data.profile_picture;
                }

                // Update profile picture display and header avatar
                if (profilePictureUrl) {
                    updateProfilePictureDisplay(profilePictureUrl);
                    updateHeaderAvatar(profilePictureUrl);
                } else {
                    // Fallback: Try to reload profile to get updated URL
                    if (typeof loadUserProfile === 'function') {
                        loadUserProfile().then((profileData) => {
                            // After profile loads, update header avatar
                            const profilePictureImg = document.getElementById('profilePictureImg');
                            if (profilePictureImg && profilePictureImg.src) {
                                updateHeaderAvatar(profilePictureImg.src);
                            } else if (profileData && profileData.profile_picture_url) {
                                updateHeaderAvatar(profileData.profile_picture_url);
                            }
                        }).catch(err => {
                            console.error('Error reloading profile after picture upload:', err);
                            // Use preview URL as fallback
                            const profilePictureImg = document.getElementById('profilePictureImg');
                            if (profilePictureImg && profilePictureImg.src) {
                                updateHeaderAvatar(profilePictureImg.src);
                            }
                        });
                    } else {
                        // Fallback: Use the preview URL temporarily
                        const profilePictureImg = document.getElementById('profilePictureImg');
                        if (profilePictureImg && profilePictureImg.src) {
                            updateHeaderAvatar(profilePictureImg.src);
                        }
                    }
                }

                if (typeof showSuccessMessage === 'function') {
                    showSuccessMessage('Profile picture updated successfully!');
                }
            } else {
                const errorMsg = data.error || data.message || 'Failed to upload profile picture';
                console.error('Profile picture upload failed:', errorMsg);
                showProfilePictureError(errorMsg);
            }
        } catch (error) {
            console.error('Profile picture upload error:', error);
            showProfilePictureError('Failed to upload profile picture. Please try again.');
        }
    }

    // Remove profile picture
    async function removeProfilePicture() {
        try {
            // Clear any previous errors first
            if (profilePictureError) {
                profilePictureError.style.display = 'none';
                profilePictureError.textContent = '';
            }

            // Get CSRF token - try multiple methods
            function getCsrfToken() {
                // First, try to get from hidden input field (Django's {% csrf_token %})
                const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
                if (csrfInput && csrfInput.value) {
                    return csrfInput.value;
                }
                
                // Second, try to get from meta tag
                const csrfMeta = document.querySelector('meta[name="csrf-token"]');
                if (csrfMeta && csrfMeta.content) {
                    return csrfMeta.content;
                }
                
                // Third, try to get from cookies (may not work if HTTPONLY is True)
                if (document.cookie && document.cookie !== '') {
                    const cookies = document.cookie.split(';');
                    for (let i = 0; i < cookies.length; i++) {
                        const cookie = cookies[i].trim();
                        if (cookie.substring(0, 'csrftoken'.length + 1) === ('csrftoken' + '=')) {
                            return decodeURIComponent(cookie.substring('csrftoken'.length + 1));
                        }
                    }
                }
                
                return null;
            }

            const csrftoken = getCsrfToken();
            if (!csrftoken) {
                alert('CSRF token not found. Please refresh the page and try again.');
                return;
            }

            const formData = new FormData();
            formData.append('remove_profile_picture', 'true');

            const response = await fetch('/account/api/accounts/profile/', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'X-CSRFToken': csrftoken
                },
                body: formData
            });

            // Check if response is ok before parsing JSON
            if (!response.ok) {
                const text = await response.text();
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = JSON.parse(text);
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    if (text && !text.includes('<!DOCTYPE')) {
                        errorMessage = text;
                    }
                }
                alert('Error: ' + errorMessage);
                return;
            }

            const data = await response.json();

            if (response.ok && data.success) {
                console.log('Profile picture removed successfully:', data);

                // Clear error message
                if (profilePictureError) {
                    profilePictureError.style.display = 'none';
                    profilePictureError.textContent = '';
                }

                // Reset preview
                updateProfilePictureDisplay('');

                // Update header avatar
                updateHeaderAvatar('');

                if (typeof showSuccessMessage === 'function') {
                    showSuccessMessage('Profile picture removed successfully!');
                }

                // Reload profile to sync all data
                if (typeof loadUserProfile === 'function') {
                    loadUserProfile();
                }
            } else {
                const errorMsg = data.error || data.message || 'Failed to remove profile picture';
                console.error('Remove profile picture failed:', errorMsg);
                showProfilePictureError(errorMsg);
            }
        } catch (error) {
            console.error('Remove profile picture error:', error);
            showProfilePictureError('Failed to remove profile picture. Please try again.');
        }
    }
}

// Update profile picture display
function updateProfilePictureDisplay(pictureUrl) {
    const profilePictureImg = document.getElementById('profilePictureImg');
    const profilePictureIcon = document.getElementById('profilePictureIcon');
    const removeProfilePictureBtn = document.getElementById('removeProfilePictureBtn');

    if (pictureUrl) {
        if (profilePictureImg) {
            profilePictureImg.src = pictureUrl;
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
            profilePictureIcon.style.display = 'flex';
        }
        if (removeProfilePictureBtn) {
            removeProfilePictureBtn.style.display = 'none';
        }
    }
}

// Update header avatar
function updateHeaderAvatar(pictureUrl) {
    const headerProfilePicture = document.getElementById('headerProfilePicture');
    const headerProfileIcon = document.getElementById('headerProfileIcon');

    if (pictureUrl) {
        if (headerProfilePicture) {
            headerProfilePicture.src = pictureUrl;
            headerProfilePicture.style.display = 'block';
        }
        if (headerProfileIcon) {
            headerProfileIcon.style.display = 'none';
        }
    } else {
        if (headerProfilePicture) {
            headerProfilePicture.src = '';
            headerProfilePicture.style.display = 'none';
        }
        if (headerProfileIcon) {
            headerProfileIcon.style.display = 'flex';
        }
    }
}

// Profile Form Handling
function initializeProfileForm() {
    const profileForm = document.getElementById('profileForm');
    if (!profileForm) return;

    profileForm.addEventListener('submit', handleProfileUpdate);

    // Add real-time validation for profile form
    const formInputs = profileForm.querySelectorAll('.form-input');
    formInputs.forEach(input => {
        if (!input.readOnly) {
            input.addEventListener('blur', validateField);
            input.addEventListener('input', clearFieldError);
        }
    });

    // Initialize profile picture functionality
    initializeProfilePicture();
}


function loadUserProfile() {
    // Load user profile data from API - use direct fetch as fallback if apiClient not available
    console.log('Loading user profile from database...');

    // Try apiClient first if available
    if (typeof apiClient !== 'undefined' && apiClient.getProfile) {
        return apiClient.getProfile()
            .then(result => {
                console.log('Profile data loaded from database via apiClient:', result);
                // Handle both direct data and wrapped response
                let data = null;
                if (result && result.profile) {
                    data = result.profile;
                } else if (result && (result.first_name || result.email)) {
                    // Direct data object
                    data = result;
                }

                if (data) {
                    return processProfileData(data);
                } else {
                    console.warn('No profile data in apiClient response, trying direct fetch');
                    return loadUserProfileDirect();
                }
            })
            .catch(error => {
                console.warn('apiClient.getProfile failed, trying direct fetch:', error);
                return loadUserProfileDirect();
            });
    } else {
        // Fallback to direct fetch
        console.log('apiClient not available, using direct fetch');
        return loadUserProfileDirect();
    }
}

function loadUserProfileDirect() {
    // Direct fetch fallback when apiClient is not available
    return fetch('/account/api/accounts/profile/', {
        method: 'GET',
        credentials: 'include',
        headers: {
            'Accept': 'application/json',
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            // API returns: { success: true, profile: {...} }
            // Handle both direct response and wrapped response
            let data = null;
            if (result.success && result.profile) {
                data = result.profile;
            } else if (result.first_name || result.email) {
                // Direct data object
                data = result;
            }

            if (data) {
                console.log('Profile data loaded from database via direct fetch:', data);
                return processProfileData(data);
            } else {
                console.warn('No profile data found in API response:', result);
                return null;
            }
        })
        .catch(error => {
            console.error('Error loading user profile:', error);
            return null;
        });
}

function processProfileData(data) {
    if (!data) {
        console.warn('No profile data received');
        return null;
    }

    console.log('Processing profile data:', data);

    // Populate form fields
    const csrepIdField = document.getElementById('csrepId');
    const firstNameField = document.getElementById('firstName');
    const lastNameField = document.getElementById('lastName');
    const emailField = document.getElementById('email');

    // Format CS-Rep ID - use csrep_id from database or user id as fallback
    if (csrepIdField) {
        if (data.csrep_id) {
            // Show the CS-Rep ID from database
            csrepIdField.value = `CS-REP-${String(data.csrep_id).padStart(4, '0')}`;
            console.log('CS-Rep ID set to:', csrepIdField.value);
        } else if (data.id) {
            // Fallback: use user ID if csrep_id not available
            csrepIdField.value = `CS-REP-${data.id.substring(0, 8).toUpperCase()}`;
            console.log('CS-Rep ID set to user ID:', csrepIdField.value);
        } else if (data.user_id) {
            // Another fallback: use user_id
            csrepIdField.value = `CS-REP-${data.user_id.substring(0, 8).toUpperCase()}`;
            console.log('CS-Rep ID set to user_id:', csrepIdField.value);
        }
    }

    // Populate form fields
    if (firstNameField && data.first_name) {
        firstNameField.value = data.first_name;
        console.log('First name loaded:', data.first_name);
    }
    if (lastNameField && data.last_name) {
        lastNameField.value = data.last_name;
        console.log('Last name loaded:', data.last_name);
    }
    if (emailField && data.email) {
        emailField.value = data.email;
        console.log('Email loaded:', data.email);
    }

    // Update header name with first name from database (PRIORITY) - ALWAYS UPDATE
    const headerName = document.getElementById('headerUserName');
    if (headerName) {
        if (data.first_name) {
            headerName.textContent = data.first_name;
            console.log('✓ Header name updated to first name:', data.first_name);
        } else if (data.email) {
            // Fallback to email username if first name not available
            headerName.textContent = data.email.split('@')[0];
            console.log('Header name updated to email:', data.email.split('@')[0]);
        }
    } else {
        console.warn('Header name element not found');
    }

    // Load profile picture
    if (data.profile_picture_url || data.profile_picture) {
        const pictureUrl = data.profile_picture_url || data.profile_picture;
        console.log('Profile picture URL found:', pictureUrl);
        updateProfilePictureDisplay(pictureUrl);
        updateHeaderAvatar(pictureUrl);
    } else {
        // Show icon for users without profile picture
        const profilePictureImg = document.getElementById('profilePictureImg');
        const profilePictureIcon = document.getElementById('profilePictureIcon');
        if (profilePictureImg) profilePictureImg.style.display = 'none';
        if (profilePictureIcon) profilePictureIcon.style.display = 'flex';
        console.log('No profile picture - showing default icon');
    }

    return data;
}

function handleProfileUpdate(e) {
    e.preventDefault();

    const form = e.target;
    const updateBtn = form.querySelector('.update-btn');
    const formData = new FormData(form);

    // Show loading state
    if (updateBtn) {
        updateBtn.classList.add('loading');
        updateBtn.disabled = true;
        const icon = updateBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-spinner fa-spin';
    }

    // Validate form
    if (!validateProfileForm(form)) {
        if (updateBtn) {
            updateBtn.classList.remove('loading');
            updateBtn.disabled = false;
            const icon = updateBtn.querySelector('i');
            if (icon) icon.className = 'fas fa-save';
        }
        return;
    }

    // Get CSRF token - try multiple methods
    function getCsrfToken() {
        // First, try to get from hidden input field (Django's {% csrf_token %})
        const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
        if (csrfInput && csrfInput.value) {
            return csrfInput.value;
        }
        
        // Second, try to get from meta tag
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (csrfMeta && csrfMeta.content) {
            return csrfMeta.content;
        }
        
        // Third, try to get from cookies (may not work if HTTPONLY is True)
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, 'csrftoken'.length + 1) === ('csrftoken' + '=')) {
                    return decodeURIComponent(cookie.substring('csrftoken'.length + 1));
                }
            }
        }
        
        return null;
    }

    // Prepare form data - CS Rep can update: first_name, last_name, email
    const submitFormData = new FormData();
    submitFormData.append('first_name', formData.get('firstName') || form.querySelector('#firstName')?.value.trim() || '');
    submitFormData.append('last_name', formData.get('lastName') || form.querySelector('#lastName')?.value.trim() || '');
    submitFormData.append('email', formData.get('email') || form.querySelector('#email')?.value.trim() || '');

    // Include profile picture if uploaded
    const profilePictureInput = document.getElementById('profilePictureInput');
    if (profilePictureInput && profilePictureInput.files.length > 0) {
        submitFormData.append('profile_picture', profilePictureInput.files[0]);
    }

    // Submit profile update using direct fetch (same as profile.html template)
    const csrftoken = getCsrfToken();
    if (!csrftoken) {
        const errorMsg = 'CSRF token not found. Please refresh the page and try again.';
        if (typeof showErrorMessage === 'function') {
            showErrorMessage(errorMsg);
        } else {
            alert('Error: ' + errorMsg);
        }
        if (updateBtn) {
            updateBtn.classList.remove('loading');
            updateBtn.disabled = false;
            const icon = updateBtn.querySelector('i');
            if (icon) icon.className = 'fas fa-save';
        }
        return;
    }

    fetch('/account/api/accounts/profile/', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'X-CSRFToken': csrftoken
        },
        body: submitFormData
    })
        .then(response => {
            // Check if response is ok before parsing JSON
            if (!response.ok) {
                return response.text().then(text => {
                    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    try {
                        const errorData = JSON.parse(text);
                        errorMessage = errorData.error || errorData.message || errorMessage;
                    } catch (e) {
                        // If JSON parsing fails, use the status text
                        if (text && !text.includes('<!DOCTYPE')) {
                            errorMessage = text;
                        }
                    }
                    throw new Error(errorMessage);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log('Profile updated successfully:', data);

                // Update header name with first name from form
                const firstName = form.querySelector('#firstName')?.value.trim() || '';
                const headerName = document.getElementById('headerUserName');
                if (headerName && firstName) {
                    headerName.textContent = firstName;
                    console.log('Header name updated to:', firstName);
                }

                // Update header avatar - use response URL if available, otherwise use preview
                if (data.profile_picture_url) {
                    if (typeof updateCSRepHeaderAvatar === 'function') {
                        updateCSRepHeaderAvatar(data.profile_picture_url);
                    } else if (typeof updateHeaderAvatar === 'function') {
                        updateHeaderAvatar(data.profile_picture_url);
                    }
                } else if (profilePictureInput && profilePictureInput.files.length > 0) {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        if (typeof updateCSRepHeaderAvatar === 'function') {
                            updateCSRepHeaderAvatar(e.target.result);
                        } else if (typeof updateHeaderAvatar === 'function') {
                            updateHeaderAvatar(e.target.result);
                        }
                    };
                    reader.readAsDataURL(profilePictureInput.files[0]);
                }

                // Reload profile to get updated data
                if (typeof loadUserProfile === 'function') {
                    loadUserProfile().catch(err => {
                        console.error('Error reloading profile:', err);
                    });
                }

                if (typeof showSuccessMessage === 'function') {
                    showSuccessMessage('Profile updated successfully!');
                } else {
                    alert('Profile updated successfully!');
                }

                // Reload profile data to ensure sync
                if (typeof loadUserProfile === 'function') {
                    loadUserProfile();
                }

                if (updateBtn) {
                    updateBtn.classList.remove('loading');
                    updateBtn.disabled = false;
                    const icon = updateBtn.querySelector('i');
                    if (icon) icon.className = 'fas fa-save';
                }
            } else {
                const errorMsg = data.error || data.message || 'Failed to update profile. Please try again.';
                console.error('Profile update error:', errorMsg);
                if (typeof showErrorMessage === 'function') {
                    showErrorMessage(errorMsg);
                } else {
                    alert('Error: ' + errorMsg);
                }
                if (updateBtn) {
                    updateBtn.classList.remove('loading');
                    updateBtn.disabled = false;
                    const icon = updateBtn.querySelector('i');
                    if (icon) icon.className = 'fas fa-save';
                }
            }
        })
        .catch(error => {
            console.error('Profile update error:', error);
            const errorMsg = 'Failed to update profile. Please try again.';
            if (typeof showErrorMessage === 'function') {
                showErrorMessage(errorMsg);
            } else {
                alert('Error: ' + errorMsg);
            }
            if (updateBtn) {
                updateBtn.classList.remove('loading');
                updateBtn.disabled = false;
                const icon = updateBtn.querySelector('i');
                if (icon) icon.className = 'fas fa-save';
            }
        });
}


// Validation helpers
function validateField(e) {
    const field = e.target;
    const fieldName = field.name || field.id;
    clearFieldError(e);

    if (field.hasAttribute('required') && !field.value.trim()) {
        showFieldError(fieldName, 'This field is required');
        return false;
    }

    if (fieldName === 'phoneNumber' && field.value.trim()) {
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(field.value.trim())) {
            showFieldError(fieldName, 'Please enter a valid phone number');
            return false;
        }
    }

    return true;
}

function validateField(e) {
    const field = e.target;
    const fieldName = field.name || field.id;
    clearFieldError(e);

    if (field.hasAttribute('required') && !field.value.trim()) {
        showFieldError(fieldName, 'This field is required');
        return false;
    }

    if (fieldName === 'email' && field.value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value.trim())) {
            showFieldError(fieldName, 'Please enter a valid email address');
            return false;
        }
    }

    return true;
}

function validateProfileForm(form) {
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]:not([readonly])');

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            showFieldError(field.name || field.id, 'This field is required');
            isValid = false;
        }
    });

    // Validate email format if present
    const emailField = form.querySelector('#email');
    if (emailField && emailField.value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailField.value.trim())) {
            showFieldError('email', 'Please enter a valid email address');
            isValid = false;
        }
    }

    return isValid;
}

function clearFieldError(e) {
    const field = e.target;
    const fieldName = field.name || field.id;
    const errorElement = document.getElementById(fieldName + 'Error');
    if (errorElement) {
        errorElement.textContent = '';
    }
}

function showFieldError(fieldName, message) {
    const errorElement = document.getElementById(fieldName + 'Error');
    if (errorElement) {
        errorElement.textContent = message;
    }
}

function showErrorMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #ff5c5c;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        z-index: 10000;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        animation: slideInRight 0.3s ease-out;
    `;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

// Load all CS-Rep dashboard data from APIs
async function loadCSRepDashboardData() {
    console.log('Loading CS-Rep dashboard data...');

    try {
        // Load assignments
        if (typeof loadAllAssignments === 'function') {
            const assignments = await loadAllAssignments();
            renderCSRepAssignmentsTable(assignments);
        }
    } catch (error) {
        console.error('Error loading assignments:', error);
    }

    try {
        // Load invoices
        if (typeof loadCSRepInvoices === 'function') {
            const invoices = await loadCSRepInvoices();
            if (typeof renderInvoicesTable === 'function') {
                renderInvoicesTable(invoices, '#invoiceTable');
                updateInvoiceSummary(invoices);
            }
        }
    } catch (error) {
        console.error('Error loading invoices:', error);
    }

    try {
        // Load notifications
        await loadNotifications();
    } catch (error) {
        console.error('Error loading notifications:', error);
    }

    try {
        // Load announcements
        await loadAnnouncements();
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

// Render assignments table for CS-Rep (custom format)
function renderCSRepAssignmentsTable(assignments) {
    const tbody = document.querySelector('#csRepAssignmentsTable tbody');
    if (!tbody) return;

    if (assignments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--muted-text);">No assignments found</td></tr>';
        return;
    }

    tbody.innerHTML = assignments.map(assignment => {
        const studentName = assignment.student_name ||
            (assignment.student_detail ? `${assignment.student_detail.first_name || ''} ${assignment.student_detail.last_name || ''}`.trim() : 'Unknown');

        const teacherName = assignment.teacher_name ||
            (assignment.teacher_assignments && assignment.teacher_assignments.length > 0 ?
                `${assignment.teacher_assignments[0].teacher?.first_name || ''} ${assignment.teacher_assignments[0].teacher?.last_name || ''}`.trim() :
                'Not assigned');

        let statusClass = 'neutral';
        let statusText = 'Pending';
        if (assignment.status === 'in_process') {
            statusClass = 'warm';
            statusText = 'In Process';
        } else if (assignment.status === 'completed') {
            statusClass = 'converted';
            statusText = 'Completed';
        } else if (assignment.status === 'pending_invoice') {
            statusClass = 'followup';
            statusText = 'Pending Invoice';
        }

        return `
            <tr>
                <td><code>${assignment.assignment_code || assignment.assignment_id || 'N/A'}</code></td>
                <td>${studentName}</td>
                <td>${assignment.service_type || assignment.subject || 'General'}</td>
                <td>${teacherName === 'Not assigned' ? '<span style="color: var(--muted-text);">Not assigned</span>' : teacherName}</td>
                <td><span class="status-pill ${statusClass}">${statusText}</span></td>
                <td>
                    ${teacherName === 'Not assigned' ?
                `<button class="ghost-button small" onclick="openAssignTeacherModal(${assignment.id || assignment.assignment_id})">Assign</button>` :
                `<button class="ghost-button small" onclick="viewAssignment(${assignment.id || assignment.assignment_id})">View</button>`
            }
                </td>
            </tr>
        `;
    }).join('');
}

// Update invoice summary chips
function updateInvoiceSummary(invoices) {
    let totalSent = 0;
    let pendingAmount = 0;
    let overdueCount = 0;
    let paidAmount = 0;

    invoices.forEach(invoice => {
        const amount = parseFloat(invoice.total_amount || invoice.amount || 0);
        totalSent += amount;

        if (invoice.status === 'pending_payment' || invoice.status === 'pending_admin') {
            pendingAmount += amount;
        } else if (invoice.status === 'overdue') {
            overdueCount++;
            pendingAmount += amount;
        } else if (invoice.status === 'paid') {
            paidAmount += amount;
        }
    });

    const totalSentEl = document.getElementById('totalSentAmount');
    const pendingEl = document.getElementById('pendingAmount');
    const overdueEl = document.getElementById('overdueCount');
    const paidEl = document.getElementById('paidAmount');

    if (totalSentEl) totalSentEl.textContent = `$${totalSent.toFixed(2)}`;
    if (pendingEl) pendingEl.textContent = `$${pendingAmount.toFixed(2)}`;
    if (overdueEl) overdueEl.textContent = `${overdueCount} invoice${overdueCount !== 1 ? 's' : ''}`;
    if (paidEl) paidEl.textContent = `$${paidAmount.toFixed(2)}`;
}

// Update overview metrics
function updateOverviewMetrics(data) {
    // Legacy function kept for compatibility with older code paths.
    // The overview metrics are now fetched from the backend endpoint.
    if (typeof loadCSRepOverviewMetrics === 'function') {
        loadCSRepOverviewMetrics(getActiveOverviewRange());
    }
}

// CS-Rep Notifications
let csRepNotificationsList = [];
let csRepNotificationWebSocket = null;

// Load notifications
async function loadNotifications() {
    if (typeof apiClient === 'undefined' || !apiClient.getNotifications) return;

    try {
        const response = await apiClient.getNotifications({ role: 'cs_rep' });
        csRepNotificationsList = Array.isArray(response) ? response : (response.results || []);

        // Update notification badge
        updateCSRepNotificationBadge(csRepNotificationsList.filter(n => !n.is_read).length);

        // Initialize WebSocket for real-time notifications
        if (!csRepNotificationWebSocket && typeof initNotificationWebSocket !== 'undefined') {
            csRepNotificationWebSocket = initNotificationWebSocket(
                handleNewCSRepNotification,
                updateCSRepNotificationBadge,
                handleCSRepNotificationError
            );
        }
        renderNotifications(csRepNotificationsList);
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Render notifications in overview
function renderNotifications(notifications) {
    const alertsList = document.getElementById('notificationsAlertsList');
    if (!alertsList) return;

    if (notifications.length === 0) {
        alertsList.innerHTML = '<li style="text-align: center; padding: 2rem; color: var(--muted-text);">No new notifications</li>';
        return;
    }

    alertsList.innerHTML = notifications.slice(0, 5).map(notif => {
        const badgeClass = notif.notification_type === 'assignment' ? 'info' :
            notif.notification_type === 'invoice' ? 'warning' : 'neutral';
        const timeAgo = formatTimeAgo(notif.created_at);
        const unreadClass = notif.is_read ? '' : 'unread';

        return `
            <li data-id="${notif.notification_id}" class="${unreadClass}">
                <span class="alert-badge ${badgeClass} ${unreadClass}"></span>
                <div>
                    <p class="alert-text">${notif.title || notif.message}</p>
                    <p class="alert-meta">${timeAgo}</p>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="ghost-button" type="button" onclick="handleNotificationAction('${notif.notification_id}')">View</button>
                    <button class="ghost-button" type="button" data-action="delete">Delete</button>
                </div>
            </li>
        `;
    }).join('');
}

function handleNewCSRepNotification(notification) {
    csRepNotificationsList.unshift(notification);
    updateCSRepNotificationBadge(csRepNotificationsList.filter(n => !n.is_read).length);

    // Show toast notification
    if (notification.title) {
        showSuccessMessage(`${notification.title}: ${notification.message}`);
    }

    // Re-render notifications if dropdown is open
    const alertsList = document.getElementById('notificationsAlertsList');
    if (alertsList) {
        renderNotifications(csRepNotificationsList);
    }
}

function updateCSRepNotificationBadge(count) {
    // WS-driven: counts are pushed via ws/dashboard/ (realtimeDashboard.js)
    return;
    const notificationButton = document.getElementById('notificationButton');
    const badge = notificationButton ? notificationButton.querySelector('.notification-dot, .notification-badge') : null;

    if (badge) {
        if (count > 0) {
            badge.style.display = 'block';
            if (badge.textContent !== undefined) {
                badge.textContent = count > 99 ? '99+' : count.toString();
            }
        } else {
            badge.style.display = 'none';
        }
    }
}

function handleCSRepNotificationError(error) {
    console.error('CS-Rep Notification WebSocket error:', error);
}

// Load workflow alerts from assignments and invoices
async function loadWorkflowAlerts() {
    const alertsList = document.getElementById('workflowAlertsList');
    if (!alertsList) return;

    try {
        const assignments = await loadAllAssignments({ status: 'pending_invoice' });
        const invoices = await loadCSRepInvoices();

        const alerts = [];

        // Add assignment alerts
        assignments.forEach(assignment => {
            alerts.push({
                type: 'warning',
                message: `Assignment <strong>${assignment.assignment_code || assignment.assignment_id}</strong> requires tutor assignment after admin approval.`,
                meta: 'Awaiting admin approval',
                action: 'assign',
                id: assignment.id
            });
        });

        // Add invoice alerts
        invoices.filter(inv => inv.status === 'pending_payment' || inv.status === 'overdue').forEach(invoice => {
            alerts.push({
                type: invoice.status === 'overdue' ? 'danger' : 'warning',
                message: `Invoice <strong>${invoice.invoice_number}</strong> ${invoice.status === 'overdue' ? 'is overdue' : 'awaiting payment confirmation'}.`,
                meta: invoice.status === 'overdue' ? 'Auto-escalation pending' : 'Awaiting student payment',
                action: 'invoice',
                id: invoice.id
            });
        });

        if (alerts.length === 0) {
            alertsList.innerHTML = '<li style="text-align: center; padding: 2rem; color: var(--muted-text);">No workflow alerts</li>';
            return;
        }

        alertsList.innerHTML = alerts.slice(0, 5).map(alert => `
            <li>
                <span class="alert-badge ${alert.type}"></span>
                <div>
                    <p class="alert-text">${alert.message}</p>
                    <p class="alert-meta">${alert.meta}</p>
                </div>
                <button class="ghost-button" onclick="handleWorkflowAlert('${alert.action}', ${alert.id})">View</button>
            </li>
        `).join('');
    } catch (error) {
        console.error('Error loading workflow alerts:', error);
        alertsList.innerHTML = '<li style="text-align: center; padding: 2rem; color: var(--muted-text);">Error loading alerts</li>';
    }
}

// Load announcements
async function loadAnnouncements() {
    console.log('loadAnnouncements function called');
    if (typeof apiClient === 'undefined' || !apiClient.getAnnouncements) {
        console.error('apiClient or getAnnouncements not found');
        return;
    }

    try {
        console.log('Fetching announcements via apiClient...');
        const response = await apiClient.getAnnouncements();
        console.log('Announcements response:', response);
        if (response.success) {
            renderAnnouncements(response.announcements || []);
        }
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

// Render announcements
function renderAnnouncements(announcements) {
    const container = document.querySelector('.announcements-container');
    if (!container) {
        console.warn('Announcements container not found in current view');
        return;
    }

    if (announcements.length === 0) {
        const emptyState = document.getElementById('announcementsEmpty');
        if (emptyState) emptyState.style.display = 'block';
        container.innerHTML = '';
        return;
    }

    const emptyState = document.getElementById('announcementsEmpty');
    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = announcements.map(announcement => {
        const authorName = announcement.author_name || 'Administration';
        const priorityClass = announcement.priority;
        const timeAgo = formatTimeAgo(announcement.created_at);
        const tagsHtml = (announcement.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('');

        let recipientsArr = [];
        if (announcement.all_students) recipientsArr.push('All Students');
        if (announcement.all_teachers) recipientsArr.push('All Teachers');
        if (announcement.all_csreps) recipientsArr.push('All CS Reps');
        
        let recipientsText = recipientsArr.join(', ');
        if (recipientsText && announcement.specific_recipients_count > 0) {
            recipientsText += ' & Specific Recipients';
        } else if (!recipientsText && announcement.specific_recipients_count > 0) {
            recipientsText = 'Specific Recipients';
        } else if (!recipientsText) {
            recipientsText = 'No recipients';
        }

        return `
            <div class="announcement-item" data-id="${announcement.id}">
                <div class="announcement-header">
                    <div class="announcement-author">
                        <div class="author-avatar">
                            ${announcement.author_avatar ? 
                                `<img src="${announcement.author_avatar}" alt="${authorName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` : 
                                '<i class="fas fa-user" style="font-size: 20px; color: #9ca3af;"></i>'}
                        </div>
                        <div class="author-info">
                            <div class="author-name">${authorName}</div>
                            <div class="announcement-date">${timeAgo}</div>
                        </div>
                    </div>
                    <div class="announcement-badge ${priorityClass}">
                        <i class="fas ${announcement.priority === 'urgent' ? 'fa-exclamation-triangle' : (announcement.priority === 'important' ? 'fa-star' : 'fa-info-circle')}"></i>
                        ${announcement.priority.charAt(0).toUpperCase() + announcement.priority.slice(1)}
                    </div>
                </div>
                <div class="announcement-content">
                    <h3 class="announcement-title">${announcement.title}</h3>
                    <p class="announcement-text">${announcement.content}</p>
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

// Helper functions
function formatTimeAgo(dateString) {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

async function handleNotificationAction(notificationId) {
    // Mark as read and refresh badge/list
    try {
        if (typeof apiClient !== 'undefined' && apiClient.markNotificationRead) {
            await apiClient.markNotificationRead(notificationId);
        }
    } catch (e) {}

    try { await loadNotifications(); } catch (e) {}
}

function handleWorkflowAlert(action, id) {
    if (action === 'assign') {
        Promise.resolve(openSection('assignment')).catch(error => {
            console.error('Error opening assignment section:', error);
        });
    } else if (action === 'invoice') {
        Promise.resolve(openSection('invoices')).catch(error => {
            console.error('Error opening invoices section:', error);
        });
    }
}

// Update loadCSRepDashboardData to also load workflow alerts
async function loadCSRepDashboardData() {
    console.log('Loading CS-Rep dashboard data...');

    try {
        // Load assignments
        if (typeof loadAllAssignments === 'function') {
            const assignments = await loadAllAssignments();
            renderCSRepAssignmentsTable(assignments);

            // Load invoices for metrics
            if (typeof loadCSRepInvoices === 'function') {
                const invoices = await loadCSRepInvoices();
                // Overview metrics are loaded via backend endpoint now.
            }
        }
    } catch (error) {
        console.error('Error loading assignments:', error);
    }

    try {
        // Load invoices
        if (typeof loadCSRepInvoices === 'function') {
            const invoices = await loadCSRepInvoices();
            if (typeof renderInvoicesTable === 'function') {
                renderInvoicesTable(invoices, '#invoiceTable');
                updateInvoiceSummary(invoices);
            }
        }
    } catch (error) {
        console.error('Error loading invoices:', error);
    }

    try {
        // Load notifications
        await loadNotifications();
    } catch (error) {
        console.error('Error loading notifications:', error);
    }

    try {
        // Load announcements
        await loadAnnouncements();
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

// ============================================
// Thread Management Functions
// ============================================

// Thread management functions moved to threads.js
function openThread(threadId) {
    if (window.StudyThreads && typeof window.StudyThreads.openThread === 'function') {
        window.StudyThreads.openThread(threadId);
    }
}

// Initialize thread management
function initializeThreadManagement() {
    // Create thread modal handlers
    const showCreateThreadModalBtn = document.getElementById('showCreateThreadModalBtn');
    const createThreadCloseBtn = document.getElementById('createThreadCloseBtn');
    const createThreadCancelBtn = document.getElementById('createThreadCancelBtn');
    const createThreadSubmitBtn = document.getElementById('createThreadSubmitBtn');

    if (showCreateThreadModalBtn) {
        showCreateThreadModalBtn.addEventListener('click', showCreateThreadModal);
    }

    if (createThreadCloseBtn) {
        createThreadCloseBtn.addEventListener('click', closeCreateThreadModal);
    }

    if (createThreadCancelBtn) {
        createThreadCancelBtn.addEventListener('click', closeCreateThreadModal);
    }

    if (createThreadSubmitBtn) {
        createThreadSubmitBtn.addEventListener('click', submitCreateThread);
    }

    // Thread view modal handlers
    const threadViewCloseBtn = document.getElementById('threadViewCloseBtn');

    if (threadViewCloseBtn) {
        threadViewCloseBtn.addEventListener('click', closeThreadViewModal);
    }

    // Thread card click handlers
    document.querySelectorAll('.thread-action-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const threadCard = this.closest('.thread-card');
            if (threadCard) {
                const threadId = parseInt(threadCard.getAttribute('data-thread-id'));
                openThreadView(threadId);
            }
        });
    });

    // Back to threads list button
    const backToThreadsListBtn = document.getElementById('backToThreadsListBtn');
    if (backToThreadsListBtn) {
        backToThreadsListBtn.addEventListener('click', showCSRepThreadList);
    }

    // Thread filter pills
    const filterPills = document.querySelectorAll('.thread-filters .filter-pill');
    filterPills.forEach(pill => {
        pill.addEventListener('click', function () {
            filterPills.forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            const filter = this.getAttribute('data-filter');
            filterThreads(filter);
        });
    });

    // Thread type change handler in create modal
    const threadTypeSelect = document.getElementById('threadType');
    if (threadTypeSelect) {
        threadTypeSelect.addEventListener('change', function () {
            const assignmentField = document.getElementById('relatedAssignmentField');
            const invoiceField = document.getElementById('relatedInvoiceField');
            const studentSelectField = document.getElementById('studentSelectField');

            if (this.value === 'assignment') {
                if (assignmentField) assignmentField.style.display = 'block';
                if (invoiceField) invoiceField.style.display = 'none';
                if (studentSelectField) studentSelectField.style.display = 'block';
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

    // Thread composer handlers
    initializeThreadComposers();

    // Close modals on overlay click
    const createThreadModal = document.getElementById('createThreadModal');
    const threadViewModal = document.getElementById('threadViewModal');

    if (createThreadModal) {
        createThreadModal.addEventListener('click', function (e) {
            if (e.target === createThreadModal) {
                closeCreateThreadModal();
            }
        });
    }

    if (threadViewModal) {
        threadViewModal.addEventListener('click', function (e) {
            if (e.target === threadViewModal) {
                closeThreadViewModal();
            }
        });
    }
}

function showCreateThreadModal() {
    if (window.StudyThreads && typeof window.StudyThreads.showCreateModal === 'function') {
        window.StudyThreads.showCreateModal();
    } else {
        const modal = document.getElementById('createThreadModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
}

function closeCreateThreadModal() {
    const modal = document.getElementById('createThreadModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        const form = document.getElementById('createThreadForm');
        if (form) form.reset();
    }
}

function closeThreadViewModal() {
    const modal = document.getElementById('threadViewModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function submitCreateThread() {
    if (window.StudyThreads && typeof window.StudyThreads.submitCreateThread === 'function') {
        window.StudyThreads.submitCreateThread();
    }
}

function openThreadView(threadId) {
    loadThreadData(threadId);
    const threadsList = document.getElementById('csrepThreadsList');
    const threadDetailView = document.getElementById('csrepThreadDetailView');

    if (threadsList) threadsList.style.display = 'none';
    if (threadDetailView) threadDetailView.style.display = 'block';
}

function showCSRepThreadList() {
    const threadsList = document.getElementById('csrepThreadsList');
    const threadDetailView = document.getElementById('csrepThreadDetailView');

    if (threadDetailView) threadDetailView.style.display = 'none';
    if (threadsList) threadsList.style.display = 'grid';
}

function loadThreadData(threadId) {
    const thread = mockThreadsData[threadId];
    if (!thread) {
        console.error('Thread not found:', threadId);
        return;
    }

    // Update full-page view header
    const csrepThreadViewSubject = document.getElementById('csrepThreadViewSubject');
    const csrepThreadViewType = document.getElementById('csrepThreadViewType');
    const csrepThreadViewAssignment = document.getElementById('csrepThreadViewAssignment');
    const csrepThreadViewInvoice = document.getElementById('csrepThreadViewInvoice');
    const csrepThreadViewParticipants = document.getElementById('csrepThreadViewParticipants');
    const csrepThreadViewMessages = document.getElementById('csrepThreadViewMessages');

    if (csrepThreadViewSubject) csrepThreadViewSubject.textContent = thread.subject;

    if (csrepThreadViewType) {
        csrepThreadViewType.textContent = thread.type.charAt(0).toUpperCase() + thread.type.slice(1);
        csrepThreadViewType.className = 'thread-type-badge ' + thread.type;
    }

    if (thread.assignment && csrepThreadViewAssignment) {
        csrepThreadViewAssignment.style.display = 'inline-flex';
        const span = csrepThreadViewAssignment.querySelector('span');
        if (span) span.textContent = thread.assignment;
    } else if (csrepThreadViewAssignment) {
        csrepThreadViewAssignment.style.display = 'none';
    }

    if (thread.invoice && csrepThreadViewInvoice) {
        csrepThreadViewInvoice.style.display = 'inline-flex';
        const span = csrepThreadViewInvoice.querySelector('span');
        if (span) span.textContent = thread.invoice;
    } else if (csrepThreadViewInvoice) {
        csrepThreadViewInvoice.style.display = 'none';
    }

    if (csrepThreadViewParticipants && thread.participants) {
        csrepThreadViewParticipants.innerHTML = thread.participants.map(p =>
            `<span class="participant-badge ${p.role}">${p.name} (${p.role === 'cs_rep' ? 'CS Rep' : p.role === 'student' ? 'Student' : 'Teacher'})</span>`
        ).join('');
    }

    if (csrepThreadViewMessages && thread.messages) {
        csrepThreadViewMessages.innerHTML = thread.messages.map(msg => {
            const isCSRep = msg.sender_role === 'cs_rep';
            return `
                <div class="thread-message ${isCSRep ? 'outbound' : 'inbound'}">
                    <div class="message-header">
                        <span class="message-sender">${msg.sender_name}</span>
                        <span class="message-role">${msg.sender_role === 'cs_rep' ? 'CS Rep' : msg.sender_role === 'student' ? 'Student' : 'Teacher'}</span>
                        <span class="message-time">${msg.timestamp}</span>
                    </div>
                    <div class="message-content">${msg.content}</div>
                </div>
            `;
        }).join('');
        csrepThreadViewMessages.scrollTop = csrepThreadViewMessages.scrollHeight;
    }

    // Also update modal view (for backward compatibility)
    const threadViewSubject = document.getElementById('threadViewSubject');
    const threadViewType = document.getElementById('threadViewType');
    const threadViewAssignment = document.getElementById('threadViewAssignment');
    const threadViewInvoice = document.getElementById('threadViewInvoice');
    const threadViewParticipants = document.getElementById('threadViewParticipants');
    const threadViewMessages = document.getElementById('threadViewMessages');

    if (threadViewSubject) threadViewSubject.textContent = thread.subject;

    if (threadViewType) {
        threadViewType.textContent = thread.type.charAt(0).toUpperCase() + thread.type.slice(1);
        threadViewType.className = 'thread-type-badge ' + thread.type;
    }

    if (thread.assignment && threadViewAssignment) {
        threadViewAssignment.style.display = 'inline-flex';
        const span = threadViewAssignment.querySelector('span');
        if (span) span.textContent = thread.assignment;
    } else if (threadViewAssignment) {
        threadViewAssignment.style.display = 'none';
    }

    if (thread.invoice && threadViewInvoice) {
        threadViewInvoice.style.display = 'inline-flex';
        const span = threadViewInvoice.querySelector('span');
        if (span) span.textContent = thread.invoice;
    } else if (threadViewInvoice) {
        threadViewInvoice.style.display = 'none';
    }

    if (threadViewParticipants && thread.participants) {
        threadViewParticipants.innerHTML = thread.participants.map(p =>
            `<span class="participant-badge ${p.role}">${p.name} (${p.role === 'cs_rep' ? 'CS Rep' : p.role === 'student' ? 'Student' : 'Teacher'})</span>`
        ).join('');
    }

    if (threadViewMessages && thread.messages) {
        threadViewMessages.innerHTML = thread.messages.map(msg => {
            const isCSRep = msg.sender_role === 'cs_rep';
            return `
                <div class="thread-message ${isCSRep ? 'outbound' : 'inbound'}">
                    <div class="message-header">
                        <span class="message-sender">${msg.sender_name}</span>
                        <span class="message-role">${msg.sender_role === 'cs_rep' ? 'CS Rep' : msg.sender_role === 'student' ? 'Student' : 'Teacher'}</span>
                        <span class="message-time">${msg.timestamp}</span>
                    </div>
                    <div class="message-content">${msg.content}</div>
                </div>
            `;
        }).join('');
        threadViewMessages.scrollTop = threadViewMessages.scrollHeight;
    }
}

function filterThreads(filter) {
    const threadCards = document.querySelectorAll('.thread-card');
    threadCards.forEach(card => {
        if (filter === 'all') {
            card.style.display = 'block';
        } else {
            const threadType = card.getAttribute('data-thread-type');
            const threadStatus = card.getAttribute('data-status');

            if (filter === threadType || filter === threadStatus) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        }
    });
}

function initializeThreadComposers() {
    // Note: This function is for legacy support. The main threads.js system handles
    // thread composer initialization with proper re-binding when threads are opened.
    // This function ensures compatibility but threads.js takes precedence.
    
    // Modal view attachment handler
    const csrepThreadAttachBtn = document.getElementById('csrepThreadAttachBtn');
    const csrepThreadFileInput = document.getElementById('csrepThreadFileInput');

    if (csrepThreadAttachBtn && csrepThreadFileInput && csrepThreadAttachBtn.parentNode) {
        try {
            // Clone to remove old listeners before adding new ones
            const newAttachBtn = csrepThreadAttachBtn.cloneNode(true);
            csrepThreadAttachBtn.parentNode.replaceChild(newAttachBtn, csrepThreadAttachBtn);
            
            newAttachBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (csrepThreadFileInput) {
                    csrepThreadFileInput.click();
                }
            });
        } catch (err) {
            console.warn('Failed to re-bind CS_REP attach button (modal):', err);
            // Fallback: add listener without cloning
            csrepThreadAttachBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (csrepThreadFileInput) {
                    csrepThreadFileInput.click();
                }
            });
        }
    }

    // Full-page view attachment handler
    const csrepThreadAttachBtnFull = document.getElementById('csrepThreadAttachBtnFull');
    const csrepThreadFileInputFull = document.getElementById('csrepThreadFileInputFull');

    if (csrepThreadAttachBtnFull && csrepThreadFileInputFull && csrepThreadAttachBtnFull.parentNode) {
        try {
            // Clone to remove old listeners before adding new ones
            const newAttachBtnFull = csrepThreadAttachBtnFull.cloneNode(true);
            csrepThreadAttachBtnFull.parentNode.replaceChild(newAttachBtnFull, csrepThreadAttachBtnFull);
            
            newAttachBtnFull.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (csrepThreadFileInputFull) {
                    csrepThreadFileInputFull.click();
                }
            });
        } catch (err) {
            console.warn('Failed to re-bind CS_REP attach button (full):', err);
            // Fallback: add listener without cloning
            csrepThreadAttachBtnFull.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (csrepThreadFileInputFull) {
                    csrepThreadFileInputFull.click();
                }
            });
        }
    }

    // Handle Enter key in thread composer (modal view)
    const threadReplyInput = document.getElementById('threadReplyInput');
    if (threadReplyInput && threadReplyInput.parentNode) {
        try {
            const newReplyInput = threadReplyInput.cloneNode(true);
            threadReplyInput.parentNode.replaceChild(newReplyInput, threadReplyInput);
            
            newReplyInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendThreadReply();
                }
            });
        } catch (err) {
            console.warn('Failed to re-bind thread reply input (modal):', err);
            threadReplyInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendThreadReply();
                }
            });
        }
    }

    // Handle Enter key in thread composer (full-page view)
    const csrepThreadReplyInput = document.getElementById('csrepThreadReplyInput');
    if (csrepThreadReplyInput && csrepThreadReplyInput.parentNode) {
        try {
            const newCsrepReplyInput = csrepThreadReplyInput.cloneNode(true);
            csrepThreadReplyInput.parentNode.replaceChild(newCsrepReplyInput, csrepThreadReplyInput);
            
            newCsrepReplyInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendCSRepThreadReply();
                }
            });
        } catch (err) {
            console.warn('Failed to re-bind CS_REP thread reply input:', err);
            csrepThreadReplyInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendCSRepThreadReply();
                }
            });
        }
    }

    // Send button handlers
    const threadReplySendBtn = document.getElementById('threadReplySendBtn');
    const csrepThreadReplySendBtn = document.getElementById('csrepThreadReplySendBtn');

    if (threadReplySendBtn && threadReplySendBtn.parentNode) {
        try {
            const newSendBtn = threadReplySendBtn.cloneNode(true);
            threadReplySendBtn.parentNode.replaceChild(newSendBtn, threadReplySendBtn);
            newSendBtn.addEventListener('click', sendThreadReply);
        } catch (err) {
            console.warn('Failed to re-bind thread reply send button:', err);
            threadReplySendBtn.addEventListener('click', sendThreadReply);
        }
    }

    if (csrepThreadReplySendBtn && csrepThreadReplySendBtn.parentNode) {
        try {
            const newCsrepSendBtn = csrepThreadReplySendBtn.cloneNode(true);
            csrepThreadReplySendBtn.parentNode.replaceChild(newCsrepSendBtn, csrepThreadReplySendBtn);
            newCsrepSendBtn.addEventListener('click', sendCSRepThreadReply);
        } catch (err) {
            console.warn('Failed to re-bind CS_REP thread reply send button:', err);
            csrepThreadReplySendBtn.addEventListener('click', sendCSRepThreadReply);
        }
    }
}

function sendThreadReply() {
    const input = document.getElementById('threadReplyInput');
    const message = input?.value.trim();

    if (!message) {
        if (typeof showErrorMessage === 'function') {
            showErrorMessage('Please enter a message');
        } else {
            alert('Please enter a message');
        }
        return;
    }

    const messagesContainer = document.getElementById('threadViewMessages');
    const now = new Date();
    const timeStr = now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    const replyHtml = `
        <div class="thread-message outbound">
            <div class="message-header">
                <span class="message-sender">You</span>
                <span class="message-role">CS Rep</span>
                <span class="message-time">${timeStr}</span>
            </div>
            <div class="message-content">${message}</div>
        </div>
    `;

    if (messagesContainer) {
        messagesContainer.insertAdjacentHTML('beforeend', replyHtml);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    if (input) input.value = '';
    console.log('Reply sent (Mock):', message);
}

// Communication Section - Student Dropdown and Message Handling
let currentCommunicationStudent = null;
const communicationMessages = {};

// Initialize student dropdown
function initStudentDropdown() {
    const dropdownToggle = document.getElementById('studentDropdownToggle');
    const dropdownMenu = document.getElementById('studentDropdownMenu');
    const dropdownWrapper = document.querySelector('.student-dropdown-wrapper');
    const searchInput = document.getElementById('studentSearchInput');
    const studentItems = document.querySelectorAll('.student-dropdown-item');

    if (!dropdownToggle) {
        console.warn('studentDropdownToggle not found');
        return;
    }

    if (!dropdownMenu) {
        console.warn('studentDropdownMenu not found');
        return;
    }

    console.log('Initializing student dropdown...');

    // Remove any existing event listeners by cloning the button
    const newToggle = dropdownToggle.cloneNode(true);
    dropdownToggle.parentNode.replaceChild(newToggle, dropdownToggle);

    // Toggle dropdown - use the global function
    newToggle.addEventListener('click', (e) => {
        toggleStudentDropdown(e);
    });

    // Close dropdown when clicking outside (only if dropdown is open)
    const handleOutsideClick = (e) => {
        if (dropdownWrapper && !dropdownWrapper.contains(e.target)) {
            const currentDisplay = dropdownMenu.style.display || window.getComputedStyle(dropdownMenu).display;
            if (currentDisplay !== 'none' && currentDisplay !== '') {
                dropdownMenu.style.display = 'none';
                dropdownWrapper.classList.remove('active');
                if (searchInput) searchInput.value = '';
                filterStudentDropdown('');
            }
        }
    };

    // Use capture phase to ensure it works
    document.addEventListener('click', handleOutsideClick, true);

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterStudentDropdown(e.target.value.toLowerCase());
        });
    }

    // Student selection
    studentItems.forEach(item => {
        item.addEventListener('click', () => {
            const studentId = item.dataset.studentId;
            const studentName = item.dataset.name;
            const studentEmail = item.dataset.email;
            const studentAvatar = item.dataset.avatar;

            selectStudentForCommunication(studentId, studentName, studentEmail, studentAvatar);

            // Close dropdown
            dropdownMenu.style.display = 'none';
            dropdownWrapper.classList.remove('active');
            if (searchInput) searchInput.value = '';
            filterStudentDropdown('');
        });
    });
}

// Toggle student dropdown (can be called directly from onclick)
function toggleStudentDropdown(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    console.log('toggleStudentDropdown called');

    const dropdownMenu = document.getElementById('studentDropdownMenu');
    const dropdownWrapper = document.querySelector('.student-dropdown-wrapper');
    const searchInput = document.getElementById('studentSearchInput');

    if (!dropdownMenu) {
        console.error('studentDropdownMenu element not found!');
        return;
    }

    if (!dropdownWrapper) {
        console.error('student-dropdown-wrapper element not found!');
        return;
    }

    // Simple toggle - check if currently visible
    const isCurrentlyVisible = dropdownMenu.style.display === 'flex' ||
        (dropdownMenu.style.display === '' && window.getComputedStyle(dropdownMenu).display === 'flex');

    console.log('Current display:', dropdownMenu.style.display, 'isVisible:', isCurrentlyVisible);

    if (isCurrentlyVisible) {
        // Close dropdown
        dropdownMenu.style.display = 'none';
        dropdownWrapper.classList.remove('active');
        if (searchInput) {
            searchInput.value = '';
            if (typeof filterStudentDropdown === 'function') {
                filterStudentDropdown('');
            }
        }
        console.log('Dropdown closed');
    } else {
        // Open dropdown - use 'flex' to match CSS (which has display: flex)
        dropdownMenu.style.display = 'flex';
        dropdownWrapper.classList.add('active');
        console.log('Dropdown opened, display set to flex');
        if (searchInput) {
            setTimeout(() => {
                searchInput.focus();
            }, 100);
        }
    }
}

// Filter student dropdown
function filterStudentDropdown(searchTerm) {
    const items = document.querySelectorAll('.student-dropdown-item');
    items.forEach(item => {
        const name = item.dataset.name.toLowerCase();
        const email = item.dataset.email.toLowerCase();
        const matches = name.includes(searchTerm) || email.includes(searchTerm);
        item.style.display = matches ? 'flex' : 'none';
    });
}

// Select student for communication
function selectStudentForCommunication(studentId, studentName, studentEmail, studentAvatar) {
    currentCommunicationStudent = {
        id: studentId,
        name: studentName,
        email: studentEmail,
        avatar: studentAvatar
    };

    // Update thread header
    const threadHeader = document.getElementById('threadHeaderName');
    if (threadHeader) {
        threadHeader.textContent = studentName;
    }

    // Check if thread item exists, if not create it
    let threadItem = document.querySelector(`.thread-item[data-student-id="${studentId}"]`);
    if (!threadItem) {
        threadItem = createThreadItem(studentId, studentName, studentEmail, studentAvatar);
        const threadList = document.getElementById('communicationThreadList');
        if (threadList) {
            threadList.insertBefore(threadItem, threadList.firstChild);
        }
    }

    // Update active state
    document.querySelectorAll('.thread-item').forEach(item => {
        item.classList.remove('active');
    });
    threadItem.classList.add('active');

    // Load messages for this student
    loadCommunicationMessages(studentId);

    // Update message input placeholder
    const messageInput = document.getElementById('communicationMessageInput');
    if (messageInput) {
        messageInput.placeholder = `Type a message to ${studentName}...`;
    }
}

// Create thread item
function createThreadItem(studentId, studentName, studentEmail, studentAvatar) {
    const threadItem = document.createElement('div');
    threadItem.className = 'thread-item';
    threadItem.dataset.contact = studentName.toLowerCase().replace(/\s+/g, '-');
    threadItem.dataset.name = studentName;
    threadItem.dataset.role = 'Student';
    threadItem.dataset.studentId = studentId;

    threadItem.innerHTML = `
        <div class="avatar">
            <img src="${studentAvatar}" alt="${studentName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="avatar-fallback" style="display: none;">${studentName.split(' ').map(n => n[0]).join('')}</div>
        </div>
        <div class="meta">
            <span class="name">${studentName}</span>
            <span class="role">Student</span>
        </div>
        <span class="pill">S</span>
    `;

    // Add click handler
    threadItem.addEventListener('click', () => {
        selectStudentForCommunication(studentId, studentName, studentEmail, studentAvatar);
    });

    return threadItem;
}

// Load communication messages
function loadCommunicationMessages(studentId) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;

    // Initialize messages array if it doesn't exist
    if (!communicationMessages[studentId]) {
        communicationMessages[studentId] = [];
    }

    // Clear container
    messagesContainer.innerHTML = '';

    // Load messages
    const messages = communicationMessages[studentId];
    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--muted-text);">
                <i class="fas fa-comments" style="font-size: 2rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                <p>No messages yet. Start the conversation!</p>
            </div>
        `;
    } else {
        messages.forEach(msg => {
            let msgRow;
            if (msg.audioUrl) {
                msgRow = createVoiceMessageRow(msg.audioUrl);
            } else if (msg.fileName) {
                msgRow = createFileMessageRow(msg.fileName, (msg.fileSize / 1024).toFixed(2) + ' KB', null);
            } else if (msg.text) {
                msgRow = createMessageRow(msg.text, msg.isUser, msg.avatar);
            }
            if (msgRow) {
                messagesContainer.appendChild(msgRow);
            }
        });
    }

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Create message row
function createMessageRow(text, isUser, avatar) {
    const msgRow = document.createElement('div');
    msgRow.className = `msg-row ${isUser ? 'right' : ''}`;

    const bubble = document.createElement('div');
    bubble.className = `bubble ${isUser ? 'user' : 'admin'}`;
    bubble.textContent = text;

    if (isUser) {
        msgRow.innerHTML = `
            <div class="bubble user">${text}</div>
            <div class="avatar">
                <i class="fas fa-user" style="font-size: 20px; color: #9ca3af; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background-color: #f3f4f6;"></i>
            </div>
        `;
    } else {
        msgRow.innerHTML = `
            <div class="avatar">
                <img src="${avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces'}" alt="Student" />
            </div>
            <div class="bubble admin">${text}</div>
        `;
    }

    return msgRow;
}

// Initialize communication section
function initCommunicationSection() {
    console.log('Initializing communication section...');

    // Initialize student dropdown with a small delay to ensure DOM is ready
    setTimeout(() => {
        initStudentDropdown();

        // Also add direct event listener as backup
        const toggleBtn = document.getElementById('studentDropdownToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Direct event listener fired');
                toggleStudentDropdown(e);
            });
        }
    }, 100);

    // Initialize thread item clicks
    document.querySelectorAll('.thread-item').forEach(item => {
        item.addEventListener('click', () => {
            const studentId = item.dataset.studentId;
            const studentName = item.dataset.name;
            const studentEmail = item.dataset.email || '';
            const studentAvatar = item.dataset.avatar;

            if (studentId && studentName) {
                selectStudentForCommunication(studentId, studentName, studentEmail, studentAvatar);
            }
        });
    });

    // Initialize message sending
    const sendBtn = document.getElementById('communicationSendBtn');
    const messageInput = document.getElementById('communicationMessageInput');
    const attachmentBtn = document.getElementById('communicationAttachmentBtn');
    const microphoneBtn = document.getElementById('communicationMicrophoneBtn');

    if (sendBtn && messageInput) {
        // Send on button click
        sendBtn.addEventListener('click', () => {
            sendCommunicationMessage();
        });

        // Send on Enter key
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendCommunicationMessage();
            }
        });
    }

    // Initialize attachment button (only once)
    if (attachmentBtn && !attachmentBtn.dataset.initialized) {
        const fileInput = document.getElementById('communicationFileInput');

        attachmentBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (fileInput) {
                fileInput.click();
            }
        });

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const files = e.target.files;
                if (files && files.length > 0) {
                    // Process files immediately
                    handleFileAttachment(files);

                    // Reset file input after processing to allow same file selection
                    setTimeout(() => {
                        e.target.value = '';
                    }, 50);
                }
            });
        }

        // Mark as initialized to prevent duplicate listeners
        attachmentBtn.dataset.initialized = 'true';
    }

    // Initialize microphone button
    if (microphoneBtn) {
        microphoneBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const isRecording = microphoneBtn.dataset.recording === 'true';
            if (!isRecording) {
                startVoiceRecording(microphoneBtn);
            } else {
                stopVoiceRecording(microphoneBtn);
            }
        });
    }

    // Set default student if first thread item exists
    const firstThreadItem = document.querySelector('.thread-item');
    if (firstThreadItem && !currentCommunicationStudent) {
        const studentId = firstThreadItem.dataset.studentId;
        const studentName = firstThreadItem.dataset.name;
        const studentEmail = firstThreadItem.dataset.email || '';
        const studentAvatar = firstThreadItem.dataset.avatar;

        if (studentId && studentName) {
            selectStudentForCommunication(studentId, studentName, studentEmail, studentAvatar);
        }
    }
}

// Send communication message
function sendCommunicationMessage() {
    const messageInput = document.getElementById('communicationMessageInput');
    const messagesContainer = document.getElementById('messagesContainer');

    if (!messageInput || !currentCommunicationStudent) {
        if (!currentCommunicationStudent) {
            alert('Please select a student first.');
        }
        return;
    }

    const message = messageInput.value.trim();
    if (!message) return;

    // Initialize messages array if needed
    const studentId = currentCommunicationStudent.id;
    if (!communicationMessages[studentId]) {
        communicationMessages[studentId] = [];
    }

    // Add message to array
    communicationMessages[studentId].push({
        text: message,
        isUser: true,
        timestamp: new Date()
    });

    // Create and append message row
    const msgRow = createMessageRow(message, true, null);
    if (messagesContainer) {
        // Remove empty state if exists
        const emptyState = messagesContainer.querySelector('div[style*="text-align: center"]');
        if (emptyState) emptyState.remove();

        messagesContainer.appendChild(msgRow);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Clear input
    messageInput.value = '';

    // Here you would typically send the message to the server
    console.log('Message sent to', currentCommunicationStudent.name, ':', message);
}

// Handle file attachment
function handleFileAttachment(files) {
    if (!files || files.length === 0) {
        console.warn('No files provided to handleFileAttachment');
        return;
    }

    if (!currentCommunicationStudent) {
        alert('Please select a student first.');
        return;
    }

    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) {
        console.error('Messages container not found');
        return;
    }

    Array.from(files).forEach(file => {
        if (!file || !file.name) {
            console.warn('Invalid file object:', file);
            return;
        }

        const fileSize = (file.size / 1024).toFixed(2) + ' KB';
        const fileRow = createFileMessageRow(file.name, fileSize, file);

        // Remove empty state if exists
        const emptyState = messagesContainer.querySelector('div[style*="text-align: center"]');
        if (emptyState) emptyState.remove();

        messagesContainer.appendChild(fileRow);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Store file in messages array
        const studentId = currentCommunicationStudent.id;
        if (!communicationMessages[studentId]) {
            communicationMessages[studentId] = [];
        }
        communicationMessages[studentId].push({
            fileName: file.name,
            fileSize: file.size,
            isUser: true,
            timestamp: new Date()
        });

        console.log('File attached:', file.name);
    });
}

// Create file message row
function createFileMessageRow(fileName, fileSize, file) {
    const msgRow = document.createElement('div');
    msgRow.className = 'msg-row right';

    const fileIcon = getFileIcon(fileName);
    const fileUrl = file ? URL.createObjectURL(file) : '#';

    msgRow.innerHTML = `
        <div class="bubble user" style="max-width: 300px;">
            <div style="display: flex; align-items: center; gap: 12px; padding: 8px;">
                <i class="${fileIcon}" style="font-size: 24px; color: #1158e5;"></i>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 0.9rem; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${fileName}</div>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">${fileSize}</div>
                </div>
                <a href="${fileUrl}" target="_blank" style="color: #1158e5; text-decoration: none;" title="Open file">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        </div>
        <div class="avatar">
            <i class="fas fa-user" style="font-size: 20px; color: #9ca3af; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background-color: #f3f4f6;"></i>
        </div>
    `;

    return msgRow;
}

// Get file icon based on file extension
function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
        'pdf': 'fas fa-file-pdf',
        'doc': 'fas fa-file-word',
        'docx': 'fas fa-file-word',
        'xls': 'fas fa-file-excel',
        'xlsx': 'fas fa-file-excel',
        'ppt': 'fas fa-file-powerpoint',
        'pptx': 'fas fa-file-powerpoint',
        'jpg': 'fas fa-file-image',
        'jpeg': 'fas fa-file-image',
        'png': 'fas fa-file-image',
        'gif': 'fas fa-file-image',
        'mp4': 'fas fa-file-video',
        'mp3': 'fas fa-file-audio',
        'zip': 'fas fa-file-archive',
        'rar': 'fas fa-file-archive',
        'txt': 'fas fa-file-alt'
    };
    return iconMap[ext] || 'fas fa-file';
}

// Start voice recording
async function startVoiceRecording(btn) {
    // Prevent multiple starts
    if (btn.dataset.recording === 'true') {
        console.log('Recording already in progress');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            if (audioChunks.length > 0) {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                handleVoiceMessage(audioBlob);
            }
            // Clean up stream
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            // Reset button state
            btn.dataset.recording = 'false';
            btn.classList.remove('recording');
            btn.innerHTML = '<i class="fas fa-microphone"></i>';
            btn.title = 'Voice message';
            // Clear stored references
            btn._mediaRecorder = null;
            btn._audioChunks = null;
        };

        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            stopVoiceRecording(btn);
        };

        // Store references before starting
        btn._mediaRecorder = mediaRecorder;
        btn._audioChunks = audioChunks;
        btn._stream = stream;

        mediaRecorder.start();
        btn.dataset.recording = 'true';
        btn.classList.add('recording');
        btn.innerHTML = '<i class="fas fa-stop"></i>';
        btn.title = 'Stop recording';

        console.log('Voice recording started');
    } catch (error) {
        console.error('Error starting voice recording:', error);
        alert('Unable to access microphone. Please check your permissions.');
        btn.dataset.recording = 'false';
        btn.classList.remove('recording');
    }
}

// Stop voice recording
function stopVoiceRecording(btn) {
    // Prevent multiple stops
    if (btn.dataset.recording !== 'true') {
        console.log('No recording in progress');
        return;
    }

    if (btn._mediaRecorder) {
        try {
            if (btn._mediaRecorder.state === 'recording') {
                btn._mediaRecorder.stop();
                console.log('Voice recording stopped');
            } else if (btn._mediaRecorder.state === 'inactive') {
                // Already stopped, just clean up
                if (btn._stream) {
                    btn._stream.getTracks().forEach(track => track.stop());
                }
                btn.dataset.recording = 'false';
                btn.classList.remove('recording');
                btn.innerHTML = '<i class="fas fa-microphone"></i>';
                btn.title = 'Voice message';
                btn._mediaRecorder = null;
                btn._audioChunks = null;
                btn._stream = null;
            }
        } catch (error) {
            console.error('Error stopping recording:', error);
            // Force cleanup on error
            if (btn._stream) {
                btn._stream.getTracks().forEach(track => track.stop());
            }
            btn.dataset.recording = 'false';
            btn.classList.remove('recording');
            btn.innerHTML = '<i class="fas fa-microphone"></i>';
            btn.title = 'Voice message';
            btn._mediaRecorder = null;
            btn._audioChunks = null;
            btn._stream = null;
        }
    } else {
        // No recorder found, reset state anyway
        btn.dataset.recording = 'false';
        btn.classList.remove('recording');
        btn.innerHTML = '<i class="fas fa-microphone"></i>';
        btn.title = 'Voice message';
    }
}

// Handle voice message
function handleVoiceMessage(audioBlob) {
    if (!currentCommunicationStudent) {
        alert('Please select a student first.');
        return;
    }

    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;

    const audioUrl = URL.createObjectURL(audioBlob);
    const voiceRow = createVoiceMessageRow(audioUrl);

    // Remove empty state if exists
    const emptyState = messagesContainer.querySelector('div[style*="text-align: center"]');
    if (emptyState) emptyState.remove();

    messagesContainer.appendChild(voiceRow);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Store voice message in messages array
    const studentId = currentCommunicationStudent.id;
    if (!communicationMessages[studentId]) {
        communicationMessages[studentId] = [];
    }
    communicationMessages[studentId].push({
        audioUrl: audioUrl,
        isUser: true,
        timestamp: new Date()
    });

    console.log('Voice message sent');
}

// Create voice message row with sound waves
function createVoiceMessageRow(audioUrl) {
    const msgRow = document.createElement('div');
    msgRow.className = 'msg-row right';

    const uniqueId = 'voice-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    msgRow.innerHTML = `
        <div class="bubble user" style="max-width: 320px; padding: 10px 14px; position: relative;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <button id="${uniqueId}-play" onclick="toggleVoicePlayback('${uniqueId}')" style="width: 36px; height: 36px; border-radius: 50%; border: none; background: #1158e5; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s;">
                    <i class="fas fa-play" id="${uniqueId}-icon"></i>
                </button>
                <audio id="${uniqueId}-audio" src="${audioUrl}" preload="metadata" onloadedmetadata="updateVoiceDuration('${uniqueId}')" ontimeupdate="updateVoiceProgress('${uniqueId}')" onended="resetVoicePlayback('${uniqueId}')"></audio>
                <div style="flex: 1; min-width: 0; position: relative; overflow: hidden;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; position: relative;">
                        <div class="voice-waveform-container" id="${uniqueId}-waveform-container" style="position: relative; flex: 1; height: 24px; overflow-x: auto; overflow-y: hidden; min-width: 0;">
                            <div class="voice-waveform" id="${uniqueId}-waveform" style="display: flex; align-items: center; gap: 2px; height: 24px; min-width: min-content; position: relative;">
                                <!-- Waveform bars will be generated here -->
                            </div>
                            <div class="voice-progress" id="${uniqueId}-progress" style="position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: rgba(17, 88, 229, 0.1); pointer-events: none; transition: width 0.1s linear; z-index: 0;"></div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: #64748b;">
                        <span id="${uniqueId}-duration">0:00</span>
                        <span style="font-size: 0.7rem;">
                            <i class="fas fa-microphone" style="margin-right: 4px;"></i>Voice
                        </span>
                    </div>
                </div>
            </div>
        </div>
        <div class="avatar">
            <i class="fas fa-user" style="font-size: 20px; color: #9ca3af; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background-color: #f3f4f6;"></i>
        </div>
    `;

    // Analyze audio and create waveform
    setTimeout(() => {
        analyzeAudioAndCreateWaveform(uniqueId, audioUrl);
    }, 100);

    return msgRow;
}

// Analyze audio and create waveform based on actual audio data
async function analyzeAudioAndCreateWaveform(uniqueId, audioUrl) {
    try {
        const waveform = document.getElementById(uniqueId + '-waveform');
        const audio = document.getElementById(uniqueId + '-audio');
        if (!waveform || !audio) return;

        // Fetch audio file
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();

        // Decode audio data
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Get audio data
        const rawData = audioBuffer.getChannelData(0); // Get first channel
        const samples = 60; // Number of bars to show
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData = [];

        // Analyze audio to get amplitude for each sample
        for (let i = 0; i < samples; i++) {
            let sum = 0;
            let max = 0;
            const start = blockSize * i;

            for (let j = 0; j < blockSize; j++) {
                const index = start + j;
                if (index < rawData.length) {
                    const absValue = Math.abs(rawData[index]);
                    sum += absValue;
                    max = Math.max(max, absValue);
                }
            }

            // Use RMS (Root Mean Square) for better representation
            const rms = Math.sqrt(sum / blockSize);
            filteredData.push(rms);
        }

        // Normalize data (find max value)
        const maxValue = Math.max(...filteredData);
        const minHeight = 2; // Minimum height for silence (flat line)
        const maxHeight = 20; // Maximum height for loud sounds

        // Create waveform bars
        waveform.innerHTML = '';
        filteredData.forEach((amplitude, index) => {
            const normalizedAmplitude = maxValue > 0 ? amplitude / maxValue : 0;
            // If amplitude is very low (silence), show as flat line
            const height = normalizedAmplitude < 0.05 ? minHeight : minHeight + (normalizedAmplitude * (maxHeight - minHeight));

            const bar = document.createElement('span');
            bar.className = 'wave-bar';
            bar.style.width = '3px';
            bar.style.height = height + 'px';
            bar.style.minHeight = minHeight + 'px';
            bar.style.background = '#64748b';
            bar.style.borderRadius = '2px';
            bar.style.transition = 'height 0.1s ease, background-color 0.2s ease';
            bar.dataset.amplitude = amplitude;
            waveform.appendChild(bar);
        });

        // Store audio data for progress tracking
        audio._waveformData = filteredData;
        audio._maxAmplitude = maxValue;

        audioContext.close();
    } catch (error) {
        console.error('Error analyzing audio:', error);
        // Fallback: create simple waveform
        createFallbackWaveform(uniqueId);
    }
}

// Create fallback waveform if audio analysis fails
function createFallbackWaveform(uniqueId) {
    const waveform = document.getElementById(uniqueId + '-waveform');
    if (!waveform) return;

    const samples = 60;
    waveform.innerHTML = '';
    for (let i = 0; i < samples; i++) {
        const bar = document.createElement('span');
        bar.className = 'wave-bar';
        bar.style.width = '3px';
        bar.style.height = '4px';
        bar.style.minHeight = '2px';
        bar.style.background = '#64748b';
        bar.style.borderRadius = '2px';
        waveform.appendChild(bar);
    }
}

// Toggle voice playback
function toggleVoicePlayback(uniqueId) {
    const audio = document.getElementById(uniqueId + '-audio');
    const playBtn = document.getElementById(uniqueId + '-play');
    const icon = document.getElementById(uniqueId + '-icon');

    if (!audio || !playBtn || !icon) return;

    if (audio.paused) {
        audio.play();
        icon.className = 'fas fa-pause';
        playBtn.style.background = '#0d47c7';
        // Progress will be updated via updateVoiceProgress
    } else {
        audio.pause();
        icon.className = 'fas fa-play';
        playBtn.style.background = '#1158e5';
        stopWaveformAnimation(uniqueId);
    }
}

// Update waveform progress during playback
function updateWaveformProgress(uniqueId) {
    const audio = document.getElementById(uniqueId + '-audio');
    const waveform = document.getElementById(uniqueId + '-waveform');
    const progressBar = document.getElementById(uniqueId + '-progress');
    const waveformContainer = document.getElementById(uniqueId + '-waveform-container');

    if (!audio || !waveform || !progressBar || !waveformContainer) return;

    if (isNaN(audio.duration) || audio.duration === 0) return;

    const progress = (audio.currentTime / audio.duration) * 100;
    // Calculate progress width based on waveform width, not container width
    const waveformWidth = waveform.scrollWidth;
    const containerWidth = waveformContainer.clientWidth;
    const progressWidth = (progress / 100) * Math.max(waveformWidth, containerWidth);
    progressBar.style.width = progressWidth + 'px';

    // Highlight bars that have been played
    const bars = waveform.querySelectorAll('.wave-bar');
    const currentBarIndex = Math.floor((progress / 100) * bars.length);

    bars.forEach((bar, index) => {
        if (index <= currentBarIndex && !audio.paused) {
            // Show played bars in blue
            bar.style.background = '#1158e5';
        } else {
            // Show unplayed bars in gray
            bar.style.background = '#64748b';
        }
    });

    // Auto-scroll waveform to keep current position visible
    if (!audio.paused && bars.length > 0) {
        const currentBar = bars[currentBarIndex];
        if (currentBar) {
            const containerWidth = waveformContainer.clientWidth;
            const waveformWidth = waveform.scrollWidth;
            const barPosition = currentBar.offsetLeft;
            const barWidth = currentBar.offsetWidth;
            const scrollPosition = waveformContainer.scrollLeft;
            const visibleStart = scrollPosition;
            const visibleEnd = scrollPosition + containerWidth;

            // Scroll if current bar is outside visible area
            if (barPosition < visibleStart) {
                waveformContainer.scrollLeft = Math.max(0, barPosition - 10);
            } else if (barPosition + barWidth > visibleEnd) {
                waveformContainer.scrollLeft = barPosition + barWidth - containerWidth + 10;
            }
        }
    }
}

// Stop waveform animation
function stopWaveformAnimation(uniqueId) {
    const waveform = document.getElementById(uniqueId + '-waveform');
    const progressBar = document.getElementById(uniqueId + '-progress');

    if (waveform) {
        const bars = waveform.querySelectorAll('.wave-bar');
        bars.forEach(bar => {
            bar.style.background = '#64748b';
        });
    }

    // Don't reset progress bar, keep it at current position
}

// Update voice duration
function updateVoiceDuration(uniqueId) {
    const audio = document.getElementById(uniqueId + '-audio');
    const durationEl = document.getElementById(uniqueId + '-duration');
    if (audio && durationEl && !isNaN(audio.duration)) {
        const minutes = Math.floor(audio.duration / 60);
        const seconds = Math.floor(audio.duration % 60);
        durationEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Update voice progress
function updateVoiceProgress(uniqueId) {
    const audio = document.getElementById(uniqueId + '-audio');
    const durationEl = document.getElementById(uniqueId + '-duration');
    if (audio && durationEl && !isNaN(audio.duration) && !isNaN(audio.currentTime)) {
        const remaining = audio.duration - audio.currentTime;
        const minutes = Math.floor(remaining / 60);
        const seconds = Math.floor(remaining % 60);
        durationEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Update waveform progress
        updateWaveformProgress(uniqueId);
    }
}

// Reset voice playback
function resetVoicePlayback(uniqueId) {
    const playBtn = document.getElementById(uniqueId + '-play');
    const icon = document.getElementById(uniqueId + '-icon');
    const audio = document.getElementById(uniqueId + '-audio');
    const progressBar = document.getElementById(uniqueId + '-progress');

    if (playBtn && icon) {
        icon.className = 'fas fa-play';
        playBtn.style.background = '#1158e5';
    }

    if (audio) {
        audio.currentTime = 0;
    }

    if (progressBar) {
        progressBar.style.width = '0%';
    }

    stopWaveformAnimation(uniqueId);
}

// Make functions globally available
window.toggleVoicePlayback = toggleVoicePlayback;
window.updateVoiceDuration = updateVoiceDuration;
window.updateVoiceProgress = updateVoiceProgress;
window.resetVoicePlayback = resetVoicePlayback;
window.analyzeAudioAndCreateWaveform = analyzeAudioAndCreateWaveform;
window.updateWaveformProgress = updateWaveformProgress;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Check if communication section exists and is visible
        const commSection = document.getElementById('communicationSection');
        if (commSection && (commSection.classList.contains('active') || commSection.style.display !== 'none')) {
            if (typeof window.initStudyMessagingOnLoad === 'function') {
                setTimeout(() => window.initStudyMessagingOnLoad(), 50);
            }
        }
    });
} else {
    // DOM already loaded
    const commSection = document.getElementById('communicationSection');
    if (commSection && (commSection.classList.contains('active') || commSection.style.display !== 'none')) {
        if (typeof window.initStudyMessagingOnLoad === 'function') {
            setTimeout(() => window.initStudyMessagingOnLoad(), 50);
        }
    }
}

// Re-initialize when section is opened
const originalOpenSection = window.openSection;
if (originalOpenSection) {
    window.openSection = async function (sectionKey) {
        await originalOpenSection(sectionKey);
        if (sectionKey === 'communication') {
            if (typeof window.initStudyMessagingOnLoad === 'function') {
                setTimeout(() => window.initStudyMessagingOnLoad(), 50);
            }
        }
    };
}

// ---------------------------------------------------------
// CS-Rep Dashboard Initialization
// ---------------------------------------------------------

