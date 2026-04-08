/**
 * Sales / Orders business logic service.
 */

import { repository } from '@data/excelRepository';
import type { Sale, OrderItem } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';

let orderCounter = 1000;

/** Generate a sequential order number */
function nextOrderNumber(): string {
  const year = new Date().getFullYear();
  return `ORD-${year}-${String(++orderCounter).padStart(4, '0')}`;
}

export const saleService = {
  /** Get all sales */
  getAll(): Sale[] {
    return repository.getAll('sales');
  },

  /** Get sale by ID */
  getById(id: string): Sale | undefined {
    return repository.getById('sales', id);
  },

  /** Create a new sale */
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
    return sale;
  },

  /** Update sale status */
  updateStatus(id: string, status: Sale['status']): boolean {
    return repository.update('sales', id, { status, updatedAt: getCurrentISODate() });
  },

  /** Update payment status */
  updatePaymentStatus(id: string, paymentStatus: Sale['paymentStatus']): boolean {
    return repository.update('sales', id, { paymentStatus, updatedAt: getCurrentISODate() });
  },

  /** Update a sale */
  update(id: string, data: Partial<Omit<Sale, 'id' | 'createdAt'>>): boolean {
    return repository.update('sales', id, { ...data, updatedAt: getCurrentISODate() });
  },

  /** Delete a sale */
  delete(id: string): boolean {
    return repository.delete('sales', id);
  },

  /** Calculate totals for a set of items */
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

  /** Get sales by customer */
  getByCustomer(customerId: string): Sale[] {
    return repository.getAll('sales').filter((s) => s.customerId === customerId);
  },

  /** Get revenue for a date range */
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
