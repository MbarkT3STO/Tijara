/**
 * Fiscal Period service.
 */

import { repository } from '@data/repository';
import type { FiscalPeriod } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';

class FiscalPeriodService {
  getAll(): FiscalPeriod[] {
    return repository.getAll('fiscalPeriods');
  }

  getById(id: string): FiscalPeriod | undefined {
    return repository.getById('fiscalPeriods', id);
  }

  getCurrent(): FiscalPeriod | undefined {
    return this.getAll().find((p) => p.isCurrent);
  }

  getOpen(): FiscalPeriod[] {
    return this.getAll().filter((p) => p.status === 'open');
  }

  async create(data: Omit<FiscalPeriod, 'id' | 'createdAt'>): Promise<FiscalPeriod> {
    const fp: FiscalPeriod = { ...data, id: generateId(), createdAt: getCurrentISODate() };
    repository.insert('fiscalPeriods', fp);
    return fp;
  }

  async update(id: string, data: Partial<FiscalPeriod>): Promise<FiscalPeriod> {
    repository.update('fiscalPeriods', id, data);
    return this.getById(id)!;
  }

  async closePeriod(id: string, closedBy: string): Promise<FiscalPeriod> {
    const entries = repository.getAll('journalEntries');
    const drafts = entries.filter((e) => e.fiscalPeriodId === id && e.status === 'draft');
    if (drafts.length > 0) {
      throw new Error(`Cannot close period: ${drafts.length} draft journal entries exist.`);
    }
    repository.update('fiscalPeriods', id, {
      status: 'closed',
      isCurrent: false,
      closedAt: getCurrentISODate(),
      closedBy,
    });
    return this.getById(id)!;
  }

  async delete(id: string): Promise<void> {
    repository.delete('fiscalPeriods', id);
  }
}

export const fiscalPeriodService = new FiscalPeriodService();
