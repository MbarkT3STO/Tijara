/**
 * Reports & Analytics feature page.
 * Revenue trends, category breakdown, top customers, top products.
 */

import { reportsService } from '@services/reportsService';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, formatPercent } from '@shared/utils/helpers';

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
        <h2 class="page-title">Reports & Analytics</h2>
        <p class="page-subtitle">Business performance overview</p>
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
      ${buildKpi('Total Revenue', formatCurrency(summary.totalRevenue), Icons.dollarSign(), 'primary')}
      ${buildKpi('Total Profit', formatCurrency(summary.totalProfit), Icons.trendUp(), summary.totalProfit >= 0 ? 'success' : 'error')}
      ${buildKpi('Profit Margin', profitMargin.toFixed(1) + '%', Icons.pieChart(), profitMargin >= 20 ? 'success' : profitMargin >= 10 ? 'warning' : 'error')}
      ${buildKpi('Total Orders', String(summary.totalOrders), Icons.shoppingCart(), 'info')}
      ${buildKpi('Avg Order Value', formatCurrency(summary.avgOrderValue), Icons.barChart(), 'primary')}
      ${buildKpi('New Customers (30d)', String(summary.newCustomers), Icons.customers(), 'success')}
    </div>

    <!-- Revenue Chart + Category Breakdown -->
    <div class="reports-main-grid">

      <!-- Revenue trend (CSS bar chart) -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" style="display:flex;align-items:center;gap:var(--space-2);">${Icons.barChart(16)} Revenue Trend</h3>
          <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">Last ${monthRange} months</span>
        </div>
        <div class="card-body">
          ${buildBarChart(monthly)}
        </div>
      </div>

      <!-- Category breakdown -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" style="display:flex;align-items:center;gap:var(--space-2);">${Icons.pieChart(16)} Sales by Category</h3>
        </div>
        <div class="card-body" style="padding-top:var(--space-3);">
          ${categories.length === 0
            ? `<div class="empty-state" style="padding:var(--space-8);"><p style="color:var(--color-text-tertiary);font-size:var(--font-size-sm);">No sales data yet</p></div>`
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
          <h3 class="card-title" style="display:flex;align-items:center;gap:var(--space-2);">${Icons.customers(16)} Top Customers</h3>
          <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/customers'">
            View all ${Icons.chevronRight(16)}
          </button>
        </div>
        <div class="table-container" style="border:none;border-radius:0;">
          <table class="data-table" aria-label="Top customers">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Last Order</th>
              </tr>
            </thead>
            <tbody>
              ${topCustomers.length === 0
                ? `<tr><td colspan="5" style="text-align:center;padding:var(--space-8);color:var(--color-text-tertiary);">No data yet</td></tr>`
                : topCustomers.map((c, i) => `
                  <tr>
                    <td>
                      <div style="width:24px;height:24px;border-radius:var(--radius-full);background:${i < 3 ? 'var(--color-primary)' : 'var(--color-bg-secondary)'};color:${i < 3 ? 'white' : 'var(--color-text-secondary)'};display:flex;align-items:center;justify-content:center;font-size:var(--font-size-xs);font-weight:600;">
                        ${i + 1}
                      </div>
                    </td>
                    <td><span style="font-weight:500;">${c.customerName}</span></td>
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
          <h3 class="card-title" style="display:flex;align-items:center;gap:var(--space-2);">${Icons.products(16)} Top Products</h3>
          <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/products'">
            View all ${Icons.chevronRight(16)}
          </button>
        </div>
        <div class="table-container" style="border:none;border-radius:0;">
          <table class="data-table" aria-label="Top products">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Qty Sold</th>
                <th>Revenue</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              ${topProducts.length === 0
                ? `<tr><td colspan="5" style="text-align:center;padding:var(--space-8);color:var(--color-text-tertiary);">No data yet</td></tr>`
                : topProducts.map((p, i) => `
                  <tr>
                    <td>
                      <div style="width:24px;height:24px;border-radius:var(--radius-full);background:${i < 3 ? 'var(--color-primary)' : 'var(--color-bg-secondary)'};color:${i < 3 ? 'white' : 'var(--color-text-secondary)'};display:flex;align-items:center;justify-content:center;font-size:var(--font-size-xs);font-weight:600;">
                        ${i + 1}
                      </div>
                    </td>
                    <td>
                      <div style="font-weight:500;">${p.productName}</div>
                      <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">${p.category}</div>
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

function buildBarChart(monthly: ReturnType<typeof reportsService.getMonthlyRevenue>): string {
  if (monthly.every((m) => m.revenue === 0)) {
    return `<div class="empty-state" style="padding:var(--space-8);"><p style="color:var(--color-text-tertiary);font-size:var(--font-size-sm);">No revenue data yet</p></div>`;
  }

  const maxRevenue = Math.max(...monthly.map((m) => m.revenue), 1);

  return `
    <div style="display:flex;flex-direction:column;gap:var(--space-3);">
      <div style="display:flex;align-items:flex-end;gap:var(--space-2);height:160px;padding-bottom:var(--space-1);">
        ${monthly.map((m) => {
          const heightPct = (m.revenue / maxRevenue) * 100;
          const profitPct = m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0;
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
            · <span style="color:${m.profit >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">${formatCurrency(m.profit)} profit</span>
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
          <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">${c.quantity} units</span>
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

// Inject reports-specific styles once
if (!document.getElementById('reports-styles')) {
  const style = document.createElement('style');
  style.id = 'reports-styles';
  style.textContent = `
    .reports-kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
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
