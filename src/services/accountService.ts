/**
 * Account (Chart of Accounts) service.
 */

import { repository } from '@data/excelRepository';
import type { Account, AccountType, AccountCategory } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';

class AccountService {
  getAll(): Account[] {
    return repository.getAll('accounts');
  }

  getById(id: string): Account | undefined {
    return repository.getById('accounts', id);
  }

  getByCode(code: string): Account | undefined {
    return this.getAll().find((a) => a.code === code);
  }

  getByType(type: AccountType): Account[] {
    return this.getAll().filter((a) => a.type === type);
  }

  getByCategory(category: AccountCategory): Account[] {
    return this.getAll().filter((a) => a.category === category);
  }

  getActive(): Account[] {
    return this.getAll().filter((a) => a.isActive);
  }

  isCodeUnique(code: string, excludeId?: string): boolean {
    return !this.getAll().some((a) => a.code === code && a.id !== excludeId);
  }

  async create(data: Omit<Account, 'id' | 'createdAt'>): Promise<Account> {
    const account: Account = { ...data, id: generateId(), createdAt: getCurrentISODate() };
    repository.insert('accounts', account);
    return account;
  }

  async update(id: string, data: Partial<Account>): Promise<Account> {
    repository.update('accounts', id, data);
    return this.getById(id)!;
  }

  async delete(id: string): Promise<void> {
    repository.delete('accounts', id);
  }
}

export const accountService = new AccountService();
