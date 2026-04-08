/**
 * Customer business logic service.
 * Wraps repository access with validation and ID generation.
 */

import { repository } from '@data/excelRepository';
import type { Customer } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';

export const customerService = {
  /** Get all customers */
  getAll(): Customer[] {
    return repository.getAll('customers');
  },

  /** Get customer by ID */
  getById(id: string): Customer | undefined {
    return repository.getById('customers', id);
  },

  /** Create a new customer */
  create(data: Omit<Customer, 'id' | 'createdAt'>): Customer {
    const customer: Customer = {
      ...data,
      id: generateId(),
      createdAt: getCurrentISODate(),
    };
    repository.insert('customers', customer);
    return customer;
  },

  /** Update an existing customer */
  update(id: string, data: Partial<Omit<Customer, 'id' | 'createdAt'>>): boolean {
    return repository.update('customers', id, data);
  },

  /** Delete a customer */
  delete(id: string): boolean {
    return repository.delete('customers', id);
  },

  /** Search customers by name, email, or phone */
  search(query: string): Customer[] {
    const q = query.toLowerCase();
    return repository
      .getAll('customers')
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.includes(q)
      );
  },
};
