/**
 * Purchases / Restocking Orders feature page.
 * Tracks what you spend on stock. Receiving a PO automatically increments inventory.
 */

import { purchaseService } from '@services/purchaseService';
import { supplierService } from '@services/supplierService';
import { productService } from '@services/productService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, debounce } from '@shared/utils/helpers';
import { profileService } from '@services/profileService';
import type { Purchase, PurchaseItem, Product } from '@core/types';

const PAGE_SIZE = 10;

interface State {
  purchases: Purchase[];
  filtered: Purchase[];
  page: number;
  search: string;
  statusFilter: string;
}

const STATUS_BADGE: Record<string, string> = {
  draft:     'badge-neutral',
  ordered:   'badge-info',
  received:  'badge-success',
  cancelled: 'badge-error',
};

const PAY_BADGE: Record<string, string> = {
  unpaid:  'badge-error',
  partial: 'badge-warning',
  paid:    'badge-success',
};

export function renderPurchases(): HTMLElement {
  const state: State = {
    purchases: purchaseService.getAll(),
    filtered: [],
    page: 1,
    search: '',
    statusFilter: '',
  };
  state.filtered = [...state.purchases];

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function applyFilters() {
    let data = [...state.purchases];
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(
        (p) => p.poNumber.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q)
      );
    }
    if (state.statusFilter) data = data.filter((p) => p.status === state.statusFilter);
    state.filtered = data;
    state.page = 1;
  }

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    page.querySelector<HTMLInputElement>('#po-search')?.addEventListener(
      'input',
      debounce((e: Event) => {
        state.search = (e.target as HTMLInputElement).value;
        applyFilters(); render();
      }, 300) as EventListener
    );

    page.querySelector<HTMLSelectElement>('#po-status-filter')?.addEventListener('change', (e) => {
      state.statusFilter = (e.target as HTMLSelectElement).value;
      applyFilters(); render();
    });

    page.querySelector('#add-po-btn')?.addEventListener('click', () => {
      openPurchaseModal(null, () => { state.purchases = purchaseService.getAll(); applyFilters(); render(); });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const po = purchaseService.getById(btn.getAttribute('data-view')!);
        if (po) openPurchaseDetailModal(po, () => { state.purchases = purchaseService.getAll(); applyFilters(); render(); });
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const po = purchaseService.getById(btn.getAttribute('data-edit')!);
        if (!po) return;
        openPurchaseModal(po, () => { state.purchases = purchaseService.getAll(); applyFilters(); render(); });
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-receive]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const po = purchaseService.getById(btn.getAttribute('data-receive')!);
        if (!po) return;
        confirmDialog(
          'Receive Purchase Order',
          `Mark PO "${po.poNumber}" as received? This will add the items to inventory.`,
          () => {
            purchaseService.updateStatus(po.id, 'received');
            notifications.success(`PO ${po.poNumber} received — inventory updated.`);
            state.purchases = purchaseService.getAll(); applyFilters(); render();
          },
          'Mark Received',
          'btn-primary'
        );
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const po = purchaseService.getById(btn.getAttribute('data-delete')!);
        if (!po) return;
        confirmDialog('Delete Purchase Order', `Delete PO "${po.poNumber}"?`, () => {
          purchaseService.delete(po.id);
          notifications.success('Purchase order deleted.');
          state.purchases = purchaseService.getAll(); applyFilters(); render();
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

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHTML(state: State): string {
  const all = purchaseService.getAll();
  const totalSpend   = all.filter((p) => p.status === 'received').reduce((s, p) => s + p.total, 0);
  const pending      = all.filter((p) => p.status === 'ordered').length;
  const unpaidAmount = all
    .filter((p) => p.status === 'received' && p.paymentStatus !== 'paid')
    .reduce((s, p) => s + p.total, 0);

  const total      = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start      = (state.page - 1) * PAGE_SIZE;
  const pageData   = state.filtered.slice(start, start + PAGE_SIZE);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Purchases</h2>
        <p class="page-subtitle">Restocking orders and supplier spend</p>
      </div>
      <button class="btn btn-primary" id="add-po-btn">${Icons.plus()} New Purchase Order</button>
    </div>

    <!-- KPI strip -->
    <div class="po-kpi-grid">
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-primary-subtle);color:var(--color-primary);">${Icons.truck()}</div>
        <div class="stat-card-value">${all.length}</div>
        <div class="stat-card-label">Total Orders</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-warning-subtle);color:var(--color-warning);">${Icons.alertCircle()}</div>
        <div class="stat-card-value">${pending}</div>
        <div class="stat-card-label">Pending Delivery</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-success-subtle);color:var(--color-success);">${Icons.dollarSign()}</div>
        <div class="stat-card-value">${formatCurrency(totalSpend)}</div>
        <div class="stat-card-label">Total Spend (Received)</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-error-subtle);color:var(--color-error);">${Icons.alertCircle()}</div>
        <div class="stat-card-value">${formatCurrency(unpaidAmount)}</div>
        <div class="stat-card-label">Unpaid Balance</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="gap:var(--space-3);flex-wrap:wrap;">
        <div class="search-bar" style="flex:1;max-width:360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input type="search" id="po-search" class="form-control"
            placeholder="Search by PO # or supplier..." value="${state.search}" aria-label="Search purchase orders" />
        </div>
        <select id="po-status-filter" class="form-control" style="width:auto;" aria-label="Filter by status">
          <option value="">All Statuses</option>
          <option value="draft"     ${state.statusFilter === 'draft'     ? 'selected' : ''}>Draft</option>
          <option value="ordered"   ${state.statusFilter === 'ordered'   ? 'selected' : ''}>Ordered</option>
          <option value="received"  ${state.statusFilter === 'received'  ? 'selected' : ''}>Received</option>
          <option value="cancelled" ${state.statusFilter === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </div>

      <div class="table-container" style="border:none;border-radius:0;">
        <table class="data-table" aria-label="Purchase orders list">
          <thead>
            <tr>
              <th>PO #</th>
              <th>Supplier</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0
              ? `<tr><td colspan="8">
                  <div class="empty-state">
                    <div class="empty-state-icon">${Icons.truck(32)}</div>
                    <p class="empty-state-title">No purchase orders found</p>
                    <p class="empty-state-desc">${state.search ? 'Try a different search.' : 'Create your first purchase order.'}</p>
                  </div>
                </td></tr>`
              : pageData.map((po) => `
                <tr>
                  <td><span style="font-weight:600;color:var(--color-primary);">${po.poNumber}</span></td>
                  <td>${po.supplierName}</td>
                  <td style="color:var(--color-text-secondary);">${po.items.length} item${po.items.length !== 1 ? 's' : ''}</td>
                  <td><strong>${formatCurrency(po.total)}</strong></td>
                  <td><span class="badge ${STATUS_BADGE[po.status] ?? 'badge-neutral'}">${po.status}</span></td>
                  <td><span class="badge ${PAY_BADGE[po.paymentStatus] ?? 'badge-neutral'}">${po.paymentStatus}</span></td>
                  <td style="color:var(--color-text-secondary);">${formatDate(po.createdAt)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-ghost btn-icon btn-sm" data-view="${po.id}" aria-label="View" data-tooltip="View">${Icons.eye(16)}</button>
                      ${po.status !== 'received' && po.status !== 'cancelled'
                        ? `<button class="btn btn-ghost btn-icon btn-sm" data-edit="${po.id}" aria-label="Edit" data-tooltip="Edit">${Icons.edit(16)}</button>
                           <button class="btn btn-ghost btn-icon btn-sm" data-receive="${po.id}" aria-label="Mark received" data-tooltip="Mark Received" style="color:var(--color-success);">${Icons.check(16)}</button>`
                        : ''}
                      <button class="btn btn-ghost btn-icon btn-sm" data-delete="${po.id}" aria-label="Delete" data-tooltip="Delete" style="color:var(--color-error);">${Icons.trash(16)}</button>
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

function openPurchaseDetailModal(po: Purchase, onUpdate: () => void): void {
  const content = document.createElement('div');
  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-5);">
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Supplier</div>
        <div style="font-weight:500;">${po.supplierName}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Date</div>
        <div>${formatDate(po.createdAt)}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Status</div>
        <span class="badge ${STATUS_BADGE[po.status]}">${po.status}</span>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Payment</div>
        <span class="badge ${PAY_BADGE[po.paymentStatus]}">${po.paymentStatus}</span>
      </div>
      ${po.expectedDate ? `
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Expected Date</div>
        <div>${formatDate(po.expectedDate)}</div>
      </div>` : ''}
    </div>

    <div class="table-container" style="margin-bottom:var(--space-4);">
      <table class="data-table">
        <thead><tr><th>Product</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr></thead>
        <tbody>
          ${po.items.map((item) => `
            <tr>
              <td>${item.productName}</td>
              <td>${item.quantity}</td>
              <td>${formatCurrency(item.unitCost)}</td>
              <td><strong>${formatCurrency(item.total)}</strong></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div style="display:flex;flex-direction:column;gap:var(--space-2);align-items:flex-end;">
      <div style="display:flex;gap:var(--space-8);font-size:var(--font-size-sm);"><span style="color:var(--color-text-secondary);">Subtotal</span><span>${formatCurrency(po.subtotal)}</span></div>
      <div style="display:flex;gap:var(--space-8);font-size:var(--font-size-sm);"><span style="color:var(--color-text-secondary);">Tax (${po.taxRate}%)</span><span>${formatCurrency(po.taxAmount)}</span></div>
      ${po.shippingCost > 0 ? `<div style="display:flex;gap:var(--space-8);font-size:var(--font-size-sm);"><span style="color:var(--color-text-secondary);">Shipping</span><span>${formatCurrency(po.shippingCost)}</span></div>` : ''}
      <div style="display:flex;gap:var(--space-8);font-size:var(--font-size-lg);font-weight:700;border-top:1px solid var(--color-border);padding-top:var(--space-2);margin-top:var(--space-1);">
        <span>Total</span><span style="color:var(--color-primary);">${formatCurrency(po.total)}</span>
      </div>
    </div>

    ${po.notes ? `<div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--color-bg-secondary);border-radius:var(--radius-sm);font-size:var(--font-size-sm);color:var(--color-text-secondary);">${po.notes}</div>` : ''}

    ${po.status === 'received' && po.paymentStatus !== 'paid' ? `
    <div style="margin-top:var(--space-5);padding:var(--space-4);background:var(--color-bg-secondary);border-radius:var(--radius-md);border:1px solid var(--color-border);">
      <div style="font-size:var(--font-size-sm);font-weight:600;margin-bottom:var(--space-3);">Record Payment</div>
      <div style="display:flex;gap:var(--space-2);">
        <input type="number" id="po-payment-amount" class="form-control" placeholder="Amount"
          min="0" step="0.01" value="${po.total}" />
        <button type="button" class="btn btn-primary" id="po-record-payment-btn">Record</button>
      </div>
    </div>` : ''}

    ${po.status !== 'received' && po.status !== 'cancelled' ? `
    <div style="margin-top:var(--space-4);display:flex;gap:var(--space-3);">
      <button class="btn btn-secondary" id="detail-status-ordered" ${po.status === 'ordered' ? 'disabled' : ''}>Mark Ordered</button>
      <button class="btn btn-primary" id="detail-status-received">Mark Received</button>
    </div>` : ''}
  `;

  const close = openModal({ title: `PO ${po.poNumber}`, content, size: 'lg', hideFooter: true });

  content.querySelector('#po-record-payment-btn')?.addEventListener('click', () => {
    const amount = parseFloat((content.querySelector('#po-payment-amount') as HTMLInputElement).value);
    if (isNaN(amount) || amount <= 0) { notifications.error('Enter a valid amount.'); return; }
    const newStatus: Purchase['paymentStatus'] = amount >= po.total ? 'paid' : 'partial';
    purchaseService.updatePaymentStatus(po.id, newStatus);
    notifications.success('Payment recorded.');
    close(); onUpdate();
  });

  content.querySelector('#detail-status-ordered')?.addEventListener('click', () => {
    purchaseService.updateStatus(po.id, 'ordered');
    notifications.success('PO marked as ordered.');
    close(); onUpdate();
  });

  content.querySelector('#detail-status-received')?.addEventListener('click', () => {
    confirmDialog(
      'Receive Purchase Order',
      `Mark PO "${po.poNumber}" as received? This will add the items to inventory.`,
      () => {
        purchaseService.updateStatus(po.id, 'received');
        notifications.success(`PO ${po.poNumber} received — inventory updated.`);
        close(); onUpdate();
      },
      'Mark Received',
      'btn-primary'
    );
  });
}

// ── Item helpers ──────────────────────────────────────────────────────────────

function buildItemRow(item: PurchaseItem, idx: number, products: Product[], prefix: string): string {
  return `
    <div style="display:grid;grid-template-columns:1fr 90px 130px auto;gap:var(--space-2);align-items:start;margin-bottom:var(--space-3);">
      <div class="form-group" style="margin:0;">
        <select class="form-control ${prefix}-item-product" data-idx="${idx}">
          ${products.map((p) => `<option value="${p.id}" data-cost="${p.cost}" data-name="${p.name}" ${p.id === item.productId ? 'selected' : ''}>${p.name} (${p.sku})</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin:0;">
        <input type="number" class="form-control ${prefix}-item-qty" data-idx="${idx}"
          value="${item.quantity}" min="1" placeholder="Qty" />
      </div>
      <div class="form-group" style="margin:0;">
        <input type="number" class="form-control ${prefix}-item-cost" data-idx="${idx}"
          value="${item.unitCost}" min="0" step="0.01" placeholder="Unit cost" />
      </div>
      <button type="button" class="btn btn-ghost btn-icon btn-sm ${prefix}-remove-item"
        data-idx="${idx}" style="color:var(--color-error);margin-top:2px;">${Icons.trash(16)}</button>
    </div>`;
}

function attachItemEvents(
  container: HTMLElement,
  items: PurchaseItem[],
  products: Product[],
  prefix: string,
  onRender: () => void,
  onTotals: () => void
): void {
  const recalc = (idx: number) => {
    items[idx].total = items[idx].unitCost * items[idx].quantity;
  };

  container.querySelectorAll<HTMLSelectElement>(`.${prefix}-item-product`).forEach((sel) => {
    sel.addEventListener('change', () => {
      const idx = +sel.getAttribute('data-idx')!;
      const opt = sel.selectedOptions[0];
      items[idx].productId   = sel.value;
      items[idx].productName = opt.getAttribute('data-name') ?? '';
      items[idx].unitCost    = parseFloat(opt.getAttribute('data-cost') ?? '0');
      recalc(idx); onRender(); onTotals();
    });
  });

  container.querySelectorAll<HTMLInputElement>(`.${prefix}-item-qty`).forEach((inp) => {
    inp.addEventListener('input', () => {
      const idx = +inp.getAttribute('data-idx')!;
      items[idx].quantity = parseInt(inp.value) || 1;
      recalc(idx); onTotals();
    });
  });

  container.querySelectorAll<HTMLInputElement>(`.${prefix}-item-cost`).forEach((inp) => {
    inp.addEventListener('input', () => {
      const idx = +inp.getAttribute('data-idx')!;
      items[idx].unitCost = parseFloat(inp.value) || 0;
      recalc(idx); onTotals();
    });
  });

  container.querySelectorAll<HTMLButtonElement>(`.${prefix}-remove-item`).forEach((btn) => {
    btn.addEventListener('click', () => {
      items.splice(+btn.getAttribute('data-idx')!, 1);
      onRender(); onTotals();
    });
  });
}

// ── Create / Edit modal ───────────────────────────────────────────────────────

function openPurchaseModal(po: Purchase | null, onSave: () => void): void {
  const isEdit     = po !== null;
  const suppliers  = supplierService.getAll();
  const products   = productService.getAll();
  const currency   = profileService.getCurrencySymbol();
  const prefix     = 'po';

  let items: PurchaseItem[] = po
    ? po.items.map((i) => ({ ...i }))
    : [];

  const form = document.createElement('div');
  form.innerHTML = `
    <div class="form-row" style="margin-bottom:var(--space-4);">
      <div class="form-group">
        <label class="form-label required" for="po-supplier">Supplier</label>
        <select id="po-supplier" class="form-control" ${isEdit ? 'disabled' : ''}>
          <option value="">Select supplier...</option>
          ${suppliers.map((s) => `<option value="${s.id}" ${po?.supplierId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
        ${suppliers.length === 0
          ? `<span class="form-hint" style="color:var(--color-warning);">No suppliers yet — <a href="#/suppliers" style="color:var(--color-primary);">add one first</a></span>`
          : ''}
      </div>
      <div class="form-group">
        <label class="form-label" for="po-status">Status</label>
        <select id="po-status" class="form-control">
          <option value="draft"   ${(!po || po.status === 'draft')   ? 'selected' : ''}>Draft</option>
          <option value="ordered" ${po?.status === 'ordered'         ? 'selected' : ''}>Ordered</option>
        </select>
      </div>
    </div>

    <div class="form-row" style="margin-bottom:var(--space-4);">
      <div class="form-group">
        <label class="form-label" for="po-payment-method">Payment Method</label>
        <select id="po-payment-method" class="form-control">
          <option value="transfer" ${po?.paymentMethod === 'transfer' ? 'selected' : ''}>Bank Transfer</option>
          <option value="cash"     ${po?.paymentMethod === 'cash'     ? 'selected' : ''}>Cash</option>
          <option value="card"     ${po?.paymentMethod === 'card'     ? 'selected' : ''}>Card</option>
          <option value="other"    ${po?.paymentMethod === 'other'    ? 'selected' : ''}>Other</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="po-expected-date">Expected Delivery</label>
        <input type="date" id="po-expected-date" class="form-control"
          value="${po?.expectedDate ? po.expectedDate.slice(0, 10) : ''}" />
      </div>
    </div>

    <!-- Items -->
    <div style="margin-bottom:var(--space-4);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);">
        <div>
          <label class="form-label" style="margin:0;">Order Items</label>
          <div style="display:grid;grid-template-columns:1fr 90px 130px 32px;gap:var(--space-2);margin-top:var(--space-2);">
            <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">Product</span>
            <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">Qty</span>
            <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">Unit Cost (${currency})</span>
            <span></span>
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="po-add-item-btn">${Icons.plus(16)} Add Item</button>
      </div>
      <div id="po-items-container"></div>
      <div id="po-totals" style="margin-top:var(--space-3);text-align:right;font-size:var(--font-size-sm);color:var(--color-text-secondary);"></div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="po-tax">Tax Rate (%)</label>
        <input type="number" id="po-tax" class="form-control" value="${po?.taxRate ?? 0}" min="0" max="100" />
      </div>
      <div class="form-group">
        <label class="form-label" for="po-shipping">Shipping Cost (${currency})</label>
        <input type="number" id="po-shipping" class="form-control" value="${po?.shippingCost ?? 0}" min="0" step="0.01" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="po-notes">Notes</label>
      <textarea id="po-notes" class="form-control" placeholder="Optional notes...">${po?.notes ?? ''}</textarea>
    </div>
  `;

  const updateTotals = () => {
    const taxRate      = parseFloat((form.querySelector('#po-tax')      as HTMLInputElement).value) || 0;
    const shippingCost = parseFloat((form.querySelector('#po-shipping') as HTMLInputElement).value) || 0;
    const { subtotal, taxAmount, total } = purchaseService.calculateTotals(items, taxRate, shippingCost);
    form.querySelector('#po-totals')!.innerHTML = `
      <div>Subtotal: <strong>${formatCurrency(subtotal)}</strong></div>
      <div>Tax: <strong>${formatCurrency(taxAmount)}</strong></div>
      ${shippingCost > 0 ? `<div>Shipping: <strong>${formatCurrency(shippingCost)}</strong></div>` : ''}
      <div style="font-size:var(--font-size-base);font-weight:700;color:var(--color-primary);margin-top:4px;">Total: ${formatCurrency(total)}</div>`;
  };

  const renderItems = () => {
    const container = form.querySelector('#po-items-container')!;
    container.innerHTML = items.length === 0
      ? `<div style="text-align:center;padding:var(--space-4);color:var(--color-text-tertiary);font-size:var(--font-size-sm);border:1px dashed var(--color-border);border-radius:var(--radius-sm);">No items added yet</div>`
      : items.map((item, idx) => buildItemRow(item, idx, products, prefix)).join('');
    attachItemEvents(container as HTMLElement, items, products, prefix, renderItems, updateTotals);
  };

  form.querySelector('#po-add-item-btn')?.addEventListener('click', () => {
    if (products.length === 0) { notifications.warning('No products available.'); return; }
    const first = products[0];
    items.push({ productId: first.id, productName: first.name, quantity: 1, unitCost: first.cost, total: first.cost });
    renderItems(); updateTotals();
  });

  form.querySelector('#po-tax')?.addEventListener('input', updateTotals);
  form.querySelector('#po-shipping')?.addEventListener('input', updateTotals);
  renderItems(); updateTotals();

  openModal({
    title: isEdit ? `Edit ${po!.poNumber}` : 'New Purchase Order',
    content: form,
    size: 'lg',
    confirmText: isEdit ? 'Save Changes' : 'Create PO',
    onConfirm: () => {
      const supplierSelect = form.querySelector<HTMLSelectElement>('#po-supplier')!;
      const supplierId   = isEdit ? po!.supplierId : supplierSelect.value;
      const supplierName = isEdit ? po!.supplierName : (supplierSelect.selectedOptions[0]?.text ?? '');

      if (!supplierId) { showModalError(form, 'Please select a supplier.', ['po-supplier']); return false; }
      if (items.length === 0) { showModalError(form, 'Please add at least one item.'); return false; }

      const taxRate      = parseFloat((form.querySelector('#po-tax')      as HTMLInputElement).value) || 0;
      const shippingCost = parseFloat((form.querySelector('#po-shipping') as HTMLInputElement).value) || 0;
      const status       = (form.querySelector('#po-status') as HTMLSelectElement).value as Purchase['status'];
      const paymentMethod = (form.querySelector('#po-payment-method') as HTMLSelectElement).value as Purchase['paymentMethod'];
      const expectedDate = (form.querySelector('#po-expected-date') as HTMLInputElement).value || undefined;
      const notes        = (form.querySelector('#po-notes') as HTMLTextAreaElement).value.trim();

      if (isEdit) {
        purchaseService.update(po!.id, { items, taxRate, shippingCost, status, paymentMethod, expectedDate, notes });
        notifications.success('Purchase order updated.');
      } else {
        purchaseService.create({ supplierId, supplierName, items, taxRate, shippingCost, status, paymentStatus: 'unpaid', paymentMethod, expectedDate, notes });
        notifications.success('Purchase order created.');
      }
      onSave();
    },
  });
}

// ── Responsive styles ─────────────────────────────────────────────────────────

if (!document.getElementById('purchases-styles')) {
  const style = document.createElement('style');
  style.id = 'purchases-styles';
  style.textContent = `
    .po-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }
    @media (max-width: 1024px) { .po-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px)  { .po-kpi-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(style);
}
