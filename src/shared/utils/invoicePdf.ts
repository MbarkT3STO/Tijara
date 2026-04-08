/**
 * Invoice PDF / Print renderer.
 * Generates a self-contained HTML document for a given invoice,
 * embedding the enterprise profile (name, logo, contact details).
 */

import type { Invoice, EnterpriseProfile } from '@core/types';
import { profileService } from '@services/profileService';
import { formatCurrency, formatDate } from './helpers';
import type { ElectronAPI } from '../../../electron/preload';

function getElectron(): ElectronAPI | null {
  return (window as unknown as { electron?: ElectronAPI }).electron ?? null;
}

// ── HTML template ─────────────────────────────────────────────────────────────

/** Build a complete, self-contained invoice HTML document */
export function buildInvoiceHTML(invoice: Invoice): string {
  const profile  = profileService.get();
  const currency = profile.currency || 'USD';

  /** Currency-aware formatter for this invoice */
  const fmt = (n: number) => formatCurrency(n, currency);

  const statusColor: Record<string, string> = {
    draft: '#6b7280',
    sent: '#3b82f6',
    paid: '#22c55e',
    overdue: '#ef4444',
    cancelled: '#9ca3af',
  };
  const color = statusColor[invoice.status] ?? '#6b7280';

  const itemRows = invoice.items
    .map(
      (item, i) => `
      <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td>${item.productName}</td>
        <td class="center">${item.quantity}</td>
        <td class="right">${fmt(item.unitPrice)}</td>
        <td class="center">${item.discount > 0 ? item.discount + '%' : '—'}</td>
        <td class="right"><strong>${fmt(item.total)}</strong></td>
      </tr>`
    )
    .join('');

  const brandBlock = buildBrandBlock(profile);
  const fromBlock  = buildFromBlock(profile);

  const netDays = Math.round(
    (new Date(invoice.dueDate).getTime() - new Date(invoice.createdAt).getTime()) / 86400000
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px; color: #111827; background: #fff;
      padding: 48px; line-height: 1.5;
    }
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #9929ea;
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-logo {
      max-height: 56px; max-width: 160px;
      object-fit: contain; display: block;
    }
    .brand-icon {
      width: 48px; height: 48px;
      background: linear-gradient(135deg, #7a1fc0, #cc66da);
      border-radius: 10px; display: flex; align-items: center; justify-content: center;
    }
    .brand-name { font-size: 24px; font-weight: 700; color: #9929ea; letter-spacing: -0.02em; }
    .brand-tagline { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
    .invoice-meta { text-align: right; }
    .invoice-number { font-size: 22px; font-weight: 700; color: #111827; }
    .invoice-date { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .status-badge {
      display: inline-block; margin-top: 8px; padding: 3px 12px;
      border-radius: 999px; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.05em;
      background: ${color}22; color: ${color}; border: 1px solid ${color}44;
    }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
    .party-label {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 6px;
    }
    .party-name { font-size: 15px; font-weight: 600; color: #111827; }
    .party-detail { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .dates-row {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
      background: #f9fafb; border-radius: 8px; padding: 16px 20px; margin-bottom: 32px;
    }
    .date-item-label {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.06em; color: #9ca3af; margin-bottom: 4px;
    }
    .date-item-value { font-size: 13px; font-weight: 500; color: #111827; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #9929ea; color: white; }
    thead th {
      padding: 10px 14px; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.05em; text-align: left;
    }
    thead th.center { text-align: center; }
    thead th.right  { text-align: right; }
    tbody td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
    td.center { text-align: center; }
    td.right  { text-align: right; }
    .row-even { background: #fff; }
    .row-odd  { background: #faf5ff; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
    .totals-box { width: 280px; }
    .totals-row {
      display: flex; justify-content: space-between;
      padding: 6px 0; font-size: 13px; color: #374151; border-bottom: 1px solid #f3f4f6;
    }
    .totals-row.grand {
      font-size: 16px; font-weight: 700; color: #9929ea;
      border-bottom: none; border-top: 2px solid #9929ea; padding-top: 10px; margin-top: 4px;
    }
    .totals-row.paid-row { color: #22c55e; font-weight: 500; }
    .totals-row.due-row  { color: ${invoice.amountDue > 0 ? '#ef4444' : '#22c55e'}; font-weight: 600; }
    .notes {
      background: #f9fafb; border-left: 3px solid #9929ea;
      border-radius: 0 6px 6px 0; padding: 12px 16px; margin-bottom: 32px;
    }
    .notes-label {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.06em; color: #9ca3af; margin-bottom: 4px;
    }
    .notes-text { font-size: 12px; color: #374151; }
    .footer {
      text-align: center; font-size: 11px; color: #9ca3af;
      padding-top: 24px; border-top: 1px solid #e5e7eb;
    }
    @media print {
      body { padding: 24px; }
      @page { margin: 16mm; size: A4; }
    }
  </style>
</head>
<body>

  <div class="header">
    ${brandBlock}
    <div class="invoice-meta">
      <div class="invoice-number">${invoice.invoiceNumber}</div>
      <div class="invoice-date">Issued: ${formatDate(invoice.createdAt)}</div>
      <div class="status-badge">${invoice.status.toUpperCase()}</div>
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="party-label">Bill To</div>
      <div class="party-name">${invoice.customerName}</div>
    </div>
    <div>
      <div class="party-label">From</div>
      ${fromBlock}
    </div>
  </div>

  <div class="dates-row">
    <div>
      <div class="date-item-label">Invoice Date</div>
      <div class="date-item-value">${formatDate(invoice.createdAt)}</div>
    </div>
    <div>
      <div class="date-item-label">Due Date</div>
      <div class="date-item-value">${formatDate(invoice.dueDate)}</div>
    </div>
    <div>
      <div class="date-item-label">Payment Terms</div>
      <div class="date-item-value">Net ${netDays > 0 ? netDays : 30} days</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="center">Qty</th>
        <th class="right">Unit Price</th>
        <th class="center">Discount</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Subtotal</span><span>${fmt(invoice.subtotal)}</span></div>
      ${invoice.discount > 0 ? `<div class="totals-row"><span>Discount</span><span>-${fmt(invoice.discount)}</span></div>` : ''}
      <div class="totals-row"><span>Tax (${invoice.taxRate}%)</span><span>${fmt(invoice.taxAmount)}</span></div>
      <div class="totals-row grand"><span>Total</span><span>${fmt(invoice.total)}</span></div>
      ${invoice.amountPaid > 0 ? `
        <div class="totals-row paid-row"><span>Amount Paid</span><span>${fmt(invoice.amountPaid)}</span></div>
        <div class="totals-row due-row"><span>Balance Due</span><span>${fmt(invoice.amountDue)}</span></div>
      ` : ''}
    </div>
  </div>

  ${invoice.notes ? `
  <div class="notes">
    <div class="notes-label">Notes</div>
    <div class="notes-text">${invoice.notes}</div>
  </div>` : ''}

  <div class="footer">
    Thank you for your business
    ${profile.name ? ` · ${profile.name}` : ''}
    · Generated by Tijara
    · ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
  </div>

</body>
</html>`;
}

/** Build the brand/logo block for the invoice header */
function buildBrandBlock(profile: EnterpriseProfile): string {
  if (profile.logo) {
    return `
      <div class="brand">
        <img src="${profile.logo}" alt="${profile.name} logo" class="brand-logo" />
        ${profile.name ? `
        <div>
          <div class="brand-name">${profile.name}</div>
          ${profile.tagline ? `<div class="brand-tagline">${profile.tagline}</div>` : ''}
        </div>` : ''}
      </div>`;
  }

  if (profile.name) {
    return `
      <div class="brand">
        <div class="brand-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </div>
        <div>
          <div class="brand-name">${profile.name}</div>
          ${profile.tagline ? `<div class="brand-tagline">${profile.tagline}</div>` : ''}
        </div>
      </div>`;
  }

  // Fallback: Tijara default branding
  return `
    <div class="brand">
      <div class="brand-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
      </div>
      <div>
        <div class="brand-name">Tijara</div>
        <div class="brand-tagline">Sales Management</div>
      </div>
    </div>`;
}

/** Build the "From" section with enterprise contact details */
function buildFromBlock(profile: EnterpriseProfile): string {
  if (!profile.name) {
    return `
      <div class="party-name">Tijara Inc.</div>
      <div class="party-detail">billing@tijara.app</div>`;
  }

  const lines: string[] = [];
  lines.push(`<div class="party-name">${profile.name}</div>`);
  if (profile.address) lines.push(`<div class="party-detail">${profile.address}${profile.city ? ', ' + profile.city : ''}${profile.country ? ', ' + profile.country : ''}</div>`);
  if (profile.email)   lines.push(`<div class="party-detail">${profile.email}</div>`);
  if (profile.phone)   lines.push(`<div class="party-detail">${profile.phone}</div>`);
  if (profile.website) lines.push(`<div class="party-detail">${profile.website}</div>`);
  if (profile.taxId)   lines.push(`<div class="party-detail">Tax ID: ${profile.taxId}</div>`);
  return lines.join('');
}

// ── Print ─────────────────────────────────────────────────────────────────────

export function printInvoice(invoice: Invoice): void {
  const html = buildInvoiceHTML(invoice);
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
    win.onafterprint = () => win.close();
  };
}

// ── PDF export ────────────────────────────────────────────────────────────────

export async function exportInvoicePDF(invoice: Invoice): Promise<void> {
  const electron = getElectron();
  const html = buildInvoiceHTML(invoice);
  if (electron) {
    await electron.exportInvoicePDF(html, invoice.invoiceNumber);
  } else {
    printInvoice(invoice);
  }
}
