/**
 * Data settings sub-module: import, export, backup, clear.
 */

import { Icons } from '@shared/components/icons';
import { i18n } from '@core/i18n';
import { notifications } from '@core/notifications';
import { repository } from '@data/excelRepository';
import type { ElectronAPI } from '../../../electron/preload';

function getElectron(): ElectronAPI | null {
  return (window as unknown as { electron?: ElectronAPI }).electron ?? null;
}

const isElectron = !!getElectron();

export function buildDataHTML(): string {
  return `
    <div class="card">
      <div class="card-header" style="background:var(--color-bg-secondary);border-bottom:1px solid var(--color-border-subtle);">
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div style="color:var(--color-primary);">${Icons.database(20)}</div>
          <h3 class="card-title">${i18n.t('settings.dataManagement' as any)}</h3>
        </div>
      </div>
      <div class="card-body">
        ${isElectron ? `
        <div style="padding:var(--space-4);background:var(--color-bg-secondary);border-radius:var(--radius-md);margin-bottom:var(--space-6);border:1px solid var(--color-border);">
          <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-2);">
            <div style="color:var(--color-info);">${Icons.info(16)}</div>
            <div style="font-size:var(--font-size-sm);font-weight:600;">${i18n.t('settings.dataOnDisk' as any)}</div>
          </div>
          <div id="data-path" style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);font-family:var(--font-mono);padding:var(--space-3);background:var(--color-surface);border-radius:var(--radius-sm);border:1px solid var(--color-border-subtle);word-break:break-all;">
            ${i18n.t('common.loading' as any)}
          </div>
        </div>` : ''}

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-6);">
          <div style="display:flex;flex-direction:column;gap:var(--space-2);padding:var(--space-4);border:1px solid var(--color-border-subtle);border-radius:var(--radius-md);">
            <div style="color:var(--color-success);">${Icons.download(24)}</div>
            <div style="font-weight:600;">${i18n.t('settings.exportExcel' as any)}</div>
            <p style="font-size:var(--font-size-xs);color:var(--color-text-secondary);line-height:1.4;">
              ${isElectron ? i18n.t('settings.exportExcelSubtitleWin' as any) : i18n.t('settings.exportExcelSubtitleWeb' as any)}
            </p>
            <button class="btn btn-secondary btn-sm" id="export-btn" style="margin-top:auto;">
              ${Icons.download(14)} ${i18n.t('settings.exportData' as any)}
            </button>
          </div>

          <div style="display:flex;flex-direction:column;gap:var(--space-2);padding:var(--space-4);border:1px solid var(--color-border-subtle);border-radius:var(--radius-md);">
            <div style="color:var(--color-info);">${Icons.upload(24)}</div>
            <div style="font-weight:600;">${i18n.t('settings.importExcel' as any)}</div>
            <p style="font-size:var(--font-size-xs);color:var(--color-text-secondary);line-height:1.4;">
              ${isElectron ? i18n.t('settings.importExcelSubtitleWin' as any) : i18n.t('settings.importExcelSubtitleWeb' as any)}
            </p>
            ${isElectron
              ? `<button class="btn btn-secondary btn-sm" id="import-btn" style="margin-top:auto;">${Icons.upload(14)} ${i18n.t('settings.importData' as any)}</button>`
              : `<label class="btn btn-secondary btn-sm" style="cursor:pointer;margin-top:auto;">${Icons.upload(14)} ${i18n.t('settings.importData' as any)}<input type="file" id="import-file" accept=".xlsx,.xls" style="display:none;" /></label>`
            }
          </div>

          <div style="display:flex;flex-direction:column;gap:var(--space-2);padding:var(--space-4);border:1px solid var(--color-error-subtle);background:var(--color-error-subtle);border-radius:var(--radius-md);">
            <div style="color:var(--color-error);">${Icons.alertTriangle(24)}</div>
            <div style="font-weight:600;color:var(--color-error);">${i18n.t('settings.clearAllData' as any)}</div>
            <p style="font-size:var(--font-size-xs);color:var(--color-text-secondary);line-height:1.4;">
              ${i18n.t('settings.clearAllDataSubtitle' as any)}
            </p>
            <button class="btn btn-ghost btn-sm" id="clear-btn" style="color:var(--color-error);border:1px solid rgba(239,68,68,0.2);margin-top:auto;">
              ${Icons.trash(14)} ${i18n.t('common.delete' as any)}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function attachDataEvents(page: HTMLElement): void {
  const electron = getElectron();

  if (isElectron && electron) {
    electron.getDataPath().then((path: string) => {
      const el = page.querySelector('#data-path');
      if (el) el.textContent = path;
    });
  }

  page.querySelector('#export-btn')?.addEventListener('click', async () => {
    await repository.exportToExcel();
    if (isElectron) notifications.success(i18n.t('settings.notifications.exportSuccess' as any));
  });

  const handleImportFile = async (file: File) => {
    try {
      await repository.importFromExcel(file);
      notifications.success(i18n.t('settings.notifications.importSuccess' as any));
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      notifications.error(i18n.t('settings.notifications.importFailed' as any));
    }
  };

  if (isElectron) {
    page.querySelector('#import-btn')?.addEventListener('click', async () => {
      await repository.importFromExcel();
      notifications.success(i18n.t('settings.notifications.importSuccess' as any));
      setTimeout(() => window.location.reload(), 1500);
    });
  } else {
    page.querySelector<HTMLInputElement>('#import-file')?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleImportFile(file);
    });
  }

  page.querySelector('#clear-btn')?.addEventListener('click', () => {
    import('@shared/components/modal').then(({ openModal }) => {
      const content = document.createElement('div');
      content.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-4);text-align:center;padding:var(--space-2) 0;">
          <div style="width:56px;height:56px;border-radius:var(--radius-full);background:var(--color-error-subtle);color:var(--color-error);display:flex;align-items:center;justify-content:center;">
            ${Icons.alertTriangle(24)}
          </div>
          <p style="color:var(--color-text-secondary);">${i18n.t('settings.clearAllDataSubtitle' as any)}</p>
        </div>
      `;
      openModal({
        title: i18n.t('settings.clearAllData' as any),
        content,
        confirmText: i18n.t('common.delete' as any),
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          await repository.clearAll();
          notifications.success(i18n.t('settings.notifications.clearedSuccess' as any));
          setTimeout(() => window.location.reload(), 1500);
        },
      });
    });
  });
}
