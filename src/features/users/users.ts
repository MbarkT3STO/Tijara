/**
 * Users management feature page.
 */

import { userService } from '@services/userService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatDate, formatDateTime, getInitials, debounce } from '@shared/utils/helpers';
import type { User, UserRole } from '@core/types';

const PAGE_SIZE = 10;

interface State {
  users: User[];
  filtered: User[];
  page: number;
  search: string;
}

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'badge-error',
  manager: 'badge-primary',
  sales: 'badge-info',
  viewer: 'badge-neutral',
};

/** Render and return the users page */
export function renderUsers(): HTMLElement {
  const state: State = {
    users: userService.getAll(),
    filtered: [],
    page: 1,
    search: '',
  };

  state.filtered = [...state.users];

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    page.querySelector<HTMLInputElement>('#user-search')?.addEventListener(
      'input',
      debounce((e: Event) => {
        state.search = (e.target as HTMLInputElement).value;
        const q = state.search.toLowerCase();
        state.filtered = q
          ? state.users.filter(
              (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
            )
          : [...state.users];
        state.page = 1;
        render();
      }, 300) as EventListener
    );

    page.querySelector('#add-user-btn')?.addEventListener('click', () => {
      openUserModal(null, () => {
        state.users = userService.getAll();
        state.filtered = [...state.users];
        render();
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit')!;
        const user = userService.getById(id);
        if (!user) return;
        openUserModal(user, () => {
          state.users = userService.getAll();
          state.filtered = state.search
            ? state.users.filter(
                (u) =>
                  u.name.toLowerCase().includes(state.search.toLowerCase()) ||
                  u.email.toLowerCase().includes(state.search.toLowerCase())
              )
            : [...state.users];
          render();
        });
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-toggle')!;
        userService.toggleActive(id);
        state.users = userService.getAll();
        state.filtered = [...state.users];
        render();
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete')!;
        const user = userService.getById(id);
        if (!user) return;
        confirmDialog('Delete User', `Delete user "${user.name}"?`, () => {
          userService.delete(id);
          notifications.success('User deleted.');
          state.users = userService.getAll();
          state.filtered = [...state.users];
          render();
        });
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-page')!, 10);
        if (!isNaN(p)) {
          state.page = p;
          render();
        }
      });
    });
  }

  render();
  return page;
}

function buildHTML(state: State): string {
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (state.page - 1) * PAGE_SIZE;
  const pageData = state.filtered.slice(start, start + PAGE_SIZE);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Users</h2>
        <p class="page-subtitle">${total} user${total !== 1 ? 's' : ''} total</p>
      </div>
      <button class="btn btn-primary" id="add-user-btn">
        ${Icons.plus()} Add User
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="search-bar" style="flex: 1; max-width: 360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input type="search" id="user-search" class="form-control" placeholder="Search users..." value="${state.search}" aria-label="Search users" />
        </div>
      </div>

      <div class="table-container" style="border: none; border-radius: 0;">
        <table class="data-table" aria-label="Users list">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              pageData.length === 0
                ? `<tr><td colspan="7">
                    <div class="empty-state">
                      <div class="empty-state-icon">${Icons.users(32)}</div>
                      <p class="empty-state-title">No users found</p>
                      <p class="empty-state-desc">${state.search ? 'Try a different search.' : 'Add your first user.'}</p>
                    </div>
                  </td></tr>`
                : pageData
                    .map(
                      (u) => `
              <tr>
                <td>
                  <div style="display: flex; align-items: center; gap: var(--space-3);">
                    <div class="avatar avatar-sm" style="${!u.active ? 'opacity: 0.5;' : ''}">${getInitials(u.name)}</div>
                    <span style="font-weight: 500; ${!u.active ? 'color: var(--color-text-tertiary);' : ''}">${u.name}</span>
                  </div>
                </td>
                <td style="color: var(--color-text-secondary);">${u.email}</td>
                <td><span class="badge ${ROLE_BADGE[u.role]}">${userService.getRoleLabel(u.role)}</span></td>
                <td>
                  <span class="badge ${u.active ? 'badge-success' : 'badge-neutral'}">
                    ${u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style="color: var(--color-text-secondary);">${u.lastLogin ? formatDateTime(u.lastLogin) : '—'}</td>
                <td style="color: var(--color-text-secondary);">${formatDate(u.createdAt)}</td>
                <td>
                  <div class="table-actions">
                    <button class="btn btn-ghost btn-icon btn-sm" data-edit="${u.id}" aria-label="Edit ${u.name}" data-tooltip="Edit">
                      ${Icons.edit(16)}
                    </button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-toggle="${u.id}" aria-label="${u.active ? 'Deactivate' : 'Activate'} ${u.name}" data-tooltip="${u.active ? 'Deactivate' : 'Activate'}" style="color: ${u.active ? 'var(--color-warning)' : 'var(--color-success)'};">
                      ${u.active ? Icons.close(16) : Icons.check(16)}
                    </button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-delete="${u.id}" aria-label="Delete ${u.name}" data-tooltip="Delete" style="color: var(--color-error);">
                      ${Icons.trash(16)}
                    </button>
                  </div>
                </td>
              </tr>
            `
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>

      ${buildPagination(state.page, totalPages, total, start, pageData.length)}
    </div>
  `;
}

function buildPagination(
  page: number,
  totalPages: number,
  total: number,
  start: number,
  count: number
): string {
  if (total === 0) return '';
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return `
    <div class="pagination">
      <span class="pagination-info">Showing ${start + 1}–${start + count} of ${total}</span>
      <div class="pagination-controls">
        <button class="pagination-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>${Icons.chevronLeft(16)}</button>
        ${pages.map((p) => `<button class="pagination-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`).join('')}
        <button class="pagination-btn" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>${Icons.chevronRight(16)}</button>
      </div>
    </div>
  `;
}

function openUserModal(user: User | null, onSave: () => void): void {
  const isEdit = user !== null;

  const form = document.createElement('form');
  form.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="u-name">Full Name</label>
        <input type="text" id="u-name" class="form-control" placeholder="John Doe" value="${user?.name ?? ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label required" for="u-email">Email</label>
        <input type="email" id="u-email" class="form-control" placeholder="user@example.com" value="${user?.email ?? ''}" required />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="u-role">Role</label>
        <select id="u-role" class="form-control">
          <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Administrator</option>
          <option value="manager" ${user?.role === 'manager' ? 'selected' : ''}>Manager</option>
          <option value="sales" ${(!user || user.role === 'sales') ? 'selected' : ''}>Sales Rep</option>
          <option value="viewer" ${user?.role === 'viewer' ? 'selected' : ''}>Viewer</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="u-active">Status</label>
        <select id="u-active" class="form-control">
          <option value="true" ${user?.active !== false ? 'selected' : ''}>Active</option>
          <option value="false" ${user?.active === false ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
    </div>
  `;

  openModal({
    title: isEdit ? 'Edit User' : 'Add User',
    content: form,
    confirmText: isEdit ? 'Save Changes' : 'Add User',
    onConfirm: () => {
      const name = (form.querySelector('#u-name') as HTMLInputElement).value.trim();
      const email = (form.querySelector('#u-email') as HTMLInputElement).value.trim();
      if (!name || !email) {
        notifications.error('Name and email are required.');
        return;
      }

      const data = {
        name,
        email,
        role: (form.querySelector('#u-role') as HTMLSelectElement).value as UserRole,
        active: (form.querySelector('#u-active') as HTMLSelectElement).value === 'true',
      };

      if (isEdit) {
        userService.update(user!.id, data);
        notifications.success('User updated successfully.');
      } else {
        userService.create(data);
        notifications.success('User added successfully.');
      }
      onSave();
    },
  });
}
