/**
 * Reports & Analytics feature page.
 * Revenue trends, category breakdown, top customers, top products.
 */

import { reportsService } from '@services/reportsService';
import { invoiceService } from '@services/invoiceService';
import { purchaseService } from '@services/purchaseService';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, formatPercent, escapeHtml } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import { router } from '@core/router';

export function renderReports(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  // Default: last 12 months
  let monthRange = 12;

  function render() {
    page.innerHTML = buildHTML(monthRange);
    attachEvents();
  }

  function attachEvents() {
    page.querySelectorAll<HTMLButtonElement>('[data-range]').forEach((btn) => {
      btn.addEventListener('click', () => {
        monthRange = parseInt(btn.getAttribute('data-range')!, 10);
        render();
      });
    });

    // Wire data-navigate buttons
    page.querySelectorAll<HTMLButtonElement>('[data-navigate]').forEach((btn) => {
      btn.addEventListener('click', () => {
        router.navigate(btn.getAttribute('data-navigate') as any);
      });
    });
  }

  render();
  return page;
}

function buildHTML(monthRange: number): string {
  const summary = reportsService.getSummary();
  const monthly = reportsService.getMonthlyRevenue(monthRange);
  const categories = reportsService.getCategorySales();
  const topCustomers = reportsService.getTopCustomers(8);
  const topProducts = reportsService.getTopProducts(8);

  const profitMargin = summary.totalRevenue > 0
    ? (summary.totalProfit / summary.totalRevenue) * 100
    : 0;

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('reports.title')}</h2>
        <p class="page-subtitle">${i18n.t('reports.subtitle')}</p>
      </div>
      <div class="toolbar">
        ${[3, 6, 12].map((r) => `
          <button class="btn ${monthRange === r ? 'btn-primary' : 'btn-secondary'} btn-sm" data-range="${r}">
            ${r}M
          </button>`).join('')}
      </div>
    </div>

    <!-- Summary KPIs -->
    <div class="reports-kpi-grid">
      ${buildKpi(i18n.t('reports.kpis.totalRevenue'), formatCurrency(summary.totalRevenue), Icons.dollarSign(), 'primary')}
      ${buildKpi(i18n.t('reports.kpis.totalProfit'), formatCurrency(summary.totalProfit), Icons.trendUp(), summary.totalProfit >= 0 ? 'success' : 'error')}
      ${buildKpi(i18n.t('reports.kpis.profitMargin'), formatPercent(profitMargin, 1, false), Icons.pieChart(), profitMargin >= 20 ? 'success' : profitMargin >= 10 ? 'warning' : 'error')}
      ${buildKpi(i18n.t('reports.kpis.totalOrders'), String(summary.totalOrders), Icons.shoppingCart(), 'info')}
      ${buildKpi(i18n.t('reports.kpis.avgOrderValue'), formatCurrency(summary.avgOrderValue), Icons.barChart(), 'primary')}
      ${buildKpi(i18n.t('reports.kpis.purchaseSpend'), formatCurrency(summary.totalPurchaseSpend), Icons.truck(), 'warning')}
      ${buildKpi(i18n.t('reports.kpis.newCustomers'), String(summary.newCustomers), Icons.customers(), 'success')}
    </div>

    <!-- Revenue Chart + Category Breakdown -->
    <div class="reports-main-grid">

      <!-- Revenue trend (CSS bar chart) -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" style="display:flex;align-items:center;gap:var(--space-2);">${Icons.barChart(16)} ${i18n.t('reports.revenueTrend')}</h3>
          <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">${i18n.t('reports.charts.lastMonths', { count: monthRange })}</span>
        </div>
        <div class="card-body">
          ${buildBarChart(monthly)}
        </div>
      </div>

      <!-- Category breakdown -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" style="display:flex;align-items:center;gap:var(--space-2);">${Icons.pieChart(16)} ${i18n.t('reports.categorySales')}</h3>
        </div>
        <div class="card-body" style="padding-top:var(--space-3);">
          ${categories.length === 0
            ? `<div class="empty-state" style="padding:var(--space-8);"><p style="color:var(--color-text-tertiary);font-size:var(--font-size-sm);">${i18n.t('reports.charts.noData')}</p></div>`
            : categories.map((c) => buildCategoryRow(c)).join('')
          }
        </div>
      </div>
    </div>

    <!-- Top Customers + Top Products -->
    <div class="reports-bottom-grid">

      <!-- Top customers -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" style="display:flex;align-items:center;gap:var(--space-2);">${Icons.customers(16)} ${i18n.t('reports.topCustomers')}</h3>
          <button class="btn btn-ghost btn-sm" data-navigate="customers">
            ${i18n.t('dashboard.viewAll')} ${Icons.chevronRight(16)}
          </button>
        </div>
        <div class="table-container" style="border:none;border-radius:0;">
          <table class="data-table" aria-label="Top customers">
            <thead>
              <tr>
                <th>#</th>
                <th>${i18n.t('customers.name')}</th>
                <th>${i18n.t('customers.modals.totalOrders')}</th>
                <th>${i18n.t('customers.modals.totalSpent')}</th>
                <th>${i18n.t('customers.lastOrder')}</th>
              </tr>
            </thead>
            <tbody>
              ${topCustomers.length === 0
                ? `<tr><td colspan="5" style="text-align:center;padding:var(--space-8);color:var(--color-text-tertiary);">${i18n.t('reports.charts.noData')}</td></tr>`
                : topCustomers.map((c, i) => `
                  <tr>
                    <td>
                      <div style="width:24px;height:24px;border-radius:var(--radius-full);background:${i < 3 ? 'var(--color-primary)' : 'var(--color-bg-secondary)'};color:${i < 3 ? 'white' : 'var(--color-text-secondary)'};display:flex;align-items:center;justify-content:center;font-size:var(--font-size-xs);font-weight:600;">
                        ${i + 1}
                      </div>
                    </td>
                    <td><span style="font-weight:500;">${escapeHtml(c.customerName)}</span></td>
                    <td style="color:var(--color-text-secondary);">${c.orderCount}</td>
                    <td><strong style="color:var(--color-primary);">${formatCurrency(c.totalSpent)}</strong></td>
                    <td style="color:var(--color-text-secondary);">${formatDate(c.lastOrderDate)}</td>
                  </tr>`).join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top products -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" style="display:flex;align-items:center;gap:var(--space-2);">${Icons.products(16)} ${i18n.t('reports.topProducts')}</h3>
          <button class="btn btn-ghost btn-sm" data-navigate="products">
            ${i18n.t('dashboard.viewAll')} ${Icons.chevronRight(16)}
          </button>
        </div>
        <div class="table-container" style="border:none;border-radius:0;">
          <table class="data-table" aria-label="Top products">
            <thead>
              <tr>
                <th>#</th>
                <th>${i18n.t('products.modals.name')}</th>
                <th>${i18n.t('reports.charts.units')}</th>
                <th>${i18n.t('common.amount')}</th>
                <th>${i18n.t('reports.kpis.totalProfit')}</th>
              </tr>
            </thead>
            <tbody>
              ${topProducts.length === 0
                ? `<tr><td colspan="5" style="text-align:center;padding:var(--space-8);color:var(--color-text-tertiary);">${i18n.t('reports.charts.noData')}</td></tr>`
                : topProducts.map((p, i) => `
                  <tr>
                    <td>
                      <div style="width:24px;height:24px;border-radius:var(--radius-full);background:${i < 3 ? 'var(--color-primary)' : 'var(--color-bg-secondary)'};color:${i < 3 ? 'white' : 'var(--color-text-secondary)'};display:flex;align-items:center;justify-content:center;font-size:var(--font-size-xs);font-weight:600;">
                        ${i + 1}
                      </div>
                    </td>
                    <td>
                      <div style="font-weight:500;">${escapeHtml(p.productName)}</div>
                      <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">${escapeHtml(p.category)}</div>
                    </td>
                    <td style="color:var(--color-text-secondary);">${p.quantity}</td>
                    <td><strong>${formatCurrency(p.revenue)}</strong></td>
                    <td style="color:${p.profit >= 0 ? 'var(--color-success)' : 'var(--color-error)'};font-weight:500;">${formatCurrency(p.profit)}</td>
                  </tr>`).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Financial Reports Section -->
    <div style="margin-top:var(--space-6);">
      <h3 style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);margin-bottom:var(--space-4);display:flex;align-items:center;gap:var(--space-2);">
        ${Icons.accounting(18)} ${i18n.t('accounting.title' as any)}
      </h3>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-4);">
        ${buildFinancialReportCard(i18n.t('accounting.incomeStatement.title' as any), i18n.t('accounting.subtitle' as any), Icons.incomeStatement(20), 'income-statement', 'success')}
        ${buildFinancialReportCard(i18n.t('accounting.balanceSheet.title' as any), i18n.t('accounting.balanceSheet.assets' as any) + ' & ' + i18n.t('accounting.balanceSheet.liabilities' as any), Icons.balanceSheet(20), 'balance-sheet', 'info')}
        ${buildFinancialReportCard(i18n.t('accounting.cashFlow.title' as any), i18n.t('accounting.cashFlow.operating' as any), Icons.cashFlow(20), 'cash-flow', 'primary')}
        ${buildFinancialReportCard(i18n.t('accounting.trialBalance.title' as any), i18n.t('accounting.trialBalance.balanced' as any), Icons.trialBalance(20), 'trial-balance', 'warning')}
        ${buildFinancialReportCard(i18n.t('accounting.taxReport.title' as any), i18n.t('accounting.taxReport.taxPayable' as any), Icons.fileText(20), 'tax-report', 'error')}
      </div>
    </div>

    <!-- AR/AP Aging Reports -->
    ${buildAgingSection()}
  `;
}

function buildKpi(label: string, value: string, iconSvg: string, color: string): string {
  return `
    <div class="card stat-card">
      <div class="stat-card-icon" style="background:var(--color-${color}-subtle);color:var(--color-${color});">${iconSvg}</div>
      <div class="stat-card-value">${value}</div>
      <div class="stat-card-label">${label}</div>
    </div>`;
}

function buildFinancialReportCard(title: string, desc: string, iconSvg: string, route: string, color: string): string {
  return `
    <div class="card card-hover" style="padding:var(--space-5);display:flex;flex-direction:column;gap:var(--space-3);cursor:pointer;" data-navigate="${route}">
      <div style="width:40px;height:40px;border-radius:var(--radius-md);background:var(--color-${color}-subtle);color:var(--color-${color});display:flex;align-items:center;justify-content:center;">${iconSvg}</div>
      <div>
        <div style="font-weight:var(--font-weight-semibold);font-size:var(--font-size-sm);">${title}</div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-top:2px;">${desc}</div>
      </div>
      <div style="margin-top:auto;font-size:var(--font-size-xs);color:var(--color-primary);display:flex;align-items:center;gap:4px;">
        ${i18n.t('dashboard.viewAll')} ${Icons.chevronRight(12)}
      </div>
    </div>`;
}

function buildBarChart(monthly: ReturnType<typeof reportsService.getMonthlyRevenue>): string {
  if (monthly.every((m) => m.revenue === 0)) {
    return `<div class="empty-state" style="padding:var(--space-8);"><p style="color:var(--color-text-tertiary);font-size:var(--font-size-sm);">${i18n.t('reports.charts.noData')}</p></div>`;
  }

  const maxRevenue = Math.max(...monthly.map((m) => m.revenue), 1);

  return `
    <div style="display:flex;flex-direction:column;gap:var(--space-3);">
      <div style="display:flex;align-items:flex-end;gap:var(--space-2);height:160px;padding-bottom:var(--space-1);">
        ${monthly.map((m) => {
          const heightPct = (m.revenue / maxRevenue) * 100;
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:var(--space-1);height:100%;justify-content:flex-end;" title="${m.month}: ${formatCurrency(m.revenue)}">
              <div style="width:100%;background:var(--color-primary);border-radius:var(--radius-xs) var(--radius-xs) 0 0;height:${Math.max(heightPct, 2)}%;transition:height var(--transition-base);position:relative;cursor:pointer;"
                onmouseenter="this.style.background='var(--color-primary-dark)'"
                onmouseleave="this.style.background='var(--color-primary)'">
              </div>
            </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:var(--space-2);">
        ${monthly.map((m) => `
          <div style="flex:1;text-align:center;font-size:10px;color:var(--color-text-tertiary);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;" title="${m.month}">
            ${m.month.split(' ')[0]}
          </div>`).join('')}
      </div>
      <!-- Legend -->
      <div style="display:flex;gap:var(--space-4);flex-wrap:wrap;padding-top:var(--space-2);border-top:1px solid var(--color-border);">
        ${monthly.slice(-3).map((m) => `
          <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">
            <span style="font-weight:600;color:var(--color-text-primary);">${m.month}</span>
            · ${formatCurrency(m.revenue)}
            · <span style="color:${m.profit >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(m.profit)} ${i18n.t('reports.kpis.totalProfit')}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function buildCategoryRow(c: ReturnType<typeof reportsService.getCategorySales>[number]): string {
  return `
    <div style="display:flex;flex-direction:column;gap:var(--space-1);padding:var(--space-3) 0;border-bottom:1px solid var(--color-border-subtle);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:var(--space-2);">
          <span class="badge badge-primary">${c.category}</span>
          <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">${c.quantity} ${i18n.t('reports.charts.units')}</span>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:600;font-size:var(--font-size-sm);">${formatCurrency(c.revenue)}</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">${c.percentage.toFixed(1)}%</div>
        </div>
      </div>
      <div style="height:6px;background:var(--color-bg-secondary);border-radius:var(--radius-full);overflow:hidden;">
        <div style="height:100%;width:${c.percentage}%;background:var(--color-primary);border-radius:var(--radius-full);transition:width var(--transition-slow);"></div>
      </div>
    </div>`;
}

function buildAgingSection(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ageDays = (dateStr: string): number => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today.getTime() - d.getTime()) / 86400000));
  };

  const bucket = (days: number): 0 | 1 | 2 | 3 => {
    if (days <= 30) return 0;
    if (days <= 60) return 1;
    if (days <= 90) return 2;
    return 3;
  };

  // AR Aging
  const arInvoices = invoiceService.getAll().filter((inv) => inv.amountDue > 0 && inv.status !== 'cancelled');
  const arByCustomer = new Map<string, { name: string; buckets: [number, number, number, number] }>();
  for (const inv of arInvoices) {
    const age = ageDays(inv.dueDate);
    const b = bucket(age);
    const entry = arByCustomer.get(inv.customerId) ?? { name: inv.customerName, buckets: [0, 0, 0, 0] };
    entry.buckets[b] += inv.amountDue;
    arByCustomer.set(inv.customerId, entry);
  }
  const arRows = [...arByCustomer.values()];
  const arTotals: [number, number, number, number] = [0, 0, 0, 0];
  arRows.forEach((r) => r.buckets.forEach((v, i) => { arTotals[i] += v; }));

  // AP Aging
  const apPurchases = purchaseService.getAll().filter((p) => p.paymentStatus !== 'paid' && p.status !== 'cancelled');
  const apBySupplier = new Map<string, { name: string; buckets: [number, number, number, number] }>();
  for (const p of apPurchases) {
    const age = ageDays(p.expectedDate ?? p.createdAt);
    const b = bucket(age);
    const balance = p.total - (p.amountPaid ?? 0);
    const entry = apBySupplier.get(p.supplierId) ?? { name: p.supplierName, buckets: [0, 0, 0, 0] };
    entry.buckets[b] += balance;
    apBySupplier.set(p.supplierId, entry);
  }
  const apRows = [...apBySupplier.values()];
  const apTotals: [number, number, number, number] = [0, 0, 0, 0];
  apRows.forEach((r) => r.buckets.forEach((v, i) => { apTotals[i] += v; }));

  const bucketLabels = [
    i18n.t('reports.agingBucket1' as any),
    i18n.t('reports.agingBucket2' as any),
    i18n.t('reports.agingBucket3' as any),
    i18n.t('reports.agingBucket4' as any),
  ];

  const buildAgingTable = (rows: { name: string; buckets: [number, number, number, number] }[], totals: [number, number, number, number], title: string): string => {
    const grandTotal = totals.reduce((s, v) => s + v, 0);
    return `
      <div class="card" style="margin-top:var(--space-5);">
        <div class="card-header">
          <h3 class="card-title">${title}</h3>
        </div>
        <div class="table-container" style="border:none;border-radius:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>${i18n.t('customers.name')}</th>
                ${bucketLabels.map((l) => `<th style="text-align:right;">${l}</th>`).join('')}
                <th style="text-align:right;">${i18n.t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0
                ? `<tr><td colspan="6" style="text-align:center;padding:var(--space-6);color:var(--color-text-tertiary);">${i18n.t('reports.charts.noData')}</td></tr>`
                : rows.map((r) => {
                    const rowTotal = r.buckets.reduce((s, v) => s + v, 0);
                    return `<tr>
                      <td style="font-weight:500;">${escapeHtml(r.name)}</td>
                      ${r.buckets.map((v, i) => `<td style="text-align:right;color:${i >= 2 ? 'var(--color-error)' : i === 1 ? 'var(--color-warning)' : 'var(--color-text-primary)'};">${v > 0 ? formatCurrency(v) : '—'}</td>`).join('')}
                      <td style="text-align:right;font-weight:600;">${formatCurrency(rowTotal)}</td>
                    </tr>`;
                  }).join('')
              }
              ${rows.length > 0 ? `
              <tr style="background:var(--color-bg-secondary);font-weight:700;border-top:2px solid var(--color-border);">
                <td>${i18n.t('common.total')}</td>
                ${totals.map((v) => `<td style="text-align:right;">${formatCurrency(v)}</td>`).join('')}
                <td style="text-align:right;color:var(--color-primary);">${formatCurrency(grandTotal)}</td>
              </tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>`;
  };

  return `
    <div style="margin-top:var(--space-6);">
      <h3 style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);margin-bottom:var(--space-2);display:flex;align-items:center;gap:var(--space-2);">
        ${Icons.invoices(18)} ${i18n.t('reports.arAging' as any)}
      </h3>
      ${buildAgingTable(arRows, arTotals, i18n.t('reports.arAging' as any))}
      ${apRows.length > 0 ? `
      <h3 style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);margin-top:var(--space-6);margin-bottom:var(--space-2);display:flex;align-items:center;gap:var(--space-2);">
        ${Icons.truck(18)} ${i18n.t('reports.apAging' as any)}
      </h3>
      ${buildAgingTable(apRows, apTotals, i18n.t('reports.apAging' as any))}` : ''}
    </div>`;
}

// Inject reports-specific styles once
if (!document.getElementById('reports-styles')) {
  const style = document.createElement('style');
  style.id = 'reports-styles';
  style.textContent = `
    .reports-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }
    .reports-main-grid {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: var(--space-5);
      margin-bottom: var(--space-5);
    }
    .reports-bottom-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-5);
    }
    @media (max-width: 1280px) {
      .reports-kpi-grid { grid-template-columns: repeat(3, 1fr); }
      .reports-main-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 900px) {
      .reports-bottom-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      .reports-kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 400px) {
      .reports-kpi-grid { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}
