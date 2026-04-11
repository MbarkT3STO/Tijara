/**
 * Dashboard feature – renders KPI cards, recent sales, and top products.
 */

import { dashboardService } from '@services/dashboardService';
import { journalService } from '@services/journalService';
import { fiscalPeriodService } from '@services/fiscalPeriodService';
import { inventoryService } from '@services/inventoryService';
import { reportService } from '@services/reportService';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, formatPercent, escapeHtml } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import { router } from '@core/router';
import type { DashboardStats, Product } from '@core/types';

/** Render and return the dashboard page element */
export function renderDashboard(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'content-inner page-enter';

  const stats = dashboardService.getStats();

  // Low stock products for dismissible banner
  const lowStockProducts = inventoryService.getLowStockProducts();

  // Accounting health (non-blocking — catch errors silently)
  let accountingStats: ReturnType<typeof journalService.computeAccountingStats> | null = null;
  let booksBalanced: boolean | null = null;
  try {
    accountingStats = journalService.computeAccountingStats();
    const period = fiscalPeriodService.getCurrent();
    if (period) {
      const tb = journalService.computeTrialBalance(period.id);
      booksBalanced = tb.isBalanced;
    }
  } catch { /* accounting not yet set up */ }

  page.innerHTML = buildDashboardHTML(stats, accountingStats, booksBalanced, lowStockProducts);

  // Dismiss low stock banner
  page.querySelector('#low-stock-dismiss')?.addEventListener('click', () => {
    page.querySelector<HTMLElement>('#low-stock-banner')?.remove();
  });

  // Wire data-navigate buttons
  page.querySelectorAll<HTMLButtonElement>('[data-navigate]').forEach((btn) => {
    btn.addEventListener('click', () => {
      router.navigate(btn.getAttribute('data-navigate') as any);
    });
  });

  return page;
}

function buildDashboardHTML(
  stats: DashboardStats,
  accountingStats: ReturnType<typeof journalService.computeAccountingStats> | null,
  booksBalanced: boolean | null,
  lowStockProducts: Product[]
): string {
  const lowStockBanner = lowStockProducts.length > 0 ? `
    <div id="low-stock-banner" style="
      display:flex;align-items:flex-start;gap:var(--space-3);
      padding:var(--space-4);
      background:var(--color-warning-subtle);
      border:1px solid var(--color-warning);
      border-radius:var(--radius-md);
      margin-bottom:var(--space-5);
    ">
      <div style="color:var(--color-warning);flex-shrink:0;margin-top:2px;">${Icons.alertTriangle(18)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:var(--font-size-sm);color:var(--color-warning);margin-bottom:var(--space-1);">
          ${i18n.t('dashboard.lowStockAlert')} — ${lowStockProducts.length} ${i18n.t('dashboard.lowStockItems')}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-top:var(--space-2);">
          ${lowStockProducts.slice(0, 6).map((p) => `
            <button data-navigate="inventory" style="
              font-size:var(--font-size-xs);padding:2px 8px;
              background:var(--color-warning);color:var(--color-text-inverse);
              border:none;border-radius:var(--radius-full);cursor:pointer;
            ">${escapeHtml(p.name)} (${p.stock})</button>
          `).join('')}
          ${lowStockProducts.length > 6 ? `<span style="font-size:var(--font-size-xs);color:var(--color-warning);align-self:center;">+${lowStockProducts.length - 6} more</span>` : ''}
        </div>
      </div>
      <button id="low-stock-dismiss" style="
        background:none;border:none;cursor:pointer;
        color:var(--color-warning);padding:var(--space-1);flex-shrink:0;
      " aria-label="Dismiss">${Icons.close(16)}</button>
    </div>
  ` : '';

  return `
    ${lowStockBanner}
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-header-icon">${Icons.dashboard(22)}</div>
        <div>
          <h2 class="page-title">${i18n.t('nav.dashboard')}</h2>
          <p class="page-subtitle">${i18n.t('dashboard.welcomeBackToday')}</p>
        </div>
      </div>
      <div style="display:flex;gap:var(--space-2);">
        <button class="btn btn-secondary btn-sm" data-navigate="sales">
          ${Icons.plus(14)} ${i18n.t('nav.sales')}
        </button>
        <button class="btn btn-primary btn-sm" data-navigate="invoices">
          ${Icons.fileText(14)} ${i18n.t('nav.invoices')}
        </button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="stats-grid">
      ${buildStatCard(i18n.t('dashboard.totalRevenue'), formatCurrency(stats.totalRevenue), stats.revenueGrowth, Icons.dollarSign(20), 'primary')}
      ${buildStatCard(i18n.t('dashboard.totalOrders'), String(stats.totalOrders), stats.ordersGrowth, Icons.shoppingCart(20), 'info')}
      ${buildStatCard(i18n.t('nav.customers'), String(stats.totalCustomers), 0, Icons.customers(20), 'success')}
      ${buildStatCard(i18n.t('nav.products'), String(stats.totalProducts), 0, Icons.products(20), 'warning')}
      ${buildLowStockCard(stats.lowStockCount)}
    </div>

    <!-- Recent Sales + Top Products -->
    <div class="dashboard-grid">
      <!-- Recent Sales -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${i18n.t('dashboard.recentSales')}</h3>
          <button class="btn btn-ghost btn-sm" data-navigate="sales">
            ${i18n.t('dashboard.viewAll')} ${Icons.chevronRight(14)}
          </button>
        </div>
        ${buildMiniBarChart(reportService.getMonthlyRevenue(6))}
        <div class="table-container" style="border:none;border-radius:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>${i18n.t('dashboard.order')}</th>
                <th>${i18n.t('dashboard.customer')}</th>
                <th class="col-hide-mobile">${i18n.t('dashboard.date')}</th>
                <th>${i18n.t('dashboard.amount')}</th>
                <th>${i18n.t('dashboard.status')}</th>
              </tr>
            </thead>
            <tbody>
              ${
                stats.recentSales.length === 0
                  ? `<tr><td colspan="5">
                      <div class="empty-state" style="padding:var(--space-8);">
                        <div class="empty-state-icon">${Icons.shoppingCart(32)}</div>
                        <p class="empty-state-title">${i18n.t('dashboard.noSalesYet')}</p>
                      </div>
                    </td></tr>`
                  : stats.recentSales.map((sale) => `
                      <tr>
                        <td><span style="font-weight:600;color:var(--color-primary);">${escapeHtml(sale.orderNumber)}</span></td>
                        <td>${escapeHtml(sale.customerName)}</td>
                        <td class="col-hide-mobile" style="color:var(--color-text-secondary);">${formatDate(sale.createdAt)}</td>
                        <td><strong>${formatCurrency(sale.total)}</strong></td>
                        <td>${buildStatusBadge(sale.status)}</td>
                      </tr>
                    `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top Products -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${i18n.t('dashboard.topProducts')}</h3>
          <button class="btn btn-ghost btn-sm" data-navigate="products">
            ${i18n.t('dashboard.viewAll')} ${Icons.chevronRight(14)}
          </button>
        </div>
        <div class="card-body" style="padding-top:var(--space-3);">
          ${
            stats.topProducts.length === 0
              ? `<div class="empty-state" style="padding:var(--space-8);">
                  <div class="empty-state-icon">${Icons.barChart(32)}</div>
                  <p class="empty-state-desc">${i18n.t('dashboard.noProductDataYet')}</p>
                </div>`
              : stats.topProducts.map((p, i) => `
                  <div class="top-product-item">
                    <div class="top-product-rank">${i + 1}</div>
                    <div class="top-product-info">
                      <div class="top-product-name">${escapeHtml(p.name)}</div>
                      <div class="top-product-qty">${i18n.t('dashboard.unitsSold', { count: p.quantity })}</div>
                    </div>
                    <div class="top-product-revenue">${formatCurrency(p.revenue)}</div>
                  </div>
                `).join('')
          }
        </div>
      </div>
    </div>

    ${accountingStats ? `
    <!-- Accounting Health Row -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-4);margin-top:var(--space-5);">
      <div class="card stat-card card-hover" style="cursor:pointer;" data-navigate="accounting">
        <div class="stat-card-icon" style="background:var(--color-success-subtle);color:var(--color-success);">${Icons.incomeStatement(20)}</div>
        <div class="stat-card-value">${formatCurrency(accountingStats.currentMonthNetIncome)}</div>
        <div class="stat-card-label">${i18n.t('accounting.dashboard.netIncome' as any)}</div>
      </div>
      <div class="card stat-card card-hover" style="cursor:pointer;" data-navigate="accounting">
        <div class="stat-card-icon" style="background:var(--color-primary-subtle);color:var(--color-primary);">${Icons.accounting(20)}</div>
        <div class="stat-card-value">${formatCurrency(accountingStats.totalAssets)}</div>
        <div class="stat-card-label">${i18n.t('accounting.dashboard.totalAssets' as any)}</div>
      </div>
      <div class="card stat-card card-hover" style="cursor:pointer;" data-navigate="accounting">
        <div class="stat-card-icon" style="background:${booksBalanced === false ? 'var(--color-warning-subtle)' : 'var(--color-success-subtle)'};color:${booksBalanced === false ? 'var(--color-warning)' : 'var(--color-success)'};">${booksBalanced === false ? Icons.alertCircle(20) : Icons.check(20)}</div>
        <div class="stat-card-value" style="font-size:var(--font-size-lg);">${booksBalanced === null ? '—' : booksBalanced ? i18n.t('accounting.dashboard.booksBalanced' as any) : i18n.t('accounting.trialBalance.outOfBalance' as any, { amount: '' })}</div>
        <div class="stat-card-label">${i18n.t('accounting.title' as any)}</div>
      </div>
    </div>` : ''}
  `;
}

function buildLowStockCard(count: number): string {
  const color = count === 0 ? 'success' : 'error';
  const icon = count === 0 ? Icons.check(20) : Icons.alertCircle(20);
  return `
    <div class="card stat-card card-hover" style="cursor:pointer;" data-navigate="inventory">
      <div class="stat-card-icon stat-icon-${color}">${icon}</div>
      <div class="stat-card-value">${count}</div>
      <div class="stat-card-label">${i18n.t('dashboard.lowStockItems')}</div>
      <div style="font-size:var(--font-size-xs);color:var(--color-primary);margin-top:var(--space-1);display:flex;align-items:center;gap:4px;">
        ${i18n.t('dashboard.viewInventory')} ${Icons.chevronRight(12)}
      </div>
    </div>
  `;
}

function buildStatCard(
  label: string,
  value: string,
  growth: number,
  iconSvg: string,
  color: string
): string {
  const trendClass = growth >= 0 ? 'up' : 'down';
  const trendIcon = growth >= 0 ? Icons.trendUp(14) : Icons.trendDown(14);
  const showTrend = growth !== 0;

  return `
    <div class="card stat-card card-hover">
      <div class="stat-card-icon stat-icon-${color}">${iconSvg}</div>
      <div class="stat-card-value">${value}</div>
      <div class="stat-card-label">${label}</div>
      ${showTrend ? `
        <div class="stat-card-trend ${trendClass}">
          ${trendIcon}
          <span>${formatPercent(growth)} ${i18n.t('dashboard.vsLastMonth')}</span>
        </div>
      ` : ''}
    </div>
  `;
}

function buildStatusBadge(status: string): string {
  const s = status.toLowerCase();
  const map: Record<string, string> = {
    pending: 'badge-warning',
    confirmed: 'badge-info',
    shipped: 'badge-primary',
    delivered: 'badge-success',
    cancelled: 'badge-error',
  };
  const label = i18n.t(`sales.statuses.${s}` as any);
  return `<span class="badge ${map[s] ?? 'badge-neutral'}">${label}</span>`;
}

// Dashboard-specific styles injected once
const dashboardStyles = `
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  .dashboard-grid {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: var(--space-5);
  }
  .stat-icon-primary { background: var(--color-primary-subtle); color: var(--color-primary); }
  .stat-icon-info { background: var(--color-info-subtle); color: var(--color-info); }
  .stat-icon-success { background: var(--color-success-subtle); color: var(--color-success); }
  .stat-icon-warning { background: var(--color-warning-subtle); color: var(--color-warning); }
  .stat-icon-error { background: var(--color-error-subtle); color: var(--color-error); }
  .top-product-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--color-border-subtle);
  }
  .top-product-item:last-child { border-bottom: none; }
  .top-product-rank {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-full);
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    flex-shrink: 0;
  }
  .top-product-info { flex: 1; min-width: 0; }
  .top-product-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .top-product-qty { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
  .top-product-revenue {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    white-space: nowrap;
  }
  @media (max-width: 1280px) {
    .stats-grid { grid-template-columns: repeat(3, 1fr); }
    .dashboard-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 768px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 480px) {
    .stats-grid { grid-template-columns: 1fr; }
  }
`;

if (!document.getElementById('dashboard-styles')) {
  const style = document.createElement('style');
  style.id = 'dashboard-styles';
  style.textContent = dashboardStyles;
  document.head.appendChild(style);
}

function buildMiniBarChart(monthly: ReturnType<typeof reportService.getMonthlyRevenue>): string {
  const last6 = monthly.slice(-6);
  if (last6.length === 0 || last6.every((m) => m.revenue === 0)) return '';
  const maxRevenue = Math.max(...last6.map((m) => m.revenue), 1);
  return `
    <div style="display:flex;align-items:flex-end;gap:6px;height:80px;padding:var(--space-3) var(--space-4) 0;">
      ${last6.map((m) => {
        const pct = Math.round((m.revenue / maxRevenue) * 100);
        return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;">
            <div style="flex:1;width:100%;display:flex;align-items:flex-end;">
              <div style="
                width:100%;height:${pct}%;min-height:4px;
                background:var(--gradient-primary,var(--color-primary));
                border-radius:var(--radius-xs) var(--radius-xs) 0 0;
                opacity:0.85;
                transition:opacity 0.2s;
              " title="${formatCurrency(m.revenue)}"></div>
            </div>
            <span style="font-size:9px;color:var(--color-text-tertiary);white-space:nowrap;">
              ${m.month.split(' ')[0]}
            </span>
          </div>`;
      }).join('')}
    </div>`;
}
