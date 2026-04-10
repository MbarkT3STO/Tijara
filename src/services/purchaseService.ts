/**
 * Purchase / restocking order service.
 * When a purchase is marked "received", stock is automatically incremented
 * via inventoryService so the audit trail stays consistent.
 */

import { repository } from '@data/excelRepository';
import { inventoryService } from './inventoryService';
import type { Purchase, PurchaseItem } from '@core/types';
import { generateId, getCurrentISODate, autoNote } from '@shared/utils/helpers';

function nextPoNumber(): string {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const max = repository.getAll('purchases')
    .filter((p) => p.poNumber.startsWith(prefix))
    .reduce((m, p) => {
      const n = parseInt(p.poNumber.slice(prefix.length), 10);
      return isNaN(n) ? m : Math.max(m, n);
    }, 1000);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export const purchaseService = {
  getAll(): Purchase[] {
    return repository
      .getAll('purchases')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getById(id: string): Purchase | undefined {
    return repository.getById('purchases', id);
  },

  getBySupplier(supplierId: string): Purchase[] {
    return repository.getAll('purchases').filter((p) => p.supplierId === supplierId);
  },

  /** Create a new purchase order */
  create(
    data: Omit<Purchase, 'id' | 'poNumber' | 'createdAt' | 'updatedAt' | 'subtotal' | 'taxAmount' | 'total'>
  ): Purchase {
    const subtotal = data.items.reduce((sum, i) => sum + i.total, 0);
    const taxAmount = (subtotal * data.taxRate) / 100;
    const total = subtotal + taxAmount + data.shippingCost;

    const purchase: Purchase = {
      ...data,
      id: generateId(),
      poNumber: nextPoNumber(),
      subtotal,
      taxAmount,
      total,
      amountPaid: 0,
      createdAt: getCurrentISODate(),
      updatedAt: getCurrentISODate(),
    };

    repository.insert('purchases', purchase);

    // If created directly as received, restock immediately
    if (data.status === 'received') {
      this._restockItems(purchase);
    }

    return purchase;
  },

  /** Update status — triggers stock restock when transitioning to "received" */
  updateStatus(id: string, status: Purchase['status']): boolean {
    const prev = repository.getById('purchases', id);
    if (!prev) return false;

    // Transition to received → restock stock
    if (status === 'received' && prev.status !== 'received') {
      this._restockItems(prev);
    }

    // Un-receive (received → anything else) → reverse the stock
    if (prev.status === 'received' && status !== 'received') {
      prev.items.forEach((item) => {
        inventoryService.recordMovement(
          item.productId,
          'adjustment',
          -item.quantity,
          prev.poNumber,
          autoNote('stockReversedUnreceived', prev.poNumber)
        );
      });
    }

    return repository.update('purchases', id, { status, updatedAt: getCurrentISODate() });
  },

  updatePaymentStatus(id: string, paymentStatus: Purchase['paymentStatus'], amountPaid?: number): boolean {
    const prev = repository.getById('purchases', id);
    if (!prev) return false;
    const newAmountPaid = amountPaid !== undefined
      ? Math.min((prev.amountPaid ?? 0) + amountPaid, prev.total)
      : prev.amountPaid ?? 0;
    return repository.update('purchases', id, {
      paymentStatus,
      amountPaid: newAmountPaid,
      updatedAt: getCurrentISODate(),
    });
  },

  update(id: string, data: Partial<Omit<Purchase, 'id' | 'createdAt'>>): boolean {
    // Recalculate totals if items/rates changed
    if (data.items || data.taxRate !== undefined || data.shippingCost !== undefined) {
      const prev = repository.getById('purchases', id);
      if (prev) {
        const items = data.items ?? prev.items;
        const taxRate = data.taxRate ?? prev.taxRate;
        const shippingCost = data.shippingCost ?? prev.shippingCost;
        const subtotal = items.reduce((sum, i) => sum + i.total, 0);
        const taxAmount = (subtotal * taxRate) / 100;
        data = { ...data, subtotal, taxAmount, total: subtotal + taxAmount + shippingCost };
      }
    }
    return repository.update('purchases', id, { ...data, updatedAt: getCurrentISODate() });
  },

  delete(id: string): boolean {
    const purchase = repository.getById('purchases', id);
    // Reverse stock if it was received
    if (purchase && purchase.status === 'received') {
      purchase.items.forEach((item) => {
        inventoryService.recordMovement(
          item.productId,
          'adjustment',
          -item.quantity,
          purchase.poNumber,
          autoNote('stockReversedPODeleted', purchase.poNumber)
        );
      });
    }
    return repository.delete('purchases', id);
  },

  calculateTotals(
    items: PurchaseItem[],
    taxRate: number,
    shippingCost: number
  ): { subtotal: number; taxAmount: number; total: number } {
    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const taxAmount = (subtotal * taxRate) / 100;
    return { subtotal, taxAmount, total: subtotal + taxAmount + shippingCost };
  },

  /** Total spend across all received purchases */
  getTotalSpend(): number {
    return repository
      .getAll('purchases')
      .filter((p) => p.status === 'received')
      .reduce((sum, p) => sum + p.total, 0);
  },

  /** Spend in a date range */
  getSpendInRange(from: Date, to: Date): number {
    return repository
      .getAll('purchases')
      .filter((p) => {
        const d = new Date(p.createdAt);
        return p.status === 'received' && d >= from && d <= to;
      })
      .reduce((sum, p) => sum + p.total, 0);
  },

  _restockItems(purchase: Purchase): void {
    purchase.items.forEach((item) => {
      inventoryService.recordMovement(
        item.productId,
        'purchase',
        item.quantity,
        purchase.poNumber,
        autoNote('receivedViaPO', purchase.poNumber)
      );
    });
  },
};
