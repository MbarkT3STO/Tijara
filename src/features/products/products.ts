/**
 * Products feature page – list, search, create, edit, delete products.
 */

import { productService } from '@services/productService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatCurrency, debounce } from '@shared/utils/helpers';
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

    page.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit')!;
        const product = productService.getById(id);
        if (!product) return;
        openProductModal(product, () => {
          state.products = productService.getAll();
          applyFilters();
          render();
        });
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete')!;
        const product = productService.getById(id);
        if (!product) return;
        confirmDialog(
          'Delete Product',
          `Are you sure you want to delete "${product.name}"?`,
          () => {
            productService.delete(id);
            notifications.success(`Product "${product.name}" deleted.`);
            state.products = productService.getAll();
            applyFilters();
            render();
          }
        );
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
  const categories = productService.getCategories();
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (state.page - 1) * PAGE_SIZE;
  const pageData = state.filtered.slice(start, start + PAGE_SIZE);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Products</h2>
        <p class="page-subtitle">${total} product${total !== 1 ? 's' : ''} total</p>
      </div>
      <button class="btn btn-primary" id="add-product-btn">
        ${Icons.plus()} Add Product
      </button>
    </div>

    <div class="card">
      <div class="card-header" style="gap: var(--space-3); flex-wrap: wrap;">
        <div class="search-bar" style="flex: 1; max-width: 360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input
            type="search"
            id="product-search"
            class="form-control"
            placeholder="Search products..."
            value="${state.search}"
            aria-label="Search products"
          />
        </div>
        <select id="category-filter" class="form-control" style="width: auto;" aria-label="Filter by category">
          <option value="">All Categories</option>
          ${categories.map((c) => `<option value="${c}" ${state.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>

      <div class="table-container" style="border: none; border-radius: 0;">
        <table class="data-table" aria-label="Products list">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Price</th>
              <th>Cost</th>
              <th>Stock</th>
              <th>Margin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              pageData.length === 0
                ? `<tr><td colspan="8">
                    <div class="empty-state">
                      <div class="empty-state-icon">${Icons.products(32)}</div>
                      <p class="empty-state-title">No products found</p>
                      <p class="empty-state-desc">${state.search ? 'Try a different search term.' : 'Add your first product to get started.'}</p>
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
                      <div style="font-weight: 500;">${p.name}</div>
                      ${p.description ? `<div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">${p.description}</div>` : ''}
                    </div>
                  </td>
                  <td><code style="font-size: var(--font-size-xs); background: var(--color-bg-secondary); padding: 2px 6px; border-radius: var(--radius-xs);">${p.sku}</code></td>
                  <td><span class="badge badge-primary">${p.category}</span></td>
                  <td><strong>${formatCurrency(p.price)}</strong></td>
                  <td style="color: var(--color-text-secondary);">${formatCurrency(p.cost)}</td>
                  <td><span class="badge ${stockClass}">${p.stock} ${p.unit}</span></td>
                  <td style="color: ${margin >= 30 ? 'var(--color-success)' : margin >= 15 ? 'var(--color-warning)' : 'var(--color-error)'}; font-weight: 500;">${margin.toFixed(1)}%</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-ghost btn-icon btn-sm" data-edit="${p.id}" aria-label="Edit ${p.name}" data-tooltip="Edit">
                        ${Icons.edit(16)}
                      </button>
                      <button class="btn btn-ghost btn-icon btn-sm" data-delete="${p.id}" aria-label="Delete ${p.name}" data-tooltip="Delete" style="color: var(--color-error);">
                        ${Icons.trash(16)}
                      </button>
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

function openProductModal(product: Product | null, onSave: () => void): void {
  const isEdit = product !== null;
  const currentUnit = product?.unit ?? 'pcs';
  // If the saved unit isn't in the preset list, treat it as custom
  const isCustomUnit = currentUnit !== '' && !PRODUCT_UNITS.includes(currentUnit as typeof PRODUCT_UNITS[number]);

  const form = document.createElement('form');
  form.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="p-name">Product Name</label>
        <input type="text" id="p-name" class="form-control" placeholder="Laptop Pro 15" value="${product?.name ?? ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label required" for="p-sku">SKU</label>
        <input type="text" id="p-sku" class="form-control" placeholder="LP-001" value="${product?.sku ?? ''}" required />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="p-category">Category</label>
        <input type="text" id="p-category" class="form-control" placeholder="Electronics" value="${product?.category ?? ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="p-unit">Unit</label>
        <select id="p-unit" class="form-control">
          ${PRODUCT_UNITS.map(
            (u) => `<option value="${u}" ${(!isCustomUnit && currentUnit === u) ? 'selected' : ''}>${u}</option>`
          ).join('')}
          <option value="__custom__" ${isCustomUnit ? 'selected' : ''}>Custom…</option>
        </select>
        <input
          type="text"
          id="p-unit-custom"
          class="form-control"
          placeholder="Enter unit name"
          value="${isCustomUnit ? currentUnit : ''}"
          style="margin-top: var(--space-2); display: ${isCustomUnit ? 'block' : 'none'};"
        />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="p-price">Selling Price ($)</label>
        <input type="number" id="p-price" class="form-control" placeholder="0.00" min="0" step="0.01" value="${product?.price ?? ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="p-cost">Cost Price ($)</label>
        <input type="number" id="p-cost" class="form-control" placeholder="0.00" min="0" step="0.01" value="${product?.cost ?? ''}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="p-stock">Stock Quantity</label>
        <input type="number" id="p-stock" class="form-control" placeholder="0" min="0" value="${product?.stock ?? 0}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="p-desc">Description</label>
      <textarea id="p-desc" class="form-control" placeholder="Optional description...">${product?.description ?? ''}</textarea>
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
    title: isEdit ? 'Edit Product' : 'Add Product',
    content: form,
    confirmText: isEdit ? 'Save Changes' : 'Add Product',
    onConfirm: () => {
      const name = (form.querySelector('#p-name') as HTMLInputElement).value.trim();
      const sku = (form.querySelector('#p-sku') as HTMLInputElement).value.trim();
      const category = (form.querySelector('#p-category') as HTMLInputElement).value.trim();
      const price = parseFloat((form.querySelector('#p-price') as HTMLInputElement).value);

      if (!name || !sku || !category || isNaN(price)) {
        notifications.error('Name, SKU, category, and price are required.');
        return;
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
        description: (form.querySelector('#p-desc') as HTMLTextAreaElement).value.trim(),
      };

      if (isEdit) {
        productService.update(product!.id, data);
        notifications.success('Product updated successfully.');
      } else {
        productService.create(data);
        notifications.success('Product added successfully.');
      }
      onSave();
    },
  });
}
