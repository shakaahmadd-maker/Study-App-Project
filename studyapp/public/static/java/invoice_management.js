/**
 * Invoice Management JS
 * Handles Admin, Student, and CS-Rep invoice workflows.
 * Wrapped in an IIFE to prevent identifier collisions on re-load.
 */

(function() {
    // --- Shared Persistence ---
    // Ensure global persistence across script re-loads for state
    if (typeof window.currentRequestId === 'undefined') {
        window.currentRequestId = null;
    }

    // Local variable inside IIFE scope (shadows window.currentRequestId)
    let currentRequestId = window.currentRequestId;

    function setCurrentRequestId(val) {
        currentRequestId = val;
        window.currentRequestId = val;
    }

    // --- Shared Utilities ---

    async function fetchAPI(url, options = {}) {
        console.log(`fetchAPI calling: ${url}`, options);
        try {
            const csrfToken = getCookie('csrftoken');
            if (!csrfToken) {
                console.error('CSRF token not found');
                return { success: false, message: 'CSRF token not found. Please refresh the page and try again.' };
            }

            const response = await fetch(url, {
                ...options,
                headers: {
                    'X-CSRFToken': csrfToken,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Server error for ${url}:`, response.status, errorText);
                return { success: false, message: `Server error: ${response.status}. Please try again.` };
            }

            const data = await response.json();
            console.log(`fetchAPI response from ${url}:`, data);
            return data;
        } catch (error) {
            console.error(`fetchAPI error for ${url}:`, error);
            return { success: false, message: 'Network error or invalid response.' };
        }
    }

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

    /**
     * Robust notification wrapper
     * Uses 'notify' internally to avoid conflict with window.showToast
     */
    function notify(message, type = 'success') {
        // 1. Try the role-specific notification system first (common in this app)
        if (typeof window.showToastNotification === 'function') {
            window.showToastNotification(message, type);
            return;
        } 
        
        // 2. Try the global dashboard toast system
        // CRITICAL: Only call if it's not THIS function to prevent infinite loop
        if (typeof window.showToast === 'function' && window.showToast !== notify && window.showToast !== window.notify) {
            try {
                window.showToast(message, type);
                return;
            } catch (e) {
                console.error('Error calling window.showToast:', e);
            }
        }
        
        // 3. Fallback to console and alert
        console.log(`[Invoice Notify ${type}] ${message}`);
        if (type === 'error') alert(message);
    }

    // --- Filters ---

    function filterInvoiceRequests() {
        const status = document.getElementById('invoiceRequestFilter').value;
        loadAdminInvoicesWithFilter('request', status);
    }

    function filterInvoiceStatus() {
        const status = document.getElementById('invoiceStatusFilter').value;
        loadAdminInvoicesWithFilter('status', status);
    }

    async function loadAdminInvoicesWithFilter(type, status) {
        if (type === 'request') {
            const data = await fetchAPI(`/invoice/api/list/?status=${status}`);
            // Only show invoices with cs_rep (created by CS-Reps) in requests table
            const requests = (data.invoices || []).filter(inv => inv.cs_rep_name !== null);
            populateInvoiceRequestsTable(requests);
        } else {
            const data = await fetchAPI(`/invoice/api/list/?status=${status}`);
            // Exclude request_pending invoices from status table
            populateInvoiceStatusTable(data.invoices.filter(inv => inv.status !== 'request_pending'));
        }
    }

    async function filterCSRepInvoices(status, btn) {
        const chips = btn.parentElement.querySelectorAll('.filter-chip');
        chips.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        
        const data = await fetchAPI(`/invoice/api/list/?status=${status}`);
        populateCSRepInvoicesTable(data.invoices);
    }

    // --- Admin Invoice Logic ---

    async function loadAdminInvoices() {
        const requestsData = await fetchAPI('/invoice/api/list/?status=request_pending');
        const statusData = await fetchAPI('/invoice/api/list/?status=all'); 
        
        // Only show invoices with cs_rep (created by CS-Reps) in requests table
        const requests = (requestsData.invoices || []).filter(inv => inv.cs_rep_name !== null);
        const allInvoices = statusData.invoices || [];
        // Exclude request_pending invoices from status table (they belong in requests table)
        // This should include all other statuses: pending_payment, payment_review, paid, cancelled
        const activeInvoices = allInvoices.filter(inv => inv.status !== 'request_pending');

        // Update Admin Stats
        const pendingReqEl = document.getElementById('adminPendingRequestsCount');
        const paymentReviewEl = document.getElementById('adminPaymentReviewCount');
        const pendingPayEl = document.getElementById('adminPendingPaymentCount');

        if (pendingReqEl) pendingReqEl.textContent = requests.length;
        if (paymentReviewEl) paymentReviewEl.textContent = activeInvoices.filter(i => i.status === 'payment_review').length;
        if (pendingPayEl) pendingPayEl.textContent = activeInvoices.filter(i => i.status === 'pending_payment').length;

        populateInvoiceRequestsTable(requests);
        populateInvoiceStatusTable(activeInvoices);
    }

    function populateInvoiceRequestsTable(requests) {
        const tbody = document.getElementById('invoiceRequestsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        requests.forEach(req => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600; color: var(--text-main);">${req.student_name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">via ${req.cs_rep_name}</div>
                </td>
                <td><div style="font-size: 0.875rem;">${req.assignment_title}</div></td>
                <td><div style="font-weight: 600;">$${req.charge_amount}</div></td>
                <td><div style="color: #ef4444;">${req.discount_percentage}%</div></td>
                <td><div style="font-weight: 700; color: var(--primary);">$${req.total_payable}</div></td>
                <td>
                    <div class="action-buttons-group">
                        <button class="action-btn accept-btn" onclick="acceptInvoiceRequest('${req.id}')" title="Accept & Create">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-btn delete-btn" onclick="deleteInvoice('${req.id}')" title="Reject/Delete">
                            <i class="fas fa-times"></i>
                        </button>
                        <button class="action-btn view-btn" onclick="viewInvoiceDetails('${req.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function populateInvoiceStatusTable(invoices) {
        const tbody = document.getElementById('invoiceStatusTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        invoices.forEach(inv => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="invoice-code">#${inv.invoice_number}</span></td>
                <td>
                    <div style="font-weight: 600; color: var(--text-main);">${inv.student_name}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">${inv.created_at}</div>
                </td>
                <td><div style="font-weight: 700;">$${inv.total_payable}</div></td>
                <td>
                    ${inv.invoice_link ? `<a href="${inv.invoice_link}" target="_blank" class="status-badge-modern payment_review" style="text-decoration:none; font-size: 0.7rem;"><i class="fas fa-external-link-alt"></i> Link</a>` : '-'}
                </td>
                <td><span class="status-badge-modern ${inv.status}">${inv.status_display}</span></td>
                <td class="text-center">
                    ${inv.has_screenshot ? 
                        `<button class="btn-primary small" onclick="viewInvoiceDetails('${inv.id}')" style="padding: 0.3rem 0.6rem; font-size: 0.7rem;">View Proof</button>` : 
                        '<span style="color: #94a3b8; font-size: 0.75rem;">No Proof</span>'
                    }
                </td>
                <td>
                    <div class="action-buttons-group">
                        <button class="action-btn view-btn" onclick="viewInvoiceDetails('${inv.id}')" title="View Full Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${inv.status === 'pending_payment' ? 
                            `<button class="action-btn chat-btn" onclick="sendInvoiceReminder('${inv.id}')" title="Send Reminder">
                                <i class="fas fa-bell"></i>
                            </button>` : ''
                        }
                        ${inv.status === 'payment_review' ? 
                            `<button class="action-btn accept-btn" onclick="markInvoiceAsPaid('${inv.id}')" title="Verify & Mark Paid">
                                <i class="fas fa-check"></i>
                            </button>` : ''
                        }
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    async function loadStudentsForModal() {
        const data = await fetchAPI('/account/api/admin/list-students/');
        const select = document.getElementById('invoiceStudent');
        if (!select) return;
        select.innerHTML = '<option value="">Select Student</option>';
        data.students.forEach(s => {
            const option = document.createElement('option');
            option.value = s.id;
            option.textContent = `${s.name} (${s.email})`;
            select.appendChild(option);
        });
    }

    async function loadStudentAssignmentsForInvoice(studentId) {
        if (!studentId) return;
        const data = await fetchAPI(`/assingment/api/list/?student_id=${studentId}`);
        const select = document.getElementById('invoiceAssignment');
        select.innerHTML = '<option value="">Select Assignment</option>';
        data.assignments.forEach(a => {
            const option = document.createElement('option');
            option.value = a.id;
            option.textContent = a.title;
            select.appendChild(option);
        });
    }

    function updateDiscountLabels() {
        const typeEl = document.querySelector('input[name="discountType"]:checked');
        const type = typeEl ? typeEl.value : 'amount';
        const label = document.getElementById('discountValueLabel');
        const symbol = document.getElementById('discountSymbol');
        
        if (type === 'percentage') {
            if (label) label.textContent = 'Discount Percentage (%)';
            if (symbol) symbol.textContent = '%';
        } else {
            if (label) label.textContent = 'Discount Amount ($)';
            if (symbol) symbol.textContent = '$';
        }
        calculateInvoiceFromAmount();
    }

    function calculateInvoiceFromAmount() {
        const amountInput = document.getElementById('invoiceAmount');
        const discountInput = document.getElementById('invoiceDiscountValue');
        const totalInput = document.getElementById('invoiceTotalAmount');
        if (!amountInput || !discountInput || !totalInput) return;

        const amount = parseFloat(amountInput.value) || 0;
        const discountVal = parseFloat(discountInput.value) || 0;
        const typeRadio = document.querySelector('input[name="discountType"]:checked');
        const type = typeRadio ? typeRadio.value : 'amount';
        
        let total = amount;
        if (type === 'percentage') {
            total = amount - (amount * discountVal / 100);
        } else {
            total = amount - discountVal;
        }
        
        totalInput.value = Math.max(0, total).toFixed(2);
    }

    function calculateInvoiceFromDiscount() {
        calculateInvoiceFromAmount();
    }

    function openCreateInvoiceModal() {
        const modal = document.getElementById('createInvoiceModal');
        if (modal) modal.style.display = 'flex';
        loadStudentsForModal();
    }

    function closeCreateInvoiceModal() {
        const modal = document.getElementById('createInvoiceModal');
        if (modal) modal.style.display = 'none';
        const form = document.getElementById('createInvoiceForm');
        if (form) form.reset();
        setCurrentRequestId(null);
    }

    async function submitCreateInvoice(event) {
        event.preventDefault();
        const btn = document.getElementById('submitInvoiceBtn');
        if (btn) btn.disabled = true;
        
        const formData = {
            student_id: document.getElementById('invoiceStudent').value,
            assignment_id: document.getElementById('invoiceAssignment').value,
            charge_amount: document.getElementById('invoiceAmount').value,
            discount_type: document.querySelector('input[name="discountType"]:checked').value,
            discount_value: document.getElementById('invoiceDiscountValue').value,
            invoice_link: document.getElementById('invoiceLink').value,
            due_date: document.getElementById('invoiceDueDate').value,
            notes: document.getElementById('invoiceNotes').value,
            request_id: currentRequestId
        };
        
        const result = await fetchAPI('/invoice/api/create/', {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        
        if (result.success) {
            notify('Invoice created and sent successfully.');
            closeCreateInvoiceModal();
            loadAdminInvoices();
        } else {
            notify(result.message || 'Error creating invoice.', 'error');
        }
        if (btn) btn.disabled = false;
    }

    async function viewInvoiceDetails(invoiceId) {
        console.log('viewInvoiceDetails called for ID:', invoiceId);
        try {
            const data = await fetchAPI(`/invoice/api/details/${invoiceId}/`);
            console.log('Invoice details received:', data);
            if (!data.success) {
                notify(data.message || 'Error fetching invoice details.', 'error');
                return;
            }
            
            const inv = data.invoice;
            const setElText = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val || '-';
            };

            const idField = document.getElementById('modalInvoiceIdValue');
            if (idField) idField.value = inv.id;

            const badge = document.getElementById('modalInvoiceBadge');
            if (badge) {
                badge.className = `invoice-badge ${inv.status}`;
                badge.textContent = inv.status_display;
            }

            setElText('modalInvoiceId', inv.invoice_number);
            setElText('modalInvoiceStatus', inv.status_display);
            setElText('modalInvoiceCreated', inv.created_at);
            setElText('modalInvoiceDueDate', inv.due_date);
            setElText('modalInvoiceStudentName', inv.student_name);
            setElText('modalInvoiceStudentEmail', inv.student_email);
            setElText('modalInvoiceStudentId', inv.student_id_code);
            setElText('modalInvoiceAssignmentTitle', inv.assignment_title);
            setElText('modalInvoiceAmount', `$${inv.charge_amount}`);
            setElText('modalInvoiceDiscount', `$${inv.discount_amount}`);
            setElText('modalInvoiceTotalAmount', `$${inv.total_payable}`);
            
            const linkSection = document.getElementById('modalInvoiceLinkSection');
            if (linkSection) {
                if (inv.invoice_link) {
                    linkSection.style.display = 'block';
                    const link = document.getElementById('modalInvoiceLink');
                    if (link) {
                        link.href = inv.invoice_link;
                        link.textContent = inv.invoice_link;
                    }
                } else {
                    linkSection.style.display = 'none';
                }
            }
            
            const csrepSection = document.getElementById('modalInvoiceCSRepSection');
            if (csrepSection) {
                if (inv.cs_rep_name) {
                    csrepSection.style.display = 'block';
                    setElText('modalInvoiceCSRepName', inv.cs_rep_name);
                    setElText('modalInvoiceCSRepEmail', inv.cs_rep_email);
                } else {
                    csrepSection.style.display = 'none';
                }
            }
            
            const notesSection = document.getElementById('modalInvoiceNotesSection');
            if (notesSection) {
                if (inv.notes) {
                    notesSection.style.display = 'block';
                    setElText('modalInvoiceNotes', inv.notes);
                } else {
                    notesSection.style.display = 'none';
                }
            }
            
            const proofSection = document.getElementById('modalInvoiceScreenshotSection');
            if (proofSection) {
                if (inv.has_screenshot) {
                    proofSection.style.display = 'block';
                    const img = document.getElementById('modalInvoiceScreenshot');
                    const download = document.getElementById('modalInvoiceScreenshotDownload');
                    if (img) img.src = inv.screenshot_url;
                    if (download) download.href = inv.screenshot_url;
                } else {
                    proofSection.style.display = 'none';
                }
            }
            
            const markPaidBtn = document.getElementById('modalMarkPaidBtn');
            if (markPaidBtn) {
                if (inv.status === 'payment_review' && window.currentUserRole === 'ADMIN') {
                    markPaidBtn.style.display = 'block';
                    markPaidBtn.onclick = () => markInvoiceAsPaid(inv.id);
                } else {
                    markPaidBtn.style.display = 'none';
                }
            }
            
            const modal = document.getElementById('invoiceDetailsModal');
            if (modal) {
                console.log('Opening invoiceDetailsModal');
                modal.style.display = 'flex';
            } else {
                console.error('Modal element #invoiceDetailsModal not found');
            }
        } catch (error) {
            console.error('Error in viewInvoiceDetails:', error);
            notify('An unexpected error occurred.', 'error');
        }
    }

    function closeInvoiceDetailsModal(event) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        const modal = document.getElementById('invoiceDetailsModal');
        if (modal) modal.style.display = 'none';
    }

    async function acceptInvoiceRequest(requestId) {
        const data = await fetchAPI(`/invoice/api/details/${requestId}/`);
        if (!data.success) return;
        
        const inv = data.invoice;
        setCurrentRequestId(requestId);
        openCreateInvoiceModal();
        
        setTimeout(async () => {
            const studentEl = document.getElementById('invoiceStudent');
            const assignmentEl = document.getElementById('invoiceAssignment');
            const amountEl = document.getElementById('invoiceAmount');
            const discountEl = document.getElementById('invoiceDiscountValue');
            const notesEl = document.getElementById('invoiceNotes');

            if (studentEl) studentEl.value = inv.student_id;
            await loadStudentAssignmentsForInvoice(inv.student_id);
            if (assignmentEl) assignmentEl.value = inv.assignment_id;
            if (amountEl) amountEl.value = inv.charge_amount;
            if (discountEl) discountEl.value = inv.discount_amount;
            if (notesEl) notesEl.value = inv.notes;
            calculateInvoiceFromAmount();
        }, 500);
    }

    async function markInvoiceAsPaid(invoiceId) {
        if (!confirm('Are you sure you want to mark this invoice as paid?')) return;
        const result = await fetchAPI(`/invoice/api/admin/mark-paid/${invoiceId}/`, { method: 'POST' });
        if (result.success) {
            notify('Invoice marked as paid.');
            closeInvoiceDetailsModal();
            loadAdminInvoices();
        } else {
            notify(result.message, 'error');
        }
    }

    function markAsPaidFromModal() {
        const idVal = document.getElementById('modalInvoiceIdValue');
        const val = idVal ? idVal.value : null;
        if (val) markInvoiceAsPaid(val);
    }

    async function deleteInvoice(invoiceId) {
        if (!confirm('Are you sure you want to delete this invoice/request?')) return;
        const result = await fetchAPI(`/invoice/api/admin/delete/${invoiceId}/`, { method: 'POST' });
        if (result.success) {
            notify('Deleted successfully.');
            loadAdminInvoices();
        }
    }

    async function sendInvoiceReminder(invoiceId) {
        const result = await fetchAPI(`/invoice/api/admin/send-reminder/${invoiceId}/`, { method: 'POST' });
        if (result.success) {
            notify('Reminder sent to student.');
        }
    }

    // --- Student Invoice Logic ---

    async function loadStudentInvoices() {
        const data = await fetchAPI('/invoice/api/list/');
        const tbody = document.getElementById('invoicesTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        // Update stats
        const invoices = data.invoices || [];
        const pending = invoices.filter(i => i.status === 'pending_payment').length;
        const paid = invoices.filter(i => i.status === 'paid').length;
        const review = invoices.filter(i => i.status === 'payment_review').length;

        const pendingEl = document.getElementById('pendingInvoicesCount');
        const paidEl = document.getElementById('paidInvoicesCount');
        const reviewEl = document.getElementById('reviewInvoicesCount');

        if (pendingEl) pendingEl.textContent = pending;
        if (paidEl) paidEl.textContent = paid;
        if (reviewEl) reviewEl.textContent = review;

        if (invoices.length === 0) {
            const emptyState = document.getElementById('invoicesEmptyState');
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        const emptyState = document.getElementById('invoicesEmptyState');
        if (emptyState) emptyState.style.display = 'none';
        
        invoices.forEach(inv => {
            const tr = document.createElement('tr');
            const showPayLink = inv.status === 'pending_payment' && inv.invoice_link;
            
            tr.innerHTML = `
                <td><span class="invoice-code">#${inv.invoice_number}</span></td>
                <td>
                    <div style="font-weight: 600; color: var(--text-main);">${inv.assignment_title}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.4rem; margin-top: 0.2rem;">
                        <i class="far fa-calendar-alt"></i> ${inv.created_at}
                    </div>
                </td>
                <td>
                    <div style="font-weight: 700; color: var(--text-main);">$${inv.total_payable}</div>
                    ${showPayLink ? `<a href="${inv.invoice_link}" target="_blank" style="font-size: 0.7rem; color: var(--primary); text-decoration: none; font-weight: 600;"><i class="fas fa-external-link-alt"></i> Pay Online</a>` : ''}
                </td>
                <td><span class="status-badge-modern ${inv.status}">${inv.status_display}</span></td>
                <td>
                    <div style="display: flex; gap: 0.5rem; justify-content: center;">
                        <button class="action-btn view-btn" onclick="viewStudentInvoiceDetails('${inv.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${inv.status === 'pending_payment' ? 
                            `<button class="btn-primary small" onclick="openConfirmPaymentModal('${inv.id}')" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; border-radius: 6px;">Confirm Paid</button>` : 
                            ''
                        }
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    async function viewStudentInvoiceDetails(invoiceId) {
        console.log('viewStudentInvoiceDetails called for ID:', invoiceId);
        try {
            const data = await fetchAPI(`/invoice/api/details/${invoiceId}/`);
            console.log('Student invoice details received:', data);
            if (!data.success) {
                notify(data.message || 'Error fetching invoice details.', 'error');
                return;
            }
            
            const inv = data.invoice;
            
            const badge = document.getElementById('modalInvoiceBadge');
            const title = document.getElementById('modalInvoiceNumberText');
            if (badge) {
                badge.className = `invoice-badge ${inv.status}`;
                badge.textContent = inv.status_display;
            }
            if (title) title.textContent = `#${inv.invoice_number}`;

            const content = document.getElementById('studentInvoiceDetailsContent');
            if (content) {
                content.innerHTML = `
                    <div class="detail-row">
                        <span class="detail-label">Assignment</span>
                        <span class="detail-value">${inv.assignment_title}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Created Date</span>
                        <span class="detail-value">${inv.created_at}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Due Date</span>
                        <span class="detail-value">${inv.due_date || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Charge Amount</span>
                        <span class="detail-value">$${inv.charge_amount}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Discount</span>
                        <span class="detail-value" style="color: #ef4444;">-$${inv.discount_amount} (${inv.discount_percentage}%)</span>
                    </div>
                    <div class="detail-row" style="border-top: 2px solid var(--border-color); padding-top: 1rem; margin-top: 0.5rem;">
                        <span class="detail-label" style="font-weight: 700; color: var(--text-main);">Total Payable</span>
                        <span class="detail-value amount-highlight">$${inv.total_payable}</span>
                    </div>
                    ${inv.notes ? `
                    <div class="detail-row" style="flex-direction: column; align-items: flex-start; gap: 0.5rem;">
                        <span class="detail-label">Notes</span>
                        <div style="background: #f8fafc; padding: 0.75rem; border-radius: 8px; width: 100%; font-size: 0.875rem; color: #475569;">${inv.notes}</div>
                    </div>` : ''}
                    ${inv.invoice_link ? `
                    <div class="detail-row" style="border-bottom: none; padding-top: 1rem;">
                        <a href="${inv.invoice_link}" target="_blank" class="btn-primary-modern" style="width: 100%; justify-content: center; text-decoration: none;">
                            <i class="fas fa-external-link-alt"></i> Pay Online Now
                        </a>
                    </div>` : ''}
                `;
            }
            
            const confirmBtn = document.getElementById('studentConfirmBtn');
            if (confirmBtn) {
                if (inv.status === 'pending_payment') {
                    confirmBtn.style.display = 'block';
                    confirmBtn.onclick = () => {
                        closeStudentInvoiceDetailsModal();
                        openConfirmPaymentModal(inv.id);
                    };
                } else {
                    confirmBtn.style.display = 'none';
                }
            }
            
            const modal = document.getElementById('studentInvoiceDetailsModal');
            if (modal) {
                console.log('Opening studentInvoiceDetailsModal');
                modal.style.display = 'flex';
            } else {
                console.error('Modal element #studentInvoiceDetailsModal not found');
            }
        } catch (error) {
            console.error('Error in viewStudentInvoiceDetails:', error);
            notify('An unexpected error occurred.', 'error');
        }
    }

    function closeStudentInvoiceDetailsModal(event) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        const modal = document.getElementById('studentInvoiceDetailsModal');
        if (modal) modal.style.display = 'none';
    }

    function openConfirmPaymentModal(invoiceId) {
        const idField = document.getElementById('confirmPaymentInvoiceId');
        if (idField) idField.value = invoiceId;
        const modal = document.getElementById('confirmPaymentModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeConfirmPaymentModal() {
        const modal = document.getElementById('confirmPaymentModal');
        if (modal) modal.style.display = 'none';
    }

    async function submitPaymentConfirmation(event) {
        event.preventDefault();
        const invoiceId = document.getElementById('confirmPaymentInvoiceId').value;
        const fileInput = document.getElementById('paymentScreenshot');
        
        if (!invoiceId) {
            notify('Invoice ID is missing. Please try again.', 'error');
            return;
        }
        
        if (fileInput.files.length === 0) {
            notify('Please select a screenshot.', 'error');
            return;
        }
        
        // Get CSRF token
        const csrfToken = getCookie('csrftoken');
        if (!csrfToken) {
            notify('CSRF token not found. Please refresh the page and try again.', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('payment_screenshot', fileInput.files[0]);
        // Add CSRF token to FormData for better compatibility with file uploads
        formData.append('csrfmiddlewaretoken', csrfToken);
        
        try {
            const response = await fetch(`/invoice/api/student/confirm-payment/${invoiceId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken
                },
                body: formData
            });
            
            // Check if response is OK before parsing JSON
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error:', response.status, errorText);
                
                // Try to parse as JSON if possible, otherwise show generic error
                let errorMessage = 'Failed to submit payment proof.';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorMessage;
                } catch (e) {
                    // If it's HTML (403 error page), provide a more helpful message
                    if (response.status === 403) {
                        errorMessage = 'Access forbidden. Please ensure you are logged in and have permission to submit payment proof.';
                    } else {
                        errorMessage = `Server error (${response.status}). Please try again.`;
                    }
                }
                notify(errorMessage, 'error');
                return;
            }
            
            const result = await response.json();
            
            if (result.success) {
                notify('Payment proof submitted successfully. Admin will review it.');
                closeConfirmPaymentModal();
                // Reset form
                fileInput.value = '';
                const fileNameDisplay = document.getElementById('fileNameDisplay');
                if (fileNameDisplay) {
                    fileNameDisplay.textContent = 'Supported: JPG, PNG, WEBP';
                    fileNameDisplay.style.color = '';
                    fileNameDisplay.style.fontWeight = '';
                }
                loadStudentInvoices();
            } else {
                notify(result.message || 'Failed to submit payment proof.', 'error');
            }
        } catch (e) {
            console.error('Error submitting payment confirmation:', e);
            notify('Failed to submit payment proof. Please check your connection and try again.', 'error');
        }
    }

    // --- CS-Rep Invoice Logic ---

    async function loadCSRepInvoices() {
        const data = await fetchAPI('/invoice/api/list/');
        const invoices = data.invoices || [];
        
        // Update CS-Rep Stats
        const pendingEl = document.getElementById('csrepPendingRequestsCount');
        const approvedEl = document.getElementById('csrepApprovedRequestsCount');
        const totalEl = document.getElementById('csrepTotalRequestsCount');

        if (pendingEl) pendingEl.textContent = invoices.filter(i => i.status === 'request_pending').length;
        if (approvedEl) approvedEl.textContent = invoices.filter(i => i.status !== 'request_pending' && i.status !== 'request_rejected').length;
        if (totalEl) totalEl.textContent = invoices.length;

        populateCSRepInvoicesTable(invoices);
    }

    function populateCSRepInvoicesTable(invoices) {
        const tbody = document.getElementById('csrepInvoiceTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        invoices.forEach(inv => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="invoice-code">${inv.invoice_number || 'PENDING'}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">${inv.created_at}</div>
                </td>
                <td><div style="font-weight: 600;">${inv.student_name}</div></td>
                <td><div style="font-size: 0.875rem;">${inv.assignment_title}</div></td>
                <td><div style="font-weight: 600;">$${inv.charge_amount}</div></td>
                <td><div style="color: #ef4444;">${inv.discount_percentage}%</div></td>
                <td><div style="font-weight: 700; color: var(--primary);">$${inv.total_payable}</div></td>
                <td><span class="status-badge-modern ${inv.status}">${inv.status_display}</span></td>
                <td>
                    <button class="action-btn view-btn" onclick="viewInvoiceDetails('${inv.id}')" title="View Request">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    async function loadStudentsForRequest() {
        const data = await fetchAPI('/account/api/admin/list-students/');
        const select = document.getElementById('requestStudent');
        if (!select) return;
        select.innerHTML = '<option value="">Select Student</option>';
        if (data.students) {
            data.students.forEach(s => {
                const option = document.createElement('option');
                option.value = s.id;
                option.textContent = `${s.name} (${s.email})`;
                select.appendChild(option);
            });
        }
    }

    async function loadStudentAssignmentsForRequest(studentId) {
        if (!studentId) return;
        const data = await fetchAPI(`/assingment/api/list/?student_id=${studentId}`);
        const select = document.getElementById('requestAssignment');
        if (!select) return;
        select.innerHTML = '<option value="">Select Assignment</option>';
        if (data.assignments) {
            data.assignments.forEach(a => {
                const option = document.createElement('option');
                option.value = a.id;
                option.textContent = a.title;
                select.appendChild(option);
            });
        }
    }

    function calculateRequestTotal() {
        const amountInput = document.getElementById('requestAmount');
        const discountInput = document.getElementById('requestDiscountValue');
        const totalInput = document.getElementById('requestTotal');
        if (!amountInput || !discountInput || !totalInput) return;

        const amount = parseFloat(amountInput.value) || 0;
        const discountVal = parseFloat(discountInput.value) || 0;
        
        const typeSelect = document.getElementById('requestDiscountType');
        const typeRadio = document.querySelector('input[name="reqDiscountType"]:checked');
        const type = typeSelect ? typeSelect.value : (typeRadio ? typeRadio.value : 'amount');
        
        const symbol = document.getElementById('reqDiscountSymbol');
        if (symbol) {
            symbol.textContent = type === 'percentage' ? '%' : '$';
        }

        let total = amount;
        if (type === 'percentage') {
            total = amount - (amount * discountVal / 100);
        } else {
            total = amount - discountVal;
        }
        
        totalInput.value = Math.max(0, total).toFixed(2);
    }

    function openCreateInvoiceRequestModal() {
        loadStudentsForRequest();
        const modal = document.getElementById('createInvoiceRequestModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeCreateInvoiceRequestModal() {
        const modal = document.getElementById('createInvoiceRequestModal');
        if (modal) modal.style.display = 'none';
        const form = document.getElementById('createInvoiceRequestForm');
        if (form) form.reset();
    }

    async function submitInvoiceRequest(event) {
        event.preventDefault();
        const typeSelect = document.getElementById('requestDiscountType');
        const typeRadio = document.querySelector('input[name="reqDiscountType"]:checked');
        const type = typeSelect ? typeSelect.value : (typeRadio ? typeRadio.value : 'amount');

        const formData = {
            student_id: document.getElementById('requestStudent').value,
            assignment_id: document.getElementById('requestAssignment').value,
            charge_amount: document.getElementById('requestAmount').value,
            discount_type: type,
            discount_value: document.getElementById('requestDiscountValue').value,
            notes: document.getElementById('requestNotes').value
        };
        
        const result = await fetchAPI('/invoice/api/create/', {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        
        if (result.success) {
            notify('Invoice request submitted to admin.');
            closeCreateInvoiceRequestModal();
            loadCSRepInvoices();
        } else {
            notify(result.message || 'Error creating invoice.', 'error');
        }
    }

    // --- Initialization & Global Exports ---

    const init = () => {
        const role = window.currentUserRole;
        if (role === 'ADMIN') {
            loadAdminInvoices();
        } else if (role === 'STUDENT') {
            loadStudentInvoices();
        } else if (role === 'CS_REP') {
            loadCSRepInvoices();
        }

        // Real-time updates handler
        const handleDashboardEvent = (e) => {
            const { event } = e.detail;
            if (event === 'invoice.changed' || event === 'notification.created') {
                const currentRole = window.currentUserRole;
                if (currentRole === 'ADMIN') loadAdminInvoices();
                else if (currentRole === 'STUDENT') loadStudentInvoices();
                else if (currentRole === 'CS_REP') loadCSRepInvoices();
            }
        };
        
        window.removeEventListener('studyapp:dashboard-event', handleDashboardEvent);
        window.addEventListener('studyapp:dashboard-event', handleDashboardEvent);
    };

    // Run init immediately
    init();

    // Export functions to window
    const exports = {
        openCreateInvoiceModal,
        closeCreateInvoiceModal,
        calculateInvoiceFromAmount,
        calculateInvoiceFromDiscount,
        updateDiscountLabels,
        loadStudentAssignmentsForInvoice,
        submitCreateInvoice,
        viewInvoiceDetails,
        closeInvoiceDetailsModal,
        acceptInvoiceRequest,
        markInvoiceAsPaid,
        markAsPaidFromModal,
        deleteInvoice,
        sendInvoiceReminder,
        filterInvoiceRequests,
        filterInvoiceStatus,
        loadStudentInvoices,
        viewStudentInvoiceDetails,
        closeStudentInvoiceDetailsModal,
        openConfirmPaymentModal,
        closeConfirmPaymentModal,
        submitPaymentConfirmation,
        loadCSRepInvoices,
        openCreateInvoiceRequestModal,
        closeCreateInvoiceRequestModal,
        submitInvoiceRequest,
        calculateRequestTotal,
        loadStudentAssignmentsForRequest,
        filterCSRepInvoices,
        notify // Export notify as well
    };

    Object.keys(exports).forEach(key => {
        window[key] = exports[key];
    });

})();
