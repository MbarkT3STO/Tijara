/**
 * Sales / Orders feature page.
 * Stock is validated and shown in real-time in both Add and Edit modals.
 */

import { saleService } from '@services/saleService';
import { customerService } from '@services/customerService';
import { productService } from '@services/productService';
import { invoiceService } from '@services/invoiceService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, debounce, autoNote, escapeHtml, exportReportPDF } from '@shared/utils/helpers';
import { profileService } from '@services/profileService';
import { i18n } from '@core/i18n';
import { menuTriggerHTML, attachMenuTriggers } from '@shared/utils/actionMenu';
import { accountingIntegrationService } from '@services/accountingIntegrationService';
import { openHtmlPrintPreview } from '@shared/components/printPreview';
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

function getStatusLabel(status: string): string {
  return i18n.t(`sales.statuses.${status.toLowerCase()}` as any) || status;
}

function getPaymentLabel(status: string): string {
  return i18n.t(`sales.payments.${status.toLowerCase()}` as any) || status;
}

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

    attachMenuTriggers(
      page,
      () => [
        { action: 'view',   icon: Icons.eye(16),   label: i18n.t('common.view') },
        { action: 'edit',   icon: Icons.edit(16),  label: i18n.t('common.edit') },
        { action: 'delete', icon: Icons.trash(16), label: i18n.t('common.delete'), danger: true, dividerBefore: true },
      ],
      (action, id) => {
        const sale = saleService.getById(id);
        if (!sale) return;
        const refresh = () => { state.sales = saleService.getAll(); applyFilters(); render(); };
        if (action === 'view')        openSaleDetailModal(sale);
        else if (action === 'edit')   openSaleEditModal(sale, refresh);
        else if (action === 'delete') confirmDialog(i18n.t('common.delete'), `${i18n.t('common.confirm')} "${sale.orderNumber}"?`, () => {
          accountingIntegrationService.reverseEntryForSource('sale', sale.id).catch(console.error);
          saleService.delete(id);
          notifications.success(i18n.t('common.delete'));
          refresh();
        });
      }
    );

    page.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-page')!, 10);
        if (!isNaN(p)) { state.page = p; render(); }
      });
    });
  }

  render();

  // Handle open-item event dispatched by app.ts after search navigation
  page.addEventListener('open-item', (e: Event) => {
    const { id } = (e as CustomEvent).detail;
    const sale = saleService.getById(id);
    if (!sale) return;
    openSaleDetailModal(sale);
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
        <h2 class="page-title">${i18n.t('sales.title')}</h2>
        <p class="page-subtitle">${total === 1 ? i18n.t('sales.countTotal', { count: total }) : i18n.t('sales.countPlural', { count: total })}</p>
      </div>
      <button class="btn btn-primary" id="add-sale-btn">${Icons.plus()} ${i18n.t('sales.addNew')}</button>
    </div>

    <div class="card">
      <div class="card-header" style="gap:var(--space-3);flex-wrap:wrap;">
        <div class="search-bar" style="flex:1;max-width:360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input type="search" id="sale-search" class="form-control" placeholder="${i18n.t('common.search')}..." value="${state.search}" aria-label="${i18n.t('common.search')}" />
        </div>
        <select id="status-filter" class="form-control" style="width:auto;" aria-label="${i18n.t('common.filter')}">
          <option value="">${i18n.t('common.all')}</option>
          <option value="pending"   ${state.statusFilter === 'pending'   ? 'selected' : ''}>${getStatusLabel('pending')}</option>
          <option value="confirmed" ${state.statusFilter === 'confirmed' ? 'selected' : ''}>${getStatusLabel('confirmed')}</option>
          <option value="shipped"   ${state.statusFilter === 'shipped'   ? 'selected' : ''}>${getStatusLabel('shipped')}</option>
          <option value="delivered" ${state.statusFilter === 'delivered' ? 'selected' : ''}>${getStatusLabel('delivered')}</option>
          <option value="cancelled" ${state.statusFilter === 'cancelled' ? 'selected' : ''}>${getStatusLabel('cancelled')}</option>
        </select>
      </div>

      <div class="table-container" style="border:none;border-radius:0;">
        <div class="table-scroll">
        <table class="data-table" aria-label="Sales list">
          <thead>
            <tr>
              <th>${i18n.t('sales.orderNumber')}</th><th>${i18n.t('sales.customer')}</th><th>${i18n.t('sales.items')}</th><th>${i18n.t('sales.total')}</th>
              <th>${i18n.t('common.status')}</th><th>${i18n.t('sales.paymentStatus')}</th><th>${i18n.t('common.date')}</th><th>${i18n.t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0
              ? `<tr><td colspan="8"><div class="empty-state">
                   <div class="empty-state-icon">${Icons.sales(32)}</div>
                   <p class="empty-state-title">${i18n.t('common.noData')}</p>
                   <p class="empty-state-desc">${state.search ? i18n.t('errors.loadFailed') : i18n.t('common.noData')}</p>
                 </div></td></tr>`
              : pageData.map((s) => `
                <tr>
                  <td><span style="font-weight:600;color:var(--color-primary);">${escapeHtml(s.orderNumber)}</span></td>
                  <td>${escapeHtml(s.customerName)}</td>
                  <td style="color:var(--color-text-secondary);">${s.items.length}</td>
                  <td><strong>${formatCurrency(s.total)}</strong></td>
                  <td><span class="badge ${STATUS_BADGE[s.status] ?? 'badge-neutral'}">${getStatusLabel(s.status)}</span></td>
                  <td><span class="badge ${PAYMENT_BADGE[s.paymentStatus] ?? 'badge-neutral'}">${getPaymentLabel(s.paymentStatus)}</span></td>
                  <td style="color:var(--color-text-secondary);">${formatDate(s.createdAt)}</td>
                  <td>
                    <div class="table-actions">
                      ${menuTriggerHTML(s.id)}
                    </div>
                  </td>
                </tr>`).join('')
            }
          </tbody>
        </table>
        </div>
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
      <span class="pagination-info">${i18n.t('common.showing' as any)} ${start + 1}–${start + count} / ${total}</span>
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
      ? `${p.name} — ${i18n.t('sales.modals.outOfStock').toUpperCase()}`
      : `${p.name} (${available} ${p.unit} ${i18n.t('sales.modals.available')})`;
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
      return `"${product.name}" ${i18n.t('sales.modals.available')} ${available} ${product.unit}, ${i18n.t('common.edit')}: ${item.quantity}.`;
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
        ${available === 0 ? i18n.t('sales.modals.outOfStock') : overStock ? `${i18n.t('common.quantity' as any)} > ${available}` : `${available} ${i18n.t('sales.modals.available')}`}
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
          value="${item.quantity}" min="1" max="${available > 0 ? available : 9999}" placeholder="${i18n.t('common.quantity' as any)}"
          style="${overStock ? 'border-color:var(--color-warning);' : ''}" />
      </div>
      <input type="number" class="form-control ${prefix}-item-price" data-idx="${idx}"
        value="${item.unitPrice}" min="0" step="0.01" placeholder="${i18n.t('products.price')}" />
      <input type="number" class="form-control ${prefix}-item-discount" data-idx="${idx}"
        value="${item.discount}" min="0" max="100" placeholder="${i18n.t('sales.discount')}%" />
      <button type="button" class="btn btn-ghost btn-icon btn-sm ${prefix}-remove-item"
        data-idx="${idx}" style="color:var(--color-error);margin-top:2px;">${Icons.trash(16)}</button>
    </div>`;
}

/** Wire up all item-level events for a container */
function attachItemEvents(
  container: HTMLElement,
  items: OrderItem[],
  _products: Product[],
  prefix: string,
  _reservedStock: Map<string, number>,
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

  // PDF export + Print button row
  const printRow = document.createElement('div');
  printRow.style.cssText = 'display:flex;justify-content:flex-end;gap:var(--space-2);margin-bottom:var(--space-3);';
  printRow.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="sale-print-btn">${Icons.printer(14)} ${i18n.t('common.print')}</button>
    <button class="btn btn-secondary btn-sm" id="sale-pdf-btn">${Icons.download(14)} ${i18n.t('common.exportPdf' as any)}</button>
  `;
  content.appendChild(printRow);

  const details = document.createElement('div');
  details.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-5);">
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('sales.customer')}</div>
        <div style="font-weight:500;">${escapeHtml(sale.customerName)}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('common.date')}</div>
        <div>${formatDate(sale.createdAt)}</div>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('common.status')}</div>
        <span class="badge ${STATUS_BADGE[sale.status]}">${getStatusLabel(sale.status)}</span>
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-bottom:4px;">${i18n.t('sales.paymentStatus')}</div>
        <span class="badge ${PAYMENT_BADGE[sale.paymentStatus]}">${getPaymentLabel(sale.paymentStatus)}</span>
      </div>
    </div>
    <div class="table-container" style="margin-bottom:var(--space-4);">
      <table class="data-table">
        <thead><tr><th>${i18n.t('products.modals.name')}</th><th>${i18n.t('common.quantity' as any)}</th><th>${i18n.t('products.price')}</th><th>${i18n.t('sales.discount')}</th><th>${i18n.t('common.total')}</th></tr></thead>
        <tbody>
          ${sale.items.map((item) => `
            <tr>
              <td>${escapeHtml(item.productName)}</td>
              <td>${item.quantity}</td>
              <td>${formatCurrency(item.unitPrice)}</td>
              <td>${item.discount}%</td>
              <td><strong>${formatCurrency(item.total)}</strong></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="display:flex;flex-direction:column;gap:var(--space-2);align-items:flex-end;">
      <div style="display:flex;gap:var(--space-8);"><span style="color:var(--color-text-secondary);">${i18n.t('sales.subtotal')}</span><span>${formatCurrency(sale.subtotal)}</span></div>
      <div style="display:flex;gap:var(--space-8);"><span style="color:var(--color-text-secondary);">${i18n.t('sales.tax')} (${sale.taxRate}%)</span><span>${formatCurrency(sale.taxAmount)}</span></div>
      ${sale.discount > 0 ? `<div style="display:flex;gap:var(--space-8);"><span style="color:var(--color-text-secondary);">${i18n.t('sales.discount')}</span><span style="color:var(--color-error);">-${formatCurrency(sale.discount)}</span></div>` : ''}
      <div style="display:flex;gap:var(--space-8);font-size:var(--font-size-lg);font-weight:700;border-top:1px solid var(--color-border);padding-top:var(--space-2);margin-top:var(--space-1);">
        <span>${i18n.t('common.total')}</span><span style="color:var(--color-primary);">${formatCurrency(sale.total)}</span>
      </div>
    </div>
    ${sale.notes ? `<div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--color-bg-secondary);border-radius:var(--radius-sm);font-size:var(--font-size-sm);color:var(--color-text-secondary);">${escapeHtml(sale.notes)}</div>` : ''}
  `;
  content.appendChild(details);
  printRow.querySelector('#sale-print-btn')?.addEventListener('click', () => {
    openHtmlPrintPreview(buildSaleOrderHTML(sale), sale.orderNumber, `order-${sale.orderNumber}.pdf`);
  });
  printRow.querySelector('#sale-pdf-btn')?.addEventListener('click', async () => {
    const btn = printRow.querySelector<HTMLButtonElement>('#sale-pdf-btn')!;
    btn.disabled = true;
    btn.innerHTML = `${Icons.download(14)} ${i18n.t('common.exportPdf' as any)}…`;
    try {
      await openSalePdfExport(sale);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${Icons.download(14)} ${i18n.t('common.exportPdf' as any)}`;
    }
  });

  // Add "Create Invoice" button for delivered sales with no existing invoice
  const existingInvoice = invoiceService.getAll().find((inv) => inv.saleId === sale.id);
  if (sale.status === 'delivered' && !existingInvoice) {
    const createInvoiceBtn = document.createElement('div');
    createInvoiceBtn.style.cssText = 'margin-top:var(--space-4);display:flex;justify-content:flex-end;';
    createInvoiceBtn.innerHTML = `<button class="btn btn-primary" id="create-invoice-btn">${Icons.fileText ? Icons.fileText(16) : '📄'} ${i18n.t('invoices.createInvoice' as any)}</button>`;
    content.appendChild(createInvoiceBtn);
    createInvoiceBtn.querySelector('#create-invoice-btn')?.addEventListener('click', () => {
      const invoice = invoiceService.createFromSale(sale);
      notifications.success(`${i18n.t('invoices.created' as any)}: ${invoice.invoiceNumber}`);
    });
  }

  openModal({ title: `${i18n.t('dashboard.order')} ${escapeHtml(sale.orderNumber)}`, content, size: 'lg', hideFooter: true });
}

function buildSaleOrderHTML(sale: Sale): string {
  const profile = profileService.get();
  const pdfLang = (profile.defaultPdfLanguage || 'en') as any;
  const dir = i18n.getDirectionFor(pdfLang);
  const t = (key: any, vars?: any) => i18n.tFor(pdfLang, key, vars);
  const fmt = (n: number) => formatCurrency(n, profile.currency || 'USD', pdfLang);
  const dfmt = (d: string) => formatDate(d, pdfLang);
  const fontFamily = dir === 'rtl' ? "'Cairo','Segoe UI',sans-serif" : "'Segoe UI',-apple-system,sans-serif";

  return `<!DOCTYPE html>
<html lang="${pdfLang}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <title>${t('dashboard.order')} ${escapeHtml(sale.orderNumber)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:${fontFamily};font-size:13px;color:#111827;background:#fff;padding:40px;line-height:1.6;direction:${dir};}
    h1{font-size:20px;font-weight:700;color:#9929ea;margin-bottom:2px;}
    .meta{font-size:12px;color:#6b7280;margin-bottom:24px;}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;background:#f9fafb;border-radius:8px;padding:16px;}
    .info-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:3px;}
    .info-value{font-size:13px;font-weight:500;color:#111827;}
    .badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;background:#f3f4f6;color:#374151;}
    table{width:100%;border-collapse:collapse;margin-bottom:20px;}
    thead tr{background:#9929ea;color:#fff;}
    th{padding:9px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;text-align:start;}
    th.right{text-align:end;}th.center{text-align:center;}
    td{padding:9px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;text-align:start;}
    td.right{text-align:end;}td.center{text-align:center;}
    tr:nth-child(even) td{background:#faf5ff;}
    .totals{display:flex;justify-content:flex-end;margin-bottom:24px;}
    .totals-box{width:260px;}
    .totals-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;}
    .totals-row.grand{font-size:15px;font-weight:700;color:#9929ea;border-bottom:none;border-top:2px solid #9929ea;padding-top:8px;margin-top:4px;}
    .notes{background:#f9fafb;border-inline-start:3px solid #9929ea;border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:24px;}
    .notes-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:3px;}
    .footer{text-align:center;font-size:11px;color:#9ca3af;padding-top:20px;border-top:1px solid #e5e7eb;}
    @media print{body{padding:20px;}@page{margin:14mm;size:A4;}}
  </style>
</head>
<body>
  ${profile.name ? `<h1>${escapeHtml(profile.name)}</h1>` : ''}
  <div class="meta">
    ${t('dashboard.order')}: <strong>${escapeHtml(sale.orderNumber)}</strong>
    &nbsp;·&nbsp; ${t('common.date')}: ${dfmt(sale.createdAt)}
    &nbsp;·&nbsp; <span class="badge">${t(`sales.statuses.${sale.status}` as any)}</span>
    &nbsp;·&nbsp; <span class="badge">${t(`sales.payments.${sale.paymentStatus}` as any)}</span>
  </div>
  <div class="info-grid">
    <div>
      <div class="info-label">${t('sales.customer')}</div>
      <div class="info-value">${escapeHtml(sale.customerName)}</div>
    </div>
    <div>
      <div class="info-label">${t('sales.paymentMethod' as any)}</div>
      <div class="info-value">${t(`sales.payments.${sale.paymentMethod ?? 'cash'}` as any)}</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>${t('products.modals.name')}</th>
      <th class="center">${t('common.quantity' as any)}</th>
      <th class="right">${t('products.price')}</th>
      <th class="center">${t('sales.discount')}</th>
      <th class="right">${t('common.total')}</th>
    </tr></thead>
    <tbody>
      ${sale.items.map((item) => `<tr>
        <td>${escapeHtml(item.productName)}</td>
        <td class="center">${item.quantity}</td>
        <td class="right">${fmt(item.unitPrice)}</td>
        <td class="center">${item.discount > 0 ? item.discount + '%' : '—'}</td>
        <td class="right"><strong>${fmt(item.total)}</strong></td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>${t('sales.subtotal')}</span><span>${fmt(sale.subtotal)}</span></div>
      <div class="totals-row"><span>${t('sales.tax')} (${sale.taxRate}%)</span><span>${fmt(sale.taxAmount)}</span></div>
      ${sale.discount > 0 ? `<div class="totals-row"><span>${t('sales.discount')}</span><span>-${fmt(sale.discount)}</span></div>` : ''}
      <div class="totals-row grand"><span>${t('common.total')}</span><span>${fmt(sale.total)}</span></div>
    </div>
  </div>
  ${sale.notes ? `<div class="notes"><div class="notes-label">${t('common.notes')}</div><div>${escapeHtml(sale.notes)}</div></div>` : ''}
  <div class="footer">${t('common.generatedBy' as any)} · ${dfmt(new Date().toISOString())}</div>
</body>
</html>`;
}

function openSalePdfExport(sale: Sale): Promise<void> {
  return exportReportPDF(buildSaleOrderHTML(sale), `order-${sale.orderNumber}.pdf`);
}

// ── Add Sale modal ────────────────────────────────────────────────────────────

function openSaleModal(_sale: Sale | null, onSave: () => void): void {
  const customers = customerService.getAll();
  const products  = productService.getAll();
  const items: OrderItem[] = [];
  // No reserved stock for new orders
  const reserved = new Map<string, number>();

  const defaultTaxRate = profileService.getDefaultTaxRate();
  const currencySymbol = profileService.getCurrencySymbol();

  const form = document.createElement('div');
  form.innerHTML = `
    <div class="form-row" style="margin-bottom:var(--space-4);">
      <div class="form-group">
        <label class="form-label required" for="s-customer">${i18n.t('sales.customer')}</label>
        <select id="s-customer" class="form-control" required>
          <option value="">${i18n.t('sales.modals.selectCustomer')}</option>
          ${customers.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="s-payment">${i18n.t('sales.paymentMethod')}</label>
        <select id="s-payment" class="form-control">
          <option value="cash">${getPaymentLabel('cash')}</option>
          <option value="card">${getPaymentLabel('card')}</option>
          <option value="transfer">${getPaymentLabel('transfer')}</option>
          <option value="other">${getPaymentLabel('other')}</option>
        </select>
      </div>
    </div>

    <div style="margin-bottom:var(--space-4);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);">
        <label class="form-label" style="margin:0;">${i18n.t('sales.orderItems')}</label>
        <button type="button" class="btn btn-secondary btn-sm" id="add-item-btn">${Icons.plus(16)} ${i18n.t('sales.modals.addItem')}</button>
      </div>
      <div id="items-container"></div>
      <div id="order-totals" style="margin-top:var(--space-3);text-align:right;font-size:var(--font-size-sm);color:var(--color-text-secondary);"></div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="s-tax">${i18n.t('sales.tax')} (%)</label>
        <input type="number" id="s-tax" class="form-control" value="${defaultTaxRate}" min="0" max="100" />
      </div>
      <div class="form-group">
        <label class="form-label" for="s-discount">${i18n.t('sales.discount')} (${currencySymbol})</label>
        <input type="number" id="s-discount" class="form-control" value="0" min="0" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="s-notes">${i18n.t('sales.notes')}</label>
      <textarea id="s-notes" class="form-control" placeholder="..."></textarea>
    </div>
  `;

  const updateTotals = () => {
    const taxRate  = parseFloat((form.querySelector('#s-tax')      as HTMLInputElement).value) || 0;
    const discount = parseFloat((form.querySelector('#s-discount') as HTMLInputElement).value) || 0;
    const { subtotal, taxAmount, total } = saleService.calculateTotals(items, taxRate, discount);
    form.querySelector('#order-totals')!.innerHTML = `
      <div>${i18n.t('sales.subtotal')}: <strong>${formatCurrency(subtotal)}</strong></div>
      <div>${i18n.t('sales.tax')}: <strong>${formatCurrency(taxAmount)}</strong></div>
      <div style="font-size:var(--font-size-base);font-weight:700;color:var(--color-primary);margin-top:4px;">${i18n.t('common.total')}: ${formatCurrency(total)}</div>`;
  };

  const renderItems = () => {
    const container = form.querySelector('#items-container')!;
    container.innerHTML = items.length === 0
      ? `<div style="text-align:center;padding:var(--space-4);color:var(--color-text-tertiary);font-size:var(--font-size-sm);border:1px dashed var(--color-border);border-radius:var(--radius-sm);">${i18n.t('sales.modals.noItems')}</div>`
      : items.map((item, idx) => buildItemRow(item, idx, products, 's', reserved)).join('');
    attachItemEvents(container as HTMLElement, items, products, 's', reserved, renderItems, updateTotals);
  };

  form.querySelector('#add-item-btn')?.addEventListener('click', () => {
    const available = products.filter((p) => p.stock > 0);
    if (available.length === 0) {
      notifications.warning(i18n.t('alerts.outOfStock.title' as any));
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
    title: i18n.t('sales.modals.addTitle'),
    content: form,
    size: 'lg',
    confirmText: i18n.t('sales.addNew'),
    onConfirm: () => {
      const customerSelect = form.querySelector<HTMLSelectElement>('#s-customer')!;
      const customerId = customerSelect.value;
      const customerName = customerSelect.selectedOptions[0]?.text ?? '';

      if (!customerId) { showModalError(form, i18n.t('errors.required'), ['s-customer']); return false; }
      if (items.length === 0) { showModalError(form, i18n.t('errors.required')); return false; }

      // Stock validation
      const stockError = validateStock(items, products, reserved);
      if (stockError) { showModalError(form, stockError); return false; }

      const taxRate      = parseFloat((form.querySelector('#s-tax')      as HTMLInputElement).value) || 0;
      const discount     = parseFloat((form.querySelector('#s-discount') as HTMLInputElement).value) || 0;
      const paymentMethod = (form.querySelector('#s-payment') as HTMLSelectElement).value as Sale['paymentMethod'];
      const notes        = (form.querySelector('#s-notes') as HTMLTextAreaElement).value.trim();

      saleService.create({ customerId, customerName, items, taxRate, discount, status: 'pending', paymentStatus: 'unpaid', paymentMethod, notes });
      notifications.success(i18n.t('common.save'));
      onSave();
    },
  });
}

// ── Edit Sale modal ───────────────────────────────────────────────────────────

function openSaleEditModal(sale: Sale, onSave: () => void): void {
  const products = productService.getAll();
  const items: OrderItem[] = sale.items.map((i) => ({ ...i }));
  const currencySymbol = profileService.getCurrencySymbol();

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
        <label class="form-label" for="se-status">${i18n.t('common.status')}</label>
        <select id="se-status" class="form-control">
          <option value="pending"   ${sale.status === 'pending'   ? 'selected' : ''}>${getStatusLabel('pending')}</option>
          <option value="confirmed" ${sale.status === 'confirmed' ? 'selected' : ''}>${getStatusLabel('confirmed')}</option>
          <option value="shipped"   ${sale.status === 'shipped'   ? 'selected' : ''}>${getStatusLabel('shipped')}</option>
          <option value="delivered" ${sale.status === 'delivered' ? 'selected' : ''}>${getStatusLabel('delivered')}</option>
          <option value="cancelled" ${sale.status === 'cancelled' ? 'selected' : ''}>${getStatusLabel('cancelled')}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="se-payment-status">${i18n.t('sales.paymentStatus')}</label>
        <select id="se-payment-status" class="form-control">
          <option value="unpaid"  ${sale.paymentStatus === 'unpaid'  ? 'selected' : ''}>${getPaymentLabel('unpaid')}</option>
          <option value="partial" ${sale.paymentStatus === 'partial' ? 'selected' : ''}>${getPaymentLabel('partial')}</option>
          <option value="paid"    ${sale.paymentStatus === 'paid'    ? 'selected' : ''}>${getPaymentLabel('paid')}</option>
        </select>
      </div>
    </div>
    <div class="form-row" style="margin-bottom:var(--space-4);">
      <div class="form-group">
        <label class="form-label" for="se-payment-method">${i18n.t('sales.paymentMethod')}</label>
        <select id="se-payment-method" class="form-control">
          <option value="cash"     ${sale.paymentMethod === 'cash'     ? 'selected' : ''}>${getPaymentLabel('cash')}</option>
          <option value="card"     ${sale.paymentMethod === 'card'     ? 'selected' : ''}>${getPaymentLabel('card')}</option>
          <option value="transfer" ${sale.paymentMethod === 'transfer' ? 'selected' : ''}>${getPaymentLabel('transfer')}</option>
          <option value="other"    ${sale.paymentMethod === 'other'    ? 'selected' : ''}>${getPaymentLabel('other')}</option>
        </select>
      </div>
    </div>

    <div style="margin-bottom:var(--space-4);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);">
        <label class="form-label" style="margin:0;">${i18n.t('sales.orderItems')}</label>
        <button type="button" class="btn btn-secondary btn-sm" id="se-add-item-btn">${Icons.plus(16)} ${i18n.t('sales.modals.addItem')}</button>
      </div>
      <div id="se-items-container"></div>
      <div id="se-order-totals" style="margin-top:var(--space-3);text-align:right;font-size:var(--font-size-sm);color:var(--color-text-secondary);"></div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="se-tax">${i18n.t('sales.tax')} (%)</label>
        <input type="number" id="se-tax" class="form-control" value="${sale.taxRate}" min="0" max="100" />
      </div>
      <div class="form-group">
        <label class="form-label" for="se-discount">${i18n.t('sales.discount')} (${currencySymbol})</label>
        <input type="number" id="se-discount" class="form-control" value="${sale.discount}" min="0" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="se-notes">${i18n.t('sales.notes')}</label>
      <textarea id="se-notes" class="form-control" placeholder="...">${sale.notes ?? ''}</textarea>
    </div>
  `;

  const updateTotals = () => {
    const taxRate  = parseFloat((form.querySelector('#se-tax')      as HTMLInputElement).value) || 0;
    const discount = parseFloat((form.querySelector('#se-discount') as HTMLInputElement).value) || 0;
    const { subtotal, taxAmount, total } = saleService.calculateTotals(items, taxRate, discount);
    form.querySelector('#se-order-totals')!.innerHTML = `
      <div>${i18n.t('sales.subtotal')}: <strong>${formatCurrency(subtotal)}</strong></div>
      <div>${i18n.t('sales.tax')}: <strong>${formatCurrency(taxAmount)}</strong></div>
      <div style="font-size:var(--font-size-base);font-weight:700;color:var(--color-primary);margin-top:4px;">${i18n.t('common.total')}: ${formatCurrency(total)}</div>`;
  };

  const renderItems = () => {
    const container = form.querySelector('#se-items-container')!;
    container.innerHTML = items.length === 0
      ? `<div style="text-align:center;padding:var(--space-4);color:var(--color-text-tertiary);font-size:var(--font-size-sm);border:1px dashed var(--color-border);border-radius:var(--radius-sm);">${i18n.t('common.noData')}</div>`
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
    title: `${i18n.t('sales.modals.editTitle')} ${escapeHtml(sale.orderNumber)}`,
    content: form,
    size: 'lg',
    confirmText: i18n.t('common.save'),
    onConfirm: () => {
      if (items.length === 0) { showModalError(form, i18n.t('errors.required')); return false; }

      const newStatus = (form.querySelector('#se-status') as HTMLSelectElement).value as Sale['status'];

      // Only validate stock when the order is not being cancelled
      if (newStatus !== 'cancelled') {
        const stockError = validateStock(items, products, reserved);
        if (stockError) { showModalError(form, stockError); return false; }
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
            inventoryService.recordMovement(item.productId, 'return', item.quantity, sale.orderNumber, autoNote('itemEditRestoring', sale.orderNumber));
          });
          // Decrement new items
          items.forEach((item) => {
            inventoryService.recordMovement(item.productId, 'sale', -item.quantity, sale.orderNumber, autoNote('itemEditApplying', sale.orderNumber));
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

      // Accounting integration
      const updatedSale = saleService.getById(sale.id)!;
      if (newStatus === 'delivered' && sale.status !== 'delivered') {
        accountingIntegrationService.postSaleEntry(updatedSale).catch(console.error);
      } else if (newStatus === 'cancelled' && sale.status !== 'cancelled') {
        accountingIntegrationService.reverseEntryForSource('sale', sale.id).catch(console.error);
      }

      notifications.success(i18n.t('common.save'));
      onSave();
    },
  });
}
