/**
 * Alert service — computes actionable system alerts on demand.
 * No persistence: alerts are derived live from current data state.
 */

import { repository } from '@data/excelRepository';

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
        title: 'Out of Stock',
        message: `${outOfStock.length} product${outOfStock.length !== 1 ? 's are' : ' is'} out of stock`,
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
        title: 'Low Stock',
        message: `${lowStock.length} product${lowStock.length !== 1 ? 's are' : ' is'} below reorder point`,
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
        title: 'Overdue Invoices',
        message: `${overdueInvoices.length} invoice${overdueInvoices.length !== 1 ? 's are' : ' is'} past due`,
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
        title: 'Invoices Due Soon',
        message: `${dueSoon.length} invoice${dueSoon.length !== 1 ? 's are' : ' is'} due within 7 days`,
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
        title: 'Pending Purchase Orders',
        message: `${pendingPOs.length} PO${pendingPOs.length !== 1 ? 's are' : ' is'} awaiting delivery`,
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
        title: 'Overdue Deliveries',
        message: `${overduePOs.length} PO${overduePOs.length !== 1 ? 's have' : ' has'} passed expected delivery date`,
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
        title: 'Pending Returns',
        message: `${pendingReturns.length} return${pendingReturns.length !== 1 ? 's are' : ' is'} awaiting review`,
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
        title: 'Unpaid Supplier Bills',
        message: `${unpaidPOs.length} received PO${unpaidPOs.length !== 1 ? 's have' : ' has'} unpaid balance`,
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
