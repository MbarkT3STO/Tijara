/**
 * Invoice PDF / Print renderer.
 * Generates a self-contained HTML document for a given invoice,
 * embedding the enterprise profile (name, logo, contact details).
 */

import type { Invoice, EnterpriseProfile } from '@core/types';
import { profileService } from '@services/profileService';
import { formatCurrency, formatDate } from './helpers';
import type { ElectronAPI } from '../../../electron/preload';
import { i18n } from '@core/i18n';
import type { Language } from '@core/i18n/types';

function getElectron(): ElectronAPI | null {
  return (window as unknown as { electron?: ElectronAPI }).electron ?? null;
}

// ── App logo (base64 cache) ───────────────────────────────────────────────────

let _appLogoBase64: string | null = null;

/** Fetch the app logo once and cache as a base64 data URL */
async function getAppLogoBase64(): Promise<string> {
  if (_appLogoBase64) return _appLogoBase64;
  try {
    const res = await fetch('./icons/icon-512.png');
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        _appLogoBase64 = reader.result as string;
        resolve(_appLogoBase64);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    // Fallback: empty transparent pixel
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  }
}

// ── HTML template ─────────────────────────────────────────────────────────────

/** Build a complete, self-contained invoice HTML document */
export async function buildInvoiceHTML(invoice: Invoice): Promise<string> {
  const profile  = profileService.get();
  const currency = profile.currency || 'USD';
  const pdfLang  = (profile.defaultPdfLanguage || 'en') as Language;
  const dir      = i18n.getDirectionFor(pdfLang);

  // Resolve logo: use enterprise logo if set, otherwise fall back to app logo as base64
  const appLogoBase64 = profile.logo ? '' : await getAppLogoBase64();

  /** Locale-aware translator for this PDF */
  const t = (key: any, vars?: any) => i18n.tFor(pdfLang, key, vars);

  /** Locale-aware formatters for this invoice */
  const fmt = (n: number) => formatCurrency(n, currency, pdfLang);
  const dfmt = (d: string) => formatDate(d, pdfLang);

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

  const brandBlock = buildBrandBlock(profile, appLogoBase64, t);
  const fromBlock  = buildFromBlock(profile, pdfLang);

  const netDays = Math.round(
    (new Date(invoice.dueDate).getTime() - new Date(invoice.createdAt).getTime()) / 86400000
  );

  return `<!DOCTYPE html>
<html lang="${pdfLang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <title>${t('invoices.invoiceNumber')} ${invoice.invoiceNumber}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${dir === 'rtl' ? "'Cairo', 'Segoe UI', sans-serif" : "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif"};
      font-size: 13px; color: #111827; background: #fff;
      padding: 48px; line-height: 1.6;
      direction: ${dir};
    }
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #9929ea;
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-logo { max-height: 56px; max-width: 160px; object-fit: contain; display: block; }
    .brand-name { font-size: 22px; font-weight: 700; color: #9929ea; letter-spacing: -0.02em; }
    .brand-tagline { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
    .invoice-meta { text-align: end; }
    .invoice-number { font-size: 22px; font-weight: 700; color: #111827; }
    .invoice-date { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .status-badge {
      display: inline-block; margin-top: 8px; padding: 3px 12px;
      border-radius: 999px; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.05em;
      background: ${color}22; color: ${color}; border: 1px solid ${color}44;
    }
    .parties {
      display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px;
    }
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
      text-transform: uppercase; letter-spacing: 0.05em; text-align: start;
    }
    thead th.center { text-align: center; }
    thead th.right  { text-align: end; }
    tbody td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f3f4f6; text-align: start; }
    td.center { text-align: center; }
    td.right  { text-align: end; }
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
      background: #f9fafb;
      border-inline-start: 3px solid #9929ea;
      border-radius: 0 6px 6px 0;
      padding: 12px 16px; margin-bottom: 32px;
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
    .force-ltr { direction: ltr !important; unicode-bidi: isolate; display: inline-block; }
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
      <div class="invoice-date">${t('invoices.modals.issued')}: ${dfmt(invoice.createdAt)}</div>
      <div class="status-badge">${t(`invoices.statuses.${invoice.status}` as any).toUpperCase()}</div>
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="party-label">${t('invoices.modals.billTo')}</div>
      <div class="party-name">${invoice.customerName}</div>
    </div>
    <div>
      <div class="party-label">${t('invoices.modals.from')}</div>
      ${fromBlock}
    </div>
  </div>

  <div class="dates-row">
    <div>
      <div class="date-item-label">${t('invoices.modals.invoiceDate')}</div>
      <div class="date-item-value">${dfmt(invoice.createdAt)}</div>
    </div>
    <div>
      <div class="date-item-label">${t('invoices.dueDate')}</div>
      <div class="date-item-value">${dfmt(invoice.dueDate)}</div>
    </div>
    <div>
      <div class="date-item-label">${t('invoices.modals.paymentTermsLabel')}</div>
      <div class="date-item-value">${t('common.net' as any)} ${netDays > 0 ? netDays : 30} ${t('common.days' as any)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>${t('common.description' as any)}</th>
        <th class="center">${t('common.quantity' as any)}</th>
        <th class="right">${t('products.price')}</th>
        <th class="center">${t('sales.discount')}</th>
        <th class="right">${t('common.amount' as any)}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>${t('invoices.modals.summary' as any)}</span><span>${fmt(invoice.subtotal)}</span></div>
      ${invoice.discount > 0 ? `<div class="totals-row"><span>${t('sales.discount')}</span><span>-${fmt(invoice.discount)}</span></div>` : ''}
      <div class="totals-row"><span>${t('invoices.tax' as any)} (${invoice.taxRate}%)</span><span>${fmt(invoice.taxAmount)}</span></div>
      <div class="totals-row grand"><span>${t('common.total')}</span><span>${fmt(invoice.total)}</span></div>
      ${invoice.amountPaid > 0 ? `
        <div class="totals-row paid-row"><span>${t('invoices.paid')}</span><span>${fmt(invoice.amountPaid)}</span></div>
        <div class="totals-row due-row"><span>${t('invoices.modals.balanceDue')}</span><span>${fmt(invoice.amountDue)}</span></div>
      ` : ''}
    </div>
  </div>

  ${invoice.notes ? `
  <div class="notes">
    <div class="notes-label">${t('common.notes')}</div>
    <div class="notes-text">${invoice.notes}</div>
  </div>` : ''}

  <div class="footer">
    ${t('common.thankYou' as any)}
    ${profile.name ? ` · ${profile.name}` : ''}
    · ${t('common.generatedBy' as any)}
    · ${dfmt(new Date().toISOString())}
  </div>

</body>
</html>`;
}

/** Build the brand/logo block for the invoice header */
function buildBrandBlock(profile: EnterpriseProfile, appLogoBase64: string, t: (key: any) => string): string {
  const fallbackLogo = appLogoBase64;
  const appName = t('app.name' as any);
  const appTagline = t('app.tagline' as any);

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
        <img src="${fallbackLogo}" alt="${appName} logo" class="brand-logo" style="max-height:48px;max-width:48px;border-radius:8px;" />
        <div>
          <div class="brand-name">${profile.name}</div>
          ${profile.tagline ? `<div class="brand-tagline">${profile.tagline}</div>` : ''}
        </div>
      </div>`;
  }

  // No profile set — show app logo + translated app name
  return `
    <div class="brand">
      <img src="${fallbackLogo}" alt="${appName} logo" class="brand-logo" style="max-height:48px;max-width:48px;border-radius:8px;" />
      <div>
        <div class="brand-name">${appName}</div>
        <div class="brand-tagline">${appTagline}</div>
      </div>
    </div>`;
}

/** Build the "From" section with enterprise contact details */
function buildFromBlock(profile: EnterpriseProfile, lang: Language): string {
  const t = (key: any) => i18n.tFor(lang, key);
  if (!profile.name) {
    return `
      <div class="party-name">${t('app.name' as any)}</div>
      <div class="party-detail">${t('app.tagline' as any)}</div>`;
  }

  const lines: string[] = [];
  lines.push(`<div class="party-name">${profile.name}</div>`);
  if (profile.address) lines.push(`<div class="party-detail">${profile.address}${profile.city ? ', ' + profile.city : ''}${profile.country ? ', ' + profile.country : ''}</div>`);
  if (profile.email)   lines.push(`<div class="party-detail">${profile.email}</div>`);
  if (profile.phone)   lines.push(`<div class="party-detail"><span class="force-ltr">${profile.phone}</span></div>`);
  if (profile.website) lines.push(`<div class="party-detail">${profile.website}</div>`);
  if (profile.taxId)   lines.push(`<div class="party-detail">${t('settings.taxId')}: ${profile.taxId}</div>`);
  return lines.join('');
}

// ── Print ─────────────────────────────────────────────────────────────────────

export async function printInvoice(invoice: Invoice): Promise<void> {
  const html = await buildInvoiceHTML(invoice);
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
  const html = await buildInvoiceHTML(invoice);
  if (electron) {
    await electron.exportInvoicePDF(html, invoice.invoiceNumber);
  } else {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); win.onafterprint = () => win.close(); };
  }
}
