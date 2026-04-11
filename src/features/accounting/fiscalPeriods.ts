/**
 * Fiscal Periods feature page.
 */

import { fiscalPeriodService } from '@services/fiscalPeriodService';
import { journalService } from '@services/journalService';
import { notifications } from '@core/notifications';
import { confirmDialog, openModal, showModalError } from '@shared/components/modal';
import { Icons } from '@shared/components/icons';
import { formatDate, escapeHtml } from '@shared/utils/helpers';
import { i18n } from '@core/i18n';
import type { FiscalPeriod, FiscalPeriodStatus } from '@core/types';

const STATUS_BADGE: Record<FiscalPeriodStatus, string> = {
  open: 'badge-success', closed: 'badge-neutral', locked: 'badge-error',
};

export function renderFiscalPeriods(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  function render() {
    page.innerHTML = buildHTML();
    attachEvents();
  }

  function attachEvents() {
    page.querySelector('#add-fp-btn')?.addEventListener('click', () => {
      openPeriodModal(null, render);
    });

    page.querySelectorAll<HTMLButtonElement>('[data-set-current]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-set-current')!;
        // Unset all current
        for (const p of fiscalPeriodService.getAll()) {
          if (p.isCurrent) await fiscalPeriodService.update(p.id, { isCurrent: false });
        }
        await fiscalPeriodService.update(id, { isCurrent: true });
        notifications.success(i18n.t('common.save'));
        render();
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const period = fiscalPeriodService.getById(btn.getAttribute('data-close')!);
        if (!period) return;

        const draftCount = journalService.getByPeriod(period.id).filter((e) => e.status === 'draft').length;
        if (draftCount > 0) {
          notifications.error(i18n.t('accounting.fiscalPeriods.draftEntriesBlock' as any, { count: draftCount }));
          return;
        }

        confirmDialog(
          i18n.t('accounting.fiscalPeriods.closePeriod' as any),
          i18n.t('accounting.fiscalPeriods.closeWarning' as any),
          async () => {
            try {
              await fiscalPeriodService.closePeriod(period.id, 'admin');
              notifications.success(i18n.t('common.save'));
              render();
            } catch (err) {
              notifications.error(err instanceof Error ? err.message : String(err));
            }
          },
          i18n.t('accounting.fiscalPeriods.closePeriod' as any),
          'btn-danger'
        );
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-lock]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-lock')!;
        await fiscalPeriodService.update(id, { status: 'locked' });
        notifications.success(i18n.t('common.save'));
        render();
      });
    });

    page.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const period = fiscalPeriodService.getById(btn.getAttribute('data-delete')!);
        if (!period) return;
        confirmDialog(i18n.t('common.delete'), `${i18n.t('common.confirm')} "${period.name}"?`, async () => {
          await fiscalPeriodService.delete(period.id);
          notifications.success(i18n.t('common.save'));
          render();
        });
      });
    });
  }

  render();
  return page;
}

function buildHTML(): string {
  const periods = fiscalPeriodService.getAll().sort((a, b) => b.startDate.localeCompare(a.startDate));

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('accounting.fiscalPeriods.title' as any)}</h2>
        <p class="page-subtitle">${periods.length} ${i18n.t('common.total' as any)}</p>
      </div>
      <button class="btn btn-primary" id="add-fp-btn">${Icons.plus()} ${i18n.t('accounting.fiscalPeriods.addPeriod' as any)}</button>
    </div>

    <div class="card">
      <div class="table-container" style="border:none;">
        <table class="data-table">
          <thead><tr>
            <th>${i18n.t('accounting.fiscalPeriods.name' as any)}</th>
            <th>${i18n.t('accounting.fiscalPeriods.startDate' as any)}</th>
            <th>${i18n.t('accounting.fiscalPeriods.endDate' as any)}</th>
            <th>${i18n.t('accounting.fiscalPeriods.status' as any)}</th>
            <th>${i18n.t('accounting.fiscalPeriods.isCurrent' as any)}</th>
            <th>${i18n.t('common.actions')}</th>
          </tr></thead>
          <tbody>
            ${periods.length === 0
              ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">${Icons.calendar(32)}</div><p class="empty-state-title">${i18n.t('common.noData')}</p></div></td></tr>`
              : periods.map((p) => `
                <tr>
                  <td style="font-weight:500;">${escapeHtml(p.name)}</td>
                  <td style="color:var(--color-text-secondary);">${formatDate(p.startDate)}</td>
                  <td style="color:var(--color-text-secondary);">${formatDate(p.endDate)}</td>
                  <td><span class="badge ${STATUS_BADGE[p.status]}">${i18n.t(`accounting.fiscalPeriods.statuses.${p.status}` as any)}</span></td>
                  <td>${p.isCurrent ? `<span class="badge badge-primary">${i18n.t('accounting.fiscalPeriods.isCurrent' as any)}</span>` : '—'}</td>
                  <td>
                    <div class="table-actions">
                      ${p.status === 'open' ? `
                        ${!p.isCurrent ? `<button class="btn btn-ghost btn-icon btn-sm" data-set-current="${p.id}" data-tooltip="${i18n.t('accounting.fiscalPeriods.setAsCurrent' as any)}" style="color:var(--color-primary);">${Icons.check(16)}</button>` : ''}
                        <button class="btn btn-ghost btn-icon btn-sm" data-close="${p.id}" data-tooltip="${i18n.t('accounting.fiscalPeriods.closePeriod' as any)}" style="color:var(--color-warning);">${Icons.close(16)}</button>
                      ` : ''}
                      ${p.status === 'closed' ? `
                        <button class="btn btn-ghost btn-icon btn-sm" data-lock="${p.id}" data-tooltip="${i18n.t('accounting.fiscalPeriods.lockPeriod' as any)}" style="color:var(--color-error);">${Icons.shield(16)}</button>
                      ` : ''}
                      ${p.status !== 'locked' ? `<button class="btn btn-ghost btn-icon btn-sm" data-delete="${p.id}" data-tooltip="${i18n.t('common.delete')}" style="color:var(--color-error);">${Icons.trash(16)}</button>` : ''}
                    </div>
                  </td>
                </tr>`).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openPeriodModal(period: FiscalPeriod | null, onSave: () => void): void {
  const isEdit = period !== null;

  const form = document.createElement('div');
  form.innerHTML = `
    <div class="form-group" style="margin-bottom:var(--space-4);">
      <label class="form-label required" for="fp-name">${i18n.t('accounting.fiscalPeriods.name' as any)}</label>
      <input type="text" id="fp-name" class="form-control" value="${period?.name ?? ''}" placeholder="e.g. January 2025" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required" for="fp-start">${i18n.t('accounting.fiscalPeriods.startDate' as any)}</label>
        <input type="date" id="fp-start" class="form-control" value="${period?.startDate?.slice(0,10) ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label required" for="fp-end">${i18n.t('accounting.fiscalPeriods.endDate' as any)}</label>
        <input type="date" id="fp-end" class="form-control" value="${period?.endDate?.slice(0,10) ?? ''}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="fp-status">${i18n.t('accounting.fiscalPeriods.status' as any)}</label>
        <select id="fp-status" class="form-control">
          <option value="open" ${period?.status === 'open' ? 'selected' : ''}>${i18n.t('accounting.fiscalPeriods.statuses.open' as any)}</option>
          <option value="closed" ${period?.status === 'closed' ? 'selected' : ''}>${i18n.t('accounting.fiscalPeriods.statuses.closed' as any)}</option>
        </select>
      </div>
      <div class="form-group" style="display:flex;align-items:center;padding-top:var(--space-5);">
        <label class="checkbox-group">
          <input type="checkbox" id="fp-current" ${period?.isCurrent ? 'checked' : ''} />
          <span>${i18n.t('accounting.fiscalPeriods.isCurrent' as any)}</span>
        </label>
      </div>
    </div>
  `;

  openModal({
    title: isEdit ? `${i18n.t('common.edit')} ${escapeHtml(period!.name)}` : i18n.t('accounting.fiscalPeriods.addPeriod' as any),
    content: form,
    confirmText: i18n.t('common.save'),
    onConfirm: async () => {
      const name = (form.querySelector('#fp-name') as HTMLInputElement).value.trim();
      const startDate = (form.querySelector('#fp-start') as HTMLInputElement).value;
      const endDate = (form.querySelector('#fp-end') as HTMLInputElement).value;
      if (!name || !startDate || !endDate) {
        showModalError(form, i18n.t('errors.required'), [...(!name ? ['fp-name'] : []), ...(!startDate ? ['fp-start'] : []), ...(!endDate ? ['fp-end'] : [])]);
        return false;
      }

      const data = {
        name,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate + 'T23:59:59').toISOString(),
        status: (form.querySelector('#fp-status') as HTMLSelectElement).value as FiscalPeriodStatus,
        isCurrent: (form.querySelector('#fp-current') as HTMLInputElement).checked,
      };

      if (isEdit) {
        await fiscalPeriodService.update(period!.id, data);
      } else {
        await fiscalPeriodService.create(data);
      }
      notifications.success(i18n.t('common.save'));
      onSave();
    },
  });
}
