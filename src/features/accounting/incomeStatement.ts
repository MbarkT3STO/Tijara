/**
 * Income Statement (P&L) feature page.
 */

import { journalService } from '@services/journalService';
import { Icons } from '@shared/components/icons';
import { formatCurrency, exportReportPDF, escapeHtml } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import type { Language } from '@core/i18n/types';
import { profileService } from '@services/profileService';
import type { IncomeStatement } from '@core/types';

interface State {
  startDate: string;
  endDate: string;
  statement: IncomeStatement | null;
}

export function renderIncomeStatement(): HTMLElement {
  const now = new Date();
  const state: State = {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
    statement: null,
  };

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function generate() {
    state.statement = journalService.computeIncomeStatement(
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
    page.querySelector<HTMLInputElement>('#is-start')?.addEventListener('change', (e) => { state.startDate = (e.target as HTMLInputElement).value; });
    page.querySelector<HTMLInputElement>('#is-end')?.addEventListener('change', (e) => { state.endDate = (e.target as HTMLInputElement).value; });
    page.querySelector('#is-generate')?.addEventListener('click', generate);
    page.querySelector('#is-export-pdf')?.addEventListener('click', () => {
      if (!state.statement) return;
      const profile = profileService.get();
      const pdfLang = (profile.defaultPdfLanguage as Language) ?? 'en';
      const html = buildPrintHTML(state, profile.name, pdfLang);
      exportReportPDF(html, `income-statement-${state.startDate}-${state.endDate}.pdf`).catch(console.error);
    });
  }

  generate();
  return page;
}

function buildHTML(state: State): string {
  const s = state.statement;

  const fmtAmt = (n: number) => {
    if (n < 0) return `<span class="fs-amount-negative">(${formatCurrency(Math.abs(n))})</span>`;
    return formatCurrency(n);
  };

  const buildRows = (rows: { accountCode: string; accountName: string; amount: number; percentage?: number }[]) =>
    rows.map((r) => `
      <tr>
        <td style="padding-inline-start:var(--space-8);">${escapeHtml(r.accountCode)} · ${escapeHtml(r.accountName)}</td>
        <td style="text-align:right;">${fmtAmt(r.amount)}</td>
        ${r.percentage !== undefined ? `<td style="text-align:right;color:var(--color-text-tertiary);font-size:var(--font-size-xs);">${r.percentage.toFixed(1)}%</td>` : '<td></td>'}
      </tr>`).join('');

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('accounting.incomeStatement.title' as any)}</h2>
      </div>
      <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap;">
        <input type="date" id="is-start" class="form-control" value="${state.startDate}" style="width:auto;" />
        <span style="color:var(--color-text-secondary);">${i18n.t('common.to')}</span>
        <input type="date" id="is-end" class="form-control" value="${state.endDate}" style="width:auto;" />
        <button class="btn btn-primary" id="is-generate">${Icons.trendUp(14)} ${i18n.t('common.filter')}</button>
        ${s ? `<button class="btn btn-secondary" id="is-export-pdf">${Icons.fileText(14)} ${i18n.t('common.exportPdf' as any)}</button>` : ''}
      </div>
    </div>

    ${!s ? `<div class="card"><div class="empty-state"><div class="empty-state-icon">${Icons.incomeStatement(32)}</div><p class="empty-state-title">${i18n.t('common.noData')}</p></div></div>` : `
    <div class="card">
      <div class="card-body">
        <div class="fs-title">${i18n.t('accounting.incomeStatement.title' as any)}</div>
        <div class="fs-subtitle">${state.startDate} — ${state.endDate}</div>

        <table class="data-table" style="width:100%;">
          <thead><tr>
            <th>${i18n.t('accounting.accounts.name' as any)}</th>
            <th style="text-align:right;">${i18n.t('common.amount')}</th>
            <th style="text-align:right;">%</th>
          </tr></thead>
          <tbody>
            <!-- Revenue -->
            <tr class="fs-section-header"><td colspan="3">${i18n.t('accounting.incomeStatement.revenue' as any)}</td></tr>
            ${buildRows(s.revenue)}
            <tr class="fs-subtotal">
              <td>${i18n.t('accounting.incomeStatement.totalRevenue' as any)}</td>
              <td style="text-align:right;">${fmtAmt(s.revenue.reduce((x, r) => x + r.amount, 0))}</td>
              <td></td>
            </tr>

            <!-- COGS -->
            <tr class="fs-section-header"><td colspan="3">${i18n.t('accounting.incomeStatement.cogs' as any)}</td></tr>
            ${buildRows(s.costOfGoodsSold)}
            <tr class="fs-subtotal">
              <td>${i18n.t('accounting.incomeStatement.grossProfit' as any)}</td>
              <td style="text-align:right;">${fmtAmt(s.grossProfit)}</td>
              <td style="text-align:right;color:var(--color-text-tertiary);font-size:var(--font-size-xs);">${s.grossProfitMargin.toFixed(1)}%</td>
            </tr>

            <!-- Operating Expenses -->
            <tr class="fs-section-header"><td colspan="3">${i18n.t('accounting.incomeStatement.operatingExpenses' as any)}</td></tr>
            ${buildRows(s.operatingExpenses)}
            <tr class="fs-subtotal">
              <td>${i18n.t('accounting.incomeStatement.totalOpEx' as any)}</td>
              <td style="text-align:right;">${fmtAmt(s.operatingExpenses.reduce((x, r) => x + r.amount, 0))}</td>
              <td></td>
            </tr>
            <tr class="fs-subtotal">
              <td>${i18n.t('accounting.incomeStatement.operatingIncome' as any)}</td>
              <td style="text-align:right;">${fmtAmt(s.operatingIncome)}</td>
              <td></td>
            </tr>

            <!-- Other Income/Expenses -->
            ${s.otherIncome.length > 0 ? `
            <tr class="fs-section-header"><td colspan="3">${i18n.t('accounting.incomeStatement.otherIncome' as any)}</td></tr>
            ${buildRows(s.otherIncome)}` : ''}
            ${s.otherExpenses.length > 0 ? `
            <tr class="fs-section-header"><td colspan="3">${i18n.t('accounting.incomeStatement.otherExpenses' as any)}</td></tr>
            ${buildRows(s.otherExpenses)}` : ''}

            <tr class="fs-subtotal">
              <td>${i18n.t('accounting.incomeStatement.incomeBeforeTax' as any)}</td>
              <td style="text-align:right;">${fmtAmt(s.incomeBeforeTax)}</td>
              <td></td>
            </tr>
            <tr>
              <td style="padding-inline-start:var(--space-8);">${i18n.t('accounting.incomeStatement.taxExpense' as any)}</td>
              <td style="text-align:right;">${fmtAmt(s.taxExpense)}</td>
              <td></td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="fs-total">
              <td>${i18n.t('accounting.incomeStatement.netIncome' as any)}</td>
              <td style="text-align:right;color:${s.netIncome >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${fmtAmt(s.netIncome)}</td>
              <td style="text-align:right;color:var(--color-text-tertiary);font-size:var(--font-size-xs);">${s.netProfitMargin.toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>`}
  `;
}

function buildPrintHTML(state: State, companyName: string, lang: Language = 'en'): string {
  const t = (key: Parameters<typeof i18n.t>[0], vars?: Record<string, string | number>) => i18n.tFor(lang, key, vars);
  const dir = i18n.getDirectionFor(lang);
  const s = state.statement!;
  const fmtAmt = (n: number) => n < 0 ? `(${formatCurrency(Math.abs(n))})` : formatCurrency(n);
  const buildRows = (rows: { accountCode: string; accountName: string; amount: number }[]) =>
    rows.map((r) => `<tr><td style="padding:4px 8px 4px 24px;">${escapeHtml(r.accountCode)} · ${escapeHtml(r.accountName)}</td><td style="text-align:right;padding:4px 8px;">${fmtAmt(r.amount)}</td><td></td></tr>`).join('');

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="utf-8"><title>Income Statement</title>
  <style>
    body{font-family:Arial,sans-serif;color:#000;background:#fff;margin:0;padding:24px;}
    h1{font-size:18px;margin:0 0 4px;}h2{font-size:14px;margin:0 0 16px;color:#555;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;}
    th{background:#f0f0f0;padding:6px 8px;text-align:left;font-size:12px;border-bottom:2px solid #ccc;}
    td{font-size:12px;border-bottom:1px solid #eee;padding:4px 8px;}
    .section-header td{background:#f8f8f8;font-weight:700;}
    .subtotal td{font-weight:600;border-top:1px solid #ccc;}
    .total td{font-weight:700;border-top:2px solid #000;font-size:13px;}
    .footer{margin-top:24px;font-size:10px;color:#888;text-align:center;}
  </style></head><body>
  <h1>${companyName}</h1>
  <h2>${t('accounting.incomeStatement.title' as any)} — ${state.startDate} ${t('common.to')} ${state.endDate}</h2>
  <table>
    <thead><tr><th>${t('accounting.accounts.name' as any)}</th><th style="text-align:right;">${t('common.amount')}</th><th style="text-align:right;">%</th></tr></thead>
    <tbody>
      <tr class="section-header"><td colspan="3">${t('accounting.incomeStatement.revenue' as any)}</td></tr>
      ${buildRows(s.revenue)}
      <tr class="subtotal"><td>${t('accounting.incomeStatement.totalRevenue' as any)}</td><td style="text-align:right;">${fmtAmt(s.revenue.reduce((x,r)=>x+r.amount,0))}</td><td></td></tr>
      <tr class="section-header"><td colspan="3">${t('accounting.incomeStatement.cogs' as any)}</td></tr>
      ${buildRows(s.costOfGoodsSold)}
      <tr class="subtotal"><td>${t('accounting.incomeStatement.grossProfit' as any)}</td><td style="text-align:right;">${fmtAmt(s.grossProfit)}</td><td style="text-align:right;">${s.grossProfitMargin.toFixed(1)}%</td></tr>
      <tr class="section-header"><td colspan="3">${t('accounting.incomeStatement.operatingExpenses' as any)}</td></tr>
      ${buildRows(s.operatingExpenses)}
      <tr class="subtotal"><td>${t('accounting.incomeStatement.operatingIncome' as any)}</td><td style="text-align:right;">${fmtAmt(s.operatingIncome)}</td><td></td></tr>
      ${s.otherIncome.length > 0 ? `<tr class="section-header"><td colspan="3">${t('accounting.incomeStatement.otherIncome' as any)}</td></tr>${buildRows(s.otherIncome)}` : ''}
      ${s.otherExpenses.length > 0 ? `<tr class="section-header"><td colspan="3">${t('accounting.incomeStatement.otherExpenses' as any)}</td></tr>${buildRows(s.otherExpenses)}` : ''}
      <tr class="subtotal"><td>${t('accounting.incomeStatement.incomeBeforeTax' as any)}</td><td style="text-align:right;">${fmtAmt(s.incomeBeforeTax)}</td><td></td></tr>
      <tr><td style="padding-left:24px;">${t('accounting.incomeStatement.taxExpense' as any)}</td><td style="text-align:right;">${fmtAmt(s.taxExpense)}</td><td></td></tr>
    </tbody>
    <tfoot>
      <tr class="total"><td>${t('accounting.incomeStatement.netIncome' as any)}</td><td style="text-align:right;">${fmtAmt(s.netIncome)}</td><td style="text-align:right;">${s.netProfitMargin.toFixed(1)}%</td></tr>
    </tfoot>
  </table>
  <div class="footer">${t('common.generatedBy')} · ${new Date().toLocaleDateString()}</div>
  </body></html>`;
}
