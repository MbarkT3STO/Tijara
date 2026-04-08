/**
 * Suppliers feature page – list, search, create, edit, delete suppliers.
 */

import { supplierService } from '@services/supplierService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatDate, debounce, getInitials } from '@shared/utils/helpers';
import type { Supplier } from '@core/types';

const PAGE_SIZE = 10;

interface State {
  suppliers: Supplier[];
  filtered: Supplier[];
  page: number;
  search: string;
}

export function renderSuppliers(): HTMLElement {
  const state: State = {
    suppliers: supplierService.getAll(),
    filtered: [],
    page: 1,
    search: '',
  };
  state.filtered = [...state.suppliers];

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    page.querySelector<HTMLInputElement>('#supplier-search')?.addEventListener(
      'input',
      debounce((e: Event) => {
        state.search = (e.target as HTMLInputElement).value;
        state.filtered = state.search
          ? supplierService.search(state.search)
          : [...state.suppliers];
        state.page = 1;
        render();
      }, 300) as EventListener
    );

    page.querySelector('#add-supplier-btn')?.addEventListener('click', () => {
      openSupplierModal(null, () => {
        state.suppliers = supplierService.getAll();
        state.filtered = state.search ? supplierService.search(state.search) : [...state.suppliers];
        render();
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const supplier = supplierService.getById(btn.getAttribute('data-view')!);
        if (supplier) openSupplierDetailModal(supplier, () => {
          state.suppliers = supplierService.getAll();
          state.filtered = state.search ? supplierService.search(state.search) : [...state.suppliers];
          render();
        });
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const supplier = supplierService.getById(btn.getAttribute('data-edit')!);
        if (!supplier) return;
        openSupplierModal(supplier, () => {
          state.suppliers = supplierService.getAll();
          state.filtered = state.search ? supplierService.search(state.search) : [...state.suppliers];
          render();
        });
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const supplier = supplierService.getById(btn.getAttribute('data-delete')!);
        if (!supplier) return;
        confirmDialog('Delete Supplier', `Delete "${supplier.name}"? This cannot be undone.`, () => {
          supplierService.delete(supplier.id);
          notifications.success('Supplier deleted.');
          state.suppliers = supplierService.getAll();
          state.filtered = state.search ? supplierService.search(state.search) : [...state.suppliers];
          if (state.page > Math.ceil(state.filtered.length / PAGE_SIZE)) {
            state.page = Math.max(1, state.page - 1);
          }
          render();
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
        <h2 class="page-title">Suppliers</h2>
        <p class="page-subtitle">${total} supplier${total !== 1 ? 's' : ''} total</p>
      </div>
      <button class="btn btn-primary" id="add-supplier-btn">${Icons.plus()} Add Supplier</button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="search-bar" style="flex:1;max-width:360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input type="search" id="supplier-search" class="form-control"
            placeholder="Search suppliers..." value="${state.search}" aria-label="Search suppliers" />
        </div>
      </div>

      <div class="table-container" style="border:none;border-radius:0;">
        <table class="data-table" aria-label="Suppliers list">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Contact Person</th>
              <th>Email</th>
              <th>Phone</th>
              <th>City</th>
              <th>Country</th>
              <th>Since</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0
              ? `<tr><td colspan="8">
                  <div class="empty-state">
                    <div class="empty-state-icon">${Icons.truck(32)}</div>
                    <p class="empty-state-title">No suppliers found</p>
                    <p class="empty-state-desc">${state.search ? 'Try a different search term.' : 'Add your first supplier to get started.'}</p>
                  </div>
                </td></tr>`
              : pageData.map((s) => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:var(--space-3);">
                      <div class="avatar avatar-sm">${getInitials(s.name)}</div>
                      <div>
                        <div style="font-weight:500;">${s.name}</div>
                        ${s.taxId ? `<div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">Tax: ${s.taxId}</div>` : ''}
                      </div>
                    </div>
                  </td>
                  <td style="color:var(--color-text-secondary);">${s.contactPerson || '—'}</td>
                  <td style="color:var(--color-text-secondary);">${s.email || '—'}</td>
                  <td style="color:var(--color-text-secondary);">${s.phone || '—'}</td>
                  <td>${s.city || '—'}</td>
                  <td>${s.country || '—'}</td>
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

function openSupplierDetailModal(supplier: Supplier, onEdit: () => void): void {
  const content = document.createElement('div');
  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-5);">
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Contact Person</div>
        <div style="font-weight:500;">${supplier.contactPerson || '—'}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Email</div>
        <div>${supplier.email || '—'}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Phone</div>
        <div>${supplier.phone || '—'}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Website</div>
        <div>${supplier.website ? `<a href="${supplier.website}" target="_blank" style="color:var(--color-primary);">${supplier.website}</a>` : '—'}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Address</div>
        <div>${[supplier.address, supplier.city, supplier.country].filter(Boolean).join(', ') || '—'}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">Tax ID</div>
        <div>${supplier.taxId || '—'}</div>
      </div>
    </div>
    ${supplier.notes ? `
    <div style="padding:var(--space-3) var(--space-4);background:var(--color-bg-secondary);border-radius:var(--radius-sm);font-size:var(--font-size-sm);color:var(--color-text-secondary);">
      <div style="font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-tertiary);margin-bottom:4px;">Notes</div>
      ${supplier.notes}
    </div>` : ''}
    <div style="margin-top:var(--space-5);">
      <button class="btn btn-secondary" id="detail-edit-btn">${Icons.edit(16)} Edit Supplier</button>
    </div>
  `;

  const close = openModal({ title: supplier.name, content, size: 'lg', hideFooter: true });
  content.querySelector('#detail-edit-btn')?.addEventListener('click', () => {
    close();
    openSupplierModal(supplier, onEdit);
  });
}

function openSupplierModal(supplier: Supplier | null, onSave: () => void): void {
  const isEdit = supplier !== null;

  const form = document.createElement('form');
  form.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="sp-name">Company Name</label>
        <input type="text" id="sp-name" class="form-control" placeholder="Acme Supplies Ltd" value="${supplier?.name ?? ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="sp-contact">Contact Person</label>
        <input type="text" id="sp-contact" class="form-control" placeholder="John Smith" value="${supplier?.contactPerson ?? ''}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="sp-email">Email</label>
        <input type="email" id="sp-email" class="form-control" placeholder="contact@supplier.com" value="${supplier?.email ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="sp-phone">Phone</label>
        <input type="tel" id="sp-phone" class="form-control" placeholder="+1-555-0100" value="${supplier?.phone ?? ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="sp-address">Address</label>
      <input type="text" id="sp-address" class="form-control" placeholder="123 Industrial Ave" value="${supplier?.address ?? ''}" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="sp-city">City</label>
        <input type="text" id="sp-city" class="form-control" placeholder="Chicago" value="${supplier?.city ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="sp-country">Country</label>
        <input type="text" id="sp-country" class="form-control" placeholder="USA" value="${supplier?.country ?? ''}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="sp-taxid">Tax ID / VAT</label>
        <input type="text" id="sp-taxid" class="form-control" placeholder="US-123456789" value="${supplier?.taxId ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="sp-website">Website</label>
        <input type="url" id="sp-website" class="form-control" placeholder="https://supplier.com" value="${supplier?.website ?? ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="sp-notes">Notes</label>
      <textarea id="sp-notes" class="form-control" placeholder="Optional notes...">${supplier?.notes ?? ''}</textarea>
    </div>
  `;

  openModal({
    title: isEdit ? 'Edit Supplier' : 'Add Supplier',
    content: form,
    confirmText: isEdit ? 'Save Changes' : 'Add Supplier',
    onConfirm: () => {
      const name = (form.querySelector('#sp-name') as HTMLInputElement).value.trim();
      if (!name) {
        showModalError(form, 'Company name is required.', ['sp-name']);
        return false;
      }

      const data = {
        name,
        contactPerson: (form.querySelector('#sp-contact') as HTMLInputElement).value.trim(),
        email: (form.querySelector('#sp-email') as HTMLInputElement).value.trim(),
        phone: (form.querySelector('#sp-phone') as HTMLInputElement).value.trim(),
        address: (form.querySelector('#sp-address') as HTMLInputElement).value.trim(),
        city: (form.querySelector('#sp-city') as HTMLInputElement).value.trim(),
        country: (form.querySelector('#sp-country') as HTMLInputElement).value.trim(),
        taxId: (form.querySelector('#sp-taxid') as HTMLInputElement).value.trim(),
        website: (form.querySelector('#sp-website') as HTMLInputElement).value.trim(),
        notes: (form.querySelector('#sp-notes') as HTMLTextAreaElement).value.trim(),
      };

      if (isEdit) {
        supplierService.update(supplier!.id, data);
        notifications.success('Supplier updated successfully.');
      } else {
        supplierService.create(data);
        notifications.success('Supplier added successfully.');
      }
      onSave();
    },
  });
}
