/**
 * Suppliers feature page – list, search, create, edit, delete suppliers.
 */

import { supplierService } from '@services/supplierService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatDate, debounce, getInitials } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
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
        confirmDialog(i18n.t('common.delete'), `${i18n.t('common.confirm')} "${supplier.name}"? ${i18n.t('common.noData')}`, () => {
          supplierService.delete(supplier.id);
          notifications.success(i18n.t('common.save'));
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
        <h2 class="page-title">${i18n.t('suppliers.title')}</h2>
        <p class="page-subtitle">${total === 1 ? i18n.t('suppliers.countTotal', { count: total }) : i18n.t('suppliers.countPlural', { count: total })}</p>
      </div>
      <button class="btn btn-primary" id="add-supplier-btn">${Icons.plus()} ${i18n.t('suppliers.addNew')}</button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="search-bar" style="flex:1;max-width:360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input type="search" id="supplier-search" class="form-control"
            placeholder="${i18n.t('common.search')}..." value="${state.search}" aria-label="${i18n.t('common.search')}" />
        </div>
      </div>

      <div class="table-container" style="border:none;border-radius:0;">
        <table class="data-table" aria-label="Suppliers list">
          <thead>
            <tr>
              <th>${i18n.t('suppliers.name')}</th>
              <th>${i18n.t('suppliers.contactPerson')}</th>
              <th>${i18n.t('suppliers.email')}</th>
              <th>${i18n.t('suppliers.phone')}</th>
              <th>${i18n.t('suppliers.city')}</th>
              <th>${i18n.t('suppliers.country')}</th>
              <th>${i18n.t('suppliers.since')}</th>
              <th>${i18n.t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0
              ? `<tr><td colspan="8">
                  <div class="empty-state">
                    <div class="empty-state-icon">${Icons.truck(32)}</div>
                    <p class="empty-state-title">${i18n.t('common.noData')}</p>
                    <p class="empty-state-desc">${state.search ? i18n.t('common.noData') : i18n.t('suppliers.addNew')}</p>
                  </div>
                </td></tr>`
              : pageData.map((s) => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:var(--space-3);">
                      <div class="avatar avatar-sm">${getInitials(s.name)}</div>
                      <div>
                        <div style="font-weight:500;">${s.name}</div>
                        ${s.taxId ? `<div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">${i18n.t('suppliers.modals.taxId')}: ${s.taxId}</div>` : ''}
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
                      <button class="btn btn-ghost btn-icon btn-sm" data-view="${s.id}" aria-label="${i18n.t('common.view')}" data-tooltip="${i18n.t('common.view')}">${Icons.eye(16)}</button>
                      <button class="btn btn-ghost btn-icon btn-sm" data-edit="${s.id}" aria-label="${i18n.t('common.edit')}" data-tooltip="${i18n.t('common.edit')}">${Icons.edit(16)}</button>
                      <button class="btn btn-ghost btn-icon btn-sm" data-delete="${s.id}" aria-label="${i18n.t('common.delete')}" data-tooltip="${i18n.t('common.delete')}" style="color:var(--color-error);">${Icons.trash(16)}</button>
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
      <span class="pagination-info">${i18n.t('common.showing')} ${start + 1}–${start + count} ${i18n.t('common.of')} ${total}</span>
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
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('suppliers.contactPerson')}</div>
        <div style="font-weight:500;">${supplier.contactPerson || '—'}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('suppliers.email')}</div>
        <div>${supplier.email || '—'}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('suppliers.phone')}</div>
        <div>${supplier.phone || '—'}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('suppliers.modals.website')}</div>
        <div>${supplier.website ? `<a href="${supplier.website}" target="_blank" style="color:var(--color-primary);">${supplier.website}</a>` : '—'}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('suppliers.modals.address')}</div>
        <div>${[supplier.address, supplier.city, supplier.country].filter(Boolean).join(', ') || '—'}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('suppliers.modals.taxId')}</div>
        <div>${supplier.taxId || '—'}</div>
      </div>
    </div>
    ${supplier.notes ? `
    <div style="padding:var(--space-3) var(--space-4);background:var(--color-bg-secondary);border-radius:var(--radius-sm);font-size:var(--font-size-sm);color:var(--color-text-secondary);">
      <div style="font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('common.notes')}</div>
      ${supplier.notes}
    </div>` : ''}
    <div style="margin-top:var(--space-5);">
      <button class="btn btn-secondary" id="detail-edit-btn">${Icons.edit(16)} ${i18n.t('common.edit')}</button>
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
        <label class="form-label required" for="sp-name">${i18n.t('suppliers.name')}</label>
        <input type="text" id="sp-name" class="form-control" placeholder="Acme Supplies Ltd" value="${supplier?.name ?? ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="sp-contact">${i18n.t('suppliers.contactPerson')}</label>
        <input type="text" id="sp-contact" class="form-control" placeholder="John Smith" value="${supplier?.contactPerson ?? ''}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="sp-email">${i18n.t('suppliers.email')}</label>
        <input type="email" id="sp-email" class="form-control" placeholder="contact@supplier.com" value="${supplier?.email ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="sp-phone">${i18n.t('suppliers.phone')}</label>
        <input type="tel" id="sp-phone" class="form-control" placeholder="+1-555-0100" value="${supplier?.phone ?? ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="sp-address">${i18n.t('suppliers.modals.address')}</label>
      <input type="text" id="sp-address" class="form-control" placeholder="123 Industrial Ave" value="${supplier?.address ?? ''}" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="sp-city">${i18n.t('suppliers.city')}</label>
        <input type="text" id="sp-city" class="form-control" placeholder="Chicago" value="${supplier?.city ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="sp-country">${i18n.t('suppliers.country')}</label>
        <input type="text" id="sp-country" class="form-control" placeholder="USA" value="${supplier?.country ?? ''}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="sp-taxid">${i18n.t('suppliers.modals.taxId')}</label>
        <input type="text" id="sp-taxid" class="form-control" placeholder="US-123456789" value="${supplier?.taxId ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="sp-website">${i18n.t('suppliers.modals.website')}</label>
        <input type="url" id="sp-website" class="form-control" placeholder="https://supplier.com" value="${supplier?.website ?? ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="sp-notes">${i18n.t('common.notes')}</label>
      <textarea id="sp-notes" class="form-control" placeholder="${i18n.t('common.notes')}">${supplier?.notes ?? ''}</textarea>
    </div>
  `;

  openModal({
    title: isEdit ? i18n.t('suppliers.modals.editTitle') : i18n.t('suppliers.modals.addTitle'),
    content: form,
    confirmText: isEdit ? i18n.t('common.save') : i18n.t('common.add'),
    onConfirm: () => {
      const name = (form.querySelector('#sp-name') as HTMLInputElement).value.trim();
      if (!name) {
        showModalError(form, i18n.t('errors.required'), ['sp-name']);
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
        notifications.success(i18n.t('common.save'));
      } else {
        supplierService.create(data);
        notifications.success(i18n.t('common.save'));
      }
      onSave();
    },
  });
}
