/**
 * Balance Sheet feature page.
 */

import { journalService } from '@services/journalService';
import { Icons } from '@shared/components/icons';
import { formatCurrency } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
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
