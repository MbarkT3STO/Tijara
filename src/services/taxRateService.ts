/**
 * Tax Rate service.
 */

import { repository } from '@data/excelRepository';
import type { TaxRate } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';

class TaxRateService {
  getAll(): TaxRate[] {
    return repository.getAll('taxRates');
  }

  getById(id: string): TaxRate | undefined {
    return repository.getById('taxRates', id);
  }

  getDefault(): TaxRate | undefined {
    return this.getAll().find((t) => t.isDefault && t.isActive);
  }

  getActive(): TaxRate[] {
    return this.getAll().filter((t) => t.isActive);
  }

  async create(data: Omit<TaxRate, 'id' | 'createdAt'>): Promise<TaxRate> {
    const tr: TaxRate = { ...data, id: generateId(), createdAt: getCurrentISODate() };
    repository.insert('taxRates', tr);
    return tr;
  }

  async update(id: string, data: Partial<TaxRate>): Promise<TaxRate> {
    repository.update('taxRates', id, data);
    return this.getById(id)!;
  }

  async delete(id: string): Promise<void> {
    repository.delete('taxRates', id);
  }
}

export const taxRateService = new TaxRateService();
