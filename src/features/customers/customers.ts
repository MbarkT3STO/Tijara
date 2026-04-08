/**
 * Customers feature page – list, search, create, edit, delete customers.
 */

import { customerService } from '@services/customerService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatDate, debounce, getInitials } from '@shared/utils/helpers';
import type { Customer } from '@core/types';

const PAGE_SIZE = 10;

interface State {
  customers: Customer[];
  filtered: Customer[];
  page: number;
  search: string;
}

/** Render and return the customers page */
export function renderCustomers(): HTMLElement {
  const state: State = {
    customers: customerService.getAll(),
    filtered: [],
    page: 1,
    search: '',
  };

  state.filtered = [...state.customers];

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    // Search
    const searchInput = page.querySelector<HTMLInputElement>('#customer-search');
    searchInput?.addEventListener(
      'input',
      debounce((e: Event) => {
        state.search = (e.target as HTMLInputElement).value;
        state.filtered = state.search
          ? customerService.search(state.search)
          : [...state.customers];
        state.page = 1;
        render();
      }, 300) as EventListener
    );

    // Add button
    page.querySelector('#add-customer-btn')?.addEventListener('click', () => {
      openCustomerModal(null, () => {
        state.customers = customerService.getAll();
        state.filtered = state.search ? customerService.search(state.search) : [...state.customers];
        render();
      });
    });

    // Edit buttons
    page.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit')!;
        const customer = customerService.getById(id);
        if (!customer) return;
        openCustomerModal(customer, () => {
          state.customers = customerService.getAll();
          state.filtered = state.search
            ? customerService.search(state.search)
            : [...state.customers];
          render();
        });
      });
    });

    // Delete buttons
    page.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete')!;
        const customer = customerService.getById(id);
        if (!customer) return;
        confirmDialog(
          'Delete Customer',
          `Are you sure you want to delete "${customer.name}"? This action cannot be undone.`,
          () => {
            customerService.delete(id);
            notifications.success(`Customer "${customer.name}" deleted.`);
            state.customers = customerService.getAll();
            state.filtered = state.search
              ? customerService.search(state.search)
              : [...state.customers];
            if (state.page > Math.ceil(state.filtered.length / PAGE_SIZE)) {
              state.page = Math.max(1, state.page - 1);
            }
            render();
          }
        );
      });
    });

    // Pagination
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

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Customers</h2>
        <p class="page-subtitle">${total} customer${total !== 1 ? 's' : ''} total</p>
      </div>
      <button class="btn btn-primary" id="add-customer-btn">
        ${Icons.plus()} Add Customer
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="search-bar" style="flex: 1; max-width: 360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input
            type="search"
            id="customer-search"
            class="form-control"
            placeholder="Search customers..."
            value="${state.search}"
            aria-label="Search customers"
          />
        </div>
      </div>

      <div class="table-container" style="border: none; border-radius: 0;">
        <table class="data-table" aria-label="Customers list">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Email</th>
              <th>Phone</th>
              <th>City</th>
              <th>Country</th>
              <th>Since</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              pageData.length === 0
                ? `<tr><td colspan="7">
                    <div class="empty-state">
                      <div class="empty-state-icon">${Icons.customers(32)}</div>
                      <p class="empty-state-title">No customers found</p>
                      <p class="empty-state-desc">${state.search ? 'Try a different search term.' : 'Add your first customer to get started.'}</p>
                    </div>
                  </td></tr>`
                : pageData
                    .map(
                      (c) => `
              <tr>
                <td>
                  <div style="display: flex; align-items: center; gap: var(--space-3);">
                    <div class="avatar avatar-sm">${getInitials(c.name)}</div>
                    <div>
                      <div style="font-weight: 500;">${c.name}</div>
                      ${c.notes ? `<div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">${c.notes}</div>` : ''}
                    </div>
                  </div>
                </td>
                <td style="color: var(--color-text-secondary);">${c.email}</td>
                <td style="color: var(--color-text-secondary);">${c.phone}</td>
                <td>${c.city}</td>
                <td>${c.country}</td>
                <td style="color: var(--color-text-secondary);">${formatDate(c.createdAt)}</td>
                <td>
                  <div class="table-actions">
                    <button class="btn btn-ghost btn-icon btn-sm" data-edit="${c.id}" aria-label="Edit ${c.name}" data-tooltip="Edit">
                      ${Icons.edit(16)}
                    </button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-delete="${c.id}" aria-label="Delete ${c.name}" data-tooltip="Delete" style="color: var(--color-error);">
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
        <button class="pagination-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Previous page">
          ${Icons.chevronLeft(16)}
        </button>
        ${pages
          .map(
            (p) =>
              `<button class="pagination-btn ${p === page ? 'active' : ''}" data-page="${p}" aria-label="Page ${p}" aria-current="${p === page ? 'page' : 'false'}">${p}</button>`
          )
          .join('')}
        <button class="pagination-btn" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''} aria-label="Next page">
          ${Icons.chevronRight(16)}
        </button>
      </div>
    </div>
  `;
}

/** Open create/edit customer modal */
function openCustomerModal(customer: Customer | null, onSave: () => void): void {
  const isEdit = customer !== null;

  const form = document.createElement('form');
  form.id = 'customer-form';
  form.noValidate = true;
  form.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="c-name">Full Name</label>
        <input type="text" id="c-name" class="form-control" placeholder="Acme Corp" value="${customer?.name ?? ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label required" for="c-email">Email</label>
        <input type="email" id="c-email" class="form-control" placeholder="contact@example.com" value="${customer?.email ?? ''}" required />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="c-phone">Phone</label>
        <input type="tel" id="c-phone" class="form-control" placeholder="+1-555-0100" value="${customer?.phone ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="c-address">Address</label>
        <input type="text" id="c-address" class="form-control" placeholder="123 Main St" value="${customer?.address ?? ''}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="c-city">City</label>
        <input type="text" id="c-city" class="form-control" placeholder="New York" value="${customer?.city ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="c-country">Country</label>
        <input type="text" id="c-country" class="form-control" placeholder="USA" value="${customer?.country ?? ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="c-notes">Notes</label>
      <textarea id="c-notes" class="form-control" placeholder="Optional notes...">${customer?.notes ?? ''}</textarea>
    </div>
  `;

  openModal({
    title: isEdit ? 'Edit Customer' : 'Add Customer',
    content: form,
    confirmText: isEdit ? 'Save Changes' : 'Add Customer',
    onConfirm: () => {
      const name = (form.querySelector('#c-name') as HTMLInputElement).value.trim();
      const email = (form.querySelector('#c-email') as HTMLInputElement).value.trim();
      if (!name || !email) {
        notifications.error('Name and email are required.');
        return;
      }

      const data = {
        name,
        email,
        phone: (form.querySelector('#c-phone') as HTMLInputElement).value.trim(),
        address: (form.querySelector('#c-address') as HTMLInputElement).value.trim(),
        city: (form.querySelector('#c-city') as HTMLInputElement).value.trim(),
        country: (form.querySelector('#c-country') as HTMLInputElement).value.trim(),
        notes: (form.querySelector('#c-notes') as HTMLTextAreaElement).value.trim(),
      };

      if (isEdit) {
        customerService.update(customer!.id, data);
        notifications.success('Customer updated successfully.');
      } else {
        customerService.create(data);
        notifications.success('Customer added successfully.');
      }
      onSave();
    },
  });
}
