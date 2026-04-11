/**
 * Tax / VAT Report feature page.
 */

import { journalService } from '@services/journalService';
import { Icons } from '@shared/components/icons';
import { formatCurrency } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import type { TaxReport } from '@core/types';

interface State {
  startDate: string;
  endDate: string;
  report: TaxReport | null;
}

export function renderTaxReport(): HTMLElement {
  const now = new Date();
  const state: State = {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
    report: null,
  };

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function generate() {
    state.report = journalService.computeTaxReport(
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
    page.querySelector<HTMLInputElement>('#tr-start')?.addEventListener('change', (e) => { state.startDate = (e.target as HTMLInputElement).value; });
    page.querySelector<HTMLInputElement>('#tr-end')?.addEventListener('change', (e) => { state.endDate = (e.target as HTMLInputElement).value; });
    page.querySelector('#tr-generate')?.addEventListener('click', generate);
  }

  generate();
  return page;
}

function buildHTML(state: State): string {
  const r = state.report;

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('accounting.taxReport.title' as any)}</h2>
      </div>
      <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap;">
        <input type="date" id="tr-start" class="form-control" value="${state.startDate}" style="width:auto;" />
        <span style="color:var(--color-text-secondary);">${i18n.t('common.to')}</span>
        <input type="date" id="tr-end" class="form-control" value="${state.endDate}" style="width:auto;" />
        <button class="btn btn-primary" id="tr-generate">${Icons.fileText(14)} ${i18n.t('common.filter')}</button>
      </div>
    </div>

    ${r ? `
    <!-- Summary Cards -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-4);margin-bottom:var(--space-6);">
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-info-subtle);color:var(--color-info);">${Icons.dollarSign()}</div>
        <div class="stat-card-value">${formatCurrency(r.totalTaxableAmount)}</div>
        <div class="stat-card-label">${i18n.t('accounting.taxReport.totalTaxable' as any)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-warning-subtle);color:var(--color-warning);">${Icons.dollarSign()}</div>
        <div class="stat-card-value">${formatCurrency(r.totalTaxAmount)}</div>
        <div class="stat-card-label">${i18n.t('accounting.taxReport.totalTax' as any)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-card-icon" style="background:var(--color-error-subtle);color:var(--color-error);">${Icons.alertCircle()}</div>
        <div class="stat-card-value">${formatCurrency(r.totalTaxAmount)}</div>
        <div class="stat-card-label">${i18n.t('accounting.taxReport.taxPayable' as any)}</div>
      </div>
    </div>` : ''}

    <div class="card">
      <div class="table-container" style="border:none;">
        <table class="data-table">
          <thead><tr>
            <th>${i18n.t('accounting.accounts.code' as any)}</th>
            <th>${i18n.t('accounting.accounts.name' as any)}</th>
            <th style="text-align:right;">${i18n.t('accounting.taxReport.taxableAmount' as any)}</th>
            <th style="text-align:right;">Rate %</th>
            <th style="text-align:right;">${i18n.t('accounting.taxReport.taxAmount' as any)}</th>
          </tr></thead>
          <tbody>
            ${!r || r.lines.length === 0
              ? `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">${Icons.fileText(32)}</div><p class="empty-state-title">${i18n.t('common.noData')}</p></div></td></tr>`
              : r.lines.map((l) => `
                <tr>
                  <td style="font-family:monospace;color:var(--color-primary);">${l.taxCode}</td>
                  <td>${l.taxName}</td>
                  <td style="text-align:right;">${formatCurrency(l.taxableAmount)}</td>
                  <td style="text-align:right;">${l.taxRate}%</td>
                  <td style="text-align:right;font-weight:600;">${formatCurrency(l.taxAmount)}</td>
                </tr>`).join('')
            }
          </tbody>
          ${r && r.lines.length > 0 ? `
          <tfoot>
            <tr class="fs-total">
              <td colspan="2">${i18n.t('common.total')}</td>
              <td style="text-align:right;">${formatCurrency(r.totalTaxableAmount)}</td>
              <td></td>
              <td style="text-align:right;">${formatCurrency(r.totalTaxAmount)}</td>
            </tr>
          </tfoot>` : ''}
        </table>
      </div>
    </div>

    ${r && r.lines.length > 0 ? buildTvaDeclaration(r) : ''}
  `;
}

function buildTvaDeclaration(r: TaxReport): string {
  // TVA collectée: accounts >= 4440 (output VAT) or lines tagged 'collect'
  const tvaCollectee = r.lines
    .filter((l) => l.taxCode.toLowerCase().includes('collect') || parseFloat(l.taxCode) >= 4440)
    .reduce((s, l) => s + l.taxAmount, 0);

  // TVA déductible: accounts >= 3450 (input VAT) or lines tagged 'recup'
  const tvaDeductible = r.lines
    .filter((l) => l.taxCode.toLowerCase().includes('recup') || (parseFloat(l.taxCode) >= 3450 && parseFloat(l.taxCode) < 4440))
    .reduce((s, l) => s + l.taxAmount, 0);

  // Fallback: if no lines match the filter, use totals directly
  const effectiveCollectee = tvaCollectee > 0 ? tvaCollectee : r.totalTaxAmount;
  const effectiveDeductible = tvaDeductible;
  const tvaAPayer = effectiveCollectee - effectiveDeductible;

  return `
    <div class="card" style="margin-top:var(--space-5);">
      <div class="card-header">
        <h3 class="card-title">${i18n.t('accounting.taxReport.declarationTitle' as any)}</h3>
        <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">
          ${i18n.t('accounting.taxReport.declarationSubtitle' as any)}
        </span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-4);padding:var(--space-4);">
        <div class="card stat-card">
          <div class="stat-card-label">${i18n.t('accounting.taxReport.tvaCollectee' as any)}</div>
          <div class="stat-card-value">${formatCurrency(effectiveCollectee)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-card-label">${i18n.t('accounting.taxReport.tvaDeductible' as any)}</div>
          <div class="stat-card-value">${formatCurrency(effectiveDeductible)}</div>
        </div>
        <div class="card stat-card" style="border-color:${tvaAPayer > 0 ? 'var(--color-error)' : 'var(--color-success)'};">
          <div class="stat-card-label">${i18n.t('accounting.taxReport.tvaAPayer' as any)}</div>
          <div class="stat-card-value" style="color:${tvaAPayer > 0 ? 'var(--color-error)' : 'var(--color-success)'};">
            ${formatCurrency(Math.abs(tvaAPayer))}
          </div>
          ${tvaAPayer < 0 ? `<div style="font-size:var(--font-size-xs);color:var(--color-success);">${i18n.t('accounting.taxReport.tvaCredit' as any)}</div>` : ''}
        </div>
      </div>
    </div>`;
}
