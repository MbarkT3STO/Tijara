/**
 * Invoices feature page.
 */

import { invoiceService } from '@services/invoiceService';
import { saleService } from '@services/saleService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, debounce } from '@shared/utils/helpers';
import { printInvoice, exportInvoicePDF } from '@shared/utils/invoicePdf';
import type { Invoice } from '@core/types';

const PAGE_SIZE = 10;

interface State {
  invoices: Invoice[];
  filtered: Invoice[];
  page: number;
  search: string;
  statusFilter: string;
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-neutral',
  sent: 'badge-info',
  paid: 'badge-success',
  overdue: 'badge-error',
  cancelled: 'badge-neutral',
};

/** Render and return the invoices page */
export function renderInvoices(): HTMLElement {
  invoiceService.markOverdue();

  const state: State = {
    invoices: invoiceService.getAll(),
    filtered: [],
    page: 1,
    search: '',
    statusFilter: '',
  };

  state.filtered = [...state.invoices];

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function applyFilters() {
    let data = [...state.invoices];
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q)
      );
    }
    if (state.statusFilter) {
      data = data.filter((i) => i.status === state.statusFilter);
    }
    state.filtered = data;
    state.page = 1;
  }

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    page.querySelector<HTMLInputElement>('#invoice-search')?.addEventListener(
      'input',
      debounce((e: Event) => {
        state.search = (e.target as HTMLInputElement).value;
        applyFilters();
        render();
      }, 300) as EventListener
    );

    page.querySelector<HTMLSelectElement>('#inv-status-filter')?.addEventListener('change', (e) => {
      state.statusFilter = (e.target as HTMLSelectElement).value;
      applyFilters();
      render();
    });

    page.querySelector('#create-invoice-btn')?.addEventListener('click', () => {
      openCreateInvoiceModal(() => {
        state.invoices = invoiceService.getAll();
        applyFilters();
        render();
      });
    });

    // ── Three-dot dropdown menus (body portal – avoids overflow clipping) ──
    // The menu is appended to document.body and positioned via getBoundingClientRect.
    let activePortal: HTMLElement | null = null;
    let activeTrigger: HTMLButtonElement | null = null;

    const closePortal = () => {
      activePortal?.remove();
      activePortal = null;
      activeTrigger?.setAttribute('aria-expanded', 'false');
      activeTrigger = null;
    };

    // Close on outside click or scroll
    document.addEventListener('click', closePortal);
    document.querySelector('.content-area')?.addEventListener('scroll', closePortal);

    const openPortal = (trigger: HTMLButtonElement, invId: string, invNumber: string) => {
      // Close any already-open portal first
      closePortal();

      const rect = trigger.getBoundingClientRect();

      const menu = document.createElement('div');
      menu.className = 'inv-portal-menu';
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', `Actions for invoice ${invNumber}`);
      menu.innerHTML = `
        <button class="dropdown-item" data-action="view"   role="menuitem">${Icons.eye(16)}      View</button>
        <button class="dropdown-item" data-action="edit"   role="menuitem">${Icons.edit(16)}     Edit</button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" data-action="pdf"    role="menuitem" style="color:var(--color-primary);">${Icons.fileText(16)}  Export PDF</button>
        <button class="dropdown-item" data-action="print"  role="menuitem">${Icons.printer(16)}  Print</button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item danger" data-action="delete" role="menuitem">${Icons.trash(16)} Delete</button>
      `;

      // Position: align right edge of menu with right edge of trigger
      const menuWidth = 168;
      let left = rect.right - menuWidth;
      let top = rect.bottom + 4;

      // Flip upward if too close to viewport bottom
      if (top + 220 > window.innerHeight) {
        top = rect.top - 220;
      }
      // Keep within left viewport edge
      if (left < 8) left = 8;

      menu.style.cssText = `
        position: fixed;
        top: ${top}px;
        left: ${left}px;
        width: ${menuWidth}px;
        z-index: 9999;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        animation: slideUp 150ms ease;
      `;

      document.body.appendChild(menu);
      activePortal = menu;
      activeTrigger = trigger;
      trigger.setAttribute('aria-expanded', 'true');

      // Stop clicks inside the menu from immediately closing it
      menu.addEventListener('click', (e) => e.stopPropagation());

      // Wire up action items
      menu.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((item) => {
        item.addEventListener('click', async () => {
          const action = item.getAttribute('data-action')!;
          closePortal();

          const invoice = invoiceService.getById(invId);
          if (!invoice) return;

          switch (action) {
            case 'view':
              openInvoiceDetailModal(invoice, () => {
                state.invoices = invoiceService.getAll();
                applyFilters();
                render();
              });
              break;

            case 'edit':
              openInvoiceEditModal(invoice, () => {
                state.invoices = invoiceService.getAll();
                applyFilters();
                render();
              });
              break;

            case 'pdf':
              item.setAttribute('disabled', 'true');
              try {
                await exportInvoicePDF(invoice);
                notifications.success('Invoice exported as PDF.');
              } catch {
                notifications.error('PDF export failed.');
              } finally {
                item.removeAttribute('disabled');
              }
              break;

            case 'print':
              printInvoice(invoice);
              break;

            case 'delete':
              confirmDialog('Delete Invoice', `Delete invoice "${invoice.invoiceNumber}"?`, () => {
                invoiceService.delete(invId);
                notifications.success('Invoice deleted.');
                state.invoices = invoiceService.getAll();
                applyFilters();
                render();
              });
              break;
          }
        });
      });
    };

    // Attach trigger clicks
    page.querySelectorAll<HTMLButtonElement>('.inv-menu-trigger').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrapper = trigger.closest<HTMLElement>('.inv-action-menu')!;
        const invId     = wrapper.getAttribute('data-inv-id')!;
        const invNumber = wrapper.getAttribute('data-inv-number')!;
        // Toggle: if this trigger's portal is already open, close it
        if (activeTrigger === trigger) {
          closePortal();
        } else {
          openPortal(trigger, invId, invNumber);
        }
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-page')!, 10);
        if (!isNaN(p)) {
          state.page = p;
          render();
        }
      });
    });
  }

  render();
  return page;
}

function buildHTML(state: State): string {
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (state.page - 1) * PAGE_SIZE;
  const pageData = state.filtered.slice(start, start + PAGE_SIZE);

  const totalRevenue = state.invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.total, 0);
  const totalDue = state.invoices
    .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
    .reduce((s, i) => s + i.amountDue, 0);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Invoices</h2>
        <p class="page-subtitle">${total} invoice${total !== 1 ? 's' : ''} total</p>
      </div>
      <button class="btn btn-primary" id="create-invoice-btn">
        ${Icons.plus()} Create Invoice
      </button>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); margin-bottom: var(--space-6);">
      <div class="card stat-card">
        <div class="stat-card-icon" style="background: var(--color-success-subtle); color: var(--color-success);">${Icons.check()}</div>
        <div class="stat-card-value">${formatCurrency(totalRevenue)}</div>
        <div class="stat-card-label">Total Collected</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background: var(--color-warning-subtle); color: var(--color-warning);">${Icons.alertCircle()}</div>
        <div class="stat-card-value">${formatCurrency(totalDue)}</div>
        <div class="stat-card-label">Outstanding</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background: var(--color-error-subtle); color: var(--color-error);">${Icons.alertCircle()}</div>
        <div class="stat-card-value">${state.invoices.filter((i) => i.status === 'overdue').length}</div>
        <div class="stat-card-label">Overdue</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="gap: var(--space-3); flex-wrap: wrap;">
        <div class="search-bar" style="flex: 1; max-width: 360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input type="search" id="invoice-search" class="form-control" placeholder="Search invoices..." value="${state.search}" aria-label="Search invoices" />
        </div>
        <select id="inv-status-filter" class="form-control" style="width: auto;" aria-label="Filter by status">
          <option value="">All Statuses</option>
          <option value="draft" ${state.statusFilter === 'draft' ? 'selected' : ''}>Draft</option>
          <option value="sent" ${state.statusFilter === 'sent' ? 'selected' : ''}>Sent</option>
          <option value="paid" ${state.statusFilter === 'paid' ? 'selected' : ''}>Paid</option>
          <option value="overdue" ${state.statusFilter === 'overdue' ? 'selected' : ''}>Overdue</option>
          <option value="cancelled" ${state.statusFilter === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </div>

      <div class="table-container" style="border: none; border-radius: 0;">
        <table class="data-table" aria-label="Invoices list">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Due</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              pageData.length === 0
                ? `<tr><td colspan="8">
                    <div class="empty-state">
                      <div class="empty-state-icon">${Icons.invoices(32)}</div>
                      <p class="empty-state-title">No invoices found</p>
                      <p class="empty-state-desc">${state.search ? 'Try a different search.' : 'Create your first invoice.'}</p>
                    </div>
                  </td></tr>`
                : pageData
                    .map(
                      (inv) => `
              <tr>
                <td><span style="font-weight: 600; color: var(--color-primary);">${inv.invoiceNumber}</span></td>
                <td>${inv.customerName}</td>
                <td><strong>${formatCurrency(inv.total)}</strong></td>
                <td style="color: var(--color-success);">${formatCurrency(inv.amountPaid)}</td>
                <td style="color: ${inv.amountDue > 0 ? 'var(--color-error)' : 'var(--color-text-secondary)'}; font-weight: ${inv.amountDue > 0 ? '600' : '400'};">${formatCurrency(inv.amountDue)}</td>
                <td><span class="badge ${STATUS_BADGE[inv.status] ?? 'badge-neutral'}">${inv.status}</span></td>
                <td style="color: var(--color-text-secondary);">${formatDate(inv.dueDate)}</td>
                <td>
                  <div class="inv-action-menu" data-inv-id="${inv.id}" data-inv-number="${inv.invoiceNumber}">
                    <button
                      class="btn btn-ghost btn-icon btn-sm inv-menu-trigger"
                      aria-label="Actions for invoice ${inv.invoiceNumber}"
                      aria-haspopup="true"
                      aria-expanded="false"
                    >
                      ${Icons.moreVertical(16)}
                    </button>
                  </div>
                </td>
              </tr>
            `
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>

      ${buildPagination(state.page, totalPages, total, start, pageData.length)}
    </div>
  `;
}

function buildPagination(
  page: number,
  totalPages: number,
  total: number,
  start: number,
  count: number
): string {
  if (total === 0) return '';
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return `
    <div class="pagination">
      <span class="pagination-info">Showing ${start + 1}–${start + count} of ${total}</span>
      <div class="pagination-controls">
        <button class="pagination-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>${Icons.chevronLeft(16)}</button>
        ${pages.map((p) => `<button class="pagination-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`).join('')}
        <button class="pagination-btn" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>${Icons.chevronRight(16)}</button>
      </div>
    </div>
  `;
}

function openInvoiceDetailModal(invoice: Invoice, onUpdate: () => void): void {
  const content = document.createElement('div');
  content.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-5);">
      <div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: 4px;">Customer</div>
        <div style="font-weight: 500;">${invoice.customerName}</div>
      </div>
      <div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: 4px;">Due Date</div>
        <div>${formatDate(invoice.dueDate)}</div>
      </div>
      <div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: 4px;">Status</div>
        <span class="badge ${STATUS_BADGE[invoice.status]}">${invoice.status}</span>
      </div>
      <div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: 4px;">Amount Due</div>
        <div style="font-weight: 700; color: ${invoice.amountDue > 0 ? 'var(--color-error)' : 'var(--color-success)'};">${formatCurrency(invoice.amountDue)}</div>
      </div>
    </div>

    <div class="table-container" style="margin-bottom: var(--space-4);">
      <table class="data-table">
        <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>
          ${invoice.items.map((item) => `
            <tr>
              <td>${item.productName}</td>
              <td>${item.quantity}</td>
              <td>${formatCurrency(item.unitPrice)}</td>
              <td><strong>${formatCurrency(item.total)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div style="display: flex; flex-direction: column; gap: var(--space-2); align-items: flex-end; margin-bottom: var(--space-4);">
      <div style="display: flex; gap: var(--space-8);">
        <span style="color: var(--color-text-secondary);">Subtotal</span>
        <span>${formatCurrency(invoice.subtotal)}</span>
      </div>
      <div style="display: flex; gap: var(--space-8);">
        <span style="color: var(--color-text-secondary);">Tax (${invoice.taxRate}%)</span>
        <span>${formatCurrency(invoice.taxAmount)}</span>
      </div>
      <div style="display: flex; gap: var(--space-8); font-size: var(--font-size-lg); font-weight: 700; border-top: 1px solid var(--color-border); padding-top: var(--space-2);">
        <span>Total</span>
        <span style="color: var(--color-primary);">${formatCurrency(invoice.total)}</span>
      </div>
    </div>

    ${invoice.amountDue > 0 ? `
      <div style="border-top: 1px solid var(--color-border); padding-top: var(--space-4);">
        <div class="form-group">
          <label class="form-label" for="payment-amount">Record Payment</label>
          <div style="display: flex; gap: var(--space-2);">
            <input type="number" id="payment-amount" class="form-control" placeholder="Amount" min="0" max="${invoice.amountDue}" step="0.01" value="${invoice.amountDue}" />
            <button type="button" class="btn btn-primary" id="record-payment-btn">Record</button>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- PDF / Print actions -->
    <div style="display: flex; gap: var(--space-3); margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--color-border);">
      <button class="btn btn-secondary" id="detail-pdf-btn">
        ${Icons.fileText(16)} Export PDF
      </button>
      <button class="btn btn-secondary" id="detail-print-btn">
        ${Icons.printer(16)} Print
      </button>
    </div>
  `;

  const close = openModal({
    title: `Invoice ${invoice.invoiceNumber}`,
    content,
    size: 'lg',
    hideFooter: true,
  });

  content.querySelector('#record-payment-btn')?.addEventListener('click', () => {
    const amount = parseFloat((content.querySelector('#payment-amount') as HTMLInputElement).value);
    if (isNaN(amount) || amount <= 0) {
      notifications.error('Enter a valid payment amount.');
      return;
    }
    invoiceService.recordPayment(invoice.id, amount);
    notifications.success(`Payment of ${formatCurrency(amount)} recorded.`);
    close();
    onUpdate();
  });

  content.querySelector('#detail-pdf-btn')?.addEventListener('click', async () => {
    const btn = content.querySelector<HTMLButtonElement>('#detail-pdf-btn')!;
    btn.disabled = true;
    try {
      await exportInvoicePDF(invoice);
      notifications.success('Invoice exported as PDF.');
    } catch {
      notifications.error('PDF export failed.');
    } finally {
      btn.disabled = false;
    }
  });

  content.querySelector('#detail-print-btn')?.addEventListener('click', () => {
    printInvoice(invoice);
  });
}

function openCreateInvoiceModal(onSave: () => void): void {
  const sales = saleService.getAll().filter((s) => s.status !== 'cancelled');

  const form = document.createElement('div');
  form.innerHTML = `
    <div class="form-group" style="margin-bottom: var(--space-4);">
      <label class="form-label required" for="inv-sale">Select Order</label>
      <select id="inv-sale" class="form-control" required>
        <option value="">Choose an order...</option>
        ${sales.map((s) => `<option value="${s.id}">${s.orderNumber} – ${s.customerName} (${formatCurrency(s.total)})</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label" for="inv-days">Payment Terms (days)</label>
      <input type="number" id="inv-days" class="form-control" value="30" min="1" />
    </div>
    <div class="form-group">
      <label class="form-label" for="inv-notes">Notes</label>
      <textarea id="inv-notes" class="form-control" placeholder="Optional notes..."></textarea>
    </div>
  `;

  openModal({
    title: 'Create Invoice',
    content: form,
    confirmText: 'Create Invoice',
    onConfirm: () => {
      const saleId = (form.querySelector('#inv-sale') as HTMLSelectElement).value;
      if (!saleId) {
        notifications.error('Please select an order.');
        return;
      }
      const sale = saleService.getById(saleId);
      if (!sale) return;
      const days = parseInt((form.querySelector('#inv-days') as HTMLInputElement).value) || 30;
      invoiceService.createFromSale(sale, days);
      notifications.success('Invoice created successfully.');
      onSave();
    },
  });
}

/** Edit existing invoice – status, due date, notes, and record payment */
function openInvoiceEditModal(invoice: Invoice, onSave: () => void): void {
  // Format ISO date to yyyy-MM-dd for <input type="date">
  const dueDateValue = invoice.dueDate ? invoice.dueDate.slice(0, 10) : '';

  const form = document.createElement('div');
  form.innerHTML = `
    <div class="form-row" style="margin-bottom: var(--space-4);">
      <div class="form-group">
        <label class="form-label" for="ie-status">Status</label>
        <select id="ie-status" class="form-control">
          <option value="draft"     ${invoice.status === 'draft'     ? 'selected' : ''}>Draft</option>
          <option value="sent"      ${invoice.status === 'sent'      ? 'selected' : ''}>Sent</option>
          <option value="paid"      ${invoice.status === 'paid'      ? 'selected' : ''}>Paid</option>
          <option value="overdue"   ${invoice.status === 'overdue'   ? 'selected' : ''}>Overdue</option>
          <option value="cancelled" ${invoice.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="ie-due-date">Due Date</label>
        <input type="date" id="ie-due-date" class="form-control" value="${dueDateValue}" />
      </div>
    </div>

    <!-- Summary (read-only) -->
    <div style="background:var(--color-bg-secondary);border-radius:var(--radius-sm);padding:var(--space-4);margin-bottom:var(--space-4);">
      <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:var(--space-3);text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Invoice Summary</div>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>
            ${invoice.items.map((item) => `
              <tr>
                <td>${item.productName}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.unitPrice)}</td>
                <td><strong>${formatCurrency(item.total)}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--space-1);align-items:flex-end;margin-top:var(--space-3);font-size:var(--font-size-sm);">
        <div style="display:flex;gap:var(--space-8);color:var(--color-text-secondary);">
          <span>Subtotal</span><span>${formatCurrency(invoice.subtotal)}</span>
        </div>
        <div style="display:flex;gap:var(--space-8);color:var(--color-text-secondary);">
          <span>Tax (${invoice.taxRate}%)</span><span>${formatCurrency(invoice.taxAmount)}</span>
        </div>
        <div style="display:flex;gap:var(--space-8);font-weight:700;font-size:var(--font-size-base);border-top:1px solid var(--color-border);padding-top:var(--space-2);margin-top:var(--space-1);">
          <span>Total</span><span style="color:var(--color-primary);">${formatCurrency(invoice.total)}</span>
        </div>
      </div>
    </div>

    <!-- Payment tracking -->
    <div class="form-row" style="margin-bottom: var(--space-4);">
      <div class="form-group">
        <label class="form-label" for="ie-amount-paid">Amount Paid ($)</label>
        <input type="number" id="ie-amount-paid" class="form-control" value="${invoice.amountPaid}" min="0" step="0.01" max="${invoice.total}" />
      </div>
      <div class="form-group">
        <label class="form-label">Amount Due</label>
        <div id="ie-amount-due" class="form-control" style="background:var(--color-bg-secondary);cursor:default;font-weight:600;color:${invoice.amountDue > 0 ? 'var(--color-error)' : 'var(--color-success)'};">
          ${formatCurrency(invoice.amountDue)}
        </div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" for="ie-notes">Notes</label>
      <textarea id="ie-notes" class="form-control" placeholder="Optional notes...">${invoice.notes ?? ''}</textarea>
    </div>
  `;

  // Live-update amount due as paid changes
  form.querySelector('#ie-amount-paid')?.addEventListener('input', (e) => {
    const paid = parseFloat((e.target as HTMLInputElement).value) || 0;
    const due = Math.max(0, invoice.total - paid);
    const dueEl = form.querySelector<HTMLElement>('#ie-amount-due')!;
    dueEl.textContent = formatCurrency(due);
    dueEl.style.color = due > 0 ? 'var(--color-error)' : 'var(--color-success)';
  });

  openModal({
    title: `Edit Invoice ${invoice.invoiceNumber}`,
    content: form,
    size: 'lg',
    confirmText: 'Save Changes',
    onConfirm: () => {
      const amountPaid = parseFloat((form.querySelector('#ie-amount-paid') as HTMLInputElement).value) || 0;
      const amountDue  = Math.max(0, invoice.total - amountPaid);
      const dueDateRaw = (form.querySelector('#ie-due-date') as HTMLInputElement).value;
      const dueDate    = dueDateRaw ? new Date(dueDateRaw).toISOString() : invoice.dueDate;

      let status = (form.querySelector('#ie-status') as HTMLSelectElement).value as Invoice['status'];
      // Auto-set paid status when fully paid
      if (amountDue === 0 && status !== 'cancelled') status = 'paid';

      invoiceService.update(invoice.id, {
        status,
        dueDate,
        amountPaid,
        amountDue,
        notes: (form.querySelector('#ie-notes') as HTMLTextAreaElement).value.trim(),
      });

      notifications.success('Invoice updated successfully.');
      onSave();
    },
  });
}
