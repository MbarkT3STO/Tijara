/**
 * Products feature page – list, search, create, edit, delete products.
 */

import { productService } from '@services/productService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, debounce, escapeHtml, usePermissions } from '@shared/utils/helpers';
import { profileService } from '@services/profileService';
import { i18n } from '@core/i18n';
import { repository } from '@data/repository';
import { menuTriggerHTML, attachMenuTriggers } from '@shared/utils/actionMenu';
import type { Product } from '@core/types';

const PAGE_SIZE = 10;

interface State {
  products: Product[];
  filtered: Product[];
  page: number;
  search: string;
  category: string;
}

/** Render and return the products page */
export function renderProducts(): HTMLElement {
  const { can } = usePermissions();
  const state: State = {
    products: productService.getAll(),
    filtered: [],
    page: 1,
    search: '',
    category: '',
  };

  state.filtered = [...state.products];

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function applyFilters() {
    let data = [...state.products];
    if (state.search) {
      data = productService.search(state.search);
    }
    if (state.category) {
      data = data.filter((p) => p.category === state.category);
    }
    state.filtered = data;
    state.page = 1;
  }

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    const searchInput = page.querySelector<HTMLInputElement>('#product-search');
    searchInput?.addEventListener(
      'input',
      debounce((e: Event) => {
        state.search = (e.target as HTMLInputElement).value;
        applyFilters();
        render();
      }, 300) as EventListener
    );

    const categorySelect = page.querySelector<HTMLSelectElement>('#category-filter');
    categorySelect?.addEventListener('change', (e) => {
      state.category = (e.target as HTMLSelectElement).value;
      applyFilters();
      render();
    });

    page.querySelector('#add-product-btn')?.addEventListener('click', () => {
      openProductModal(null, () => {
        state.products = productService.getAll();
        applyFilters();
        render();
      });
    });

    attachMenuTriggers(
      page,
      () => [
        { action: 'view',   icon: Icons.eye(16),   label: i18n.t('common.view') },
        ...(can('products:edit')   ? [{ action: 'edit',   icon: Icons.edit(16),  label: i18n.t('common.edit') }] : []),
        ...(can('products:delete') ? [{ action: 'delete', icon: Icons.trash(16), label: i18n.t('common.delete'), danger: true, dividerBefore: true }] : []),
      ],
      (action, id) => {
        const product = productService.getById(id);
        if (!product) return;
        const refresh = () => { state.products = productService.getAll(); applyFilters(); render(); };
        if (action === 'view')        openProductDetailModal(product, refresh);
        else if (action === 'edit')   openProductModal(product, refresh);
        else if (action === 'delete') confirmDialog(i18n.t('common.delete'), `${i18n.t('common.confirm')} "${product.name}"?`, () => {
          try {
            productService.delete(id);
            notifications.success(i18n.t('common.delete'));
            refresh();
          } catch {
            notifications.error(i18n.t('errors.actionDenied' as any));
          }
        });
      }
    );

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

  // Handle open-item event dispatched by app.ts after search navigation
  page.addEventListener('open-item', (e) => {
    const { id } = (e as CustomEvent).detail;
    const product = productService.getById(id);
    if (!product) return;
    openProductDetailModal(product, () => {
      state.products = productService.getAll();
      applyFilters();
      render();
    });
  });

  return page;
}

function buildHTML(state: State): string {
  const { can } = usePermissions();
  const categories = productService.getCategories();
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (state.page - 1) * PAGE_SIZE;
  const pageData = state.filtered.slice(start, start + PAGE_SIZE);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('products.title')}</h2>
        <p class="page-subtitle">${total === 1 ? i18n.t('products.countTotal', { count: total }) : i18n.t('products.countPlural', { count: total })}</p>
      </div>
      ${can('products:create') ? `<button class="btn btn-primary" id="add-product-btn">
        ${Icons.plus()} ${i18n.t('products.addNew')}
      </button>` : ''}
    </div>

    <div class="card">
      <div class="card-header" style="gap: var(--space-3); flex-wrap: wrap;">
        <div class="search-bar" style="flex: 1; max-width: 360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input
            type="search"
            id="product-search"
            class="form-control"
            placeholder="${i18n.t('common.search')}..."
            value="${state.search}"
            aria-label="${i18n.t('common.search')}"
          />
        </div>
        <select id="category-filter" class="form-control" style="width: auto;" aria-label="${i18n.t('common.filter')}">
          <option value="">${i18n.t('products.allCategories')}</option>
          ${categories.map((c) => `<option value="${c}" ${state.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>

      <div class="table-container" style="border: none; border-radius: 0;">
        <div class="table-scroll">
        <table class="data-table" aria-label="Products list">
          <thead>
            <tr>
              <th>${i18n.t('products.title').slice(0,-1)}</th>
              <th>${i18n.t('products.sku')}</th>
              <th>${i18n.t('products.category')}</th>
              <th>${i18n.t('products.price')}</th>
              <th>${i18n.t('products.cost')}</th>
              <th>${i18n.t('products.stock')}</th>
              <th>${i18n.t('products.margin' as any)}</th>
              <th>${i18n.t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${
              pageData.length === 0
                ? `<tr><td colspan="8">
                    <div class="empty-state">
                      <div class="empty-state-icon">${Icons.products(32)}</div>
                      <p class="empty-state-title">${i18n.t('common.noData')}</p>
                      <p class="empty-state-desc">${state.search ? i18n.t('errors.loadFailed') : i18n.t('common.noData')}</p>
                    </div>
                  </td></tr>`
                : pageData
                    .map((p) => {
                      const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
                      const stockClass =
                        p.stock === 0
                          ? 'badge-error'
                          : p.stock < 10
                            ? 'badge-warning'
                            : 'badge-success';
                      return `
                <tr>
                  <td>
                    <div>
                      <div style="font-weight: 500;">${escapeHtml(p.name)}</div>
                      ${p.description ? `<div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">${escapeHtml(p.description)}</div>` : ''}
                    </div>
                  </td>
                  <td><code style="font-size: var(--font-size-xs); background: var(--color-bg-secondary); padding: 2px 6px; border-radius: var(--radius-xs);">${escapeHtml(p.sku)}</code></td>
                  <td><span class="badge badge-primary">${escapeHtml(p.category)}</span></td>
                  <td><strong>${formatCurrency(p.price)}</strong></td>
                  <td style="color: var(--color-text-secondary);">${formatCurrency(p.cost)}</td>
                  <td><span class="badge ${stockClass}">${p.stock} ${escapeHtml(p.unit)}</span></td>
                  <td style="color: ${margin >= 30 ? 'var(--color-success)' : margin >= 15 ? 'var(--color-warning)' : 'var(--color-error)'}; font-weight: 500;">${margin.toFixed(1)}%</td>
                  <td>
                    <div class="table-actions">
                      ${menuTriggerHTML(p.id)}
                    </div>
                  </td>
                    </div>
                  </td>
                </tr>
              `;
                    })
                    .join('')
            }
          </tbody>
        </table>
        </div>
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
      <span class="pagination-info">${i18n.t('common.showing' as any)} ${start + 1}–${start + count} / ${total}</span>
      <div class="pagination-controls">
        <button class="pagination-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Previous page">${Icons.chevronLeft(16)}</button>
        ${pages.map((p) => `<button class="pagination-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`).join('')}
        <button class="pagination-btn" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''} aria-label="Next page">${Icons.chevronRight(16)}</button>
      </div>
    </div>
  `;
}

/** Common product units */
const PRODUCT_UNITS = [
  'pcs',
  'kg',
  'g',
  'lb',
  'oz',
  'l',
  'ml',
  'm',
  'cm',
  'box',
  'pack',
  'pair',
  'set',
  'roll',
  'sheet',
  'hour',
  'day',
  'license',
  'other',
] as const;

function openProductDetailModal(product: Product, onEdit: () => void): void {
  const { can } = usePermissions();
  const margin = product.price > 0 ? ((product.price - product.cost) / product.price) * 100 : 0;
  const marginColor = margin >= 30 ? 'var(--color-success)' : margin >= 15 ? 'var(--color-warning)' : 'var(--color-error)';
  const stockClass = product.stock === 0 ? 'badge-error' : product.stock < 10 ? 'badge-warning' : 'badge-success';
  const currencySymbol = profileService.getCurrencySymbol();

  const costHistory = repository.getAll('productCostHistory')
    .filter((h) => h.productId === product.id)
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
    .slice(0, 8);

  const content = document.createElement('div');
  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--space-4);padding:var(--space-4);background:var(--color-bg-secondary);border-radius:var(--radius-sm);margin-bottom:var(--space-5);">
      <div style="width:48px;height:48px;border-radius:var(--radius-sm);background:var(--color-primary-subtle);color:var(--color-primary);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        ${Icons.products(24)}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:var(--font-size-lg);font-weight:700;color:var(--color-text-primary);">${escapeHtml(product.name)}</div>
        <div style="display:flex;align-items:center;gap:var(--space-2);margin-top:4px;flex-wrap:wrap;">
          <code style="font-size:var(--font-size-xs);background:var(--color-surface);border:1px solid var(--color-border);padding:2px 6px;border-radius:var(--radius-xs);">${escapeHtml(product.sku)}</code>
          <span class="badge badge-primary">${escapeHtml(product.category)}</span>
          <span class="badge ${stockClass}">${product.stock} ${escapeHtml(product.unit)}</span>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-5);">
      <div style="padding:var(--space-3);background:var(--color-bg-secondary);border-radius:var(--radius-sm);text-align:center;">
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em;">${i18n.t('products.price')}</div>
        <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--color-text-primary);">${currencySymbol}${product.price.toFixed(2)}</div>
      </div>
      <div style="padding:var(--space-3);background:var(--color-bg-secondary);border-radius:var(--radius-sm);text-align:center;">
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em;">${i18n.t('products.cost')}</div>
        <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--color-text-secondary);">${currencySymbol}${product.cost.toFixed(2)}</div>
      </div>
      <div style="padding:var(--space-3);background:var(--color-bg-secondary);border-radius:var(--radius-sm);text-align:center;">
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em;">${i18n.t('products.margin' as any)}</div>
        <div style="font-size:var(--font-size-xl);font-weight:700;color:${marginColor};">${margin.toFixed(1)}%</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-5);">
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('products.modals.unit')}</div>
        <div style="font-weight:500;">${escapeHtml(product.unit)}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('products.modals.reorderPoint')}</div>
        <div style="font-weight:500;">${product.reorderPoint ?? 0}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('products.modals.reorderQty')}</div>
        <div style="font-weight:500;">${product.reorderQuantity ?? 0}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('common.date')}</div>
        <div style="font-weight:500;">${formatDate(product.createdAt)}</div>
      </div>
    </div>

    ${product.description ? `
    <div style="padding:var(--space-3) var(--space-4);background:var(--color-bg-secondary);border-radius:var(--radius-sm);margin-bottom:var(--space-5);">
      <div style="font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('products.modals.description')}</div>
      <div style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">${escapeHtml(product.description)}</div>
    </div>` : ''}

    ${costHistory.length > 0 ? `
    <div>
      <div style="font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-tertiary);margin-bottom:var(--space-3);">${i18n.t('products.costHistory' as any)}</div>
      <table style="width:100%;font-size:var(--font-size-xs);border-collapse:collapse;">
        <thead>
          <tr style="color:var(--color-text-tertiary);">
            <th style="text-align:start;padding:4px 8px;">${i18n.t('common.date')}</th>
            <th style="text-align:end;padding:4px 8px;">${i18n.t('products.costOld' as any)}</th>
            <th style="text-align:end;padding:4px 8px;">${i18n.t('products.costNew' as any)}</th>
            <th style="text-align:start;padding:4px 8px;">${i18n.t('products.changedBy' as any)}</th>
          </tr>
        </thead>
        <tbody>
          ${costHistory.map((h) => `
            <tr style="border-top:1px solid var(--color-border-subtle);">
              <td style="padding:4px 8px;color:var(--color-text-secondary);">${formatDate(h.changedAt)}</td>
              <td style="padding:4px 8px;text-align:end;color:var(--color-error);">${formatCurrency(h.oldCost)}</td>
              <td style="padding:4px 8px;text-align:end;color:var(--color-success);">${formatCurrency(h.newCost)}</td>
              <td style="padding:4px 8px;color:var(--color-text-tertiary);">${h.changedBy ? escapeHtml(h.changedBy) : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    <div style="margin-top:var(--space-5);">
      ${can('products:edit') ? `<button class="btn btn-secondary" id="product-detail-edit-btn">${Icons.edit(16)} ${i18n.t('common.edit')}</button>` : ''}
    </div>
  `;

  const close = openModal({
    title: escapeHtml(product.name),
    content,
    size: 'lg',
    hideFooter: true,
  });

  content.querySelector('#product-detail-edit-btn')?.addEventListener('click', () => {
    close();
    openProductModal(product, onEdit);
  });
}

function openProductModal(product: Product | null, onSave: () => void): void {
  const isEdit = product !== null;
  const currentUnit = product?.unit ?? 'pcs';
  const isCustomUnit = currentUnit !== '' && !PRODUCT_UNITS.includes(currentUnit as typeof PRODUCT_UNITS[number]);
  const currencySymbol = profileService.getCurrencySymbol();

  const form = document.createElement('form');
  form.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="p-name">${i18n.t('products.modals.name')}</label>
        <input type="text" id="p-name" class="form-control" placeholder="..." value="${product?.name ?? ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label required" for="p-sku">${i18n.t('products.modals.sku')}</label>
        <input type="text" id="p-sku" class="form-control" placeholder="..." value="${product?.sku ?? ''}" required />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="p-category">${i18n.t('products.modals.category')}</label>
        <input type="text" id="p-category" class="form-control" placeholder="..." value="${product?.category ?? ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="p-unit">${i18n.t('products.modals.unit')}</label>
        <select id="p-unit" class="form-control">
          ${PRODUCT_UNITS.map(
            (u) => `<option value="${u}" ${(!isCustomUnit && currentUnit === u) ? 'selected' : ''}>${u}</option>`
          ).join('')}
          <option value="__custom__" ${isCustomUnit ? 'selected' : ''}>${i18n.t('products.modals.customUnit')}</option>
        </select>
        <input
          type="text"
          id="p-unit-custom"
          class="form-control"
          placeholder="..."
          value="${isCustomUnit ? currentUnit : ''}"
          style="margin-top: var(--space-2); display: ${isCustomUnit ? 'block' : 'none'};"
        />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="p-price">${i18n.t('products.modals.price')} (${currencySymbol})</label>
        <input type="number" id="p-price" class="form-control" placeholder="0.00" min="0" step="0.01" value="${product?.price ?? ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="p-cost">${i18n.t('products.modals.cost')} (${currencySymbol})</label>
        <input type="number" id="p-cost" class="form-control" placeholder="0.00" min="0" step="0.01" value="${product?.cost ?? ''}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="p-stock">${i18n.t('products.modals.stock')}</label>
        <input type="number" id="p-stock" class="form-control" placeholder="0" min="0" value="${product?.stock ?? 0}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="p-reorder-point">${i18n.t('products.modals.reorderPoint')}</label>
        <input type="number" id="p-reorder-point" class="form-control" placeholder="0" min="0" value="${product?.reorderPoint ?? 0}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="p-reorder-qty">${i18n.t('products.modals.reorderQty')}</label>
        <input type="number" id="p-reorder-qty" class="form-control" placeholder="0" min="0" value="${product?.reorderQuantity ?? 0}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="p-desc">${i18n.t('products.modals.description')}</label>
      <textarea id="p-desc" class="form-control" placeholder="...">${product?.description ?? ''}</textarea>
    </div>
  `;

  // Show/hide custom unit input when "Custom…" is selected
  const unitSelect = form.querySelector<HTMLSelectElement>('#p-unit')!;
  const unitCustom = form.querySelector<HTMLInputElement>('#p-unit-custom')!;
  unitSelect.addEventListener('change', () => {
    const isCustom = unitSelect.value === '__custom__';
    unitCustom.style.display = isCustom ? 'block' : 'none';
    if (isCustom) unitCustom.focus();
  });

  openModal({
    title: isEdit ? i18n.t('products.modals.editTitle') : i18n.t('products.modals.addTitle'),
    content: form,
    confirmText: isEdit ? i18n.t('products.modals.saveChanges') : i18n.t('products.addNew'),
    onConfirm: () => {
      const name = (form.querySelector('#p-name') as HTMLInputElement).value.trim();
      const sku = (form.querySelector('#p-sku') as HTMLInputElement).value.trim();
      const category = (form.querySelector('#p-category') as HTMLInputElement).value.trim();
      const price = parseFloat((form.querySelector('#p-price') as HTMLInputElement).value);

      if (!name || !sku || !category || isNaN(price)) {
        const invalidIds = [
          ...(!name ? ['p-name'] : []),
          ...(!sku ? ['p-sku'] : []),
          ...(!category ? ['p-category'] : []),
          ...(isNaN(price) ? ['p-price'] : []),
        ];
        showModalError(form, i18n.t('errors.required'), invalidIds);
        return false;
      }

      // Resolve unit: use custom text if "Custom…" selected
      let unit = unitSelect.value;
      if (unit === '__custom__') {
        unit = unitCustom.value.trim() || 'pcs';
      }

      const data = {
        name,
        sku,
        category,
        unit,
        price,
        cost: parseFloat((form.querySelector('#p-cost') as HTMLInputElement).value) || 0,
        stock: parseInt((form.querySelector('#p-stock') as HTMLInputElement).value) || 0,
        reorderPoint: parseInt((form.querySelector('#p-reorder-point') as HTMLInputElement).value) || 0,
        reorderQuantity: parseInt((form.querySelector('#p-reorder-qty') as HTMLInputElement).value) || 0,
        description: (form.querySelector('#p-desc') as HTMLTextAreaElement).value.trim(),
      };

      if (isEdit) {
        productService.update(product!.id, data);
        notifications.success(i18n.t('common.save'));
      } else {
        productService.create(data);
        notifications.success(i18n.t('common.save'));
      }
      onSave();
    },
  });

  // Show cost history for existing products
  if (isEdit && product) {
    const costHistory = repository.getAll('productCostHistory')
      .filter((h) => h.productId === product.id)
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
      .slice(0, 10);

    if (costHistory.length > 0) {
      const histSection = document.createElement('div');
      histSection.style.cssText = 'margin-top:var(--space-4);border-top:1px solid var(--color-border-subtle);padding-top:var(--space-4);';
      histSection.innerHTML = `
        <div style="font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-secondary);margin-bottom:var(--space-3);">
          ${i18n.t('products.costHistory' as any)}
        </div>
        <table style="width:100%;font-size:var(--font-size-xs);border-collapse:collapse;">
          <thead>
            <tr style="color:var(--color-text-tertiary);">
              <th style="text-align:left;padding:4px 8px;">${i18n.t('common.date')}</th>
              <th style="text-align:right;padding:4px 8px;">${i18n.t('products.costOld' as any)}</th>
              <th style="text-align:right;padding:4px 8px;">${i18n.t('products.costNew' as any)}</th>
              <th style="text-align:left;padding:4px 8px;">${i18n.t('products.changedBy' as any)}</th>
            </tr>
          </thead>
          <tbody>
            ${costHistory.map((h) => `
              <tr style="border-top:1px solid var(--color-border-subtle);">
                <td style="padding:4px 8px;color:var(--color-text-secondary);">${formatDate(h.changedAt)}</td>
                <td style="padding:4px 8px;text-align:right;color:var(--color-error);">${formatCurrency(h.oldCost)}</td>
                <td style="padding:4px 8px;text-align:right;color:var(--color-success);">${formatCurrency(h.newCost)}</td>
                <td style="padding:4px 8px;color:var(--color-text-tertiary);">${h.changedBy ? escapeHtml(h.changedBy) : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      `;
      form.appendChild(histSection);
    }
  }
}
