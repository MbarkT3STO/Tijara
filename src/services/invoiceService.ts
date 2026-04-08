/**
 * Invoice business logic service.
 */

import { repository } from '@data/excelRepository';
import type { Invoice, Sale } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';

let invoiceCounter = 1000;

/** Generate a sequential invoice number */
function nextInvoiceNumber(): string {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(++invoiceCounter).padStart(4, '0')}`;
}

export const invoiceService = {
  /** Get all invoices */
  getAll(): Invoice[] {
    return repository.getAll('invoices');
  },

  /** Get invoice by ID */
  getById(id: string): Invoice | undefined {
    return repository.getById('invoices', id);
  },

  /** Create invoice from a sale */
  createFromSale(sale: Sale, daysUntilDue = 30): Invoice {
    const dueDate = new Date(Date.now() + daysUntilDue * 86400000).toISOString();
    const invoice: Invoice = {
      id: generateId(),
      invoiceNumber: nextInvoiceNumber(),
      saleId: sale.id,
      customerId: sale.customerId,
      customerName: sale.customerName,
      items: sale.items,
      subtotal: sale.subtotal,
      taxRate: sale.taxRate,
      taxAmount: sale.taxAmount,
      discount: sale.discount,
      total: sale.total,
      amountPaid: 0,
      amountDue: sale.total,
      status: 'draft',
      dueDate,
      createdAt: getCurrentISODate(),
    };
    repository.insert('invoices', invoice);
    return invoice;
  },

  /** Create a standalone invoice */
  create(data: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'>): Invoice {
    const invoice: Invoice = {
      ...data,
      id: generateId(),
      invoiceNumber: nextInvoiceNumber(),
      createdAt: getCurrentISODate(),
    };
    repository.insert('invoices', invoice);
    return invoice;
  },

  /** Update invoice */
  update(id: string, data: Partial<Omit<Invoice, 'id' | 'createdAt'>>): boolean {
    return repository.update('invoices', id, data);
  },

  /** Record a payment */
  recordPayment(id: string, amount: number): boolean {
    const invoice = repository.getById('invoices', id);
    if (!invoice) return false;
    const amountPaid = invoice.amountPaid + amount;
    const amountDue = Math.max(0, invoice.total - amountPaid);
    const status: Invoice['status'] = amountDue === 0 ? 'paid' : 'sent';
    return repository.update('invoices', id, { amountPaid, amountDue, status });
  },

  /** Mark overdue invoices */
  markOverdue(): void {
    const now = new Date();
    repository.getAll('invoices').forEach((inv) => {
      if (inv.status === 'sent' && new Date(inv.dueDate) < now) {
        repository.update('invoices', inv.id, { status: 'overdue' });
      }
    });
  },

  /** Delete invoice */
  delete(id: string): boolean {
    return repository.delete('invoices', id);
  },

  /** Get invoices by customer */
  getByCustomer(customerId: string): Invoice[] {
    return repository.getAll('invoices').filter((i) => i.customerId === customerId);
  },
};
