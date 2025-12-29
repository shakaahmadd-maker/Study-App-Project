/**
 * Teacher Profile Management
 * Handles profile form submission, password changes, and profile picture uploads
 */

(function() {
    'use strict';

    // ============================================
    // Utility Functions
    // ============================================

    /**
     * Get CSRF token from hidden input, meta tag, or cookies
     */
    function getCSRFToken() {
        // First, try to get from hidden input field (Django's {% csrf_token %})
        const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
        if (csrfInput && csrfInput.value) {
            return csrfInput.value;
        }
        
        // Second, try meta tag
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) {
            return metaTag.getAttribute('content');
        }
        
        // Third, try to get from cookies (with proper decoding)
        const name = 'csrftoken';
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

    /**
     * Show toast notification (if available) or alert
     */
    function showNotification(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            alert(message);
        }
    }

    /**
     * Validate email format
     */
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // ============================================
    // Profile Picture Handling
    // ============================================

    function initializeProfilePicture() {
        const uploadBtn = document.getElementById('uploadPictureBtn');
        const fileInput = document.getElementById('profilePictureInput');
        const currentPicture = document.getElementById('currentProfilePicture');

        if (!uploadBtn || !fileInput || !currentPicture) return;

        // Open file picker when upload button is clicked
        uploadBtn.addEventListener('click', function() {
            fileInput.click();
        });

        // Handle file selection
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file size (5MB max)
            const maxSize = 5 * 1024 * 1024; // 5MB in bytes
            if (file.size > maxSize) {
                showNotification('File size exceeds 5MB limit. Please choose a smaller image.', 'error');
                fileInput.value = '';
                return;
            }

            // Validate file type
            if (!file.type.startsWith('image/')) {
                showNotification('Please select a valid image file.', 'error');
                fileInput.value = '';
                return;
            }

            // Preview image
            const reader = new FileReader();
            reader.onload = function(e) {
                if (currentPicture.tagName === 'IMG') {
                    currentPicture.src = e.target.result;
                    currentPicture.style.display = 'block';
                } else {
                    // Replace placeholder with image
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.alt = 'Profile Picture';
                    img.id = 'currentProfilePicture';
                    img.className = 'profile-picture-img';
                    currentPicture.parentNode.replaceChild(img, currentPicture);
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // ============================================
    // Profile Form Handling
    // ============================================

    /**
     * Save profile changes
     */
    async function saveProfileChanges() {
        const form = document.getElementById('profileForm');
        if (!form) {
            showNotification('Profile form not found.', 'error');
            return;
        }

        // Validate required fields
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();

        if (!firstName || !lastName || !email) {
            showNotification('Please fill in all required fields (First Name, Last Name, Email).', 'error');
            return;
        }

        if (!isValidEmail(email)) {
            showNotification('Please enter a valid email address.', 'error');
            return;
        }

        // Build FormData
        const formData = new FormData();
        formData.append('first_name', firstName);
        formData.append('last_name', lastName);
        formData.append('email', email);

        // Phone field (optional)
        const phone = document.getElementById('teacherPhone').value.trim();
        if (phone) formData.append('phone', phone);

        // Professional information fields (optional)
        const title = document.getElementById('teacherTitle').value.trim();
        if (title) formData.append('title', title);

        const degree = document.getElementById('teacherDegree').value.trim();
        if (degree) formData.append('qualifications', degree);

        const subject = document.getElementById('teacherSubject').value.trim();
        if (subject) formData.append('primary_subject', subject);

        const experience = document.getElementById('teacherExperience').value.trim();
        if (experience) formData.append('years_of_experience', experience);

        const bio = document.getElementById('teacherBio').value.trim();
        if (bio) formData.append('bio', bio);

        // Profile picture
        const profilePictureInput = document.getElementById('profilePictureInput');
        if (profilePictureInput && profilePictureInput.files.length > 0) {
            formData.append('profile_picture', profilePictureInput.files[0]);
        }

        // Get CSRF token BEFORE disabling button
        const csrftoken = getCSRFToken();
        if (!csrftoken) {
            showNotification('CSRF token not found. Please refresh the page and try again.', 'error');
            return;
        }

        // Append CSRF token to FormData (Django also checks form data)
        formData.append('csrfmiddlewaretoken', csrftoken);

        // Disable save button during submission
        const saveBtn = document.getElementById('saveProfileBtn');
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const response = await fetch('/account/api/accounts/profile/', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'X-CSRFToken': csrftoken
                    // Don't set Content-Type for FormData - browser will set it with boundary
                },
                body: formData
            });

            // Check if response is OK
            if (!response.ok) {
                // Try to parse as JSON first
                let errorMessage = `Server error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    // If not JSON, it's probably an HTML error page
                    if (response.status === 403) {
                        errorMessage = 'Access forbidden. Please refresh the page and try again.';
                    } else {
                        errorMessage = `Server error: ${response.status}. Please try again.`;
                    }
                }
                showNotification('Error: ' + errorMessage, 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
                return;
            }

            const data = await response.json();

            if (data.success) {
                showNotification('Profile updated successfully!', 'success');
                // Reload the page to show updated data
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                showNotification('Error: ' + (data.error || 'Failed to update profile'), 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showNotification('An error occurred while updating your profile. Please try again.', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }

    /**
     * Reset profile form
     */
    function resetProfileForm() {
        if (confirm('Are you sure you want to discard all changes?')) {
            window.location.reload();
        }
    }

    // ============================================
    // Password Change Handling
    // ============================================

    /**
     * Toggle password change form visibility
     */
    function toggleChangePasswordForm() {
        const container = document.getElementById('changePasswordFormContainer');
        const toggleBtn = document.getElementById('changePasswordToggleBtn');
        
        if (!container || !toggleBtn) return;

        const isVisible = container.style.display !== 'none';
        container.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            // Reset form when opening
            document.getElementById('changePasswordForm').reset();
            document.getElementById('passwordMatchIndicator').style.display = 'none';
        }
    }

    /**
     * Toggle password visibility
     */
    function togglePasswordVisibility(inputId, button) {
        const input = document.getElementById(inputId);
        if (!input) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        
        const icon = button.querySelector('i');
        if (icon) {
            icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
        }
    }

    /**
     * Check if passwords match
     */
    function checkPasswordMatch() {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const indicator = document.getElementById('passwordMatchIndicator');

        if (!indicator) return;

        if (confirmPassword && newPassword === confirmPassword) {
            indicator.style.display = 'flex';
            indicator.className = 'password-match-indicator success';
        } else {
            indicator.style.display = 'none';
        }
    }

    /**
     * Handle password change form submission
     */
    async function handlePasswordChange(e) {
        e.preventDefault();

        const form = document.getElementById('changePasswordForm');
        if (!form) return;

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            showNotification('Please fill in all password fields.', 'error');
            return;
        }

        if (newPassword.length < 8) {
            showNotification('New password must be at least 8 characters long.', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showNotification('New passwords do not match.', 'error');
            return;
        }

        // Disable submit button
        const submitBtn = document.getElementById('submitPasswordChangeBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

        try {
            const csrftoken = getCSRFToken();
            const response = await fetch('/account/api/accounts/change-password/', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken || ''
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                showNotification('Password changed successfully!', 'success');
                form.reset();
                document.getElementById('passwordMatchIndicator').style.display = 'none';
                toggleChangePasswordForm();
            } else {
                showNotification('Error: ' + (data.error || 'Failed to change password'), 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        } catch (error) {
            console.error('Error changing password:', error);
            showNotification('An error occurred while changing your password. Please try again.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    /**
     * Cancel password change
     */
    function cancelPasswordChange() {
        const form = document.getElementById('changePasswordForm');
        if (form) {
            form.reset();
            document.getElementById('passwordMatchIndicator').style.display = 'none';
        }
        toggleChangePasswordForm();
    }

    // ============================================
    // Event Listeners Setup
    // ============================================

    function initializeEventListeners() {
        // Profile form
        const saveBtn = document.getElementById('saveProfileBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', saveProfileChanges);
        }

        const cancelBtn = document.getElementById('cancelProfileBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', resetProfileForm);
        }

        // Password change form
        const passwordToggleBtn = document.getElementById('changePasswordToggleBtn');
        if (passwordToggleBtn) {
            passwordToggleBtn.addEventListener('click', toggleChangePasswordForm);
        }

        const passwordForm = document.getElementById('changePasswordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', handlePasswordChange);
        }

        const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
        if (cancelPasswordBtn) {
            cancelPasswordBtn.addEventListener('click', cancelPasswordChange);
        }

        // Password visibility toggles
        const passwordToggleButtons = document.querySelectorAll('.password-toggle-btn');
        passwordToggleButtons.forEach(button => {
            const targetId = button.getAttribute('data-target');
            if (targetId) {
                button.addEventListener('click', function() {
                    togglePasswordVisibility(targetId, button);
                });
            }
        });

        // Password match checking
        const newPasswordInput = document.getElementById('newPassword');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        if (newPasswordInput && confirmPasswordInput) {
            newPasswordInput.addEventListener('input', checkPasswordMatch);
            confirmPasswordInput.addEventListener('input', checkPasswordMatch);
        }
    }

    // ============================================
    // Initialize on DOM Ready
    // ============================================

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                initializeProfilePicture();
                initializeEventListeners();
            });
        } else {
            initializeProfilePicture();
            initializeEventListeners();
        }
    }

    // Expose functions globally for backward compatibility
    window.saveProfileChanges = saveProfileChanges;
    window.resetProfileForm = resetProfileForm;
    window.toggleChangePasswordForm = toggleChangePasswordForm;
    window.togglePasswordVisibility = togglePasswordVisibility;
    window.cancelChangePassword = cancelPasswordChange;

    // Initialize
    init();

})();

