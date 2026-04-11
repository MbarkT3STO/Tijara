/**
 * Trial Balance feature page.
 */

import { journalService } from '@services/journalService';
import { fiscalPeriodService } from '@services/fiscalPeriodService';
import { Icons } from '@shared/components/icons';
import { formatCurrency, exportReportPDF, escapeHtml } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import type { Language } from '@core/i18n/types';
import { profileService } from '@services/profileService';
import type { TrialBalance, AccountType } from '@core/types';

interface State {
  periodId: string;
  trialBalance: TrialBalance | null;
  showZero: boolean;
}

export function renderTrialBalance(): HTMLElement {
  const periods = fiscalPeriodService.getAll();
  const current = fiscalPeriodService.getCurrent() ?? periods[0];

  const state: State = {
    periodId: current?.id ?? '',
    trialBalance: null,
    showZero: false,
  };

  if (state.periodId) {
    state.trialBalance = journalService.computeTrialBalance(state.periodId);
  }

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function render() {
    page.innerHTML = buildHTML(state, periods);
    attachEvents();
  }

  function attachEvents() {
    page.querySelector<HTMLSelectElement>('#tb-period')?.addEventListener('change', (e) => {
      state.periodId = (e.target as HTMLSelectElement).value;
      state.trialBalance = state.periodId ? journalService.computeTrialBalance(state.periodId) : null;
      render();
    });

    page.querySelector<HTMLInputElement>('#tb-show-zero')?.addEventListener('change', (e) => {
      state.showZero = (e.target as HTMLInputElement).checked;
      render();
    });

    page.querySelector('#tb-export-pdf')?.addEventListener('click', () => {
      if (!state.trialBalance) return;
      const profile = profileService.get();
      const periodName = periods.find((p) => p.id === state.periodId)?.name ?? state.periodId;
      const pdfLang = (profile.defaultPdfLanguage as Language) ?? 'en';
      const html = buildPrintHTML(state, periods, profile.name, periodName, pdfLang);
      exportReportPDF(html, `trial-balance-${periodName}.pdf`).catch(console.error);
    });
  }

  render();
  return page;
}

function buildHTML(state: State, periods: ReturnType<typeof fiscalPeriodService.getAll>): string {
  const tb = state.trialBalance;
  const rows = tb ? (state.showZero ? tb.rows : tb.rows.filter((r) => r.debitBalance > 0 || r.creditBalance > 0)) : [];

  const typeOrder: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];
  const grouped: Record<string, typeof rows> = {};
  for (const type of typeOrder) {
    const typeRows = rows.filter((r) => r.accountType === type);
    if (typeRows.length > 0) grouped[type] = typeRows;
  }

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('accounting.trialBalance.title' as any)}</h2>
      </div>
      <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap;">
        <select id="tb-period" class="form-control" style="width:auto;">
          ${periods.map((p) => `<option value="${p.id}" ${state.periodId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
        <label class="checkbox-group">
          <input type="checkbox" id="tb-show-zero" ${state.showZero ? 'checked' : ''} />
          <span style="font-size:var(--font-size-sm);">${i18n.t('accounting.trialBalance.showZeroBalances' as any)}</span>
        </label>
        ${tb ? `<button class="btn btn-secondary" id="tb-export-pdf">${Icons.fileText(14)} ${i18n.t('common.exportPdf' as any)}</button>` : ''}
      </div>
    </div>

    ${tb ? `
    <div class="tb-balanced-banner ${tb.isBalanced ? 'ok' : 'err'}">
      ${tb.isBalanced ? Icons.check(16) : Icons.alertCircle(16)}
      <span>${tb.isBalanced
        ? i18n.t('accounting.trialBalance.balanced' as any)
        : i18n.t('accounting.trialBalance.outOfBalance' as any, { amount: formatCurrency(Math.abs(tb.totalDebits - tb.totalCredits)) })
      }</span>
    </div>` : ''}

    <div class="card">
      <div class="table-container" style="border:none;">
        <table class="data-table">
          <thead><tr>
            <th>${i18n.t('accounting.accounts.code' as any)}</th>
            <th>${i18n.t('accounting.accounts.name' as any)}</th>
            <th style="text-align:right;">${i18n.t('accounting.trialBalance.debitBalance' as any)}</th>
            <th style="text-align:right;">${i18n.t('accounting.trialBalance.creditBalance' as any)}</th>
          </tr></thead>
          <tbody>
            ${!tb || rows.length === 0
              ? `<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">${Icons.trialBalance(32)}</div><p class="empty-state-title">${i18n.t('common.noData')}</p></div></td></tr>`
              : Object.entries(grouped).flatMap(([type, typeRows]) => {
                  const subtotalDebit = typeRows.reduce((s, r) => s + r.debitBalance, 0);
                  const subtotalCredit = typeRows.reduce((s, r) => s + r.creditBalance, 0);
                  return [
                    `<tr class="fs-section-header"><td colspan="4">${i18n.t(`accounting.accounts.types.${type}` as any)}</td></tr>`,
                    ...typeRows.map((r) => `
                      <tr>
                        <td style="font-family:monospace;color:var(--color-primary);">${escapeHtml(r.accountCode)}</td>
                        <td>${escapeHtml(r.accountName)}</td>
                        <td style="text-align:right;">${r.debitBalance > 0 ? formatCurrency(r.debitBalance) : '—'}</td>
                        <td style="text-align:right;">${r.creditBalance > 0 ? formatCurrency(r.creditBalance) : '—'}</td>
                      </tr>`),
                    `<tr class="fs-subtotal">
                      <td colspan="2" style="text-align:right;color:var(--color-text-secondary);">${i18n.t(`accounting.accounts.types.${type}` as any)} ${i18n.t('common.total')}</td>
                      <td style="text-align:right;">${subtotalDebit > 0 ? formatCurrency(subtotalDebit) : '—'}</td>
                      <td style="text-align:right;">${subtotalCredit > 0 ? formatCurrency(subtotalCredit) : '—'}</td>
                    </tr>`,
                  ];
                }).join('')
            }
          </tbody>
          ${tb && rows.length > 0 ? `
          <tfoot>
            <tr class="fs-total">
              <td colspan="2" style="text-align:right;">${i18n.t('accounting.trialBalance.totalDebits' as any)} / ${i18n.t('accounting.trialBalance.totalCredits' as any)}</td>
              <td style="text-align:right;">${formatCurrency(tb.totalDebits)}</td>
              <td style="text-align:right;">${formatCurrency(tb.totalCredits)}</td>
            </tr>
          </tfoot>` : ''}
        </table>
        </div>
      </div>
    </div>
  `;
}

function buildPrintHTML(
  state: State,
  periods: ReturnType<typeof fiscalPeriodService.getAll>,
  companyName: string,
  periodName: string,
  lang: Language = 'en'
): string {
  const t = (key: Parameters<typeof i18n.t>[0], vars?: Record<string, string | number>) => i18n.tFor(lang, key, vars);
  const dir = i18n.getDirectionFor(lang);
  const tb = state.trialBalance!;
  const rows = state.showZero ? tb.rows : tb.rows.filter((r) => r.debitBalance > 0 || r.creditBalance > 0);
  const typeOrder: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

  const rowsHtml = typeOrder.flatMap((type) => {
    const typeRows = rows.filter((r) => r.accountType === type);
    if (typeRows.length === 0) return [];
    const subDebit = typeRows.reduce((s, r) => s + r.debitBalance, 0);
    const subCredit = typeRows.reduce((s, r) => s + r.creditBalance, 0);
    return [
      `<tr style="background:#f8f8f8;font-weight:700;"><td colspan="4" style="padding:6px 8px;">${t(`accounting.accounts.types.${type}` as any)}</td></tr>`,
      ...typeRows.map((r) => `<tr><td style="padding:4px 8px;font-family:monospace;">${escapeHtml(r.accountCode)}</td><td style="padding:4px 8px;">${escapeHtml(r.accountName)}</td><td style="text-align:right;padding:4px 8px;">${r.debitBalance > 0 ? formatCurrency(r.debitBalance) : '—'}</td><td style="text-align:right;padding:4px 8px;">${r.creditBalance > 0 ? formatCurrency(r.creditBalance) : '—'}</td></tr>`),
      `<tr style="font-weight:600;border-top:1px solid #ccc;"><td colspan="2" style="text-align:right;padding:4px 8px;">${t(`accounting.accounts.types.${type}` as any)} ${t('common.total')}</td><td style="text-align:right;padding:4px 8px;">${subDebit > 0 ? formatCurrency(subDebit) : '—'}</td><td style="text-align:right;padding:4px 8px;">${subCredit > 0 ? formatCurrency(subCredit) : '—'}</td></tr>`,
    ];
  }).join('');

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="utf-8"><title>Trial Balance</title>
  <style>
    body{font-family:Arial,sans-serif;color:#000;background:#fff;margin:0;padding:24px;}
    h1{font-size:18px;margin:0 0 4px;}h2{font-size:14px;margin:0 0 16px;color:#555;}
    table{width:100%;border-collapse:collapse;}
    th{background:#f0f0f0;padding:6px 8px;text-align:left;font-size:12px;border-bottom:2px solid #ccc;}
    td{font-size:12px;border-bottom:1px solid #eee;}
    tfoot td{font-weight:700;border-top:2px solid #000;font-size:13px;padding:6px 8px;}
    .footer{margin-top:24px;font-size:10px;color:#888;text-align:center;}
  </style></head><body>
  <h1>${companyName}</h1>
  <h2>${t('accounting.trialBalance.title' as any)} — ${periodName}</h2>
  <table>
    <thead><tr>
      <th>${t('accounting.accounts.code' as any)}</th>
      <th>${t('accounting.accounts.name' as any)}</th>
      <th style="text-align:right;">${t('accounting.trialBalance.debitBalance' as any)}</th>
      <th style="text-align:right;">${t('accounting.trialBalance.creditBalance' as any)}</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr>
      <td colspan="2" style="text-align:right;">${t('accounting.trialBalance.totalDebits' as any)} / ${t('accounting.trialBalance.totalCredits' as any)}</td>
      <td style="text-align:right;">${formatCurrency(tb.totalDebits)}</td>
      <td style="text-align:right;">${formatCurrency(tb.totalCredits)}</td>
    </tr></tfoot>
  </table>
  <div class="footer">${t('common.generatedBy')} · ${new Date().toLocaleDateString()}</div>
  </body></html>`;
}
