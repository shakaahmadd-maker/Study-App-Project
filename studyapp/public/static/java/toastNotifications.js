/**
 * Toast Notification System
 * Handles toast notifications for meeting events
 */

// Prevent redeclaration if script is loaded multiple times
if (typeof ToastNotifications === 'undefined') {
    window.ToastNotifications = class ToastNotifications {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.init();
    }

    init() {
        // Create toast container if it doesn't exist
        if (!document.getElementById('toastContainer')) {
            this.container = document.createElement('div');
            this.container.id = 'toastContainer';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toastContainer');
        }
    }

    show(message, type = 'info', duration = 3000) {
        const toast = this.createToast(message, type);
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(toast);
            }, duration);
        }

        return toast;
    }

    createToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');

        const icons = {
            info: 'fa-circle-info',
            success: 'fa-circle-check',
            warning: 'fa-triangle-exclamation',
            error: 'fa-circle-xmark'
        };

        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${icons[type] || icons.info}"></i>
                <span class="toast-message">${this.sanitize(message)}</span>
            </div>
            <button class="toast-close" onclick="toastNotifications.dismiss(this.parentElement)" aria-label="Close notification">
                <i class="fas fa-times"></i>
            </button>
        `;

        return toast;
    }

    dismiss(toast) {
        if (!toast || !toast.parentElement) return;
        
        toast.classList.add('dismissing');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
        }, 300);
    }

    sanitize(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Convenience methods
    info(message, duration) {
        return this.show(message, 'info', duration);
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }
    };
} else {
    // Use existing class if already declared
    window.ToastNotifications = ToastNotifications;
}

// Global instance - only create if it doesn't exist
if (typeof toastNotifications === 'undefined') {
    window.toastNotifications = new window.ToastNotifications();
} else {
    window.toastNotifications = toastNotifications;
}


