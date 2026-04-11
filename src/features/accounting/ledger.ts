/**
 * General Ledger feature page — split panel layout.
 */

import { journalService } from '@services/journalService';
import { accountService } from '@services/accountService';
import { fiscalPeriodService } from '@services/fiscalPeriodService';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, escapeHtml } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import type { Account, AccountType } from '@core/types';

interface State {
  selectedAccountId: string;
  startDate: string;
  endDate: string;
}

export function renderLedger(): HTMLElement {
  const period = fiscalPeriodService.getCurrent();
  const state: State = {
    selectedAccountId: '',
    startDate: period?.startDate?.slice(0, 10) ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    endDate: period?.endDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  };

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    page.querySelectorAll<HTMLButtonElement>('[data-account]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedAccountId = btn.getAttribute('data-account')!;
        render();
      });
    });

    page.querySelector<HTMLInputElement>('#ledger-start')?.addEventListener('change', (e) => {
      state.startDate = (e.target as HTMLInputElement).value;
      render();
    });

    page.querySelector<HTMLInputElement>('#ledger-end')?.addEventListener('change', (e) => {
      state.endDate = (e.target as HTMLInputElement).value;
      render();
    });
  }

  render();
  return page;
}

function buildHTML(state: State): string {
  const accounts = accountService.getAll().sort((a, b) => a.code.localeCompare(b.code));
  const grouped = groupByType(accounts);
  const selectedAccount = state.selectedAccountId ? accountService.getById(state.selectedAccountId) : null;

  const startIso = state.startDate ? new Date(state.startDate).toISOString() : undefined;
  const endIso = state.endDate ? new Date(state.endDate + 'T23:59:59').toISOString() : undefined;

  const ledgerEntries = selectedAccount
    ? journalService.getLedgerEntries(selectedAccount.id, startIso, endIso)
    : [];

  const openingBalance = selectedAccount && startIso
    ? journalService.getAccountBalance(selectedAccount.id, startIso)
    : 0;

  const totalDebits = ledgerEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredits = ledgerEntries.reduce((s, e) => s + e.credit, 0);
  const closingBalance = ledgerEntries.length > 0
    ? ledgerEntries[ledgerEntries.length - 1].balance
    : openingBalance;

  // Pre-compute all account balances in a single pass for the sidebar
  const allPosted = journalService.getPosted();
  const aggMap = new Map<string, { debits: number; credits: number }>();
  for (const entry of allPosted) {
    for (const line of entry.lines) {
      const cur = aggMap.get(line.accountId) ?? { debits: 0, credits: 0 };
      aggMap.set(line.accountId, {
        debits: cur.debits + line.debit,
        credits: cur.credits + line.credit,
      });
    }
  }

  const getBalanceFast = (accountId: string): number => {
    const acc = accountService.getById(accountId);
    if (!acc) return 0;
    const { debits = 0, credits = 0 } = aggMap.get(accountId) ?? {};
    return acc.normalBalance === 'debit' ? debits - credits : credits - debits;
  };

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('accounting.ledger.title' as any)}</h2>
      </div>
    </div>

    <div class="ledger-layout">
      <!-- Left: Account List -->
      <div class="ledger-accounts-panel">
        ${Object.entries(grouped).map(([type, accs]) => `
          <div style="padding:var(--space-2) var(--space-3);background:var(--color-bg-secondary);border-bottom:1px solid var(--color-border);">
            <span class="badge badge-${type}" style="font-size:10px;">${i18n.t(`accounting.accounts.types.${type}` as any)}</span>
          </div>
          ${accs.map((a) => {
            const balance = getBalanceFast(a.id);
            const isSelected = state.selectedAccountId === a.id;
            return `
              <button data-account="${a.id}" class="btn btn-ghost" style="width:100%;text-align:start;border-radius:0;padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--color-border-subtle);${isSelected ? 'background:var(--color-primary-subtle);color:var(--color-primary);' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
                  <div>
                    <div style="font-size:var(--font-size-xs);font-weight:600;font-family:monospace;">${escapeHtml(a.code)}</div>
                    <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">${escapeHtml(a.name)}</div>
                  </div>
                  <div style="font-size:var(--font-size-xs);font-weight:600;color:${balance >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(balance)}</div>
                </div>
              </button>`;
          }).join('')}
        `).join('')}
      </div>

      <!-- Right: Ledger Detail -->
      <div class="ledger-detail-panel">
        ${!selectedAccount
          ? `<div class="empty-state"><div class="empty-state-icon">${Icons.ledger(32)}</div><p class="empty-state-title">${i18n.t('accounting.ledger.selectAccount' as any)}</p></div>`
          : `
            <!-- Account Header -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-5);padding-bottom:var(--space-4);border-bottom:1px solid var(--color-border);">
              <div>
                <div style="display:flex;align-items:center;gap:var(--space-3);">
                  <span style="font-family:monospace;font-size:var(--font-size-xl);font-weight:700;color:var(--color-primary);">${selectedAccount.code}</span>
                  <span class="badge badge-${selectedAccount.type}">${i18n.t(`accounting.accounts.types.${selectedAccount.type}` as any)}</span>
                  <span class="badge ${selectedAccount.normalBalance === 'debit' ? 'badge-info' : 'badge-primary'}">${i18n.t(`accounting.accounts.normalBalances.${selectedAccount.normalBalance}` as any)}</span>
                </div>
                <div style="font-size:var(--font-size-lg);font-weight:600;margin-top:var(--space-1);">${escapeHtml(selectedAccount.name)}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">${i18n.t('accounting.ledger.runningBalance' as any)}</div>
                <div style="font-size:var(--font-size-2xl);font-weight:700;color:${closingBalance >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(closingBalance)}</div>
              </div>
            </div>

            <!-- Date Range Filter -->
            <div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap;">
              <div class="form-group" style="flex:1;min-width:140px;">
                <label class="form-label">${i18n.t('common.date')} ${i18n.t('common.showing' as any)}</label>
                <input type="date" id="ledger-start" class="form-control" value="${state.startDate}" />
              </div>
              <div class="form-group" style="flex:1;min-width:140px;">
                <label class="form-label">${i18n.t('common.to')}</label>
                <input type="date" id="ledger-end" class="form-control" value="${state.endDate}" />
              </div>
            </div>

            <!-- Ledger Table -->
            <div class="table-container">
              <table class="data-table">
                <thead><tr>
                  <th>${i18n.t('accounting.journal.date' as any)}</th>
                  <th>${i18n.t('accounting.journal.entryNumber' as any)}</th>
                  <th>${i18n.t('accounting.journal.description' as any)}</th>
                  <th style="text-align:right;">${i18n.t('accounting.journal.debit' as any)}</th>
                  <th style="text-align:right;">${i18n.t('accounting.journal.credit' as any)}</th>
                  <th style="text-align:right;">${i18n.t('accounting.ledger.runningBalance' as any)}</th>
                </tr></thead>
                <tbody>
                  <!-- Opening Balance -->
                  <tr style="background:var(--color-bg-secondary);font-style:italic;color:var(--color-text-secondary);">
                    <td colspan="3">${i18n.t('accounting.ledger.openingBalance' as any)}</td>
                    <td></td><td></td>
                    <td style="text-align:right;font-weight:600;">${formatCurrency(openingBalance)}</td>
                  </tr>
                  ${ledgerEntries.length === 0
                    ? `<tr><td colspan="6" style="text-align:center;padding:var(--space-8);color:var(--color-text-tertiary);">${i18n.t('common.noData')}</td></tr>`
                    : ledgerEntries.map((e) => `
                      <tr>
                        <td style="color:var(--color-text-secondary);">${formatDate(e.date)}</td>
                        <td><span style="font-weight:600;color:var(--color-primary);">${escapeHtml(e.entryNumber)}</span></td>
                        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(e.description)}</td>
                        <td style="text-align:right;">${e.debit > 0 ? formatCurrency(e.debit) : '—'}</td>
                        <td style="text-align:right;">${e.credit > 0 ? formatCurrency(e.credit) : '—'}</td>
                        <td style="text-align:right;font-weight:600;color:${e.balance >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(e.balance)}</td>
                      </tr>`).join('')
                  }
                  <!-- Closing Balance -->
                  <tr style="background:var(--color-bg-secondary);font-weight:700;border-top:2px solid var(--color-border);">
                    <td colspan="3">${i18n.t('accounting.ledger.closingBalance' as any)}</td>
                    <td style="text-align:right;">${formatCurrency(totalDebits)}</td>
                    <td style="text-align:right;">${formatCurrency(totalCredits)}</td>
                    <td style="text-align:right;color:${closingBalance >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(closingBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Footer Totals -->
            <div style="display:flex;gap:var(--space-6);margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--color-border);font-size:var(--font-size-sm);">
              <div><span style="color:var(--color-text-secondary);">${i18n.t('accounting.ledger.totalDebits' as any)}: </span><strong>${formatCurrency(totalDebits)}</strong></div>
              <div><span style="color:var(--color-text-secondary);">${i18n.t('accounting.ledger.totalCredits' as any)}: </span><strong>${formatCurrency(totalCredits)}</strong></div>
              <div><span style="color:var(--color-text-secondary);">${i18n.t('accounting.ledger.netChange' as any)}: </span><strong style="color:${(totalDebits - totalCredits) >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(totalDebits - totalCredits)}</strong></div>
            </div>
          `
        }
      </div>
    </div>
  `;
}

function groupByType(accounts: Account[]): Record<string, Account[]> {
  const order: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];
  const result: Record<string, Account[]> = {};
  for (const type of order) {
    const accs = accounts.filter((a) => a.type === type);
    if (accs.length > 0) result[type] = accs;
  }
  return result;
}
