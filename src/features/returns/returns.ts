/**
 * Returns & Refunds feature page.
 * Customers return items → stock restocked, refund issued against original order.
 */

import { returnService } from '@services/returnService';
import { saleService } from '@services/saleService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, debounce } from '@shared/utils/helpers';
import { profileService } from '@services/profileService';
import type { Return, ReturnItem, ReturnReason, Sale } from '@core/types';

const PAGE_SIZE = 10;

interface State {
  returns: Return[];
  filtered: Return[];
  page: number;
  search: string;
  statusFilter: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending:  'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-error',
  refunded: 'badge-primary',
};

const REASON_LABELS: Record<ReturnReason, string> = {
  defective:             'Defective / Faulty',
  wrong_item:            'Wrong Item Sent',
  not_as_described:      'Not as Described',
  damaged_shipping:      'Damaged in Shipping',
  customer_changed_mind: 'Customer Changed Mind',
  other:                 'Other',
};

export function renderReturns(): HTMLElement {
  const state: State = {
    returns: returnService.getAll(),
    filtered: [],
    page: 1,
    search: '',
    statusFilter: '',
  };
  state.filtered = [...state.returns];

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function applyFilters() {
    let data = [...state.returns];
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(
        (r) =>
          r.returnNumber.toLowerCase().includes(q) ||
          r.orderNumber.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q)
      );
    }
    if (state.statusFilter) data = data.filter((r) => r.status === state.statusFilter);
    state.filtered = data;
    state.page = 1;
  }

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    page.querySelector<HTMLInputElement>('#ret-search')?.addEventListener(
      'input',
      debounce((e: Event) => {
        state.search = (e.target as HTMLInputElement).value;
        applyFilters(); render();
      }, 300) as EventListener
    );

    page.querySelector<HTMLSelectElement>('#ret-status-filter')?.addEventListener('change', (e) => {
      state.statusFilter = (e.target as HTMLSelectElement).value;
      applyFilters(); render();
    });

    page.querySelector('#add-return-btn')?.addEventListener('click', () => {
      openReturnModal(null, () => { state.returns = returnService.getAll(); applyFilters(); render(); });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ret = returnService.getById(btn.getAttribute('data-view')!);
        if (ret) openReturnDetailModal(ret, () => { state.returns = returnService.getAll(); applyFilters(); render(); });
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-approve]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ret = returnService.getById(btn.getAttribute('data-approve')!);
        if (!ret) return;
        confirmDialog(
          'Approve Return',
          `Approve return "${ret.returnNumber}"?${ret.restockItems ? ' Items will be added back to inventory.' : ''}`,
          () => {
            returnService.updateStatus(ret.id, 'approved');
            notifications.success(`Return ${ret.returnNumber} approved.`);
            state.returns = returnService.getAll(); applyFilters(); render();
          },
          'Approve',
          'btn-primary'
        );
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ret = returnService.getById(btn.getAttribute('data-reject')!);
        if (!ret) return;
        confirmDialog(
          'Reject Return',
          `Reject return "${ret.returnNumber}"? This cannot be undone.`,
          () => {
            returnService.updateStatus(ret.id, 'rejected');
            notifications.success(`Return ${ret.returnNumber} rejected.`);
            state.returns = returnService.getAll(); applyFilters(); render();
          },
          'Reject',
          'btn-danger'
        );
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ret = returnService.getById(btn.getAttribute('data-delete')!);
        if (!ret) return;
        confirmDialog('Delete Return', `Delete return "${ret.returnNumber}"?`, () => {
          returnService.delete(ret.id);
          notifications.success('Return deleted.');
          state.returns = returnService.getAll(); applyFilters(); render();
        });
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-page')!, 10);
        if (!isNaN(p)) { state.page = p; render(); }
      });
    });
  }

  render();
  return page;
}

// ── HTML ──────────────────────────────────────────────────────────────────────

function buildHTML(state: State): string {
  const all = returnService.getAll();
  const totalRefunded  = returnService.getTotalRefunded();
  const pendingCount   = all.filter((r) => r.status === 'pending').length;
  const approvedCount  = all.filter((r) => r.status === 'approved' || r.status === 'refunded').length;

  const total      = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start      = (state.page - 1) * PAGE_SIZE;
  const pageData   = state.filtered.slice(start, start + PAGE_SIZE);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Returns & Refunds</h2>
        <p class="page-subtitle">Customer returns, refunds, and credit notes</p>
      </div>
      <button class="btn btn-primary" id="add-return-btn">${Icons.plus()} New Return</button>
    </div>

    <!-- KPI strip -->
    <div class="ret-kpi-grid">
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-primary-subtle);color:var(--color-primary);">${Icons.refresh()}</div>
        <div class="stat-card-value">${all.length}</div>
        <div class="stat-card-label">Total Returns</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-warning-subtle);color:var(--color-warning);">${Icons.alertCircle()}</div>
        <div class="stat-card-value">${pendingCount}</div>
        <div class="stat-card-label">Pending Review</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-success-subtle);color:var(--color-success);">${Icons.check()}</div>
        <div class="stat-card-value">${approvedCount}</div>
        <div class="stat-card-label">Approved</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-error-subtle);color:var(--color-error);">${Icons.dollarSign()}</div>
        <div class="stat-card-value">${formatCurrency(totalRefunded)}</div>
        <div class="stat-card-label">Total Refunded</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="gap:var(--space-3);flex-wrap:wrap;">
        <div class="search-bar" style="flex:1;max-width:360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input type="search" id="ret-search" class="form-control"
            placeholder="Search by return #, order #, or customer..." value="${state.search}" aria-label="Search returns" />
        </div>
        <select id="ret-status-filter" class="form-control" style="width:auto;" aria-label="Filter by status">
          <option value="">All Statuses</option>
          <option value="pending"  ${state.statusFilter === 'pending'  ? 'selected' : ''}>Pending</option>
          <option value="approved" ${state.statusFilter === 'approved' ? 'selected' : ''}>Approved</option>
          <option value="rejected" ${state.statusFilter === 'rejected' ? 'selected' : ''}>Rejected</option>
          <option value="refunded" ${state.statusFilter === 'refunded' ? 'selected' : ''}>Refunded</option>
        </select>
      </div>

      <div class="table-container" style="border:none;border-radius:0;">
        <table class="data-table" aria-label="Returns list">
          <thead>
            <tr>
              <th>Return #</th>
              <th>Order #</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Refund</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0
              ? `<tr><td colspan="9">
                  <div class="empty-state">
                    <div class="empty-state-icon">${Icons.refresh(32)}</div>
                    <p class="empty-state-title">No returns found</p>
                    <p class="empty-state-desc">${state.search ? 'Try a different search.' : 'No customer returns have been filed yet.'}</p>
                  </div>
                </td></tr>`
              : pageData.map((r) => `
                <tr>
                  <td><span style="font-weight:600;color:var(--color-primary);">${r.returnNumber}</span></td>
                  <td style="color:var(--color-text-secondary);">${r.orderNumber}</td>
                  <td>${r.customerName}</td>
                  <td style="color:var(--color-text-secondary);">${r.items.length} item${r.items.length !== 1 ? 's' : ''}</td>
                  <td><strong style="color:var(--color-error);">${formatCurrency(r.refundAmount)}</strong></td>
                  <td style="color:var(--color-text-secondary);font-size:var(--font-size-xs);">${REASON_LABELS[r.reason] ?? r.reason}</td>
                  <td><span class="badge ${STATUS_BADGE[r.status] ?? 'badge-neutral'}">${r.status}</span></td>
                  <td style="color:var(--color-text-secondary);">${formatDate(r.createdAt)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-ghost btn-icon btn-sm" data-view="${r.id}" aria-label="View" data-tooltip="View">${Icons.eye(16)}</button>
                      ${r.status === 'pending' ? `
                        <button class="btn btn-ghost btn-icon btn-sm" data-approve="${r.id}" aria-label="Approve" data-tooltip="Approve" style="color:var(--color-success);">${Icons.check(16)}</button>
                        <button class="btn btn-ghost btn-icon btn-sm" data-reject="${r.id}" aria-label="Reject" data-tooltip="Reject" style="color:var(--color-error);">${Icons.close(16)}</button>
                      ` : ''}
                      <button class="btn btn-ghost btn-icon btn-sm" data-delete="${r.id}" aria-label="Delete" data-tooltip="Delete" style="color:var(--color-error);">${Icons.trash(16)}</button>
                    </div>
                  </td>
                </tr>`).join('')
            }
          </tbody>
        </table>
      </div>
      ${buildPagination(state.page, totalPages, total, start, pageData.length)}
    </div>
  `;
}

function buildPagination(page: number, totalPages: number, total: number, start: number, count: number): string {
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
    </div>`;
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function openReturnDetailModal(ret: Return, onUpdate: () => void): void {
  const content = document.createElement('div');
  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-5);">
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Customer</div>
        <div style="font-weight:500;">${ret.customerName}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Original Order</div>
        <div style="font-weight:500;color:var(--color-primary);">${ret.orderNumber}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Status</div>
        <span class="badge ${STATUS_BADGE[ret.status]}">${ret.status}</span>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Reason</div>
        <div>${REASON_LABELS[ret.reason] ?? ret.reason}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Refund Method</div>
        <div>${ret.refundMethod.replace('_', ' ')}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Restock Items</div>
        <span class="badge ${ret.restockItems ? 'badge-success' : 'badge-neutral'}">${ret.restockItems ? 'Yes' : 'No'}</span>
      </div>
    </div>

    <div class="table-container" style="margin-bottom:var(--space-4);">
      <table class="data-table">
        <thead><tr><th>Product</th><th>Qty Returned</th><th>Unit Price</th><th>Total</th></tr></thead>
        <tbody>
          ${ret.items.map((item) => `
            <tr>
              <td>${item.productName}</td>
              <td>${item.quantity}</td>
              <td>${formatCurrency(item.unitPrice)}</td>
              <td><strong>${formatCurrency(item.total)}</strong></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div style="display:flex;flex-direction:column;gap:var(--space-2);align-items:flex-end;margin-bottom:var(--space-4);">
      <div style="display:flex;gap:var(--space-8);font-size:var(--font-size-sm);"><span style="color:var(--color-text-secondary);">Subtotal</span><span>${formatCurrency(ret.subtotal)}</span></div>
      <div style="display:flex;gap:var(--space-8);font-size:var(--font-size-sm);"><span style="color:var(--color-text-secondary);">Tax (${ret.taxRate}%)</span><span>${formatCurrency(ret.taxAmount)}</span></div>
      <div style="display:flex;gap:var(--space-8);font-size:var(--font-size-lg);font-weight:700;border-top:1px solid var(--color-border);padding-top:var(--space-2);margin-top:var(--space-1);">
        <span>Refund Amount</span><span style="color:var(--color-error);">${formatCurrency(ret.refundAmount)}</span>
      </div>
    </div>

    ${ret.notes ? `<div style="padding:var(--space-3);background:var(--color-bg-secondary);border-radius:var(--radius-sm);font-size:var(--font-size-sm);color:var(--color-text-secondary);margin-bottom:var(--space-4);">${ret.notes}</div>` : ''}

    ${ret.status === 'pending' ? `
    <div style="display:flex;gap:var(--space-3);">
      <button class="btn btn-primary" id="detail-approve-btn">${Icons.check(16)} Approve Return</button>
      <button class="btn btn-danger" id="detail-reject-btn">${Icons.close(16)} Reject</button>
    </div>` : ''}

    ${ret.status === 'approved' ? `
    <div style="margin-top:var(--space-2);">
      <button class="btn btn-secondary" id="detail-refunded-btn">${Icons.dollarSign(16)} Mark as Refunded</button>
    </div>` : ''}
  `;

  const close = openModal({ title: `Return ${ret.returnNumber}`, content, size: 'lg', hideFooter: true });

  content.querySelector('#detail-approve-btn')?.addEventListener('click', () => {
    confirmDialog(
      'Approve Return',
      `Approve "${ret.returnNumber}"?${ret.restockItems ? ' Items will be added back to inventory.' : ''}`,
      () => { returnService.updateStatus(ret.id, 'approved'); notifications.success('Return approved.'); close(); onUpdate(); },
      'Approve', 'btn-primary'
    );
  });

  content.querySelector('#detail-reject-btn')?.addEventListener('click', () => {
    confirmDialog('Reject Return', `Reject "${ret.returnNumber}"?`, () => {
      returnService.updateStatus(ret.id, 'rejected');
      notifications.success('Return rejected.');
      close(); onUpdate();
    });
  });

  content.querySelector('#detail-refunded-btn')?.addEventListener('click', () => {
    returnService.updateStatus(ret.id, 'refunded');
    notifications.success('Return marked as refunded.');
    close(); onUpdate();
  });
}

// ── Create modal ──────────────────────────────────────────────────────────────

function openReturnModal(_ret: Return | null, onSave: () => void): void {
  const currency = profileService.getCurrencySymbol();
  // Only delivered/confirmed sales can be returned
  const eligibleSales = saleService.getAll().filter(
    (s) => s.status === 'delivered' || s.status === 'confirmed' || s.status === 'shipped'
  );

  let selectedSale: Sale | null = null;
  let items: ReturnItem[] = [];

  const form = document.createElement('div');

  const renderSaleItems = () => {
    const container = form.querySelector<HTMLElement>('#ret-items-section')!;
    if (!selectedSale) {
      container.innerHTML = `<div style="text-align:center;padding:var(--space-4);color:var(--color-text-tertiary);font-size:var(--font-size-sm);border:1px dashed var(--color-border);border-radius:var(--radius-sm);">Select an order above to load its items</div>`;
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom:var(--space-3);">
        <div style="display:grid;grid-template-columns:1fr 100px 120px 80px;gap:var(--space-2);padding:var(--space-2) var(--space-3);background:var(--color-bg-secondary);border-radius:var(--radius-sm);font-size:var(--font-size-xs);font-weight:600;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:.04em;">
          <span>Product</span><span style="text-align:center;">Max Qty</span><span style="text-align:center;">Return Qty</span><span style="text-align:right;">Refund</span>
        </div>
        ${selectedSale.items.map((saleItem, idx) => {
          const retItem = items.find((i) => i.productId === saleItem.productId);
          const retQty = retItem?.quantity ?? 0;
          const unitPrice = saleItem.unitPrice * (1 - saleItem.discount / 100);
          return `
            <div style="display:grid;grid-template-columns:1fr 100px 120px 80px;gap:var(--space-2);align-items:center;padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--color-border-subtle);">
              <div style="font-size:var(--font-size-sm);font-weight:500;">${saleItem.productName}</div>
              <div style="text-align:center;font-size:var(--font-size-sm);color:var(--color-text-secondary);">${saleItem.quantity}</div>
              <div style="display:flex;justify-content:center;">
                <input type="number" class="form-control ret-item-qty" data-idx="${idx}"
                  data-product-id="${saleItem.productId}"
                  data-product-name="${saleItem.productName}"
                  data-unit-price="${unitPrice.toFixed(4)}"
                  data-max="${saleItem.quantity}"
                  value="${retQty}" min="0" max="${saleItem.quantity}"
                  style="width:72px;text-align:center;" />
              </div>
              <div style="text-align:right;font-size:var(--font-size-sm);font-weight:600;color:var(--color-error);" id="ret-item-total-${idx}">
                ${formatCurrency(retQty * unitPrice)}
              </div>
            </div>`;
        }).join('')}
      </div>
      <div id="ret-totals" style="text-align:right;font-size:var(--font-size-sm);color:var(--color-text-secondary);padding:var(--space-2) var(--space-3);"></div>
    `;

    updateTotals();

    container.querySelectorAll<HTMLInputElement>('.ret-item-qty').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx    = +inp.getAttribute('data-idx')!;
        const pid    = inp.getAttribute('data-product-id')!;
        const pname  = inp.getAttribute('data-product-name')!;
        const price  = parseFloat(inp.getAttribute('data-unit-price')!);
        const max    = parseInt(inp.getAttribute('data-max')!);
        const qty    = Math.min(Math.max(parseInt(inp.value) || 0, 0), max);
        inp.value    = String(qty);

        // Update items array
        const existing = items.findIndex((i) => i.productId === pid);
        if (qty === 0) {
          if (existing !== -1) items.splice(existing, 1);
        } else {
          const total = qty * price;
          if (existing !== -1) {
            items[existing] = { productId: pid, productName: pname, quantity: qty, unitPrice: price, total };
          } else {
            items.push({ productId: pid, productName: pname, quantity: qty, unitPrice: price, total });
          }
        }

        const totalEl = container.querySelector(`#ret-item-total-${idx}`);
        if (totalEl) totalEl.textContent = formatCurrency(qty * price);
        updateTotals();
      });
    });
  };

  const updateTotals = () => {
    const taxRate = parseFloat((form.querySelector('#ret-tax') as HTMLInputElement)?.value ?? '0') || 0;
    const { subtotal, taxAmount, refundAmount } = returnService.calculateTotals(items, taxRate);
    const el = form.querySelector('#ret-totals');
    if (el) el.innerHTML = `
      <div>Subtotal: <strong>${formatCurrency(subtotal)}</strong></div>
      <div>Tax (${taxRate}%): <strong>${formatCurrency(taxAmount)}</strong></div>
      <div style="font-size:var(--font-size-base);font-weight:700;color:var(--color-error);margin-top:4px;">
        Total Refund: ${formatCurrency(refundAmount)}
      </div>`;
  };

  form.innerHTML = `
    <div class="form-row" style="margin-bottom:var(--space-4);">
      <div class="form-group">
        <label class="form-label required" for="ret-sale">Original Order</label>
        <select id="ret-sale" class="form-control">
          <option value="">Select order...</option>
          ${eligibleSales.map((s) => `<option value="${s.id}">${s.orderNumber} — ${s.customerName} (${formatCurrency(s.total)})</option>`).join('')}
        </select>
        ${eligibleSales.length === 0 ? `<span class="form-hint" style="color:var(--color-warning);">No eligible orders found (must be confirmed, shipped, or delivered)</span>` : ''}
      </div>
      <div class="form-group">
        <label class="form-label" for="ret-status">Initial Status</label>
        <select id="ret-status" class="form-control">
          <option value="pending">Pending Review</option>
          <option value="approved">Approved</option>
        </select>
      </div>
    </div>

    <div class="form-row" style="margin-bottom:var(--space-4);">
      <div class="form-group">
        <label class="form-label required" for="ret-reason">Return Reason</label>
        <select id="ret-reason" class="form-control">
          ${(Object.entries(REASON_LABELS) as [ReturnReason, string][]).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="ret-refund-method">Refund Method</label>
        <select id="ret-refund-method" class="form-control">
          <option value="store_credit">Store Credit</option>
          <option value="transfer">Bank Transfer</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </select>
      </div>
    </div>

    <!-- Items section -->
    <div style="margin-bottom:var(--space-4);">
      <label class="form-label" style="margin-bottom:var(--space-2);">Return Items</label>
      <div id="ret-items-section"></div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="ret-tax">Tax Rate (%)</label>
        <input type="number" id="ret-tax" class="form-control" value="0" min="0" max="100" />
        <span class="form-hint">Applied to the refund amount</span>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:var(--space-3);padding-top:var(--space-5);">
        <label class="checkbox-group">
          <input type="checkbox" id="ret-restock" checked />
          <span style="font-size:var(--font-size-sm);">Restock returned items</span>
        </label>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" for="ret-notes">Notes</label>
      <textarea id="ret-notes" class="form-control" placeholder="Optional notes about this return..."></textarea>
    </div>
  `;

  // Load sale items when order is selected
  form.querySelector<HTMLSelectElement>('#ret-sale')?.addEventListener('change', (e) => {
    const saleId = (e.target as HTMLSelectElement).value;
    selectedSale = saleService.getById(saleId) ?? null;
    items = [];
    // Pre-fill tax rate from the sale
    if (selectedSale) {
      (form.querySelector('#ret-tax') as HTMLInputElement).value = String(selectedSale.taxRate);
    }
    renderSaleItems();
  });

  form.querySelector('#ret-tax')?.addEventListener('input', updateTotals);

  renderSaleItems();

  openModal({
    title: 'New Return',
    content: form,
    size: 'lg',
    confirmText: 'Create Return',
    onConfirm: () => {
      const saleSelect = form.querySelector<HTMLSelectElement>('#ret-sale')!;
      if (!saleSelect.value || !selectedSale) {
        showModalError(form, 'Please select an order.', ['ret-sale']); return false;
      }
      if (items.length === 0) {
        showModalError(form, 'Please enter a return quantity for at least one item.'); return false;
      }

      const taxRate      = parseFloat((form.querySelector('#ret-tax') as HTMLInputElement).value) || 0;
      const status       = (form.querySelector('#ret-status') as HTMLSelectElement).value as Return['status'];
      const reason       = (form.querySelector('#ret-reason') as HTMLSelectElement).value as ReturnReason;
      const refundMethod = (form.querySelector('#ret-refund-method') as HTMLSelectElement).value as Return['refundMethod'];
      const restockItems = (form.querySelector('#ret-restock') as HTMLInputElement).checked;
      const notes        = (form.querySelector('#ret-notes') as HTMLTextAreaElement).value.trim();

      returnService.create({
        saleId:       selectedSale.id,
        orderNumber:  selectedSale.orderNumber,
        customerId:   selectedSale.customerId,
        customerName: selectedSale.customerName,
        items,
        taxRate,
        status,
        reason,
        refundMethod,
        restockItems,
        notes,
      });

      notifications.success('Return created successfully.');
      onSave();
    },
  });
}

// ── Responsive styles ─────────────────────────────────────────────────────────

if (!document.getElementById('returns-styles')) {
  const style = document.createElement('style');
  style.id = 'returns-styles';
  style.textContent = `
    .ret-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }
    @media (max-width: 1024px) { .ret-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px)  { .ret-kpi-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(style);
}
