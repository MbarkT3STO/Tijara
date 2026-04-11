/**
 * Accounting Dashboard — overview of financial health.
 */

import { journalService } from '@services/journalService';
import { fiscalPeriodService } from '@services/fiscalPeriodService';
import { accountService } from '@services/accountService';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, escapeHtml } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';

export function renderAccounting(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  const stats = journalService.computeAccountingStats();
  const period = fiscalPeriodService.getCurrent();
  const tb = period ? journalService.computeTrialBalance(period.id) : null;
  const recentEntries = journalService.getPosted()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  const accounts = accountService.getAll();
  const topAccounts = accounts
    .filter((a) => a.isActive)
    .map((a) => ({ ...a, balance: journalService.getAccountBalance(a.id) }))
    .filter((a) => a.balance !== 0)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, 8);

  const STATUS_BADGE: Record<string, string> = {
    draft: 'badge-warning', posted: 'badge-success', reversed: 'badge-neutral',
  };

  page.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-header-icon">${Icons.accounting(22)}</div>
        <div>
          <h2 class="page-title">${i18n.t('accounting.dashboard.title' as any)}</h2>
          <p class="page-subtitle">${i18n.t('accounting.subtitle' as any)}</p>
        </div>
      </div>
      <div style="display:flex;gap:var(--space-2);">
        <button class="btn btn-secondary btn-sm" onclick="window.location.hash='#/journal'">
          ${Icons.journal(14)} ${i18n.t('accounting.journal.newEntry' as any)}
        </button>
        <button class="btn btn-primary btn-sm" onclick="window.location.hash='#/trial-balance'">
          ${Icons.trialBalance(14)} ${i18n.t('nav.trial-balance' as any)}
        </button>
      </div>
    </div>

    <!-- KPI Row 1 -->
    <div class="acc-kpi-grid">
      ${kpi(i18n.t('accounting.dashboard.totalAssets' as any), formatCurrency(stats.totalAssets), Icons.balanceSheet(), 'info')}
      ${kpi(i18n.t('accounting.dashboard.totalLiabilities' as any), formatCurrency(stats.totalLiabilities), Icons.alertCircle(), 'warning')}
      ${kpi(i18n.t('accounting.dashboard.netEquity' as any), formatCurrency(stats.totalEquity), Icons.accounting(), 'primary')}
      ${kpi(i18n.t('accounting.dashboard.cashBalance' as any), formatCurrency(stats.cashBalance), Icons.dollarSign(), 'success')}
      ${kpi(i18n.t('accounting.dashboard.accountsReceivable' as any), formatCurrency(stats.accountsReceivable), Icons.customers(), 'info')}
    </div>

    <!-- KPI Row 2 -->
    <div class="acc-kpi-grid" style="margin-top:0;">
      ${kpi(i18n.t('accounting.dashboard.monthRevenue' as any), formatCurrency(stats.currentMonthRevenue), Icons.incomeStatement(), 'success')}
      ${kpi(i18n.t('accounting.dashboard.monthExpenses' as any), formatCurrency(stats.currentMonthExpenses), Icons.trendDown(), 'error')}
      ${kpi(i18n.t('accounting.dashboard.netIncome' as any), formatCurrency(stats.currentMonthNetIncome), Icons.trendUp(), stats.currentMonthNetIncome >= 0 ? 'success' : 'error')}
      ${kpi(i18n.t('accounting.dashboard.accountsPayable' as any), formatCurrency(stats.accountsPayable), Icons.truck(), 'warning')}
    </div>

    <!-- Row 3: Recent Entries + Account Balances -->
    <div style="display:grid;grid-template-columns:1fr 340px;gap:var(--space-5);margin-bottom:var(--space-5);">
      <!-- Recent Journal Entries -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" style="display:flex;align-items:center;gap:var(--space-2);">${Icons.journal(16)} ${i18n.t('accounting.dashboard.recentEntries' as any)}</h3>
          <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/journal'">${i18n.t('dashboard.viewAll')} ${Icons.chevronRight(14)}</button>
        </div>
        <div class="table-container" style="border:none;border-radius:0;">
          <table class="data-table">
            <thead><tr>
              <th>${i18n.t('accounting.journal.entryNumber' as any)}</th>
              <th>${i18n.t('accounting.journal.date' as any)}</th>
              <th>${i18n.t('accounting.journal.description' as any)}</th>
              <th>${i18n.t('accounting.journal.debitTotal' as any)}</th>
              <th>${i18n.t('accounting.journal.status' as any)}</th>
            </tr></thead>
            <tbody>
              ${recentEntries.length === 0
                ? `<tr><td colspan="5" style="text-align:center;padding:var(--space-8);color:var(--color-text-tertiary);">${i18n.t('common.noData')}</td></tr>`
                : recentEntries.map((e) => `
                  <tr>
                    <td><span style="font-weight:600;color:var(--color-primary);">${escapeHtml(e.entryNumber)}</span></td>
                    <td style="color:var(--color-text-secondary);">${formatDate(e.date)}</td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(e.description)}</td>
                    <td><strong>${formatCurrency(e.totalDebit)}</strong></td>
                    <td><span class="badge ${STATUS_BADGE[e.status] ?? 'badge-neutral'}">${i18n.t(`accounting.journal.statuses.${e.status}` as any)}</span></td>
                  </tr>`).join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Account Balances -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" style="display:flex;align-items:center;gap:var(--space-2);">${Icons.ledger(16)} ${i18n.t('accounting.dashboard.topAccounts' as any)}</h3>
          <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/ledger'">${i18n.t('dashboard.viewAll')} ${Icons.chevronRight(14)}</button>
        </div>
        <div class="card-body" style="padding-top:var(--space-3);">
          ${topAccounts.length === 0
            ? `<div style="text-align:center;padding:var(--space-8);color:var(--color-text-tertiary);font-size:var(--font-size-sm);">${i18n.t('common.noData')}</div>`
            : topAccounts.map((a) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border-subtle);">
                <div>
                  <div style="font-size:var(--font-size-sm);font-weight:500;">${escapeHtml(a.code)} · ${escapeHtml(a.name)}</div>
                  <span class="badge badge-${a.type}" style="font-size:10px;">${i18n.t(`accounting.accounts.types.${a.type}` as any)}</span>
                </div>
                <div style="font-weight:600;font-size:var(--font-size-sm);color:${a.balance >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(a.balance)}</div>
              </div>`).join('')
          }
        </div>
      </div>
    </div>

    <!-- Row 4: Trial Balance Banner -->
    ${tb ? `
    <div class="tb-balanced-banner ${tb.isBalanced ? 'ok' : 'err'}">
      ${tb.isBalanced ? Icons.check(16) : Icons.alertCircle(16)}
      <span>
        ${tb.isBalanced
          ? i18n.t('accounting.dashboard.booksBalanced' as any)
          : i18n.t('accounting.dashboard.outOfBalance' as any, { amount: formatCurrency(Math.abs(tb.totalDebits - tb.totalCredits)) })
        }
      </span>
      ${period ? `<span style="margin-inline-start:auto;font-size:var(--font-size-xs);opacity:.7;">${period.name}</span>` : ''}
    </div>` : ''}
  `;

  injectStyles();
  return page;
}

function kpi(label: string, value: string, iconSvg: string, color: string): string {
  return `
    <div class="card stat-card">
      <div class="stat-card-icon" style="background:var(--color-${color}-subtle);color:var(--color-${color});">${iconSvg}</div>
      <div class="stat-card-value">${value}</div>
      <div class="stat-card-label">${label}</div>
    </div>`;
}

function injectStyles() {
  if (document.getElementById('acc-dashboard-styles')) return;
  const s = document.createElement('style');
  s.id = 'acc-dashboard-styles';
  s.textContent = `
    .acc-kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: var(--space-4);
      margin-bottom: var(--space-5);
    }
    @media (max-width: 1280px) { .acc-kpi-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 768px)  { .acc-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px)  { .acc-kpi-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(s);
}
