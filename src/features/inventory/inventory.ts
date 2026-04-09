/**
 * Inventory feature page.
 * Shows stock KPIs, low-stock alerts, movement history, and adjustment tools.
 */

import { inventoryService } from '@services/inventoryService';
import { productService } from '@services/productService';
import { notifications } from '@core/notifications';
import { openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDateTime, debounce } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import type { StockMovement, StockMovementType, Product } from '@core/types';

const PAGE_SIZE = 15;

const MOVEMENT_BADGE: Record<StockMovementType, string> = {
  purchase:   'badge-success',
  initial:    'badge-info',
  sale:       'badge-warning',
  adjustment: 'badge-primary',
  return:     'badge-neutral',
};

const MOVEMENT_LABEL = (): Record<StockMovementType, string> => ({
  purchase:   i18n.t('inventory.type.purchase'),
  initial:    i18n.t('inventory.type.initial'),
  sale:       i18n.t('inventory.type.sale'),
  adjustment: i18n.t('inventory.type.adjustment'),
  return:     i18n.t('inventory.type.return'),
});

interface State {
  movements: StockMovement[];
  filtered: StockMovement[];
  page: number;
  search: string;
  typeFilter: string;
}

export function renderInventory(): HTMLElement {
  const state: State = {
    movements: inventoryService.getAllMovements(),
    filtered: [],
    page: 1,
    search: '',
    typeFilter: '',
  };
  state.filtered = [...state.movements];

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function applyFilters() {
    let data = [...state.movements];
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(
        (m) =>
          m.productName.toLowerCase().includes(q) ||
          (m.reference ?? '').toLowerCase().includes(q) ||
          (m.notes ?? '').toLowerCase().includes(q)
      );
    }
    if (state.typeFilter) {
      data = data.filter((m) => m.type === state.typeFilter);
    }
    state.filtered = data;
    state.page = 1;
  }

  function refresh() {
    state.movements = inventoryService.getAllMovements();
    applyFilters();
  }

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    // Search
    page.querySelector<HTMLInputElement>('#inv-search')?.addEventListener(
      'input',
      debounce((e: Event) => {
        state.search = (e.target as HTMLInputElement).value;
        applyFilters();
        render();
      }, 300) as EventListener
    );

    // Type filter
    page.querySelector<HTMLSelectElement>('#inv-type-filter')?.addEventListener('change', (e) => {
      state.typeFilter = (e.target as HTMLSelectElement).value;
      applyFilters();
      render();
    });

    // Adjust stock button
    page.querySelector('#adjust-stock-btn')?.addEventListener('click', () => {
      openAdjustModal(() => { refresh(); render(); });
    });

    // Restock button
    page.querySelector('#restock-btn')?.addEventListener('click', () => {
      openRestockModal(() => { refresh(); render(); });
    });

    // Reorder settings button
    page.querySelector('#reorder-settings-btn')?.addEventListener('click', () => {
      openReorderSettingsModal(() => { refresh(); render(); });
    });

    // Low-stock restock quick buttons
    page.querySelectorAll<HTMLButtonElement>('[data-quick-restock]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-quick-restock')!;
        const product = productService.getById(id);
        if (!product) return;
        openRestockModal(() => { refresh(); render(); }, product);
      });
    });

    // Pagination
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
  const products = productService.getAll();
  const lowStock = inventoryService.getLowStockProducts();
  const outOfStock = inventoryService.getOutOfStockProducts();
  const stockValue = inventoryService.getTotalStockValue();
  const retailValue = inventoryService.getTotalRetailValue();

  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (state.page - 1) * PAGE_SIZE;
  const pageData = state.filtered.slice(start, start + PAGE_SIZE);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('inventory.title')}</h2>
        <p class="page-subtitle">${i18n.t('inventory.subtitle')}</p>
      </div>
      <div class="toolbar">
        <button class="btn btn-secondary" id="reorder-settings-btn">
          ${Icons.settings(16)} ${i18n.t('inventory.reorderSettings')}
        </button>
        <button class="btn btn-secondary" id="restock-btn">
          ${Icons.download(16)} ${i18n.t('inventory.restock')}
        </button>
        <button class="btn btn-primary" id="adjust-stock-btn">
          ${Icons.refresh(16)} ${i18n.t('inventory.adjustStock')}
        </button>
      </div>
    </div>

    <!-- KPI cards -->
    <div class="inv-kpi-grid">
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-primary-subtle);color:var(--color-primary);">${Icons.package()}</div>
        <div class="stat-card-value">${products.length}</div>
        <div class="stat-card-label">${i18n.t('inventory.totalProducts')}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-success-subtle);color:var(--color-success);">${Icons.dollarSign()}</div>
        <div class="stat-card-value">${formatCurrency(stockValue)}</div>
        <div class="stat-card-label">${i18n.t('inventory.stockCostValue')}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-info-subtle);color:var(--color-info);">${Icons.dollarSign()}</div>
        <div class="stat-card-value">${formatCurrency(retailValue)}</div>
        <div class="stat-card-label">${i18n.t('inventory.retailValue')}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-warning-subtle);color:var(--color-warning);">${Icons.alertCircle()}</div>
        <div class="stat-card-value">${lowStock.length}</div>
        <div class="stat-card-label">${i18n.t('inventory.lowStockItems')}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-error-subtle);color:var(--color-error);">${Icons.close()}</div>
        <div class="stat-card-value">${outOfStock.length}</div>
        <div class="stat-card-label">${i18n.t('inventory.outOfStock')}</div>
      </div>
    </div>

    <!-- Low stock alerts -->
    ${lowStock.length > 0 ? `
    <div class="card" style="margin-bottom:var(--space-5);">
      <div class="card-header">
        <h3 class="card-title" style="color:var(--color-warning);">${Icons.alertCircle(16)} ${i18n.t('inventory.lowStockAlerts')}</h3>
        <span class="badge badge-warning">${lowStock.length}</span>
      </div>
      <div class="table-container" style="border:none;border-radius:0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>${i18n.t('products.modals.name')}</th>
              <th>${i18n.t('products.sku')}</th>
              <th>${i18n.t('inventory.status.inStock')}</th>
              <th>${i18n.t('inventory.reorderSettings')}</th>
              <th>${i18n.t('inventory.suggestedRestock')}</th>
              <th>${i18n.t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${lowStock.map((p) => `
              <tr>
                <td><span style="font-weight:500;">${p.name}</span></td>
                <td><code style="font-size:var(--font-size-xs);background:var(--color-bg-secondary);padding:2px 6px;border-radius:var(--radius-xs);">${p.sku}</code></td>
                <td>
                  <span class="badge ${p.stock === 0 ? 'badge-error' : 'badge-warning'}">
                    ${p.stock} ${p.unit}
                  </span>
                </td>
                <td style="color:var(--color-text-secondary);">${p.reorderPoint} ${p.unit}</td>
                <td style="color:var(--color-text-secondary);">${p.reorderQuantity} ${p.unit}</td>
                <td>
                  <button class="btn btn-secondary btn-sm" data-quick-restock="${p.id}">
                    ${Icons.download(14)} ${i18n.t('inventory.restock')}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}

    <!-- Stock levels overview -->
    <div class="card" style="margin-bottom:var(--space-5);">
      <div class="card-header">
        <h3 class="card-title">${i18n.t('inventory.stockLevels')}</h3>
      </div>
      <div class="table-container" style="border:none;border-radius:0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>${i18n.t('products.modals.name')}</th>
              <th>${i18n.t('products.sku')}</th>
              <th>${i18n.t('products.category')}</th>
              <th>${i18n.t('inventory.status.inStock')}</th>
              <th>${i18n.t('inventory.reorderSettings')}</th>
              <th>${i18n.t('inventory.stockCostValue')}</th>
              <th>${i18n.t('inventory.retailValue')}</th>
              <th>${i18n.t('common.status')}</th>
            </tr>
          </thead>
          <tbody>
            ${products.length === 0
              ? `<tr><td colspan="8"><div class="empty-state"><p class="empty-state-title">${i18n.t('common.noData')}</p></div></td></tr>`
              : products.map((p) => {
                  const costVal = p.stock * p.cost;
                  const retailVal = p.stock * p.price;
                  const isLow = p.stock > 0 && p.stock <= p.reorderPoint;
                  const isOut = p.stock === 0;
                  const statusClass = isOut ? 'badge-error' : isLow ? 'badge-warning' : 'badge-success';
                  const statusLabel = isOut ? i18n.t('inventory.status.outOfStock') : isLow ? i18n.t('inventory.status.lowStock') : i18n.t('inventory.status.inStock');
                  return `
                    <tr>
                      <td><span style="font-weight:500;">${p.name}</span></td>
                      <td><code style="font-size:var(--font-size-xs);background:var(--color-bg-secondary);padding:2px 6px;border-radius:var(--radius-xs);">${p.sku}</code></td>
                      <td><span class="badge badge-primary">${p.category}</span></td>
                      <td><strong>${p.stock} ${p.unit}</strong></td>
                      <td style="color:var(--color-text-secondary);">${p.reorderPoint}</td>
                      <td style="color:var(--color-text-secondary);">${formatCurrency(costVal)}</td>
                      <td style="color:var(--color-text-secondary);">${formatCurrency(retailVal)}</td>
                      <td><span class="badge ${statusClass}">${statusLabel}</span></td>
                    </tr>`;
                }).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Movement history -->
    <div class="card">
      <div class="card-header" style="gap:var(--space-3);flex-wrap:wrap;">
        <h3 class="card-title">${i18n.t('inventory.movementHistory')}</h3>
        <div style="display:flex;gap:var(--space-3);flex:1;justify-content:flex-end;flex-wrap:wrap;">
          <div class="search-bar" style="max-width:300px;flex:1;">
            <span class="search-icon">${Icons.search(16)}</span>
            <input type="search" id="inv-search" class="form-control" placeholder="${i18n.t('common.search')}..." value="${state.search}" aria-label="${i18n.t('common.search')}" />
          </div>
          <select id="inv-type-filter" class="form-control" style="width:auto;" aria-label="${i18n.t('common.filter')}">
            <option value="">${i18n.t('inventory.allTypes')}</option>
            <option value="purchase"   ${state.typeFilter === 'purchase'   ? 'selected' : ''}>${i18n.t('inventory.type.purchase')}</option>
            <option value="sale"       ${state.typeFilter === 'sale'       ? 'selected' : ''}>${i18n.t('inventory.type.sale')}</option>
            <option value="adjustment" ${state.typeFilter === 'adjustment' ? 'selected' : ''}>${i18n.t('inventory.type.adjustment')}</option>
            <option value="return"     ${state.typeFilter === 'return'     ? 'selected' : ''}>${i18n.t('inventory.type.return')}</option>
            <option value="initial"    ${state.typeFilter === 'initial'    ? 'selected' : ''}>${i18n.t('inventory.type.initial')}</option>
          </select>
        </div>
      </div>

      <div class="table-container" style="border:none;border-radius:0;">
        <table class="data-table" aria-label="Stock movement history">
          <thead>
            <tr>
              <th>${i18n.t('common.date')}</th>
              <th>${i18n.t('products.modals.name')}</th>
              <th>${i18n.t('common.status')}</th>
              <th>${i18n.t('inventory.qtyChange')}</th>
              <th>${i18n.t('inventory.before')}</th>
              <th>${i18n.t('inventory.after')}</th>
              <th>${i18n.t('inventory.reference')}</th>
              <th>${i18n.t('inventory.notes')}</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0
              ? `<tr><td colspan="8">
                  <div class="empty-state">
                    <div class="empty-state-icon">${Icons.package(32)}</div>
                    <p class="empty-state-title">${i18n.t('common.noData')}</p>
                    <p class="empty-state-desc">${state.search || state.typeFilter ? i18n.t('errors.loadFailed') : i18n.t('common.noData')}</p>
                  </div>
                </td></tr>`
              : pageData.map((m) => {
                  const isIn = m.quantity > 0;
                  return `
                    <tr>
                      <td style="color:var(--color-text-secondary);white-space:nowrap;">${formatDateTime(m.createdAt)}</td>
                      <td><span style="font-weight:500;">${m.productName}</span></td>
                      <td><span class="badge ${MOVEMENT_BADGE[m.type]}">${MOVEMENT_LABEL()[m.type]}</span></td>
                      <td>
                        <span style="font-weight:600;color:${isIn ? 'var(--color-success)' : 'var(--color-error)}'};">
                          ${isIn ? '+' : ''}${m.quantity}
                        </span>
                      </td>
                      <td style="color:var(--color-text-secondary);">${m.stockBefore}</td>
                      <td style="font-weight:500;">${m.stockAfter}</td>
                      <td style="color:var(--color-text-secondary);">${m.reference ? `<code style="font-size:var(--font-size-xs);background:var(--color-bg-secondary);padding:2px 6px;border-radius:var(--radius-xs);">${m.reference}</code>` : '—'}</td>
                      <td style="color:var(--color-text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${m.notes ?? ''}">${m.notes ?? '—'}</td>
                    </tr>`;
                }).join('')
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
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1);
  return `
    <div class="pagination">
      <span class="pagination-info">${i18n.t('common.showing' as any)} ${start + 1}–${start + count} / ${total}</span>
      <div class="pagination-controls">
        <button class="pagination-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>${Icons.chevronLeft(16)}</button>
        ${pages.map((p) => `<button class="pagination-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`).join('')}
        <button class="pagination-btn" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>${Icons.chevronRight(16)}</button>
      </div>
    </div>`;
}

// ── Modals ────────────────────────────────────────────────────────────────────

function openAdjustModal(onSave: () => void): void {
  const products = productService.getAll();

  const form = document.createElement('div');
  form.innerHTML = `
  <div class="form-group" style="margin-bottom:var(--space-4);">
      <label class="form-label required" for="adj-product">${i18n.t('products.modals.name')}</label>
      <select id="adj-product" class="form-control">
        <option value="">${i18n.t('inventory.modals.selectProduct')}</option>
        ${products.map((p) => `<option value="${p.id}" data-stock="${p.stock}">${p.name} (${p.sku}) — ${p.stock} ${p.unit}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="adj-qty">${i18n.t('inventory.qtyChange')}</label>
        <input type="number" id="adj-qty" class="form-control" placeholder="e.g. -5 o +10" step="1" />
      </div>
      <div class="form-group">
        <label class="form-label" for="adj-preview">${i18n.t('inventory.modals.newStockLevel')}</label>
        <div id="adj-preview" class="form-control" style="background:var(--color-bg-secondary);cursor:default;">${i18n.t('common.noData')}</div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="adj-notes">${i18n.t('inventory.modals.reason')}</label>
      <textarea id="adj-notes" class="form-control" placeholder="..."></textarea>
    </div>
  `;

  // Live preview
  const updatePreview = () => {
    const sel = form.querySelector<HTMLSelectElement>('#adj-product')!;
    const qty = parseInt((form.querySelector('#adj-qty') as HTMLInputElement).value) || 0;
    const opt = sel.selectedOptions[0];
    const current = parseInt(opt?.getAttribute('data-stock') ?? '0');
    const preview = form.querySelector<HTMLElement>('#adj-preview')!;
    if (sel.value && qty !== 0) {
      const newStock = Math.max(0, current + qty);
      preview.textContent = String(newStock);
      preview.style.color = newStock === 0 ? 'var(--color-error)' : newStock < 10 ? 'var(--color-warning)' : 'var(--color-success)';
    } else {
      preview.textContent = '—';
      preview.style.color = '';
    }
  };

  form.querySelector('#adj-product')?.addEventListener('change', updatePreview);
  form.querySelector('#adj-qty')?.addEventListener('input', updatePreview);

  openModal({
    title: i18n.t('inventory.modals.adjustTitle'),
    content: form,
    confirmText: i18n.t('inventory.modals.adjustConfirm'),
    onConfirm: () => {
      const productId = (form.querySelector('#adj-product') as HTMLSelectElement).value;
      const qty = parseInt((form.querySelector('#adj-qty') as HTMLInputElement).value);
      const notes = (form.querySelector('#adj-notes') as HTMLTextAreaElement).value.trim();

      if (!productId) { showModalError(form, i18n.t('errors.required'), ['adj-product']); return false; }
      if (isNaN(qty) || qty === 0) { showModalError(form, i18n.t('errors.required'), ['adj-qty']); return false; }

      const result = inventoryService.adjust(productId, qty, notes || undefined);
      if (result) {
        const product = productService.getById(productId)!;
        notifications.success(`${i18n.t('inventory.type.adjustment')}: ${product.name} → ${result.stockAfter} ${product.unit}`);
        onSave();
      } else {
        showModalError(form, 'Adjustment failed. Product not found.');
        return false;
      }
    },
  });
}

function openRestockModal(onSave: () => void, preselected?: Product): void {
  const products = productService.getAll();

  const form = document.createElement('div');
  form.innerHTML = `
    <div class="form-group" style="margin-bottom:var(--space-4);">
      <label class="form-label required" for="rs-product">${i18n.t('products.modals.name')}</label>
      <select id="rs-product" class="form-control">
        <option value="">${i18n.t('inventory.modals.selectProduct')}</option>
        ${products.map((p) => `<option value="${p.id}" data-reorder="${p.reorderQuantity}" ${preselected?.id === p.id ? 'selected' : ''}>${p.name} (${p.sku}) — ${p.stock} ${p.unit}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="rs-qty">${i18n.t('inventory.qtyChange')}</label>
        <input type="number" id="rs-qty" class="form-control" placeholder="0" min="1" value="${preselected?.reorderQuantity ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="rs-ref">${i18n.t('inventory.modals.poNumber')}</label>
        <input type="text" id="rs-ref" class="form-control" placeholder="..." />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="rs-notes">${i18n.t('inventory.notes')}</label>
      <textarea id="rs-notes" class="form-control" placeholder="..."></textarea>
    </div>
  `;

  // Auto-fill suggested quantity when product changes
  form.querySelector<HTMLSelectElement>('#rs-product')?.addEventListener('change', (e) => {
    const opt = (e.target as HTMLSelectElement).selectedOptions[0];
    const suggested = opt?.getAttribute('data-reorder') ?? '';
    (form.querySelector('#rs-qty') as HTMLInputElement).value = suggested;
  });

  openModal({
    title: i18n.t('inventory.modals.restockTitle'),
    content: form,
    confirmText: i18n.t('inventory.modals.restockConfirm'),
    confirmClass: 'btn-primary',
    onConfirm: () => {
      const productId = (form.querySelector('#rs-product') as HTMLSelectElement).value;
      const qty = parseInt((form.querySelector('#rs-qty') as HTMLInputElement).value);
      const ref = (form.querySelector('#rs-ref') as HTMLInputElement).value.trim();
      const notes = (form.querySelector('#rs-notes') as HTMLTextAreaElement).value.trim();

      if (!productId) { showModalError(form, i18n.t('errors.required'), ['rs-product']); return false; }
      if (isNaN(qty) || qty <= 0) { showModalError(form, i18n.t('errors.required'), ['rs-qty']); return false; }

      const result = inventoryService.restock(productId, qty, ref || undefined, notes || undefined);
      if (result) {
        const product = productService.getById(productId)!;
        notifications.success(`${i18n.t('inventory.restock')}: ${product.name} +${qty} → ${result.stockAfter} ${product.unit}`);
        onSave();
      } else {
        showModalError(form, 'Restock failed. Product not found.');
        return false;
      }
    },
  });
}

function openReorderSettingsModal(onSave: () => void): void {
  const products = productService.getAll();

  const form = document.createElement('div');
  form.innerHTML = `
    <p style="font-size:var(--font-size-sm);color:var(--color-text-secondary);margin-bottom:var(--space-4);">
      ${i18n.t('inventory.subtitle')}
    </p>
    <div style="display:flex;flex-direction:column;gap:var(--space-3);max-height:400px;overflow-y:auto;">
      ${products.map((p) => `
        <div style="display:grid;grid-template-columns:1fr 100px 100px;gap:var(--space-3);align-items:center;padding:var(--space-3);background:var(--color-bg-secondary);border-radius:var(--radius-sm);">
          <div>
            <div style="font-weight:500;font-size:var(--font-size-sm);">${p.name}</div>
            <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">${p.sku} · ${p.stock} ${p.unit} ${i18n.t('inventory.status.inStock').toLowerCase()}</div>
          </div>
          <div>
            <label style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);display:block;margin-bottom:2px;">${i18n.t('inventory.reorderSettings').split(' ')[0]}</label>
            <input type="number" class="form-control rp-point" data-id="${p.id}" value="${p.reorderPoint}" min="0" style="padding:var(--space-1) var(--space-2);" />
          </div>
          <div>
            <label style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);display:block;margin-bottom:2px;">${i18n.t('inventory.restock')}</label>
            <input type="number" class="form-control rp-qty" data-id="${p.id}" value="${p.reorderQuantity}" min="0" style="padding:var(--space-1) var(--space-2);" />
          </div>
        </div>
      `).join('')}
    </div>
  `;

  openModal({
    title: i18n.t('inventory.reorderSettings'),
    content: form,
    size: 'lg',
    confirmText: i18n.t('common.save'),
    onConfirm: () => {
      form.querySelectorAll<HTMLInputElement>('.rp-point').forEach((inp) => {
        const id = inp.getAttribute('data-id')!;
        const point = parseInt(inp.value) || 0;
        const qtyInp = form.querySelector<HTMLInputElement>(`.rp-qty[data-id="${id}"]`)!;
        const qty = parseInt(qtyInp.value) || 0;
        inventoryService.updateReorderSettings(id, point, qty);
      });
      notifications.success('Reorder settings saved.');
      onSave();
    },
  });
}

// Inject inventory-specific styles once
if (!document.getElementById('inventory-styles')) {
  const style = document.createElement('style');
  style.id = 'inventory-styles';
  style.textContent = `
    .inv-kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }
    @media (max-width: 1280px) { .inv-kpi-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 768px)  { .inv-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px)  { .inv-kpi-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(style);
}
