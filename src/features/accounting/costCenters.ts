/**
 * Cost Centers feature page.
 */

import { costCenterService } from '@services/costCenterService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { debounce, escapeHtml } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import { menuTriggerHTML, attachMenuTriggers } from '@shared/utils/actionMenu';
import type { CostCenter } from '@core/types';

const PAGE_SIZE = 15;

interface State {
  centers: CostCenter[];
  filtered: CostCenter[];
  page: number;
  search: string;
}

export function renderCostCenters(): HTMLElement {
  const state: State = {
    centers: costCenterService.getAll(),
    filtered: [],
    page: 1,
    search: '',
  };
  state.filtered = [...state.centers];

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function applyFilters() {
    let data = [...state.centers];
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
    }
    state.filtered = data;
    state.page = 1;
  }

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    page.querySelector<HTMLInputElement>('#cc-search')?.addEventListener(
      'input',
      debounce((e: Event) => {
        state.search = (e.target as HTMLInputElement).value;
        applyFilters(); render();
      }, 300) as EventListener
    );

    page.querySelector('#add-cc-btn')?.addEventListener('click', () => {
      openCostCenterModal(null, () => { state.centers = costCenterService.getAll(); applyFilters(); render(); });
    });

    attachMenuTriggers(
      page,
      () => [
        { action: 'edit',   icon: Icons.edit(16),  label: i18n.t('common.edit') },
        { action: 'delete', icon: Icons.trash(16), label: i18n.t('common.delete'), danger: true, dividerBefore: true },
      ],
      (action, id) => {
        const cc = costCenterService.getById(id);
        if (!cc) return;
        const refresh = () => { state.centers = costCenterService.getAll(); applyFilters(); render(); };
        if (action === 'edit')        openCostCenterModal(cc, refresh);
        else if (action === 'delete') confirmDialog(i18n.t('common.delete'), `${i18n.t('common.confirm')} "${cc.name}"?`, async () => {
          await costCenterService.delete(cc.id);
          notifications.success(i18n.t('common.save'));
          refresh();
        });
      }
    );

    page.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-page')!, 10);
        if (!isNaN(p)) { state.page = p; render(); }
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
  const allCenters = costCenterService.getAll();

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('accounting.costCenters.title' as any)}</h2>
        <p class="page-subtitle">${total} ${i18n.t('common.total' as any)}</p>
      </div>
      <button class="btn btn-primary" id="add-cc-btn">${Icons.plus()} ${i18n.t('accounting.costCenters.addCostCenter' as any)}</button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="search-bar" style="flex:1;max-width:360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input type="search" id="cc-search" class="form-control" placeholder="${i18n.t('common.search')}..." value="${state.search}" />
        </div>
      </div>

      <div class="table-container" style="border:none;border-radius:0;">
        <table class="data-table">
          <thead><tr>
            <th>${i18n.t('accounting.costCenters.code' as any)}</th>
            <th>${i18n.t('accounting.costCenters.name' as any)}</th>
            <th>${i18n.t('accounting.costCenters.parent' as any)}</th>
            <th>${i18n.t('accounting.costCenters.description' as any)}</th>
            <th>${i18n.t('common.status')}</th>
            <th>${i18n.t('common.actions')}</th>
          </tr></thead>
          <tbody>
            ${pageData.length === 0
              ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">${Icons.costCenter(32)}</div><p class="empty-state-title">${i18n.t('common.noData')}</p></div></td></tr>`
              : pageData.map((c) => {
                  const parent = c.parentId ? allCenters.find((p) => p.id === c.parentId) : null;
                  return `
                    <tr>
                      <td><span style="font-weight:600;color:var(--color-primary);font-family:monospace;">${escapeHtml(c.code)}</span></td>
                      <td style="font-weight:500;">${escapeHtml(c.name)}</td>
                      <td style="color:var(--color-text-secondary);">${parent ? `${escapeHtml(parent.code)} · ${escapeHtml(parent.name)}` : '—'}</td>
                      <td style="color:var(--color-text-secondary);font-size:var(--font-size-xs);">${c.description ? escapeHtml(c.description) : '—'}</td>
                      <td><span class="badge ${c.isActive ? 'badge-success' : 'badge-neutral'}">${c.isActive ? i18n.t('accounting.costCenters.isActive' as any) : i18n.t('common.no')}</span></td>
                      <td>
                        <div class="table-actions">
                          ${menuTriggerHTML(c.id)}
                        </div>
                      </td>
                    </tr>`;
                }).join('')
            }
          </tbody>
        </table>
      </div>
      ${buildPagination(state.page, totalPages, total, start, pageData.length)}
    </div>
  `;
}

function buildPagination(page: number, totalPages: number, total: number, start: number, count: number): string {
  if (total === 0) return '';
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return `
    <div class="pagination">
      <span class="pagination-info">${i18n.t('common.showing' as any)} ${start + 1}–${start + count} ${i18n.t('common.of')} ${total}</span>
      <div class="pagination-controls">
        <button class="pagination-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>${Icons.chevronLeft(16)}</button>
        ${pages.map((p) => `<button class="pagination-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`).join('')}
        <button class="pagination-btn" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>${Icons.chevronRight(16)}</button>
      </div>
    </div>`;
}

function openCostCenterModal(cc: CostCenter | null, onSave: () => void): void {
  const isEdit = cc !== null;
  const allCenters = costCenterService.getAll().filter((c) => c.id !== cc?.id);

  const form = document.createElement('div');
  form.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="cc-code">${i18n.t('accounting.costCenters.code' as any)}</label>
        <input type="text" id="cc-code" class="form-control" value="${cc?.code ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label required" for="cc-name">${i18n.t('accounting.costCenters.name' as any)}</label>
        <input type="text" id="cc-name" class="form-control" value="${cc?.name ?? ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="cc-parent">${i18n.t('accounting.costCenters.parent' as any)}</label>
      <select id="cc-parent" class="form-control">
        <option value="">— ${i18n.t('common.all')} —</option>
        ${allCenters.map((c) => `<option value="${c.id}" ${cc?.parentId === c.id ? 'selected' : ''}>${escapeHtml(c.code)} · ${escapeHtml(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label" for="cc-desc">${i18n.t('accounting.costCenters.description' as any)}</label>
      <textarea id="cc-desc" class="form-control">${cc?.description ?? ''}</textarea>
    </div>
    <div class="form-group">
      <label class="checkbox-group">
        <input type="checkbox" id="cc-active" ${cc?.isActive !== false ? 'checked' : ''} />
        <span>${i18n.t('accounting.costCenters.isActive' as any)}</span>
      </label>
    </div>
  `;

  openModal({
    title: isEdit ? `${i18n.t('common.edit')} ${cc!.name}` : i18n.t('accounting.costCenters.addCostCenter' as any),
    content: form,
    confirmText: i18n.t('common.save'),
    onConfirm: async () => {
      const code = (form.querySelector('#cc-code') as HTMLInputElement).value.trim();
      const name = (form.querySelector('#cc-name') as HTMLInputElement).value.trim();
      if (!code || !name) { showModalError(form, i18n.t('errors.required'), [...(!code ? ['cc-code'] : []), ...(!name ? ['cc-name'] : [])]); return false; }

      const data = {
        code,
        name,
        parentId: (form.querySelector('#cc-parent') as HTMLSelectElement).value || undefined,
        description: (form.querySelector('#cc-desc') as HTMLTextAreaElement).value.trim() || undefined,
        isActive: (form.querySelector('#cc-active') as HTMLInputElement).checked,
      };

      if (isEdit) {
        await costCenterService.update(cc!.id, data);
      } else {
        await costCenterService.create(data);
      }
      notifications.success(i18n.t('common.save'));
      onSave();
    },
  });
}
