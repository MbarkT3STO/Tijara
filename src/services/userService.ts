/**
 * User management service.
 */

import { repository } from '@data/excelRepository';
import type { User, UserRole } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';

export const userService = {
  /** Get all users */
  getAll(): User[] {
    return repository.getAll('users');
  },

  /** Get user by ID */
  getById(id: string): User | undefined {
    return repository.getById('users', id);
  },

  /** Create a new user (use authService.register for password-based creation) */
  create(data: Omit<User, 'id' | 'createdAt'>): User {
    const user: User = {
      ...data,
      id: generateId(),
      createdAt: getCurrentISODate(),
    };
    repository.insert('users', user);
    return user;
  },

  /** Update user */
  update(id: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): boolean {
    return repository.update('users', id, data);
  },

  /** Toggle user active status */
  toggleActive(id: string): boolean {
    const user = repository.getById('users', id);
    if (!user) return false;
    return repository.update('users', id, { active: !user.active });
  },

  /** Change user role */
  changeRole(id: string, role: UserRole): boolean {
    return repository.update('users', id, { role });
  },

  /** Delete user */
  delete(id: string): boolean {
    return repository.delete('users', id);
  },

  /** Get role display label */
  getRoleLabel(role: UserRole): string {
    return i18n.t(`users.roles.${role}` as any);
  },
};
