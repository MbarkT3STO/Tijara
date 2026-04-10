/**
 * Invoices feature page.
 */

import { invoiceService } from '@services/invoiceService';
import { saleService } from '@services/saleService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, debounce } from '@shared/utils/helpers';
import { printInvoice, exportInvoicePDF } from '@shared/utils/invoicePdf';
import { profileService } from '@services/profileService';
import { i18n } from '@core/i18n';
import { accountingIntegrationService } from '@services/accountingIntegrationService';
import type { Invoice } from '@core/types';

const PAGE_SIZE = 10;

interface State {
  invoices: Invoice[];
  filtered: Invoice[];
  page: number;
  search: string;
  statusFilter: string;
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-neutral',
  sent: 'badge-info',
  paid: 'badge-success',
  overdue: 'badge-error',
  cancelled: 'badge-neutral',
};

function getStatusLabel(status: string): string {
  return i18n.t(`invoices.statuses.${status.toLowerCase()}` as any) || status;
}

/** Render and return the invoices page */
export function renderInvoices(): HTMLElement {
  invoiceService.markOverdue();

  const state: State = {
    invoices: invoiceService.getAll(),
    filtered: [],
    page: 1,
    search: '',
    statusFilter: '',
  };

  state.filtered = [...state.invoices];

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function applyFilters() {
    let data = [...state.invoices];
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q)
      );
    }
    if (state.statusFilter) {
      data = data.filter((i) => i.status === state.statusFilter);
    }
    state.filtered = data;
    state.page = 1;
  }

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    page.querySelector<HTMLInputElement>('#invoice-search')?.addEventListener(
      'input',
      debounce((e: Event) => {
        state.search = (e.target as HTMLInputElement).value;
        applyFilters();
        render();
      }, 300) as EventListener
    );

    page.querySelector<HTMLSelectElement>('#inv-status-filter')?.addEventListener('change', (e) => {
      state.statusFilter = (e.target as HTMLSelectElement).value;
      applyFilters();
      render();
    });

    page.querySelector('#create-invoice-btn')?.addEventListener('click', () => {
      openCreateInvoiceModal(() => {
        state.invoices = invoiceService.getAll();
        applyFilters();
        render();
      });
    });

    // ── Three-dot dropdown menus (body portal – avoids overflow clipping) ──
    // The menu is appended to document.body and positioned via getBoundingClientRect.
    let activePortal: HTMLElement | null = null;
    let activeTrigger: HTMLButtonElement | null = null;

    const closePortal = () => {
      activePortal?.remove();
      activePortal = null;
      activeTrigger?.setAttribute('aria-expanded', 'false');
      activeTrigger = null;
    };

    // Close on outside click or scroll
    document.addEventListener('click', closePortal);
    document.querySelector('.content-area')?.addEventListener('scroll', closePortal);

    const openPortal = (trigger: HTMLButtonElement, invId: string, invNumber: string) => {
      // Close any already-open portal first
      closePortal();

      const rect = trigger.getBoundingClientRect();

      const menu = document.createElement('div');
      menu.className = 'inv-portal-menu';
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', `Actions for invoice ${invNumber}`);
      menu.innerHTML = `
        <button class="dropdown-item" data-action="view"   role="menuitem">${Icons.eye(16)}      ${i18n.t('common.view')}</button>
        <button class="dropdown-item" data-action="edit"   role="menuitem">${Icons.edit(16)}     ${i18n.t('common.edit')}</button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" data-action="pdf"    role="menuitem" style="color:var(--color-primary);">${Icons.fileText(16)}  ${i18n.t('common.export' as any)} PDF</button>
        <button class="dropdown-item" data-action="print"  role="menuitem">${Icons.printer(16)}  ${i18n.t('common.print')}</button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item danger" data-action="delete" role="menuitem">${Icons.trash(16)} ${i18n.t('common.delete')}</button>
      `;

      // Position: align right edge of menu with right edge of trigger
      const menuWidth = 168;
      let left = rect.right - menuWidth;
      let top = rect.bottom + 4;

      // Flip upward if too close to viewport bottom
      if (top + 220 > window.innerHeight) {
        top = rect.top - 220;
      }
      // Keep within left viewport edge
      if (left < 8) left = 8;

      menu.style.cssText = `
        position: fixed;
        top: ${top}px;
        left: ${left}px;
        width: ${menuWidth}px;
        z-index: 9999;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        animation: slideUp 150ms ease;
      `;

      document.body.appendChild(menu);
      activePortal = menu;
      activeTrigger = trigger;
      trigger.setAttribute('aria-expanded', 'true');

      // Stop clicks inside the menu from immediately closing it
      menu.addEventListener('click', (e) => e.stopPropagation());

      // Wire up action items
      menu.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((item) => {
        item.addEventListener('click', async () => {
          const action = item.getAttribute('data-action')!;
          closePortal();

          const invoice = invoiceService.getById(invId);
          if (!invoice) return;

          switch (action) {
            case 'view':
              openInvoiceDetailModal(invoice, () => {
                state.invoices = invoiceService.getAll();
                applyFilters();
                render();
              });
              break;

            case 'edit':
              openInvoiceEditModal(invoice, () => {
                state.invoices = invoiceService.getAll();
                applyFilters();
                render();
              });
              break;

            case 'pdf':
              item.setAttribute('disabled', 'true');
              try {
                await exportInvoicePDF(invoice);
                notifications.success(i18n.t('common.pdfExportSuccess' as any));
              } catch {
                notifications.error(i18n.t('common.pdfExportError' as any));
              } finally {
                item.removeAttribute('disabled');
              }
              break;

            case 'print':
              printInvoice(invoice);
              break;

            case 'delete':
              confirmDialog(i18n.t('common.delete'), `${i18n.t('common.confirm')} "${invoice.invoiceNumber}"?`, () => {
                invoiceService.delete(invId);
                notifications.success(i18n.t('common.delete'));
                state.invoices = invoiceService.getAll();
                applyFilters();
                render();
              });
              break;
          }
        });
      });
    };

    // Attach trigger clicks
    page.querySelectorAll<HTMLButtonElement>('.inv-menu-trigger').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrapper = trigger.closest<HTMLElement>('.inv-action-menu')!;
        const invId     = wrapper.getAttribute('data-inv-id')!;
        const invNumber = wrapper.getAttribute('data-inv-number')!;
        // Toggle: if this trigger's portal is already open, close it
        if (activeTrigger === trigger) {
          closePortal();
        } else {
          openPortal(trigger, invId, invNumber);
        }
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
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (state.page - 1) * PAGE_SIZE;
  const pageData = state.filtered.slice(start, start + PAGE_SIZE);

  const totalRevenue = state.invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.total, 0);
  const totalDue = state.invoices
    .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
    .reduce((s, i) => s + i.amountDue, 0);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('invoices.title')}</h2>
        <p class="page-subtitle">${total === 1 ? i18n.t('invoices.countTotal', { count: total }) : i18n.t('invoices.countPlural', { count: total })}</p>
      </div>
      <button class="btn btn-primary" id="create-invoice-btn">
        ${Icons.plus()} ${i18n.t('invoices.modals.createTitle')}
      </button>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); margin-bottom: var(--space-6);">
      <div class="card stat-card">
        <div class="stat-card-icon" style="background: var(--color-success-subtle); color: var(--color-success);">${Icons.check()}</div>
        <div class="stat-card-value">${formatCurrency(totalRevenue)}</div>
        <div class="stat-card-label">${i18n.t('invoices.stats.totalCollected')}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background: var(--color-warning-subtle); color: var(--color-warning);">${Icons.alertCircle()}</div>
        <div class="stat-card-value">${formatCurrency(totalDue)}</div>
        <div class="stat-card-label">${i18n.t('invoices.stats.outstanding')}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background: var(--color-error-subtle); color: var(--color-error);">${Icons.alertCircle()}</div>
        <div class="stat-card-value">${state.invoices.filter((i) => i.status === 'overdue').length}</div>
        <div class="stat-card-label">${i18n.t('invoices.stats.overdue')}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="gap: var(--space-3); flex-wrap: wrap;">
        <div class="search-bar" style="flex: 1; max-width: 360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input type="search" id="invoice-search" class="form-control" placeholder="${i18n.t('common.search')}..." value="${state.search}" aria-label="${i18n.t('common.search')}" />
        </div>
        <select id="inv-status-filter" class="form-control" style="width: auto;" aria-label="${i18n.t('common.filter')}">
          <option value="">${i18n.t('common.all')}</option>
          <option value="draft" ${state.statusFilter === 'draft' ? 'selected' : ''}>${getStatusLabel('draft')}</option>
          <option value="sent" ${state.statusFilter === 'sent' ? 'selected' : ''}>${getStatusLabel('sent')}</option>
          <option value="paid" ${state.statusFilter === 'paid' ? 'selected' : ''}>${getStatusLabel('paid')}</option>
          <option value="overdue" ${state.statusFilter === 'overdue' ? 'selected' : ''}>${getStatusLabel('overdue')}</option>
          <option value="cancelled" ${state.statusFilter === 'cancelled' ? 'selected' : ''}>${getStatusLabel('cancelled')}</option>
        </select>
      </div>

      <div class="table-container" style="border: none; border-radius: 0;">
        <table class="data-table" aria-label="Invoices list">
          <thead>
            <tr>
              <th>${i18n.t('invoices.invoiceNumber')}</th>
              <th>${i18n.t('invoices.customer')}</th>
              <th>${i18n.t('invoices.total')}</th>
              <th>${i18n.t('invoices.paid')}</th>
              <th>${i18n.t('invoices.due')}</th>
              <th>${i18n.t('common.status')}</th>
              <th>${i18n.t('invoices.dueDate')}</th>
              <th>${i18n.t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${
              pageData.length === 0
                ? `<tr><td colspan="8">
                    <div class="empty-state">
                      <div class="empty-state-icon">${Icons.invoices(32)}</div>
                      <p class="empty-state-title">${i18n.t('common.noData')}</p>
                      <p class="empty-state-desc">${state.search ? i18n.t('errors.loadFailed') : i18n.t('invoices.modals.createTitle')}</p>
                    </div>
                  </td></tr>`
                : pageData
                    .map(
                      (inv) => `
              <tr>
                <td><span style="font-weight: 600; color: var(--color-primary);">${inv.invoiceNumber}</span></td>
                <td>${inv.customerName}</td>
                <td><strong>${formatCurrency(inv.total)}</strong></td>
                <td style="color: var(--color-success);">${formatCurrency(inv.amountPaid)}</td>
                <td style="color: ${inv.amountDue > 0 ? 'var(--color-error)' : 'var(--color-text-secondary)'}; font-weight: ${inv.amountDue > 0 ? '600' : '400'};">${formatCurrency(inv.amountDue)}</td>
                <td><span class="badge ${STATUS_BADGE[inv.status] ?? 'badge-neutral'}">${getStatusLabel(inv.status)}</span></td>
                <td style="color: var(--color-text-secondary);">${formatDate(inv.dueDate)}</td>
                <td>
                  <div class="inv-action-menu" data-inv-id="${inv.id}" data-inv-number="${inv.invoiceNumber}">
                    <button
                      class="btn btn-ghost btn-icon btn-sm inv-menu-trigger"
                      aria-label="${i18n.t('common.actions')}"
                      data-tooltip="${i18n.t('common.actions')}"
                      aria-haspopup="true"
                      aria-expanded="false"
                    >
                      ${Icons.moreVertical(16)}
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
        <button class="pagination-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>${Icons.chevronLeft(16)}</button>
        ${pages.map((p) => `<button class="pagination-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`).join('')}
        <button class="pagination-btn" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>${Icons.chevronRight(16)}</button>
      </div>
    </div>
  `;
}

function openInvoiceDetailModal(invoice: Invoice, onUpdate: () => void): void {
  const profile = profileService.get();

  const statusColor: Record<string, string> = {
    draft:     'var(--color-text-tertiary)',
    sent:      'var(--color-info)',
    paid:      'var(--color-success)',
    overdue:   'var(--color-error)',
    cancelled: 'var(--color-text-tertiary)',
  };
  const accentColor = statusColor[invoice.status] ?? 'var(--color-text-tertiary)';

  const netDays = Math.round(
    (new Date(invoice.dueDate).getTime() - new Date(invoice.createdAt).getTime()) / 86400000
  );

  // ── Brand block ──────────────────────────────────────────────────────────
  let brandHTML = '';
  if (profile.logo) {
    brandHTML = `
      <div style="display:flex;align-items:center;gap:var(--space-3);">
        <img src="${profile.logo}" alt="${profile.name} logo"
          style="max-height:52px;max-width:140px;object-fit:contain;display:block;" />
        ${profile.name ? `
        <div>
          <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--color-primary);letter-spacing:-0.02em;">${profile.name}</div>
          ${profile.tagline ? `<div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;">${profile.tagline}</div>` : ''}
        </div>` : ''}
      </div>`;
  } else if (profile.name) {
    brandHTML = `
      <div style="display:flex;align-items:center;gap:var(--space-3);">
        <div style="width:44px;height:44px;border-radius:var(--radius-sm);background:linear-gradient(135deg,var(--color-primary-dark),var(--color-primary-light));display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </div>
        <div>
          <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--color-primary);letter-spacing:-0.02em;">${profile.name}</div>
          ${profile.tagline ? `<div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;">${profile.tagline}</div>` : ''}
        </div>
      </div>`;
  } else {
    brandHTML = `
      <div style="display:flex;align-items:center;gap:var(--space-3);">
        <div style="width:44px;height:44px;border-radius:var(--radius-sm);background:linear-gradient(135deg,var(--color-primary-dark),var(--color-primary-light));display:flex;align-items:center;justify-content:center;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </div>
        <div>
          <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--color-primary);">Tijara</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;">${i18n.t('settings.aboutSubtitle' as any)}</div>
        </div>
      </div>`;
  }

  // ── From block ───────────────────────────────────────────────────────────
  let fromHTML = '';
  if (profile.name) {
    fromHTML += `<div style="font-weight:600;color:var(--color-text-primary);margin-bottom:2px;">${profile.name}</div>`;
    if (profile.address) fromHTML += `<div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">${profile.address}${profile.city ? ', ' + profile.city : ''}${profile.country ? ', ' + profile.country : ''}</div>`;
    if (profile.email)   fromHTML += `<div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">${profile.email}</div>`;
    if (profile.phone)   fromHTML += `<div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);"><span class="force-ltr">${profile.phone}</span></div>`;
    if (profile.website) fromHTML += `<div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">${profile.website}</div>`;
    if (profile.taxId)   fromHTML += `<div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">${i18n.t('settings.taxId')}: ${profile.taxId}</div>`;
  } else {
    fromHTML = `<div style="font-weight:600;color:var(--color-text-primary);">Tijara Inc.</div><div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">billing@tijara.app</div>`;
  }

  // ── Item rows ────────────────────────────────────────────────────────────
  const itemRows = invoice.items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? 'transparent' : 'var(--color-primary-subtle)'};">
      <td style="padding:var(--space-2) var(--space-3);">${item.productName}</td>
      <td style="padding:var(--space-2) var(--space-3);text-align:center;">${item.quantity}</td>
      <td style="padding:var(--space-2) var(--space-3);text-align:right;">${formatCurrency(item.unitPrice)}</td>
      <td style="padding:var(--space-2) var(--space-3);text-align:center;">${item.discount > 0 ? item.discount + '%' : '—'}</td>
      <td style="padding:var(--space-2) var(--space-3);text-align:right;font-weight:600;">${formatCurrency(item.total)}</td>
    </tr>`).join('');

  const content = document.createElement('div');
  content.innerHTML = `
    <!-- Invoice preview wrapper -->
    <div style="background:var(--color-surface);border-radius:var(--radius-md);overflow:hidden;">

      <!-- Header: brand + invoice meta -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:var(--space-6);border-bottom:2px solid var(--color-primary);gap:var(--space-4);">
        ${brandHTML}
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:var(--font-size-2xl);font-weight:700;color:var(--color-text-primary);">${invoice.invoiceNumber}</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-top:2px;">${i18n.t('invoices.modals.issued')}: ${formatDate(invoice.createdAt)}</div>
          <div style="display:inline-block;margin-top:var(--space-2);padding:2px 10px;border-radius:var(--radius-full);font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.05em;background:${accentColor}1a;color:${accentColor};border:1px solid ${accentColor}44;">
            ${getStatusLabel(invoice.status)}
          </div>
        </div>
      </div>

      <!-- From / Bill To -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6);padding:var(--space-5) var(--space-6);">
        <div>
          <div style="font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-tertiary);margin-bottom:var(--space-2);">${i18n.t('invoices.modals.from')}</div>
          ${fromHTML}
        </div>
        <div>
          <div style="font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-tertiary);margin-bottom:var(--space-2);">${i18n.t('invoices.modals.billTo')}</div>
          <div style="font-weight:600;color:var(--color-text-primary);margin-bottom:2px;">${invoice.customerName}</div>
        </div>
      </div>

      <!-- Dates strip -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-4);padding:var(--space-4) var(--space-6);background:var(--color-bg-secondary);border-top:1px solid var(--color-border);border-bottom:1px solid var(--color-border);">
        <div>
          <div style="font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-tertiary);margin-bottom:2px;">${i18n.t('invoices.modals.invoiceDate')}</div>
          <div style="font-size:var(--font-size-sm);font-weight:500;color:var(--color-text-primary);">${formatDate(invoice.createdAt)}</div>
        </div>
        <div>
          <div style="font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-tertiary);margin-bottom:2px;">${i18n.t('invoices.dueDate')}</div>
          <div style="font-size:var(--font-size-sm);font-weight:500;color:var(--color-text-primary);">${formatDate(invoice.dueDate)}</div>
        </div>
        <div>
          <div style="font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-tertiary);margin-bottom:2px;">${i18n.t('invoices.modals.paymentTermsLabel')}</div>
          <div style="font-size:var(--font-size-sm);font-weight:500;color:var(--color-text-primary);">${i18n.t('common.net' as any)} ${netDays > 0 ? netDays : 30} ${i18n.t('common.date').toLowerCase()}</div>
        </div>
      </div>

      <!-- Items table -->
      <div style="padding:var(--space-5) var(--space-6);">
        <table style="width:100%;border-collapse:collapse;font-size:var(--font-size-sm);">
          <thead>
            <tr style="background:var(--color-primary);">
              <th style="padding:var(--space-2) var(--space-3);text-align:left;font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:white;">${i18n.t('products.modals.name')}</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:center;font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:white;">${i18n.t('common.quantity' as any)}</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:right;font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:white;">${i18n.t('products.price')}</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:center;font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:white;">${i18n.t('sales.discount')}</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:right;font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:white;">${i18n.t('common.amount')}</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>

      <!-- Totals -->
      <div style="display:flex;justify-content:flex-end;padding:0 var(--space-6) var(--space-5);">
        <div style="width:260px;display:flex;flex-direction:column;gap:0;">
          <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0;font-size:var(--font-size-sm);color:var(--color-text-secondary);border-bottom:1px solid var(--color-border-subtle);">
            <span>${i18n.t('sales.subtotal')}</span><span>${formatCurrency(invoice.subtotal)}</span>
          </div>
          ${invoice.discount > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0;font-size:var(--font-size-sm);color:var(--color-text-secondary);border-bottom:1px solid var(--color-border-subtle);">
            <span>${i18n.t('sales.discount')}</span><span style="color:var(--color-error);">-${formatCurrency(invoice.discount)}</span>
          </div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0;font-size:var(--font-size-sm);color:var(--color-text-secondary);border-bottom:1px solid var(--color-border-subtle);">
            <span>${i18n.t('sales.tax')} (${invoice.taxRate}%)</span><span>${formatCurrency(invoice.taxAmount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:var(--space-3) 0 var(--space-2);font-size:var(--font-size-lg);font-weight:700;color:var(--color-primary);border-top:2px solid var(--color-primary);margin-top:var(--space-1);">
            <span>${i18n.t('common.total')}</span><span>${formatCurrency(invoice.total)}</span>
          </div>
          ${invoice.amountPaid > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:var(--space-1) 0;font-size:var(--font-size-sm);font-weight:500;color:var(--color-success);">
            <span>${i18n.t('invoices.paid')}</span><span>${formatCurrency(invoice.amountPaid)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:var(--space-1) 0;font-size:var(--font-size-sm);font-weight:700;color:${invoice.amountDue > 0 ? 'var(--color-error)' : 'var(--color-success)'};">
            <span>${i18n.t('invoices.modals.balanceDue')}</span><span>${formatCurrency(invoice.amountDue)}</span>
          </div>` : ''}
        </div>
      </div>

      ${invoice.notes ? `
      <!-- Notes -->
      <div style="margin:0 var(--space-6) var(--space-5);padding:var(--space-3) var(--space-4);background:var(--color-bg-secondary);border-left:3px solid var(--color-primary);border-radius:0 var(--radius-sm) var(--radius-sm) 0;">
        <div style="font-size:var(--font-size-xs);font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('common.notes')}</div>
        <div style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">${invoice.notes}</div>
      </div>` : ''}

    </div>

    <!-- Record payment (only when amount is due) -->
    ${invoice.amountDue > 0 ? `
    <div style="margin-top:var(--space-5);padding:var(--space-4);background:var(--color-bg-secondary);border-radius:var(--radius-md);border:1px solid var(--color-border);">
      <div style="font-size:var(--font-size-sm);font-weight:600;margin-bottom:var(--space-3);">${i18n.t('invoices.modals.recordPayment')}</div>
      <div style="display:flex;gap:var(--space-2);">
        <input type="number" id="payment-amount" class="form-control" placeholder="${i18n.t('invoices.modals.amount')}"
          min="0" max="${invoice.amountDue}" step="0.01" value="${invoice.amountDue}" />
        <button type="button" class="btn btn-primary" id="record-payment-btn">${i18n.t('common.add')}</button>
      </div>
    </div>` : ''}

    <!-- Actions -->
    <div style="display:flex;gap:var(--space-3);margin-top:var(--space-4);">
      <button class="btn btn-secondary" id="detail-pdf-btn">${Icons.fileText(16)} ${i18n.t('common.export')} PDF</button>
      <button class="btn btn-secondary" id="detail-print-btn">${Icons.printer(16)} ${i18n.t('common.print')}</button>
    </div>
  `;

  const close = openModal({
    title: `${i18n.t('invoices.invoiceNumber')} ${invoice.invoiceNumber}`,
    content,
    size: 'lg',
    hideFooter: true,
  });

  content.querySelector('#record-payment-btn')?.addEventListener('click', () => {
    const amount = parseFloat((content.querySelector('#payment-amount') as HTMLInputElement).value);
    if (isNaN(amount) || amount <= 0) {
      notifications.error(i18n.t('errors.required'));
      return;
    }
    invoiceService.recordPayment(invoice.id, amount);
    // Accounting integration: post payment entry
    const updatedInvoice = invoiceService.getById(invoice.id)!;
    if (updatedInvoice.status === 'paid') {
      accountingIntegrationService.postInvoicePaymentEntry(updatedInvoice, amount, 'cash').catch(console.error);
    }
    notifications.success(`${i18n.t('invoices.paid')} : ${formatCurrency(amount)}`);
    close();
    onUpdate();
  });

  content.querySelector('#detail-pdf-btn')?.addEventListener('click', async () => {
    const btn = content.querySelector<HTMLButtonElement>('#detail-pdf-btn')!;
    btn.disabled = true;
    try {
      await exportInvoicePDF(invoice);
      notifications.success(i18n.t('common.pdfExportSuccess' as any));
    } catch {
      notifications.error(i18n.t('common.pdfExportError' as any));
    } finally {
      btn.disabled = false;
    }
  });

  content.querySelector('#detail-print-btn')?.addEventListener('click', () => {
    printInvoice(invoice);
  });
}

function openCreateInvoiceModal(onSave: () => void): void {
  const sales = saleService.getAll().filter((s) => s.status !== 'cancelled');

  const form = document.createElement('div');
  form.innerHTML = `
    <div class="form-group" style="margin-bottom: var(--space-4);">
      <label class="form-label required" for="inv-sale">${i18n.t('invoices.modals.selectOrder')}</label>
      <select id="inv-sale" class="form-control" required>
        <option value="">${i18n.t('invoices.modals.chooseOrder')}</option>
        ${sales.map((s) => `<option value="${s.id}">${s.orderNumber} – ${s.customerName} (${formatCurrency(s.total)})</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label" for="inv-days">${i18n.t('invoices.modals.paymentTerms')}</label>
      <input type="number" id="inv-days" class="form-control" value="30" min="1" />
    </div>
    <div class="form-group">
      <label class="form-label" for="inv-notes">${i18n.t('common.notes')}</label>
      <textarea id="inv-notes" class="form-control" placeholder="..."></textarea>
    </div>
  `;

  openModal({
    title: i18n.t('invoices.modals.createTitle'),
    content: form,
    confirmText: i18n.t('common.add'),
    onConfirm: () => {
      const saleId = (form.querySelector('#inv-sale') as HTMLSelectElement).value;
      if (!saleId) {
        showModalError(form, i18n.t('errors.required'), ['inv-sale']);
        return false;
      }
      const sale = saleService.getById(saleId);
      if (!sale) return;
      const days = parseInt((form.querySelector('#inv-days') as HTMLInputElement).value) || 30;
      invoiceService.createFromSale(sale, days);
      notifications.success(i18n.t('invoices.modals.createSuccess' as any));
      onSave();
    },
  });
}

/** Edit existing invoice – status, due date, notes, and record payment */
function openInvoiceEditModal(invoice: Invoice, onSave: () => void): void {
  const dueDateValue = invoice.dueDate ? invoice.dueDate.slice(0, 10) : '';
  const currencySymbol = profileService.getCurrencySymbol();

  const form = document.createElement('div');
  form.innerHTML = `
    <div class="form-row" style="margin-bottom: var(--space-4);">
      <div class="form-group">
        <label class="form-label" for="ie-status">${i18n.t('common.status')}</label>
        <select id="ie-status" class="form-control">
          <option value="draft"     ${invoice.status === 'draft'     ? 'selected' : ''}>${getStatusLabel('draft')}</option>
          <option value="sent"      ${invoice.status === 'sent'      ? 'selected' : ''}>${getStatusLabel('sent')}</option>
          <option value="paid"      ${invoice.status === 'paid'      ? 'selected' : ''}>${getStatusLabel('paid')}</option>
          <option value="overdue"   ${invoice.status === 'overdue'   ? 'selected' : ''}>${getStatusLabel('overdue')}</option>
          <option value="cancelled" ${invoice.status === 'cancelled' ? 'selected' : ''}>${getStatusLabel('cancelled')}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="ie-due-date">${i18n.t('invoices.dueDate')}</label>
        <input type="date" id="ie-due-date" class="form-control" value="${dueDateValue}" />
      </div>
    </div>

    <!-- Summary (read-only) -->
    <div style="background:var(--color-bg-secondary);border-radius:var(--radius-sm);padding:var(--space-4);margin-bottom:var(--space-4);">
      <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:var(--space-3);text-transform:uppercase;letter-spacing:.05em;font-weight:600;">${i18n.t('invoices.modals.summary')}</div>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>${i18n.t('products.product' as any)}</th><th>${i18n.t('common.quantity' as any)}</th><th>${i18n.t('products.price')}</th><th>${i18n.t('common.amount')}</th></tr></thead>
          <tbody>
            ${invoice.items.map((item) => `
              <tr>
                <td>${item.productName}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.unitPrice)}</td>
                <td><strong>${formatCurrency(item.total)}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--space-1);align-items:flex-end;margin-top:var(--space-3);font-size:var(--font-size-sm);">
        <div style="display:flex;gap:var(--space-8);color:var(--color-text-secondary);">
          <span>${i18n.t('sales.subtotal')}</span><span>${formatCurrency(invoice.subtotal)}</span>
        </div>
        <div style="display:flex;gap:var(--space-8);color:var(--color-text-secondary);">
          <span>${i18n.t('sales.tax')} (${invoice.taxRate}%)</span><span>${formatCurrency(invoice.taxAmount)}</span>
        </div>
        <div style="display:flex;gap:var(--space-8);font-weight:700;font-size:var(--font-size-base);border-top:1px solid var(--color-border);padding-top:var(--space-2);margin-top:var(--space-1);">
          <span>${i18n.t('common.total')}</span><span style="color:var(--color-primary);">${formatCurrency(invoice.total)}</span>
        </div>
      </div>
    </div>

    <!-- Payment tracking -->
    <div class="form-row" style="margin-bottom: var(--space-4);">
      <div class="form-group">
        <label class="form-label" for="ie-amount-paid">${i18n.t('invoices.paid')} (${currencySymbol})</label>
        <input type="number" id="ie-amount-paid" class="form-control" value="${invoice.amountPaid}" min="0" step="0.01" max="${invoice.total}" />
      </div>
      <div class="form-group">
        <label class="form-label">${i18n.t('invoices.due')}</label>
        <div id="ie-amount-due" class="form-control" style="background:var(--color-bg-secondary);cursor:default;font-weight:600;color:${invoice.amountDue > 0 ? 'var(--color-error)' : 'var(--color-success)'};">
          ${formatCurrency(invoice.amountDue)}
        </div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" for="ie-notes">${i18n.t('common.notes')}</label>
      <textarea id="ie-notes" class="form-control" placeholder="...">${invoice.notes ?? ''}</textarea>
    </div>
  `;

  // Live-update amount due as paid changes
  form.querySelector('#ie-amount-paid')?.addEventListener('input', (e) => {
    const paid = parseFloat((e.target as HTMLInputElement).value) || 0;
    const due = Math.max(0, invoice.total - paid);
    const dueEl = form.querySelector<HTMLElement>('#ie-amount-due')!;
    dueEl.textContent = formatCurrency(due);
    dueEl.style.color = due > 0 ? 'var(--color-error)' : 'var(--color-success)';
  });

  openModal({
    title: `${i18n.t('invoices.modals.editTitle')} ${invoice.invoiceNumber}`,
    content: form,
    size: 'lg',
    confirmText: i18n.t('common.save'),
    onConfirm: () => {
      const amountPaid = parseFloat((form.querySelector('#ie-amount-paid') as HTMLInputElement).value) || 0;
      const amountDue  = Math.max(0, invoice.total - amountPaid);
      const dueDateRaw = (form.querySelector('#ie-due-date') as HTMLInputElement).value;
      const dueDate    = dueDateRaw ? new Date(dueDateRaw).toISOString() : invoice.dueDate;

      let status = (form.querySelector('#ie-status') as HTMLSelectElement).value as Invoice['status'];
      // Auto-set paid status when fully paid
      if (amountDue === 0 && status !== 'cancelled') status = 'paid';

      invoiceService.update(invoice.id, {
        status,
        dueDate,
        amountPaid,
        amountDue,
        notes: (form.querySelector('#ie-notes') as HTMLTextAreaElement).value.trim(),
      });

      // Accounting integration
      if (status === 'paid' && invoice.status !== 'paid') {
        const updatedInv = invoiceService.getById(invoice.id)!;
        accountingIntegrationService.postInvoicePaymentEntry(updatedInv, amountPaid, 'transfer').catch(console.error);
      } else if (status === 'cancelled' && invoice.status !== 'cancelled') {
        accountingIntegrationService.reverseEntryForSource('invoice_payment', invoice.id).catch(console.error);
      }

      notifications.success(i18n.t('common.save'));
      onSave();
    },
  });
}
