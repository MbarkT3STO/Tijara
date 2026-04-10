/**
 * Cost Center service.
 */

import { repository } from '@data/excelRepository';
import type { CostCenter } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';

class CostCenterService {
  getAll(): CostCenter[] {
    return repository.getAll('costCenters');
  }

  getById(id: string): CostCenter | undefined {
    return repository.getById('costCenters', id);
  }

  getActive(): CostCenter[] {
    return this.getAll().filter((c) => c.isActive);
  }

  async create(data: Omit<CostCenter, 'id' | 'createdAt'>): Promise<CostCenter> {
    const cc: CostCenter = { ...data, id: generateId(), createdAt: getCurrentISODate() };
    repository.insert('costCenters', cc);
    return cc;
  }

  async update(id: string, data: Partial<CostCenter>): Promise<CostCenter> {
    repository.update('costCenters', id, data);
    return this.getById(id)!;
  }

  async delete(id: string): Promise<void> {
    repository.delete('costCenters', id);
  }
}

export const costCenterService = new CostCenterService();
