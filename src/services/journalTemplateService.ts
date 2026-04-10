/**
 * Journal Template Service.
 * Manages reusable journal entry templates for recurring entries
 * (payroll, depreciation, rent, etc.).
 */

import { repository } from '@data/excelRepository';
import type { JournalTemplate } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';

class JournalTemplateService {
  getAll(): JournalTemplate[] {
    return repository.getAll('journalTemplates');
  }

  getById(id: string): JournalTemplate | undefined {
    return repository.getById('journalTemplates', id);
  }

  create(data: Omit<JournalTemplate, 'id' | 'createdAt'>): JournalTemplate {
    const template: JournalTemplate = {
      ...data,
      id: generateId(),
      createdAt: getCurrentISODate(),
    };
    repository.insert('journalTemplates', template);
    return template;
  }

  update(id: string, data: Partial<Omit<JournalTemplate, 'id' | 'createdAt'>>): JournalTemplate | undefined {
    repository.update('journalTemplates', id, data);
    return this.getById(id);
  }

  delete(id: string): void {
    repository.delete('journalTemplates', id);
  }
}

export const journalTemplateService = new JournalTemplateService();
