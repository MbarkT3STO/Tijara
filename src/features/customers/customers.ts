/**
 * Customers feature page – list, search, create, edit, delete customers.
 */

import { customerService } from '@services/customerService';
import { saleService } from '@services/saleService';
import { invoiceService } from '@services/invoiceService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatDate, formatCurrency, debounce, getInitials, escapeHtml } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
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

    // View profile buttons
    page.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-view')!;
        const customer = customerService.getById(id);
        if (!customer) return;
        openCustomerProfileModal(customer, () => {
          openCustomerModal(customer, () => {
            state.customers = customerService.getAll();
            state.filtered = state.search ? customerService.search(state.search) : [...state.customers];
            render();
          });
        });
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
          i18n.t('common.delete'),
          `${i18n.t('common.confirm')} "${customer.name}"?`,
          () => {
            customerService.delete(id);
            notifications.success(`${i18n.t('customers.title').slice(0,-1)} "${customer.name}" ${i18n.t('common.delete').toLowerCase()}.`);
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

  // Handle open-item event dispatched by app.ts after search navigation
  page.addEventListener('open-item', (e) => {
    const { id } = (e as CustomEvent).detail;
    const customer = customerService.getById(id);
    if (!customer) return;
    openCustomerProfileModal(customer, () => {
      openCustomerModal(customer, () => {
        state.customers = customerService.getAll();
        state.filtered = state.search ? customerService.search(state.search) : [...state.customers];
        render();
      });
    });
  });

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
        <h2 class="page-title">${i18n.t('customers.title')}</h2>
        <p class="page-subtitle">${total === 1 ? i18n.t('customers.countTotal', { count: total }) : i18n.t('customers.countPlural', { count: total })}</p>
      </div>
      <button class="btn btn-primary" id="add-customer-btn">
        ${Icons.plus()} ${i18n.t('customers.addNew')}
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
            placeholder="${i18n.t('common.search')}..."
            value="${state.search}"
            aria-label="${i18n.t('common.search')}"
          />
        </div>
      </div>

      <div class="table-container" style="border: none; border-radius: 0;">
        <table class="data-table" aria-label="Customers list">
          <thead>
            <tr>
              <th>${i18n.t('customers.name')}</th>
              <th>${i18n.t('customers.email')}</th>
              <th>${i18n.t('customers.phone')}</th>
              <th>${i18n.t('settings.city')}</th>
              <th>${i18n.t('settings.country')}</th>
              <th>${i18n.t('common.date')}</th>
              <th>${i18n.t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${
              pageData.length === 0
                ? `<tr><td colspan="7">
                    <div class="empty-state">
                      <div class="empty-state-icon">${Icons.customers(32)}</div>
                      <p class="empty-state-title">${i18n.t('common.noData')}</p>
                      <p class="empty-state-desc">${state.search ? i18n.t('errors.loadFailed') : i18n.t('common.noData')}</p>
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
                      <div style="font-weight: 500;">${escapeHtml(c.name)}</div>
                      ${c.notes ? `<div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">${escapeHtml(c.notes)}</div>` : ''}
                    </div>
                  </div>
                </td>
                <td style="color: var(--color-text-secondary);">${escapeHtml(c.email)}</td>
                <td style="color: var(--color-text-secondary);"><span class="force-ltr">${escapeHtml(c.phone)}</span></td>
                <td>${escapeHtml(c.city)}</td>
                <td>${escapeHtml(c.country)}</td>
                <td style="color: var(--color-text-secondary);">${formatDate(c.createdAt)}</td>
                <td>
                  <div class="table-actions">
                    <button class="btn btn-ghost btn-icon btn-sm" data-view="${c.id}" aria-label="${i18n.t('common.view')}" data-tooltip="${i18n.t('common.view')}">
                      ${Icons.eye(16)}
                    </button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-edit="${c.id}" aria-label="${i18n.t('common.edit')}" data-tooltip="${i18n.t('common.edit')}">
                      ${Icons.edit(16)}
                    </button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-delete="${c.id}" aria-label="${i18n.t('common.delete')}" data-tooltip="${i18n.t('common.delete')}" style="color: var(--color-error);">
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
      <span class="pagination-info">${i18n.t('common.showing' as any)} ${start + 1}–${start + count} / ${total}</span>
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
        <label class="form-label required" for="c-name">${i18n.t('customers.modals.fullName')}</label>
        <input type="text" id="c-name" class="form-control" placeholder="..." value="${escapeHtml(customer?.name ?? '')}" required />
      </div>
      <div class="form-group">
        <label class="form-label required" for="c-email">${i18n.t('customers.modals.email')}</label>
        <input type="email" id="c-email" class="form-control" placeholder="..." value="${escapeHtml(customer?.email ?? '')}" required />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="c-phone">${i18n.t('customers.modals.phone')}</label>
        <input type="tel" id="c-phone" class="form-control force-ltr" placeholder="..." value="${escapeHtml(customer?.phone ?? '')}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="c-address">${i18n.t('customers.modals.address')}</label>
        <input type="text" id="c-address" class="form-control" placeholder="..." value="${escapeHtml(customer?.address ?? '')}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="c-city">${i18n.t('customers.modals.city')}</label>
        <input type="text" id="c-city" class="form-control" placeholder="..." value="${escapeHtml(customer?.city ?? '')}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="c-country">${i18n.t('customers.modals.country')}</label>
        <input type="text" id="c-country" class="form-control" placeholder="..." value="${escapeHtml(customer?.country ?? '')}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="c-notes">${i18n.t('customers.modals.notes')}</label>
      <textarea id="c-notes" class="form-control" placeholder="...">${escapeHtml(customer?.notes ?? '')}</textarea>
    </div>
  `;

  openModal({
    title: isEdit ? i18n.t('customers.modals.editTitle') : i18n.t('customers.modals.addTitle'),
    content: form,
    confirmText: isEdit ? i18n.t('customers.modals.saveChanges') : i18n.t('customers.addNew'),
    onConfirm: () => {
      const name = (form.querySelector('#c-name') as HTMLInputElement).value.trim();
      const email = (form.querySelector('#c-email') as HTMLInputElement).value.trim();
      if (!name || !email) {
        showModalError(form, i18n.t('errors.required'), [
          ...(!name ? ['c-name'] : []),
          ...(!email ? ['c-email'] : []),
        ]);
        return false;
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
        notifications.success(i18n.t('common.save'));
      } else {
        customerService.create(data);
        notifications.success(i18n.t('common.save'));
      }
      onSave();
    },
  });
}

/** Open customer profile modal with order history */
function openCustomerProfileModal(customer: Customer, onEdit: () => void): void {
  const sales = saleService.getByCustomer(customer.id);
  const invoices = invoiceService.getByCustomer(customer.id);

  const totalSpent = sales
    .filter((s) => s.status !== 'cancelled')
    .reduce((sum, s) => sum + s.total, 0);
  const totalOrders = sales.filter((s) => s.status !== 'cancelled').length;
  const outstandingInvoices = invoices.filter(
    (i) => i.status !== 'paid' && i.status !== 'cancelled'
  );
  const totalOutstanding = outstandingInvoices.reduce((sum, i) => sum + i.amountDue, 0);

  const STATUS_BADGE: Record<string, string> = {
    pending: 'badge-warning', confirmed: 'badge-info', shipped: 'badge-primary',
    delivered: 'badge-success', cancelled: 'badge-error',
  };
  const PAY_BADGE: Record<string, string> = {
    unpaid: 'badge-error', partial: 'badge-warning', paid: 'badge-success',
  };
  const INV_BADGE: Record<string, string> = {
    draft: 'badge-neutral', sent: 'badge-info', paid: 'badge-success',
    overdue: 'badge-error', cancelled: 'badge-neutral',
  };

  const content = document.createElement('div');
  content.innerHTML = `
    <!-- Profile header -->
    <div style="display:flex;align-items:center;gap:var(--space-4);padding-bottom:var(--space-5);border-bottom:1px solid var(--color-border);margin-bottom:var(--space-5);">
      <div class="avatar avatar-lg">${getInitials(customer.name)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:var(--font-size-xl);font-weight:700;">${escapeHtml(customer.name)}</div>
        <div style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">${escapeHtml(customer.email)}</div>
        <div style="font-size:var(--font-size-sm);color:var(--color-text-secondary);"><span class="force-ltr">${escapeHtml(customer.phone)}</span></div>
      </div>
      <div style="display:flex;gap:var(--space-2);">
        <button class="btn btn-secondary btn-sm" id="profile-statement-btn">${Icons.fileText(16)} ${i18n.t('customers.statement' as any)}</button>
        <button class="btn btn-secondary btn-sm" id="profile-edit-btn">${Icons.edit(16)} ${i18n.t('common.edit')}</button>
      </div>
    </div>

    <!-- KPI strip -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-4);margin-bottom:var(--space-5);">
      <div style="text-align:center;padding:var(--space-4);background:var(--color-bg-secondary);border-radius:var(--radius-md);">
        <div style="font-size:var(--font-size-2xl);font-weight:700;color:var(--color-primary);">${totalOrders}</div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">${i18n.t('customers.modals.totalOrders')}</div>
      </div>
      <div style="text-align:center;padding:var(--space-4);background:var(--color-bg-secondary);border-radius:var(--radius-md);">
        <div style="font-size:var(--font-size-2xl);font-weight:700;color:var(--color-success);">${formatCurrency(totalSpent)}</div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">${i18n.t('customers.modals.totalSpent')}</div>
      </div>
      <div style="text-align:center;padding:var(--space-4);background:var(--color-bg-secondary);border-radius:var(--radius-md);">
        <div style="font-size:var(--font-size-2xl);font-weight:700;color:${totalOutstanding > 0 ? 'var(--color-error)' : 'var(--color-success)'};">${formatCurrency(totalOutstanding)}</div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">${i18n.t('customers.modals.outstanding')}</div>
      </div>
    </div>

    <!-- Contact info -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-5);font-size:var(--font-size-sm);">
      <div>
        <span style="color:var(--color-text-tertiary);">${i18n.t('settings.address')}: </span>
        <span>${escapeHtml([customer.address, customer.city, customer.country].filter(Boolean).join(', ') || '—')}</span>
      </div>
      <div>
        <span style="color:var(--color-text-tertiary);">${i18n.t('customers.modals.customerSince')}: </span>
        <span>${formatDate(customer.createdAt)}</span>
      </div>
      ${customer.notes ? `<div style="grid-column:1/-1;"><span style="color:var(--color-text-tertiary);">${i18n.t('customers.modals.notes')}: </span><span>${escapeHtml(customer.notes)}</span></div>` : ''}
    </div>

    <!-- Tabs -->
    <div class="tabs" id="profile-tabs" style="margin-bottom:var(--space-4);">
      <button class="tab-btn active" data-tab="orders">${i18n.t('customers.modals.orders')} (${sales.length})</button>
      <button class="tab-btn" data-tab="invoices">${i18n.t('customers.modals.invoices')} (${invoices.length})</button>
    </div>

    <!-- Orders tab -->
    <div id="tab-orders">
      ${sales.length === 0
        ? `<div style="text-align:center;padding:var(--space-8);color:var(--color-text-tertiary);font-size:var(--font-size-sm);">${i18n.t('customers.modals.noOrders')}</div>`
        : `<div class="table-container" style="border:none;">
            <table class="data-table">
              <thead><tr><th>${i18n.t('customers.modals.orderNumber')}</th><th>${i18n.t('common.date')}</th><th>${i18n.t('customers.modals.items')}</th><th>${i18n.t('common.total')}</th><th>${i18n.t('common.status')}</th><th>${i18n.t('sales.paymentStatus')}</th></tr></thead>
              <tbody>
                ${[...sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((s) => `
                  <tr>
                    <td><span style="font-weight:600;color:var(--color-primary);">${escapeHtml(s.orderNumber)}</span></td>
                    <td style="color:var(--color-text-secondary);">${formatDate(s.createdAt)}</td>
                    <td style="color:var(--color-text-secondary);">${s.items.length}</td>
                    <td><strong>${formatCurrency(s.total)}</strong></td>
                    <td><span class="badge ${STATUS_BADGE[s.status] ?? 'badge-neutral'}">${i18n.t(`sales.statuses.${s.status}` as any)}</span></td>
                    <td><span class="badge ${PAY_BADGE[s.paymentStatus] ?? 'badge-neutral'}">${i18n.t(`sales.payments.${s.paymentStatus}` as any)}</span></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`
      }
    </div>

    <!-- Invoices tab (hidden by default) -->
    <div id="tab-invoices" style="display:none;">
      ${invoices.length === 0
        ? `<div style="text-align:center;padding:var(--space-8);color:var(--color-text-tertiary);font-size:var(--font-size-sm);">${i18n.t('customers.modals.noInvoices')}</div>`
        : `<div class="table-container" style="border:none;">
            <table class="data-table">
              <thead><tr><th>${i18n.t('customers.modals.invoiceNumber')}</th><th>${i18n.t('common.date')}</th><th>${i18n.t('common.total')}</th><th>${i18n.t('customers.modals.paid')}</th><th>${i18n.t('customers.modals.due')}</th><th>${i18n.t('common.status')}</th></tr></thead>
              <tbody>
                ${[...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((i) => `
                  <tr>
                    <td><span style="font-weight:600;color:var(--color-primary);">${escapeHtml(i.invoiceNumber)}</span></td>
                    <td style="color:var(--color-text-secondary);">${formatDate(i.createdAt)}</td>
                    <td><strong>${formatCurrency(i.total)}</strong></td>
                    <td style="color:var(--color-success);">${formatCurrency(i.amountPaid)}</td>
                    <td style="color:${i.amountDue > 0 ? 'var(--color-error)' : 'var(--color-text-secondary)'};">${formatCurrency(i.amountDue)}</td>
                    <td><span class="badge ${INV_BADGE[i.status] ?? 'badge-neutral'}">${i18n.t(`invoices.statuses.${i.status}` as any)}</span></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`
      }
    </div>
  `;

  const close = openModal({ title: i18n.t('customers.modals.profileTitle'), content, size: 'lg', hideFooter: true });

  // Tab switching
  content.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      content.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab')!;
      (content.querySelector('#tab-orders') as HTMLElement).style.display = tab === 'orders' ? '' : 'none';
      (content.querySelector('#tab-invoices') as HTMLElement).style.display = tab === 'invoices' ? '' : 'none';
    });
  });

  content.querySelector('#profile-edit-btn')?.addEventListener('click', () => {
    close();
    onEdit();
  });

  content.querySelector('#profile-statement-btn')?.addEventListener('click', () => {
    openCustomerStatementModal(customer);
  });
}

/** Open customer account statement modal */
function openCustomerStatementModal(customer: Customer): void {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const wrapper = document.createElement('div');

  const renderStatement = (startDate: string, endDate: string) => {
    const allInvoices = invoiceService.getByCustomer(customer.id);
    const filtered = allInvoices.filter((inv) => {
      const d = inv.createdAt.slice(0, 10);
      return d >= startDate && d <= endDate;
    });

    // Build statement rows
    interface StatRow { date: string; doc: string; description: string; debit: number; credit: number; balance: number; }
    const rows: StatRow[] = [];
    let runningBalance = 0;

    // Opening balance = sum of amountDue on invoices before startDate
    const openingBalance = allInvoices
      .filter((inv) => inv.createdAt.slice(0, 10) < startDate && inv.status !== 'cancelled')
      .reduce((s, inv) => s + inv.amountDue, 0);
    runningBalance = openingBalance;

    for (const inv of [...filtered].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (inv.status === 'cancelled') continue;
      // Invoice = debit (amount owed)
      runningBalance += inv.total;
      rows.push({ date: inv.createdAt, doc: inv.invoiceNumber, description: i18n.t('nav.invoices'), debit: inv.total, credit: 0, balance: runningBalance });
      // Payment = credit
      if (inv.amountPaid > 0) {
        runningBalance -= inv.amountPaid;
        rows.push({ date: inv.createdAt, doc: inv.invoiceNumber, description: i18n.t('invoices.modals.recordPayment' as any), debit: 0, credit: inv.amountPaid, balance: runningBalance });
      }
    }

    const closingBalance = runningBalance;

    wrapper.innerHTML = `
      <div style="margin-bottom:var(--space-4);">
        <div style="font-size:var(--font-size-lg);font-weight:700;margin-bottom:var(--space-1);">${escapeHtml(customer.name)}</div>
        <div style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">${escapeHtml(customer.email)} · <span class="force-ltr">${escapeHtml(customer.phone)}</span></div>
      </div>
      <div class="form-row" style="margin-bottom:var(--space-4);">
        <div class="form-group">
          <label class="form-label">${i18n.t('common.date')} ${i18n.t('common.showing' as any)}</label>
          <input type="date" id="stmt-start" class="form-control" value="${startDate}" />
        </div>
        <div class="form-group">
          <label class="form-label">${i18n.t('common.to')}</label>
          <input type="date" id="stmt-end" class="form-control" value="${endDate}" />
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>${i18n.t('common.date')}</th>
              <th>${i18n.t('common.description')}</th>
              <th>${i18n.t('invoices.invoiceNumber')}</th>
              <th style="text-align:right;">${i18n.t('invoices.modals.amount' as any)}</th>
              <th style="text-align:right;">${i18n.t('invoices.paid')}</th>
              <th style="text-align:right;">${i18n.t('accounting.ledger.runningBalance' as any)}</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background:var(--color-bg-secondary);font-style:italic;color:var(--color-text-secondary);">
              <td colspan="5">${i18n.t('accounting.ledger.openingBalance' as any)}</td>
              <td style="text-align:right;font-weight:600;">${formatCurrency(openingBalance)}</td>
            </tr>
            ${rows.length === 0
              ? `<tr><td colspan="6" style="text-align:center;padding:var(--space-6);color:var(--color-text-tertiary);">${i18n.t('common.noData')}</td></tr>`
              : rows.map((r) => `
                <tr>
                  <td style="color:var(--color-text-secondary);">${formatDate(r.date)}</td>
                  <td>${escapeHtml(r.description)}</td>
                  <td><span style="font-weight:600;color:var(--color-primary);">${escapeHtml(r.doc)}</span></td>
                  <td style="text-align:right;">${r.debit > 0 ? formatCurrency(r.debit) : '—'}</td>
                  <td style="text-align:right;color:var(--color-success);">${r.credit > 0 ? formatCurrency(r.credit) : '—'}</td>
                  <td style="text-align:right;font-weight:600;color:${r.balance > 0 ? 'var(--color-error)' : 'var(--color-success)'};">${formatCurrency(r.balance)}</td>
                </tr>`).join('')
            }
            <tr style="background:var(--color-bg-secondary);font-weight:700;border-top:2px solid var(--color-border);">
              <td colspan="5">${i18n.t('accounting.ledger.closingBalance' as any)}</td>
              <td style="text-align:right;color:${closingBalance > 0 ? 'var(--color-error)' : 'var(--color-success)'};">${formatCurrency(closingBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-4);justify-content:flex-end;">
        <button class="btn btn-secondary btn-sm" id="stmt-print-btn">${Icons.print ? Icons.print(16) : '🖨'} ${i18n.t('common.print')}</button>
      </div>
    `;

    // Date range change handlers
    wrapper.querySelector<HTMLInputElement>('#stmt-start')?.addEventListener('change', (e) => {
      renderStatement((e.target as HTMLInputElement).value, (wrapper.querySelector<HTMLInputElement>('#stmt-end')?.value ?? endDate));
    });
    wrapper.querySelector<HTMLInputElement>('#stmt-end')?.addEventListener('change', (e) => {
      renderStatement((wrapper.querySelector<HTMLInputElement>('#stmt-start')?.value ?? startDate), (e.target as HTMLInputElement).value);
    });

    wrapper.querySelector('#stmt-print-btn')?.addEventListener('click', () => {
      window.print();
    });
  };

  renderStatement(firstOfMonth, today);

  openModal({
    title: i18n.t('customers.statement' as any),
    content: wrapper,
    size: 'lg',
    hideFooter: true,
  });
}
