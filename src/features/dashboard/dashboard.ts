/**
 * Dashboard feature – renders KPI cards, recent sales, and top products.
 */

import { dashboardService } from '@services/dashboardService';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, formatPercent } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import type { DashboardStats } from '@core/types';

/** Render and return the dashboard page element */
export function renderDashboard(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  const stats = dashboardService.getStats();
  page.innerHTML = buildDashboardHTML(stats);

  return page;
}

function buildDashboardHTML(stats: DashboardStats): string {
  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('nav.dashboard')}</h2>
        <p class="page-subtitle">${i18n.t('dashboard.welcomeBackToday')}</p>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="stats-grid">
      ${buildStatCard(i18n.t('dashboard.totalRevenue'), formatCurrency(stats.totalRevenue), stats.revenueGrowth, Icons.dollarSign(), 'primary')}
      ${buildStatCard(i18n.t('dashboard.totalOrders'), String(stats.totalOrders), stats.ordersGrowth, Icons.shoppingCart(), 'info')}
      ${buildStatCard(i18n.t('nav.customers'), String(stats.totalCustomers), 0, Icons.customers(), 'success')}
      ${buildStatCard(i18n.t('nav.products'), String(stats.totalProducts), 0, Icons.products(), 'warning')}
      ${buildLowStockCard(stats.lowStockCount)}
    </div>

    <!-- Recent Sales + Top Products -->
    <div class="dashboard-grid">
      <!-- Recent Sales -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${i18n.t('dashboard.recentSales')}</h3>
          <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/sales'">
            ${i18n.t('dashboard.viewAll')} ${Icons.chevronRight(16)}
          </button>
        </div>
        <div class="table-container" style="border: none; border-radius: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>${i18n.t('dashboard.order')}</th>
                <th>${i18n.t('dashboard.customer')}</th>
                <th>${i18n.t('dashboard.date')}</th>
                <th>${i18n.t('dashboard.amount')}</th>
                <th>${i18n.t('dashboard.status')}</th>
              </tr>
            </thead>
            <tbody>
              ${
                stats.recentSales.length === 0
                   ? `<tr><td colspan="5" style="text-align:center; color: var(--color-text-tertiary); padding: 32px;">${i18n.t('dashboard.noSalesYet')}</td></tr>`
                  : stats.recentSales
                      .map(
                        (sale) => `
                <tr>
                  <td><span style="font-weight: 500; color: var(--color-primary);">${sale.orderNumber}</span></td>
                  <td>${sale.customerName}</td>
                  <td style="color: var(--color-text-secondary);">${formatDate(sale.createdAt)}</td>
                  <td><strong>${formatCurrency(sale.total)}</strong></td>
                  <td>${buildStatusBadge(sale.status)}</td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top Products -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${i18n.t('dashboard.topProducts')}</h3>
          <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/products'">
            ${i18n.t('dashboard.viewAll')} ${Icons.chevronRight(16)}
          </button>
        </div>
        <div class="card-body" style="padding-top: var(--space-3);">
          ${
            stats.topProducts.length === 0
              ? `<div class="empty-state" style="padding: var(--space-8);">
                  <p style="color: var(--color-text-tertiary); font-size: var(--font-size-sm);">${i18n.t('dashboard.noProductDataYet')}</p>
                </div>`
              : stats.topProducts
                  .map(
                    (p, i) => `
            <div class="top-product-item">
              <div class="top-product-rank">${i + 1}</div>
              <div class="top-product-info">
                <div class="top-product-name">${p.name}</div>
                <div class="top-product-qty">${i18n.t('dashboard.unitsSold', { count: p.quantity })}</div>
              </div>
              <div class="top-product-revenue">${formatCurrency(p.revenue)}</div>
            </div>
          `
                  )
                  .join('')
          }
        </div>
      </div>
    </div>
  `;
}

function buildLowStockCard(count: number): string {
  const color = count === 0 ? 'success' : 'error';
  const icon = count === 0 ? Icons.check() : Icons.alertCircle();
  return `
    <div class="card stat-card card-hover" style="cursor:pointer;" onclick="window.location.hash='#/inventory'">
      <div class="stat-card-icon stat-icon-${color}">${icon}</div>
      <div class="stat-card-value">${count}</div>
      <div class="stat-card-label">${i18n.t('dashboard.lowStockItems')}</div>
      <div style="font-size:var(--font-size-xs);color:var(--color-primary);margin-top:var(--space-1);">
        ${i18n.t('dashboard.viewInventory')} ${Icons.chevronRight(14)}
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
  const trendIcon = growth >= 0 ? Icons.trendUp(16) : Icons.trendDown(16);
  const showTrend = growth !== 0;

  return `
    <div class="card stat-card card-hover">
      <div class="stat-card-icon stat-icon-${color}">${iconSvg}</div>
      <div class="stat-card-value">${value}</div>
      <div class="stat-card-label">${label}</div>
      ${
        showTrend
          ? `<div class="stat-card-trend ${trendClass}">
          ${trendIcon}
          <span>${formatPercent(growth)} ${i18n.t('dashboard.vsLastMonth')}</span>
        </div>`
          : ''
      }
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
    gap: var(--space-5);
    margin-bottom: var(--space-6);
  }
  .dashboard-grid {
    display: grid;
    grid-template-columns: 1fr 380px;
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
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .dashboard-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .stats-grid { grid-template-columns: 1fr; }
  }
`;

if (!document.getElementById('dashboard-styles')) {
  const style = document.createElement('style');
  style.id = 'dashboard-styles';
  style.textContent = dashboardStyles;
  document.head.appendChild(style);
}
