/**
 * Trial Balance feature page.
 */

import { journalService } from '@services/journalService';
import { fiscalPeriodService } from '@services/fiscalPeriodService';
import { Icons } from '@shared/components/icons';
import { formatCurrency } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
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
                        <td style="font-family:monospace;color:var(--color-primary);">${r.accountCode}</td>
                        <td>${r.accountName}</td>
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
  `;
}
