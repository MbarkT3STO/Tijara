/**
 * Supplier business logic service.
 */

import { repository } from '@data/excelRepository';
import type { Supplier } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';

export const supplierService = {
  getAll(): Supplier[] {
    return repository.getAll('suppliers');
  },

  getById(id: string): Supplier | undefined {
    return repository.getById('suppliers', id);
  },

  create(data: Omit<Supplier, 'id' | 'createdAt'>): Supplier {
    const supplier: Supplier = {
      ...data,
      id: generateId(),
      createdAt: getCurrentISODate(),
    };
    repository.insert('suppliers', supplier);
    return supplier;
  },

  update(id: string, data: Partial<Omit<Supplier, 'id' | 'createdAt'>>): boolean {
    return repository.update('suppliers', id, data);
  },

  delete(id: string): boolean {
    return repository.delete('suppliers', id);
  },

  search(query: string): Supplier[] {
    const q = query.toLowerCase();
    return repository
      .getAll('suppliers')
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.contactPerson.toLowerCase().includes(q) ||
          s.phone.includes(q)
      );
  },
};
