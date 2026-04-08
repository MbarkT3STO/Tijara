/**
 * Sales / Orders feature page.
 * Stock is validated and shown in real-time in both Add and Edit modals.
 */

import { saleService } from '@services/saleService';
import { customerService } from '@services/customerService';
import { productService } from '@services/productService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, debounce } from '@shared/utils/helpers';
import type { Sale, OrderItem, Product } from '@core/types';

const PAGE_SIZE = 10;

interface State {
  sales: Sale[];
  filtered: Sale[];
  page: number;
  search: string;
  statusFilter: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending:   'badge-warning',
  confirmed: 'badge-info',
  shipped:   'badge-primary',
  delivered: 'badge-success',
  cancelled: 'badge-error',
};

const PAYMENT_BADGE: Record<string, string> = {
  unpaid:  'badge-error',
  partial: 'badge-warning',
  paid:    'badge-success',
};

export function renderSales(): HTMLElement {
  const state: State = {
    sales: saleService.getAll(),
    filtered: [],
    page: 1,
    search: '',
    statusFilter: '',
  };
  state.filtered = [...state.sales];

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function applyFilters() {
    let data = [...state.sales];
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(
        (s) => s.orderNumber.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q)
      );
    }
    if (state.statusFilter) data = data.filter((s) => s.status === state.statusFilter);
    state.filtered = data;
    state.page = 1;
  }

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    page.querySelector<HTMLInputElement>('#sale-search')?.addEventListener(
      'input',
      debounce((e: Event) => {
        state.search = (e.target as HTMLInputElement).value;
        applyFilters(); render();
      }, 300) as EventListener
    );

    page.querySelector<HTMLSelectElement>('#status-filter')?.addEventListener('change', (e) => {
      state.statusFilter = (e.target as HTMLSelectElement).value;
      applyFilters(); render();
    });

    page.querySelector('#add-sale-btn')?.addEventListener('click', () => {
      openSaleModal(null, () => { state.sales = saleService.getAll(); applyFilters(); render(); });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sale = saleService.getById(btn.getAttribute('data-view')!);
        if (sale) openSaleDetailModal(sale);
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sale = saleService.getById(btn.getAttribute('data-edit')!);
        if (!sale) return;
        openSaleEditModal(sale, () => { state.sales = saleService.getAll(); applyFilters(); render(); });
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sale = saleService.getById(btn.getAttribute('data-delete')!);
        if (!sale) return;
        confirmDialog('Delete Sale', `Delete order "${sale.orderNumber}"?`, () => {
          saleService.delete(sale.id);
          notifications.success('Sale deleted.');
          state.sales = saleService.getAll(); applyFilters(); render();
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

function buildHTML(state: State): string {
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (state.page - 1) * PAGE_SIZE;
  const pageData = state.filtered.slice(start, start + PAGE_SIZE);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Sales</h2>
        <p class="page-subtitle">${total} order${total !== 1 ? 's' : ''} total</p>
      </div>
      <button class="btn btn-primary" id="add-sale-btn">${Icons.plus()} New Order</button>
    </div>

    <div class="card">
      <div class="card-header" style="gap:var(--space-3);flex-wrap:wrap;">
        <div class="search-bar" style="flex:1;max-width:360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input type="search" id="sale-search" class="form-control" placeholder="Search orders..." value="${state.search}" aria-label="Search orders" />
        </div>
        <select id="status-filter" class="form-control" style="width:auto;" aria-label="Filter by status">
          <option value="">All Statuses</option>
          <option value="pending"   ${state.statusFilter === 'pending'   ? 'selected' : ''}>Pending</option>
          <option value="confirmed" ${state.statusFilter === 'confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="shipped"   ${state.statusFilter === 'shipped'   ? 'selected' : ''}>Shipped</option>
          <option value="delivered" ${state.statusFilter === 'delivered' ? 'selected' : ''}>Delivered</option>
          <option value="cancelled" ${state.statusFilter === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </div>

      <div class="table-container" style="border:none;border-radius:0;">
        <table class="data-table" aria-label="Sales list">
          <thead>
            <tr>
              <th>Order #</th><th>Customer</th><th>Items</th><th>Total</th>
              <th>Status</th><th>Payment</th><th>Date</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0
              ? `<tr><td colspan="8"><div class="empty-state">
                  <div class="empty-state-icon">${Icons.sales(32)}</div>
                  <p class="empty-state-title">No orders found</p>
                  <p class="empty-state-desc">${state.search ? 'Try a different search.' : 'Create your first order.'}</p>
                </div></td></tr>`
              : pageData.map((s) => `
                <tr>
                  <td><span style="font-weight:600;color:var(--color-primary);">${s.orderNumber}</span></td>
                  <td>${s.customerName}</td>
                  <td style="color:var(--color-text-secondary);">${s.items.length} item${s.items.length !== 1 ? 's' : ''}</td>
                  <td><strong>${formatCurrency(s.total)}</strong></td>
                  <td><span class="badge ${STATUS_BADGE[s.status] ?? 'badge-neutral'}">${s.status}</span></td>
                  <td><span class="badge ${PAYMENT_BADGE[s.paymentStatus] ?? 'badge-neutral'}">${s.paymentStatus}</span></td>
                  <td style="color:var(--color-text-secondary);">${formatDate(s.createdAt)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-ghost btn-icon btn-sm" data-view="${s.id}" aria-label="View" data-tooltip="View">${Icons.eye(16)}</button>
                      <button class="btn btn-ghost btn-icon btn-sm" data-edit="${s.id}" aria-label="Edit" data-tooltip="Edit">${Icons.edit(16)}</button>
                      <button class="btn btn-ghost btn-icon btn-sm" data-delete="${s.id}" aria-label="Delete" data-tooltip="Delete" style="color:var(--color-error);">${Icons.trash(16)}</button>
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

// ── Shared item builder ───────────────────────────────────────────────────────

/**
 * Build the product option list with stock info.
 * Out-of-stock products are marked and disabled.
 * For edit mode, reservedStock maps productId → qty already in the original order
 * so those units are treated as "available" for this order.
 */
function buildProductOptions(
  products: Product[],
  selectedId: string,
  reservedStock: Map<string, number> = new Map()
): string {
  return products.map((p) => {
    const reserved = reservedStock.get(p.id) ?? 0;
    const available = p.stock + reserved; // stock already consumed by this order is "available"
    const outOfStock = available <= 0;
    const label = outOfStock
      ? `${p.name} — OUT OF STOCK`
      : `${p.name} (${available} ${p.unit} available)`;
    return `<option value="${p.id}"
      data-price="${p.price}"
      data-name="${p.name}"
      data-stock="${available}"
      data-unit="${p.unit}"
      ${p.id === selectedId ? 'selected' : ''}
      ${outOfStock ? 'disabled' : ''}
    >${label}</option>`;
  }).join('');
}

/** Validate all items against available stock. Returns error message or null. */
function validateStock(
  items: OrderItem[],
  products: Product[],
  reservedStock: Map<string, number> = new Map()
): string | null {
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) continue;
    const reserved = reservedStock.get(item.productId) ?? 0;
    const available = product.stock + reserved;
    if (item.quantity > available) {
      return `"${product.name}" only has ${available} ${product.unit} available, but ${item.quantity} requested.`;
    }
  }
  return null;
}

/** Render a single item row with stock badge */
function buildItemRow(
  item: OrderItem,
  idx: number,
  products: Product[],
  prefix: string,
  reservedStock: Map<string, number>
): string {
  const product = products.find((p) => p.id === item.productId);
  const reserved = reservedStock.get(item.productId) ?? 0;
  const available = (product?.stock ?? 0) + reserved;
  const overStock = item.quantity > available;
  const stockBadge = product
    ? `<span class="badge ${available === 0 ? 'badge-error' : overStock ? 'badge-warning' : 'badge-success'}" style="font-size:10px;white-space:nowrap;">
        ${available === 0 ? 'Out of stock' : overStock ? `Over by ${item.quantity - available}` : `${available} avail.`}
      </span>`
    : '';

  return `
    <div style="display:grid;grid-template-columns:1fr 90px 110px 80px auto;gap:var(--space-2);align-items:start;margin-bottom:var(--space-3);">
      <div>
        <select class="form-control ${prefix}-item-product" data-idx="${idx}" style="${overStock ? 'border-color:var(--color-warning);' : ''}">
          ${buildProductOptions(products, item.productId, reservedStock)}
        </select>
        <div style="margin-top:4px;">${stockBadge}</div>
      </div>
      <div>
        <input type="number" class="form-control ${prefix}-item-qty" data-idx="${idx}"
          value="${item.quantity}" min="1" max="${available > 0 ? available : 9999}" placeholder="Qty"
          style="${overStock ? 'border-color:var(--color-warning);' : ''}" />
      </div>
      <input type="number" class="form-control ${prefix}-item-price" data-idx="${idx}"
        value="${item.unitPrice}" min="0" step="0.01" placeholder="Price" />
      <input type="number" class="form-control ${prefix}-item-discount" data-idx="${idx}"
        value="${item.discount}" min="0" max="100" placeholder="Disc%" />
      <button type="button" class="btn btn-ghost btn-icon btn-sm ${prefix}-remove-item"
        data-idx="${idx}" style="color:var(--color-error);margin-top:2px;">${Icons.trash(16)}</button>
    </div>`;
}

/** Wire up all item-level events for a container */
function attachItemEvents(
  container: HTMLElement,
  items: OrderItem[],
  products: Product[],
  prefix: string,
  reservedStock: Map<string, number>,
  onRender: () => void,
  onTotals: () => void
): void {
  const recalc = (idx: number) => {
    const item = items[idx];
    item.total = item.unitPrice * (1 - item.discount / 100) * item.quantity;
  };

  container.querySelectorAll<HTMLSelectElement>(`.${prefix}-item-product`).forEach((sel) => {
    sel.addEventListener('change', () => {
      const idx = +sel.getAttribute('data-idx')!;
      const opt = sel.selectedOptions[0];
      items[idx].productId   = sel.value;
      items[idx].productName = opt.getAttribute('data-name') ?? '';
      items[idx].unitPrice   = parseFloat(opt.getAttribute('data-price') ?? '0');
      items[idx].quantity    = 1;
      recalc(idx); onRender(); onTotals();
    });
  });

  container.querySelectorAll<HTMLInputElement>(`.${prefix}-item-qty`).forEach((inp) => {
    inp.addEventListener('input', () => {
      const idx = +inp.getAttribute('data-idx')!;
      items[idx].quantity = parseInt(inp.value) || 1;
      recalc(idx); onRender(); onTotals();
    });
  });

  container.querySelectorAll<HTMLInputElement>(`.${prefix}-item-price`).forEach((inp) => {
    inp.addEventListener('input', () => {
      const idx = +inp.getAttribute('data-idx')!;
      items[idx].unitPrice = parseFloat(inp.value) || 0;
      recalc(idx); onTotals();
    });
  });

  container.querySelectorAll<HTMLInputElement>(`.${prefix}-item-discount`).forEach((inp) => {
    inp.addEventListener('input', () => {
      const idx = +inp.getAttribute('data-idx')!;
      items[idx].discount = parseFloat(inp.value) || 0;
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

// ── Detail modal ──────────────────────────────────────────────────────────────

function openSaleDetailModal(sale: Sale): void {
  const content = document.createElement('div');
  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-5);">
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Customer</div>
        <div style="font-weight:500;">${sale.customerName}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Date</div>
        <div>${formatDate(sale.createdAt)}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Status</div>
        <span class="badge ${STATUS_BADGE[sale.status]}">${sale.status}</span>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Payment</div>
        <span class="badge ${PAYMENT_BADGE[sale.paymentStatus]}">${sale.paymentStatus}</span>
      </div>
    </div>
    <div class="table-container" style="margin-bottom:var(--space-4);">
      <table class="data-table">
        <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>Total</th></tr></thead>
        <tbody>
          ${sale.items.map((item) => `
            <tr>
              <td>${item.productName}</td>
              <td>${item.quantity}</td>
              <td>${formatCurrency(item.unitPrice)}</td>
              <td>${item.discount}%</td>
              <td><strong>${formatCurrency(item.total)}</strong></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="display:flex;flex-direction:column;gap:var(--space-2);align-items:flex-end;">
      <div style="display:flex;gap:var(--space-8);"><span style="color:var(--color-text-secondary);">Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
      <div style="display:flex;gap:var(--space-8);"><span style="color:var(--color-text-secondary);">Tax (${sale.taxRate}%)</span><span>${formatCurrency(sale.taxAmount)}</span></div>
      ${sale.discount > 0 ? `<div style="display:flex;gap:var(--space-8);"><span style="color:var(--color-text-secondary);">Discount</span><span style="color:var(--color-error);">-${formatCurrency(sale.discount)}</span></div>` : ''}
      <div style="display:flex;gap:var(--space-8);font-size:var(--font-size-lg);font-weight:700;border-top:1px solid var(--color-border);padding-top:var(--space-2);margin-top:var(--space-1);">
        <span>Total</span><span style="color:var(--color-primary);">${formatCurrency(sale.total)}</span>
      </div>
    </div>
    ${sale.notes ? `<div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--color-bg-secondary);border-radius:var(--radius-sm);font-size:var(--font-size-sm);color:var(--color-text-secondary);">${sale.notes}</div>` : ''}
  `;
  openModal({ title: `Order ${sale.orderNumber}`, content, size: 'lg', hideFooter: true });
}

// ── Add Sale modal ────────────────────────────────────────────────────────────

function openSaleModal(_sale: Sale | null, onSave: () => void): void {
  const customers = customerService.getAll();
  const products  = productService.getAll();
  let items: OrderItem[] = [];
  // No reserved stock for new orders
  const reserved = new Map<string, number>();

  const form = document.createElement('div');
  form.innerHTML = `
    <div class="form-row" style="margin-bottom:var(--space-4);">
      <div class="form-group">
        <label class="form-label required" for="s-customer">Customer</label>
        <select id="s-customer" class="form-control" required>
          <option value="">Select customer...</option>
          ${customers.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="s-payment">Payment Method</label>
        <select id="s-payment" class="form-control">
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="transfer">Bank Transfer</option>
          <option value="other">Other</option>
        </select>
      </div>
    </div>

    <div style="margin-bottom:var(--space-4);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);">
        <label class="form-label" style="margin:0;">Order Items</label>
        <button type="button" class="btn btn-secondary btn-sm" id="add-item-btn">${Icons.plus(16)} Add Item</button>
      </div>
      <div id="items-container"></div>
      <div id="order-totals" style="margin-top:var(--space-3);text-align:right;font-size:var(--font-size-sm);color:var(--color-text-secondary);"></div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="s-tax">Tax Rate (%)</label>
        <input type="number" id="s-tax" class="form-control" value="10" min="0" max="100" />
      </div>
      <div class="form-group">
        <label class="form-label" for="s-discount">Discount ($)</label>
        <input type="number" id="s-discount" class="form-control" value="0" min="0" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="s-notes">Notes</label>
      <textarea id="s-notes" class="form-control" placeholder="Optional notes..."></textarea>
    </div>
  `;

  const updateTotals = () => {
    const taxRate  = parseFloat((form.querySelector('#s-tax')      as HTMLInputElement).value) || 0;
    const discount = parseFloat((form.querySelector('#s-discount') as HTMLInputElement).value) || 0;
    const { subtotal, taxAmount, total } = saleService.calculateTotals(items, taxRate, discount);
    form.querySelector('#order-totals')!.innerHTML = `
      <div>Subtotal: <strong>${formatCurrency(subtotal)}</strong></div>
      <div>Tax: <strong>${formatCurrency(taxAmount)}</strong></div>
      <div style="font-size:var(--font-size-base);font-weight:700;color:var(--color-primary);margin-top:4px;">Total: ${formatCurrency(total)}</div>`;
  };

  const renderItems = () => {
    const container = form.querySelector('#items-container')!;
    container.innerHTML = items.length === 0
      ? `<div style="text-align:center;padding:var(--space-4);color:var(--color-text-tertiary);font-size:var(--font-size-sm);border:1px dashed var(--color-border);border-radius:var(--radius-sm);">No items added yet</div>`
      : items.map((item, idx) => buildItemRow(item, idx, products, 's', reserved)).join('');
    attachItemEvents(container as HTMLElement, items, products, 's', reserved, renderItems, updateTotals);
  };

  form.querySelector('#add-item-btn')?.addEventListener('click', () => {
    const available = products.filter((p) => p.stock > 0);
    if (available.length === 0) {
      notifications.warning('All products are out of stock.');
      return;
    }
    const first = available[0];
    items.push({ productId: first.id, productName: first.name, quantity: 1, unitPrice: first.price, discount: 0, total: first.price });
    renderItems(); updateTotals();
  });

  form.querySelector('#s-tax')?.addEventListener('input', updateTotals);
  form.querySelector('#s-discount')?.addEventListener('input', updateTotals);
  renderItems(); updateTotals();

  openModal({
    title: 'New Order',
    content: form,
    size: 'lg',
    confirmText: 'Create Order',
    onConfirm: () => {
      const customerSelect = form.querySelector<HTMLSelectElement>('#s-customer')!;
      const customerId = customerSelect.value;
      const customerName = customerSelect.selectedOptions[0]?.text ?? '';

      if (!customerId) { notifications.error('Please select a customer.'); return; }
      if (items.length === 0) { notifications.error('Please add at least one item.'); return; }

      // Stock validation
      const stockError = validateStock(items, products, reserved);
      if (stockError) { notifications.error(stockError); return; }

      const taxRate      = parseFloat((form.querySelector('#s-tax')      as HTMLInputElement).value) || 0;
      const discount     = parseFloat((form.querySelector('#s-discount') as HTMLInputElement).value) || 0;
      const paymentMethod = (form.querySelector('#s-payment') as HTMLSelectElement).value as Sale['paymentMethod'];
      const notes        = (form.querySelector('#s-notes') as HTMLTextAreaElement).value.trim();

      saleService.create({ customerId, customerName, items, taxRate, discount, status: 'pending', paymentStatus: 'unpaid', paymentMethod, notes });
      notifications.success('Order created successfully.');
      onSave();
    },
  });
}

// ── Edit Sale modal ───────────────────────────────────────────────────────────

function openSaleEditModal(sale: Sale, onSave: () => void): void {
  const products = productService.getAll();
  let items: OrderItem[] = sale.items.map((i) => ({ ...i }));

  /**
   * Reserved stock = quantities already consumed by THIS order.
   * When editing, those units are "available" again for this order's items.
   * We aggregate by productId in case the same product appears multiple times.
   */
  const reserved = new Map<string, number>();
  if (sale.status !== 'cancelled') {
    sale.items.forEach((item) => {
      reserved.set(item.productId, (reserved.get(item.productId) ?? 0) + item.quantity);
    });
  }

  const form = document.createElement('div');
  form.innerHTML = `
    <div class="form-row" style="margin-bottom:var(--space-4);">
      <div class="form-group">
        <label class="form-label" for="se-status">Order Status</label>
        <select id="se-status" class="form-control">
          <option value="pending"   ${sale.status === 'pending'   ? 'selected' : ''}>Pending</option>
          <option value="confirmed" ${sale.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="shipped"   ${sale.status === 'shipped'   ? 'selected' : ''}>Shipped</option>
          <option value="delivered" ${sale.status === 'delivered' ? 'selected' : ''}>Delivered</option>
          <option value="cancelled" ${sale.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="se-payment-status">Payment Status</label>
        <select id="se-payment-status" class="form-control">
          <option value="unpaid"  ${sale.paymentStatus === 'unpaid'  ? 'selected' : ''}>Unpaid</option>
          <option value="partial" ${sale.paymentStatus === 'partial' ? 'selected' : ''}>Partial</option>
          <option value="paid"    ${sale.paymentStatus === 'paid'    ? 'selected' : ''}>Paid</option>
        </select>
      </div>
    </div>
    <div class="form-row" style="margin-bottom:var(--space-4);">
      <div class="form-group">
        <label class="form-label" for="se-payment-method">Payment Method</label>
        <select id="se-payment-method" class="form-control">
          <option value="cash"     ${sale.paymentMethod === 'cash'     ? 'selected' : ''}>Cash</option>
          <option value="card"     ${sale.paymentMethod === 'card'     ? 'selected' : ''}>Card</option>
          <option value="transfer" ${sale.paymentMethod === 'transfer' ? 'selected' : ''}>Bank Transfer</option>
          <option value="other"    ${sale.paymentMethod === 'other'    ? 'selected' : ''}>Other</option>
        </select>
      </div>
    </div>

    <div style="margin-bottom:var(--space-4);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);">
        <label class="form-label" style="margin:0;">Order Items</label>
        <button type="button" class="btn btn-secondary btn-sm" id="se-add-item-btn">${Icons.plus(16)} Add Item</button>
      </div>
      <div id="se-items-container"></div>
      <div id="se-order-totals" style="margin-top:var(--space-3);text-align:right;font-size:var(--font-size-sm);color:var(--color-text-secondary);"></div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="se-tax">Tax Rate (%)</label>
        <input type="number" id="se-tax" class="form-control" value="${sale.taxRate}" min="0" max="100" />
      </div>
      <div class="form-group">
        <label class="form-label" for="se-discount">Discount ($)</label>
        <input type="number" id="se-discount" class="form-control" value="${sale.discount}" min="0" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="se-notes">Notes</label>
      <textarea id="se-notes" class="form-control" placeholder="Optional notes...">${sale.notes ?? ''}</textarea>
    </div>
  `;

  const updateTotals = () => {
    const taxRate  = parseFloat((form.querySelector('#se-tax')      as HTMLInputElement).value) || 0;
    const discount = parseFloat((form.querySelector('#se-discount') as HTMLInputElement).value) || 0;
    const { subtotal, taxAmount, total } = saleService.calculateTotals(items, taxRate, discount);
    form.querySelector('#se-order-totals')!.innerHTML = `
      <div>Subtotal: <strong>${formatCurrency(subtotal)}</strong></div>
      <div>Tax: <strong>${formatCurrency(taxAmount)}</strong></div>
      <div style="font-size:var(--font-size-base);font-weight:700;color:var(--color-primary);margin-top:4px;">Total: ${formatCurrency(total)}</div>`;
  };

  const renderItems = () => {
    const container = form.querySelector('#se-items-container')!;
    container.innerHTML = items.length === 0
      ? `<div style="text-align:center;padding:var(--space-4);color:var(--color-text-tertiary);font-size:var(--font-size-sm);border:1px dashed var(--color-border);border-radius:var(--radius-sm);">No items</div>`
      : items.map((item, idx) => buildItemRow(item, idx, products, 'se', reserved)).join('');
    attachItemEvents(container as HTMLElement, items, products, 'se', reserved, renderItems, updateTotals);
  };

  form.querySelector('#se-add-item-btn')?.addEventListener('click', () => {
    const first = products.find((p) => {
      const res = reserved.get(p.id) ?? 0;
      return (p.stock + res) > 0;
    }) ?? products[0];
    if (!first) { notifications.warning('No products available.'); return; }
    items.push({ productId: first.id, productName: first.name, quantity: 1, unitPrice: first.price, discount: 0, total: first.price });
    renderItems(); updateTotals();
  });

  form.querySelector('#se-tax')?.addEventListener('input', updateTotals);
  form.querySelector('#se-discount')?.addEventListener('input', updateTotals);
  renderItems(); updateTotals();

  openModal({
    title: `Edit Order ${sale.orderNumber}`,
    content: form,
    size: 'lg',
    confirmText: 'Save Changes',
    onConfirm: () => {
      if (items.length === 0) { notifications.error('Add at least one item.'); return; }

      const newStatus = (form.querySelector('#se-status') as HTMLSelectElement).value as Sale['status'];

      // Only validate stock when the order is not being cancelled
      if (newStatus !== 'cancelled') {
        const stockError = validateStock(items, products, reserved);
        if (stockError) { notifications.error(stockError); return; }
      }

      const taxRate  = parseFloat((form.querySelector('#se-tax')      as HTMLInputElement).value) || 0;
      const discount = parseFloat((form.querySelector('#se-discount') as HTMLInputElement).value) || 0;
      const { subtotal, taxAmount, total } = saleService.calculateTotals(items, taxRate, discount);

      // Reconcile stock: restore original items, then decrement new items.
      // saleService.updateStatus handles cancel/uncancel stock logic,
      // but item changes need explicit reconciliation here.
      if (sale.status !== 'cancelled' && newStatus !== 'cancelled') {
        import('@services/inventoryService').then(({ inventoryService }) => {
          // Restore old items
          sale.items.forEach((item) => {
            inventoryService.recordMovement(item.productId, 'return', item.quantity, sale.orderNumber, 'Item edit – restoring old qty');
          });
          // Decrement new items
          items.forEach((item) => {
            inventoryService.recordMovement(item.productId, 'sale', -item.quantity, sale.orderNumber, 'Item edit – applying new qty');
          });
        });
      }

      saleService.update(sale.id, {
        items, subtotal, taxRate, taxAmount, discount, total,
        status:        newStatus,
        paymentStatus: (form.querySelector('#se-payment-status') as HTMLSelectElement).value as Sale['paymentStatus'],
        paymentMethod: (form.querySelector('#se-payment-method') as HTMLSelectElement).value as Sale['paymentMethod'],
        notes:         (form.querySelector('#se-notes') as HTMLTextAreaElement).value.trim(),
      });

      notifications.success('Order updated successfully.');
      onSave();
    },
  });
}
