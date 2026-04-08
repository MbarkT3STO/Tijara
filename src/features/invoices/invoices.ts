/**
 * Invoices feature page.
 */

import { invoiceService } from '@services/invoiceService';
import { saleService } from '@services/saleService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, debounce } from '@shared/utils/helpers';
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

    page.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-view')!;
        const invoice = invoiceService.getById(id);
        if (invoice) openInvoiceDetailModal(invoice, () => {
          state.invoices = invoiceService.getAll();
          applyFilters();
          render();
        });
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete')!;
        const invoice = invoiceService.getById(id);
        if (!invoice) return;
        confirmDialog('Delete Invoice', `Delete invoice "${invoice.invoiceNumber}"?`, () => {
          invoiceService.delete(id);
          notifications.success('Invoice deleted.');
          state.invoices = invoiceService.getAll();
          applyFilters();
          render();
        });
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
                  <div class="table-actions">
                    <button class="btn btn-ghost btn-icon btn-sm" data-view="${inv.id}" aria-label="View invoice ${inv.invoiceNumber}" data-tooltip="View">
                      ${Icons.eye(16)}
                    </button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-delete="${inv.id}" aria-label="Delete invoice ${inv.invoiceNumber}" data-tooltip="Delete" style="color: var(--color-error);">
                      ${Icons.trash(16)}
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
