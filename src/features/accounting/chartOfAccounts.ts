/**
 * Chart of Accounts feature page.
 */

import { accountService } from '@services/accountService';
import { journalService } from '@services/journalService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { debounce, escapeHtml } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import { router } from '@core/router';
import { menuTriggerHTML, attachMenuTriggers } from '@shared/utils/actionMenu';
import type { Account, AccountType, AccountCategory } from '@core/types';

const PAGE_SIZE = 15;

interface State {
  accounts: Account[];
  filtered: Account[];
  page: number;
  search: string;
  typeFilter: AccountType | '';
}

const TYPE_BADGE: Record<AccountType, string> = {
  asset: 'badge-asset', liability: 'badge-liability', equity: 'badge-equity',
  revenue: 'badge-revenue', expense: 'badge-expense',
};

const CATEGORIES_BY_TYPE: Record<AccountType, AccountCategory[]> = {
  asset: ['current_asset', 'fixed_asset', 'other_asset'],
  liability: ['current_liability', 'long_term_liability'],
  equity: ['owners_equity', 'retained_earnings'],
  revenue: ['operating_revenue', 'other_revenue'],
  expense: ['cost_of_goods_sold', 'operating_expense', 'other_expense', 'tax_expense'],
};

export function renderChartOfAccounts(): HTMLElement {
  const state: State = {
    accounts: accountService.getAll(),
    filtered: [],
    page: 1,
    search: '',
    typeFilter: '',
  };
  state.filtered = [...state.accounts];

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function applyFilters() {
    let data = [...state.accounts];
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter((a) => a.code.includes(q) || a.name.toLowerCase().includes(q));
    }
    if (state.typeFilter) data = data.filter((a) => a.type === state.typeFilter);
    state.filtered = data.sort((a, b) => a.code.localeCompare(b.code));
    state.page = 1;
  }

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    page.querySelector<HTMLInputElement>('#acc-search')?.addEventListener(
      'input',
      debounce((e: Event) => {
        state.search = (e.target as HTMLInputElement).value;
        applyFilters(); render();
      }, 300) as EventListener
    );

    page.querySelector<HTMLSelectElement>('#acc-type-filter')?.addEventListener('change', (e) => {
      state.typeFilter = (e.target as HTMLSelectElement).value as AccountType | '';
      applyFilters(); render();
    });

    page.querySelector('#add-account-btn')?.addEventListener('click', () => {
      openAccountModal(null, () => { state.accounts = accountService.getAll(); applyFilters(); render(); });
    });

    attachMenuTriggers(
      page,
      (id) => {
        const acc = accountService.getById(id);
        return [
          { action: 'edit',   icon: Icons.edit(16),  label: i18n.t('common.edit') },
          { action: 'toggle', icon: acc?.isActive ? Icons.close(16) : Icons.check(16),
            label: acc?.isActive ? i18n.t('common.no') : i18n.t('common.yes') },
          ...(!acc?.isSystem ? [{ action: 'delete', icon: Icons.trash(16), label: i18n.t('common.delete'), danger: true, dividerBefore: true }] : []),
        ];
      },
      (action, id) => {
        const acc = accountService.getById(id);
        if (!acc) return;
        const refresh = () => { state.accounts = accountService.getAll(); applyFilters(); render(); };
        if (action === 'edit') {
          openAccountModal(acc, refresh);
        } else if (action === 'toggle') {
          accountService.update(acc.id, { isActive: !acc.isActive }).then(() => {
            notifications.success(i18n.t('common.save'));
            refresh();
          });
        } else if (action === 'delete') {
          if (acc.isSystem) { notifications.error(i18n.t('accounting.accounts.errors.cannotDeleteSystem' as any)); return; }
          const hasEntries = journalService.getAll().some((e) => e.lines.some((l) => l.accountId === acc.id));
          if (hasEntries) { notifications.error(i18n.t('accounting.accounts.errors.cannotDeleteWithEntries' as any)); return; }
          confirmDialog(i18n.t('common.delete'), `${i18n.t('common.confirm')} "${acc.name}"?`, async () => {
            await accountService.delete(acc.id);
            notifications.success(i18n.t('common.save'));
            refresh();
          });
        }
      }
    );

    page.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-page')!, 10);
        if (!isNaN(p)) { state.page = p; render(); }
      });
    });

    page.querySelector('#goto-setup-btn')?.addEventListener('click', () => {
      router.navigate('settings');
      setTimeout(() => {
        document.getElementById('accounting-setup-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
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
        <h2 class="page-title">${i18n.t('accounting.accounts.title' as any)}</h2>
        <p class="page-subtitle">${total} ${i18n.t('common.total' as any)}</p>
      </div>
      <button class="btn btn-primary" id="add-account-btn">${Icons.plus()} ${i18n.t('accounting.accounts.addAccount' as any)}</button>
    </div>

    <div class="card">
      <div class="card-header" style="gap:var(--space-3);flex-wrap:wrap;">
        <div class="search-bar" style="flex:1;max-width:360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input type="search" id="acc-search" class="form-control" placeholder="${i18n.t('common.search')}..." value="${state.search}" />
        </div>
        <select id="acc-type-filter" class="form-control" style="width:auto;">
          <option value="">${i18n.t('common.all')}</option>
          ${(['asset','liability','equity','revenue','expense'] as AccountType[]).map((t) =>
            `<option value="${t}" ${state.typeFilter === t ? 'selected' : ''}>${i18n.t(`accounting.accounts.types.${t}` as any)}</option>`
          ).join('')}
        </select>
      </div>

      <div class="table-container" style="border:none;border-radius:0;">
        <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th>${i18n.t('accounting.accounts.code' as any)}</th>
            <th>${i18n.t('accounting.accounts.name' as any)}</th>
            <th>${i18n.t('accounting.accounts.type' as any)}</th>
            <th>${i18n.t('accounting.accounts.category' as any)}</th>
            <th>${i18n.t('accounting.accounts.normalBalance' as any)}</th>
            <th>${i18n.t('common.status')}</th>
            <th>${i18n.t('common.actions')}</th>
          </tr></thead>
          <tbody>
            ${pageData.length === 0
              ? `<tr><td colspan="7"><div class="empty-state">
                  <div class="empty-state-icon">${Icons.chartOfAccounts(48)}</div>
                  <p class="empty-state-title">${i18n.t('settings.accountingSetup.emptyTitle' as any)}</p>
                  <p class="empty-state-subtitle">${i18n.t('settings.accountingSetup.emptySubtitle' as any)}</p>
                  <button class="btn btn-primary" id="goto-setup-btn">
                    ${Icons.settings(16)} ${i18n.t('settings.accountingSetup.setupCta' as any)}
                  </button>
                </div></td></tr>`
              : pageData.map((a) => {
                  const lang = i18n.currentLanguage;
                  const displayName = (lang === 'ar' && a.nameAr) ? a.nameAr
                    : (lang === 'fr' && a.nameFr) ? a.nameFr
                    : a.name;
                  const subName = lang === 'ar' ? (a.nameFr || a.name) : (a.nameAr || '');
                  return `
                <tr>
                  <td><span style="font-weight:600;color:var(--color-primary);font-family:monospace;">${escapeHtml(a.code)}</span></td>
                  <td>
                    <div style="font-weight:500;">${escapeHtml(displayName)}</div>
                    ${subName ? `<div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);direction:${lang === 'ar' ? 'ltr' : 'rtl'};text-align:start;">${escapeHtml(subName)}</div>` : ''}
                    ${a.isSystem ? `<span style="font-size:10px;color:var(--color-text-tertiary);">${i18n.t('accounting.accounts.isSystem' as any)}</span>` : ''}
                  </td>
                  <td><span class="badge ${TYPE_BADGE[a.type]}">${i18n.t(`accounting.accounts.types.${a.type}` as any)}</span></td>
                  <td style="color:var(--color-text-secondary);font-size:var(--font-size-xs);">${i18n.t(`accounting.accounts.categories.${a.category}` as any)}</td>
                  <td><span class="badge ${a.normalBalance === 'debit' ? 'badge-info' : 'badge-primary'}">${i18n.t(`accounting.accounts.normalBalances.${a.normalBalance}` as any)}</span></td>
                  <td><span class="badge ${a.isActive ? 'badge-success' : 'badge-neutral'}">${a.isActive ? i18n.t('accounting.accounts.isActive' as any) : i18n.t('common.no')}</span></td>
                  <td>
                    <div class="table-actions">
                      ${menuTriggerHTML(a.id)}
                    </div>
                  </td>
                </tr>`;
                }).join('')
            }
          </tbody>
        </table>
        </div>
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

function openAccountModal(account: Account | null, onSave: () => void): void {
  const isEdit = account !== null;
  const allAccounts = accountService.getAll();

  const form = document.createElement('div');

  const renderCategoryOptions = (type: AccountType) =>
    (CATEGORIES_BY_TYPE[type] ?? []).map((c) =>
      `<option value="${c}" ${account?.category === c ? 'selected' : ''}>${i18n.t(`accounting.accounts.categories.${c}` as any)}</option>`
    ).join('');

  form.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="a-code">${i18n.t('accounting.accounts.code' as any)}</label>
        <input type="text" id="a-code" class="form-control" value="${account?.code ?? ''}" placeholder="e.g. 1010" />
      </div>
      <div class="form-group">
        <label class="form-label required" for="a-type">${i18n.t('accounting.accounts.type' as any)}</label>
        <select id="a-type" class="form-control">
          ${(['asset','liability','equity','revenue','expense'] as AccountType[]).map((t) =>
            `<option value="${t}" ${account?.type === t ? 'selected' : ''}>${i18n.t(`accounting.accounts.types.${t}` as any)}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="a-name">${i18n.t('accounting.accounts.name' as any)}</label>
        <input type="text" id="a-name" class="form-control" value="${account?.name ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="a-category">${i18n.t('accounting.accounts.category' as any)}</label>
        <select id="a-category" class="form-control">
          ${renderCategoryOptions(account?.type ?? 'asset')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="a-name-ar">${i18n.t('accounting.accounts.nameAr' as any)}</label>
        <input type="text" id="a-name-ar" class="form-control" value="${account?.nameAr ?? ''}" dir="rtl" />
      </div>
      <div class="form-group">
        <label class="form-label" for="a-name-fr">${i18n.t('accounting.accounts.nameFr' as any)}</label>
        <input type="text" id="a-name-fr" class="form-control" value="${account?.nameFr ?? ''}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="a-parent">${i18n.t('accounting.accounts.parentAccount' as any)}</label>
        <select id="a-parent" class="form-control">
          <option value="">— ${i18n.t('common.all')} —</option>
          ${allAccounts.filter((a) => a.id !== account?.id).map((a) =>
            `<option value="${a.id}" ${account?.parentId === a.id ? 'selected' : ''}>${escapeHtml(a.code)} · ${escapeHtml(a.name)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="a-normal-balance">${i18n.t('accounting.accounts.normalBalance' as any)}</label>
        <select id="a-normal-balance" class="form-control">
          <option value="debit" ${account?.normalBalance === 'debit' ? 'selected' : ''}>${i18n.t('accounting.accounts.normalBalances.debit' as any)}</option>
          <option value="credit" ${account?.normalBalance === 'credit' ? 'selected' : ''}>${i18n.t('accounting.accounts.normalBalances.credit' as any)}</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="a-desc">${i18n.t('accounting.accounts.description' as any)}</label>
      <textarea id="a-desc" class="form-control">${account?.description ?? ''}</textarea>
    </div>
    <div class="form-group">
      <label class="checkbox-group">
        <input type="checkbox" id="a-active" ${account?.isActive !== false ? 'checked' : ''} />
        <span>${i18n.t('accounting.accounts.isActive' as any)}</span>
      </label>
    </div>
  `;

  // Update category options when type changes
  form.querySelector<HTMLSelectElement>('#a-type')?.addEventListener('change', (e) => {
    const type = (e.target as HTMLSelectElement).value as AccountType;
    const catSel = form.querySelector<HTMLSelectElement>('#a-category')!;
    catSel.innerHTML = renderCategoryOptions(type);
    // Auto-set normal balance
    const nbSel = form.querySelector<HTMLSelectElement>('#a-normal-balance')!;
    nbSel.value = (type === 'asset' || type === 'expense') ? 'debit' : 'credit';
  });

  openModal({
    title: isEdit ? `${i18n.t('common.edit')} ${account!.code}` : i18n.t('accounting.accounts.addAccount' as any),
    content: form,
    confirmText: i18n.t('common.save'),
    onConfirm: async () => {
      const code = (form.querySelector('#a-code') as HTMLInputElement).value.trim();
      const name = (form.querySelector('#a-name') as HTMLInputElement).value.trim();
      if (!code) { showModalError(form, i18n.t('accounting.accounts.errors.codeRequired' as any), ['a-code']); return false; }
      if (!name) { showModalError(form, i18n.t('accounting.accounts.errors.nameRequired' as any), ['a-name']); return false; }
      if (!accountService.isCodeUnique(code, account?.id)) {
        showModalError(form, i18n.t('accounting.accounts.errors.codeExists' as any), ['a-code']); return false;
      }

      const data = {
        code,
        name,
        nameAr: (form.querySelector('#a-name-ar') as HTMLInputElement).value.trim() || undefined,
        nameFr: (form.querySelector('#a-name-fr') as HTMLInputElement).value.trim() || undefined,
        type: (form.querySelector('#a-type') as HTMLSelectElement).value as AccountType,
        category: (form.querySelector('#a-category') as HTMLSelectElement).value as AccountCategory,
        normalBalance: (form.querySelector('#a-normal-balance') as HTMLSelectElement).value as 'debit' | 'credit',
        parentId: (form.querySelector('#a-parent') as HTMLSelectElement).value || undefined,
        description: (form.querySelector('#a-desc') as HTMLTextAreaElement).value.trim() || undefined,
        isActive: (form.querySelector('#a-active') as HTMLInputElement).checked,
        isSystem: account?.isSystem ?? false,
      };

      if (isEdit) {
        await accountService.update(account!.id, data);
      } else {
        await accountService.create(data);
      }
      notifications.success(i18n.t('common.save'));
      onSave();
    },
  });
}
