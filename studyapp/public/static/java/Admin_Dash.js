// Admin_Dash.js: Merged visual interactions from Student_Dash.js with admin functionality

function getCookie(name) {
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
}

// Declare global variables at the top to avoid temporal dead zone issues
// Use window object properties directly to prevent redeclaration errors when scripts are reloaded
if (typeof window.announcementTags === 'undefined') {
    window.announcementTags = [];
}
// Create local reference for convenience (use var to allow reassignment)
var announcementTags = window.announcementTags;

if (typeof window.adminNotificationsList === 'undefined') {
    window.adminNotificationsList = [];
}
var adminNotificationsList = window.adminNotificationsList;

// WebSocket removed - using simple role-based auth with API polling instead

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

function initializeAdminDashboard() {
    // Initialize admin profile display (name and picture)
    initializeAdminProfile();

    // Initialize header interactions (profile dropdown, dark mode)
    initializeHeaderInteractions();

    // Initialize navigation
    initializeNavigation();

    // Initialize quick action buttons
    initializeQuickActions();

    // Initialize search functionality
    initializeSearch();

    // Initialize contact filtering
    initializeContactFiltering();

    // Initialize form handlers
    initializeFormHandlers();

    // Initialize password generation
    initializePasswordGeneration();

    // Initialize sidebar toggle
    initializeSidebarToggle();

    // Initialize user management
    initializeUserManagement();

    // Initialize financial reporting
    initializeFinancialReporting();

    // Initialize CS Rep management
    initializeCSRepManagement();

    // Initialize content review
    initializeContentReview();

    // Load saved settings
    loadSettings();

    // Initialize assignment requests styling
    initializeAssignmentRequestsStyling();

    // Initialize notifications
    initializeAdminNotifications();

    // Initialize automatic background refresh
    // initializeAdminAutoRefresh();

    // Check if there's already content loaded (from server-side rendering)
    const dynamicContainer = document.getElementById('dynamicContentContainer');
    const existingSection = dynamicContainer && dynamicContainer.querySelector('.content-section');

    if (!existingSection) {
        // Restore last section or show dashboard by default
        try {
            const lastSection = localStorage.getItem('admin_last_section');
            const sectionToShow = lastSection && window.sectionFileMap && window.sectionFileMap.hasOwnProperty(lastSection) ? lastSection : 'dashboard';
            console.log(`Restoring admin section: ${sectionToShow}${lastSection ? ' (from localStorage)' : ' (default)'}`);
            showSection(sectionToShow);
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            // Fallback to dashboard
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
                // Update active nav item (only if it exists in sidebar)
                document.querySelectorAll('.nav-item').forEach(item => {
                    item.classList.remove('active');
                });
                const activeNavLink = document.querySelector(`.nav-link[data-section="${sectionName}"]`);
                if (activeNavLink) {
                    activeNavLink.parentElement.classList.add('active');
                }
                // Save to localStorage
                localStorage.setItem('admin_last_section', sectionName);
            }
        }
    }
}

// Initialize admin profile display (name and picture from database)
function initializeAdminProfile() {
    // Profile name and picture are already set in the template via Django context
    // This function ensures they're displayed correctly and can be updated dynamically
    const profilePicture = document.getElementById('adminProfilePicture');
    const profileIcon = document.getElementById('adminProfileIcon');

    if (profilePicture) {
        // Check if profile picture has a valid src (not empty and not just the base URL)
        const pictureSrc = profilePicture.src || profilePicture.getAttribute('src') || '';
        const hasValidPicture = pictureSrc &&
            pictureSrc.trim() !== '' &&
            !pictureSrc.includes('data:image') === false ||
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

// Update admin header avatar (called when profile picture is updated)
function updateAdminHeaderAvatar(imageUrl) {
    const profilePicture = document.getElementById('adminProfilePicture');
    const profileIcon = document.getElementById('adminProfileIcon');

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

// Update admin header name (called when profile is updated)
function updateAdminHeaderName(firstName) {
    const profileName = document.getElementById('adminProfileName');
    if (profileName && firstName) {
        profileName.textContent = firstName;
    }
}

function initializeHeaderInteractions() {
    // Profile dropdown toggle
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

        userProfileMenu.addEventListener('click', function (e) {
            // Don't toggle if clicking on dropdown items - let them handle navigation
            if (e.target.closest('.dropdown-item')) {
                return;
            }

            e.stopPropagation();
            const isVisible = dropdown.style.display === 'block' || dropdown.style.display === '';
            const newState = !isVisible;
            dropdown.style.display = newState ? 'block' : 'none';
            userProfileMenu.classList.toggle('active', newState);
            dropdown.classList.toggle('active', newState);
            updateChevronIcon(newState);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function (e) {
            if (!userProfileMenu.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
                userProfileMenu.classList.remove('active');
                dropdown.classList.remove('active');
                updateChevronIcon(false);
            }
        });

        // Close dropdown when clicking on dropdown items (after navigation)
        const dropdownItems = dropdown.querySelectorAll('.dropdown-item[data-section]');
        dropdownItems.forEach(item => {
            item.addEventListener('click', function (e) {
                // Let the onclick handler run first (showSection), then close dropdown
                setTimeout(() => {
                    dropdown.style.display = 'none';
                    userProfileMenu.classList.remove('active');
                    dropdown.classList.remove('active');
                    updateChevronIcon(false);
                }, 100);
            });
        });
    }

    // Notification dropdown toggle
    const notificationButton = document.getElementById('notificationButton');
    const notificationDropdown = document.getElementById('notificationDropdown');

    if (notificationButton && notificationDropdown) {
        notificationButton.addEventListener('click', function (e) {
            e.stopPropagation();
            const isVisible = notificationDropdown.classList.contains('active');

            // Close profile dropdown if open
            if (userProfileMenu && dropdown) {
                dropdown.style.display = 'none';
                userProfileMenu.classList.remove('active');
                dropdown.classList.remove('active');
            }

            // Toggle notification dropdown
            if (isVisible) {
                notificationDropdown.classList.remove('active');
            } else {
                notificationDropdown.classList.add('active');
                renderAdminNotifications();
                updateNotificationDropdownCount();
            }
        });

        // Close notification dropdown when clicking outside
        document.addEventListener('click', function (e) {
            if (!notificationButton.contains(e.target) && !notificationDropdown.contains(e.target)) {
                notificationDropdown.classList.remove('active');
            }
        });
    }

    // Dark mode toggle with localStorage (from Student_Dash.js)
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
        const icon = toggle.querySelector('i');
        const storageKey = 'admin-dashboard-theme';
        const storedTheme = localStorage.getItem(storageKey);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
            document.body.classList.add('dark-mode');
            if (icon) icon.classList.replace('fa-moon', 'fa-sun');
        }
        toggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem(storageKey, isDark ? 'dark' : 'light');
            if (icon) {
                if (isDark) icon.classList.replace('fa-moon', 'fa-sun');
                else icon.classList.replace('fa-sun', 'fa-moon');
            }
        });
    }

    // Dropdown logout handled via hidden form in base template
}

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

// Get Django URL for loading admin sections dynamically
function getAdminSectionUrl(sectionName) {
    // Use Django URL pattern: /account/admin/section/<section_name>/
    return `/account/admin/section/${sectionName}/`;
}

// Use window object to prevent redeclaration errors when script loads multiple times
if (!window.sectionFileMap) {
    window.sectionFileMap = {
        // Dashboard is now loaded as a separate template
        'dashboard': 'dashboard.html',
        'students': 'student_management.html',
        'messages': 'messages.html',
        'threads': 'threads.html',
        'assignment-requests': 'assignment_requests.html',
        'add-teacher': 'add_teacher.html',
        'user-management': 'user_management.html',
        'analytics': 'analytics.html',
        'invoice-management': 'invoices.html',
        'cs-rep-management': 'add_cs_rep.html',
        'content-review': 'content_review.html',
        'notification': 'notifications.html',
        'announcements': 'announcements.html',
        'feedback-reports': 'feedback_report.html',
        'meetings-record': 'meetings_record.html',
        'visitors': 'visitors.html',
        'profile': 'profile.html',
        'settings': 'profile_settings.html'
    };
}

// Cache for loaded sections
if (!window.loadedSections) {
    window.loadedSections = {};
}

// Helper function to load HTML section from Django endpoint
async function loadHtmlSection(sectionName) {
    try {
        const url = getAdminSectionUrl(sectionName);
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

// Use window object to prevent redeclaration errors when script loads multiple times
if (typeof window.showSection === 'undefined') {
    window.showSection = async function (sectionName) {
        // Save current section to localStorage for page refresh persistence
        if (sectionName) {
            localStorage.setItem('admin_last_section', sectionName);
        }

        // Get dynamic container at function level so it's accessible everywhere
        const dynamicContainer = document.getElementById('dynamicContentContainer');

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

            // Hide messages section separately if it exists
            const messagesSection = document.getElementById('messagesSection');
            if (messagesSection && sectionName !== 'messages') {
                messagesSection.style.display = 'none';
            }
        } catch (error) {
            console.error('Error in showSection:', error);
            return;
        }

        // Load other sections (not dashboard)
        // Check if section exists in mapping
        const sectionExists = window.sectionFileMap.hasOwnProperty(sectionName);

        if (sectionExists) {
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
                let sectionHTML = window.loadedSections[sectionName];

                if (!sectionHTML) {
                    // Load the HTML section from Django endpoint
                    console.log('Loading section:', sectionName);
                    console.log('Django URL:', getAdminSectionUrl(sectionName));

                    // Fetch HTML content from Django endpoint
                    let htmlContent = await loadHtmlSection(sectionName);
                    console.log(`✅ Successfully loaded ${sectionName} from Django (${htmlContent.length} chars)`);
                    console.log('HTML preview (first 500 chars):', htmlContent.substring(0, 500));

                    // Extract scripts from the original HTML BEFORE parsing (DOMParser might strip them)
                    const originalScriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
                    const originalScripts = [];
                    let scriptMatch;
                    while ((scriptMatch = originalScriptRegex.exec(htmlContent)) !== null) {
                        const scriptTag = scriptMatch[0];
                        // Skip core scripts that are already loaded in the main dashboard
                        if (scriptTag.includes('apiClient.js') ||
                            scriptTag.includes('Admin_Dash.js') ||
                            scriptTag.includes('dashboard.js') ||
                            scriptTag.includes('toastNotifications.js')) {
                            console.log('Skipping already loaded script:', scriptTag.substring(0, 100) + '...');
                            continue;
                        }
                        originalScripts.push(scriptTag);
                    }

                    // Extract content from the loaded HTML (Django renders the full template)
                    // Templates extend admin_base.html, so Django renders the full page
                    // We need to extract ONLY the content section, not the header/sidebar
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');

                    // Find the content section in the loaded HTML (same approach as student dashboard)
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
                        const mainElement = doc.querySelector('main.main, main');
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
                    window.loadedSections[sectionName] = sectionHTML;
                }

                // Insert the loaded HTML into the dynamic container
                if (dynamicContainer) {
                    // Extract and execute scripts BEFORE setting innerHTML
                    // This ensures we capture all scripts from the HTML string
                    const scriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
                    const scriptMatches = [];
                    let match;
                    // Reset regex lastIndex to ensure we start from the beginning
                    scriptRegex.lastIndex = 0;
                    while ((match = scriptRegex.exec(sectionHTML)) !== null) {
                        scriptMatches.push(match[0]); // Full match including tags
                    }

                    // Remove script tags from HTML before inserting (we'll execute them separately)
                    let htmlWithoutScripts = sectionHTML.replace(/<script[\s\S]*?<\/script>/gi, '');

                    // Insert HTML without scripts first
                    dynamicContainer.innerHTML = htmlWithoutScripts;
                    dynamicContainer.style.display = 'block';

                    // Initialize Dashboard (Todos, etc.)
                    if (sectionName === 'dashboard') {
                        setTimeout(() => {
                            // If todo_manager.js is loaded, it should have a global init or similar
                            // Based on todo_manager.js, it attaches init to DOMContentLoaded or calls it immediately
                            // We can try to find and call its internal fetch function if exported
                            if (typeof window.fetchTodos === 'function') {
                                window.fetchTodos();
                            } else {
                                // Fallback: dispatch a custom event that todo_manager might listen to
                                document.dispatchEvent(new CustomEvent('dashboardLoaded'));
                            }
                        }, 100);
                    }

                    // Initialize Threads if needed
                    if (sectionName === 'threads') {
                        setTimeout(() => {
                            if (window.StudyThreads && typeof window.StudyThreads.init === 'function') {
                                window.StudyThreads.init();
                            }
                        }, 100);
                    }

                    // Initialize Invoice Management
                    if (sectionName === 'invoice-management') {
                        setTimeout(() => {
                            if (typeof window.loadAdminInvoices === 'function') {
                                window.loadAdminInvoices();
                            }
                        }, 100);
                    }

                    // Make sure the section inside is visible
                    const innerSections = dynamicContainer.querySelectorAll('.content-section');
                    innerSections.forEach(sec => {
                        sec.classList.add('active');
                        sec.style.display = 'block';
                    });

                    // Initialize CS Rep form handler if this is the cs-rep-management section
                    if (sectionName === 'cs-rep-management') {
                        setTimeout(() => {
                            const csRepForm = document.getElementById('csRepForm');
                            if (csRepForm) {
                                console.log('CS Rep form found, attaching handler');
                                // Remove existing event listener if any
                                const newForm = csRepForm.cloneNode(true);
                                csRepForm.parentNode.replaceChild(newForm, csRepForm);

                                // Attach submit handler
                                newForm.addEventListener('submit', function (e) {
                                    console.log('CS Rep form submit detected via direct handler');
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (typeof handleCSRepSubmit === 'function') {
                                        handleCSRepSubmit(e);
                                    } else {
                                        console.error('handleCSRepSubmit function not found');
                                    }
                                });
                                console.log('CS Rep form handler attached successfully');
                            } else {
                                console.warn('CS Rep form not found after section load');
                            }
                        }, 100);
                    }

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

                                    // Prevent variable redeclaration by checking if variables exist
                                    // Replace 'let' and 'const' declarations with checks for existing variables
                                    const protectedVars = ['announcementTags', 'adminNotificationsList'];
                                    protectedVars.forEach(varName => {
                                        // Check if variable exists in global scope
                                        const varExists = typeof window[varName] !== 'undefined' ||
                                            (typeof eval(`typeof ${varName}`) !== 'undefined' && eval(`typeof ${varName}`) !== 'undefined');

                                        if (varExists) {
                                            // Replace 'let varName =' or 'const varName =' with just assignment or skip
                                            scriptContent = scriptContent.replace(
                                                new RegExp(`\\b(let|const)\\s+${varName}\\s*=`, 'g'),
                                                `${varName} =`
                                            );
                                        }
                                    });

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
                                console.error(`Error executing script ${index + 1} for section ${sectionName}:`, error);
                            }
                        });
                    }
                }

                // Special handling for messages section (full-bleed layout)
                if (sectionName === 'messages') {
                    document.body.classList.add('messages-view');
                    if (typeof window.initStudyMessagingOnLoad === 'function') {
                        setTimeout(() => window.initStudyMessagingOnLoad(), 50);
                    }
                } else {
                    document.body.classList.remove('messages-view');
                }
            } catch (error) {
                console.error('Error loading section:', error);
                console.error('Section name:', sectionName);
                console.error('Django URL:', getAdminSectionUrl(sectionName));
                console.error('Current location:', window.location.href);

                let errorMessage = error.message;
                let helpText = '';

                // Provide helpful error message
                if (error.message.includes('Failed to load') || error.message.includes('Network error')) {
                    const djangoUrl = getAdminSectionUrl(sectionName);
                    errorMessage = `Failed to load section: ${sectionName}`;
                    helpText = `
                            <p style="font-size: 0.85rem; color: #9ca3af; margin-top: 1rem;">
                                <strong>Django URL:</strong> ${djangoUrl}<br>
                                <strong>Current page:</strong> ${window.location.href}<br>
                                <strong>Section name:</strong> ${sectionName}
                            </p>
                        `;
                }

                if (dynamicContainer) {
                    dynamicContainer.innerHTML = `
                            <div style="text-align: center; padding: 3rem; color: #e74c3c;">
                                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                                <p><strong>Error loading ${sectionName}</strong></p>
                                <p style="font-size: 0.9rem; color: #9ca3af; margin-top: 0.5rem;">${errorMessage}</p>
                                ${helpText}
                                <p style="font-size: 0.8rem; color: #9ca3af; margin-top: 1rem;">
                                    Attempted URL: <code style="background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px;">${getAdminSectionUrl(sectionName)}</code>
                                </p>
                            </div>
                        `;
                    dynamicContainer.style.display = 'block';
                }
            }
        } else {
            // Section not found in map
            console.warn(`No file mapping found for section: ${sectionName}`);
            if (dynamicContainer) {
                dynamicContainer.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: #9ca3af;">
                        <i class="fas fa-info-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                        <p>Section "${sectionName}" not found</p>
                    </div>
                `;
                dynamicContainer.style.display = 'block';
            }
        }

        // Update active nav item (only if it exists in sidebar)
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeNavLink = document.querySelector(`.nav-link[data-section="${sectionName}"]`);
        if (activeNavLink) {
            activeNavLink.parentElement.classList.add('active');
        }

        // Close user dropdown if open
        const userDropdown = document.querySelector('.user-dropdown');
        const userProfileMenu = document.querySelector('.user-profile-menu');
        if (userDropdown && userProfileMenu) {
            userDropdown.classList.remove('active');
            userProfileMenu.classList.remove('active');
        }
    };
}

// Export showSection to window immediately after definition so it's available globally
// This must be done before any code tries to wrap or use it
if (typeof window.showSection === 'undefined') {
    window.showSection = showSection;
}
if (typeof window.getAdminSectionUrl === 'undefined') {
    window.getAdminSectionUrl = getAdminSectionUrl;
}

// Initialize quick action buttons in dashboard
function initializeQuickActions() {
    const quickActionButtons = document.querySelectorAll('.quick-action-btn[data-section]');

    quickActionButtons.forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault();
            const sectionName = this.getAttribute('data-section');
            showSection(sectionName);
        });
    });
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
        const status = row.getAttribute('data-status');
        const isNew = row.getAttribute('data-is-new') === 'true';

        // Search filter
        const matchesSearch = studentName.includes(searchTerm) || studentEmail.includes(searchTerm);

        // Status filter
        let matchesFilter = true;
        if (filterValue === 'active') {
            matchesFilter = (status === 'active');
        } else if (filterValue === 'inactive') {
            matchesFilter = (status === 'inactive');
        } else if (filterValue === 'new') {
            matchesFilter = isNew;
        }

        if (matchesSearch && matchesFilter) {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
            // Hide accordion as well if parent is hidden
            const accordionRow = row.nextElementSibling;
            if (accordionRow && accordionRow.classList.contains('assignments-accordion')) {
                accordionRow.style.display = 'none';
                // Reset toggle icon
                const toggleBtn = row.querySelector('.action-btn-small i');
                if (toggleBtn) {
                    toggleBtn.classList.replace('fa-chevron-up', 'fa-chevron-down');
                }
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
    const contactItems = document.querySelectorAll('.contact-item, .thread-item');

    contactItems.forEach(item => {
        const contactType = item.getAttribute('data-type');

        if (type === 'all' || contactType === type) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Real-time validation for teacher form
function initializeTeacherFormValidation() {
    // Use event delegation for dynamically loaded forms
    document.addEventListener('input', function (e) {
        const target = e.target;

        // Check if it's a teacher form field
        if (target.id === 'teacherUsername' || target.id === 'teacherEmail') {
            // Clear error styling on input
            target.classList.remove('error');
            const helpText = document.getElementById(target.id === 'teacherUsername' ? 'usernameHelp' : 'emailHelp');
            if (helpText) {
                if (target.id === 'teacherUsername') {
                    helpText.textContent = 'Username will be used for teacher login';
                } else {
                    helpText.textContent = '';
                }
            }
        }
    });

    // Debounce function for API calls
    let debounceTimer;
    document.addEventListener('blur', function (e) {
        const target = e.target;

        // Validate username on blur
        if (target.id === 'teacherUsername' && target.value.trim()) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                validateTeacherUsername(target.value.trim());
            }, 500);
        }

        // Validate email on blur
        if (target.id === 'teacherEmail' && target.value.trim()) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                validateTeacherEmail(target.value.trim());
            }, 500);
        }
    }, true);
}

// Validate username availability
async function validateTeacherUsername(username) {
    if (!username || username.length < 3) {
        return; // Skip validation for very short usernames
    }

    const usernameInput = document.getElementById('teacherUsername');
    const usernameHelp = document.getElementById('usernameHelp');

    if (!usernameInput) return;

    try {
        // Check if username exists by making a request to check endpoint
        // For now, we'll validate on submit, but we can add a check endpoint later
        // This is a placeholder for future enhancement
    } catch (error) {
        console.error('Error validating username:', error);
    }
}

// Validate email format and availability
async function validateTeacherEmail(email) {
    if (!email) return;

    const emailInput = document.getElementById('teacherEmail');
    const emailHelp = document.getElementById('emailHelp');

    if (!emailInput) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        emailInput.classList.add('error');
        if (emailHelp) {
            emailHelp.textContent = 'Invalid email format';
            emailHelp.style.color = '#ef4444';
        }
        return;
    }

    // Clear format error if email is valid
    emailInput.classList.remove('error');
    if (emailHelp) {
        emailHelp.textContent = '';
    }
}

// Form handlers
function initializeFormHandlers() {
    // Initialize teacher form validation
    initializeTeacherFormValidation();

    // Use a flag to prevent multiple event listeners on document
    if (window._adminFormHandlersInitialized) {
        console.log('Form handlers already initialized, skipping...');
        return;
    }

    console.log('Attaching global form submit listeners');

    // Add Teacher Form - Use event delegation for dynamically loaded forms
    document.addEventListener('submit', function (e) {
        const form = e.target;
        if (form && form.id === 'addTeacherForm') {
            console.log('Add Teacher form submit detected via event delegation');
            e.preventDefault();
            e.stopPropagation();
            if (typeof handleAddTeacher === 'function') {
                handleAddTeacher();
            } else {
                console.error('handleAddTeacher function not found');
            }
        }
    });

    // CS Rep Form - Use event delegation for dynamically loaded forms
    document.addEventListener('submit', function (e) {
        const form = e.target;
        if (form && form.id === 'csRepForm') {
            console.log('CS Rep form submit detected via event delegation');
            e.preventDefault();
            e.stopPropagation();
            if (typeof handleCSRepSubmit === 'function') {
                handleCSRepSubmit(e);
            } else {
                console.error('handleCSRepSubmit function not found');
            }
        }
    });

    window._adminFormHandlersInitialized = true;

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

function generatePassword(inputId = 'teacherPassword') {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < 12; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    const passwordInput = document.getElementById(inputId);
    if (passwordInput) {
        passwordInput.value = password;
        // Change input type to text temporarily to show the generated password
        passwordInput.type = 'text';
        // Update the toggle button icon if it exists
        const toggleBtn = passwordInput.nextElementSibling;
        if (toggleBtn && toggleBtn.classList.contains('password-toggle')) {
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        }
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
        modal.classList.add('active');
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
                const nameEl = document.getElementById('modalStudentName');
                const emailEl = document.getElementById('modalStudentEmail');
                const avatarEl = document.getElementById('modalStudentAvatar');

                const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.email;
                if (nameEl) nameEl.textContent = fullName;
                if (emailEl) emailEl.textContent = student.email;
                if (avatarEl && student.profile_picture_url) {
                    avatarEl.src = student.profile_picture_url;
                } else if (avatarEl) {
                    avatarEl.src = ''; // Use default avatar
                }
                return;
            }
        }
    } catch (error) {
        console.error('Error loading student data:', error);
    }

    // Fallback: Show error message
    const nameEl = document.getElementById('modalStudentName');
    const emailEl = document.getElementById('modalStudentEmail');
    if (nameEl) nameEl.textContent = 'Student not found';
    if (emailEl) emailEl.textContent = 'Unable to load student data';
}

function closeStudentDetailsModal() {
    const modal = document.getElementById('studentDetailsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

async function chatWithStudent(studentId) {
    // Set pending user ID for messaging system to pick up on initialization
    window.__pendingMessagingUserId = studentId;

    // Switch to messages section
    await showSection('messages');

    // Update active navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const messagesLink = document.querySelector('[data-section="messages"]');
    if (messagesLink) messagesLink.parentElement.classList.add('active');

    // Wait for messages section to be fully loaded and messaging to initialize
    // Check if messaging is already initialized
    if (window.StudyMessaging && window.StudyMessaging._initialized) {
        // Messaging is already initialized, start conversation directly
        try {
            await window.StudyMessaging.startConversation(studentId);
            console.log('Chat opened with student ID:', studentId);
        } catch (error) {
            console.error('Error starting conversation:', error);
        }
    } else {
        // Messaging not initialized yet, wait for it
        // The __pendingMessagingUserId pattern will handle it when messaging initializes
        // But we can also poll for initialization and start conversation manually
        const checkMessaging = setInterval(() => {
            if (window.StudyMessaging && window.StudyMessaging._initialized) {
                clearInterval(checkMessaging);
                try {
                    window.StudyMessaging.startConversation(studentId);
                    console.log('Chat opened with student ID:', studentId);
                } catch (error) {
                    console.error('Error starting conversation:', error);
                }
            }
        }, 100);

        // Timeout after 5 seconds
        setTimeout(() => {
            clearInterval(checkMessaging);
            if (window.__pendingMessagingUserId === studentId) {
                // Still pending, messaging might not have initialized
                console.warn('Messaging did not initialize in time, conversation will start when messaging loads');
            }
        }, 5000);
    }
}

async function chatWithStudentFromRequest(studentId) {
    await chatWithStudent(studentId);
}

// Student accordion functionality
function toggleStudentAssignments(button, studentId) {
    // If only one argument is passed, it might be the old signature (studentId only)
    if (arguments.length === 1) {
        studentId = button;
        button = document.querySelector(`[onclick*="toggleStudentAssignments"][onclick*="${studentId}"]`);
    }

    const accordionRow = document.getElementById(`assignments-${studentId}`);
    if (!accordionRow) return;

    // Use the button if provided, otherwise fallback to finding it
    const viewButton = button || document.querySelector(`[onclick*="toggleStudentAssignments"][onclick*="${studentId}"]`);
    if (!viewButton) return;

    const icon = viewButton.querySelector('i');

    if (accordionRow.style.display === 'none' || accordionRow.style.display === '') {
        // Close other open accordions
        document.querySelectorAll('.assignments-accordion').forEach(row => {
            if (row.id !== `assignments-${studentId}`) {
                row.style.display = 'none';
                
                // Reset other buttons' icons
                const otherBtn = document.querySelector(`.student-actions-cell button[onclick*="${row.id.replace('assignments-', '')}"]`);
                if (otherBtn) {
                    const otherIcon = otherBtn.querySelector('i');
                    if (otherIcon) {
                        otherIcon.classList.remove('fa-chevron-up');
                        otherIcon.classList.add('fa-chevron-down');
                    }
                }
            }
        });

        // Show current accordion
        accordionRow.style.display = 'table-row';
        if (icon) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        }
    } else {
        // Hide current accordion
        accordionRow.style.display = 'none';
        if (icon) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    }
}

// Teacher assignment functions
async function assignTeacher(selectElement, assignmentId) {
    const teacherId = selectElement.value;
    const teacherName = selectElement.options[selectElement.selectedIndex].text;

    if (teacherId) {
        try {
            const response = await apiClient.post('/assingment/admin/assign-teacher/', {
                assignment_id: assignmentId,
                teacher_id: teacherId,
                is_helper: false
            });

            if (response.success) {
                showSuccessModal(`Teacher assigned successfully! ${teacherName.split(' - ')[0]} is now assigned to this assignment.`);

                // Update the UI to show assigned teacher
                const card = selectElement.closest('.assignment-card');
                if (card) {
                    const statusBadge = card.querySelector('.status-pill');
                    if (statusBadge) {
                        statusBadge.className = 'pill status-pill in-process';
                        statusBadge.innerHTML = '<i class="fas fa-cog fa-spin"></i> In Process';
                    }
                    // Optional: hide or update the select
                }
            } else {
                showToast(response.error || 'Failed to assign teacher', 'error');
            }
        } catch (error) {
            console.error('Error assigning teacher:', error);
            showToast('An error occurred while assigning teacher.', 'error');
        }
    }
}

async function assignHelperTeacher(selectElement, assignmentId) {
    const teacherId = selectElement.value;
    const teacherName = selectElement.options[selectElement.selectedIndex].text;

    if (teacherId) {
        try {
            const response = await apiClient.post('/assingment/admin/assign-teacher/', {
                assignment_id: assignmentId,
                teacher_id: teacherId,
                is_helper: true
            });

            if (response.success) {
                showToast(`Helper teacher ${teacherName.split(' - ')[0]} assigned successfully!`, 'success');
            } else {
                showToast(response.error || 'Failed to assign helper teacher', 'error');
            }
        } catch (error) {
            console.error('Error assigning helper teacher:', error);
            showToast('An error occurred while assigning helper teacher.', 'error');
        }
    }
}

function changeTeacher(assignmentId) {
    showToast('Please use the assignment requests table to reassign teachers.', 'info');
}

// Assignment status management functions
function filterAssignmentsByStatus() {
    const filterValue = document.getElementById('assignmentStatusFilter')?.value || 'all';
    const cards = document.querySelectorAll('.assignment-card');
    const emptyState = document.getElementById('noRequestsMessage');
    const deletedAlert = document.getElementById('deletedRetentionAlert');

    let visibleCount = 0;

    cards.forEach(card => {
        const status = card.getAttribute('data-status');

        // "All Requests" (filterValue === 'all') should show ALL assignments including deleted ones
        if (filterValue === 'all') {
            card.style.display = 'block';
            visibleCount++;
        }
        // Specific status filter
        else if (status === filterValue) {
            card.style.display = 'block';
            visibleCount++;
        }
        else {
            card.style.display = 'none';
        }
    });

    // Show/hide retention alert for Deleted filter
    if (deletedAlert) {
        deletedAlert.style.display = (filterValue === 'deleted') ? 'block' : 'none';
    }

    if (emptyState) {
        emptyState.style.display = (visibleCount === 0 && cards.length > 0) ? 'block' : 'none';
    }
}

async function deleteAssignment(assignmentId) {
    if (!confirm('Are you sure you want to mark this assignment as deleted? The assignment will remain in the database and can be viewed in the "Deleted" filter. This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/assingment/cancel/${assignmentId}/?action=delete`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        });

        const result = await response.json();
        if (result.success) {
            showSuccessModal('Assignment moved to deleted section.');
            // Refresh the current section to update the UI
            showSection('assignment-requests');
        } else {
            alert(result.error || 'Failed to delete assignment');
        }
    } catch (error) {
        console.error('Error deleting assignment:', error);
        alert('An error occurred while deleting the assignment.');
    }
}

async function cancelAssignment(assignmentId, currentStatus) {
    if (!confirm('Are you sure you want to cancel this assignment?')) {
        return;
    }

    try {
        const response = await fetch(`/assingment/cancel/${assignmentId}/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        });

        const result = await response.json();
        if (result.success) {
            showSuccessModal('Assignment has been cancelled successfully.');
            showSection('assignment-requests');
        } else {
            alert(result.error || 'Failed to cancel assignment');
        }
    } catch (error) {
        console.error('Error cancelling assignment:', error);
        alert('An error occurred while cancelling the assignment.');
    }
}

function downloadAssignmentZip(assignmentId) {
    const downloadUrl = `/assingment/teacher/download-zip/${assignmentId}/`;
    showToast('Preparing your consolidated ZIP download...', 'info');
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Expose functions globally
window.deleteAssignment = deleteAssignment;
window.cancelAssignment = cancelAssignment;
window.downloadAssignmentZip = downloadAssignmentZip;

// Helper function to show toast notifications
function showTeacherToast(message, type = 'error') {
    console.log(`[Toast] Showing ${type} notification: ${message}`);
    // Try to use toastNotifications if available
    if (typeof window.toastNotifications !== 'undefined' && window.toastNotifications) {
        window.toastNotifications.show(message, type, 5000);
    } else if (typeof showSuccessModal === 'function') {
        // Fallback to showSuccessModal
        showSuccessModal(message);
    } else {
        // Last resort
        alert(message);
    }
}

// Form submission handlers
async function handleAddTeacher() {
    const form = document.getElementById('addTeacherForm');
    if (!form) {
        showTeacherToast('Form not found. Please refresh the page.', 'error');
        return;
    }

    const formData = new FormData(form);
    const username = formData.get('teacherUsername') || formData.get('username');
    const email = formData.get('teacherEmail') || formData.get('email');
    const password = formData.get('teacherPassword') || formData.get('password');
    const first_name = formData.get('teacherFirstName') || formData.get('first_name');
    const last_name = formData.get('teacherLastName') || formData.get('last_name');

    // Clear previous error messages
    const usernameHelp = document.getElementById('usernameHelp');
    const emailHelp = document.getElementById('emailHelp');
    const passwordHelp = document.getElementById('passwordHelp');
    if (usernameHelp) {
        usernameHelp.textContent = 'Username will be used for teacher login';
        usernameHelp.style.color = '';
    }
    if (emailHelp) {
        emailHelp.textContent = '';
        emailHelp.style.color = '';
    }
    if (passwordHelp) {
        passwordHelp.textContent = 'Teacher will be asked to change on first login';
        passwordHelp.style.color = '';
    }

    // Remove error styling
    const usernameInput = document.getElementById('teacherUsername');
    const emailInput = document.getElementById('teacherEmail');
    const passwordInput = document.getElementById('teacherPassword');
    if (usernameInput) usernameInput.classList.remove('error');
    if (emailInput) emailInput.classList.remove('error');
    if (passwordInput) passwordInput.classList.remove('error');

    // Validation
    if (!username || !email || !password || !first_name || !last_name) {
        const missingFields = [];
        if (!first_name) missingFields.push('First Name');
        if (!last_name) missingFields.push('Last Name');
        if (!email) missingFields.push('Email');
        if (!username) missingFields.push('Username');
        if (!password) missingFields.push('Password');

        showTeacherToast(`Please fill in all required fields: ${missingFields.join(', ')}.`, 'error');
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showTeacherToast('Invalid email format. Please enter a valid email address.', 'error');
        if (emailInput) {
            emailInput.classList.add('error');
            if (emailHelp) emailHelp.textContent = 'Invalid email format';
        }
        return;
    }

    // Validate password length
    if (password.length < 8) {
        showTeacherToast('Password must be at least 8 characters long.', 'error');
        return;
    }

    try {
        if (typeof apiClient !== 'undefined') {
            const teacherData = {
                username: username.trim(),
                email: email.trim(),
                password: password,
                first_name: first_name.trim(),
                last_name: last_name.trim(),
            };

            const response = await apiClient.post('/account/api/accounts/create-teacher/', teacherData);

            if (response.success) {
                showTeacherToast(`Teacher "${first_name} ${last_name}" added successfully!`, 'success');
                // Show credentials in modal for better visibility
                showSuccessModal(`Teacher "${first_name} ${last_name}" added successfully!\n\nLogin Credentials:\nUsername: ${username}\nEmail: ${email}\nPassword: ${password}\n\nPlease share these credentials with the teacher.`);
                form.reset();
                // Clear error styling
                if (usernameInput) usernameInput.classList.remove('error');
                if (emailInput) emailInput.classList.remove('error');
            } else {
                const errorType = response.error_type || 'unknown';
                const errorMessage = response.error || 'Failed to create teacher. Please try again.';

                // Handle specific error types
                if (errorType === 'username_exists') {
                    showTeacherToast('Username already exists. Please choose a different username.', 'error');
                    if (usernameInput) {
                        usernameInput.classList.add('error');
                        if (usernameHelp) {
                            usernameHelp.textContent = 'Username already exists';
                            usernameHelp.style.color = '#ef4444';
                        }
                    }
                } else if (errorType === 'email_exists') {
                    showTeacherToast('Email address already exists in the system. Please use a different email.', 'error');
                    if (emailInput) {
                        emailInput.classList.add('error');
                        if (emailHelp) {
                            emailHelp.textContent = 'Email already exists';
                            emailHelp.style.color = '#ef4444';
                        }
                    }
                } else if (errorType === 'teacher_exists') {
                    showTeacherToast('A teacher account already exists for this user. Please check if the username or email is already in use.', 'error');
                    if (usernameInput) usernameInput.classList.add('error');
                    if (emailInput) emailInput.classList.add('error');
                } else if (errorType === 'invalid_email') {
                    showTeacherToast('Invalid email format. Please enter a valid email address.', 'error');
                    if (emailInput) {
                        emailInput.classList.add('error');
                        if (emailHelp) {
                            emailHelp.textContent = 'Invalid email format';
                            emailHelp.style.color = '#ef4444';
                        }
                    }
                } else if (errorType === 'invalid_password') {
                    showTeacherToast(errorMessage, 'error');
                    if (passwordInput) {
                        passwordInput.classList.add('error');
                        if (passwordHelp) {
                            passwordHelp.textContent = errorMessage;
                            passwordHelp.style.color = '#ef4444';
                        }
                    }
                } else {
                    showTeacherToast(errorMessage, 'error');
                }
            }
        } else {
            showTeacherToast('API client not available. Please refresh the page.', 'error');
        }
    } catch (error) {
        console.error('Error creating teacher:', error);

        // Extract error data - try multiple ways to get the error information
        let errorData = {};
        let errorType = 'unknown';
        let errorMessage = 'Failed to create teacher. Please try again.';

        // Try to get error data from different possible locations
        if (error.data) {
            errorData = error.data;
        } else if (error.response && error.response.data) {
            errorData = error.response.data;
        } else if (typeof error === 'object' && error.error_type) {
            errorData = error;
        }

        // Extract error type and message - check error object properties first, then errorData
        errorType = error.error_type || errorData.error_type || 'unknown';
        errorMessage = error.error_message || errorData.error || errorData.message || errorData.detail || error.message || 'Failed to create teacher. Please try again.';

        // Handle specific error types from API
        if (errorType === 'username_exists') {
            showTeacherToast('Username already exists. Please choose a different username.', 'error');
            if (usernameInput) {
                usernameInput.classList.add('error');
                if (usernameHelp) {
                    usernameHelp.textContent = 'Username already exists';
                    usernameHelp.style.color = '#ef4444';
                }
            }
        } else if (errorType === 'email_exists') {
            showTeacherToast('Email address already exists in the system. Please use a different email.', 'error');
            if (emailInput) {
                emailInput.classList.add('error');
                if (emailHelp) {
                    emailHelp.textContent = 'Email already exists';
                    emailHelp.style.color = '#ef4444';
                }
            }
        } else if (errorType === 'teacher_exists') {
            // Show notification for teacher_exists error
            const teacherExistsMessage = errorMessage || 'A teacher account already exists for this user. Please check if the username or email is already in use.';
            showTeacherToast(teacherExistsMessage, 'error');
            if (usernameInput) usernameInput.classList.add('error');
            if (emailInput) emailInput.classList.add('error');
            // Also update help text if available
            if (usernameHelp) {
                usernameHelp.textContent = 'Teacher account already exists for this username or email';
                usernameHelp.style.color = '#ef4444';
            }
            if (emailHelp) {
                emailHelp.textContent = 'Teacher account already exists for this username or email';
                emailHelp.style.color = '#ef4444';
            }
        } else if (errorType === 'invalid_password') {
            showTeacherToast(errorMessage, 'error');
            if (passwordInput) {
                passwordInput.classList.add('error');
                if (passwordHelp) {
                    passwordHelp.textContent = errorMessage;
                    passwordHelp.style.color = '#ef4444';
                }
            }
        } else if (errorType === 'invalid_email') {
            showTeacherToast('Invalid email format. Please enter a valid email address.', 'error');
            if (emailInput) {
                emailInput.classList.add('error');
                if (emailHelp) {
                    emailHelp.textContent = 'Invalid email format';
                    emailHelp.style.color = '#ef4444';
                }
            }
        } else {
            // Show generic error notification
            showTeacherToast(`Error: ${errorMessage}`, 'error');
        }
    }
}

function handleProfileUpdate() {
    // Here you would typically send the profile data to your server
    showSuccessModal('Profile updated successfully!');
}

function handlePasswordUpdate() {
    const currentPassword = document.getElementById('currentPassword')?.value;
    const newPassword = document.getElementById('newPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match!');
        return;
    }

    // Here you would typically send the password data to your server
    showSuccessModal('Password updated successfully!');

    // Reset the password form
    const form = document.getElementById('passwordForm');
    if (form) form.reset();
}

// Modal functions
function showSuccessModal(message) {
    const modal = document.getElementById('successModal');
    const messageElement = document.getElementById('successMessage');

    if (modal && messageElement) {
        messageElement.textContent = message;
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

// Utility functions
function viewSpecificAssignment(studentId, assignmentId) {
    // Navigate to assignment request tab and highlight specific assignment card
    showSection('assignment-requests');

    setTimeout(() => {
        // Remove previous highlights
        const cards = document.querySelectorAll('.assignment-card');
        cards.forEach(card => {
            card.classList.remove('highlighted-assignment');
        });

        // Find the specific assignment card by data attributes
        const target = document.querySelector(
            `.assignment-card[data-student-id="${studentId}"][data-assignment-id="${assignmentId}"]`
        );

        if (target) {
            target.classList.add('highlighted-assignment');
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 150);
}

function getStudentNameById(studentId) {
    // Attempt to find student name in the DOM if it's already there
    const studentRow = document.querySelector(`[data-user-id="${studentId}"]`);
    if (studentRow) {
        const nameElement = studentRow.querySelector('.user-name');
        if (nameElement) return nameElement.textContent.trim();
    }
    return 'Student ' + studentId;
}

async function viewAssignmentDetails(assignmentId) {
    const modal = document.getElementById('assignmentDetailsModal');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.classList.add('active');

    try {
        // Fetch assignment details and teachers list in parallel
        const [detailsRes, teachersRes] = await Promise.all([
            fetch(`/assingment/admin/details/${assignmentId}/`),
            fetch('/account/api/admin/list-teachers/')
        ]);

        const data = await detailsRes.json();
        const teachersData = await teachersRes.json();

        if (data.success) {
            const assignment = data.assignment;
            const student = data.student;
            const assignedTeachers = data.assigned_teachers;
            const files = data.files;

            // Store ID for saving
            const idField = document.getElementById('modalAssignmentIdValue');
            if (idField) idField.value = assignment.id;

            // Student Info
            document.querySelectorAll('#modalStudentName').forEach(el => el.textContent = student.name);
            document.querySelectorAll('#modalStudentEmail').forEach(el => el.textContent = student.email);
            document.querySelectorAll('#modalStudentId').forEach(el => el.textContent = student.student_id);

            // Assignment Info
            document.getElementById('modalAssignmentId').textContent = assignment.code;
            document.getElementById('modalAssignmentTitle').textContent = assignment.title;
            document.getElementById('modalAssignmentType').textContent = assignment.service_type;
            document.getElementById('modalDeadline').textContent = assignment.due_date || assignment.exam_date || '-';
            const priorityEl = document.getElementById('modalPriority');
            if (priorityEl) {
                priorityEl.textContent = assignment.priority_display || (assignment.priority ? assignment.priority.toUpperCase() : '-');
                priorityEl.className = `info-value priority-text ${assignment.priority || ''}`;
            }
            document.getElementById('modalSubmissionDate').textContent = assignment.created_at;

            // Features
            const featuresContainer = document.getElementById('modalFeatures');
            featuresContainer.innerHTML = '';
            if (assignment.features && assignment.features.length > 0) {
                assignment.features.forEach(feature => {
                    const span = document.createElement('span');
                    span.className = 'tag';
                    span.textContent = feature.replace(/-/g, ' ').toUpperCase();
                    featuresContainer.appendChild(span);
                });
            } else {
                featuresContainer.innerHTML = '<span class="tag muted">None selected</span>';
            }

            // Completion Details handling
            const completionSection = document.getElementById('modalCompletionSection');
            const completionNotes = document.getElementById('modalCompletionNotes');
            const solutionAttachments = document.getElementById('modalSolutionAttachments');
            
            if (assignment.status === 'completed') {
                if (completionSection) completionSection.style.display = 'block';
                if (completionNotes) completionNotes.textContent = assignment.completion_notes || 'No notes provided.';
                
                if (solutionAttachments) {
                    solutionAttachments.innerHTML = '';
                    const solutionFiles = files.filter(f => f.type !== 'support');
                    if (solutionFiles.length > 0) {
                        solutionFiles.forEach(file => {
                            const fileExt = file.name.split('.').pop().toLowerCase();
                            let icon = 'fa-file-alt';
                            if (['pdf'].includes(fileExt)) icon = 'fa-file-pdf';
                            else if (['doc', 'docx'].includes(fileExt)) icon = 'fa-file-word';
                            else if (['zip', 'rar'].includes(fileExt)) icon = 'fa-file-archive';
                            
                            const div = document.createElement('div');
                            div.className = 'attachment-item-modern';
                            div.innerHTML = `
                                <i class="fas ${icon}"></i>
                                <span class="file-name" title="${file.name}">${file.name}</span>
                                <a href="${file.url}" class="download-link" target="_blank"><i class="fas fa-download"></i></a>
                            `;
                            solutionAttachments.appendChild(div);
                        });
                    } else {
                        solutionAttachments.innerHTML = '<p class="muted">No solution files uploaded.</p>';
                    }
                }
            } else {
                if (completionSection) completionSection.style.display = 'none';
            }

            // Populating Teacher Selects
            const primarySelect = document.getElementById('primaryTeacherSelect');
            const helperSelect = document.getElementById('helperTeacherSelect');
            const saveBtn = document.querySelector('#assignmentDetailsModal .modern-btn-primary');

            // Disable selects and hide save button if completed
            if (assignment.status === 'completed' || assignment.status === 'cancelled' || assignment.status === 'deleted') {
                if (primarySelect) primarySelect.disabled = true;
                if (helperSelect) helperSelect.disabled = true;
                if (saveBtn) saveBtn.style.display = 'none';
            } else {
                if (primarySelect) primarySelect.disabled = false;
                if (helperSelect) helperSelect.disabled = false;
                if (saveBtn) saveBtn.style.display = 'inline-flex';
            }

            // Find assigned teachers
            let primaryTeacher = null;
            let helperTeacher = null;

            if (assignedTeachers && assignedTeachers.length > 0) {
                assignedTeachers.forEach(teacher => {
                    if (teacher.role === 'primary') {
                        primaryTeacher = teacher;
                    } else if (teacher.role === 'helper' || teacher.role === 'secondary') {
                        helperTeacher = teacher;
                    }
                });
            }

            // Populate dropdowns and pre-select assigned teachers
            [primarySelect, helperSelect].forEach((select, index) => {
                if (select) {
                    const isPrimary = index === 0;
                    const firstOption = select.options[0];
                    select.innerHTML = '';
                    select.appendChild(firstOption);

                    if (teachersData.success) {
                        teachersData.teachers.forEach(t => {
                            const opt = document.createElement('option');
                            opt.value = t.id; // Use database primary key
                            opt.textContent = `${t.name} - ${t.expertise}`;
                            opt.dataset.name = t.name;
                            opt.dataset.id = t.teacher_id; // Store 4-digit ID in dataset if needed
                            opt.dataset.avatar = t.profile_picture_url || '';
                            select.appendChild(opt);
                        });
                    }

                    // Pre-select assigned teacher
                    const assignedTeacher = isPrimary ? primaryTeacher : helperTeacher;
                    if (assignedTeacher && assignedTeacher.id) {
                        select.value = assignedTeacher.id;
                    }
                }
            });

            // Update assigned teachers display using the proper format
            updateAssignedTeachersDisplay({
                primary: primaryTeacher ? {
                    id: primaryTeacher.id,
                    name: primaryTeacher.name,
                    avatar: primaryTeacher.profile_picture_url || ''
                } : null,
                helper: helperTeacher ? {
                    id: helperTeacher.id,
                    name: helperTeacher.name,
                    avatar: helperTeacher.profile_picture_url || ''
                } : null
            });
        }
    } catch (error) {
        console.error('Error fetching assignment details:', error);
        showToast('Failed to load assignment details', 'error');
    }
}

async function getAssignmentData(studentId, assignmentId) {
    // Fetch assignment data from API
    try {
        if (typeof apiClient !== 'undefined' && apiClient.getAssignment) {
            // Get assignment by ID
            const assignment = await apiClient.getAssignment(assignmentId);

            if (assignment) {
                // Format data to match expected structure
                const studentDetail = assignment.student_detail || {};
                const teacherAssignments = assignment.teacher_assignments || [];

                // Find primary teacher (first active/assigned teacher)
                const primaryTeacherAssignment = teacherAssignments.find(ta =>
                    (ta.status === 'active' || ta.status === 'assigned') &&
                    (ta.role === 'primary' || !ta.role || ta.role === 'main')
                );

                // Find helper/secondary teacher
                const helperTeacherAssignment = teacherAssignments.find(ta =>
                    (ta.status === 'active' || ta.status === 'assigned') &&
                    (ta.role === 'helper' || ta.role === 'secondary' || ta.role === 'assistant')
                );

                return {
                    assignment_id: assignmentId,
                    student_id: studentId,
                    student: {
                        name: `${studentDetail.first_name || ''} ${studentDetail.last_name || ''}`.trim() || studentDetail.email,
                        email: studentDetail.email,
                        id: studentDetail.student_id || studentDetail.id,
                        avatar: studentDetail.profile_picture_url || ''
                    },
                    assignment: {
                        assignment_id: assignment.assignment_code || assignment.assignment_id || assignmentId,
                        title: assignment.title,
                        type: assignment.service_type,
                        subject: assignment.service_subtype || assignment.service_type,
                        academicLevel: assignment.metadata?.academicLevel || '',
                        paperType: assignment.metadata?.paperType || '',
                        englishType: assignment.metadata?.englishType || '',
                        pages: assignment.metadata?.numberOfPages ? `${assignment.metadata.numberOfPages} pages` : '',
                        spacing: assignment.metadata?.spacing || '',
                        deadline: assignment.due_date ? new Date(assignment.due_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }) : '',
                        submissionDate: assignment.created_at ? new Date(assignment.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }) : '',
                        status: assignment.status,
                        features: assignment.metadata?.features || []
                    },
                    teachers: {
                        primary: primaryTeacherAssignment ? {
                            id: primaryTeacherAssignment.teacher_id || primaryTeacherAssignment.teacher?.teacher_id || primaryTeacherAssignment.teacher?.id,
                            name: primaryTeacherAssignment.teacher_detail?.first_name && primaryTeacherAssignment.teacher_detail?.last_name
                                ? `${primaryTeacherAssignment.teacher_detail.first_name} ${primaryTeacherAssignment.teacher_detail.last_name}`
                                : primaryTeacherAssignment.teacher?.first_name && primaryTeacherAssignment.teacher?.last_name
                                    ? `${primaryTeacherAssignment.teacher.first_name} ${primaryTeacherAssignment.teacher.last_name}`
                                    : null,
                            avatar: primaryTeacherAssignment.teacher_detail?.profile_picture_url || primaryTeacherAssignment.teacher?.profile_picture_url || ''
                        } : null,
                        helper: helperTeacherAssignment ? {
                            id: helperTeacherAssignment.teacher_id || helperTeacherAssignment.teacher?.teacher_id || helperTeacherAssignment.teacher?.id,
                            name: helperTeacherAssignment.teacher_detail?.first_name && helperTeacherAssignment.teacher_detail?.last_name
                                ? `${helperTeacherAssignment.teacher_detail.first_name} ${helperTeacherAssignment.teacher_detail.last_name}`
                                : helperTeacherAssignment.teacher?.first_name && helperTeacherAssignment.teacher?.last_name
                                    ? `${helperTeacherAssignment.teacher.first_name} ${helperTeacherAssignment.teacher.last_name}`
                                    : null,
                            avatar: helperTeacherAssignment.teacher_detail?.profile_picture_url || helperTeacherAssignment.teacher?.profile_picture_url || ''
                        } : null
                    }
                };
            }
        }
    } catch (error) {
        console.warn('API not available or error loading assignment data, using sample data:', error);
    }

    // Return sample data if API fails or is not available
    return getSampleAssignmentData(studentId, assignmentId);
}

// Sample assignment data for testing/demo
function getSampleAssignmentData(studentId, assignmentId) {
    // Sample assignments based on assignment ID
    const sampleAssignments = {
        1: {
            assignment_id: 'AJ-0001-001',
            student_id: studentId || '0001',
            student: {
                name: 'Alex Johnson',
                email: 'alex.johnson@email.com',
                id: '0001',
                avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face'
            },
            assignment: {
                assignment_id: 'AJ-0001-001',
                title: 'Research Paper on Machine Learning',
                type: 'Academic Writing',
                subject: 'Computer Science',
                academicLevel: 'Masters',
                paperType: 'Research Paper',
                englishType: 'US English',
                pages: '15 pages',
                spacing: 'Double Spaced',
                deadline: 'December 15, 2024',
                submissionDate: 'November 28, 2024',
                status: 'pending',
                features: ['Plagiarism Check', 'Bibliography', 'Revision']
            },
            teachers: {
                primary: {
                    id: 'teacher-3',
                    name: 'Dr. Michael Johnson',
                    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face'
                },
                helper: null
            }
        },
        2: {
            assignment_id: 'EW-0002-002',
            student_id: studentId || '0002',
            student: {
                name: 'Emma Wilson',
                email: 'emma.wilson@email.com',
                id: '0002',
                avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=40&h=40&fit=crop&crop=face'
            },
            assignment: {
                assignment_id: 'EW-0002-002',
                title: 'Physics Lab Report - Quantum Mechanics',
                type: 'Lab Report',
                subject: 'Physics',
                academicLevel: 'Undergraduate',
                paperType: 'Lab Report',
                englishType: 'US English',
                pages: '8 pages',
                spacing: 'Single Spaced',
                deadline: 'December 10, 2024',
                submissionDate: 'December 9, 2024',
                status: 'in-process',
                features: ['Data Analysis', 'Graphs']
            },
            teachers: {
                primary: {
                    id: 'teacher-2',
                    name: 'Dr. Sarah Chen',
                    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=40&h=40&fit=crop&crop=face'
                },
                helper: null
            }
        }
    };

    // Return specific assignment or default
    return sampleAssignments[assignmentId] || {
        assignment_id: `ASG-${assignmentId}`,
        student_id: studentId || '0001',
        student: {
            name: 'Sample Student',
            email: 'student@email.com',
            id: studentId || '0001',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face'
        },
        assignment: {
            assignment_id: `ASG-${assignmentId}`,
            title: 'Sample Assignment',
            type: 'Academic Writing',
            subject: 'General',
            academicLevel: 'Undergraduate',
            paperType: 'Essay',
            englishType: 'US English',
            pages: '5 pages',
            spacing: 'Double Spaced',
            deadline: 'December 20, 2024',
            submissionDate: 'December 1, 2024',
            status: 'pending',
            features: []
        },
        teachers: {
            primary: null,
            helper: null
        }
    };
}

// Load teachers list for dropdowns
async function loadTeachersForModal() {
    try {
        if (typeof apiClient !== 'undefined' && apiClient.getTeachers) {
            const teachers = await apiClient.getTeachers();
            if (teachers && teachers.length > 0) {
                return teachers;
            }
        }
    } catch (error) {
        console.warn('API not available or error loading teachers, using sample data:', error);
    }

    // Return sample teachers if API fails or is not available
    return getSampleTeachers();
}

// Sample teachers data for testing/demo
function getSampleTeachers() {
    return [
        {
            teacher_id: 'teacher-1',
            id: 'teacher-1',
            first_name: 'Amelia',
            last_name: 'Harper',
            email: 'a.harper@nanoproblem.com',
            subject: 'Mathematics',
            specialization: 'Mathematics',
            profile_picture_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=40&h=40&fit=crop&crop=face'
        },
        {
            teacher_id: 'teacher-2',
            id: 'teacher-2',
            first_name: 'Sarah',
            last_name: 'Chen',
            email: 's.chen@nanoproblem.com',
            subject: 'Physics',
            specialization: 'Physics',
            profile_picture_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=40&h=40&fit=crop&crop=face'
        },
        {
            teacher_id: 'teacher-3',
            id: 'teacher-3',
            first_name: 'Michael',
            last_name: 'Johnson',
            email: 'm.johnson@nanoproblem.com',
            subject: 'Computer Science',
            specialization: 'Computer Science',
            profile_picture_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face'
        },
        {
            teacher_id: 'teacher-4',
            id: 'teacher-4',
            first_name: 'Olivia',
            last_name: 'Carter',
            email: 'o.carter@nanoproblem.com',
            subject: 'English Literature',
            specialization: 'English Literature',
            profile_picture_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=40&h=40&fit=crop&crop=face'
        },
        {
            teacher_id: 'teacher-5',
            id: 'teacher-5',
            first_name: 'Robert',
            last_name: 'Brown',
            email: 'r.brown@nanoproblem.com',
            subject: 'History',
            specialization: 'History',
            profile_picture_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face'
        }
    ];
}

function populateAssignmentModal(data, teachersList = []) {
    // Populate student information
    const studentName = document.getElementById('modalStudentName');
    const studentEmail = document.getElementById('modalStudentEmail');
    const studentId = document.getElementById('modalStudentId');

    if (studentName) studentName.textContent = data.student.name;
    if (studentEmail) studentEmail.textContent = data.student.email;
    if (studentId) studentId.textContent = data.student.id || 'N/A';

    // Populate assignment information
    const assignmentIdEl = document.getElementById('modalAssignmentId');
    const titleEl = document.getElementById('modalAssignmentTitle');
    const typeEl = document.getElementById('modalAssignmentType');
    const deadlineEl = document.getElementById('modalDeadline');
    const submissionDateEl = document.getElementById('modalSubmissionDate');

    if (assignmentIdEl) assignmentIdEl.textContent = data.assignment.assignment_id || 'N/A';
    if (titleEl) titleEl.textContent = data.assignment.title || 'N/A';
    if (typeEl) typeEl.textContent = data.assignment.type || 'N/A';
    if (deadlineEl) deadlineEl.textContent = data.assignment.deadline || 'N/A';
    if (submissionDateEl) submissionDateEl.textContent = data.assignment.submissionDate || 'N/A';

    // Populate features
    const featuresContainer = document.getElementById('modalFeatures');
    if (featuresContainer) {
        featuresContainer.innerHTML = '';
        if (data.assignment.features && data.assignment.features.length > 0) {
            data.assignment.features.forEach(feature => {
                const featureTag = document.createElement('span');
                featureTag.className = 'tag';
                featureTag.textContent = feature;
                featuresContainer.appendChild(featureTag);
            });
        } else {
            featuresContainer.innerHTML = '<span class="tag">None selected</span>';
        }
    }

    // Populate teacher dropdowns
    populateTeacherDropdowns(teachersList, data.teachers);

    // Update assigned teachers display
    updateAssignedTeachersDisplay(data.teachers);
}

// Populate teacher dropdowns with available teachers
function populateTeacherDropdowns(teachersList, assignedTeachers) {
    const primarySelect = document.getElementById('primaryTeacherSelect');
    const helperSelect = document.getElementById('helperTeacherSelect');

    // Clear existing options (except first option)
    if (primarySelect) {
        primarySelect.innerHTML = '<option value="">Select Primary Teacher</option>';
    }
    if (helperSelect) {
        helperSelect.innerHTML = '<option value="">Select Helper Teacher (Optional)</option>';
    }

    // Add teachers to dropdowns
    teachersList.forEach(teacher => {
        const teacherId = teacher.teacher_id || teacher.id;
        const teacherName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email || 'Unknown';
        const teacherSubject = teacher.subject || teacher.specialization || '';
        const displayText = teacherSubject ? `${teacherName} - ${teacherSubject}` : teacherName;

        const option = document.createElement('option');
        option.value = teacherId;
        option.textContent = displayText;
        option.dataset.name = teacherName;
        option.dataset.avatar = teacher.profile_picture_url || '';

        // Add to primary dropdown
        if (primarySelect) {
            const primaryOption = option.cloneNode(true);
            // Mark as selected if this is the assigned primary teacher
            if (assignedTeachers.primary && assignedTeachers.primary.id == teacherId) {
                primaryOption.selected = true;
            }
            primarySelect.appendChild(primaryOption);
        }

        // Add to helper dropdown
        if (helperSelect) {
            const helperOption = option.cloneNode(true);
            // Mark as selected if this is the assigned helper teacher
            if (assignedTeachers.helper && assignedTeachers.helper.id == teacherId) {
                helperOption.selected = true;
            }
            // Don't show primary teacher in helper dropdown
            if (!assignedTeachers.primary || assignedTeachers.primary.id != teacherId) {
                helperSelect.appendChild(helperOption);
            }
        }
    });
}

function updateAssignedTeachersDisplay(teachers) {
    const teachersList = document.getElementById('assignedTeachersList');
    if (!teachersList) return;

    teachersList.innerHTML = '';

    if (teachers.primary && teachers.primary.id) {
        const teacher = {
            id: teachers.primary.id,
            name: teachers.primary.name || 'Unknown Teacher',
            avatar: teachers.primary.avatar || ''
        };
        teachersList.innerHTML += createTeacherItem(teacher, 'Primary Teacher', 'primary');
    }

    if (teachers.helper && teachers.helper.id) {
        const teacher = {
            id: teachers.helper.id,
            name: teachers.helper.name || 'Unknown Teacher',
            avatar: teachers.helper.avatar || ''
        };
        teachersList.innerHTML += createTeacherItem(teacher, 'Helper Teacher', 'helper');
    }

    if ((!teachers.primary || !teachers.primary.id) && (!teachers.helper || !teachers.helper.id)) {
        teachersList.innerHTML = '<p class="no-teachers" style="padding: 1rem; text-align: center; color: #9ca3af;">No teachers assigned yet.</p>';
    }
}

function createTeacherItem(teacher, role, type) {
    const emoji = type === 'primary' ? '👨‍🏫' : '👩‍🏫';
    const avatarUrl = teacher.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face';
    return `
        <div class="assigned-teacher-item" data-teacher-id="${teacher.id}" data-teacher-type="${type}">
            <div class="teacher-info">
                <div class="teacher-avatar-small">
                    <img src="${avatarUrl}" alt="${teacher.name}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="avatar-fallback" style="display: none;">${emoji}</div>
                </div>
                <div class="teacher-details">
                    <span class="teacher-name">${teacher.name}</span>
                    <span class="teacher-role-badge ${type}">${role}</span>
                </div>
            </div>
            <button class="remove-teacher-btn" onclick="removeTeacher('${type}', '${teacher.id}')" title="Remove ${role}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
}

function closeAssignmentDetailsModal() {
    const modal = document.getElementById('assignmentDetailsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';

        // Clear stored IDs
        const assignmentIdField = document.getElementById('modalAssignmentIdValue');
        const studentIdField = document.getElementById('modalStudentIdValue');
        if (assignmentIdField) assignmentIdField.value = '';
        if (studentIdField) studentIdField.value = '';
    }
}

// Helper function to update teacher assignment in modal UI (for demo mode)
function updateTeacherAssignmentInModal(type, teacherId, teacherName) {
    const assignmentIdField = document.getElementById('modalAssignmentIdValue');
    const studentIdField = document.getElementById('modalStudentIdValue');

    if (!assignmentIdField || !studentIdField) return;

    const assignmentId = assignmentIdField.value;
    const studentId = studentIdField.value;

    // Get current assignment data
    const currentData = getSampleAssignmentData(studentId, assignmentId);

    // Update teacher assignment
    if (type === 'primary') {
        // Find teacher from sample teachers
        const teachers = getSampleTeachers();
        const teacher = teachers.find(t => t.teacher_id === teacherId || t.id === teacherId);
        if (teacher) {
            currentData.teachers.primary = {
                id: teacher.teacher_id || teacher.id,
                name: `${teacher.first_name} ${teacher.last_name}`,
                avatar: teacher.profile_picture_url || ''
            };
        }
    } else if (type === 'helper') {
        const teachers = getSampleTeachers();
        const teacher = teachers.find(t => t.teacher_id === teacherId || t.id === teacherId);
        if (teacher) {
            currentData.teachers.helper = {
                id: teacher.teacher_id || teacher.id,
                name: `${teacher.first_name} ${teacher.last_name}`,
                avatar: teacher.profile_picture_url || ''
            };
        }
    }

    // Reload modal with updated data
    const teachers = getSampleTeachers();
    populateAssignmentModal(currentData, teachers);
}

// Helper function to remove teacher from modal UI (for demo mode)
function removeTeacherFromModal(type, teacherId) {
    const assignmentIdField = document.getElementById('modalAssignmentIdValue');
    const studentIdField = document.getElementById('modalStudentIdValue');

    if (!assignmentIdField || !studentIdField) return;

    const assignmentId = assignmentIdField.value;
    const studentId = studentIdField.value;

    // Get current assignment data
    const currentData = getSampleAssignmentData(studentId, assignmentId);

    // Remove teacher assignment
    if (type === 'primary') {
        currentData.teachers.primary = null;
        // Clear primary teacher selection
        const primarySelect = document.getElementById('primaryTeacherSelect');
        if (primarySelect) primarySelect.value = '';
    } else if (type === 'helper') {
        currentData.teachers.helper = null;
        // Clear helper teacher selection
        const helperSelect = document.getElementById('helperTeacherSelect');
        if (helperSelect) helperSelect.value = '';
    }

    // Reload modal with updated data
    const teachers = getSampleTeachers();
    populateAssignmentModal(currentData, teachers);
}



async function removeTeacher(type, teacherId) {
    const assignmentIdField = document.getElementById('modalAssignmentIdValue');

    if (!assignmentIdField || !assignmentIdField.value) {
        showSuccessModal('Assignment ID not found. Please refresh and try again.');
        return;
    }

    const roleName = type === 'primary' ? 'Primary' : 'Helper';

    if (!confirm(`Are you sure you want to remove the ${roleName.toLowerCase()} teacher?`)) {
        return;
    }

    try {
        // Call API to remove teacher assignment
        // Note: You may need to create an API endpoint for removing teacher assignments
        if (typeof apiClient !== 'undefined' && apiClient.removeTeacherAssignment) {
            try {
                await apiClient.removeTeacherAssignment(assignmentIdField.value, teacherId, type);
            } catch (apiError) {
                console.warn('API removal failed, updating UI with sample data:', apiError);
            }
        }

        // Update UI directly (works in demo mode)
        removeTeacherFromModal(type, teacherId);

        // Reload assignment data
        const studentIdField = document.getElementById('modalStudentIdValue');
        const studentId = studentIdField ? studentIdField.value : null;

        try {
            const [assignmentData, teachers] = await Promise.all([
                getAssignmentData(studentId, assignmentIdField.value),
                loadTeachersForModal()
            ]);

            if (assignmentData) {
                populateAssignmentModal(assignmentData, teachers);
                showSuccessModal(`${roleName} teacher removed successfully.`);
            } else {
                showSuccessModal(`${roleName} teacher removed successfully.`);
            }
        } catch (error) {
            console.warn('Error reloading data after removal:', error);
            showSuccessModal(`${roleName} teacher removed successfully.`);
        }
    } catch (error) {
        console.error('Error removing teacher:', error);
        showSuccessModal('Error removing teacher. Please try again.');
    }
}

function updateAssignmentStatus() {
    const statusSelect = document.getElementById('statusUpdate');
    if (statusSelect) {
        const newStatus = statusSelect.value;
        showSuccessModal(`Assignment status updated to: ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`);
        // Update the current status display
        // In real app, this would save to backend
    }
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const button = input.nextElementSibling;
    const icon = button ? button.querySelector('i') : null;

    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
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
        if (!statusBadge) return;

        const status = statusBadge.textContent.trim().toLowerCase();

        if (filter === 'all' || status.includes(filter)) {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
        }
    });
}

// Close modals when clicking outside
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
        e.target.style.display = 'none';

        // Clear assignment modal IDs if closing assignment details modal
        if (e.target.id === 'assignmentDetailsModal') {
            const assignmentIdField = document.getElementById('modalAssignmentIdValue');
            const studentIdField = document.getElementById('modalStudentIdValue');
            if (assignmentIdField) assignmentIdField.value = '';
            if (studentIdField) studentIdField.value = '';
        }

        // Clear invoice modal ID if closing invoice details modal
        if (e.target.id === 'invoiceDetailsModal') {
            e.preventDefault();
            e.stopPropagation();
            const invoiceIdField = document.getElementById('modalInvoiceIdValue');
            if (invoiceIdField) invoiceIdField.value = '';
            // Call close function to ensure proper cleanup
            closeInvoiceDetailsModal(e);
        }
    }
});

// Prevent modal content clicks from closing the modal
document.addEventListener('click', function (e) {
    if (e.target.closest('.modal-card')) {
        e.stopPropagation();
    }
});

// Keyboard navigation for modals
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        // Close any open modals
        const openModals = document.querySelectorAll('.modal-overlay.active');
        openModals.forEach(modal => {
            e.preventDefault();
            e.stopPropagation();
            modal.classList.remove('active');
            modal.style.display = 'none';

            // Clear invoice modal ID if closing invoice details modal
            if (modal.id === 'invoiceDetailsModal') {
                const invoiceIdField = document.getElementById('modalInvoiceIdValue');
                if (invoiceIdField) invoiceIdField.value = '';
            }

            // Clear assignment modal IDs if closing assignment details modal
            if (modal.id === 'assignmentDetailsModal') {
                const assignmentIdField = document.getElementById('modalAssignmentIdValue');
                const studentIdField = document.getElementById('modalStudentIdValue');
                if (assignmentIdField) assignmentIdField.value = '';
                if (studentIdField) studentIdField.value = '';
            }
        });
    }
});

// User Management functionality
function initializeUserManagement() {
    // Initialize user type tabs
    const userTypeTabs = document.querySelectorAll('.user-type-tab');
    userTypeTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const userType = this.getAttribute('data-user-type');
            filterUsersByType(userType);
        });
    });

    // Initialize user search
    const userSearchInput = document.getElementById('userSearchInput');
    if (userSearchInput) {
        userSearchInput.addEventListener('input', function () {
            filterUsers();
        });
    }

    // Initialize user status filter
    const userStatusFilter = document.getElementById('userStatusFilter');
    if (userStatusFilter) {
        userStatusFilter.addEventListener('change', function () {
            filterUsers();
        });
    }

    // Initialize user date filter
    const userDateFilter = document.getElementById('userDateFilter');
    if (userDateFilter) {
        userDateFilter.addEventListener('change', function () {
            filterUsers();
        });
    }
}

function filterUsersByType(userType) {
    // Update active tab
    const userTypeTabs = document.querySelectorAll('.user-type-tab');
    userTypeTabs.forEach(tab => {
        if (tab.getAttribute('data-user-type') === userType) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Show/hide appropriate table containers
    const studentsContainer = document.getElementById('studentsTableContainer');
    const teachersContainer = document.getElementById('teachersTableContainer');
    const csRepsContainer = document.getElementById('csRepsTableContainer');

    if (userType === 'students') {
        if (studentsContainer) studentsContainer.style.display = 'block';
        if (teachersContainer) teachersContainer.style.display = 'none';
        if (csRepsContainer) csRepsContainer.style.display = 'none';
    } else if (userType === 'teachers') {
        if (studentsContainer) studentsContainer.style.display = 'none';
        if (teachersContainer) teachersContainer.style.display = 'block';
        if (csRepsContainer) csRepsContainer.style.display = 'none';
    } else if (userType === 'cs-reps') {
        if (studentsContainer) studentsContainer.style.display = 'none';
        if (teachersContainer) teachersContainer.style.display = 'none';
        if (csRepsContainer) csRepsContainer.style.display = 'block';
    }

    // Apply current filters
    filterUsers();
}

function filterUsers() {
    const searchTerm = document.getElementById('userSearchInput')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('userStatusFilter')?.value || 'all';
    const dateFilter = document.getElementById('userDateFilter')?.value || 'all';

    // Get active user type
    const activeTab = document.querySelector('.user-type-tab.active');
    const activeUserType = activeTab ? activeTab.getAttribute('data-user-type') : 'students';

    // Determine which table to filter
    let userRows;
    if (activeUserType === 'students') {
        userRows = document.querySelectorAll('#studentsTableContainer .user-row');
    } else if (activeUserType === 'teachers') {
        userRows = document.querySelectorAll('#teachersTableContainer .user-row');
    } else if (activeUserType === 'cs-reps') {
        userRows = document.querySelectorAll('#csRepsTableContainer .user-row');
    } else {
        userRows = [];
    }

    userRows.forEach(row => {
        const userName = row.querySelector('.user-name')?.textContent.toLowerCase() || '';
        const userEmail = row.querySelector('.user-email')?.textContent.toLowerCase() || '';
        const statusBadge = row.querySelector('.status-badge');
        const isOnline = statusBadge?.classList.contains('online') || false;
        const isOffline = statusBadge?.classList.contains('offline') || false;
        const joinedDateText = row.querySelector('.user-joined')?.textContent || '';

        // Search filter
        const matchesSearch = userName.includes(searchTerm) || userEmail.includes(searchTerm);

        // Status filter (updated for Online/Offline)
        let matchesStatus = true;
        if (statusFilter === 'online') {
            matchesStatus = isOnline;
        } else if (statusFilter === 'offline') {
            matchesStatus = isOffline;
        }

        // Date filter (for all user types)
        let matchesDate = true;
        if (dateFilter !== 'all') {
            matchesDate = filterByDate(joinedDateText, dateFilter);
        }

        if (matchesSearch && matchesStatus && matchesDate) {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
        }
    });
}

// User Management Actions
// Export functions to window object for global access
window.toggleUserStatus = toggleUserStatus;
window.resetUserPassword = resetUserPassword;
window.showPasswordResetFormModal = showPasswordResetFormModal;
window.closePasswordResetFormModal = closePasswordResetFormModal;
window.generateRandomPassword = generateRandomPassword;
window.submitPasswordReset = submitPasswordReset;
window.showPasswordResetModal = showPasswordResetModal;
window.closePasswordResetModal = closePasswordResetModal;
window.copyPasswordToClipboard = copyPasswordToClipboard;
window.deleteUserAccount = deleteUserAccount;
window.chatWithUser = chatWithUser;
window.filterUsersByType = filterUsersByType;
window.filterUsers = filterUsers;

async function toggleUserStatus(userId, action) {
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
        const response = await apiClient.post('/account/api/admin/toggle-user-status/', {
            user_id: userId,
            action: action
        });

        if (response.success) {
            showToast(response.message || 'User status updated successfully.', 'success');
            // Reload the section to reflect changes
            if (window.loadedSections && window.loadedSections['user-management']) {
                delete window.loadedSections['user-management'];
            }
            showSection('user-management');
        } else {
            showToast(response.error || 'Failed to update user status.', 'error');
        }
    } catch (error) {
        console.error('Error toggling user status:', error);
        showToast('An error occurred. Please try again.', 'error');
    }
}

async function resetUserPassword(userId) {
    // Show the password reset form modal (removed old function that sent email reset link)
    showPasswordResetFormModal(userId);
}

// Ensure this function is always available on window (override any cached versions)
if (typeof window !== 'undefined') {
    window.resetUserPassword = resetUserPassword;
}

function showPasswordResetFormModal(userId) {
    const modal = document.getElementById('passwordResetFormModal');
    const userIdInput = document.getElementById('passwordResetUserId');
    const nameElement = document.getElementById('passwordResetFormUserName');
    const emailElement = document.getElementById('passwordResetFormUserEmail');
    const passwordInput = document.getElementById('passwordResetFormPassword');

    if (!modal || !userIdInput) {
        showToast('Password reset form not found. Please refresh the page.', 'error');
        return;
    }

    // Get user info from the table row
    const userRow = document.querySelector(`[data-user-id="${userId}"]`);
    let userName = 'User';
    let userEmail = '';

    if (userRow) {
        const nameEl = userRow.querySelector('.user-name');
        const emailEl = userRow.querySelector('.user-email');
        if (nameEl) userName = nameEl.textContent.trim();
        if (emailEl) userEmail = emailEl.textContent.trim();
    }

    // Set form values
    userIdInput.value = userId;
    if (nameElement) nameElement.textContent = userName;
    if (emailElement) emailElement.textContent = userEmail;
    if (passwordInput) passwordInput.value = '';

    // Show modal
    modal.classList.add('active');
    modal.style.display = 'flex';

    // Focus on password input
    setTimeout(() => {
        if (passwordInput) passwordInput.focus();
    }, 100);
}

function closePasswordResetFormModal() {
    const modal = document.getElementById('passwordResetFormModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        
        // Clear form
        const form = document.getElementById('passwordResetForm');
        if (form) form.reset();
    }
}

function generateRandomPassword() {
    const passwordInput = document.getElementById('passwordResetFormPassword');
    if (!passwordInput) return;

    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const length = 12;

    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    passwordInput.value = password;
    passwordInput.select();
    
    // Show toast
    showToast('Random password generated!', 'success');
}

async function submitPasswordReset(event) {
    event.preventDefault();

    const userIdInput = document.getElementById('passwordResetUserId');
    const passwordInput = document.getElementById('passwordResetFormPassword');
    const submitBtn = document.getElementById('submitPasswordResetBtn');

    if (!userIdInput || !passwordInput) {
        showToast('Form elements not found. Please refresh the page.', 'error');
        return;
    }

    const userId = userIdInput.value;
    const tempPassword = passwordInput.value.trim();

    if (!tempPassword || tempPassword.length < 6) {
        showToast('Password must be at least 6 characters long.', 'error');
        passwordInput.focus();
        return;
    }

    // Disable submit button
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
    }

    try {
        const response = await apiClient.post('/account/api/admin/reset-password/', {
            user_id: userId,
            temp_password: tempPassword
        });

        if (response.success) {
            // Close form modal
            closePasswordResetFormModal();
            
            // Show confirmation modal with password
            showPasswordResetModal(tempPassword, response.user_name || 'User', response.user_email || '');
            
            // Reload the section to reflect changes
            if (window.loadedSections && window.loadedSections['user-management']) {
                delete window.loadedSections['user-management'];
            }
            showSection('user-management');
        } else {
            showToast(response.error || 'Failed to reset password.', 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-key"></i> Reset Password';
            }
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        showToast('An error occurred. Please try again.', 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-key"></i> Reset Password';
        }
    }
}

function showPasswordResetModal(password, userName, userEmail) {
    const modal = document.getElementById('passwordResetModal');
    const passwordInput = document.getElementById('passwordResetPasswordDisplay');
    const nameElement = document.getElementById('passwordResetUserName');
    const emailElement = document.getElementById('passwordResetUserEmail');

    if (modal && passwordInput && nameElement && emailElement) {
        passwordInput.value = password;
        nameElement.textContent = userName;
        emailElement.textContent = userEmail;
        modal.classList.add('active');
        modal.style.display = 'flex';
        
        // Select the password text for easy copying
        setTimeout(() => {
            passwordInput.select();
            passwordInput.setSelectionRange(0, 99999); // For mobile devices
        }, 100);
    } else {
        // Fallback to toast if modal elements not found
        showToast(`Password reset successful. New password: ${password}`, 'success');
    }
}

function closePasswordResetModal() {
    const modal = document.getElementById('passwordResetModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        
        // Clear the password field for security
        const passwordInput = document.getElementById('passwordResetPasswordDisplay');
        if (passwordInput) {
            passwordInput.value = '';
        }
    }
}

function copyPasswordToClipboard() {
    const passwordInput = document.getElementById('passwordResetPasswordDisplay');
    if (passwordInput && passwordInput.value) {
        passwordInput.select();
        passwordInput.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            // Show feedback
            const copyBtn = event.target.closest('button');
            if (copyBtn) {
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                copyBtn.style.background = '#10b981';
                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.style.background = '';
                }, 2000);
            }
            showToast('Password copied to clipboard!', 'success');
        } catch (err) {
            console.error('Failed to copy password:', err);
            showToast('Failed to copy password. Please select and copy manually.', 'error');
        }
    }
}

async function deleteUserAccount(userId, userType) {
    // Get user info for confirmation message
    const userRow = document.querySelector(`[data-user-id="${userId}"]`);
    let userName = 'User';
    let userEmail = '';

    if (userRow) {
        const nameEl = userRow.querySelector('.user-name');
        const emailEl = userRow.querySelector('.user-email');
        if (nameEl) userName = nameEl.textContent.trim();
        if (emailEl) userEmail = emailEl.textContent.trim();
    }

    const userTypeName = userType === 'student' ? 'Student' : userType === 'teacher' ? 'Teacher' : 'CS Rep';
    
    // Strong confirmation - require typing DELETE
    const confirmMessage = `⚠️ PERMANENT DELETION WARNING ⚠️\n\n` +
        `You are about to PERMANENTLY DELETE the ${userTypeName} account:\n` +
        `Name: ${userName}\n` +
        `Email: ${userEmail}\n\n` +
        `This action CANNOT be undone. All user data, assignments, messages, and related information will be permanently deleted.\n\n` +
        `Type "DELETE" in the box below to confirm:`;

    // Create a custom confirmation dialog
    const deleteConfirmation = prompt(confirmMessage);
    
    if (deleteConfirmation !== 'DELETE') {
        if (deleteConfirmation !== null) {
            showToast('Deletion cancelled. You must type "DELETE" exactly to confirm.', 'error');
        }
        return;
    }

    // Final confirmation
    const finalConfirm = confirm(
        `FINAL CONFIRMATION\n\n` +
        `Are you absolutely sure you want to PERMANENTLY DELETE this account?\n\n` +
        `${userName} (${userEmail})\n\n` +
        `This action is IRREVERSIBLE!`
    );

    if (!finalConfirm) {
        showToast('Deletion cancelled.', 'info');
        return;
    }

    try {
        const response = await apiClient.post('/account/api/admin/delete-user/', {
            user_id: userId
        });

        if (response.success) {
            showToast(response.message || 'Account deleted successfully.', 'success');
            
            // Remove the row from the table with animation
            if (userRow) {
                userRow.style.transition = 'opacity 0.3s ease-out';
                userRow.style.opacity = '0';
                setTimeout(() => {
                    userRow.remove();
                    
                    // Check if table is empty and show message
                    const tbody = userRow.closest('tbody');
                    if (tbody && tbody.children.length === 0) {
                        const table = tbody.closest('table');
                        if (table) {
                            const emptyRow = document.createElement('tr');
                            emptyRow.innerHTML = `<td colspan="5" style="text-align: center; padding: 2rem;">No ${userType}s found.</td>`;
                            tbody.appendChild(emptyRow);
                        }
                    }
                }, 300);
            } else {
                // Reload the section if row not found
                if (window.loadedSections && window.loadedSections['user-management']) {
                    delete window.loadedSections['user-management'];
                }
                showSection('user-management');
            }
        } else {
            showToast(response.error || 'Failed to delete account.', 'error');
        }
    } catch (error) {
        console.error('Error deleting account:', error);
        showToast('An error occurred while deleting the account. Please try again.', 'error');
    }
}

function chatWithUser(userId, role) {
    // Set pending user ID so messaging.js can auto-start conversation
    window.__pendingMessagingUserId = userId;
    
    // Navigate to messages section - messaging.js will handle starting the conversation
    if (window.showSection) {
        showSection('messages');
    } else {
        console.warn('showSection not available. Messaging may not initialize properly.');
    }
}

function filterByDate(dateText, filterType) {
    if (!dateText) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parse date from text (format: "Jan 15, 2024")
    const dateParts = dateText.trim().split(' ');
    if (dateParts.length !== 3) return true;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames.indexOf(dateParts[0]);
    const day = parseInt(dateParts[1].replace(',', ''));
    const year = parseInt(dateParts[2]);

    if (isNaN(month) || isNaN(day) || isNaN(year)) return true;

    const joinedDate = new Date(year, month, day);
    joinedDate.setHours(0, 0, 0, 0);

    switch (filterType) {
        case 'today':
            return joinedDate.getTime() === today.getTime();
        case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            return joinedDate >= weekAgo;
        case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(today.getMonth() - 1);
            return joinedDate >= monthAgo;
        case 'quarter':
            const quarterAgo = new Date(today);
            quarterAgo.setMonth(today.getMonth() - 3);
            return joinedDate >= quarterAgo;
        case 'year':
            const yearAgo = new Date(today);
            yearAgo.setFullYear(today.getFullYear() - 1);
            return joinedDate >= yearAgo;
        case 'custom':
            // For custom range, you would need to implement a date picker
            return true;
        default:
            return true;
    }
}

function blockUser(userId, userType) {
    const userTypeName = userType === 'student' ? 'Student' : userType === 'teacher' ? 'Teacher' : 'CS Rep';
    const userName = getUserName(userId, userType);

    if (confirm(`Are you sure you want to block ${userName} (${userTypeName})?`)) {
        // In a real implementation, this would make an API call to block the user
        showSuccessModal(`${userTypeName} ${userName} has been blocked successfully.`);
        // You would typically update the UI to reflect the blocked status
        console.log(`Blocking ${userType} with ID: ${userId}`);
    }
}

// Old resetUserPassword function removed - using new one that shows form modal instead

function chatWithUser(userId, userType) {
    // Set pending user ID so messaging.js can auto-start conversation
    window.__pendingMessagingUserId = userId;
    
    // Navigate to messages section - messaging.js will handle starting the conversation
    if (window.showSection) {
        showSection('messages');
    } else {
        console.warn('showSection not available. Messaging may not initialize properly.');
    }
}

function getUserName(userId, userType) {
    // Helper function to get user name from the table row
    let selector;
    if (userType === 'student') {
        selector = `#studentsTableContainer .user-row[data-user-id="${userId}"] .user-name`;
    } else if (userType === 'teacher') {
        selector = `#teachersTableContainer .user-row[data-user-id="${userId}"] .user-name`;
    } else if (userType === 'cs-rep') {
        selector = `#csRepsTableContainer .user-row[data-user-id="${userId}"] .user-name`;
    }

    const nameElement = document.querySelector(selector);
    return nameElement ? nameElement.textContent.trim() : `User ${userId}`;
}

// Initialize filters when page loads
document.addEventListener('DOMContentLoaded', function () {
    initializeFilters();
});

// Export functions for use in HTML
// Note: showSection and getAdminSectionUrl are exported immediately after their definitions above
window.viewStudentDetails = viewStudentDetails;
window.closeStudentDetailsModal = closeStudentDetailsModal;
window.chatWithStudent = chatWithStudent;
window.chatWithStudentFromRequest = chatWithStudentFromRequest;
window.assignTeacher = assignTeacher;
window.changeTeacher = changeTeacher;
window.filterAssignmentsByStatus = filterAssignmentsByStatus;
window.cancelAssignment = cancelAssignment;
window.deleteAssignment = deleteAssignment;
window.viewSpecificAssignment = viewSpecificAssignment;
window.viewAssignmentDetails = viewAssignmentDetails;
window.closeAssignmentDetailsModal = closeAssignmentDetailsModal;
// Note: savePrimaryTeacher and saveHelperTeacher are handled by saveTeacherAssignments()
window.removeTeacher = removeTeacher;
window.updateAssignmentStatus = updateAssignmentStatus;
window.togglePassword = togglePassword;
window.generatePassword = generatePassword;
window.closeSuccessModal = closeSuccessModal;
window.toggleStudentAssignments = toggleStudentAssignments;

// Handler functions for teacher dropdown changes
function handlePrimaryTeacherChange(selectElement) {
    // Update the assigned teachers display immediately for better UX
    // The actual save will happen when user clicks "Save Changes"
    const teacherId = selectElement.value;

    // Get current helper teacher from display
    const helperSelect = document.getElementById('helperTeacherSelect');
    const helperTeacher = helperSelect && helperSelect.value ? {
        id: helperSelect.value,
        name: helperSelect.options[helperSelect.selectedIndex].dataset.name || helperSelect.options[helperSelect.selectedIndex].text,
        avatar: helperSelect.options[helperSelect.selectedIndex].dataset.avatar || ''
    } : null;

    if (teacherId) {
        const option = selectElement.options[selectElement.selectedIndex];
        const teacherName = option.dataset.name || option.text;
        const teacherAvatar = option.dataset.avatar || '';

        // Update the display immediately
        updateAssignedTeachersDisplay({
            primary: {
                id: teacherId,
                name: teacherName,
                avatar: teacherAvatar
            },
            helper: helperTeacher
        });
    } else {
        // Clear primary teacher if deselected
        updateAssignedTeachersDisplay({
            primary: null,
            helper: helperTeacher
        });
    }
}

function handleHelperTeacherChange(selectElement) {
    // Update the assigned teachers display immediately for better UX
    const teacherId = selectElement.value;

    // Get current primary teacher from display
    const primarySelect = document.getElementById('primaryTeacherSelect');
    const primaryTeacher = primarySelect && primarySelect.value ? {
        id: primarySelect.value,
        name: primarySelect.options[primarySelect.selectedIndex].dataset.name || primarySelect.options[primarySelect.selectedIndex].text,
        avatar: primarySelect.options[primarySelect.selectedIndex].dataset.avatar || ''
    } : null;

    if (teacherId) {
        const option = selectElement.options[selectElement.selectedIndex];
        const teacherName = option.dataset.name || option.text;
        const teacherAvatar = option.dataset.avatar || '';

        // Update the display immediately
        updateAssignedTeachersDisplay({
            primary: primaryTeacher,
            helper: {
                id: teacherId,
                name: teacherName,
                avatar: teacherAvatar
            }
        });
    } else {
        // Clear helper teacher if deselected
        updateAssignedTeachersDisplay({
            primary: primaryTeacher,
            helper: null
        });
    }
}

// Save all teacher assignments
async function saveTeacherAssignments() {
    const assignmentId = document.getElementById('modalAssignmentIdValue')?.value;
    const primarySelect = document.getElementById('primaryTeacherSelect');
    const helperSelect = document.getElementById('helperTeacherSelect');

    if (!assignmentId) {
        showToast('Assignment ID missing', 'error');
        return;
    }

    let successCount = 0;

    // Assign Primary Teacher
    if (primarySelect && primarySelect.value) {
        try {
            const res = await apiClient.post('/assingment/admin/assign-teacher/', {
                assignment_id: assignmentId,
                teacher_id: primarySelect.value,
                is_helper: false
            });
            if (res.success) successCount++;
        } catch (e) { console.error(e); }
    }

    // Assign Helper Teacher
    if (helperSelect && helperSelect.value) {
        try {
            const res = await apiClient.post('/assingment/admin/assign-teacher/', {
                assignment_id: assignmentId,
                teacher_id: helperSelect.value,
                is_helper: true
            });
            if (res.success) successCount++;
        } catch (e) { console.error(e); }
    }

    if (successCount > 0) {
        showSuccessModal(`Successfully assigned ${successCount} teacher(s).`);
        viewAssignmentDetails(assignmentId); // Refresh modal view
    } else {
        showToast('No teachers were assigned. Please select at least one.', 'warning');
    }
}

// Export functions for use in HTML templates
window.handlePrimaryTeacherChange = handlePrimaryTeacherChange;
window.handleHelperTeacherChange = handleHelperTeacherChange;
window.saveTeacherAssignments = saveTeacherAssignments;

// Change assignment teacher function
function changeAssignmentTeacher(selectElement, studentId, assignmentId) {
    const newTeacherId = selectElement.value;
    if (!newTeacherId) {
        return;
    }

    // Show confirmation
    if (confirm('Are you sure you want to change the teacher for this assignment?')) {
        // In a real implementation, this would make an API call
        if (typeof apiClient !== 'undefined' && apiClient.assignTeacher) {
            apiClient.assignTeacher(assignmentId, newTeacherId)
                .then(() => {
                    showSuccessModal('Teacher changed successfully');
                    // Reload assignment data
                    if (typeof loadAllAssignments === 'function') {
                        loadAllAssignments().then(assignments => {
                            const assignmentTable = document.querySelector('#assignmentSection table tbody');
                            if (assignmentTable && typeof renderAssignmentsTable === 'function') {
                                renderAssignmentsTable(assignments, '#assignmentSection table');
                            }
                        });
                    }
                })
                .catch(error => {
                    console.error('Error changing teacher:', error);
                    alert('Failed to change teacher. Please try again.');
                });
        } else {
            showSuccessModal('Teacher change requested (API not available)');
        }
    }
}

window.changeAssignmentTeacher = changeAssignmentTeacher;

// Save teacher change function
function saveTeacherChange(studentId, assignmentId) {
    const container = document.querySelector(`#assignment-details-${studentId}-${assignmentId} .teacher-selection-container`);
    if (!container) {
        console.warn('Teacher selection container not found');
        return;
    }

    const selectElement = container.querySelector('.teacher-select-assignment');
    const saveButton = container.querySelector('.teacher-change-btn');
    if (!selectElement) {
        console.warn('Teacher select element not found');
        return;
    }

    const teacherId = selectElement.value;
    const teacherName = selectElement.options[selectElement.selectedIndex]?.text || '';

    if (!teacherId) {
        showSuccessModal('Teacher assignment removed successfully.');
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.style.opacity = '0.6';
        }
        return;
    }

    // Make API call to assign teacher
    if (typeof apiClient !== 'undefined' && apiClient.assignTeacher) {
        apiClient.assignTeacher(assignmentId, teacherId)
            .then(() => {
                showSuccessModal(`Teacher assigned successfully! ${teacherName.split(' - ')[0]} is now assigned to this assignment.`);
                if (saveButton) {
                    saveButton.disabled = true;
                    saveButton.style.opacity = '0.6';
                }
                // Reload assignment data
                if (typeof loadAllAssignments === 'function') {
                    loadAllAssignments().then(assignments => {
                        const assignmentTable = document.querySelector('#assignmentSection table tbody');
                        if (assignmentTable && typeof renderAssignmentsTable === 'function') {
                            renderAssignmentsTable(assignments, '#assignmentSection table');
                        }
                    });
                }
            })
            .catch(error => {
                console.error('Error saving teacher change:', error);
                alert('Failed to save teacher change. Please try again.');
            });
    } else {
        showSuccessModal(`Teacher assigned successfully! ${teacherName.split(' - ')[0]} is now assigned to this assignment.`);
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.style.opacity = '0.6';
        }
    }
}

window.saveTeacherChange = saveTeacherChange;
window.filterUsersByType = filterUsersByType;
window.blockUser = blockUser;
window.resetUserPassword = resetUserPassword;
window.showPasswordResetFormModal = showPasswordResetFormModal;
window.closePasswordResetFormModal = closePasswordResetFormModal;
window.generateRandomPassword = generateRandomPassword;
window.submitPasswordReset = submitPasswordReset;
window.showPasswordResetModal = showPasswordResetModal;
window.closePasswordResetModal = closePasswordResetModal;
window.copyPasswordToClipboard = copyPasswordToClipboard;
window.deleteUserAccount = deleteUserAccount;
window.chatWithUser = chatWithUser;

// Financial Reporting functionality
function initializeFinancialReporting() {
    // Initialize date range filter
    const financialDateRange = document.getElementById('financialDateRange');
    if (financialDateRange) {
        financialDateRange.addEventListener('change', function () {
            updateFinancialReports();
        });
    }

    // Initialize invoice request filter
    const invoiceRequestFilter = document.getElementById('invoiceRequestFilter');
    if (invoiceRequestFilter) {
        invoiceRequestFilter.addEventListener('change', function () {
            filterInvoiceRequests();
        });
    }

    // Initialize invoice status filter
    const invoiceStatusFilter = document.getElementById('invoiceStatusFilter');
    if (invoiceStatusFilter) {
        invoiceStatusFilter.addEventListener('change', function () {
            filterInvoiceStatus();
        });
    }
}

function updateFinancialReports() {
    const dateRange = document.getElementById('financialDateRange')?.value || '30';

    // In a real implementation, this would fetch data from the server based on date range
    showSuccessModal(`Financial reports updated for ${dateRange === '7' ? 'last 7 days' : dateRange === '30' ? 'last 30 days' : dateRange === '90' ? 'last 90 days' : dateRange === '365' ? 'last year' : 'custom range'}`);

    // Here you would typically update the metric cards and charts with new data
    // For demo purposes, we'll just show a success message
}

function filterInvoiceRequests() {
    const filterValue = document.getElementById('invoiceRequestFilter')?.value || 'all';
    const invoiceRows = document.querySelectorAll('.invoice-request-row');

    invoiceRows.forEach(row => {
        const status = row.getAttribute('data-status') || '';

        if (filterValue === 'all' || status === filterValue) {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
        }
    });
}

function filterInvoiceStatus() {
    const filterValue = document.getElementById('invoiceStatusFilter')?.value || 'all';
    const invoiceRows = document.querySelectorAll('.invoice-status-row');

    invoiceRows.forEach(row => {
        const status = row.getAttribute('data-status') || '';

        if (filterValue === 'all' || status === filterValue) {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
        }
    });
}

// Invoice approval function - will be overridden by adminInvoiceHelpers.js if loaded
async function acceptInvoiceRequest_OLD2(invoiceId) {
    // If adminInvoiceHelpers is loaded, it will handle this
    if (typeof window.acceptInvoiceRequest === 'function' && window.acceptInvoiceRequest !== acceptInvoiceRequest) {
        return await window.acceptInvoiceRequest(invoiceId);
    }

    // Fallback implementation
    if (typeof apiClient !== 'undefined') {
        try {
            const success = await approveInvoice(invoiceId);
            if (success) {
                showSuccessModal('Invoice approved successfully!');
                // Update UI
                const row = document.querySelector(`.invoice-request-row[data-invoice-id="${invoiceId}"]`);
                if (row) {
                    row.setAttribute('data-status', 'approved');
                    const statusCell = row.querySelector('.invoice-status');
                    if (statusCell) {
                        statusCell.innerHTML = '<span class="status-badge completed">Approved</span>';
                    }
                }
                return true;
            }
        } catch (error) {
            console.error('Error approving invoice:', error);
            alert('Failed to approve invoice');
        }
    } else {
        // Mock behavior
        showSuccessModal('Invoice approved successfully!');
        const row = document.querySelector(`.invoice-request-row[data-invoice-id="${invoiceId}"]`);
        if (row) {
            row.setAttribute('data-status', 'approved');
        }
    }
    return false;
}

// Original function (kept for reference)
function acceptInvoiceRequest_OLD(invoiceId) {
    if (confirm('Are you sure you want to accept this invoice request and send it to the student?')) {
        const row = document.querySelector(`[data-invoice-id="${invoiceId}"]`);

        if (row) {
            // Update status
            const statusCell = row.querySelector('.invoice-status');
            if (statusCell) {
                statusCell.innerHTML = `
                    <span class="status-badge completed">
                        <i class="fas fa-check-circle"></i>
                        Accepted
                    </span>
                `;
            }

            // Update row data attribute
            row.setAttribute('data-status', 'accepted');

            // Update actions
            const actionsCell = row.querySelector('.invoice-actions');
            if (actionsCell) {
                actionsCell.innerHTML = `
                    <div class="action-buttons-group">
                        <button class="action-btn view-btn" onclick="viewInvoiceDetails_OLD(${invoiceId})" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn download-btn" onclick="downloadInvoice(${invoiceId})" title="Download Invoice">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                `;
            }

            // Update invoice created date to current (simulating acceptance)
            const createdCell = row.querySelector('.invoice-created');
            if (createdCell) {
                const now = new Date();
                createdCell.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }

            showSuccessModal(`Invoice request #INV-2024-${String(invoiceId).padStart(3, '0')} has been accepted and sent to the student.`);
        }
    }
}

function rejectInvoiceRequest_OLD(invoiceId) {
    if (confirm('Are you sure you want to reject this invoice request?')) {
        const row = document.querySelector(`[data-invoice-id="${invoiceId}"]`);

        if (row) {
            // Update status
            const statusCell = row.querySelector('.invoice-status');
            if (statusCell) {
                statusCell.innerHTML = `
                    <span class="status-badge cancelled">
                        <i class="fas fa-times-circle"></i>
                        Rejected
                    </span>
                `;
            }

            // Update row data attribute
            row.setAttribute('data-status', 'rejected');

            // Update actions
            const actionsCell = row.querySelector('.invoice-actions');
            if (actionsCell) {
                actionsCell.innerHTML = `
                    <div class="action-buttons-group">
                        <button class="action-btn view-btn" onclick="viewInvoiceDetails_OLD(${invoiceId})" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                `;
            }

            showSuccessModal(`Invoice request #INV-2024-${String(invoiceId).padStart(3, '0')} has been rejected.`);
        }
    }
}

async function viewInvoiceDetails_OLD(invoiceId) {
    const modal = document.getElementById('invoiceDetailsModal');

    if (!modal) {
        console.error('Invoice details modal not found');
        showSuccessModal('Invoice details modal not found.');
        return;
    }

    // Show loading state
    modal.style.display = 'flex';
    modal.classList.add('active');

    // Store invoice ID in hidden field
    const invoiceIdField = document.getElementById('modalInvoiceIdValue');
    if (invoiceIdField) invoiceIdField.value = invoiceId;

    try {
        // Load invoice data
        const invoiceData = await getInvoiceData(invoiceId);

        if (invoiceData) {
            populateInvoiceModal(invoiceData);
        } else {
            console.error('Failed to load invoice data');
            showSuccessModal('Invoice details not found.');
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    } catch (error) {
        console.error('Error loading invoice details:', error);
        // Even on error, try to show sample data
        try {
            const invoiceData = getSampleInvoiceData(invoiceId);
            if (invoiceData) {
                populateInvoiceModal(invoiceData);
            } else {
                showSuccessModal('Error loading invoice details. Please try again.');
                modal.style.display = 'none';
                modal.classList.remove('active');
            }
        } catch (fallbackError) {
            console.error('Error loading fallback data:', fallbackError);
            showSuccessModal('Error loading invoice details. Please try again.');
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    }
}

async function getInvoiceData(invoiceId) {
    // Fetch invoice data from API
    try {
        if (typeof apiClient !== 'undefined' && apiClient.getInvoice) {
            const invoice = await apiClient.getInvoice(invoiceId);

            if (invoice) {
                // Format data to match expected structure
                const studentDetail = invoice.student_detail || {};
                const assignmentDetail = invoice.assignment_detail || {};
                const csRepDetail = invoice.cs_rep_detail || {};

                return {
                    invoice_id: invoiceId,
                    invoice_number: invoice.invoice_number || `INV-2024-${String(invoiceId).padStart(3, '0')}`,
                    status: invoice.status || 'pending',
                    created_date: invoice.created_at || invoice.created_date || '',
                    due_date: invoice.due_date || '',
                    student: {
                        name: `${studentDetail.first_name || ''} ${studentDetail.last_name || ''}`.trim() || studentDetail.email || 'Unknown',
                        email: studentDetail.email || '',
                        id: studentDetail.student_id || studentDetail.id || ''
                    },
                    assignment: {
                        id: assignmentDetail.assignment_id || assignmentDetail.assignment_code || '',
                        title: assignmentDetail.title || 'N/A'
                    },
                    cs_rep: csRepDetail.first_name && csRepDetail.last_name ? {
                        name: `${csRepDetail.first_name} ${csRepDetail.last_name}`,
                        email: csRepDetail.email || ''
                    } : null,
                    amount: invoice.amount || 0,
                    discount: invoice.discount || 0,
                    total_amount: invoice.total_amount || (invoice.amount || 0) - (invoice.discount || 0),
                    notes: invoice.notes || ''
                };
            }
        }
    } catch (error) {
        console.warn('API not available or error loading invoice data, using sample data:', error);
    }

    // Return sample data if API fails or is not available
    return getSampleInvoiceData(invoiceId);
}

// Sample invoice data for testing/demo
function getSampleInvoiceData(invoiceId) {
    // Get invoice row data from the table - try both invoice-request-row and invoice-status-row
    let row = document.querySelector(`.invoice-request-row[data-invoice-id="${invoiceId}"]`);
    if (!row) {
        row = document.querySelector(`.invoice-status-row[data-invoice-id="${invoiceId}"]`);
    }
    // Also try by invoice ID text content
    if (!row) {
        const allRows = document.querySelectorAll('.invoice-request-row, .invoice-status-row');
        for (let r of allRows) {
            const idEl = r.querySelector('.invoice-id');
            if (idEl && idEl.textContent.includes(String(invoiceId).padStart(3, '0'))) {
                row = r;
                break;
            }
        }
    }

    if (row) {
        // Extract data from the table row
        const invoiceIdEl = row.querySelector('.invoice-id');
        const studentInfoEl = row.querySelector('.student-info');
        const csRepInfoEl = row.querySelector('.cs-rep-info');
        const amountEl = row.querySelector('.invoice-amount');
        const dueDateEl = row.querySelector('.invoice-due-date');
        const statusEl = row.querySelector('.status-badge');
        const createdEl = row.querySelector('.invoice-created') || row.querySelector('.invoice-issued');

        const invoiceNumber = invoiceIdEl ? invoiceIdEl.textContent.trim() : `#INV-2024-${String(invoiceId).padStart(3, '0')}`;
        const studentName = studentInfoEl ? studentInfoEl.querySelector('.student-name')?.textContent.trim() || 'Unknown' : 'Unknown';
        const studentEmail = studentInfoEl ? studentInfoEl.querySelector('.student-email')?.textContent.trim() || '' : '';
        const csRepName = csRepInfoEl ? csRepInfoEl.querySelector('.cs-rep-name')?.textContent.trim() || null : null;
        const csRepEmail = csRepInfoEl ? csRepInfoEl.querySelector('.cs-rep-email')?.textContent.trim() || '' : '';
        const amountText = amountEl ? amountEl.textContent.trim().replace('$', '').replace(/,/g, '') : '0';
        const amount = parseFloat(amountText) || 0;
        const dueDate = dueDateEl ? dueDateEl.textContent.trim() : '';
        const status = statusEl ? statusEl.textContent.trim().toLowerCase() : 'pending';
        const createdDate = createdEl ? createdEl.textContent.trim() : '';

        // For demo purposes, assume discount is 10% of amount if amount > 1000
        const discount = amount > 1000 ? Math.round(amount * 0.1 * 100) / 100 : 0;
        const totalAmount = amount - discount;

        return {
            invoice_id: invoiceId,
            invoice_number: invoiceNumber,
            status: status,
            created_date: createdDate,
            due_date: dueDate,
            student: {
                name: studentName,
                email: studentEmail,
                id: `000${invoiceId}`
            },
            assignment: {
                id: `ASG-2024-${String(invoiceId).padStart(3, '0')}`,
                title: 'Assignment Title'
            },
            cs_rep: csRepName ? {
                name: csRepName,
                email: csRepEmail
            } : null,
            amount: amount,
            discount: discount,
            total_amount: totalAmount,
            notes: ''
        };
    }

    // Fallback sample data
    const sampleInvoices = {
        1: {
            invoice_id: 1,
            invoice_number: '#INV-2024-001',
            status: 'pending',
            created_date: 'Dec 10, 2024',
            due_date: 'Dec 20, 2024',
            student: {
                name: 'Alex Johnson',
                email: 'alex.johnson@email.com',
                id: '0001'
            },
            assignment: {
                id: 'ASG-2024-001',
                title: 'Research Paper on Machine Learning'
            },
            cs_rep: {
                name: 'John Smith',
                email: 'j.smith@nanoproblem.com'
            },
            amount: 1250.00,
            discount: 125.00,
            total_amount: 1125.00,
            notes: 'Invoice created for assignment completion.'
        },
        2: {
            invoice_id: 2,
            invoice_number: '#INV-2024-002',
            status: 'pending',
            created_date: 'Dec 8, 2024',
            due_date: 'Dec 15, 2024',
            student: {
                name: 'Emma Wilson',
                email: 'emma.wilson@email.com',
                id: '0002'
            },
            assignment: {
                id: 'ASG-2024-002',
                title: 'Physics Lab Report - Quantum Mechanics'
            },
            cs_rep: {
                name: 'Emily Brown',
                email: 'e.brown@nanoproblem.com'
            },
            amount: 850.00,
            discount: 0,
            total_amount: 850.00,
            notes: ''
        }
    };

    return sampleInvoices[invoiceId] || {
        invoice_id: invoiceId,
        invoice_number: `#INV-2024-${String(invoiceId).padStart(3, '0')}`,
        status: 'pending',
        created_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        due_date: '',
        student: {
            name: 'Unknown Student',
            email: '',
            id: ''
        },
        assignment: {
            id: '',
            title: 'N/A'
        },
        cs_rep: null,
        amount: 0,
        discount: 0,
        total_amount: 0,
        notes: ''
    };
}

function populateInvoiceModal(data) {
    // Populate invoice information
    const invoiceIdEl = document.getElementById('modalInvoiceId');
    const statusEl = document.getElementById('modalInvoiceStatus');
    const createdEl = document.getElementById('modalInvoiceCreated');
    const dueDateEl = document.getElementById('modalInvoiceDueDate');

    if (invoiceIdEl) invoiceIdEl.textContent = data.invoice_number || 'N/A';
    if (createdEl) createdEl.textContent = data.created_date || 'N/A';
    if (dueDateEl) dueDateEl.textContent = data.due_date || 'N/A';

    // Populate status with badge
    if (statusEl) {
        const statusClass = data.status === 'pending' ? 'pending' :
            data.status === 'paid' ? 'completed' :
                data.status === 'overdue' ? 'cancelled' :
                    data.status === 'sent' ? 'in-process' : 'pending';
        const statusIcon = data.status === 'pending' ? 'fa-clock' :
            data.status === 'paid' ? 'fa-check-circle' :
                data.status === 'overdue' ? 'fa-exclamation-triangle' :
                    data.status === 'sent' ? 'fa-paper-plane' : 'fa-clock';
        statusEl.innerHTML = `<span class="status-badge ${statusClass}"><i class="fas ${statusIcon}"></i> ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</span>`;
    }

    // Populate student information
    const studentNameEl = document.getElementById('modalInvoiceStudentName');
    const studentEmailEl = document.getElementById('modalInvoiceStudentEmail');
    const studentIdEl = document.getElementById('modalInvoiceStudentId');

    if (studentNameEl) studentNameEl.textContent = data.student.name || 'N/A';
    if (studentEmailEl) studentEmailEl.textContent = data.student.email || 'N/A';
    if (studentIdEl) studentIdEl.textContent = data.student.id || 'N/A';

    // Populate assignment information
    const assignmentTitleEl = document.getElementById('modalInvoiceAssignmentTitle');
    const assignmentIdEl = document.getElementById('modalInvoiceAssignmentId');

    if (assignmentTitleEl) assignmentTitleEl.textContent = data.assignment.title || 'N/A';
    if (assignmentIdEl) assignmentIdEl.textContent = data.assignment.id || 'N/A';

    // Populate CS Rep information (if available)
    const csRepSection = document.getElementById('modalInvoiceCSRepSection');
    const csRepNameEl = document.getElementById('modalInvoiceCSRepName');
    const csRepEmailEl = document.getElementById('modalInvoiceCSRepEmail');

    if (data.cs_rep && data.cs_rep.name) {
        if (csRepSection) csRepSection.style.display = 'block';
        if (csRepNameEl) csRepNameEl.textContent = data.cs_rep.name;
        if (csRepEmailEl) csRepEmailEl.textContent = data.cs_rep.email || '';
    } else {
        if (csRepSection) csRepSection.style.display = 'none';
    }

    // Populate financial information
    const amountEl = document.getElementById('modalInvoiceAmount');
    const discountEl = document.getElementById('modalInvoiceDiscount');
    const totalAmountEl = document.getElementById('modalInvoiceTotalAmount');

    if (amountEl) amountEl.textContent = `$${data.amount.toFixed(2)}`;
    if (discountEl) discountEl.textContent = `$${data.discount.toFixed(2)}`;
    if (totalAmountEl) totalAmountEl.textContent = `$${data.total_amount.toFixed(2)}`;

    // Populate notes (if available)
    const notesSection = document.getElementById('modalInvoiceNotesSection');
    const notesEl = document.getElementById('modalInvoiceNotes');

    if (data.notes && data.notes.trim()) {
        if (notesSection) notesSection.style.display = 'block';
        if (notesEl) notesEl.textContent = data.notes;
    } else {
        if (notesSection) notesSection.style.display = 'none';
    }
}

function closeInvoiceDetailsModal(event) {
    // Prevent default behavior and stop propagation to avoid navigation
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const modal = document.getElementById('invoiceDetailsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';

        // Clear stored invoice ID
        const invoiceIdField = document.getElementById('modalInvoiceIdValue');
        if (invoiceIdField) invoiceIdField.value = '';
    }

    // Return false to prevent any navigation
    return false;
}

function downloadInvoiceFromModal() {
    const invoiceIdField = document.getElementById('modalInvoiceIdValue');
    const invoiceId = invoiceIdField ? invoiceIdField.value : '';

    if (invoiceId) {
        downloadInvoice(invoiceId);
    } else {
        showSuccessModal('Invoice ID not found.');
    }
}

function downloadInvoice(invoiceId) {
    // In a real implementation, this would download the invoice PDF
    showSuccessModal(`Downloading invoice #INV-2024-${String(invoiceId).padStart(3, '0')}...`);

    // Simulate download
    // In real implementation:
    // const link = document.createElement('a');
    // link.href = `/api/invoices/${invoiceId}/download`;
    // link.download = `invoice-${invoiceId}.pdf`;
    // link.click();
}

function viewInvoiceStatus(invoiceId) {
    // Call viewInvoiceDetails_OLD to show the invoice details modal
    viewInvoiceDetails_OLD(invoiceId);
}

function sendReminder(invoiceId) {
    if (confirm('Send a payment reminder email to the student?')) {
        // In a real implementation, this would send an email reminder
        showSuccessModal(`Payment reminder sent for invoice #INV-2024-${String(invoiceId).padStart(3, '0')}`);
    }
}

function exportRevenueReport() {
    // In a real implementation, this would export the revenue report as CSV/PDF
    showSuccessModal('Exporting revenue report...');

    // Simulate export
    // In real implementation:
    // const link = document.createElement('a');
    // link.href = `/api/reports/revenue/export?dateRange=${dateRange}`;
    // link.download = `revenue-report-${new Date().toISOString().split('T')[0]}.csv`;
    // link.click();
}

function exportPayoutsReport() {
    // In a real implementation, this would export the payouts report as CSV/PDF
    showSuccessModal('Exporting teacher payouts report...');

    // Simulate export
    // In real implementation:
    // const link = document.createElement('a');
    // link.href = `/api/reports/payouts/export?dateRange=${dateRange}`;
    // link.download = `payouts-report-${new Date().toISOString().split('T')[0]}.csv`;
    // link.click();
}

// Export functions for use in HTML
window.updateFinancialReports = updateFinancialReports;
window.exportRevenueReport = exportRevenueReport;
window.exportPayoutsReport = exportPayoutsReport;

// CS Rep Management functionality
function initializeCSRepManagement() {
    // Initialize CS Rep search
    const csRepSearchInput = document.getElementById('csRepSearchInput');
    if (csRepSearchInput) {
        csRepSearchInput.addEventListener('input', function () {
            filterCSReps();
        });
    }

    // Initialize CS Rep status filter
    const csRepStatusFilter = document.getElementById('csRepStatusFilter');
    if (csRepStatusFilter) {
        csRepStatusFilter.addEventListener('change', function () {
            filterCSReps();
        });
    }
}

function filterCSReps() {
    const searchTerm = document.getElementById('csRepSearchInput')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('csRepStatusFilter')?.value || 'all';
    const csRepRows = document.querySelectorAll('.cs-rep-row');

    csRepRows.forEach(row => {
        const csRepName = row.querySelector('.csrep-name')?.textContent.toLowerCase() || '';
        const csRepEmail = row.querySelector('.csrep-email')?.textContent.toLowerCase() || '';
        const csRepDepartment = row.querySelector('.csrep-department')?.textContent.toLowerCase() || '';
        const status = row.getAttribute('data-status') || '';
        const statusBadge = row.querySelector('.status-badge');
        const isActive = statusBadge?.classList.contains('online') || false;

        // Search filter
        const matchesSearch = csRepName.includes(searchTerm) ||
            csRepEmail.includes(searchTerm) ||
            csRepDepartment.includes(searchTerm);

        // Status filter
        let matchesStatus = true;
        if (statusFilter === 'active') {
            matchesStatus = isActive;
        } else if (statusFilter === 'inactive') {
            matchesStatus = !isActive;
        }

        if (matchesSearch && matchesStatus) {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
        }
    });
}

function openAddCSRepModal() {
    const modal = document.getElementById('csRepModal');
    const modalTitle = document.getElementById('csRepModalTitle');
    const form = document.getElementById('csRepForm');
    const submitBtn = document.getElementById('csRepSubmitBtn');
    const credentialsSection = document.getElementById('csRepCredentialsSection');

    if (modal && form) {
        // Reset form
        form.reset();
        document.getElementById('csRepId').value = '';

        // Update modal title
        if (modalTitle) modalTitle.textContent = 'Add CS Rep';
        if (submitBtn) submitBtn.textContent = 'Add CS Rep';

        // Show credentials section for new CS Reps
        if (credentialsSection) {
            credentialsSection.style.display = 'block';
            document.getElementById('csRepUsername').required = true;
            document.getElementById('csRepPassword').required = true;
        }

        // Show modal
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}

function editCSRep(csRepId) {
    const modal = document.getElementById('csRepModal');
    const modalTitle = document.getElementById('csRepModalTitle');
    const form = document.getElementById('csRepForm');
    const submitBtn = document.getElementById('csRepSubmitBtn');
    const credentialsSection = document.getElementById('csRepCredentialsSection');
    const row = document.querySelector(`[data-csrep-id="${csRepId}"]`);

    if (!row || !modal || !form) return;

    // Get CS Rep data from the row
    const csRepName = row.querySelector('.csrep-name')?.textContent || '';
    const csRepEmail = row.querySelector('.csrep-email')?.textContent || '';
    const csRepDepartment = row.querySelector('.csrep-department')?.textContent || '';
    const csRepPhone = row.querySelector('.csrep-phone')?.textContent || '';
    const status = row.getAttribute('data-status') || 'active';

    // Populate form
    document.getElementById('csRepId').value = csRepId;
    document.getElementById('csRepFullName').value = csRepName;
    document.getElementById('csRepEmail').value = csRepEmail;
    document.getElementById('csRepPhone').value = csRepPhone;
    document.getElementById('csRepDepartment').value = csRepDepartment.toLowerCase().replace(/\s+/g, '-');
    document.getElementById('csRepStatus').value = status;

    // Update modal title
    if (modalTitle) modalTitle.textContent = 'Edit CS Rep';
    if (submitBtn) submitBtn.textContent = 'Update CS Rep';

    // Hide credentials section for editing (password change should be separate)
    if (credentialsSection) {
        credentialsSection.style.display = 'none';
        document.getElementById('csRepUsername').required = false;
        document.getElementById('csRepPassword').required = false;
    }

    // Show modal
    modal.style.display = 'flex';
    modal.classList.add('active');
}

function deleteCSRep(csRepId) {
    const row = document.querySelector(`[data-csrep-id="${csRepId}"]`);
    if (!row) return;

    const csRepName = row.querySelector('.csrep-name')?.textContent || 'this CS Rep';

    if (confirm(`Are you sure you want to delete ${csRepName}? This action cannot be undone.`)) {
        // In a real implementation, this would send a DELETE request to the server
        // For now, we'll just remove the row from the UI

        row.style.transition = 'opacity 0.3s ease';
        row.style.opacity = '0';

        setTimeout(() => {
            row.remove();
            showSuccessModal(`${csRepName} has been deleted successfully.`);
        }, 300);
    }
}

async function handleCSRepSubmit(event) {
    console.log('handleCSRepSubmit called', event);
    event.preventDefault();

    const form = document.getElementById('csRepForm');
    console.log('Form found:', form);
    if (!form) {
        console.error('CS Rep form not found!');
        return;
    }

    const formData = new FormData(form);
    const csRepId = formData.get('csRepId');
    const isEdit = csRepId && csRepId !== '';

    if (isEdit) {
        // Update existing CS Rep (TODO: implement update endpoint)
        updateCSRepInTable(formData);
        showSuccessModal('CS Rep updated successfully!');
        closeCSRepModal();
        return;
    }

    // Create new CS Rep
    const username = formData.get('username') || formData.get('csRepUsername');
    const email = formData.get('email') || formData.get('csRepEmail');
    const password = formData.get('password') || formData.get('csRepPassword');
    const first_name = formData.get('first_name') || formData.get('csRepFirstName');
    const last_name = formData.get('last_name') || formData.get('csRepLastName');

    console.log('Form data extracted:', { username, email, password: '***', first_name, last_name });

    if (!username || !email || !password || !first_name || !last_name) {
        const missingFields = [];
        if (!username) missingFields.push('Username');
        if (!email) missingFields.push('Email');
        if (!password) missingFields.push('Password');
        if (!first_name) missingFields.push('First Name');
        if (!last_name) missingFields.push('Last Name');
        showSuccessModal(`Please fill in all required fields: ${missingFields.join(', ')}`);
        return;
    }

    try {
        // Check if apiClient is available (wait a bit if script is still loading)
        if (typeof apiClient === 'undefined') {
            console.error('apiClient is not defined. Make sure apiClient.js is loaded before Admin_Dash.js');
            showSuccessModal('API client not available. Please refresh the page and ensure all scripts are loaded.');
            return;
        }

        // Additional check for apiClient.post method
        if (typeof apiClient.post !== 'function') {
            console.error('apiClient.post is not a function. apiClient:', apiClient);
            showSuccessModal('API client is not properly initialized. Please refresh the page.');
            return;
        }

        const csRepData = {
            username: username,
            email: email,
            password: password,
            first_name: first_name,
            last_name: last_name,
        };

        console.log('Sending CS Rep data to API:', { ...csRepData, password: '***' });
        const response = await apiClient.post('/account/api/accounts/create-csrep/', csRepData);
        console.log('API Response:', response);

        if (response && response.success) {
            showSuccessModal(`CS Rep "${first_name} ${last_name}" added successfully!\n\nLogin Credentials:\nUsername: ${username}\nEmail: ${email}\nPassword: ${password}\n\nPlease share these credentials with the CS Rep.`);
            form.reset();

            // Clear any error states
            const inputs = ['csRepUsername', 'csRepEmail', 'csRepPassword'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('error');
            });
            const helps = ['csRepUsernameHelp', 'csRepEmailHelp', 'csRepPasswordHelp'];
            helps.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.color = '';
                    if (id === 'csRepUsernameHelp') el.textContent = 'Username will be used for CS Rep login';
                    if (id === 'csRepPasswordHelp') el.textContent = 'CS Rep will be asked to change on first login';
                    if (id === 'csRepEmailHelp') el.textContent = '';
                }
            });

            if (typeof closeCSRepModal === 'function') {
                closeCSRepModal();
            }

            if (typeof loadCSReps === 'function') {
                loadCSReps();
            }
        } else {
            const errorType = response?.error_type || 'unknown';
            const errorMessage = response?.error || 'Failed to create CS Rep. Please try again.';
            
            if (errorType === 'username_exists') {
                const el = document.getElementById('csRepUsername');
                const help = document.getElementById('csRepUsernameHelp');
                if (el) el.classList.add('error');
                if (help) {
                    help.textContent = 'Username already exists';
                    help.style.color = '#ef4444';
                }
                showSuccessModal('Error: Username already exists. Please choose a different username.');
            } else if (errorType === 'email_exists') {
                const el = document.getElementById('csRepEmail');
                const help = document.getElementById('csRepEmailHelp');
                if (el) el.classList.add('error');
                if (help) {
                    help.textContent = 'Email already exists';
                    help.style.color = '#ef4444';
                }
                showSuccessModal('Error: Email address already exists. Please use a different email.');
            } else if (errorType === 'invalid_password') {
                const el = document.getElementById('csRepPassword');
                const help = document.getElementById('csRepPasswordHelp');
                if (el) el.classList.add('error');
                if (help) {
                    help.textContent = errorMessage;
                    help.style.color = '#ef4444';
                }
                showSuccessModal('Error: ' + errorMessage);
            } else if (errorType === 'invalid_email') {
                const el = document.getElementById('csRepEmail');
                const help = document.getElementById('csRepEmailHelp');
                if (el) el.classList.add('error');
                if (help) {
                    help.textContent = 'Invalid email format';
                    help.style.color = '#ef4444';
                }
                showSuccessModal('Error: Invalid email format.');
            } else {
                showSuccessModal(`Error: ${errorMessage}`);
            }
        }
    } catch (error) {
        console.error('Error creating CS Rep:', error);
        console.error('Error details:', {
            message: error.message,
            data: error.data,
            response: error.response,
            stack: error.stack
        });
        const errorMessage = error.data?.error || error.response?.data?.error || error.message || 'Failed to create CS Rep. Please try again.';
        showSuccessModal(`Error: ${errorMessage}`);
    }
}

function updateCSRepInTable(formData) {
    const csRepId = formData.get('csRepId');
    const row = document.querySelector(`[data-csrep-id="${csRepId}"]`);
    if (!row) return;

    // Update row data
    const fullName = formData.get('csRepFullName');
    const email = formData.get('csRepEmail');
    const phone = formData.get('csRepPhone');
    const department = formData.get('csRepDepartment');
    const status = formData.get('csRepStatus');

    // Update name
    const nameCell = row.querySelector('.csrep-name');
    if (nameCell) nameCell.textContent = fullName;

    // Update email
    const emailCell = row.querySelector('.csrep-email');
    if (emailCell) emailCell.textContent = email;

    // Update phone
    const phoneCell = row.querySelector('.csrep-phone');
    if (phoneCell) phoneCell.textContent = phone;

    // Update department
    const departmentCell = row.querySelector('.csrep-department');
    if (departmentCell) {
        const departmentNames = {
            'technical-support': 'Technical Support',
            'customer-relations': 'Customer Relations',
            'billing': 'Billing',
            'account-management': 'Account Management',
            'general-support': 'General Support'
        };
        departmentCell.textContent = departmentNames[department] || department;
    }

    // Update status
    const statusCell = row.querySelector('.csrep-status');
    if (statusCell) {
        if (status === 'active') {
            statusCell.innerHTML = `
                <span class="status-badge online">
                    <i class="fas fa-circle"></i>
                    Active
                </span>
            `;
        } else {
            statusCell.innerHTML = `
                <span class="status-badge offline">
                    <i class="fas fa-circle"></i>
                    Inactive
                </span>
            `;
        }
    }

    // Update row data attribute
    row.setAttribute('data-status', status);
}

function addCSRepToTable(formData) {
    const tbody = document.querySelector('.cs-reps-table tbody');
    if (!tbody) return;

    const fullName = formData.get('csRepFullName');
    const email = formData.get('csRepEmail');
    const phone = formData.get('csRepPhone');
    const department = formData.get('csRepDepartment');
    const status = formData.get('csRepStatus');

    // Generate new ID (in real app, this would come from server)
    const existingRows = document.querySelectorAll('.cs-rep-row');
    const newId = existingRows.length > 0 ?
        Math.max(...Array.from(existingRows).map(r => parseInt(r.getAttribute('data-csrep-id')))) + 1 : 1;

    const departmentNames = {
        'technical-support': 'Technical Support',
        'customer-relations': 'Customer Relations',
        'billing': 'Billing',
        'account-management': 'Account Management',
        'general-support': 'General Support'
    };

    const statusBadge = status === 'active' ?
        '<span class="status-badge online"><i class="fas fa-circle"></i> Active</span>' :
        '<span class="status-badge offline"><i class="fas fa-circle"></i> Inactive</span>';

    const newRow = document.createElement('tr');
    newRow.className = 'cs-rep-row';
    newRow.setAttribute('data-csrep-id', newId);
    newRow.setAttribute('data-status', status);

    newRow.innerHTML = `
        <td class="csrep-info-cell">
            <div class="csrep-info-list">
                <div class="csrep-avatar-list">
                    <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face"
                        alt="${fullName}"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="avatar-fallback" style="display: none;">👤</div>
                </div>
                <div class="csrep-details-list">
                    <div class="csrep-name">${fullName}</div>
                    <div class="csrep-role-badge">CS Rep</div>
                </div>
            </div>
        </td>
        <td class="csrep-email">${email}</td>
        <td class="csrep-department">${departmentNames[department] || department}</td>
        <td class="csrep-phone">${phone}</td>
        <td class="csrep-status">${statusBadge}</td>
        <td class="csrep-joined">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        <td class="csrep-actions-cell">
            <button class="action-btn-small primary" onclick="editCSRep(${newId})" title="Edit CS Rep">
                <i class="fas fa-edit"></i>
                Edit
            </button>
            <button class="action-btn-small danger" onclick="deleteCSRep(${newId})" title="Delete CS Rep">
                <i class="fas fa-trash"></i>
                Delete
            </button>
        </td>
    `;

    tbody.appendChild(newRow);
}

function closeCSRepModal() {
    const modal = document.getElementById('csRepModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';

        // Reset form
        const form = document.getElementById('csRepForm');
        if (form) form.reset();
    }
}

function generateCSRepPassword() {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < 12; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    const passwordInput = document.getElementById('csRepPassword');
    if (passwordInput) {
        passwordInput.value = password;
    }
}

// Export functions for use in HTML
window.openAddCSRepModal = openAddCSRepModal;
window.editCSRep = editCSRep;
window.deleteCSRep = deleteCSRep;
window.closeCSRepModal = closeCSRepModal;
window.handleCSRepSubmit = handleCSRepSubmit;
window.generateCSRepPassword = generateCSRepPassword;

// Content Review functionality
function initializeContentReview() {
    // Initialize content review search
    const contentReviewSearchInput = document.getElementById('contentReviewSearchInput');
    if (contentReviewSearchInput) {
        contentReviewSearchInput.addEventListener('input', function () {
            filterContentReview();
        });
    }

    // Initialize content review filter
    const contentReviewFilter = document.getElementById('contentReviewFilter');
    if (contentReviewFilter) {
        contentReviewFilter.addEventListener('change', function () {
            filterContentReview();
        });
    }

    // Initialize content type filter
    const contentTypeFilter = document.getElementById('contentTypeFilter');
    if (contentTypeFilter) {
        contentTypeFilter.addEventListener('change', function () {
            filterContentReview();
        });
    }
}

function filterContentReview() {
    const searchTerm = document.getElementById('contentReviewSearchInput')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('contentReviewFilter')?.value || 'all';
    const typeFilter = document.getElementById('contentTypeFilter')?.value || 'all';
    const contentRows = document.querySelectorAll('.content-review-row');

    contentRows.forEach(row => {
        const contentTitle = row.querySelector('.content-title')?.textContent.toLowerCase() || '';
        const studentName = row.querySelector('.student-name')?.textContent.toLowerCase() || '';
        const teacherName = row.querySelector('.teacher-name')?.textContent.toLowerCase() || '';
        const status = row.getAttribute('data-status') || '';
        const type = row.getAttribute('data-type') || '';

        // Search filter
        const matchesSearch = contentTitle.includes(searchTerm) ||
            studentName.includes(searchTerm) ||
            teacherName.includes(searchTerm);

        // Status filter
        let matchesStatus = true;
        if (statusFilter !== 'all') {
            matchesStatus = status === statusFilter;
        }

        // Type filter
        let matchesType = true;
        if (typeFilter !== 'all') {
            matchesType = type === typeFilter;
        }

        if (matchesSearch && matchesStatus && matchesType) {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
        }
    });
}

function viewContentDetails(contentId, contentType) {
    // Get content row data
    const row = document.querySelector(`[data-content-id="${contentId}"]`);
    if (!row) {
        showToast(`Content with ID ${contentId} not found.`, 'error');
        return;
    }

    // Extract data from row
    const contentTitle = row.querySelector('.content-title')?.textContent || 'N/A';
    const contentMeta = row.querySelector('.content-meta')?.textContent || '';
    const studentName = row.querySelector('.student-name')?.textContent || 'N/A';
    const teacherName = row.querySelector('.teacher-name')?.textContent || 'N/A';
    const submittedDate = row.querySelector('.content-submitted')?.textContent || 'N/A';
    const typeBadge = row.querySelector('.type-badge')?.textContent || contentType || 'N/A';

    const studentEmail = row.getAttribute('data-student-email') || 'N/A';
    const studentId = row.getAttribute('data-student-id') || 'N/A';
    const teacherEmail = row.getAttribute('data-teacher-email') || 'N/A';

    console.log('[DEBUG] Viewing content details:', { contentId, contentType, studentEmail, studentId, teacherEmail });

    // Populate modal
    document.getElementById('contentDetailsTitle').textContent = `${typeBadge} Details`;
    document.getElementById('modalContentType').textContent = typeBadge;
    document.getElementById('modalContentTitle').textContent = contentTitle;
    document.getElementById('modalContentSubject').textContent = contentMeta.replace('Code:', '').trim() || 'N/A';
    document.getElementById('modalContentSubmitted').textContent = submittedDate;
    document.getElementById('modalStudentName').textContent = studentName;
    document.getElementById('modalStudentEmail').textContent = studentEmail;
    document.getElementById('modalStudentId').textContent = studentId;
    document.getElementById('modalTeacherName').textContent = teacherName;
    document.getElementById('modalTeacherEmail').textContent = teacherEmail;

    // Populate submission documents (mock data - replace with actual API call)
    const docsList = document.getElementById('modalSubmissionDocs');
    docsList.innerHTML = `
        <div class="doc-item">
            <i class="fas fa-file-pdf"></i>
            <span>${contentTitle}_submission.pdf</span>
            <button class="doc-download-btn" onclick="downloadDocument('${contentId}', 'pdf')">
                <i class="fas fa-download"></i>
            </button>
        </div>
        <div class="doc-item">
            <i class="fas fa-file-word"></i>
            <span>${contentTitle}_source.docx</span>
            <button class="doc-download-btn" onclick="downloadDocument('${contentId}', 'docx')">
                <i class="fas fa-download"></i>
            </button>
        </div>
    `;

    // Populate additional info
    const additionalInfo = document.getElementById('modalAdditionalInfo');
    additionalInfo.innerHTML = `
        <p><strong>Content Details:</strong> ${contentMeta}</p>
        <p><strong>Submission Status:</strong> Submitted for Review</p>
        <p><strong>Review Notes:</strong> Awaiting admin review</p>
    `;

    // Show modal
    document.getElementById('contentDetailsModal').style.display = 'flex';
}

function closeContentDetailsModal() {
    document.getElementById('contentDetailsModal').style.display = 'none';
}

async function viewAttemptDetails(attemptId) {
    try {
        const response = await fetch(`/exam/student/results/${attemptId}/`);
        const data = await response.json();
        
        if (data.success) {
            const results = data.results;
            console.log('[DEBUG] Full Attempt Results Object:', results);
            
            // Populate modal basic info with multiple key fallbacks
            document.getElementById('contentDetailsTitle').textContent = `${(results.type || 'EXAM').toUpperCase()} Results`;
            document.getElementById('modalContentType').textContent = (results.type || 'EXAM').toUpperCase();
            document.getElementById('modalContentTitle').textContent = results.examTitle || results.exam_title || 'N/A';
            document.getElementById('modalContentSubject').textContent = results.type === 'mcq' ? 'Multiple Choice' : 'Question & Answer';
            
            const subDate = results.submittedAt || results.submitted_at || results.endTime || results.end_time;
            document.getElementById('modalContentSubmitted').textContent = subDate ? new Date(subDate).toLocaleString() : 'N/A';
            
            document.getElementById('modalStudentName').textContent = results.studentName || results.student_name || 'N/A';
            document.getElementById('modalStudentEmail').textContent = results.studentEmail || results.student_email || 'N/A';
            document.getElementById('modalStudentId').textContent = results.studentId || results.student_id || 'N/A';
            
            document.getElementById('modalTeacherName').textContent = results.teacherName || results.teacher_name || 'Assigned Teacher';
            document.getElementById('modalTeacherEmail').textContent = results.teacherEmail || results.teacher_email || 'N/A';

            // Populate summary in docs area
            const docsList = document.getElementById('modalSubmissionDocs');
            const scoreColor = results.score >= 80 ? '#10b981' : results.score >= 60 ? '#f59e0b' : '#ef4444';
            
            docsList.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 15px; width: 100%;">
                    <div style="padding: 20px; background: rgba(17, 88, 229, 0.05); border-radius: 12px; text-align: center; width: 100%;">
                        <div style="font-size: 2.5rem; font-weight: 800; color: ${scoreColor};">${results.score || results.totalGrade || 0}%</div>
                        <div style="font-weight: 600; color: var(--text-secondary);">Final Score</div>
                        <div style="margin-top: 10px; font-size: 14px; color: var(--muted);">
                            Status: <span class="status-badge ${results.status}">${results.status.toUpperCase()}</span>
                        </div>
                    </div>
                    <button class="modern-btn-primary" onclick="printExamDetails('${attemptId}')" style="width: 100%; justify-content: center;">
                        <i class="fas fa-file-pdf"></i>
                        Download Result PDF
                    </button>
                </div>
            `;

            // Populate additional info with question breakdown
            const additionalInfo = document.getElementById('modalAdditionalInfo');
            
            let questionsHtml = '';
            if (results.answers && results.answers.length > 0) {
                questionsHtml = `
                    <div style="margin-top: 25px;">
                        <h4 style="margin-bottom: 15px; font-weight: 700; color: var(--primary);">
                            <i class="fas fa-list-ol"></i> Question-by-Question Breakdown
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 15px;">
                            ${results.answers.map((ans, i) => {
                                const isCorrect = ans.isCorrect;
                                return `
                                    <div style="padding: 15px; border: 1px solid var(--divider); border-radius: 10px; background: ${results.type === 'mcq' ? (isCorrect ? 'rgba(16, 185, 129, 0.02)' : 'rgba(239, 68, 68, 0.02)') : '#fff'};">
                                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                            <strong style="color: var(--text);">Q${i+1}: ${ans.questionText}</strong>
                                            ${results.type === 'mcq' ? `
                                                <span style="font-size: 12px; font-weight: 700; color: ${isCorrect ? '#10b981' : '#ef4444'};">
                                                    ${isCorrect ? 'CORRECT' : 'INCORRECT'}
                                                </span>
                                            ` : `
                                                <span style="font-size: 12px; font-weight: 700; color: var(--primary);">
                                                    GRADE: ${ans.grade || 0}/100
                                                </span>
                                            `}
                                        </div>
                                        <div style="padding: 10px; background: #f9f9f9; border-radius: 6px; font-size: 14px; color: var(--text-secondary); margin-bottom: 10px;">
                                            <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px; opacity: 0.7;">Student's Answer:</span>
                                            ${ans.answerText || ans.selectedOption || 'No answer provided'}
                                        </div>
                                        ${ans.feedback ? `
                                            <div style="padding: 10px; border-left: 3px solid var(--primary); background: rgba(17, 88, 229, 0.02); font-size: 13px;">
                                                <strong>Teacher Feedback:</strong> ${ans.feedback}
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }

            additionalInfo.innerHTML = `
                <div style="margin-top: 10px;">
                    <h5 style="margin-bottom: 10px; font-weight: 700;">Overall Feedback:</h5>
                    <div style="padding: 15px; background: rgba(17, 88, 229, 0.03); border-radius: 8px; border-left: 4px solid var(--primary); font-style: italic; color: var(--text);">
                        "${results.overallFeedback || 'No overall feedback provided.'}"
                    </div>
                </div>
                ${questionsHtml}
                <div style="margin-top: 20px; font-size: 12px; color: var(--muted); display: flex; justify-content: space-between;">
                    <span>Time Spent: <strong>${results.timeSpent || 'N/A'}</strong></span>
                    <span>Attempt ID: <code>${attemptId}</code></span>
                </div>
            `;

            // Show modal
            document.getElementById('contentDetailsModal').style.display = 'flex';
        } else {
            showToast(data.error || 'Failed to fetch attempt details', 'error');
        }
    } catch (error) {
        console.error('Error fetching attempt details:', error);
        showToast('An error occurred while fetching details.', 'error');
    }
}

/**
 * Fetch and display graded homework details in the content review modal.
 */
async function viewHomeworkDetails(homeworkId) {
    try {
        const response = await fetch(`/homework/details/${homeworkId}/`);
        const data = await response.json();
        
        if (data.success) {
            const hw = data.homework;
            console.log('[DEBUG] Full Homework Object:', hw);
            
            // Populate modal basic info with multiple key fallbacks
            document.getElementById('contentDetailsTitle').textContent = `Homework Details`;
            document.getElementById('modalContentType').textContent = 'HOMEWORK';
            document.getElementById('modalContentTitle').textContent = hw.title || 'N/A';
            document.getElementById('modalContentSubject').textContent = hw.teacher || 'Assigned Teacher';
            
            const subDate = hw.submission ? (hw.submission.submitted_at || hw.submission.submittedAt) : null;
            document.getElementById('modalContentSubmitted').textContent = subDate || 'Not submitted';
            
            document.getElementById('modalStudentName').textContent = hw.student || 'N/A';
            document.getElementById('modalStudentEmail').textContent = hw.student_email || hw.email || 'N/A';
            document.getElementById('modalStudentId').textContent = hw.student_id || hw.studentId || 'N/A';
            
            document.getElementById('modalTeacherName').textContent = hw.teacher || 'N/A';
            document.getElementById('modalTeacherEmail').textContent = hw.teacher_email || 'N/A';
            
            // Populate teacher info card if available
            const teacherEmailEl = document.getElementById('modalTeacherEmail');
            if (teacherEmailEl) teacherEmailEl.textContent = hw.teacher_email || 'N/A';

            // Build submission details
            const docsList = document.getElementById('modalSubmissionDocs');
            if (hw.submission) {
                let docsHtml = `
                    <div style="padding: 15px; background: rgba(17, 88, 229, 0.03); border-radius: 10px; margin-bottom: 20px;">
                        <h4 style="margin-bottom: 10px; font-weight: 700; color: var(--primary);">Student Notes</h4>
                        <div style="font-style: italic; color: var(--text-secondary); line-height: 1.6;">
                            "${hw.submission.notes || 'No notes provided.'}"
                        </div>
                    </div>
                    <h4 style="margin-bottom: 15px; font-weight: 700; color: var(--primary);">Attached Files</h4>
                    <div class="attachments-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">
                `;

                if (hw.submission.attachments && hw.submission.attachments.length > 0) {
                    docsHtml += hw.submission.attachments.map(file => `
                        <div class="attachment-item" style="padding: 12px; border: 1px solid var(--divider); border-radius: 8px; background: #fff; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-file-pdf" style="color: #ef4444; font-size: 1.2rem;"></i>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${file.name}</div>
                                <div style="font-size: 11px; color: var(--muted);">${file.size}</div>
                            </div>
                            <a href="${file.url}" target="_blank" class="icon-button" style="padding: 5px; color: var(--primary);">
                                <i class="fas fa-download"></i>
                            </a>
                        </div>
                    `).join('');
                } else {
                    docsHtml += '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: var(--muted);">No files attached</div>';
                }
                
                docsHtml += `</div>`;
                docsList.innerHTML = docsHtml;
            } else {
                docsList.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--muted);">No submission available</div>';
            }

            // Populate grade and feedback
            const additionalInfo = document.getElementById('modalAdditionalInfo');
            if (hw.status === 'graded') {
                additionalInfo.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 20px;">
                        <div style="padding: 20px; background: rgba(16, 185, 129, 0.05); border-radius: 12px; text-align: center; border: 1px solid rgba(16, 185, 129, 0.1);">
                            <div style="font-size: 2.5rem; font-weight: 800; color: #10b981;">${hw.grade}${hw.grade_percentage ? ` (${hw.grade_percentage}%)` : ''}</div>
                            <div style="font-weight: 600; color: var(--text-secondary);">Homework Grade</div>
                        </div>
                        <div>
                            <h4 style="margin-bottom: 10px; font-weight: 700; color: var(--primary);">Teacher Feedback</h4>
                            <div style="padding: 15px; background: #f9f9f9; border-radius: 8px; border-left: 4px solid #10b981; line-height: 1.6;">
                                ${hw.feedback || 'No feedback provided.'}
                            </div>
                        </div>
                    </div>
                `;
            } else {
                additionalInfo.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted);">Review pending</div>';
            }

            // Show modal
            document.getElementById('contentDetailsModal').style.display = 'flex';
        }
    } catch (error) {
        console.error('Error fetching homework details:', error);
        showToast('Error loading details', 'error');
    }
}

function printExamDetails(attemptId) {
    const modalContent = document.querySelector('#contentDetailsModal .modal-card').cloneNode(true);
    
    // Remove the footer and download button from the print version
    const footer = modalContent.querySelector('.modal-footer');
    if (footer) footer.remove();
    const downloadBtn = modalContent.querySelector('.modern-btn-primary');
    if (downloadBtn) downloadBtn.parentNode.remove();
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Exam Result - ' + attemptId + '</title>');
    printWindow.document.write('<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet">');
    printWindow.document.write('<style>');
    printWindow.document.write(`
        body { font-family: "Inter", sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.6; }
        .modal-header { border-bottom: 2px solid #eee; margin-bottom: 20px; padding-bottom: 10px; }
        .modal-title { font-size: 24px; font-weight: 800; color: #1158e5; }
        .modal-close { display: none; }
        .section-title { font-size: 18px; font-weight: 700; margin: 20px 0 10px 0; color: #333; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .content-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .info-item { margin-bottom: 10px; }
        .info-label { font-size: 12px; color: #666; text-transform: uppercase; font-weight: 700; }
        .info-value { font-weight: 600; font-size: 15px; }
        .student-info-card, .teacher-info-card { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
        .student-name, .teacher-name { font-size: 16px; font-weight: 700; margin: 0; }
        .student-email, .teacher-email { font-size: 14px; color: #666; margin: 2px 0; }
        .status-badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; }
        code { background: #eee; padding: 2px 5px; border-radius: 4px; }
        @media print {
            .no-print { display: none; }
            body { padding: 0; }
        }
    `);
    printWindow.document.write('</style></head><body>');
    printWindow.document.write(modalContent.innerHTML);
    printWindow.document.write('</body></html>');
    
    printWindow.document.close();
    printWindow.focus();
    
    // Give images and fonts time to load
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

function downloadDocument(contentId, fileType) {
    // In real implementation, this would download the actual file
    showSuccessModal(`Downloading ${fileType.toUpperCase()} file for content ID: ${contentId}`);
}

function downloadAllDocuments() {
    const contentId = document.querySelector('#contentDetailsModal [data-content-id]')?.getAttribute('data-content-id') || '';
    showSuccessModal(`Downloading all documents for content ID: ${contentId}`);
}

function openFeedbackModal(contentId, contentType, teacherName) {
    document.getElementById('feedbackContentId').value = contentId;
    document.getElementById('feedbackContentType').value = contentType;
    document.getElementById('feedbackTeacherName').value = teacherName;
    document.getElementById('feedbackTeacher').value = teacherName;
    document.getElementById('feedbackMessage').value = '';
    document.getElementById('feedbackPriority').value = 'normal';
    document.getElementById('feedbackModal').style.display = 'flex';
}

function closeFeedbackModal() {
    document.getElementById('feedbackModal').style.display = 'none';
    document.getElementById('feedbackForm').reset();
}

async function submitFeedback(event) {
    event.preventDefault();

    const contentId = document.getElementById('feedbackContentId').value;
    const contentType = document.getElementById('feedbackContentType').value;
    const teacherName = document.getElementById('feedbackTeacherName').value;
    const message = document.getElementById('feedbackMessage').value;
    const priority = document.getElementById('feedbackPriority').value;

    try {
        const response = await apiClient.post('/assingment/admin/feedback/submit/', {
            content_id: contentId,
            message: message,
            priority: priority
        });

        if (response.success) {
            showSuccessModal(`Feedback sent to ${teacherName} successfully!`);
            closeFeedbackModal();
        } else {
            showToast(response.error || 'Failed to send feedback', 'error');
        }
    } catch (error) {
        console.error('Error sending feedback:', error);
        showToast('An error occurred while sending feedback.', 'error');
    }
}
// fetch('/api/admin/send-feedback/', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//         content_id: contentId,
//         content_type: contentType,
//         teacher_name: teacherName,
//         message: message,
//         priority: priority
//     })
// })
// .then(response => response.json())
// .then(data => {
//     showSuccessModal(`Feedback sent to ${teacherName} successfully!`);
//     closeFeedbackModal();
// })
// .catch(error => {
//     showSuccessModal('Error sending feedback. Please try again.');
// });


// Create Invoice Functions
function approveContent(contentId) {
    const row = document.querySelector(`[data-content-id="${contentId}"]`);
    if (!row) return;

    const contentTitle = row.querySelector('.content-title')?.textContent || 'this content';

    if (confirm(`Are you sure you want to approve "${contentTitle}"?`)) {
        // Update status
        const statusCell = row.querySelector('.review-status');
        if (statusCell) {
            statusCell.innerHTML = `
                <span class="status-badge completed">
                    <i class="fas fa-check-circle"></i>
                    Approved
                </span>
            `;
        }

        // Update row data attribute
        row.setAttribute('data-status', 'approved');

        // Update actions
        const actionsCell = row.querySelector('.review-actions-cell');
        if (actionsCell) {
            actionsCell.innerHTML = `
                <div class="action-buttons-group">
                    <button class="action-btn view-btn" onclick="viewContentDetails(${contentId})" title="View Content">
                        <i class="fas fa-eye"></i>
                        View
                    </button>
                    <button class="action-btn download-btn" onclick="downloadContent(${contentId})" title="Download Content">
                        <i class="fas fa-download"></i>
                        Download
                    </button>
                </div>
            `;
        }

        showSuccessModal(`"${contentTitle}" has been approved successfully.`);
    }
}

function rejectContent(contentId) {
    const row = document.querySelector(`[data-content-id="${contentId}"]`);
    if (!row) return;

    const contentTitle = row.querySelector('.content-title')?.textContent || 'this content';
    const rejectionReason = prompt(`Please provide a reason for rejecting "${contentTitle}":`);

    if (rejectionReason && rejectionReason.trim()) {
        // Update status
        const statusCell = row.querySelector('.review-status');
        if (statusCell) {
            statusCell.innerHTML = `
                <span class="status-badge cancelled">
                    <i class="fas fa-times-circle"></i>
                    Rejected
                </span>
            `;
        }

        // Update row data attribute
        row.setAttribute('data-status', 'rejected');
        row.setAttribute('data-rejection-reason', rejectionReason);

        // Update actions
        const actionsCell = row.querySelector('.review-actions-cell');
        if (actionsCell) {
            actionsCell.innerHTML = `
                <div class="action-buttons-group">
                    <button class="action-btn view-btn" onclick="viewContentDetails(${contentId})" title="View Content">
                        <i class="fas fa-eye"></i>
                        View
                    </button>
                    <button class="action-btn chat-btn" onclick="viewRejectionReason(${contentId})" title="View Rejection Reason">
                        <i class="fas fa-comment"></i>
                        Reason
                    </button>
                </div>
            `;
        }

        showSuccessModal(`"${contentTitle}" has been rejected. Rejection reason has been saved.`);
    }
}

function requestRevision(contentId) {
    const row = document.querySelector(`[data-content-id="${contentId}"]`);
    if (!row) return;

    const contentTitle = row.querySelector('.content-title')?.textContent || 'this content';
    const revisionNotes = prompt(`Please provide revision notes for "${contentTitle}":`);

    if (revisionNotes && revisionNotes.trim()) {
        // Update status
        const statusCell = row.querySelector('.review-status');
        if (statusCell) {
            statusCell.innerHTML = `
                <span class="status-badge warning">
                    <i class="fas fa-exclamation-circle"></i>
                    Needs Revision
                </span>
            `;
        }

        // Update row data attribute
        row.setAttribute('data-status', 'needs-revision');
        row.setAttribute('data-revision-notes', revisionNotes);

        // Update actions
        const actionsCell = row.querySelector('.review-actions-cell');
        if (actionsCell) {
            actionsCell.innerHTML = `
                <div class="action-buttons-group">
                    <button class="action-btn view-btn" onclick="viewContentDetails(${contentId})" title="View Content">
                        <i class="fas fa-eye"></i>
                        View
                    </button>
                    <button class="action-btn approve-btn" onclick="approveContent(${contentId})" title="Approve Content">
                        <i class="fas fa-check"></i>
                        Approve
                    </button>
                </div>
            `;
        }

        showSuccessModal(`Revision requested for "${contentTitle}". Revision notes have been sent to the teacher.`);
    }
}

function downloadContent(contentId) {
    // In a real implementation, this would download the content file
    const row = document.querySelector(`[data-content-id="${contentId}"]`);
    const contentTitle = row ? row.querySelector('.content-title')?.textContent : 'Content';

    showSuccessModal(`Downloading "${contentTitle}"...`);

    // Simulate download
    // In real implementation:
    // const link = document.createElement('a');
    // link.href = `/api/content/${contentId}/download`;
    // link.download = `${contentTitle}.pdf`;
    // link.click();
}

function viewRejectionReason(contentId) {
    const row = document.querySelector(`[data-content-id="${contentId}"]`);
    if (!row) return;

    const rejectionReason = row.getAttribute('data-rejection-reason') || 'No rejection reason provided.';
    const contentTitle = row.querySelector('.content-title')?.textContent || 'Content';

    alert(`Rejection Reason for "${contentTitle}":\n\n${rejectionReason}`);
}

// Settings Functions
function saveSettings() {
    // Collect all settings values
    const settings = {
        emailNotifications: document.getElementById('emailNotifications')?.checked || false,
        pushNotifications: document.getElementById('pushNotifications')?.checked || false,
        assignmentNotifications: document.getElementById('assignmentNotifications')?.checked || false,
        invoiceNotifications: document.getElementById('invoiceNotifications')?.checked || false,
        contentReviewNotifications: document.getElementById('contentReviewNotifications')?.checked || false,
        systemNotifications: document.getElementById('systemNotifications')?.checked || false,
        deadlineReminders: document.getElementById('deadlineReminders')?.checked || false,
        reminderFrequency: document.getElementById('reminderFrequency')?.value || 'weekly',
        reminderTime: document.getElementById('reminderTime')?.value || '09:00',
        paymentReminders: document.getElementById('paymentReminders')?.checked || false,
        autoRefresh: document.getElementById('autoRefresh')?.checked || false,
        refreshInterval: document.getElementById('refreshInterval')?.value || '10',
        defaultDateRange: document.getElementById('defaultDateRange')?.value || '30',
        desktopNotifications: document.getElementById('desktopNotifications')?.checked || false,
        soundAlerts: document.getElementById('soundAlerts')?.checked || false,
        twoFactorAuth: document.getElementById('twoFactorAuth')?.checked || false,
        sessionTimeout: document.getElementById('sessionTimeout')?.value || '60',
        activityLog: document.getElementById('activityLog')?.checked || false
    };

    // Save to localStorage
    localStorage.setItem('adminSettings', JSON.stringify(settings));

    // Show success message
    showSuccessModal('Settings saved successfully!');

    // In a real implementation, you would send this to the server:
    // fetch('/api/admin/settings', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(settings)
    // })
    // .then(response => response.json())
    // .then(data => {
    //     showSuccessModal('Settings saved successfully!');
    // })
    // .catch(error => {
    //     showErrorModal('Failed to save settings. Please try again.');
    // });
}

function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
        // Reset all checkboxes to default
        const defaultSettings = {
            emailNotifications: true,
            pushNotifications: true,
            assignmentNotifications: true,
            invoiceNotifications: true,
            contentReviewNotifications: true,
            systemNotifications: true,
            deadlineReminders: true,
            reminderFrequency: 'weekly',
            reminderTime: '09:00',
            paymentReminders: true,
            autoRefresh: true,
            refreshInterval: '10',
            defaultDateRange: '30',
            desktopNotifications: false,
            soundAlerts: false,
            twoFactorAuth: false,
            sessionTimeout: '60',
            activityLog: true
        };

        // Apply default values
        if (document.getElementById('emailNotifications')) document.getElementById('emailNotifications').checked = defaultSettings.emailNotifications;
        if (document.getElementById('pushNotifications')) document.getElementById('pushNotifications').checked = defaultSettings.pushNotifications;
        if (document.getElementById('assignmentNotifications')) document.getElementById('assignmentNotifications').checked = defaultSettings.assignmentNotifications;
        if (document.getElementById('invoiceNotifications')) document.getElementById('invoiceNotifications').checked = defaultSettings.invoiceNotifications;
        if (document.getElementById('contentReviewNotifications')) document.getElementById('contentReviewNotifications').checked = defaultSettings.contentReviewNotifications;
        if (document.getElementById('systemNotifications')) document.getElementById('systemNotifications').checked = defaultSettings.systemNotifications;
        if (document.getElementById('deadlineReminders')) document.getElementById('deadlineReminders').checked = defaultSettings.deadlineReminders;
        if (document.getElementById('reminderFrequency')) document.getElementById('reminderFrequency').value = defaultSettings.reminderFrequency;
        if (document.getElementById('reminderTime')) document.getElementById('reminderTime').value = defaultSettings.reminderTime;
        if (document.getElementById('paymentReminders')) document.getElementById('paymentReminders').checked = defaultSettings.paymentReminders;
        if (document.getElementById('autoRefresh')) document.getElementById('autoRefresh').checked = defaultSettings.autoRefresh;
        if (document.getElementById('refreshInterval')) document.getElementById('refreshInterval').value = defaultSettings.refreshInterval;
        if (document.getElementById('defaultDateRange')) document.getElementById('defaultDateRange').value = defaultSettings.defaultDateRange;
        if (document.getElementById('desktopNotifications')) document.getElementById('desktopNotifications').checked = defaultSettings.desktopNotifications;
        if (document.getElementById('soundAlerts')) document.getElementById('soundAlerts').checked = defaultSettings.soundAlerts;
        if (document.getElementById('twoFactorAuth')) document.getElementById('twoFactorAuth').checked = defaultSettings.twoFactorAuth;
        if (document.getElementById('sessionTimeout')) document.getElementById('sessionTimeout').value = defaultSettings.sessionTimeout;
        if (document.getElementById('activityLog')) document.getElementById('activityLog').checked = defaultSettings.activityLog;

        // Save to localStorage
        localStorage.setItem('adminSettings', JSON.stringify(defaultSettings));

        showSuccessModal('Settings reset to default values!');
    }
}

// Load settings from localStorage on page load
function loadSettings() {
    const savedSettings = localStorage.getItem('adminSettings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            // Apply saved settings
            if (document.getElementById('emailNotifications')) document.getElementById('emailNotifications').checked = settings.emailNotifications ?? true;
            if (document.getElementById('pushNotifications')) document.getElementById('pushNotifications').checked = settings.pushNotifications ?? true;
            if (document.getElementById('assignmentNotifications')) document.getElementById('assignmentNotifications').checked = settings.assignmentNotifications ?? true;
            if (document.getElementById('invoiceNotifications')) document.getElementById('invoiceNotifications').checked = settings.invoiceNotifications ?? true;
            if (document.getElementById('contentReviewNotifications')) document.getElementById('contentReviewNotifications').checked = settings.contentReviewNotifications ?? true;
            if (document.getElementById('systemNotifications')) document.getElementById('systemNotifications').checked = settings.systemNotifications ?? true;
            if (document.getElementById('deadlineReminders')) document.getElementById('deadlineReminders').checked = settings.deadlineReminders ?? true;
            if (document.getElementById('reminderFrequency')) document.getElementById('reminderFrequency').value = settings.reminderFrequency || 'weekly';
            if (document.getElementById('reminderTime')) document.getElementById('reminderTime').value = settings.reminderTime || '09:00';
            if (document.getElementById('paymentReminders')) document.getElementById('paymentReminders').checked = settings.paymentReminders ?? true;
            if (document.getElementById('autoRefresh')) document.getElementById('autoRefresh').checked = settings.autoRefresh ?? true;
            if (document.getElementById('refreshInterval')) document.getElementById('refreshInterval').value = settings.refreshInterval || '10';
            if (document.getElementById('defaultDateRange')) document.getElementById('defaultDateRange').value = settings.defaultDateRange || '30';
            if (document.getElementById('desktopNotifications')) document.getElementById('desktopNotifications').checked = settings.desktopNotifications ?? false;
            if (document.getElementById('soundAlerts')) document.getElementById('soundAlerts').checked = settings.soundAlerts ?? false;
            if (document.getElementById('twoFactorAuth')) document.getElementById('twoFactorAuth').checked = settings.twoFactorAuth ?? false;
            if (document.getElementById('sessionTimeout')) document.getElementById('sessionTimeout').value = settings.sessionTimeout || '60';
            if (document.getElementById('activityLog')) document.getElementById('activityLog').checked = settings.activityLog ?? true;
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }
}

// Apply subject-specific colors to text (simple text styling)
function applySubjectBadgeColors() {
    const subjectBadges = document.querySelectorAll('.assignment-subject, td.assignment-subject');
    subjectBadges.forEach(badge => {
        const text = badge.textContent.trim().toLowerCase();
        // Remove any existing subject classes
        badge.classList.remove('subject-cs', 'subject-physics', 'subject-english', 'subject-math', 'subject-chemistry');

        // Remove background and border styles
        badge.style.background = 'transparent';
        badge.style.border = 'none';
        badge.style.padding = '0';
        badge.style.borderRadius = '0';
        badge.style.boxShadow = 'none';

        // Apply color based on subject
        if (text.includes('computer science') || text.includes('cs')) {
            badge.style.color = '#3b82f6';
        } else if (text.includes('physics')) {
            badge.style.color = '#8b5cf6';
        } else if (text.includes('english') || text.includes('literature')) {
            badge.style.color = '#ec4899';
        } else if (text.includes('mathematics') || text.includes('math')) {
            badge.style.color = '#f59e0b';
        } else if (text.includes('chemistry')) {
            badge.style.color = '#10b981';
        } else {
            // Default color for unknown subjects
            badge.style.color = '#475569';
        }
    });
}

// Apply subject colors on page load and when content changes
function initializeAssignmentRequestsStyling() {
    applySubjectBadgeColors();

    // Re-apply when table content changes
    const observer = new MutationObserver(() => {
        applySubjectBadgeColors();
    });

    const requestsTable = document.querySelector('.requests-table-container');
    if (requestsTable) {
        observer.observe(requestsTable, { childList: true, subtree: true });
    }
}

// Export functions for use in HTML
window.filterContentReview = filterContentReview;
window.saveSettings = saveSettings;
window.resetSettings = resetSettings;
window.viewContentDetails = viewContentDetails;
window.approveContent = approveContent;
window.rejectContent = rejectContent;
window.requestRevision = requestRevision;
window.downloadContent = downloadContent;
window.viewRejectionReason = viewRejectionReason;

// Notification Functions
function filterNotifications(filter) {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const notificationItems = document.querySelectorAll('.notification-item');

    // Update active filter button
    filterButtons.forEach(btn => {
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Filter notifications
    notificationItems.forEach(item => {
        const type = item.dataset.type;
        const isUnread = item.classList.contains('unread');

        if (filter === 'all') {
            item.style.display = '';
        } else if (filter === 'unread') {
            item.style.display = isUnread ? '' : 'none';
        } else {
            item.style.display = type === filter ? '' : 'none';
        }
    });

    // Update empty state visibility
    updateEmptyState();
}

function markAsRead(notificationId) {
    const notification = document.querySelector(`[data-id="${notificationId}"]`);
    if (notification) {
        notification.classList.remove('unread');
        updateNotificationCount();
        updateNotificationDropdownCount();
        showSuccessModal('Notification marked as read');
    }
}

function markAllAsRead() {
    const unreadNotifications = document.querySelectorAll('.notification-item.unread, .notification-dropdown-item.unread');
    unreadNotifications.forEach(notification => {
        notification.classList.remove('unread');
    });
    updateNotificationCount();
    updateNotificationDropdownCount();
    showSuccessModal('All notifications marked as read');
}

function removeNotification(notificationId) {
    const notification = document.querySelector(`[data-id="${notificationId}"]`);
    if (notification && confirm('Are you sure you want to remove this notification?')) {
        notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(-20px)';

        setTimeout(() => {
            notification.remove();
            updateNotificationCount();
            updateNotificationDropdownCount();
            updateEmptyState();
            showSuccessModal('Notification removed');
        }, 300);
    }
}

function clearAllNotifications() {
    if (confirm('Are you sure you want to clear all notifications? This action cannot be undone.')) {
        const notifications = document.querySelectorAll('.notification-item');
        notifications.forEach((notification, index) => {
            setTimeout(() => {
                notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(-20px)';

                setTimeout(() => {
                    notification.remove();
                }, 300);
            }, index * 50);
        });

        setTimeout(() => {
            updateNotificationCount();
            updateEmptyState();
            showSuccessModal('All notifications cleared');
        }, notifications.length * 50 + 300);
    }
}

function updateNotificationCount() {
    const groups = document.querySelectorAll('.notification-group');
    groups.forEach(group => {
        const notifications = group.querySelectorAll('.notification-item');
        const count = notifications.length;
        const countElement = group.querySelector('.notification-count');
        if (countElement) {
            countElement.textContent = count;
            if (count === 0) {
                group.style.display = 'none';
            } else {
                group.style.display = '';
            }
        }
    });
}

function updateEmptyState() {
    const visibleNotifications = document.querySelectorAll('.notification-item[style=""]:not([style*="display: none"])');
    const emptyState = document.querySelector('.notifications-empty');
    const container = document.querySelector('.notifications-container');

    if (visibleNotifications.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (container) container.style.display = 'none';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        if (container) container.style.display = 'block';
    }
}

function viewAssignmentFromNotification(notificationId) {
    // Navigate to assignment requests section
    showSection('assignment-requests');
    // In a real implementation, you would scroll to or highlight the specific assignment
    showSuccessModal('Opening assignment details...');
}

function viewInvoiceFromNotification(notificationId) {
    // Navigate to invoice management section
    showSection('invoice-management');
    // In a real implementation, you would scroll to or highlight the specific invoice
    showSuccessModal('Opening invoice details...');
}

function viewContentFromNotification(notificationId) {
    // Navigate to content review section
    showSection('content-review');
    // In a real implementation, you would scroll to or highlight the specific content
    showSuccessModal('Opening content review...');
}

function viewSystemUpdate() {
    showSuccessModal('System update information will be displayed here.');
}

function viewStudents() {
    showSection('students');
    showSuccessModal('Opening student management...');
}

// Admin Notifications - Variables declared at top of file

// Initialize admin notifications
function initializeAdminNotifications() {
    // Ensure variables are initialized
    if (!adminNotificationsList) {
        adminNotificationsList = [];
    }

    // Load initial notifications
    loadAdminNotifications();

    // WebSocket removed - notifications are loaded via API polling
    // You can add polling here if needed: setInterval(() => loadAdminNotifications(), 30000);
}

async function loadAdminNotifications() {
    try {
        if (typeof apiClient !== 'undefined') {
            const response = await apiClient.getNotifications({ role: 'admin' });
            adminNotificationsList = Array.isArray(response) ? response : (response.results || []);

            // Update dropdown if open
            const dropdown = document.getElementById('adminNotificationDropdownList');
            if (dropdown) {
                renderAdminNotifications();
            }
        }
    } catch (error) {
        console.error('Failed to load admin notifications:', error);
        // Initialize empty list if error occurs
        if (!adminNotificationsList) {
            adminNotificationsList = [];
        }
    }
}

function handleNewAdminNotification(notification) {
    adminNotificationsList.unshift(notification);
    updateAdminNotificationBadge(adminNotificationsList.filter(n => !n.is_read).length);

    // Show toast notification
    if (notification.title) {
        showSuccessModal(`${notification.title}: ${notification.message}`);
    }

    // Re-render notifications if dropdown is open
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown && dropdown.classList.contains('active')) {
        renderAdminNotifications();
    }
}

function updateAdminNotificationBadge(count) {
    // WS-driven: counts are pushed via ws/dashboard/ (realtimeDashboard.js)
    return;
    const notificationButton = document.getElementById('notificationButton');
    const badge = notificationButton ? notificationButton.querySelector('.notification-dot') : null;

    if (badge) {
        if (count > 0) {
            badge.style.display = 'block';
            badge.textContent = count > 99 ? '99+' : count.toString();
            badge.style.width = 'auto';
            badge.style.height = 'auto';
            badge.style.padding = '2px 6px';
            badge.style.borderRadius = '10px';
            badge.style.fontSize = '0.7rem';
            badge.style.fontWeight = '700';
            badge.style.minWidth = '18px';
        } else {
            badge.style.display = 'none';
        }
    }
}

function handleAdminNotificationError(error) {
    // WebSocket removed - this function kept for compatibility but does nothing
    // console.error('Admin Notification WebSocket error:', error);
}

function renderAdminNotifications() {
    const dropdown = document.getElementById('adminNotificationDropdownList');
    if (!dropdown) {
        console.warn('Notification dropdown list element not found');
        return;
    }

    // Ensure adminNotificationsList is initialized
    if (!adminNotificationsList) {
        adminNotificationsList = [];
    }

    const unreadNotifications = adminNotificationsList.filter(n => !n.is_read);
    const readNotifications = adminNotificationsList.filter(n => n.is_read);

    let html = '';

    if (unreadNotifications.length === 0 && readNotifications.length === 0) {
        html = '<div class="notification-loading" style="text-align: center; padding: 2rem; color: #9ca3af;">No notifications</div>';
    } else {
        // Render unread notifications first
        unreadNotifications.forEach(notification => {
            const notificationId = notification.notification_id || notification.id;
            const notificationType = notification.notification_type || 'system';
            const icon = getNotificationIcon(notificationType);
            const time = formatNotificationTime(notification.created_at);
            html += `
                <div class="notification-dropdown-item unread" data-type="${notificationType}" data-id="${notificationId}" onclick="viewAdminNotification(${notificationId})">
                    <div class="dropdown-notification-icon ${notificationType}">
                        <i class="fas fa-${icon}"></i>
                    </div>
                    <div class="dropdown-notification-content">
                        <div class="dropdown-notification-header">
                            <h4 class="dropdown-notification-title">${notification.title || 'Notification'}</h4>
                            <span class="dropdown-notification-time">${time}</span>
                        </div>
                        <p class="dropdown-notification-message">${notification.message || ''}</p>
                    </div>
                    <button class="dropdown-notification-close" onclick="event.stopPropagation(); removeAdminNotification(${notificationId})" title="Remove">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });

        // Render read notifications (limit to 10)
        readNotifications.slice(0, 10).forEach(notification => {
            const notificationId = notification.notification_id || notification.id;
            const notificationType = notification.notification_type || 'system';
            const icon = getNotificationIcon(notificationType);
            const time = formatNotificationTime(notification.created_at);
            html += `
                <div class="notification-dropdown-item" data-type="${notificationType}" data-id="${notificationId}" onclick="viewAdminNotification(${notificationId})">
                    <div class="dropdown-notification-icon ${notificationType}">
                        <i class="fas fa-${icon}"></i>
                    </div>
                    <div class="dropdown-notification-content">
                        <div class="dropdown-notification-header">
                            <h4 class="dropdown-notification-title">${notification.title || 'Notification'}</h4>
                            <span class="dropdown-notification-time">${time}</span>
                        </div>
                        <p class="dropdown-notification-message">${notification.message || ''}</p>
                    </div>
                    <button class="dropdown-notification-close" onclick="event.stopPropagation(); removeAdminNotification(${notificationId})" title="Remove">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });
    }

    dropdown.innerHTML = html;
}

function getNotificationIcon(type) {
    const icons = {
        'assignment': 'file-alt',
        'invoice': 'receipt',
        'meeting': 'video',
        'message': 'comment',
        'system': 'info-circle',
        'announcement': 'bullhorn'
    };
    return icons[type] || 'bell';
}

function formatNotificationTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}

async function removeAdminNotification(notificationId) {
    try {
        if (typeof apiClient !== 'undefined') {
            await apiClient.markNotificationRead(notificationId);
            adminNotificationsList = adminNotificationsList.filter(n => n.notification_id != notificationId);
            updateAdminNotificationBadge(adminNotificationsList.filter(n => !n.is_read).length);
            renderAdminNotifications();
        }
    } catch (error) {
        console.error('Failed to remove notification:', error);
    }
}

async function markAllAdminNotificationsRead() {
    try {
        if (typeof apiClient !== 'undefined') {
            await apiClient.markAllNotificationsRead();
            adminNotificationsList.forEach(n => n.is_read = true);
            updateAdminNotificationBadge(0);
            renderAdminNotifications();
        }
    } catch (error) {
        console.error('Failed to mark all as read:', error);
    }
}

function viewAdminNotification(notificationId) {
    const notification = adminNotificationsList.find(n => n.notification_id == notificationId);
    if (!notification) return;

    removeAdminNotification(notificationId);

    // Navigate based on notification type
    if (notification.notification_type === 'assignment' && notification.related_entity_id) {
        showSection('assignment-requests');
    } else if (notification.notification_type === 'invoice' && notification.related_entity_id) {
        showSection('financial');
    }
}

// Update notification dropdown badge count
function updateNotificationDropdownCount() {
    const unreadCount = adminNotificationsList.filter(n => !n.is_read).length;
    updateAdminNotificationBadge(unreadCount);

    // Also update dropdown content if open
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown && dropdown.classList.contains('active')) {
        renderAdminNotifications();
    }
}

// Export notification functions
window.filterNotifications = filterNotifications;
window.markAsRead = markAsRead;
window.markAllAsRead = markAllAsRead;
window.removeNotification = removeNotification;
window.clearAllNotifications = clearAllNotifications;
window.viewAssignmentFromNotification = viewAssignmentFromNotification;
window.viewInvoiceFromNotification = viewInvoiceFromNotification;
window.viewContentFromNotification = viewContentFromNotification;
window.viewSystemUpdate = viewSystemUpdate;
window.viewStudents = viewStudents;

// Announcement Functions (same as Teacher_Dash.js)
// announcementTags is declared at the top of the file to avoid temporal dead zone issues

function openCreateAnnouncementModal() {
    try {
        console.log('Opening announcement modal...');
        const modal = document.getElementById('createAnnouncementModal');
        if (!modal) {
            console.error('Announcement modal not found!');
            alert('Error: Announcement modal not found. Please refresh the page.');
            return;
        }

        console.log('Modal found, setting display to flex...');
        // Force display to flex and ensure visibility
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        // Ensure modal is visible
        setTimeout(() => {
            if (modal.style.display !== 'flex') {
                modal.style.display = 'flex';
            }
        }, 10);

        // Reset form
        const form = document.getElementById('announcementForm');
        if (form) {
            form.reset();
        }

        const panel = document.getElementById('specificRecipientsPanel');
        if (panel) {
            panel.style.display = 'none';
        }

        const selectSpecific = document.getElementById('selectSpecific');
        if (selectSpecific) {
            selectSpecific.checked = false;
        }

        // Reset tags
        window.announcementTags = [];
        announcementTags = window.announcementTags;
        const tagsPreview = document.getElementById('tagsPreview');
        if (tagsPreview) {
            tagsPreview.innerHTML = '';
        }

        // Reset character count
        const characterCount = document.getElementById('contentCharacterCount');
        if (characterCount) {
            characterCount.textContent = '0';
        }

        // Update recipient count - wrap in try-catch to prevent blocking
        try {
            if (typeof updateSelectedRecipientsCount === 'function') {
                updateSelectedRecipientsCount();
            }
        } catch (countError) {
            console.warn('Error updating recipient count:', countError);
            // Don't block modal opening if count update fails
        }

        console.log('Modal opened successfully');
    } catch (error) {
        console.error('Error opening announcement modal:', error);
        console.error('Error stack:', error.stack);
        alert('Error opening announcement modal: ' + error.message + '\n\nPlease check the console (F12) for more details.');
    }
}

function closeCreateAnnouncementModal() {
    const modal = document.getElementById('createAnnouncementModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
    }
}

function toggleSpecificRecipients() {
    const selectSpecific = document.getElementById('selectSpecific');
    const panel = document.getElementById('specificRecipientsPanel');
    if (selectSpecific && panel) {
        if (selectSpecific.checked) {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
            document.querySelectorAll('#specificRecipientsPanel .recipient-checkbox-modern').forEach(cb => {
                cb.checked = false;
            });
        }
        updateSelectedRecipientsCount();
    }
}

function switchRecipientTab(tabName) {
    document.querySelectorAll('.recipient-tab-modern').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.recipient-list-modern').forEach(list => {
        list.classList.remove('active');
        list.style.display = 'none';
    });
    const activeTab = document.querySelector(`.recipient-tab-modern[data-tab="${tabName}"]`);
    const activeList = document.getElementById(`${tabName}List`);
    if (activeTab) activeTab.classList.add('active');
    if (activeList) {
        activeList.classList.add('active');
        activeList.style.display = 'block';
    }

    // Clear search when switching tabs
    const searchInput = document.getElementById('recipientSearch');
    if (searchInput) {
        searchInput.value = '';
        clearRecipientSearch();
    }
}

function filterRecipients() {
    const searchQuery = document.getElementById('recipientSearch')?.value.toLowerCase() || '';
    const activeList = document.querySelector('.recipient-list-modern.active');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (!activeList) return;

    const items = activeList.querySelectorAll('.recipient-item-modern');
    items.forEach(item => {
        const name = item.querySelector('.recipient-name-modern')?.textContent.toLowerCase() || '';
        const email = item.querySelector('.recipient-email-modern')?.textContent.toLowerCase() || '';
        item.style.display = (name.includes(searchQuery) || email.includes(searchQuery)) ? 'flex' : 'none';
    });

    // Show/hide clear button
    if (clearBtn) {
        clearBtn.style.display = searchQuery ? 'flex' : 'none';
    }
}

function clearRecipientSearch() {
    const searchInput = document.getElementById('recipientSearch');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (searchInput) {
        searchInput.value = '';
        filterRecipients();
    }

    if (clearBtn) {
        clearBtn.style.display = 'none';
    }
}

function selectAllInList(listType) {
    const list = document.getElementById(`${listType}List`);
    if (!list) return;

    const checkboxes = list.querySelectorAll('.recipient-checkbox-modern');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);

    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });

    updateSelectedRecipientsCount();
}

function updateSelectedRecipientsCount() {
    try {
        const selectAllStudents = document.getElementById('selectAllStudents')?.checked || false;
        const selectAllTeachers = document.getElementById('selectAllTeachers')?.checked || false;
        const selectAllCSReps = document.getElementById('selectAllCSReps')?.checked || false;
        const selectSpecific = document.getElementById('selectSpecific')?.checked || false;
        let count = 0;

        if (selectAllStudents) {
            const studentsList = document.querySelectorAll('#studentsList .recipient-item-modern');
            count += studentsList ? studentsList.length : 0;
        }
        if (selectAllTeachers) {
            const teachersList = document.querySelectorAll('#teachersList .recipient-item-modern');
            count += teachersList ? teachersList.length : 0;
        }
        if (selectAllCSReps) {
            const csrepsList = document.querySelectorAll('#csrepsList .recipient-item-modern');
            count += csrepsList ? csrepsList.length : 0;
        }
        if (selectSpecific) {
            const checkedBoxes = document.querySelectorAll('#specificRecipientsPanel .recipient-checkbox-modern:checked');
            count = checkedBoxes ? checkedBoxes.length : 0;
        }

        const countSpan = document.getElementById('selectedRecipientsCount');
        const summary = document.getElementById('selectedRecipientsSummary');
        if (countSpan) {
            countSpan.textContent = count;
        }
        if (summary) {
            summary.style.display = (count > 0 || selectAllStudents || selectAllTeachers || selectAllCSReps) ? 'flex' : 'none';
        }
    } catch (error) {
        console.warn('Error in updateSelectedRecipientsCount:', error);
    }
}

async function submitAnnouncement() {
    const form = document.getElementById('announcementForm');
    if (!form) return;
    const title = document.getElementById('announcementTitle')?.value.trim();
    const content = document.getElementById('announcementContent')?.value.trim();
    const priority = document.querySelector('input[name="announcementPriority"]:checked')?.value || 'general';
    const tags = window.announcementTags || [];

    if (!title || !content) {
        showToast('Please fill in all required fields.', 'error');
        return;
    }
    const selectAllStudents = document.getElementById('selectAllStudents')?.checked || false;
    const selectAllTeachers = document.getElementById('selectAllTeachers')?.checked || false;
    const selectAllCSReps = document.getElementById('selectAllCSReps')?.checked || false;
    const selectSpecific = document.getElementById('selectSpecific')?.checked || false;
    
    let specific_ids = [];
    if (selectSpecific) {
        specific_ids = Array.from(document.querySelectorAll('#specificRecipientsPanel .recipient-checkbox-modern:checked')).map(cb => cb.value);
    }

    if (!selectAllStudents && !selectAllTeachers && !selectAllCSReps && specific_ids.length === 0) {
        showToast('Please select at least one recipient.', 'error');
        return;
    }

    try {
        const announcementData = {
            title,
            content,
            priority,
            tags: tags,
            all_students: selectAllStudents,
            all_teachers: selectAllTeachers,
            all_csreps: selectAllCSReps,
            specific_ids: specific_ids,
            scheduled_at: document.getElementById('scheduledDateTime')?.value || null,
            send_email: true,
            pin_to_dashboard: false
        };

        const response = await apiClient.createAnnouncement(announcementData);
        if (response.success) {
            showToast('Announcement created successfully!', 'success');
            closeCreateAnnouncementModal();
            loadAnnouncements(); // Refresh the list
        } else {
            showToast(response.error || 'Failed to create announcement.', 'error');
        }
    } catch (error) {
        console.error('Error creating announcement:', error);
        showToast('An error occurred while creating the announcement.', 'error');
    }
}

async function loadAnnouncements() {
    const container = document.querySelector('.announcements-container');
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
                    <div class="announcement-item" data-id="${ann.id}">
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
                            ${ann.is_author || localStorage.getItem('user_role') === 'ADMIN' ? `
                                <button class="delete-announcement-btn" onclick="confirmDeleteAnnouncement(${ann.id})" title="Delete Announcement">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
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

async function confirmDeleteAnnouncement(id) {
    if (confirm('Are you sure you want to delete this announcement?')) {
        try {
            const response = await apiClient.deleteAnnouncement(id);
            if (response.success) {
                showToast('Announcement deleted successfully!', 'success');
                loadAnnouncements();
            } else {
                showToast(response.error || 'Failed to delete announcement.', 'error');
            }
        } catch (error) {
            console.error('Error deleting announcement:', error);
            showToast('An error occurred while deleting the announcement.', 'error');
        }
    }
}

async function fetchAnnouncementRecipients() {
    try {
        const response = await apiClient.getAnnouncementRecipients();
        if (response.success) {
            const studentsList = document.getElementById('studentsList')?.querySelector('.recipient-items-wrapper');
            const teachersList = document.getElementById('teachersList')?.querySelector('.recipient-items-wrapper');
            const csrepsList = document.getElementById('csrepsList')?.querySelector('.recipient-items-wrapper');
            
            if (studentsList) {
                studentsList.innerHTML = response.students.map(s => `
                    <label class="recipient-item-modern">
                        <input type="checkbox" class="recipient-checkbox-modern"
                            value="${s.id}" data-name="${s.name}"
                            data-email="${s.email}">
                        <div class="recipient-avatar-modern">
                            ${s.avatar ? `<img src="${s.avatar}" alt="${s.name}">` : `<div class="avatar-fallback">${s.name.split(' ').map(n => n[0]).join('')}</div>`}
                        </div>
                        <div class="recipient-details-modern">
                            <div class="recipient-name-modern">${s.name}</div>
                            <div class="recipient-email-modern">${s.email}</div>
                        </div>
                    </label>
                `).join('');
            }
            
            if (teachersList) {
                teachersList.innerHTML = response.teachers.map(t => `
                    <label class="recipient-item-modern">
                        <input type="checkbox" class="recipient-checkbox-modern"
                            value="${t.id}" data-name="${t.name}"
                            data-email="${t.email}">
                        <div class="recipient-avatar-modern">
                            ${t.avatar ? `<img src="${t.avatar}" alt="${t.name}">` : `<div class="avatar-fallback">${t.name.split(' ').map(n => n[0]).join('')}</div>`}
                        </div>
                        <div class="recipient-details-modern">
                            <div class="recipient-name-modern">${t.name}</div>
                            <div class="recipient-email-modern">${t.email}</div>
                        </div>
                    </label>
                `).join('');
            }

            if (csrepsList) {
                csrepsList.innerHTML = (response.csreps || []).map(c => `
                    <label class="recipient-item-modern">
                        <input type="checkbox" class="recipient-checkbox-modern"
                            value="${c.id}" data-name="${c.name}"
                            data-email="${c.email}">
                        <div class="recipient-avatar-modern">
                            ${c.avatar ? `<img src="${c.avatar}" alt="${c.name}">` : `<div class="avatar-fallback">${c.name.split(' ').map(n => n[0]).join('')}</div>`}
                        </div>
                        <div class="recipient-details-modern">
                            <div class="recipient-name-modern">${c.name}</div>
                            <div class="recipient-email-modern">${c.email}</div>
                        </div>
                    </label>
                `).join('');
            }
            
            // Add event listeners to new checkboxes
            document.querySelectorAll('.recipient-checkbox-modern').forEach(cb => {
                cb.addEventListener('change', updateSelectedRecipientsCount);
            });
            
            // Update counts in tabs
            const studentCountEl = document.getElementById('studentsCount');
            const teacherCountEl = document.getElementById('teachersCount');
            const csrepCountEl = document.getElementById('csrepsCount');
            const allStudentsCountEl = document.getElementById('allStudentsCount');
            const allTeachersCountEl = document.getElementById('allTeachersCount');
            const allCSRepsCountEl = document.getElementById('allCSRepsCount');
            
            if (studentCountEl) studentCountEl.textContent = response.students.length;
            if (teacherCountEl) teacherCountEl.textContent = response.teachers.length;
            if (csrepCountEl) csrepCountEl.textContent = (response.csreps || []).length;
            if (allStudentsCountEl) allStudentsCountEl.textContent = response.students.length;
            if (allTeachersCountEl) allTeachersCountEl.textContent = response.teachers.length;
            if (allCSRepsCountEl) allCSRepsCountEl.textContent = (response.csreps || []).length;
        }
    } catch (error) {
        console.error('Error fetching recipients:', error);
    }
}

// Initialize announcement event listeners
document.addEventListener('DOMContentLoaded', function () {
    const recipientCheckboxes = document.querySelectorAll('.recipient-checkbox-modern');
    recipientCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectedRecipientsCount);
    });

    // Character count for content textarea
    const contentTextarea = document.getElementById('announcementContent');
    const characterCount = document.getElementById('contentCharacterCount');
    if (contentTextarea && characterCount) {
        contentTextarea.addEventListener('input', function () {
            const count = this.value.length;
            characterCount.textContent = count;

            if (count > 2000) {
                characterCount.style.color = '#ef4444';
            } else if (count > 1800) {
                characterCount.style.color = '#f59e0b';
            } else {
                characterCount.style.color = 'var(--muted)';
            }
        });
    }

    // Tags input functionality
    const tagsInput = document.getElementById('announcementTags');
    const tagsPreview = document.getElementById('tagsPreview');

    if (tagsInput && tagsPreview) {
        function renderTags() {
            tagsPreview.innerHTML = '';
            window.announcementTags.forEach((tag, index) => {
                const tagChip = document.createElement('div');
                tagChip.className = 'tag-chip';
                tagChip.innerHTML = `
                    <span>${tag}</span>
                    <button type="button" class="tag-remove" onclick="removeAnnouncementTag(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                tagsPreview.appendChild(tagChip);
            });
        }

        tagsInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && this.value.trim()) {
                e.preventDefault();
                const tag = this.value.trim();
                if (!window.announcementTags.includes(tag) && tag.length > 0) {
                    window.announcementTags.push(tag);
                    renderTags();
                    this.value = '';
                }
            }
        });

        // Define removeAnnouncementTag function
        function removeAnnouncementTag(index) {
            if (Array.isArray(window.announcementTags)) {
                window.announcementTags.splice(index, 1);
                renderTags();
            }
        }

        // Expose to window immediately
        window.removeAnnouncementTag = removeAnnouncementTag;
    }

    // Quick select checkboxes
    const selectAllStudents = document.getElementById('selectAllStudents');
    const selectAllTeachers = document.getElementById('selectAllTeachers');
    const selectAllCSReps = document.getElementById('selectAllCSReps');

    if (selectAllStudents) {
        selectAllStudents.addEventListener('change', function () {
            updateSelectedRecipientsCount();
        });
    }

    if (selectAllTeachers) {
        selectAllTeachers.addEventListener('change', function () {
            updateSelectedRecipientsCount();
        });
    }

    if (selectAllCSReps) {
        selectAllCSReps.addEventListener('change', function () {
            updateSelectedRecipientsCount();
        });
    }

    // Close modal when clicking outside
    const modalOverlay = document.getElementById('createAnnouncementModal');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function (e) {
            if (e.target === this) {
                closeCreateAnnouncementModal();
            }
        });
    }

    // Close modal with Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modalOverlay && modalOverlay.style.display === 'flex') {
            closeCreateAnnouncementModal();
        }
    });
});

// Expose functions globally immediately
window.openCreateAnnouncementModal = openCreateAnnouncementModal;
window.closeCreateAnnouncementModal = closeCreateAnnouncementModal;
window.toggleSpecificRecipients = toggleSpecificRecipients;
window.switchRecipientTab = switchRecipientTab;
window.filterRecipients = filterRecipients;
window.clearRecipientSearch = clearRecipientSearch;
window.selectAllInList = selectAllInList;
window.submitAnnouncement = submitAnnouncement;
// removeAnnouncementTag is already exposed inside the function above
if (typeof window.removeAnnouncementTag === 'undefined') {
    window.removeAnnouncementTag = function (index) {
        if (Array.isArray(window.announcementTags)) {
            window.announcementTags.splice(index, 1);
            // Try to re-render tags if renderTags function exists
            const tagsPreview = document.getElementById('tagsPreview');
            if (tagsPreview) {
                tagsPreview.innerHTML = '';
                window.announcementTags.forEach((tag, idx) => {
                    const tagChip = document.createElement('div');
                    tagChip.className = 'tag-chip';
                    tagChip.innerHTML = `
                        <span>${tag}</span>
                        <button type="button" class="tag-remove" onclick="removeAnnouncementTag(${idx})">
                            <i class="fas fa-times"></i>
                        </button>
                    `;
                    tagsPreview.appendChild(tagChip);
                });
            }
        }
    };
}
window.updateSelectedRecipientsCount = updateSelectedRecipientsCount;

// ============================================================================
// Feedback & Reports Functions (moved from admin_base.html)
// ============================================================================

// Feedback & Reports Tab Switching
function switchFeedbackReportsTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.feedback-reports-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        }
    });

    // Update tab content
    const feedbackTabContent = document.getElementById('feedbackTabContent');
    const reportsTabContent = document.getElementById('reportsTabContent');

    if (tab === 'feedback') {
        feedbackTabContent.style.display = 'block';
        if (reportsTabContent) reportsTabContent.style.display = 'none';
    } else if (tab === 'reports') {
        if (feedbackTabContent) feedbackTabContent.style.display = 'none';
        reportsTabContent.style.display = 'block';
    }

    // Re-apply filter when switching tabs
    if (document.getElementById('feedbackReportsFilter')) {
        filterFeedbackReports();
    }
}

// Filter Feedback and Reports
function filterFeedbackReports() {
    const filter = document.getElementById('feedbackReportsFilter').value;

    // Check which tab is currently active
    const feedbackTabContent = document.getElementById('feedbackTabContent');
    const reportsTabContent = document.getElementById('reportsTabContent');
    const isFeedbackTabActive = feedbackTabContent && feedbackTabContent.style.display !== 'none';
    const isReportsTabActive = reportsTabContent && reportsTabContent.style.display !== 'none';

    const feedbackRows = document.querySelectorAll('.feedback-row');
    const reportRows = document.querySelectorAll('.report-row');

    // Filter feedback rows (only if feedback tab is active or filter applies to both)
    if (isFeedbackTabActive || filter === 'all' || filter === 'feedback' || filter === 'unread' || filter === 'high-priority') {
        feedbackRows.forEach(row => {
            let show = true;
            if (filter === 'reports') {
                show = false;
            } else if (filter === 'feedback') {
                show = true; // Show all feedback when filter is 'feedback'
            } else if (filter === 'unread') {
                const status = row.querySelector('.status-badge')?.textContent.trim();
                show = status === 'Unread';
            } else if (filter === 'high-priority') {
                const priority = row.dataset.priority;
                show = priority === 'high' || priority === 'urgent';
            }
            // Only update display if feedback tab is active
            if (isFeedbackTabActive) {
                row.style.display = show ? '' : 'none';
            }
        });
    }

    // Filter report rows (only if reports tab is active or filter applies to both)
    if (isReportsTabActive || filter === 'all' || filter === 'reports' || filter === 'unread' || filter === 'high-priority') {
        reportRows.forEach(row => {
            let show = true;
            if (filter === 'feedback') {
                show = false;
            } else if (filter === 'reports') {
                show = true; // Show all reports when filter is 'reports'
            } else if (filter === 'unread') {
                const status = row.querySelector('.status-badge')?.textContent.trim();
                show = status === 'Unread';
            } else if (filter === 'high-priority') {
                const severity = row.dataset.severity;
                show = severity === 'high' || severity === 'critical';
            }
            // Only update display if reports tab is active
            if (isReportsTabActive) {
                row.style.display = show ? '' : 'none';
            }
        });
    }
}

// View Feedback
async function viewFeedback(feedbackId) {
    try {
        const response = await fetch(`/account/api/admin/feedback/${feedbackId}/detail/`);
        const data = await response.json();
        
        if (data.success) {
            const f = data.feedback;
            document.getElementById('viewModalTitle').textContent = 'Feedback Details';
            document.getElementById('viewModalSubtitle').textContent = `Submitted by ${f.teacher}`;
            document.getElementById('viewModalBody').innerHTML = `
                <div class="modern-view-content">
                    <div class="modern-info-section">
                        <div class="modern-info-group">
                            <span class="modern-info-label">Student</span>
                            <span class="modern-info-value">${f.student}</span>
                        </div>
                        <div class="modern-info-group">
                            <span class="modern-info-label">Type</span>
                            <span class="type-badge feedback">${f.type}</span>
                        </div>
                        <div class="modern-info-group">
                            <span class="modern-info-label">Priority</span>
                            <span class="priority-badge ${f.priority.toLowerCase()}">${f.priority}</span>
                        </div>
                        <div class="modern-info-group">
                            <span class="modern-info-label">Submitted</span>
                            <span class="modern-info-value">${f.created_at}</span>
                        </div>
                    </div>
                    
                    <div class="modern-content-section">
                        <span class="modern-section-label">Subject</span>
                        <h3 class="modern-section-title">${f.subject}</h3>
                    </div>
                    
                    <div class="modern-content-section">
                        <span class="modern-section-label">Message</span>
                        <div class="modern-message-content">${f.message}</div>
                    </div>
                </div>
            `;
            
            // Show/hide mark as read button
            const markReadBtn = document.querySelector('#viewFeedbackReportModal .modern-btn-primary');
            if (markReadBtn) {
                markReadBtn.style.display = f.is_read ? 'none' : 'flex';
            }
            
            document.getElementById('viewFeedbackReportModal').style.display = 'flex';
            window.currentViewId = feedbackId;
            window.currentViewType = 'feedback';
        } else {
            showToast(data.error || 'Failed to fetch feedback details', 'error');
        }
    } catch (error) {
        console.error('Error fetching feedback details:', error);
        showToast('An error occurred while fetching feedback details', 'error');
    }
}

// View Report
async function viewReport(reportId) {
    try {
        const response = await fetch(`/account/api/admin/report/${reportId}/detail/`);
        const data = await response.json();
        
        if (data.success) {
            const r = data.report;
            document.getElementById('viewModalTitle').textContent = 'Report Details';
            document.getElementById('viewModalSubtitle').textContent = `Submitted by ${r.teacher}`;
            document.getElementById('viewModalBody').innerHTML = `
                <div class="modern-view-content">
                    <div class="modern-info-section">
                        <div class="modern-info-group">
                            <span class="modern-info-label">Student</span>
                            <span class="modern-info-value">${r.student}</span>
                        </div>
                        <div class="modern-info-group">
                            <span class="modern-info-label">Type</span>
                            <span class="type-badge report">${r.type}</span>
                        </div>
                        <div class="modern-info-group">
                            <span class="modern-info-label">Severity</span>
                            <span class="severity-badge ${r.severity.toLowerCase()}">${r.severity}</span>
                        </div>
                        <div class="modern-info-group">
                            <span class="modern-info-label">Report Date</span>
                            <span class="modern-info-value">${r.date}</span>
                        </div>
                        <div class="modern-info-group">
                            <span class="modern-info-label">Submitted</span>
                            <span class="modern-info-value">${r.date}</span>
                        </div>
                    </div>
                    
                    <div class="modern-content-section">
                        <span class="modern-section-label">Title</span>
                        <h3 class="modern-section-title">${r.title}</h3>
                    </div>
                    
                    <div class="modern-content-section">
                        <span class="modern-section-label">Description</span>
                        <div class="modern-message-content">${r.description}</div>
                    </div>
                </div>
            `;
            
            // Show/hide mark as read button
            const markReadBtn = document.querySelector('#viewFeedbackReportModal .modern-btn-primary');
            if (markReadBtn) {
                markReadBtn.style.display = r.is_read ? 'none' : 'flex';
            }
            
            document.getElementById('viewFeedbackReportModal').style.display = 'flex';
            window.currentViewId = reportId;
            window.currentViewType = 'report';
        } else {
            showToast(data.error || 'Failed to fetch report details', 'error');
        }
    } catch (error) {
        console.error('Error fetching report details:', error);
        showToast('An error occurred while fetching report details', 'error');
    }
}

function closeViewFeedbackReportModal() {
    document.getElementById('viewFeedbackReportModal').style.display = 'none';
}

function markAsReadAndClose() {
    if (window.currentViewType === 'feedback') {
        markFeedbackRead(window.currentViewId);
    } else if (window.currentViewType === 'report') {
        markReportRead(window.currentViewId);
    }
    closeViewFeedbackReportModal();
}

async function markFeedbackRead(feedbackId) {
    try {
        const response = await fetch(`/account/api/admin/feedback/${feedbackId}/mark-read/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        });
        const data = await response.json();
        if (data.success) {
            // Update UI locally
            const row = document.querySelector(`.feedback-row[data-id="${feedbackId}"]`);
            if (row) {
                const statusBadge = row.querySelector('.status-badge');
                if (statusBadge) {
                    statusBadge.textContent = 'Read';
                    statusBadge.classList.remove('unread');
                    statusBadge.classList.add('read');
                }
                row.dataset.status = 'read';
                
                // Hide mark as read button in row
                const checkBtn = row.querySelector('.action-btn-small.secondary');
                if (checkBtn) checkBtn.style.display = 'none';
            }
            
            // Refresh counts
            if (window.loadedSections && window.loadedSections['feedback-reports']) {
                delete window.loadedSections['feedback-reports'];
            }
            if (typeof window.showSection === 'function') {
                window.showSection('feedback-reports');
            }
        } else {
            showToast(data.error || 'Failed to mark feedback as read', 'error');
        }
    } catch (error) {
        console.error('Error marking feedback as read:', error);
    }
}

async function markReportRead(reportId) {
    try {
        const response = await fetch(`/account/api/admin/report/${reportId}/mark-read/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        });
        const data = await response.json();
        if (data.success) {
            // Update UI locally
            const row = document.querySelector(`.report-row[data-id="${reportId}"]`);
            if (row) {
                const statusBadge = row.querySelector('.status-badge');
                if (statusBadge) {
                    statusBadge.textContent = 'Read';
                    statusBadge.classList.remove('unread');
                    statusBadge.classList.add('read');
                }
                row.dataset.status = 'read';
                
                // Hide mark as read button in row
                const checkBtn = row.querySelector('.action-btn-small.secondary');
                if (checkBtn) checkBtn.style.display = 'none';
            }
            
            // Refresh counts
            if (window.loadedSections && window.loadedSections['feedback-reports']) {
                delete window.loadedSections['feedback-reports'];
            }
            if (typeof window.showSection === 'function') {
                window.showSection('feedback-reports');
            }
        } else {
            showToast(data.error || 'Failed to mark report as read', 'error');
        }
    } catch (error) {
        console.error('Error marking report as read:', error);
    }
}

async function deleteFeedback(feedbackId) {
    if (!confirm('Are you sure you want to delete this feedback? This action cannot be undone.')) return;
    
    try {
        const csrfToken = getCookie('csrftoken');
        if (!csrfToken) {
            showToast('CSRF token not found. Please refresh the page and try again.', 'error');
            console.error('CSRF token not found');
            return;
        }

        const response = await fetch(`/account/api/admin/feedback/${feedbackId}/delete/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', response.status, errorText);
            
            // Try to parse as JSON if possible, otherwise show generic error
            let errorMessage = 'Failed to delete feedback.';
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error || errorJson.message || errorMessage;
            } catch (e) {
                // If it's HTML (403 error page), provide a more helpful message
                if (response.status === 403) {
                    errorMessage = 'Access forbidden. Please ensure you are logged in and have permission to delete feedback.';
                } else {
                    errorMessage = `Server error (${response.status}). Please try again.`;
                }
            }
            showToast(errorMessage, 'error');
            return;
        }

        const data = await response.json();
        if (data.success) {
            showToast('Feedback deleted successfully', 'success');
            if (window.loadedSections && window.loadedSections['feedback-reports']) {
                delete window.loadedSections['feedback-reports'];
            }
            if (typeof window.showSection === 'function') {
                window.showSection('feedback-reports');
            } else {
                location.reload();
            }
        } else {
            showToast(data.error || data.message || 'Failed to delete feedback', 'error');
        }
    } catch (error) {
        console.error('Error deleting feedback:', error);
        showToast('An error occurred while deleting feedback. Please try again.', 'error');
    }
}

async function deleteReport(reportId) {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) return;
    
    try {
        const csrfToken = getCookie('csrftoken');
        if (!csrfToken) {
            showToast('CSRF token not found. Please refresh the page and try again.', 'error');
            console.error('CSRF token not found');
            return;
        }

        const response = await fetch(`/account/api/admin/report/${reportId}/delete/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', response.status, errorText);
            
            // Try to parse as JSON if possible, otherwise show generic error
            let errorMessage = 'Failed to delete report.';
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error || errorJson.message || errorMessage;
            } catch (e) {
                // If it's HTML (403 error page), provide a more helpful message
                if (response.status === 403) {
                    errorMessage = 'Access forbidden. Please ensure you are logged in and have permission to delete report.';
                } else {
                    errorMessage = `Server error (${response.status}). Please try again.`;
                }
            }
            showToast(errorMessage, 'error');
            return;
        }

        const data = await response.json();
        if (data.success) {
            showToast('Report deleted successfully', 'success');
            if (window.loadedSections && window.loadedSections['feedback-reports']) {
                delete window.loadedSections['feedback-reports'];
            }
            if (typeof window.showSection === 'function') {
                window.showSection('feedback-reports');
            } else {
                location.reload();
            }
        } else {
            showToast(data.error || data.message || 'Failed to delete report', 'error');
        }
    } catch (error) {
        console.error('Error deleting report:', error);
        showToast('An error occurred while deleting report. Please try again.', 'error');
    }
}

async function deleteVisitor(visitorId) {
    if (!confirm('Are you sure you want to delete this visitor record? This action cannot be undone.')) return;
    
    try {
        const csrfToken = getCookie('csrftoken');
        if (!csrfToken) {
            showToast('CSRF token not found. Please refresh the page and try again.', 'error');
            console.error('CSRF token not found');
            return;
        }

        const response = await fetch(`/account/api/admin/visitor/${visitorId}/delete/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', response.status, errorText);
            
            // Try to parse as JSON if possible, otherwise show generic error
            let errorMessage = 'Failed to delete visitor.';
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error || errorJson.message || errorMessage;
            } catch (e) {
                // If it's HTML (403 error page), provide a more helpful message
                if (response.status === 403) {
                    errorMessage = 'Access forbidden. Please ensure you are logged in and have permission to delete visitors.';
                } else {
                    errorMessage = `Server error (${response.status}). Please try again.`;
                }
            }
            showToast(errorMessage, 'error');
            return;
        }

        const data = await response.json();
        if (data.success) {
            showToast('Visitor deleted successfully', 'success');
            // Remove the row from the table
            const row = document.querySelector(`tr[data-visitor-id="${visitorId}"]`);
            if (row) {
                row.style.transition = 'opacity 0.3s ease';
                row.style.opacity = '0';
                setTimeout(() => {
                    row.remove();
                    // Check if table is empty
                    const tbody = document.querySelector('.visitors-table tbody');
                    if (tbody && tbody.querySelectorAll('tr.visitor-row').length === 0) {
                        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No visitors found.</td></tr>';
                    }
                }, 300);
            } else {
                // If row not found, reload the section
                if (window.loadedSections && window.loadedSections['visitors']) {
                    delete window.loadedSections['visitors'];
                }
                if (typeof window.showSection === 'function') {
                    window.showSection('visitors');
                } else {
                    location.reload();
                }
            }
        } else {
            showToast(data.error || data.message || 'Failed to delete visitor', 'error');
        }
    } catch (error) {
        console.error('Error deleting visitor:', error);
        showToast('An error occurred while deleting visitor. Please try again.', 'error');
    }
}

async function deleteContentReview(contentId, contentType) {
    const contentTypeNames = {
        'assignment': 'Assignment',
        'exam_attempt': 'Exam Attempt',
        'homework': 'Homework'
    };
    
    const contentTypeName = contentTypeNames[contentType] || 'Content';
    
    if (!confirm(`Are you sure you want to delete this ${contentTypeName.toLowerCase()} record? This action cannot be undone.`)) return;
    
    try {
        const csrfToken = getCookie('csrftoken');
        if (!csrfToken) {
            showToast('CSRF token not found. Please refresh the page and try again.', 'error');
            console.error('CSRF token not found');
            return;
        }

        const response = await fetch('/account/api/admin/content-review/delete/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content_id: contentId,
                content_type: contentType
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', response.status, errorText);
            
            // Try to parse as JSON if possible, otherwise show generic error
            let errorMessage = `Failed to delete ${contentTypeName.toLowerCase()}.`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error || errorJson.message || errorMessage;
            } catch (e) {
                // If it's HTML (403 error page), provide a more helpful message
                if (response.status === 403) {
                    errorMessage = 'Access forbidden. Please ensure you are logged in and have permission to delete content.';
                } else {
                    errorMessage = `Server error (${response.status}). Please try again.`;
                }
            }
            showToast(errorMessage, 'error');
            return;
        }

        const data = await response.json();
        if (data.success) {
            showToast(`${contentTypeName} deleted successfully`, 'success');
            // Remove the row from the table
            const row = document.querySelector(`tr[data-content-id="${contentId}"]`);
            if (row) {
                row.style.transition = 'opacity 0.3s ease';
                row.style.opacity = '0';
                setTimeout(() => {
                    row.remove();
                    // Check if table is empty
                    const tbody = row.closest('tbody');
                    if (tbody && tbody.querySelectorAll('tr.content-review-row').length === 0) {
                        const table = tbody.closest('table');
                        if (table) {
                            const tableContainer = table.closest('.content-review-table-container');
                            if (tableContainer) {
                                const emptyMessage = tableContainer.previousElementSibling;
                                if (emptyMessage && emptyMessage.tagName === 'H3') {
                                    // Check if this is the assignments table or exams/homework table
                                    if (emptyMessage.textContent.includes('Assignments')) {
                                        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No completed assignments pending review.</td></tr>';
                                    } else {
                                        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No graded exams or homework pending review.</td></tr>';
                                    }
                                }
                            }
                        }
                    }
                }, 300);
            } else {
                // If row not found, reload the section
                if (window.loadedSections && window.loadedSections['content-review']) {
                    delete window.loadedSections['content-review'];
                }
                if (typeof window.showSection === 'function') {
                    window.showSection('content-review');
                } else {
                    location.reload();
                }
            }
        } else {
            showToast(data.error || data.message || `Failed to delete ${contentTypeName.toLowerCase()}`, 'error');
        }
    } catch (error) {
        console.error('Error deleting content review:', error);
        showToast(`An error occurred while deleting ${contentTypeName.toLowerCase()}. Please try again.`, 'error');
    }
}

function updateFeedbackReportsCount() {
    const feedbackCount = document.querySelectorAll('.feedback-row').length;
    const reportsCount = document.querySelectorAll('.report-row').length;
    const feedbackCountEl = document.getElementById('feedbackCount');
    const reportsCountEl = document.getElementById('reportsCount');
    if (feedbackCountEl) feedbackCountEl.textContent = feedbackCount;
    if (reportsCountEl) reportsCountEl.textContent = reportsCount;
}

// Initialize feedback reports modal close handler
document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('viewFeedbackReportModal');
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                closeViewFeedbackReportModal();
            }
        });
    }

    // Load feedback and reports count
    updateFeedbackReportsCount();
});

// ============================================================================
// Messages Functionality (moved from admin_base.html)
// ============================================================================

(function () {
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const threadHeaderName = document.getElementById('threadHeaderName');

    if (!messagesContainer || !messageInput || !sendMessageBtn) {
        return;
    }

    // Store conversations for each contact (make it globally accessible)
    window.adminConversations = window.adminConversations || {
        'alex-johnson': [
            { message: "Hello Admin! I've submitted an assignment request. Can you help me get it assigned to a teacher?", isUser: false },
            { message: "Hi Alex! I've reviewed your assignment request. I'm assigning Dr. Harper to help you with your Math project.", isUser: true },
            { message: "Thank you! When can I expect to hear from Dr. Harper?", isUser: false }
        ],
        'emma-wilson': [
            { message: "Hi Admin! I have a question about my Physics assignment.", isUser: false },
            { message: "Sure, what do you need help with?", isUser: true },
            { message: "I'm wondering about the deadline extension policy.", isUser: false }
        ],
        'dr-harper': [
            { message: "Hello Admin, I've completed reviewing Alex Johnson's assignment. Should I proceed with grading?", isUser: false },
            { message: "Yes, please proceed with grading. Let me know if you need any additional information.", isUser: true },
            { message: "Thank you! I'll have it graded by end of day.", isUser: false }
        ],
        'cs-rep': [
            { message: "Hello Admin! I'm here to assist with any questions or concerns you may have.", isUser: false },
            { message: "Thank you! I have a question about the student management system.", isUser: true },
            { message: "I'd be happy to help! What would you like to know?", isUser: false }
        ]
    };
    const conversations = window.adminConversations;

    let currentContact = 'alex-johnson';
    window.currentAdminContact = currentContact;

    // Load conversation for a contact
    function loadConversation(contactId) {
        const conversation = conversations[contactId] || [];
        messagesContainer.innerHTML = '';

        conversation.forEach(msg => {
            const msgRow = createMessageElement(msg.message, msg.isUser);
            messagesContainer.appendChild(msgRow);
        });

        scrollToBottom();
    }

    // Switch contact
    function switchContact(contactId) {
        currentContact = contactId;
        window.currentAdminContact = contactId;

        // Update active states
        document.querySelectorAll('.thread-item').forEach(item => {
            item.classList.remove('active');
        });

        const contactItem = document.querySelector(`[data-contact="${contactId}"]`);
        if (contactItem) {
            contactItem.classList.add('active');

            // Update thread header
            const contactName = contactItem.getAttribute('data-name');
            if (threadHeaderName) {
                threadHeaderName.textContent = contactName;
            }
        }

        // Load conversation
        loadConversation(contactId);
    }

    // Add click handlers to contact items
    document.querySelectorAll('.thread-item').forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', function () {
            const contactId = this.getAttribute('data-contact');
            if (contactId) {
                switchContact(contactId);
            }
        });
    });

    // Initialize user dropdown for admin messages (after a short delay to ensure DOM is ready)
    setTimeout(() => {
        initializeAdminUserDropdown();
    }, 100);

    // Auto-scroll to bottom function
    function scrollToBottom() {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // Create message element
    function createMessageElement(message, isUser = false) {
        const msgRow = document.createElement('div');
        msgRow.className = 'msg-row' + (isUser ? ' right' : '');

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        const avatarImg = document.createElement('img');
        if (isUser) {
            // Admin's avatar
            avatarImg.src = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=faces';
            avatarImg.alt = 'Admin';
        } else {
            // Contact's avatar
            const contactItem = document.querySelector(`[data-contact="${currentContact}"]`);
            if (contactItem) {
                const contactAvatar = contactItem.getAttribute('data-avatar');
                avatarImg.src = contactAvatar || 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=80&h=80&fit=crop&crop=faces';
                const contactName = contactItem.getAttribute('data-name');
                avatarImg.alt = contactName || 'Contact';
            } else {
                avatarImg.src = 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=80&h=80&fit=crop&crop=faces';
                avatarImg.alt = 'Contact';
            }
        }
        avatar.appendChild(avatarImg);

        const bubble = document.createElement('div');
        bubble.className = 'bubble ' + (isUser ? 'user' : 'admin');
        bubble.textContent = message;

        if (isUser) {
            msgRow.appendChild(bubble);
            msgRow.appendChild(avatar);
        } else {
            msgRow.appendChild(avatar);
            msgRow.appendChild(bubble);
        }

        return msgRow;
    }

    // Send message function
    function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) {
            return;
        }

        // Add user message
        const userMessage = createMessageElement(message, true);
        messagesContainer.appendChild(userMessage);

        // Save to conversation
        if (!conversations[currentContact]) {
            conversations[currentContact] = [];
        }
        conversations[currentContact].push({ message, isUser: true });

        scrollToBottom();

        // Clear input
        messageInput.value = '';

        // Simulate response
        setTimeout(() => {
            const responses = [
                "Thanks for your message! I'll get back to you soon.",
                "That's a great question. Let me think about it.",
                "I understand your concern. Let's discuss this further.",
                "Perfect! I'll help you with that.",
                "Good point! Let me provide some guidance on that.",
                "I've received your message. Let me check on that for you.",
                "That's helpful information. Thank you for sharing."
            ];
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            const adminMessage = createMessageElement(randomResponse, false);
            messagesContainer.appendChild(adminMessage);

            // Save response to conversation
            conversations[currentContact].push({ message: randomResponse, isUser: false });

            scrollToBottom();
        }, 1000);
    }

    // Microphone/Voice message functionality
    const microphoneBtn = document.getElementById('microphoneBtn');
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

                        // Create WhatsApp-style voice message
                        const audio = new Audio(audioUrl);
                        let duration = 0;
                        let isPlaying = false;
                        let playbackSpeed = 1;

                        audio.addEventListener('loadedmetadata', function () {
                            duration = audio.duration;
                            updateDurationDisplay();
                        });

                        audio.addEventListener('timeupdate', function () {
                            updateDurationDisplay();
                        });

                        audio.addEventListener('ended', function () {
                            isPlaying = false;
                            updatePlayButton();
                        });

                        const msgRow = document.createElement('div');
                        msgRow.className = 'msg-row right';

                        const avatar = document.createElement('div');
                        avatar.className = 'avatar';
                        const avatarImg = document.createElement('img');
                        avatarImg.src = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=faces';
                        avatarImg.alt = 'Admin';
                        avatar.appendChild(avatarImg);

                        const bubble = document.createElement('div');
                        bubble.className = 'bubble user';

                        const voiceContainer = document.createElement('div');
                        voiceContainer.className = 'voice-message-container';

                        // Play button
                        const playBtn = document.createElement('button');
                        playBtn.className = 'voice-message-play-btn';
                        playBtn.innerHTML = '<i class="fas fa-play"></i>';
                        playBtn.addEventListener('click', function () {
                            if (isPlaying) {
                                audio.pause();
                                isPlaying = false;
                            } else {
                                audio.play();
                                isPlaying = true;
                            }
                            updatePlayButton();
                        });

                        // Content wrapper
                        const contentWrapper = document.createElement('div');
                        contentWrapper.className = 'voice-message-content';

                        // Waveform
                        const waveform = document.createElement('div');
                        waveform.className = 'voice-message-waveform';
                        for (let i = 0; i < 40; i++) {
                            const bar = document.createElement('div');
                            bar.className = 'waveform-bar';
                            const randomHeight = Math.random() * 16 + 8;
                            bar.style.height = randomHeight + 'px';
                            waveform.appendChild(bar);
                        }

                        // Info bar
                        const infoBar = document.createElement('div');
                        infoBar.className = 'voice-message-info';

                        const durationDisplay = document.createElement('span');
                        durationDisplay.className = 'voice-message-duration';
                        durationDisplay.textContent = '0:00';

                        const speedBtn = document.createElement('div');
                        speedBtn.className = 'voice-message-speed';
                        speedBtn.textContent = '1x';
                        speedBtn.style.position = 'relative';

                        const speedMenu = document.createElement('div');
                        speedMenu.className = 'voice-message-speed-menu';
                        const speeds = ['0.5x', '1x', '1.5x', '2x'];
                        speeds.forEach(speed => {
                            const option = document.createElement('div');
                            option.className = 'voice-message-speed-option';
                            if (speed === '1x') option.classList.add('active');
                            option.textContent = speed;
                            option.addEventListener('click', function (e) {
                                e.stopPropagation();
                                playbackSpeed = parseFloat(speed);
                                audio.playbackRate = playbackSpeed;
                                speedBtn.textContent = speed;
                                speedMenu.classList.remove('active');
                                speedMenu.querySelectorAll('.voice-message-speed-option').forEach(opt => {
                                    if (opt.textContent === speed) {
                                        opt.classList.add('active');
                                    } else {
                                        opt.classList.remove('active');
                                    }
                                });
                            });
                            speedMenu.appendChild(option);
                        });

                        speedBtn.appendChild(speedMenu);
                        speedBtn.addEventListener('click', function (e) {
                            e.stopPropagation();
                            speedMenu.classList.toggle('active');
                        });

                        function updatePlayButton() {
                            if (isPlaying) {
                                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                                waveform.querySelectorAll('.waveform-bar').forEach((bar, index) => {
                                    bar.style.animationPlayState = 'running';
                                    const delay = (index % 4) * 0.1;
                                    bar.style.animationDelay = delay + 's';
                                });
                            } else {
                                playBtn.innerHTML = '<i class="fas fa-play"></i>';
                                waveform.querySelectorAll('.waveform-bar').forEach(bar => {
                                    bar.style.animationPlayState = 'paused';
                                });
                            }
                        }

                        function updateDurationDisplay() {
                            const current = audio.currentTime || 0;
                            const total = duration || 0;
                            const currentMins = Math.floor(current / 60);
                            const currentSecs = Math.floor(current % 60);
                            const totalMins = Math.floor(total / 60);
                            const totalSecs = Math.floor(total % 60);
                            durationDisplay.textContent = `${currentMins}:${currentSecs.toString().padStart(2, '0')} / ${totalMins}:${totalSecs.toString().padStart(2, '0')}`;
                        }

                        infoBar.appendChild(durationDisplay);
                        infoBar.appendChild(speedBtn);

                        contentWrapper.appendChild(waveform);
                        contentWrapper.appendChild(infoBar);

                        voiceContainer.appendChild(playBtn);
                        voiceContainer.appendChild(contentWrapper);

                        bubble.appendChild(voiceContainer);

                        msgRow.appendChild(bubble);
                        msgRow.appendChild(avatar);

                        messagesContainer.appendChild(msgRow);
                        scrollToBottom();

                        // Close speed menu when clicking outside
                        document.addEventListener('click', function closeSpeedMenu(e) {
                            if (!speedBtn.contains(e.target)) {
                                speedMenu.classList.remove('active');
                                document.removeEventListener('click', closeSpeedMenu);
                            }
                        });

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
                    microphoneBtn.title = 'Voice message';

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
    const attachmentBtn = document.getElementById('attachmentBtn');
    const fileInput = document.getElementById('fileInput');

    if (attachmentBtn && fileInput) {
        attachmentBtn.addEventListener('click', function () {
            fileInput.click();
        });

        fileInput.addEventListener('change', function (e) {
            const files = e.target.files;
            if (files.length > 0) {
                Array.from(files).forEach(file => {
                    // Create message with attachment
                    const msgRow = document.createElement('div');
                    msgRow.className = 'msg-row right';

                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    const avatarImg = document.createElement('img');
                    avatarImg.src = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=faces';
                    avatarImg.alt = 'Admin';
                    avatar.appendChild(avatarImg);

                    const bubble = document.createElement('div');
                    bubble.className = 'bubble user';

                    // File icon and info
                    const fileInfo = document.createElement('div');
                    fileInfo.style.display = 'flex';
                    fileInfo.style.alignItems = 'center';
                    fileInfo.style.gap = '10px';

                    const fileIcon = document.createElement('i');
                    fileIcon.className = 'fas fa-paperclip';
                    fileIcon.style.fontSize = '1.2rem';
                    fileIcon.style.color = 'var(--primary)';

                    const fileName = document.createElement('span');
                    fileName.textContent = file.name;
                    fileName.style.fontWeight = '600';

                    const fileSize = document.createElement('span');
                    fileSize.style.fontSize = '0.85rem';
                    fileSize.style.color = 'var(--muted)';
                    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
                    fileSize.textContent = `(${sizeInMB} MB)`;

                    fileInfo.appendChild(fileIcon);
                    fileInfo.appendChild(fileName);
                    fileInfo.appendChild(fileSize);

                    // Download/view button
                    const downloadBtn = document.createElement('button');
                    downloadBtn.className = 'action-btn';
                    downloadBtn.style.marginTop = '8px';
                    downloadBtn.style.padding = '6px 12px';
                    downloadBtn.style.fontSize = '0.85rem';
                    downloadBtn.textContent = 'View File';
                    downloadBtn.addEventListener('click', function () {
                        const fileUrl = URL.createObjectURL(file);
                        window.open(fileUrl, '_blank');
                    });

                    bubble.appendChild(fileInfo);
                    bubble.appendChild(downloadBtn);

                    msgRow.appendChild(bubble);
                    msgRow.appendChild(avatar);

                    messagesContainer.appendChild(msgRow);
                    scrollToBottom();
                });

                // Reset file input
                fileInput.value = '';
            }
        });
    }

    // Event listeners
    sendMessageBtn.addEventListener('click', sendMessage);

    messageInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Initial scroll to bottom
    scrollToBottom();
})();

// ============================================================================
// Thread View Functions (moved from admin_base.html)
// ============================================================================

// Full-page thread view (Admin - read/monitor)
function openThread(threadId) {
    const mockThreads = {
        1: {
            subject: 'Question about Research Paper Assignment',
            type: 'assignment',
            assignment: 'ASG-2025-001',
            participants: [
                { role: 'student', name: 'Alex Johnson' },
                { role: 'teacher', name: 'Dr. Sarah Chen' }
            ],
            messages: [
                { role: 'student', name: 'Alex Johnson', content: 'Can you clarify the citation format for this assignment?', time: 'Jan 15, 10:30 AM' },
                { role: 'teacher', name: 'Dr. Sarah Chen', content: 'Use APA 7th edition. I will attach a template.', time: 'Jan 15, 10:35 AM' }
            ]
        },
        2: {
            subject: 'Payment Issue - Invoice INV-2025-045',
            type: 'invoice',
            invoice: 'INV-2025-045',
            participants: [
                { role: 'student', name: 'Emma Wilson' },
                { role: 'cs_rep', name: 'John Smith' }
            ],
            messages: [
                { role: 'student', name: 'Emma Wilson', content: 'Payment gateway keeps timing out.', time: 'Jan 14, 6:00 PM' },
                { role: 'cs_rep', name: 'John Smith', content: 'Trying alternate processor now. I will update you shortly.', time: 'Jan 14, 6:05 PM' }
            ]
        },
        3: {
            subject: 'Student Assignment Progress Update',
            type: 'general',
            participants: [
                { role: 'cs_rep', name: 'Emma Wilson' },
                { role: 'teacher', name: 'Dr. Michael Johnson' }
            ],
            messages: [
                { role: 'cs_rep', name: 'Emma Wilson', content: 'How is Alex Johnson progressing?', time: 'Jan 15, 8:00 AM' },
                { role: 'teacher', name: 'Dr. Michael Johnson', content: '60% done, on track for tomorrow.', time: 'Jan 15, 8:15 AM' }
            ]
        }
    };

    const data = mockThreads[threadId];
    if (!data) return;

    const subjectEl = document.getElementById('adminThreadViewSubject');
    const typeBadge = document.getElementById('adminThreadViewType');
    if (subjectEl) subjectEl.textContent = data.subject;
    if (typeBadge) {
        typeBadge.textContent = data.type.charAt(0).toUpperCase() + data.type.slice(1);
        typeBadge.className = 'thread-type-badge ' + data.type;
    }

    const assignmentLink = document.getElementById('adminThreadViewAssignment');
    if (assignmentLink) {
        if (data.assignment) {
            assignmentLink.style.display = 'inline-flex';
            const span = assignmentLink.querySelector('span');
            if (span) span.textContent = data.assignment;
        } else {
            assignmentLink.style.display = 'none';
        }
    }

    const invoiceLink = document.getElementById('adminThreadViewInvoice');
    if (invoiceLink) {
        if (data.invoice) {
            invoiceLink.style.display = 'inline-flex';
            const span = invoiceLink.querySelector('span');
            if (span) span.textContent = data.invoice;
        } else {
            invoiceLink.style.display = 'none';
        }
    }

    const participantsEl = document.getElementById('adminThreadViewParticipants');
    if (participantsEl) {
        participantsEl.innerHTML = data.participants.map(p =>
            `<span class="participant-badge ${p.role}">${p.name} (${p.role === 'cs_rep' ? 'CS Rep' : p.role === 'teacher' ? 'Teacher' : 'Student'})</span>`
        ).join('');
    }

    const msgs = document.getElementById('adminThreadViewMessages');
    if (msgs) {
        msgs.innerHTML = data.messages.map(m => `
            <div class="thread-message ${m.role === 'admin' ? 'outbound' : 'inbound'}">
                <div class="message-header">
                    <span class="message-sender">${m.name}</span>
                    <span class="message-role">${m.role === 'cs_rep' ? 'CS Rep' : m.role === 'teacher' ? 'Teacher' : m.role === 'admin' ? 'Admin' : 'Student'}</span>
                    <span class="message-time">${m.time}</span>
                </div>
                <div class="message-content">${m.content}</div>
            </div>
        `).join('');
        msgs.scrollTop = msgs.scrollHeight;
    }

    const threadsList = document.getElementById('adminThreadsList');
    const detailView = document.getElementById('adminThreadDetailView');
    if (threadsList) threadsList.style.display = 'none';
    if (detailView) detailView.style.display = 'block';
    const empty = document.getElementById('noAdminThreadsMessage');
    if (empty) empty.style.display = 'none';
}

function showAdminThreadList() {
    const detailView = document.getElementById('adminThreadDetailView');
    const threadsList = document.getElementById('adminThreadsList');
    if (detailView) detailView.style.display = 'none';
    if (threadsList) threadsList.style.display = 'grid';
}

function sendAdminThreadReply() {
    const input = document.getElementById('adminThreadReplyInput');
    const message = input ? input.value.trim() : '';
    if (!message) {
        alert('Please enter a message');
        return;
    }
    const msgs = document.getElementById('adminThreadViewMessages');
    if (msgs) {
        const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        msgs.insertAdjacentHTML('beforeend', `
            <div class="thread-message outbound">
                <div class="message-header">
                    <span class="message-sender">You</span>
                    <span class="message-role">Admin</span>
                    <span class="message-time">${now}</span>
                </div>
                <div class="message-content">${message}</div>
            </div>
        `);
        msgs.scrollTop = msgs.scrollHeight;
    }
    if (input) input.value = '';
}

// Create Thread Modal Functions
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

function submitCreateThread() {
    if (window.StudyThreads && typeof window.StudyThreads.submitCreateThread === 'function') {
        window.StudyThreads.submitCreateThread();
    }
}

// Handle thread type change in create modal
document.addEventListener('DOMContentLoaded', function () {
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

    // Close modal on overlay click
    const createModal = document.getElementById('createThreadModal');
    if (createModal) {
        createModal.addEventListener('click', function (e) {
            if (e.target === createModal) {
                closeCreateThreadModal();
            }
        });
    }
});

// Note: Admin profile initialization is handled in initializeAdminDashboard()
// which is called on DOMContentLoaded via initializeAdminProfile()

// Export functions for use in HTML
window.switchFeedbackReportsTab = switchFeedbackReportsTab;
window.filterFeedbackReports = filterFeedbackReports;
window.viewFeedback = viewFeedback;
window.viewReport = viewReport;
window.closeViewFeedbackReportModal = closeViewFeedbackReportModal;
window.markAsReadAndClose = markAsReadAndClose;
window.markFeedbackRead = markFeedbackRead;
// ============================================================================
// Admin Messages User Dropdown Functionality
// ============================================================================

function initializeAdminUserDropdown() {
    // Get references to messages elements
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInput = document.getElementById('messageInput');
    const threadHeaderName = document.getElementById('threadHeaderName');

    if (!messagesContainer) return;
    const dropdownToggle = document.getElementById('userDropdownToggle');
    const dropdownMenu = document.getElementById('userDropdownMenu');
    const dropdownWrapper = document.querySelector('.user-dropdown-wrapper');
    const searchInput = document.getElementById('userSearchInput');
    const userTabs = document.querySelectorAll('.user-tab');
    const userItems = document.querySelectorAll('.user-dropdown-item');

    if (!dropdownToggle || !dropdownMenu) return;

    let currentTab = 'all';
    let searchTerm = '';

    // Toggle dropdown
    dropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdownMenu.style.display !== 'none';
        dropdownMenu.style.display = isOpen ? 'none' : 'block';
        dropdownWrapper.classList.toggle('active', !isOpen);

        if (!isOpen && searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdownWrapper.contains(e.target)) {
            dropdownMenu.style.display = 'none';
            dropdownWrapper.classList.remove('active');
            if (searchInput) {
                searchInput.value = '';
                searchTerm = '';
                filterUsers();
            }
        }
    });

    // Tab switching
    userTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            userTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            filterUsers();
        });
    });

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value.toLowerCase();
            filterUsers();
        });
    }

    // User selection
    userItems.forEach(item => {
        item.addEventListener('click', () => {
            const userId = item.dataset.userId;
            const userName = item.dataset.name;
            const userEmail = item.dataset.email;
            const userRole = item.dataset.role;
            const userAvatar = item.dataset.avatar;
            const userType = item.dataset.userType;

            selectUserForMessage(userId, userName, userEmail, userRole, userAvatar, userType);

            // Close dropdown
            dropdownMenu.style.display = 'none';
            dropdownWrapper.classList.remove('active');
            if (searchInput) {
                searchInput.value = '';
                searchTerm = '';
            }
            filterUsers();
        });
    });

    // Filter users based on tab and search
    function filterUsers() {
        userItems.forEach(item => {
            const userType = item.dataset.userType;
            const name = item.dataset.name.toLowerCase();
            const email = item.dataset.email.toLowerCase();
            const role = item.dataset.role.toLowerCase();

            // Check tab filter
            let tabMatch = false;
            if (currentTab === 'all') {
                tabMatch = true;
            } else if (currentTab === 'students' && userType === 'student') {
                tabMatch = true;
            } else if (currentTab === 'teachers' && userType === 'teacher') {
                tabMatch = true;
            } else if (currentTab === 'csreps' && userType === 'csrep') {
                tabMatch = true;
            }

            // Check search filter
            const searchMatch = !searchTerm ||
                name.includes(searchTerm) ||
                email.includes(searchTerm) ||
                role.includes(searchTerm);

            // Show/hide item
            if (tabMatch && searchMatch) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
    }
}

// Select user for messaging
function selectUserForMessage(userId, userName, userEmail, userRole, userAvatar, userType) {
    // Create contact ID from name
    const contactId = userName.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '');

    // Check if thread item exists, if not create it
    let threadItem = document.querySelector(`.thread-item[data-contact="${contactId}"]`);
    if (!threadItem) {
        threadItem = createAdminThreadItem(userId, userName, userRole, userAvatar, userType, contactId);
        const chatColumn = document.querySelector('.chat-column');
        if (chatColumn) {
            const searchBox = chatColumn.querySelector('.search-box');
            const threadList = chatColumn.querySelector('.thread-item')?.parentElement || chatColumn;
            if (searchBox && searchBox.nextElementSibling) {
                searchBox.nextElementSibling.insertAdjacentElement('afterend', threadItem);
            } else {
                threadList.appendChild(threadItem);
            }
        }
    }

    // Update active state
    document.querySelectorAll('.thread-item').forEach(item => {
        item.classList.remove('active');
    });
    threadItem.classList.add('active');

    // Update thread header
    const threadHeaderName = document.getElementById('threadHeaderName');
    if (threadHeaderName) {
        threadHeaderName.textContent = userName;
    }

    // Try to use existing switchContact function if available
    // Otherwise, manually switch contact
    const contactItem = document.querySelector(`[data-contact="${contactId}"]`);
    if (contactItem) {
        // Update active states
        document.querySelectorAll('.thread-item').forEach(item => {
            item.classList.remove('active');
        });
        contactItem.classList.add('active');

        // Load conversation
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            // Access conversations from global scope
            const conversations = window.adminConversations || {};
            if (!conversations[contactId]) {
                conversations[contactId] = [];
            }
            window.adminConversations = conversations;

            // Update current contact
            window.currentAdminContact = contactId;

            // Load and display messages
            const conversation = conversations[contactId] || [];
            messagesContainer.innerHTML = '';

            if (conversation.length === 0) {
                messagesContainer.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--muted);">
                        <i class="fas fa-comments" style="font-size: 2rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                `;
            } else {
                conversation.forEach(msg => {
                    const msgRow = createAdminMessageElement(msg.message, msg.isUser, userAvatar);
                    messagesContainer.appendChild(msgRow);
                });
            }

            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // Update message input placeholder
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.placeholder = `Type a message to ${userName}...`;
    }
}

// Create thread item for admin
function createAdminThreadItem(userId, userName, userRole, userAvatar, userType, contactId) {
    const threadItem = document.createElement('div');
    threadItem.className = 'thread-item';
    threadItem.dataset.contact = contactId;
    threadItem.dataset.name = userName;
    threadItem.dataset.role = userRole;
    threadItem.dataset.userId = userId;
    threadItem.dataset.avatar = userAvatar;

    // Determine pill class and text based on user type
    let pillClass = '';
    let pillText = '';
    if (userType === 'student') {
        pillClass = '';
        pillText = 'S';
    } else if (userType === 'teacher') {
        pillClass = 'teacher';
        pillText = 'T';
    } else if (userType === 'csrep') {
        pillClass = 'cs-rep';
        pillText = 'CS';
    }

    threadItem.innerHTML = `
        <div class="avatar">
            <img src="${userAvatar}" alt="${userName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="avatar-fallback" style="display: none;">${userName.split(' ').map(n => n[0]).join('')}</div>
        </div>
        <div class="meta">
            <span class="name">${userName}</span>
            <span class="role">${userRole}</span>
        </div>
        <span class="pill ${pillClass}">${pillText}</span>
    `;

    // Add click handler
    threadItem.style.cursor = 'pointer';
    threadItem.addEventListener('click', function () {
        selectUserForMessage(userId, userName, '', userRole, userAvatar, userType);
    });

    return threadItem;
}

// Create message element for admin messages
function createAdminMessageElement(message, isUser = false, contactAvatar = null) {
    const msgRow = document.createElement('div');
    msgRow.className = 'msg-row' + (isUser ? ' right' : '');

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    const avatarImg = document.createElement('img');
    if (isUser) {
        // Admin's avatar
        avatarImg.src = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=faces';
        avatarImg.alt = 'Admin';
    } else {
        // Contact's avatar
        avatarImg.src = contactAvatar || 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=80&h=80&fit=crop&crop=faces';
        avatarImg.alt = 'Contact';
    }
    avatar.appendChild(avatarImg);

    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + (isUser ? 'user' : 'admin');
    bubble.textContent = message;

    if (isUser) {
        msgRow.appendChild(bubble);
        msgRow.appendChild(avatar);
    } else {
        msgRow.appendChild(avatar);
        msgRow.appendChild(bubble);
    }

    return msgRow;
}

window.markReportRead = markReportRead;
window.updateFeedbackReportsCount = updateFeedbackReportsCount;
window.openThread = openThread;
window.showAdminThreadList = showAdminThreadList;
window.sendAdminThreadReply = sendAdminThreadReply;
window.showCreateThreadModal = showCreateThreadModal;
window.closeCreateThreadModal = closeCreateThreadModal;
window.submitCreateThread = submitCreateThread;
window.initializeAdminUserDropdown = initializeAdminUserDropdown;
window.selectUserForMessage = selectUserForMessage;
window.updateAdminHeaderAvatar = updateAdminHeaderAvatar;
window.updateAdminHeaderName = updateAdminHeaderName;
window.toggleUserStatus = toggleUserStatus;
window.resetUserPassword = resetUserPassword;
window.showPasswordResetFormModal = showPasswordResetFormModal;
window.closePasswordResetFormModal = closePasswordResetFormModal;
window.generateRandomPassword = generateRandomPassword;
window.submitPasswordReset = submitPasswordReset;
window.showPasswordResetModal = showPasswordResetModal;
window.closePasswordResetModal = closePasswordResetModal;
window.copyPasswordToClipboard = copyPasswordToClipboard;
window.deleteUserAccount = deleteUserAccount;
window.chatWithUser = chatWithUser;

// Announcement modal functions
window.openCreateAnnouncementModal = openCreateAnnouncementModal;
window.closeCreateAnnouncementModal = closeCreateAnnouncementModal;
window.toggleSpecificRecipients = toggleSpecificRecipients;
window.switchRecipientTab = switchRecipientTab;
window.filterRecipients = filterRecipients;

// Automatic background refresh for admin dashboard
function initializeAdminAutoRefresh() {
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
        if (!sectionName) return;

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
                console.log(`[Auto-refresh] Refreshing admin ${sectionName} section...`);
                // Clear cache and reload
                if (window.loadedSections && window.loadedSections[sectionName]) {
                    delete window.loadedSections[sectionName];
                }
                await window.showSection(sectionName);
            } catch (error) {
                console.warn(`[Auto-refresh] Failed to refresh ${sectionName}:`, error);
            }
        };

        // Start interval
        autoRefreshInterval = setInterval(refreshCurrentSection, REFRESH_INTERVAL);
        console.log(`[Auto-refresh] Started for admin section: ${sectionName} (every ${REFRESH_INTERVAL/1000}s)`);
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
}
window.clearRecipientSearch = clearRecipientSearch;
window.selectAllInList = selectAllInList;
window.submitAnnouncement = submitAnnouncement;
window.removeAnnouncementTag = removeAnnouncementTag;
window.updateSelectedRecipientsCount = updateSelectedRecipientsCount;
window.loadAnnouncements = loadAnnouncements;
window.confirmDeleteAnnouncement = confirmDeleteAnnouncement;
window.fetchAnnouncementRecipients = fetchAnnouncementRecipients;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdminDashboard);
} else {
    // DOM already loaded, initialize immediately
    initializeAdminDashboard();
}

