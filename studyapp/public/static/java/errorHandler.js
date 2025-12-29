/**
 * Centralized Error Handler
 * Provides consistent error handling and user feedback across the application
 */

class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
    }

    /**
     * Log error for debugging
     */
    logError(error, context = {}) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            error: error.message || String(error),
            stack: error.stack,
            context: context,
            status: error.status,
            data: error.data
        };

        this.errorLog.push(errorEntry);
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }

        console.error('[ErrorHandler]', errorEntry);
    }

    /**
     * Format error message for user display
     */
    formatErrorMessage(error) {
        // Network errors
        if (error.message && error.message.includes('Failed to fetch')) {
            return 'Network error: Please check your internet connection and try again.';
        }

        // API errors
        if (error.data) {
            // Validation errors
            if (error.data.non_field_errors) {
                return error.data.non_field_errors.join(', ');
            }

            // Field-specific errors
            const fieldErrors = [];
            for (const [field, messages] of Object.entries(error.data)) {
                if (Array.isArray(messages)) {
                    fieldErrors.push(`${field}: ${messages.join(', ')}`);
                } else if (typeof messages === 'string') {
                    fieldErrors.push(`${field}: ${messages}`);
                }
            }
            if (fieldErrors.length > 0) {
                return fieldErrors.join('; ');
            }

            // Generic error message
            if (error.data.error) {
                return error.data.error;
            }
            if (error.data.message) {
                return error.data.message;
            }
            if (error.data.detail) {
                return error.data.detail;
            }
        }

        // Status code based messages
        if (error.status === 400) {
            return 'Invalid request. Please check your input and try again.';
        }
        if (error.status === 401) {
            return 'Session expired. Please log in again.';
        }
        if (error.status === 403) {
            return 'You do not have permission to perform this action.';
        }
        if (error.status === 404) {
            return 'The requested resource was not found.';
        }
        if (error.status === 500) {
            return 'Server error. Please try again later or contact support.';
        }

        // Default message
        return error.message || 'An unexpected error occurred. Please try again.';
    }

    /**
     * Show error message to user
     */
    showError(error, context = {}) {
        this.logError(error, context);
        const message = this.formatErrorMessage(error);
        
        // Try to use dashboard-specific error display functions
        if (typeof showErrorMessage === 'function') {
            showErrorMessage(message);
        } else if (typeof showSuccessModal === 'function') {
            showSuccessModal(`Error: ${message}`);
        } else if (typeof showTemporaryMessage === 'function') {
            showTemporaryMessage(`Error: ${message}`);
        } else {
            // Fallback to alert
            alert(`Error: ${message}`);
        }

        return message;
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        if (typeof showSuccessMessage === 'function') {
            showSuccessMessage(message);
        } else if (typeof showSuccessModal === 'function') {
            showSuccessModal(message);
        } else if (typeof showTemporaryMessage === 'function') {
            showTemporaryMessage(message);
        } else {
            console.log('[Success]', message);
        }
    }

    /**
     * Show loading state
     */
    showLoading(element, text = 'Loading...') {
        if (element) {
            const originalText = element.textContent;
            element.dataset.originalText = originalText;
            element.textContent = text;
            element.disabled = true;
            element.classList.add('loading');
        }
    }

    /**
     * Hide loading state
     */
    hideLoading(element) {
        if (element) {
            element.disabled = false;
            element.classList.remove('loading');
            if (element.dataset.originalText) {
                element.textContent = element.dataset.originalText;
                delete element.dataset.originalText;
            }
        }
    }

    /**
     * Validate form fields
     */
    validateForm(form, rules = {}) {
        const errors = {};
        const formData = new FormData(form);

        for (const [field, rule] of Object.entries(rules)) {
            const value = formData.get(field);
            
            if (rule.required && (!value || value.trim() === '')) {
                errors[field] = `${rule.label || field} is required`;
            }

            if (value && rule.email && !this.isValidEmail(value)) {
                errors[field] = `${rule.label || field} must be a valid email address`;
            }

            if (value && rule.minLength && value.length < rule.minLength) {
                errors[field] = `${rule.label || field} must be at least ${rule.minLength} characters`;
            }

            if (value && rule.maxLength && value.length > rule.maxLength) {
                errors[field] = `${rule.label || field} must be no more than ${rule.maxLength} characters`;
            }

            if (value && rule.pattern && !rule.pattern.test(value)) {
                errors[field] = `${rule.label || field} format is invalid`;
            }
        }

        return errors;
    }

    /**
     * Display form validation errors
     */
    displayFormErrors(form, errors) {
        // Clear previous errors
        form.querySelectorAll('.field-error').forEach(el => el.remove());
        form.querySelectorAll('.form-input, .form-textarea, select').forEach(el => {
            el.classList.remove('error');
        });

        // Display new errors
        for (const [field, message] of Object.entries(errors)) {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
                input.classList.add('error');
                const errorDiv = document.createElement('div');
                errorDiv.className = 'field-error';
                errorDiv.textContent = message;
                input.parentNode.insertBefore(errorDiv, input.nextSibling);
            }
        }
    }

    /**
     * Check if email is valid
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Handle API error with retry logic
     */
    async handleApiError(error, retryFn, maxRetries = 3) {
        this.logError(error);

        // Don't retry on client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
            return this.showError(error);
        }

        // Retry on server errors (5xx) or network errors
        for (let i = 0; i < maxRetries; i++) {
            try {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                return await retryFn();
            } catch (retryError) {
                if (i === maxRetries - 1) {
                    return this.showError(retryError);
                }
            }
        }
    }

    /**
     * Get error log for debugging
     */
    getErrorLog() {
        return this.errorLog;
    }

    /**
     * Clear error log
     */
    clearErrorLog() {
        this.errorLog = [];
    }
}

// Create global instance
const errorHandler = new ErrorHandler();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ErrorHandler, errorHandler };
}

