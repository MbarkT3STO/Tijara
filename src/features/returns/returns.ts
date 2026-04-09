/**
 * Returns & Refunds feature page.
 * Customers return items → stock restocked, refund issued against original order.
 */

import { returnService } from '@services/returnService';
import { saleService } from '@services/saleService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, debounce } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import type { Return, ReturnItem, ReturnReason, Sale } from '@core/types';

const PAGE_SIZE = 10;

interface State {
  returns: Return[];
  filtered: Return[];
  page: number;
  search: string;
  statusFilter: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending:  'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-error',
  refunded: 'badge-primary',
};

const REASON_LABELS: Record<ReturnReason, string> = {
  defective:             'Defective / Faulty',
  wrong_item:            'Wrong Item Sent',
  not_as_described:      'Not as Described',
  damaged_shipping:      'Damaged in Shipping',
  customer_changed_mind: 'Customer Changed Mind',
  other:                 'Other',
};

export function renderReturns(): HTMLElement {
  const state: State = {
    returns: returnService.getAll(),
    filtered: [],
    page: 1,
    search: '',
    statusFilter: '',
  };
  state.filtered = [...state.returns];

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function applyFilters() {
    let data = [...state.returns];
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(
        (r) =>
          r.returnNumber.toLowerCase().includes(q) ||
          r.orderNumber.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q)
      );
    }
    if (state.statusFilter) data = data.filter((r) => r.status === state.statusFilter);
    state.filtered = data;
    state.page = 1;
  }

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    page.querySelector<HTMLInputElement>('#ret-search')?.addEventListener(
      'input',
      debounce((e: Event) => {
        state.search = (e.target as HTMLInputElement).value;
        applyFilters(); render();
      }, 300) as EventListener
    );

    page.querySelector<HTMLSelectElement>('#ret-status-filter')?.addEventListener('change', (e) => {
      state.statusFilter = (e.target as HTMLSelectElement).value;
      applyFilters(); render();
    });

    page.querySelector('#add-return-btn')?.addEventListener('click', () => {
      openReturnModal(null, () => { state.returns = returnService.getAll(); applyFilters(); render(); });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ret = returnService.getById(btn.getAttribute('data-view')!);
        if (ret) openReturnDetailModal(ret, () => { state.returns = returnService.getAll(); applyFilters(); render(); });
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-approve]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ret = returnService.getById(btn.getAttribute('data-approve')!);
        if (!ret) return;
        confirmDialog(
          i18n.t('returns.modals.approveTitle'),
          i18n.t('returns.modals.approveMsg', { 
            no: ret.returnNumber, 
            restock: ret.restockItems ? ` ${i18n.t('returns.modals.restockHint')}.` : '' 
          }),
          () => {
            returnService.updateStatus(ret.id, 'approved');
            notifications.success(i18n.t('common.save'));
            state.returns = returnService.getAll(); applyFilters(); render();
          },
          i18n.t('returns.modals.approveConfirm'),
          'btn-primary'
        );
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ret = returnService.getById(btn.getAttribute('data-reject')!);
        if (!ret) return;
        confirmDialog(
          i18n.t('returns.modals.rejectTitle'),
          i18n.t('returns.modals.rejectMsg', { no: ret.returnNumber }),
          () => {
            returnService.updateStatus(ret.id, 'rejected');
            notifications.success(i18n.t('common.save'));
            state.returns = returnService.getAll(); applyFilters(); render();
          },
          i18n.t('returns.modals.rejectConfirm'),
          'btn-danger'
        );
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ret = returnService.getById(btn.getAttribute('data-delete')!);
        if (!ret) return;
        confirmDialog(i18n.t('common.delete'), `${i18n.t('common.confirm')} "${ret.returnNumber}"?`, () => {
          returnService.delete(ret.id);
          notifications.success(i18n.t('common.save'));
          state.returns = returnService.getAll(); applyFilters(); render();
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

// ── HTML ──────────────────────────────────────────────────────────────────────

function buildHTML(state: State): string {
  const all = returnService.getAll();
  const totalRefunded  = returnService.getTotalRefunded();
  const pendingCount   = all.filter((r) => r.status === 'pending').length;
  const approvedCount  = all.filter((r) => r.status === 'approved' || r.status === 'refunded').length;

  const total      = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start      = (state.page - 1) * PAGE_SIZE;
  const pageData   = state.filtered.slice(start, start + PAGE_SIZE);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('returns.title')}</h2>
        <p class="page-subtitle">${i18n.t('returns.subtitle')}</p>
      </div>
      <button class="btn btn-primary" id="add-return-btn">${Icons.plus()} ${i18n.t('returns.addNew')}</button>
    </div>

    <!-- KPI strip -->
    <div class="ret-kpi-grid">
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-primary-subtle);color:var(--color-primary);">${Icons.refresh()}</div>
        <div class="stat-card-value">${all.length}</div>
        <div class="stat-card-label">${i18n.t('returns.totalReturns')}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-warning-subtle);color:var(--color-warning);">${Icons.alertCircle()}</div>
        <div class="stat-card-value">${pendingCount}</div>
        <div class="stat-card-label">${i18n.t('returns.pendingReview')}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-success-subtle);color:var(--color-success);">${Icons.check()}</div>
        <div class="stat-card-value">${approvedCount}</div>
        <div class="stat-card-label">${i18n.t('returns.approved')}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-error-subtle);color:var(--color-error);">${Icons.dollarSign()}</div>
        <div class="stat-card-value">${formatCurrency(totalRefunded)}</div>
        <div class="stat-card-label">${i18n.t('returns.totalRefunded')}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="gap:var(--space-3);flex-wrap:wrap;">
        <div class="search-bar" style="flex:1;max-width:360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input type="search" id="ret-search" class="form-control"
            placeholder="${i18n.t('common.search')}..." value="${state.search}" aria-label="${i18n.t('common.search')}" />
        </div>
        <select id="ret-status-filter" class="form-control" style="width:auto;" aria-label="${i18n.t('returns.statuses.pending')}">
          <option value="">${i18n.t('returns.allStatuses')}</option>
          <option value="pending"  ${state.statusFilter === 'pending'  ? 'selected' : ''}>${i18n.t('returns.statuses.pending')}</option>
          <option value="approved" ${state.statusFilter === 'approved' ? 'selected' : ''}>${i18n.t('returns.statuses.approved')}</option>
          <option value="rejected" ${state.statusFilter === 'rejected' ? 'selected' : ''}>${i18n.t('returns.statuses.rejected')}</option>
          <option value="refunded" ${state.statusFilter === 'refunded' ? 'selected' : ''}>${i18n.t('returns.statuses.refunded')}</option>
        </select>
      </div>

      <div class="table-container" style="border:none;border-radius:0;">
        <table class="data-table" aria-label="Returns list">
          <thead>
            <tr>
              <th>${i18n.t('returns.returnNumber')}</th>
              <th>${i18n.t('returns.orderNumber')}</th>
              <th>${i18n.t('returns.customer')}</th>
              <th>${i18n.t('purchases.items')}</th>
              <th>${i18n.t('returns.refund')}</th>
              <th>${i18n.t('returns.reason')}</th>
              <th>${i18n.t('purchases.status')}</th>
              <th>${i18n.t('purchases.date')}</th>
              <th>${i18n.t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0
              ? `<tr><td colspan="9">
                  <div class="empty-state">
                    <div class="empty-state-icon">${Icons.refresh(32)}</div>
                    <p class="empty-state-title">${i18n.t('common.noData')}</p>
                    <p class="empty-state-desc">${state.search ? i18n.t('common.noData') : i18n.t('returns.addNew')}</p>
                  </div>
                </td></tr>`
              : pageData.map((r) => `
                <tr>
                  <td><span style="font-weight:600;color:var(--color-primary);">${r.returnNumber}</span></td>
                  <td style="color:var(--color-text-secondary);">${r.orderNumber}</td>
                  <td>${r.customerName}</td>
                  <td style="color:var(--color-text-secondary);">${i18n.t('common.itemsCount', { count: r.items.length })}</td>
                  <td><strong style="color:var(--color-error);">${formatCurrency(r.refundAmount)}</strong></td>
                  <td style="color:var(--color-text-secondary);font-size:var(--font-size-xs);">${i18n.t(`returns.reasons.${r.reason.toLowerCase()}` as any)}</td>
                  <td><span class="badge ${STATUS_BADGE[r.status.toLowerCase()] ?? 'badge-neutral'}">${i18n.t(`returns.statuses.${r.status.toLowerCase()}` as any)}</span></td>
                  <td style="color:var(--color-text-secondary);">${formatDate(r.createdAt)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-ghost btn-icon btn-sm" data-view="${r.id}" aria-label="${i18n.t('common.view')}" data-tooltip="${i18n.t('common.view')}">${Icons.eye(16)}</button>
                      ${r.status === 'pending' ? `
                        <button class="btn btn-ghost btn-icon btn-sm" data-approve="${r.id}" aria-label="${i18n.t('returns.modals.approveConfirm')}" data-tooltip="${i18n.t('returns.modals.approveConfirm')}" style="color:var(--color-success);">${Icons.check(16)}</button>
                        <button class="btn btn-ghost btn-icon btn-sm" data-reject="${r.id}" aria-label="${i18n.t('returns.modals.rejectConfirm')}" data-tooltip="${i18n.t('returns.modals.rejectConfirm')}" style="color:var(--color-error);">${Icons.close(16)}</button>
                      ` : ''}
                      <button class="btn btn-ghost btn-icon btn-sm" data-delete="${r.id}" aria-label="${i18n.t('common.delete')}" data-tooltip="${i18n.t('common.delete')}" style="color:var(--color-error);">${Icons.trash(16)}</button>
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
      <span class="pagination-info">${i18n.t('common.showing' as any)} ${start + 1}–${start + count} ${i18n.t('common.of')} ${total}</span>
      <div class="pagination-controls">
        <button class="pagination-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>${Icons.chevronLeft(16)}</button>
        ${pages.map((p) => `<button class="pagination-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`).join('')}
        <button class="pagination-btn" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>${Icons.chevronRight(16)}</button>
      </div>
    </div>`;
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function openReturnDetailModal(ret: Return, onUpdate: () => void): void {
  const content = document.createElement('div');
  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-5);">
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('returns.customer')}</div>
        <div style="font-weight:500;">${ret.customerName}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('returns.orderNumber')}</div>
        <div style="font-weight:500;color:var(--color-primary);">${ret.orderNumber}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('purchases.status')}</div>
        <span class="badge ${STATUS_BADGE[ret.status]}">${i18n.t(`returns.statuses.${ret.status}` as any)}</span>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('returns.reason')}</div>
        <div>${i18n.t(`returns.reasons.${ret.reason}` as any)}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('returns.modals.refundMethod')}</div>
        <div>${i18n.t(`sales.payments.${ret.refundMethod}` as any)}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('returns.restockItems')}</div>
        <span class="badge ${ret.restockItems ? 'badge-success' : 'badge-neutral'}">${ret.restockItems ? i18n.t('common.yes') : i18n.t('common.no')}</span>
      </div>
    </div>

    <div class="table-container" style="margin-bottom:var(--space-4);">
      <table class="data-table">
        <thead><tr><th>${i18n.t('products.modals.name')}</th><th>${i18n.t('returns.returnQty')}</th><th>${i18n.t('products.price')}</th><th>${i18n.t('purchases.total')}</th></tr></thead>
        <tbody>
          ${ret.items.map((item) => `
            <tr>
              <td>${item.productName}</td>
              <td>${item.quantity}</td>
              <td>${formatCurrency(item.unitPrice)}</td>
              <td><strong>${formatCurrency(item.total)}</strong></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div style="display:flex;flex-direction:column;gap:var(--space-2);align-items:flex-end;margin-bottom:var(--space-4);">
      <div style="display:flex;gap:var(--space-8);font-size:var(--font-size-sm);"><span style="color:var(--color-text-secondary);">${i18n.t('purchases.subtotal')}</span><span>${formatCurrency(ret.subtotal)}</span></div>
      <div style="display:flex;gap:var(--space-8);font-size:var(--font-size-sm);"><span style="color:var(--color-text-secondary);">${i18n.t('purchases.tax')} (${ret.taxRate}%)</span><span>${formatCurrency(ret.taxAmount)}</span></div>
      <div style="display:flex;gap:var(--space-8);font-size:var(--font-size-lg);font-weight:700;border-top:1px solid var(--color-border);padding-top:var(--space-2);margin-top:var(--space-1);">
        <span>${i18n.t('returns.refund')}</span><span style="color:var(--color-error);">${formatCurrency(ret.refundAmount)}</span>
      </div>
    </div>

    ${ret.notes ? `<div style="padding:var(--space-3);background:var(--color-bg-secondary);border-radius:var(--radius-sm);font-size:var(--font-size-sm);color:var(--color-text-secondary);margin-bottom:var(--space-4);">${ret.notes}</div>` : ''}

    ${ret.status === 'pending' ? `
    <div style="display:flex;gap:var(--space-3);">
      <button class="btn btn-primary" id="detail-approve-btn">${Icons.check(16)} ${i18n.t('returns.modals.approveTitle')}</button>
      <button class="btn btn-danger" id="detail-reject-btn">${Icons.close(16)} ${i18n.t('returns.modals.rejectConfirm')}</button>
    </div>` : ''}

    ${ret.status === 'approved' ? `
    <div style="margin-top:var(--space-2);">
      <button class="btn btn-secondary" id="detail-refunded-btn">${Icons.dollarSign(16)} ${i18n.t('returns.modals.recordRefund')}</button>
    </div>` : ''}
  `;

  const close = openModal({ title: `${i18n.t('returns.modals.detailTitle')} ${ret.returnNumber}`, content, size: 'lg', hideFooter: true });

  content.querySelector('#detail-approve-btn')?.addEventListener('click', () => {
    confirmDialog(
      i18n.t('returns.modals.approveTitle'),
      i18n.t('returns.modals.approveMsg', { 
        no: ret.returnNumber, 
        restock: ret.restockItems ? ` ${i18n.t('returns.modals.restockHint')}.` : '' 
      }),
      () => { returnService.updateStatus(ret.id, 'approved'); notifications.success(i18n.t('common.save')); close(); onUpdate(); },
      i18n.t('returns.modals.approveConfirm'), 'btn-primary'
    );
  });

  content.querySelector('#detail-reject-btn')?.addEventListener('click', () => {
    confirmDialog(i18n.t('returns.modals.rejectTitle'), i18n.t('returns.modals.rejectMsg', { no: ret.returnNumber }), () => {
      returnService.updateStatus(ret.id, 'rejected');
      notifications.success(i18n.t('common.save'));
      close(); onUpdate();
    });
  });

  content.querySelector('#detail-refunded-btn')?.addEventListener('click', () => {
    returnService.updateStatus(ret.id, 'refunded');
    notifications.success(i18n.t('common.save'));
    close(); onUpdate();
  });
}

// ── Create modal ──────────────────────────────────────────────────────────────

function openReturnModal(_ret: Return | null, onSave: () => void): void {
  // Only delivered/confirmed sales can be returned
  const eligibleSales = saleService.getAll().filter(
    (s) => s.status === 'delivered' || s.status === 'confirmed' || s.status === 'shipped'
  );

  let selectedSale: Sale | null = null;
  let items: ReturnItem[] = [];

  const form = document.createElement('div');

  const renderSaleItems = () => {
    const container = form.querySelector<HTMLElement>('#ret-items-section')!;
      if (!selectedSale) {
        container.innerHTML = `<div style="text-align:center;padding:var(--space-4);color:var(--color-text-tertiary);font-size:var(--font-size-sm);border:1px dashed var(--color-border);border-radius:var(--radius-sm);">${i18n.t('returns.modals.selectToLoad')}</div>`;
        return;
      }

    container.innerHTML = `
      <div style="margin-bottom:var(--space-3);">
        <div style="display:grid;grid-template-columns:1fr 100px 120px 80px;gap:var(--space-2);padding:var(--space-2) var(--space-3);background:var(--color-bg-secondary);border-radius:var(--radius-sm);font-size:var(--font-size-xs);font-weight:600;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:.04em;">
          <span>${i18n.t('products.modals.name')}</span><span style="text-align:center;">${i18n.t('returns.maxQty')}</span><span style="text-align:center;">${i18n.t('returns.returnQty')}</span><span style="text-align:right;">${i18n.t('returns.refund')}</span>
        </div>
        ${selectedSale.items.map((saleItem, idx) => {
          const retItem = items.find((i) => i.productId === saleItem.productId);
          const retQty = retItem?.quantity ?? 0;
          const unitPrice = saleItem.unitPrice * (1 - saleItem.discount / 100);
          return `
            <div style="display:grid;grid-template-columns:1fr 100px 120px 80px;gap:var(--space-2);align-items:center;padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--color-border-subtle);">
              <div style="font-size:var(--font-size-sm);font-weight:500;">${saleItem.productName}</div>
              <div style="text-align:center;font-size:var(--font-size-sm);color:var(--color-text-secondary);">${saleItem.quantity}</div>
              <div style="display:flex;justify-content:center;">
                <input type="number" class="form-control ret-item-qty" data-idx="${idx}"
                  data-product-id="${saleItem.productId}"
                  data-product-name="${saleItem.productName}"
                  data-unit-price="${unitPrice.toFixed(4)}"
                  data-max="${saleItem.quantity}"
                  value="${retQty}" min="0" max="${saleItem.quantity}"
                  style="width:72px;text-align:center;" />
              </div>
              <div style="text-align:right;font-size:var(--font-size-sm);font-weight:600;color:var(--color-error);" id="ret-item-total-${idx}">
                ${formatCurrency(retQty * unitPrice)}
              </div>
            </div>`;
        }).join('')}
      </div>
      <div id="ret-totals" style="text-align:right;font-size:var(--font-size-sm);color:var(--color-text-secondary);padding:var(--space-2) var(--space-3);"></div>
    `;

    updateTotals();

    container.querySelectorAll<HTMLInputElement>('.ret-item-qty').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx    = +inp.getAttribute('data-idx')!;
        const pid    = inp.getAttribute('data-product-id')!;
        const pname  = inp.getAttribute('data-product-name')!;
        const price  = parseFloat(inp.getAttribute('data-unit-price')!);
        const max    = parseInt(inp.getAttribute('data-max')!);
        const qty    = Math.min(Math.max(parseInt(inp.value) || 0, 0), max);
        inp.value    = String(qty);

        // Update items array
        const existing = items.findIndex((i) => i.productId === pid);
        if (qty === 0) {
          if (existing !== -1) items.splice(existing, 1);
        } else {
          const total = qty * price;
          if (existing !== -1) {
            items[existing] = { productId: pid, productName: pname, quantity: qty, unitPrice: price, total };
          } else {
            items.push({ productId: pid, productName: pname, quantity: qty, unitPrice: price, total });
          }
        }

        const totalEl = container.querySelector(`#ret-item-total-${idx}`);
        if (totalEl) totalEl.textContent = formatCurrency(qty * price);
        updateTotals();
      });
    });
  };

  const updateTotals = () => {
    const taxRate = parseFloat((form.querySelector('#ret-tax') as HTMLInputElement)?.value ?? '0') || 0;
    const { subtotal, taxAmount, refundAmount } = returnService.calculateTotals(items, taxRate);
    const el = form.querySelector('#ret-totals');
    if (el) el.innerHTML = `
      <div>${i18n.t('purchases.subtotal')}: <strong>${formatCurrency(subtotal)}</strong></div>
      <div>${i18n.t('purchases.tax')} (${taxRate}%): <strong>${formatCurrency(taxAmount)}</strong></div>
      <div style="font-size:var(--font-size-base);font-weight:700;color:var(--color-error);margin-top:4px;">
        ${i18n.t('returns.refund')}: ${formatCurrency(refundAmount)}
      </div>`;
  };

    form.innerHTML = `
    <div class="form-row" style="margin-bottom:var(--space-4);">
      <div class="form-group">
        <label class="form-label required" for="ret-sale">${i18n.t('returns.orderNumber')}</label>
        <select id="ret-sale" class="form-control">
          <option value="">${i18n.t('returns.modals.selectOrder')}</option>
          ${eligibleSales.map((s) => `<option value="${s.id}">${s.orderNumber} — ${s.customerName} (${formatCurrency(s.total)})</option>`).join('')}
        </select>
        ${eligibleSales.length === 0 ? `<span class="form-hint" style="color:var(--color-warning);">${i18n.t('returns.modals.noEligible')}</span>` : ''}
      </div>
      <div class="form-group">
        <label class="form-label" for="ret-status">${i18n.t('returns.modals.initialStatus')}</label>
        <select id="ret-status" class="form-control">
          <option value="pending">${i18n.t('returns.statuses.pending')}</option>
          <option value="approved">${i18n.t('returns.statuses.approved')}</option>
        </select>
      </div>
    </div>

    <div class="form-row" style="margin-bottom:var(--space-4);">
      <div class="form-group">
        <label class="form-label required" for="ret-reason">${i18n.t('returns.reason')}</label>
        <select id="ret-reason" class="form-control">
          ${(Object.entries(REASON_LABELS) as [ReturnReason, string][]).map(([v, _l]) => `<option value="${v}">${i18n.t(`returns.reasons.${v}` as any)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="ret-refund-method">${i18n.t('returns.modals.refundMethod')}</label>
        <select id="ret-refund-method" class="form-control">
          <option value="store_credit">${i18n.t('sales.payments.paid')}</option>
          <option value="transfer">${i18n.t('sales.payments.transfer')}</option>
          <option value="cash">${i18n.t('sales.payments.cash')}</option>
          <option value="card">${i18n.t('sales.payments.card')}</option>
          <option value="other">${i18n.t('sales.payments.other')}</option>
        </select>
      </div>
    </div>

    <!-- Items section -->
    <div style="margin-bottom:var(--space-4);">
      <label class="form-label" style="margin-bottom:var(--space-2);">${i18n.t('returns.returnItems')}</label>
      <div id="ret-items-section"></div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="ret-tax">${i18n.t('purchases.tax')} (%)</label>
        <input type="number" id="ret-tax" class="form-control" value="0" min="0" max="100" />
        <span class="form-hint">${i18n.t('returns.modals.restockHint')}</span>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:var(--space-3);padding-top:var(--space-5);">
        <label class="checkbox-group">
          <input type="checkbox" id="ret-restock" checked />
          <span style="font-size:var(--font-size-sm);">${i18n.t('returns.restockItems')}</span>
        </label>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" for="ret-notes">${i18n.t('common.notes')}</label>
      <textarea id="ret-notes" class="form-control" placeholder="${i18n.t('common.notes')}"></textarea>
    </div>
  `;

  // Load sale items when order is selected
  form.querySelector<HTMLSelectElement>('#ret-sale')?.addEventListener('change', (e) => {
    const saleId = (e.target as HTMLSelectElement).value;
    selectedSale = saleService.getById(saleId) ?? null;
    items = [];
    // Pre-fill tax rate from the sale
    if (selectedSale) {
      (form.querySelector('#ret-tax') as HTMLInputElement).value = String(selectedSale.taxRate);
    }
    renderSaleItems();
  });

  form.querySelector('#ret-tax')?.addEventListener('input', updateTotals);

  renderSaleItems();

  openModal({
    title: i18n.t('returns.modals.addTitle'),
    content: form,
    size: 'lg',
    confirmText: i18n.t('common.confirm'),
    onConfirm: () => {
      const saleSelect = form.querySelector<HTMLSelectElement>('#ret-sale')!;
      if (!saleSelect.value || !selectedSale) {
        showModalError(form, i18n.t('errors.required'), ['ret-sale']); return false;
      }
      if (items.length === 0) {
        showModalError(form, i18n.t('returns.modals.noEligible')); return false;
      }

      const taxRate      = parseFloat((form.querySelector('#ret-tax') as HTMLInputElement).value) || 0;
      const status       = (form.querySelector('#ret-status') as HTMLSelectElement).value as Return['status'];
      const reason       = (form.querySelector('#ret-reason') as HTMLSelectElement).value as ReturnReason;
      const refundMethod = (form.querySelector('#ret-refund-method') as HTMLSelectElement).value as Return['refundMethod'];
      const restockItems = (form.querySelector('#ret-restock') as HTMLInputElement).checked;
      const notes        = (form.querySelector('#ret-notes') as HTMLTextAreaElement).value.trim();

      returnService.create({
        saleId:       selectedSale.id,
        orderNumber:  selectedSale.orderNumber,
        customerId:   selectedSale.customerId,
        customerName: selectedSale.customerName,
        items,
        taxRate,
        status,
        reason,
        refundMethod,
        restockItems,
        notes,
      });

      notifications.success(i18n.t('common.save'));
      onSave();
    },
  });
}

// ── Responsive styles ─────────────────────────────────────────────────────────

if (!document.getElementById('returns-styles')) {
  const style = document.createElement('style');
  style.id = 'returns-styles';
  style.textContent = `
    .ret-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }
    @media (max-width: 1024px) { .ret-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px)  { .ret-kpi-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(style);
}
