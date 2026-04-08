/**
 * Invoice PDF / Print renderer.
 * Generates a self-contained HTML document for a given invoice,
 * then either prints it or exports it as PDF via Electron IPC.
 */

import type { Invoice } from '@core/types';
import { formatCurrency, formatDate } from './helpers';
import type { ElectronAPI } from '../../../electron/preload';

function getElectron(): ElectronAPI | null {
  return (window as unknown as { electron?: ElectronAPI }).electron ?? null;
}

// ── HTML template ─────────────────────────────────────────────────────────────

/** Build a complete, self-contained invoice HTML document */
export function buildInvoiceHTML(invoice: Invoice): string {
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
        <td class="right">${formatCurrency(item.unitPrice)}</td>
        <td class="center">${item.discount > 0 ? item.discount + '%' : '—'}</td>
        <td class="right"><strong>${formatCurrency(item.total)}</strong></td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      color: #111827;
      background: #fff;
      padding: 48px;
      line-height: 1.5;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 2px solid #9929ea;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #7a1fc0, #cc66da);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-name {
      font-size: 24px;
      font-weight: 700;
      color: #9929ea;
      letter-spacing: -0.02em;
    }

    .brand-tagline {
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .invoice-meta {
      text-align: right;
    }

    .invoice-number {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
    }

    .invoice-date {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }

    .status-badge {
      display: inline-block;
      margin-top: 8px;
      padding: 3px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: ${color}22;
      color: ${color};
      border: 1px solid ${color}44;
    }

    /* ── Parties ── */
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 32px;
    }

    .party-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #9ca3af;
      margin-bottom: 6px;
    }

    .party-name {
      font-size: 15px;
      font-weight: 600;
      color: #111827;
    }

    .party-detail {
      font-size: 12px;
      color: #6b7280;
      margin-top: 2px;
    }

    /* ── Dates row ── */
    .dates-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      background: #f9fafb;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 32px;
    }

    .date-item-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #9ca3af;
      margin-bottom: 4px;
    }

    .date-item-value {
      font-size: 13px;
      font-weight: 500;
      color: #111827;
    }

    /* ── Items table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }

    thead tr {
      background: #9929ea;
      color: white;
    }

    thead th {
      padding: 10px 14px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: left;
    }

    thead th.center { text-align: center; }
    thead th.right  { text-align: right; }

    tbody td {
      padding: 10px 14px;
      font-size: 13px;
      border-bottom: 1px solid #f3f4f6;
    }

    td.center { text-align: center; }
    td.right  { text-align: right; }

    .row-even { background: #fff; }
    .row-odd  { background: #faf5ff; }

    /* ── Totals ── */
    .totals {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 32px;
    }

    .totals-box {
      width: 280px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
      color: #374151;
      border-bottom: 1px solid #f3f4f6;
    }

    .totals-row.grand {
      font-size: 16px;
      font-weight: 700;
      color: #9929ea;
      border-bottom: none;
      border-top: 2px solid #9929ea;
      padding-top: 10px;
      margin-top: 4px;
    }

    .totals-row.paid-row {
      color: #22c55e;
      font-weight: 500;
    }

    .totals-row.due-row {
      color: ${invoice.amountDue > 0 ? '#ef4444' : '#22c55e'};
      font-weight: 600;
    }

    /* ── Notes ── */
    .notes {
      background: #f9fafb;
      border-left: 3px solid #9929ea;
      border-radius: 0 6px 6px 0;
      padding: 12px 16px;
      margin-bottom: 32px;
    }

    .notes-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #9ca3af;
      margin-bottom: 4px;
    }

    .notes-text {
      font-size: 12px;
      color: #374151;
    }

    /* ── Footer ── */
    .footer {
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }

    /* ── Print ── */
    @media print {
      body { padding: 24px; }
      @page { margin: 16mm; size: A4; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
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
    </div>
    <div class="invoice-meta">
      <div class="invoice-number">${invoice.invoiceNumber}</div>
      <div class="invoice-date">Issued: ${formatDate(invoice.createdAt)}</div>
      <div class="status-badge">${invoice.status.toUpperCase()}</div>
    </div>
  </div>

  <!-- Parties -->
  <div class="parties">
    <div>
      <div class="party-label">Bill To</div>
      <div class="party-name">${invoice.customerName}</div>
    </div>
    <div>
      <div class="party-label">From</div>
      <div class="party-name">Tijara Inc.</div>
      <div class="party-detail">billing@tijara.app</div>
    </div>
  </div>

  <!-- Dates -->
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
      <div class="date-item-value">Net ${Math.round((new Date(invoice.dueDate).getTime() - new Date(invoice.createdAt).getTime()) / 86400000)} days</div>
    </div>
  </div>

  <!-- Items -->
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
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${formatCurrency(invoice.subtotal)}</span>
      </div>
      ${invoice.discount > 0 ? `
      <div class="totals-row">
        <span>Discount</span>
        <span>-${formatCurrency(invoice.discount)}</span>
      </div>` : ''}
      <div class="totals-row">
        <span>Tax (${invoice.taxRate}%)</span>
        <span>${formatCurrency(invoice.taxAmount)}</span>
      </div>
      <div class="totals-row grand">
        <span>Total</span>
        <span>${formatCurrency(invoice.total)}</span>
      </div>
      ${invoice.amountPaid > 0 ? `
      <div class="totals-row paid-row">
        <span>Amount Paid</span>
        <span>${formatCurrency(invoice.amountPaid)}</span>
      </div>
      <div class="totals-row due-row">
        <span>Balance Due</span>
        <span>${formatCurrency(invoice.amountDue)}</span>
      </div>` : ''}
    </div>
  </div>

  ${invoice.notes ? `
  <!-- Notes -->
  <div class="notes">
    <div class="notes-label">Notes</div>
    <div class="notes-text">${invoice.notes}</div>
  </div>` : ''}

  <!-- Footer -->
  <div class="footer">
    Thank you for your business · Generated by Tijara · ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
  </div>

</body>
</html>`;
}

// ── Print ─────────────────────────────────────────────────────────────────────

/**
 * Open the invoice in a new window and trigger the browser print dialog.
 * Works in both Electron (Chromium) and plain browsers.
 */
export function printInvoice(invoice: Invoice): void {
  const html = buildInvoiceHTML(invoice);
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  // Wait for resources to load before printing
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    // Close the window after the print dialog is dismissed
    printWindow.onafterprint = () => printWindow.close();
  };
}

// ── PDF export ────────────────────────────────────────────────────────────────

/**
 * Export the invoice as a PDF file.
 * In Electron: uses IPC to call printToPDF in the main process (native save dialog).
 * In browser: falls back to window.print() with a PDF-save hint.
 */
export async function exportInvoicePDF(invoice: Invoice): Promise<void> {
  const electron = getElectron();
  const html = buildInvoiceHTML(invoice);

  if (electron) {
    await electron.exportInvoicePDF(html, invoice.invoiceNumber);
  } else {
    // Browser fallback: open print dialog (user can "Save as PDF")
    printInvoice(invoice);
  }
}
