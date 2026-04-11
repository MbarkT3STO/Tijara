/**
 * Returns / Refunds service.
 * Creating an approved return restocks inventory via inventoryService.
 * Approving a pending return also restocks if restockItems = true.
 */

import { repository } from '@data/repository';
import { inventoryService } from './inventoryService';
import type { Return, ReturnItem } from '@core/types';
import { generateId, getCurrentISODate, autoNote } from '@shared/utils/helpers';

function nextReturnNumber(): string {
  const year = new Date().getFullYear();
  const prefix = `RET-${year}-`;
  const max = repository.getAll('returns')
    .filter((r) => r.returnNumber.startsWith(prefix))
    .reduce((m, r) => {
      const n = parseInt(r.returnNumber.slice(prefix.length), 10);
      return isNaN(n) ? m : Math.max(m, n);
    }, 1000);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export const returnService = {
  getAll(): Return[] {
    return repository
      .getAll('returns')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getById(id: string): Return | undefined {
    return repository.getById('returns', id);
  },

  getBySale(saleId: string): Return[] {
    return repository.getAll('returns').filter((r) => r.saleId === saleId);
  },

  getByCustomer(customerId: string): Return[] {
    return repository.getAll('returns').filter((r) => r.customerId === customerId);
  },

  /** Calculate totals from return items + tax rate */
  calculateTotals(
    items: ReturnItem[],
    taxRate: number
  ): { subtotal: number; taxAmount: number; refundAmount: number } {
    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const taxAmount = (subtotal * taxRate) / 100;
    return { subtotal, taxAmount, refundAmount: subtotal + taxAmount };
  },

  /** Create a new return. If status is 'approved', restock immediately. */
  create(
    data: Omit<Return, 'id' | 'returnNumber' | 'createdAt' | 'updatedAt' | 'subtotal' | 'taxAmount' | 'refundAmount'>
  ): Return {
    const { subtotal, taxAmount, refundAmount } = this.calculateTotals(data.items, data.taxRate);

    const ret: Return = {
      ...data,
      id: generateId(),
      returnNumber: nextReturnNumber(),
      subtotal,
      taxAmount,
      refundAmount,
      createdAt: getCurrentISODate(),
      updatedAt: getCurrentISODate(),
    };

    repository.insert('returns', ret);

    if (ret.status === 'approved' && ret.restockItems) {
      this._restockItems(ret);
    }

    return ret;
  },

  /** Update status — triggers restock when transitioning to approved */
  updateStatus(id: string, status: Return['status']): boolean {
    const prev = repository.getById('returns', id);
    if (!prev) return false;

    // Pending → approved: restock if requested
    if (status === 'approved' && prev.status === 'pending' && prev.restockItems) {
      this._restockItems(prev);
    }

    // Approved → rejected/pending: reverse the restock
    if (prev.status === 'approved' && status !== 'approved' && prev.restockItems) {
      prev.items.forEach((item) => {
        inventoryService.recordMovement(
          item.productId,
          'adjustment',
          -item.quantity,
          prev.returnNumber,
          autoNote('stockReversedReturnUnapproved', prev.returnNumber)
        );
      });
    }

    return repository.update('returns', id, { status, updatedAt: getCurrentISODate() });
  },

  update(id: string, data: Partial<Omit<Return, 'id' | 'createdAt'>>): boolean {
    if (data.items || data.taxRate !== undefined) {
      const prev = repository.getById('returns', id);
      if (prev) {
        const items = data.items ?? prev.items;
        const taxRate = data.taxRate ?? prev.taxRate;
        const { subtotal, taxAmount, refundAmount } = this.calculateTotals(items, taxRate);
        data = { ...data, subtotal, taxAmount, refundAmount };
      }
    }
    return repository.update('returns', id, { ...data, updatedAt: getCurrentISODate() });
  },

  delete(id: string): boolean {
    const ret = repository.getById('returns', id);
    // Reverse restock if it was approved
    if (ret && ret.status === 'approved' && ret.restockItems) {
      ret.items.forEach((item) => {
        inventoryService.recordMovement(
          item.productId,
          'adjustment',
          -item.quantity,
          ret.returnNumber,
          autoNote('stockReversedReturnDeleted', ret.returnNumber)
        );
      });
    }
    return repository.delete('returns', id);
  },

  /** Total refund amount issued (approved + refunded) */
  getTotalRefunded(): number {
    return repository
      .getAll('returns')
      .filter((r) => r.status === 'approved' || r.status === 'refunded')
      .reduce((sum, r) => sum + r.refundAmount, 0);
  },

  _restockItems(ret: Return): void {
    ret.items.forEach((item) => {
      inventoryService.recordReturn(
        item.productId,
        item.quantity,
        ret.returnNumber,
        autoNote('returnedVia', ret.returnNumber)
      );
    });
  },
};
