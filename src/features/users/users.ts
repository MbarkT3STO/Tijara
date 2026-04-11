/**
 * Users management feature page.
 */

import { userService } from '@services/userService';
import { authService } from '@services/authService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatDate, formatDateTime, getInitials, debounce, escapeHtml } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import { resolveAuthError } from '@features/auth/auth';
import { menuTriggerHTML, attachMenuTriggers } from '@shared/utils/actionMenu';
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

    attachMenuTriggers(
      page,
      (id) => {
        const u = userService.getById(id);
        return [
          { action: 'edit',   icon: Icons.edit(16),  label: i18n.t('common.edit') },
          { action: 'toggle', icon: u?.active ? Icons.close(16) : Icons.check(16),
            label: u?.active ? i18n.t('users.inactive') : i18n.t('users.active') },
          { action: 'delete', icon: Icons.trash(16), label: i18n.t('common.delete'), danger: true, dividerBefore: true },
        ];
      },
      (action, id) => {
        const user = userService.getById(id);
        if (!user) return;
        const refresh = () => {
          state.users = userService.getAll();
          state.filtered = state.search
            ? state.users.filter((u) => u.name.toLowerCase().includes(state.search.toLowerCase()) || u.email.toLowerCase().includes(state.search.toLowerCase()))
            : [...state.users];
          render();
        };
        if (action === 'edit') {
          openUserModal(user, refresh);
        } else if (action === 'toggle') {
          userService.toggleActive(id);
          refresh();
        } else if (action === 'delete') {
          confirmDialog(i18n.t('common.delete'), `${i18n.t('common.confirm')} "${user.name}"?`, () => {
            userService.delete(id);
            notifications.success(i18n.t('common.save'));
            refresh();
          });
        }
      }
    );

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
        <h2 class="page-title">${i18n.t('users.title')}</h2>
        <p class="page-subtitle">${i18n.t('users.subtitle', { count: total })}</p>
      </div>
      <button class="btn btn-primary" id="add-user-btn">
        ${Icons.plus()} ${i18n.t('users.addNew')}
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="search-bar" style="flex: 1; max-width: 360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input type="search" id="user-search" class="form-control" placeholder="${i18n.t('common.search')}" value="${state.search}" aria-label="${i18n.t('common.search')}" />
        </div>
      </div>

      <div class="table-container" style="border: none; border-radius: 0;">
        <div class="table-scroll">
        <table class="data-table" aria-label="Users list">
          <thead>
            <tr>
              <th>${i18n.t('users.user')}</th>
              <th>${i18n.t('users.email')}</th>
              <th>${i18n.t('users.role')}</th>
              <th>${i18n.t('common.status')}</th>
              <th>${i18n.t('users.lastLogin')}</th>
              <th>${i18n.t('users.created')}</th>
              <th>${i18n.t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${
              pageData.length === 0
                ? `<tr><td colspan="7">
                    <div class="empty-state">
                      <div class="empty-state-icon">${Icons.users(32)}</div>
                      <p class="empty-state-title">${i18n.t('common.noData')}</p>
                      <p class="empty-state-desc">${state.search ? i18n.t('common.noData') : i18n.t('users.addNew')}</p>
                    </div>
                  </td></tr>`
                : pageData
                    .map(
                      (u) => `
              <tr>
                <td>
                  <div style="display: flex; align-items: center; gap: var(--space-3);">
                    <div class="avatar avatar-sm" style="${!u.active ? 'opacity: 0.5;' : ''}">${getInitials(u.name)}</div>
                    <span style="font-weight: 500; ${!u.active ? 'color: var(--color-text-tertiary);' : ''}">${escapeHtml(u.name)}</span>
                  </div>
                </td>
                <td style="color: var(--color-text-secondary);">${escapeHtml(u.email)}</td>
                <td><span class="badge ${ROLE_BADGE[u.role]}">${i18n.t(`users.roles.${u.role}` as any)}</span></td>
                <td>
                  <span class="badge ${u.active ? 'badge-success' : 'badge-neutral'}">
                    ${u.active ? i18n.t('users.active') : i18n.t('users.inactive')}
                  </span>
                </td>
                <td style="color: var(--color-text-secondary);">${u.lastLogin ? formatDateTime(u.lastLogin) : '—'}</td>
                <td style="color: var(--color-text-secondary);">${formatDate(u.createdAt)}</td>
                <td>
                    <div class="table-actions">
                      ${menuTriggerHTML(u.id)}
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
      <span class="pagination-info">${i18n.t('common.showing')} ${start + 1}–${start + count} ${i18n.t('common.of')} ${total}</span>
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
        <label class="form-label required" for="u-name">${i18n.t('users.modals.fullName')}</label>
        <input type="text" id="u-name" class="form-control" placeholder="John Doe" value="${user?.name ?? ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label required" for="u-email">${i18n.t('users.email')}</label>
        <input type="email" id="u-email" class="form-control" placeholder="user@example.com" value="${user?.email ?? ''}" required />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="u-role">${i18n.t('users.role')}</label>
        <select id="u-role" class="form-control">
          <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>${i18n.t('users.roles.admin')}</option>
          <option value="manager" ${user?.role === 'manager' ? 'selected' : ''}>${i18n.t('users.roles.manager')}</option>
          <option value="sales" ${(!user || user.role === 'sales') ? 'selected' : ''}>${i18n.t('users.roles.sales')}</option>
          <option value="viewer" ${user?.role === 'viewer' ? 'selected' : ''}>${i18n.t('users.roles.viewer')}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="u-active">${i18n.t('common.status')}</label>
        <select id="u-active" class="form-control">
          <option value="true" ${user?.active !== false ? 'selected' : ''}>${i18n.t('users.active')}</option>
          <option value="false" ${user?.active === false ? 'selected' : ''}>${i18n.t('users.inactive')}</option>
        </select>
      </div>
    </div>
    ${!isEdit ? `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="u-password">${i18n.t('users.modals.password')}</label>
        <input type="password" id="u-password" class="form-control" placeholder="${i18n.t('users.modals.minChars')}" required />
      </div>
      <div class="form-group">
        <label class="form-label required" for="u-confirm">${i18n.t('users.modals.confirmPassword')}</label>
        <input type="password" id="u-confirm" class="form-control" placeholder="${i18n.t('users.modals.repeatPassword')}" required />
      </div>
    </div>` : `
    <div class="form-group">
      <label class="form-label" for="u-new-password">${i18n.t('users.modals.resetPassword')} <span style="color:var(--color-text-tertiary);font-weight:400;">${i18n.t('users.modals.passwordHint')}</span></label>
      <input type="password" id="u-new-password" class="form-control" placeholder="${i18n.t('users.modals.resetPassword')}…" />
    </div>`}
  `;

  openModal({
    title: isEdit ? i18n.t('users.modals.editTitle') : i18n.t('users.modals.addTitle'),
    content: form,
    confirmText: isEdit ? i18n.t('products.modals.saveChanges') : i18n.t('users.addNew'),
    onConfirm: async () => {
      const name = (form.querySelector('#u-name') as HTMLInputElement).value.trim();
      const email = (form.querySelector('#u-email') as HTMLInputElement).value.trim();
      if (!name || !email) {
        showModalError(form, i18n.t('errors.required'), [
          ...(!name ? ['u-name'] : []),
          ...(!email ? ['u-email'] : []),
        ]);
        return false;
      }

      const role = (form.querySelector('#u-role') as HTMLSelectElement).value as UserRole;
      const active = (form.querySelector('#u-active') as HTMLSelectElement).value === 'true';

      if (isEdit) {
        userService.update(user!.id, { name, email, role, active });

        // Optional password reset
        const newPw = (form.querySelector('#u-new-password') as HTMLInputElement)?.value;
        if (newPw && newPw.length >= 6) {
          await authService.adminResetPassword(user!.id, newPw);
        } else if (newPw && newPw.length > 0) {
          showModalError(form, i18n.t('users.modals.pwRequirement'), ['u-new-password']);
          return false;
        }

        notifications.success(i18n.t('common.save'));
      } else {
        const password = (form.querySelector('#u-password') as HTMLInputElement).value;
        const confirm = (form.querySelector('#u-confirm') as HTMLInputElement).value;
        if (!password || password.length < 6) {
          showModalError(form, i18n.t('users.modals.pwRequirement'), ['u-password']);
          return false;
        }
        if (password !== confirm) {
          showModalError(form, i18n.t('users.modals.pwMatch'), ['u-password', 'u-confirm']);
          return false;
        }
        try {
          await authService.register(name, email, password, role);
        } catch (err) {
          showModalError(form, resolveAuthError(err), ['u-email']);
          return false;
        }
        if (!active) {
          const users = userService.getAll();
          const created = users.find((u) => u.email === email);
          if (created) userService.update(created.id, { active: false });
        }
        notifications.success(i18n.t('common.save'));
      }
      onSave();
    },
  });
}
