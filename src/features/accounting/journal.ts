/**
 * General Journal feature page.
 */

import { journalService } from '@services/journalService';
import { accountService } from '@services/accountService';
import { fiscalPeriodService } from '@services/fiscalPeriodService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatCurrency, formatDate, debounce, generateId } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import type { JournalEntry, JournalEntryStatus, JournalLine } from '@core/types';

const PAGE_SIZE = 10;

/** Translate a journalService error code to a localized string */
function translateJournalError(err: unknown): string {
  const msg = translateJournalError(err);
  const errorMap: Record<string, string> = {
    'ERR_MIN_TWO_LINES':             i18n.t('accounting.journal.errors.minTwoLines' as any),
    'ERR_MUST_BALANCE':              i18n.t('accounting.journal.errors.mustBalance' as any),
    'ERR_INVALID_LINE':              i18n.t('accounting.journal.errors.invalidLine' as any),
    'ERR_LINE_NON_ZERO':             i18n.t('accounting.journal.errors.lineNonZero' as any),
    'ERR_PERIOD_CLOSED':             i18n.t('accounting.journal.errors.periodClosed' as any),
    'ERR_ENTRY_NOT_FOUND':           i18n.t('accounting.journal.errors.entryNotFound' as any),
    'ERR_ONLY_DRAFT_CAN_BE_POSTED':  i18n.t('accounting.journal.errors.onlyDraftCanBePosted' as any),
    'ERR_ONLY_DRAFT_CAN_BE_DELETED': i18n.t('accounting.journal.errors.onlyDraftCanBeDeleted' as any),
    'ERR_ONLY_POSTED_CAN_BE_REVERSED': i18n.t('accounting.journal.errors.onlyPostedCanBeReversed' as any),
    'ERR_NO_OPEN_PERIOD':            i18n.t('accounting.journal.errors.noOpenPeriod' as any),
    'ERR_ENTRY_NOT_BALANCED':        i18n.t('accounting.journal.errors.entryNotBalanced' as any),
    'ERR_ACCOUNT_NOT_FOUND':         i18n.t('accounting.journal.errors.accountNotFound' as any),
  };
  if (msg in errorMap) return errorMap[msg];
  if (msg.startsWith('ERR_ACCOUNT_INACTIVE:')) {
    const code = msg.split(':')[1];
    return i18n.t('accounting.journal.errors.accountInactive' as any, { code });
  }
  return msg;
}

interface State {
  entries: JournalEntry[];
  filtered: JournalEntry[];
  page: number;
  search: string;
  statusFilter: JournalEntryStatus | '';
  expandedId: string | null;
}

const STATUS_BADGE: Record<JournalEntryStatus, string> = {
  draft: 'badge-warning', posted: 'badge-success', reversed: 'badge-neutral',
};

export function renderJournal(): HTMLElement {
  const state: State = {
    entries: journalService.getAll(),
    filtered: [],
    page: 1,
    search: '',
    statusFilter: '',
    expandedId: null,
  };
  state.filtered = [...state.entries].sort((a, b) => b.date.localeCompare(a.date));

  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function applyFilters() {
    let data = [...state.entries];
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter((e) => e.entryNumber.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
    }
    if (state.statusFilter) data = data.filter((e) => e.status === state.statusFilter);
    state.filtered = data.sort((a, b) => b.date.localeCompare(a.date));
    state.page = 1;
  }

  function render() {
    page.innerHTML = buildHTML(state);
    attachEvents();
  }

  function attachEvents() {
    page.querySelector<HTMLInputElement>('#je-search')?.addEventListener(
      'input',
      debounce((e: Event) => {
        state.search = (e.target as HTMLInputElement).value;
        applyFilters(); render();
      }, 300) as EventListener
    );

    page.querySelector<HTMLSelectElement>('#je-status-filter')?.addEventListener('change', (e) => {
      state.statusFilter = (e.target as HTMLSelectElement).value as JournalEntryStatus | '';
      applyFilters(); render();
    });

    page.querySelector('#add-je-btn')?.addEventListener('click', () => {
      openJournalModal(null, () => { state.entries = journalService.getAll(); applyFilters(); render(); });
    });

    // Row expand
    page.querySelectorAll<HTMLTableRowElement>('[data-expand]').forEach((row) => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-expand')!;
        state.expandedId = state.expandedId === id ? null : id;
        render();
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const entry = journalService.getById(btn.getAttribute('data-edit')!);
        if (entry) openJournalModal(entry, () => { state.entries = journalService.getAll(); applyFilters(); render(); });
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-post]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await journalService.postEntry(btn.getAttribute('data-post')!);
          notifications.success(i18n.t('accounting.journal.postEntry' as any));
          state.entries = journalService.getAll(); applyFilters(); render();
        } catch (err) {
          notifications.error(translateJournalError(err));
        }
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const entry = journalService.getById(btn.getAttribute('data-delete')!);
        if (!entry) return;
        confirmDialog(i18n.t('common.delete'), `${i18n.t('common.confirm')} "${entry.entryNumber}"?`, async () => {
          try {
            await journalService.deleteDraft(entry.id);
            notifications.success(i18n.t('common.save'));
            state.entries = journalService.getAll(); applyFilters(); render();
          } catch (err) {
            notifications.error(translateJournalError(err));
          }
        });
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-reverse]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const entry = journalService.getById(btn.getAttribute('data-reverse')!);
        if (!entry) return;
        openReversalModal(entry, () => { state.entries = journalService.getAll(); applyFilters(); render(); });
      });
    });

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

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('accounting.journal.title' as any)}</h2>
        <p class="page-subtitle">${total} ${i18n.t('common.total' as any)}</p>
      </div>
      <button class="btn btn-primary" id="add-je-btn">${Icons.plus()} ${i18n.t('accounting.journal.newEntry' as any)}</button>
    </div>

    <div class="card">
      <div class="card-header" style="gap:var(--space-3);flex-wrap:wrap;">
        <div class="search-bar" style="flex:1;max-width:360px;">
          <span class="search-icon">${Icons.search(16)}</span>
          <input type="search" id="je-search" class="form-control" placeholder="${i18n.t('common.search')}..." value="${state.search}" />
        </div>
        <select id="je-status-filter" class="form-control" style="width:auto;">
          <option value="">${i18n.t('common.all')}</option>
          <option value="draft" ${state.statusFilter === 'draft' ? 'selected' : ''}>${i18n.t('accounting.journal.statuses.draft' as any)}</option>
          <option value="posted" ${state.statusFilter === 'posted' ? 'selected' : ''}>${i18n.t('accounting.journal.statuses.posted' as any)}</option>
          <option value="reversed" ${state.statusFilter === 'reversed' ? 'selected' : ''}>${i18n.t('accounting.journal.statuses.reversed' as any)}</option>
        </select>
      </div>

      <div class="table-container" style="border:none;border-radius:0;">
        <table class="data-table">
          <thead><tr>
            <th></th>
            <th>${i18n.t('accounting.journal.entryNumber' as any)}</th>
            <th>${i18n.t('accounting.journal.date' as any)}</th>
            <th>${i18n.t('accounting.journal.description' as any)}</th>
            <th>${i18n.t('accounting.journal.source' as any)}</th>
            <th>${i18n.t('accounting.journal.debitTotal' as any)}</th>
            <th>${i18n.t('accounting.journal.creditTotal' as any)}</th>
            <th>${i18n.t('accounting.journal.status' as any)}</th>
            <th>${i18n.t('common.actions')}</th>
          </tr></thead>
          <tbody>
            ${pageData.length === 0
              ? `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">${Icons.journal(32)}</div><p class="empty-state-title">${i18n.t('common.noData')}</p></div></td></tr>`
              : pageData.flatMap((e) => {
                  const isExpanded = state.expandedId === e.id;
                  const rows = [`
                    <tr data-expand="${e.id}" style="cursor:pointer;">
                      <td style="color:var(--color-text-tertiary);">${isExpanded ? Icons.chevronDown(14) : Icons.chevronRight(14)}</td>
                      <td><span style="font-weight:600;color:var(--color-primary);">${e.entryNumber}</span></td>
                      <td style="color:var(--color-text-secondary);">${formatDate(e.date)}</td>
                      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.description}</td>
                      <td style="color:var(--color-text-secondary);font-size:var(--font-size-xs);">${i18n.t(`accounting.journal.sources.${e.sourceType}` as any)}</td>
                      <td><strong>${formatCurrency(e.totalDebit)}</strong></td>
                      <td><strong>${formatCurrency(e.totalCredit)}</strong></td>
                      <td><span class="badge ${STATUS_BADGE[e.status]}">${i18n.t(`accounting.journal.statuses.${e.status}` as any)}</span></td>
                      <td>
                        <div class="table-actions">
                          ${e.status === 'draft' ? `
                            <button class="btn btn-ghost btn-icon btn-sm" data-edit="${e.id}" data-tooltip="${i18n.t('common.edit')}">${Icons.edit(16)}</button>
                            <button class="btn btn-ghost btn-icon btn-sm" data-post="${e.id}" data-tooltip="${i18n.t('accounting.journal.postEntry' as any)}" style="color:var(--color-success);">${Icons.check(16)}</button>
                            <button class="btn btn-ghost btn-icon btn-sm" data-delete="${e.id}" data-tooltip="${i18n.t('common.delete')}" style="color:var(--color-error);">${Icons.trash(16)}</button>
                          ` : ''}
                          ${e.status === 'posted' ? `
                            <button class="btn btn-ghost btn-icon btn-sm" data-reverse="${e.id}" data-tooltip="${i18n.t('accounting.journal.reverseEntry' as any)}" style="color:var(--color-warning);">${Icons.refresh(16)}</button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>`];

                  if (isExpanded) {
                    rows.push(`
                      <tr>
                        <td colspan="9" style="padding:0;background:var(--color-bg-secondary);">
                          <div style="padding:var(--space-4);">
                            <table class="journal-lines-table">
                              <thead><tr>
                                <th>${i18n.t('accounting.journal.account' as any)}</th>
                                <th>${i18n.t('accounting.journal.description' as any)}</th>
                                <th style="text-align:right;">${i18n.t('accounting.journal.debit' as any)}</th>
                                <th style="text-align:right;">${i18n.t('accounting.journal.credit' as any)}</th>
                              </tr></thead>
                              <tbody>
                                ${e.lines.map((l) => `
                                  <tr>
                                    <td><span style="font-family:monospace;color:var(--color-primary);">${l.accountCode}</span> · ${l.accountName}</td>
                                    <td style="color:var(--color-text-secondary);">${l.description ?? '—'}</td>
                                    <td style="text-align:right;">${l.debit > 0 ? formatCurrency(l.debit) : '—'}</td>
                                    <td style="text-align:right;">${l.credit > 0 ? formatCurrency(l.credit) : '—'}</td>
                                  </tr>`).join('')}
                              </tbody>
                              <tfoot class="journal-lines-totals">
                                <tr>
                                  <td colspan="2" style="text-align:right;">${i18n.t('common.total')}</td>
                                  <td style="text-align:right;">${formatCurrency(e.totalDebit)}</td>
                                  <td style="text-align:right;">${formatCurrency(e.totalCredit)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </td>
                      </tr>`);
                  }
                  return rows;
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

function openJournalModal(entry: JournalEntry | null, onSave: () => void): void {
  const isEdit = entry !== null;
  const accounts = accountService.getActive();
  const openPeriods = fiscalPeriodService.getOpen();

  const lines: JournalLine[] = entry
    ? entry.lines.map((l) => ({ ...l }))
    : [
        { id: generateId(), accountId: '', accountCode: '', accountName: '', debit: 0, credit: 0 },
        { id: generateId(), accountId: '', accountCode: '', accountName: '', debit: 0, credit: 0 },
      ];

  const form = document.createElement('div');

  const renderLines = () => {
    const container = form.querySelector<HTMLElement>('#je-lines-container')!;
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    const diff = Math.abs(totalDebit - totalCredit);
    const balanced = diff < 0.01;

    container.innerHTML = `
      <table class="journal-lines-table">
        <thead><tr>
          <th style="width:35%;">${i18n.t('accounting.journal.account' as any)}</th>
          <th style="width:20%;">${i18n.t('accounting.journal.description' as any)}</th>
          <th style="width:15%;text-align:right;">${i18n.t('accounting.journal.debit' as any)}</th>
          <th style="width:15%;text-align:right;">${i18n.t('accounting.journal.credit' as any)}</th>
          <th style="width:5%;"></th>
        </tr></thead>
        <tbody>
          ${lines.map((l, idx) => `
            <tr>
              <td>
                <select class="form-control je-line-account" data-idx="${idx}" style="height:32px;font-size:var(--font-size-xs);">
                  <option value="">— ${i18n.t('accounting.journal.account' as any)} —</option>
                  ${accounts.map((a) => `<option value="${a.id}" data-code="${a.code}" data-name="${a.name}" ${l.accountId === a.id ? 'selected' : ''}>${a.code} · ${a.name}</option>`).join('')}
                </select>
              </td>
              <td><input type="text" class="form-control je-line-desc" data-idx="${idx}" value="${l.description ?? ''}" style="height:32px;font-size:var(--font-size-xs);" /></td>
              <td><input type="number" class="form-control je-line-debit" data-idx="${idx}" value="${l.debit || ''}" min="0" step="0.01" style="height:32px;text-align:right;font-size:var(--font-size-xs);" /></td>
              <td><input type="number" class="form-control je-line-credit" data-idx="${idx}" value="${l.credit || ''}" min="0" step="0.01" style="height:32px;text-align:right;font-size:var(--font-size-xs);" /></td>
              <td><button type="button" class="btn btn-ghost btn-icon btn-sm je-remove-line" data-idx="${idx}" style="color:var(--color-error);">${Icons.trash(14)}</button></td>
            </tr>`).join('')}
        </tbody>
        <tfoot class="journal-lines-totals">
          <tr>
            <td colspan="2" style="text-align:right;">${i18n.t('common.total')}</td>
            <td style="text-align:right;">${formatCurrency(totalDebit)}</td>
            <td style="text-align:right;">${formatCurrency(totalCredit)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-3);">
        <button type="button" class="btn btn-secondary btn-sm" id="je-add-line">${Icons.plus(14)} ${i18n.t('accounting.journal.addLine' as any)}</button>
        <span class="journal-balance-indicator ${balanced ? 'balanced' : 'unbalanced'}">
          ${balanced ? Icons.check(14) : Icons.alertCircle(14)}
          ${balanced
            ? i18n.t('accounting.journal.balanced' as any)
            : i18n.t('accounting.journal.unbalanced' as any, { amount: formatCurrency(diff) })
          }
        </span>
      </div>
    `;

    // Wire events
    container.querySelectorAll<HTMLSelectElement>('.je-line-account').forEach((sel) => {
      sel.addEventListener('change', () => {
        const idx = +sel.getAttribute('data-idx')!;
        const opt = sel.selectedOptions[0];
        lines[idx].accountId = sel.value;
        lines[idx].accountCode = opt?.getAttribute('data-code') ?? '';
        lines[idx].accountName = opt?.getAttribute('data-name') ?? '';
        renderLines();
      });
    });

    container.querySelectorAll<HTMLInputElement>('.je-line-debit').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = +inp.getAttribute('data-idx')!;
        lines[idx].debit = parseFloat(inp.value) || 0;
        if (lines[idx].debit > 0) lines[idx].credit = 0;
        renderLines();
      });
    });

    container.querySelectorAll<HTMLInputElement>('.je-line-credit').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = +inp.getAttribute('data-idx')!;
        lines[idx].credit = parseFloat(inp.value) || 0;
        if (lines[idx].credit > 0) lines[idx].debit = 0;
        renderLines();
      });
    });

    container.querySelectorAll<HTMLInputElement>('.je-line-desc').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = +inp.getAttribute('data-idx')!;
        lines[idx].description = inp.value;
      });
    });

    container.querySelectorAll<HTMLButtonElement>('.je-remove-line').forEach((btn) => {
      btn.addEventListener('click', () => {
        lines.splice(+btn.getAttribute('data-idx')!, 1);
        renderLines();
      });
    });

    container.querySelector('#je-add-line')?.addEventListener('click', () => {
      lines.push({ id: generateId(), accountId: '', accountCode: '', accountName: '', debit: 0, credit: 0 });
      renderLines();
    });
  };

  form.innerHTML = `
    <div class="form-row" style="margin-bottom:var(--space-4);">
      <div class="form-group">
        <label class="form-label required" for="je-date">${i18n.t('accounting.journal.date' as any)}</label>
        <input type="date" id="je-date" class="form-control" value="${entry?.date?.slice(0,10) ?? new Date().toISOString().slice(0,10)}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="je-period">${i18n.t('nav.fiscal-periods' as any)}</label>
        <select id="je-period" class="form-control">
          ${openPeriods.map((p) => `<option value="${p.id}" ${entry?.fiscalPeriodId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row" style="margin-bottom:var(--space-4);">
      <div class="form-group">
        <label class="form-label required" for="je-desc">${i18n.t('accounting.journal.description' as any)}</label>
        <input type="text" id="je-desc" class="form-control" value="${entry?.description ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="je-ref">${i18n.t('accounting.journal.reference' as any)}</label>
        <input type="text" id="je-ref" class="form-control" value="${entry?.reference ?? ''}" />
      </div>
    </div>
    <div id="je-lines-container"></div>
  `;

  renderLines();

  const saveEntry = async (status: 'draft' | 'posted') => {
    const description = (form.querySelector('#je-desc') as HTMLInputElement).value.trim();
    const date = (form.querySelector('#je-date') as HTMLInputElement).value;
    const fiscalPeriodId = (form.querySelector('#je-period') as HTMLSelectElement).value;
    const reference = (form.querySelector('#je-ref') as HTMLInputElement).value.trim() || undefined;

    if (!description) { showModalError(form, i18n.t('errors.required'), ['je-desc']); return false; }
    if (!fiscalPeriodId) { showModalError(form, i18n.t('errors.required'), ['je-period']); return false; }

    try {
      const data = {
        date: new Date(date).toISOString(),
        description,
        reference,
        sourceType: 'manual' as const,
        lines,
        totalDebit: lines.reduce((s, l) => s + l.debit, 0),
        totalCredit: lines.reduce((s, l) => s + l.credit, 0),
        status,
        fiscalPeriodId,
      };

      if (isEdit && entry!.status === 'draft') {
        // Update draft: delete and recreate
        await journalService.deleteDraft(entry!.id);
      }
      await journalService.createEntry(data);
      notifications.success(i18n.t('common.save'));
      onSave();
    } catch (err) {
      showModalError(form, translateJournalError(err));
      return false;
    }
  };

  const close = openModal({
    title: isEdit ? `${i18n.t('common.edit')} ${entry!.entryNumber}` : i18n.t('accounting.journal.newEntry' as any),
    content: form,
    size: 'lg',
    hideFooter: true,
  });

  // Custom footer with two buttons
  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.innerHTML = `
    <button class="btn btn-secondary" id="je-cancel">${i18n.t('common.cancel')}</button>
    <button class="btn btn-secondary" id="je-save-draft">${i18n.t('accounting.journal.saveDraft' as any)}</button>
    <button class="btn btn-primary" id="je-post">${i18n.t('accounting.journal.postEntry' as any)}</button>
  `;
  form.closest('.modal')?.appendChild(footer);

  footer.querySelector('#je-cancel')?.addEventListener('click', close);
  footer.querySelector('#je-save-draft')?.addEventListener('click', () => saveEntry('draft').then((r) => { if (r !== false) close(); }));
  footer.querySelector('#je-post')?.addEventListener('click', () => saveEntry('posted').then((r) => { if (r !== false) close(); }));
}

function openReversalModal(entry: JournalEntry, onSave: () => void): void {
  const form = document.createElement('div');
  form.innerHTML = `
    <div class="form-group" style="margin-bottom:var(--space-4);">
      <label class="form-label required" for="rev-date">${i18n.t('accounting.journal.reversalDate' as any)}</label>
      <input type="date" id="rev-date" class="form-control" value="${new Date().toISOString().slice(0,10)}" />
    </div>
    <div class="form-group">
      <label class="form-label required" for="rev-desc">${i18n.t('accounting.journal.reversalDescription' as any)}</label>
      <input type="text" id="rev-desc" class="form-control" value="${i18n.t('accounting.journal.reversalOf' as any, { ref: entry.entryNumber })}" />
    </div>
  `;

  openModal({
    title: i18n.t('accounting.journal.reverseEntry' as any),
    content: form,
    confirmText: i18n.t('accounting.journal.reverseEntry' as any),
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      const date = new Date((form.querySelector('#rev-date') as HTMLInputElement).value).toISOString();
      const description = (form.querySelector('#rev-desc') as HTMLInputElement).value.trim();
      if (!description) { showModalError(form, i18n.t('errors.required'), ['rev-desc']); return false; }
      try {
        await journalService.reverseEntry(entry.id, date, description);
        notifications.success(i18n.t('common.save'));
        onSave();
      } catch (err) {
        showModalError(form, translateJournalError(err));
        return false;
      }
    },
  });
}

