/**
 * Sales / Orders business logic service.
 * Automatically records stock movements when sales are created or cancelled.
 */

import { repository } from '@data/excelRepository';
import { inventoryService } from './inventoryService';
import type { Sale, OrderItem } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';

let orderCounter = 1000;

function nextOrderNumber(): string {
  const year = new Date().getFullYear();
  return `ORD-${year}-${String(++orderCounter).padStart(4, '0')}`;
}

export const saleService = {
  getAll(): Sale[] {
    return repository.getAll('sales');
  },

  getById(id: string): Sale | undefined {
    return repository.getById('sales', id);
  },

  /** Create a new sale and decrement stock for each item */
  create(
    data: Omit<Sale, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt' | 'subtotal' | 'taxAmount' | 'total'>
  ): Sale {
    const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = (subtotal * data.taxRate) / 100;
    const total = subtotal + taxAmount - data.discount;

    const sale: Sale = {
      ...data,
      id: generateId(),
      orderNumber: nextOrderNumber(),
      subtotal,
      taxAmount,
      total,
      createdAt: getCurrentISODate(),
      updatedAt: getCurrentISODate(),
    };
    repository.insert('sales', sale);

    // Decrement stock and record movements for each line item
    if (data.status !== 'cancelled') {
      data.items.forEach((item) => {
        inventoryService.recordMovement(
          item.productId,
          'sale',
          -item.quantity,
          sale.orderNumber,
          `Sold via order ${sale.orderNumber}`
        );
      });
    }

    return sale;
  },

  updateStatus(id: string, status: Sale['status']): boolean {
    const prev = repository.getById('sales', id);

    // If cancelling a non-cancelled sale → restore stock
    if (prev && status === 'cancelled' && prev.status !== 'cancelled') {
      prev.items.forEach((item) => {
        inventoryService.recordMovement(
          item.productId,
          'return',
          item.quantity,
          prev.orderNumber,
          `Stock restored – order ${prev.orderNumber} cancelled`
        );
      });
    }

    // If un-cancelling (e.g. pending → confirmed) → re-decrement stock
    if (prev && prev.status === 'cancelled' && status !== 'cancelled') {
      prev.items.forEach((item) => {
        inventoryService.recordMovement(
          item.productId,
          'sale',
          -item.quantity,
          prev.orderNumber,
          `Stock re-decremented – order ${prev.orderNumber} reactivated`
        );
      });
    }

    return repository.update('sales', id, { status, updatedAt: getCurrentISODate() });
  },

  updatePaymentStatus(id: string, paymentStatus: Sale['paymentStatus']): boolean {
    return repository.update('sales', id, { paymentStatus, updatedAt: getCurrentISODate() });
  },

  /** Update a sale's fields (does NOT reconcile stock — caller is responsible for item changes) */
  update(id: string, data: Partial<Omit<Sale, 'id' | 'createdAt'>>): boolean {
    return repository.update('sales', id, { ...data, updatedAt: getCurrentISODate() });
  },

  delete(id: string): boolean {
    // Restore stock before deleting
    const sale = repository.getById('sales', id);
    if (sale && sale.status !== 'cancelled') {
      sale.items.forEach((item) => {
        inventoryService.recordMovement(
          item.productId,
          'return',
          item.quantity,
          sale.orderNumber,
          `Stock restored – order ${sale.orderNumber} deleted`
        );
      });
    }
    return repository.delete('sales', id);
  },

  calculateTotals(
    items: OrderItem[],
    taxRate: number,
    discount: number
  ): { subtotal: number; taxAmount: number; total: number } {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount - discount;
    return { subtotal, taxAmount, total };
  },

  getByCustomer(customerId: string): Sale[] {
    return repository.getAll('sales').filter((s) => s.customerId === customerId);
  },

  getRevenue(from: Date, to: Date): number {
    return repository
      .getAll('sales')
      .filter((s) => {
        const d = new Date(s.createdAt);
        return d >= from && d <= to && s.status !== 'cancelled';
      })
      .reduce((sum, s) => sum + s.total, 0);
  },
};
