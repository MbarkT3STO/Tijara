/**
 * Alert service — computes actionable system alerts on demand.
 * No persistence: alerts are derived live from current data state.
 */

import { repository } from '@data/repository';
import { i18n } from '@core/i18n';

export type AlertSeverity = 'error' | 'warning' | 'info';
export type AlertCategory = 'inventory' | 'invoice' | 'purchase' | 'return';

export interface SystemAlert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  route: string; // hash route to navigate to
  count?: number;
}

export const alertService = {
  /** Compute all current system alerts */
  getAlerts(): SystemAlert[] {
    const alerts: SystemAlert[] = [];

    // ── Out of stock ───────────────────────────────────────────────────────
    const outOfStock = repository.getAll('products').filter((p) => p.stock === 0);
    if (outOfStock.length > 0) {
      alerts.push({
        id: 'out-of-stock',
        severity: 'error',
        category: 'inventory',
        title: i18n.t('alerts.outOfStock.title' as any),
        message: i18n.t('alerts.outOfStock.msg' as any, { count: outOfStock.length }),
        route: '#/inventory',
        count: outOfStock.length,
      });
    }

    // ── Low stock ──────────────────────────────────────────────────────────
    const lowStock = repository
      .getAll('products')
      .filter((p) => p.stock > 0 && p.stock <= (p.reorderPoint ?? 0));
    if (lowStock.length > 0) {
      alerts.push({
        id: 'low-stock',
        severity: 'warning',
        category: 'inventory',
        title: i18n.t('alerts.lowStock.title' as any),
        message: i18n.t('alerts.lowStock.msg' as any, { count: lowStock.length }),
        route: '#/inventory',
        count: lowStock.length,
      });
    }

    // ── Overdue invoices ───────────────────────────────────────────────────
    const now = new Date();
    const overdueInvoices = repository
      .getAll('invoices')
      .filter((i) => (i.status === 'sent' || i.status === 'overdue') && new Date(i.dueDate) < now);
    if (overdueInvoices.length > 0) {
      alerts.push({
        id: 'overdue-invoices',
        severity: 'error',
        category: 'invoice',
        title: i18n.t('alerts.overdueInvoices.title' as any),
        message: i18n.t('alerts.overdueInvoices.msg' as any, { count: overdueInvoices.length }),
        route: '#/invoices',
        count: overdueInvoices.length,
      });
    }

    // ── Unpaid invoices (due within 7 days) ────────────────────────────────
    const sevenDays = new Date(Date.now() + 7 * 86400000);
    const dueSoon = repository
      .getAll('invoices')
      .filter(
        (i) =>
          i.status === 'sent' &&
          new Date(i.dueDate) >= now &&
          new Date(i.dueDate) <= sevenDays
      );
    if (dueSoon.length > 0) {
      alerts.push({
        id: 'invoices-due-soon',
        severity: 'warning',
        category: 'invoice',
        title: i18n.t('alerts.dueSoon.title' as any),
        message: i18n.t('alerts.dueSoon.msg' as any, { count: dueSoon.length }),
        route: '#/invoices',
        count: dueSoon.length,
      });
    }

    // ── Pending purchase orders ────────────────────────────────────────────
    const pendingPOs = repository
      .getAll('purchases')
      .filter((p) => p.status === 'ordered');
    if (pendingPOs.length > 0) {
      alerts.push({
        id: 'pending-pos',
        severity: 'info',
        category: 'purchase',
        title: i18n.t('alerts.pendingPOs.title' as any),
        message: i18n.t('alerts.pendingPOs.msg' as any, { count: pendingPOs.length }),
        route: '#/purchases',
        count: pendingPOs.length,
      });
    }

    // ── Overdue purchase orders (expected date passed) ─────────────────────
    const overduePOs = repository
      .getAll('purchases')
      .filter(
        (p) =>
          p.status === 'ordered' &&
          p.expectedDate &&
          new Date(p.expectedDate) < now
      );
    if (overduePOs.length > 0) {
      alerts.push({
        id: 'overdue-pos',
        severity: 'warning',
        category: 'purchase',
        title: i18n.t('alerts.overduePOs.title' as any),
        message: i18n.t('alerts.overduePOs.msg' as any, { count: overduePOs.length }),
        route: '#/purchases',
        count: overduePOs.length,
      });
    }

    // ── Pending returns ────────────────────────────────────────────────────
    const pendingReturns = repository
      .getAll('returns')
      .filter((r) => r.status === 'pending');
    if (pendingReturns.length > 0) {
      alerts.push({
        id: 'pending-returns',
        severity: 'warning',
        category: 'return',
        title: i18n.t('alerts.pendingReturns.title' as any),
        message: i18n.t('alerts.pendingReturns.msg' as any, { count: pendingReturns.length }),
        route: '#/returns',
        count: pendingReturns.length,
      });
    }

    // ── Unpaid received purchases ──────────────────────────────────────────
    const unpaidPOs = repository
      .getAll('purchases')
      .filter((p) => p.status === 'received' && p.paymentStatus === 'unpaid');
    if (unpaidPOs.length > 0) {
      alerts.push({
        id: 'unpaid-pos',
        severity: 'warning',
        category: 'purchase',
        title: i18n.t('alerts.unpaidPOs.title' as any),
        message: i18n.t('alerts.unpaidPOs.msg' as any, { count: unpaidPOs.length }),
        route: '#/purchases',
        count: unpaidPOs.length,
      });
    }

    return alerts;
  },

  /** Total alert count (for badge) */
  getCount(): number {
    return this.getAlerts().length;
  },
};
