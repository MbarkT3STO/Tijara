/**
 * Balance Sheet feature page.
 */

import { journalService } from '@services/journalService';
import { Icons } from '@shared/components/icons';
import { formatCurrency, exportReportPDF } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import type { Language } from '@core/i18n/types';
import { profileService } from '@services/profileService';
import type { BalanceSheet } from '@core/types';

interface State {
  asOf: string;
  sheet: BalanceSheet | null;
}

export function renderBalanceSheet(): HTMLElement {
  const state: State = {
    asOf: new Date().toISOString().slice(0, 10),
    sheet: null,
  };

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function generate() {
    state.sheet = journalService.computeBalanceSheet(new Date(state.asOf + 'T23:59:59').toISOString());
    render();
  }

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    page.querySelector<HTMLInputElement>('#bs-asof')?.addEventListener('change', (e) => { state.asOf = (e.target as HTMLInputElement).value; });
    page.querySelector('#bs-generate')?.addEventListener('click', generate);
    page.querySelector('#bs-export-pdf')?.addEventListener('click', () => {
      if (!state.sheet) return;
      const profile = profileService.get();
      const pdfLang = (profile.defaultPdfLanguage as Language) ?? 'en';
      const html = buildPrintHTML(state, profile.name, pdfLang);
      exportReportPDF(html, `balance-sheet-${state.asOf}.pdf`).catch(console.error);
    });
  }

  generate();
  return page;
}

function buildHTML(state: State): string {
  const s = state.sheet;

  const buildSection = (rows: { accountCode: string; accountName: string; amount: number }[]) =>
    rows.map((r) => `
      <tr>
        <td style="padding-inline-start:var(--space-6);">${r.accountCode} · ${r.accountName}</td>
        <td style="text-align:right;">${formatCurrency(r.amount)}</td>
      </tr>`).join('');

  const subtotal = (label: string, amount: number) => `
    <tr class="fs-subtotal">
      <td>${label}</td>
      <td style="text-align:right;font-weight:700;">${formatCurrency(amount)}</td>
    </tr>`;

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('accounting.balanceSheet.title' as any)}</h2>
      </div>
      <div style="display:flex;gap:var(--space-3);align-items:center;">
        <label style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">${i18n.t('accounting.balanceSheet.asOf' as any)}</label>
        <input type="date" id="bs-asof" class="form-control" value="${state.asOf}" style="width:auto;" />
        <button class="btn btn-primary" id="bs-generate">${Icons.balanceSheet(14)} ${i18n.t('common.filter')}</button>
        ${s ? `<button class="btn btn-secondary" id="bs-export-pdf">${Icons.fileText(14)} ${i18n.t('common.exportPdf' as any)}</button>` : ''}
      </div>
    </div>

    ${s ? `
    <div class="${s.isBalanced ? 'tb-balanced-banner ok' : 'tb-balanced-banner err'}" style="margin-bottom:var(--space-4);">
      ${s.isBalanced ? Icons.check(16) : Icons.alertCircle(16)}
      <span>${s.isBalanced
        ? i18n.t('accounting.balanceSheet.balanced' as any)
        : i18n.t('accounting.balanceSheet.outOfBalance' as any, { amount: formatCurrency(Math.abs(s.totalAssets - s.totalLiabilitiesAndEquity)) })
      }</span>
    </div>` : ''}

    ${!s ? `<div class="card"><div class="empty-state"><div class="empty-state-icon">${Icons.balanceSheet(32)}</div><p class="empty-state-title">${i18n.t('common.noData')}</p></div></div>` : `
    <div class="balance-sheet-grid">
      <!-- Assets Column -->
      <div class="card">
        <div class="card-header"><h3 class="card-title">${i18n.t('accounting.balanceSheet.assets' as any)}</h3></div>
        <div class="card-body" style="padding:0;">
          <table class="data-table" style="width:100%;">
            <tbody>
              <tr class="fs-section-header"><td colspan="2">${i18n.t('accounting.balanceSheet.currentAssets' as any)}</td></tr>
              ${buildSection(s.currentAssets)}
              ${subtotal(i18n.t('accounting.balanceSheet.currentAssets' as any), s.totalCurrentAssets)}

              ${s.fixedAssets.length > 0 ? `
              <tr class="fs-section-header"><td colspan="2">${i18n.t('accounting.balanceSheet.fixedAssets' as any)}</td></tr>
              ${buildSection(s.fixedAssets)}
              ${subtotal(i18n.t('accounting.balanceSheet.fixedAssets' as any), s.totalFixedAssets)}` : ''}

              ${s.otherAssets.length > 0 ? `
              <tr class="fs-section-header"><td colspan="2">${i18n.t('accounting.balanceSheet.otherAssets' as any)}</td></tr>
              ${buildSection(s.otherAssets)}` : ''}
            </tbody>
            <tfoot>
              <tr class="fs-total">
                <td>${i18n.t('accounting.balanceSheet.totalAssets' as any)}</td>
                <td style="text-align:right;">${formatCurrency(s.totalAssets)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Liabilities + Equity Column -->
      <div class="card">
        <div class="card-header"><h3 class="card-title">${i18n.t('accounting.balanceSheet.liabilities' as any)} & ${i18n.t('accounting.balanceSheet.equity' as any)}</h3></div>
        <div class="card-body" style="padding:0;">
          <table class="data-table" style="width:100%;">
            <tbody>
              <tr class="fs-section-header"><td colspan="2">${i18n.t('accounting.balanceSheet.currentLiabilities' as any)}</td></tr>
              ${buildSection(s.currentLiabilities)}
              ${subtotal(i18n.t('accounting.balanceSheet.currentLiabilities' as any), s.totalCurrentLiabilities)}

              ${s.longTermLiabilities.length > 0 ? `
              <tr class="fs-section-header"><td colspan="2">${i18n.t('accounting.balanceSheet.longTermLiabilities' as any)}</td></tr>
              ${buildSection(s.longTermLiabilities)}` : ''}

              ${subtotal(i18n.t('accounting.balanceSheet.totalLiabilities' as any), s.totalLiabilities)}

              <tr class="fs-section-header"><td colspan="2">${i18n.t('accounting.balanceSheet.equity' as any)}</td></tr>
              ${buildSection(s.equity)}
              ${subtotal(i18n.t('accounting.balanceSheet.totalEquity' as any), s.totalEquity)}
            </tbody>
            <tfoot>
              <tr class="fs-total">
                <td>${i18n.t('accounting.balanceSheet.totalLiabilitiesAndEquity' as any)}</td>
                <td style="text-align:right;">${formatCurrency(s.totalLiabilitiesAndEquity)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>`}
  `;
}

function buildPrintHTML(state: State, companyName: string, lang: Language = 'en'): string {
  const t = (key: Parameters<typeof i18n.t>[0], vars?: Record<string, string | number>) => i18n.tFor(lang, key, vars);
  const dir = i18n.getDirectionFor(lang);
  const s = state.sheet!;
  const buildRows = (rows: { accountCode: string; accountName: string; amount: number }[]) =>
    rows.map((r) => `<tr><td style="padding:4px 8px;">${r.accountCode} · ${r.accountName}</td><td style="text-align:right;padding:4px 8px;">${formatCurrency(r.amount)}</td></tr>`).join('');

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="utf-8"><title>Balance Sheet</title>
  <style>
    body{font-family:Arial,sans-serif;color:#000;background:#fff;margin:0;padding:24px;}
    h1{font-size:18px;margin:0 0 4px;}h2{font-size:14px;margin:0 0 16px;color:#555;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;}
    th{background:#f0f0f0;padding:6px 8px;text-align:left;font-size:12px;border-bottom:2px solid #ccc;}
    td{font-size:12px;border-bottom:1px solid #eee;}
    .section-header td{background:#f8f8f8;font-weight:700;padding:6px 8px;}
    .subtotal td{font-weight:600;border-top:1px solid #ccc;}
    .total td{font-weight:700;border-top:2px solid #000;font-size:13px;}
    .footer{margin-top:24px;font-size:10px;color:#888;text-align:center;}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;}
  </style></head><body>
  <h1>${companyName}</h1>
  <h2>${t('accounting.balanceSheet.title' as any)} — ${t('accounting.balanceSheet.asOf' as any)} ${state.asOf}</h2>
  <div class="grid">
    <div>
      <table>
        <thead><tr><th colspan="2">${t('accounting.balanceSheet.assets' as any)}</th></tr></thead>
        <tbody>
          <tr class="section-header"><td colspan="2">${t('accounting.balanceSheet.currentAssets' as any)}</td></tr>
          ${buildRows(s.currentAssets)}
          <tr class="subtotal"><td>${t('accounting.balanceSheet.currentAssets' as any)}</td><td style="text-align:right;">${formatCurrency(s.totalCurrentAssets)}</td></tr>
          ${s.fixedAssets.length > 0 ? `<tr class="section-header"><td colspan="2">${t('accounting.balanceSheet.fixedAssets' as any)}</td></tr>${buildRows(s.fixedAssets)}<tr class="subtotal"><td>${t('accounting.balanceSheet.fixedAssets' as any)}</td><td style="text-align:right;">${formatCurrency(s.totalFixedAssets)}</td></tr>` : ''}
          ${s.otherAssets.length > 0 ? `<tr class="section-header"><td colspan="2">${t('accounting.balanceSheet.otherAssets' as any)}</td></tr>${buildRows(s.otherAssets)}` : ''}
          <tr class="total"><td>${t('accounting.balanceSheet.totalAssets' as any)}</td><td style="text-align:right;">${formatCurrency(s.totalAssets)}</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <table>
        <thead><tr><th colspan="2">${t('accounting.balanceSheet.liabilities' as any)} &amp; ${t('accounting.balanceSheet.equity' as any)}</th></tr></thead>
        <tbody>
          <tr class="section-header"><td colspan="2">${t('accounting.balanceSheet.currentLiabilities' as any)}</td></tr>
          ${buildRows(s.currentLiabilities)}
          <tr class="subtotal"><td>${t('accounting.balanceSheet.currentLiabilities' as any)}</td><td style="text-align:right;">${formatCurrency(s.totalCurrentLiabilities)}</td></tr>
          ${s.longTermLiabilities.length > 0 ? `<tr class="section-header"><td colspan="2">${t('accounting.balanceSheet.longTermLiabilities' as any)}</td></tr>${buildRows(s.longTermLiabilities)}` : ''}
          <tr class="subtotal"><td>${t('accounting.balanceSheet.totalLiabilities' as any)}</td><td style="text-align:right;">${formatCurrency(s.totalLiabilities)}</td></tr>
          <tr class="section-header"><td colspan="2">${t('accounting.balanceSheet.equity' as any)}</td></tr>
          ${buildRows(s.equity)}
          <tr class="subtotal"><td>${t('accounting.balanceSheet.totalEquity' as any)}</td><td style="text-align:right;">${formatCurrency(s.totalEquity)}</td></tr>
          <tr class="total"><td>${t('accounting.balanceSheet.totalLiabilitiesAndEquity' as any)}</td><td style="text-align:right;">${formatCurrency(s.totalLiabilitiesAndEquity)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="footer">${t('common.generatedBy')} · ${new Date().toLocaleDateString()}</div>
  </body></html>`;
}
