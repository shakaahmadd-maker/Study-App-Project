/**
 * Admin Invoice Helper Functions
 * Handle invoice approval and rejection
 */

// Approve invoice request
async function acceptInvoiceRequest(invoiceId) {
    if (typeof apiClient === 'undefined') {
        console.warn('API client not loaded');
        alert('API client not available. Please refresh the page.');
        return false;
    }

    try {
        const success = await approveInvoice(invoiceId);
        if (success) {
            showSuccessMessage('Invoice approved successfully!');

            // Update the row in the table
            const row = document.querySelector(`.invoice-request-row[data-invoice-id="${invoiceId}"]`);
            if (row) {
                row.setAttribute('data-status', 'approved');
                const statusCell = row.querySelector('.invoice-status');
                if (statusCell) {
                    statusCell.innerHTML = '<span class="status-badge completed">Approved</span>';
                }

                // Remove approve/reject buttons
                const actionCell = row.querySelector('.invoice-actions');
                if (actionCell) {
                    actionCell.innerHTML = '<button class="action-btn" onclick="viewInvoice(' + invoiceId + ')">View</button>';
                }
            }

            // Reload pending invoices
            if (typeof loadPendingInvoices === 'function') {
                const invoices = await loadPendingInvoices();
                renderInvoicesTable(invoices, '#invoiceTable');
            }

            return true;
        } else {
            alert('Failed to approve invoice. Please try again.');
            return false;
        }
    } catch (error) {
        console.error('Error approving invoice:', error);
        alert('An error occurred while approving the invoice.');
        return false;
    }
}

// Reject invoice request (not implemented in backend yet, but placeholder)
async function rejectInvoiceRequest(invoiceId) {
    if (!confirm('Are you sure you want to reject this invoice request?')) {
        return false;
    }

    // TODO: Implement reject endpoint in backend
    // For now, just show a message
    alert('Invoice rejection feature - backend endpoint needed');

    // Update the row
    const row = document.querySelector(`.invoice-request-row[data-invoice-id="${invoiceId}"]`);
    if (row) {
        row.setAttribute('data-status', 'rejected');
        const statusCell = row.querySelector('.invoice-status');
        if (statusCell) {
            statusCell.innerHTML = '<span class="status-badge cancelled">Rejected</span>';
        }

        // Remove approve/reject buttons
        const actionCell = row.querySelector('.invoice-actions');
        if (actionCell) {
            actionCell.innerHTML = '<button class="action-btn" onclick="viewInvoice(' + invoiceId + ')">View</button>';
        }
    }

    return false;
}

// Make functions globally available
window.acceptInvoiceRequest = acceptInvoiceRequest;
window.rejectInvoiceRequest = rejectInvoiceRequest;
