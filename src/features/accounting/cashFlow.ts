/**
 * Cash Flow Statement feature page.
 */

import { journalService } from '@services/journalService';
import { Icons } from '@shared/components/icons';
import { formatCurrency, escapeHtml } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import type { CashFlowStatement } from '@core/types';

interface State {
  startDate: string;
  endDate: string;
  statement: CashFlowStatement | null;
}

export function renderCashFlow(): HTMLElement {
  const now = new Date();
  const state: State = {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
    statement: null,
  };

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function generate() {
    state.statement = journalService.computeCashFlowStatement(
      new Date(state.startDate).toISOString(),
      new Date(state.endDate + 'T23:59:59').toISOString()
    );
    render();
  }

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    page.querySelector<HTMLInputElement>('#cf-start')?.addEventListener('change', (e) => { state.startDate = (e.target as HTMLInputElement).value; });
    page.querySelector<HTMLInputElement>('#cf-end')?.addEventListener('change', (e) => { state.endDate = (e.target as HTMLInputElement).value; });
    page.querySelector('#cf-generate')?.addEventListener('click', generate);
  }

  generate();
  return page;
}

function buildHTML(state: State): string {
  const s = state.statement;

  const buildSection = (items: { description: string; amount: number }[]) =>
    items.map((item) => `
      <tr>
        <td style="padding-inline-start:var(--space-8);">${escapeHtml(item.description)}</td>
        <td style="text-align:right;color:${item.amount >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(item.amount)}</td>
      </tr>`).join('');

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('accounting.cashFlow.title' as any)}</h2>
      </div>
      <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap;">
        <input type="date" id="cf-start" class="form-control" value="${state.startDate}" style="width:auto;" />
        <span style="color:var(--color-text-secondary);">${i18n.t('common.to')}</span>
        <input type="date" id="cf-end" class="form-control" value="${state.endDate}" style="width:auto;" />
        <button class="btn btn-primary" id="cf-generate">${Icons.cashFlow(14)} ${i18n.t('common.filter')}</button>
      </div>
    </div>

    ${!s ? `<div class="card"><div class="empty-state"><div class="empty-state-icon">${Icons.cashFlow(32)}</div><p class="empty-state-title">${i18n.t('common.noData')}</p></div></div>` : `
    <div class="card">
      <div class="card-body">
        <div class="fs-title">${i18n.t('accounting.cashFlow.title' as any)}</div>
        <div class="fs-subtitle">${state.startDate} — ${state.endDate}</div>

        <table class="data-table" style="width:100%;">
          <tbody>
            <!-- Operating -->
            <tr class="fs-section-header"><td colspan="2">${i18n.t('accounting.cashFlow.operating' as any)}</td></tr>
            ${buildSection(s.operatingActivities)}
            <tr class="fs-subtotal">
              <td>${i18n.t('accounting.cashFlow.netOperating' as any)}</td>
              <td style="text-align:right;color:${s.netOperatingCashFlow >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(s.netOperatingCashFlow)}</td>
            </tr>

            <!-- Investing -->
            <tr class="fs-section-header"><td colspan="2">${i18n.t('accounting.cashFlow.investing' as any)}</td></tr>
            ${s.investingActivities.length > 0 ? buildSection(s.investingActivities) : '<tr><td colspan="2" style="padding-inline-start:var(--space-8);color:var(--color-text-tertiary);">—</td></tr>'}
            <tr class="fs-subtotal">
              <td>${i18n.t('accounting.cashFlow.netInvesting' as any)}</td>
              <td style="text-align:right;color:${s.netInvestingCashFlow >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(s.netInvestingCashFlow)}</td>
            </tr>

            <!-- Financing -->
            <tr class="fs-section-header"><td colspan="2">${i18n.t('accounting.cashFlow.financing' as any)}</td></tr>
            ${s.financingActivities.length > 0 ? buildSection(s.financingActivities) : '<tr><td colspan="2" style="padding-inline-start:var(--space-8);color:var(--color-text-tertiary);">—</td></tr>'}
            <tr class="fs-subtotal">
              <td>${i18n.t('accounting.cashFlow.netFinancing' as any)}</td>
              <td style="text-align:right;color:${s.netFinancingCashFlow >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(s.netFinancingCashFlow)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="fs-total">
              <td>${i18n.t('accounting.cashFlow.netChange' as any)}</td>
              <td style="text-align:right;color:${s.netChangeInCash >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(s.netChangeInCash)}</td>
            </tr>
            <tr>
              <td style="padding:var(--space-2) var(--space-4);color:var(--color-text-secondary);">${i18n.t('accounting.cashFlow.openingCash' as any)}</td>
              <td style="text-align:right;padding:var(--space-2) var(--space-4);">${formatCurrency(s.openingCash)}</td>
            </tr>
            <tr style="background:var(--color-primary-subtle);">
              <td style="padding:var(--space-3) var(--space-4);font-weight:700;">${i18n.t('accounting.cashFlow.closingCash' as any)}</td>
              <td style="text-align:right;padding:var(--space-3) var(--space-4);font-weight:700;color:${s.closingCash >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(s.closingCash)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>`}
  `;
}
