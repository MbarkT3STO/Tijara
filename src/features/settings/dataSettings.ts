/**
 * Data settings sub-module: import, export, backup, clear.
 */

import { Icons } from '@shared/components/icons';
import { i18n } from '@core/i18n';
import { notifications } from '@core/notifications';
import { repository } from '@data/repository';
import { storageFormatService } from '@core/storageFormatService';
import { usePermissions } from '@shared/utils/helpers';
import type { StorageFormat } from '@core/storageFormatService';
import type { ElectronAPI } from '../../../electron/preload';

function getElectron(): ElectronAPI | null {
  return (window as unknown as { electron?: ElectronAPI }).electron ?? null;
}

const isElectron = !!getElectron();

function buildStorageFormatCard(format: StorageFormat, active: boolean): string {
  const border = active ? 'var(--color-primary)' : 'var(--color-border)';
  const bg = active ? 'var(--color-primary-subtle)' : 'transparent';
  const iconEl = format === 'json'
    ? Icons.fileJson(24)
    : format === 'excel'
      ? Icons.fileSpreadsheet(24)
      : Icons.database(24);
  const titleKey = format === 'json'
    ? 'settings.storageJson'
    : format === 'excel'
      ? 'settings.storageExcel'
      : 'settings.storageSqlite';
  const descKey = format === 'json'
    ? 'settings.storageJsonDesc'
    : format === 'excel'
      ? 'settings.storageExcelDesc'
      : 'settings.storageSqliteDesc';
  const checkmark = active ? `<span style="color:var(--color-primary);font-size:16px;">✓</span>` : '';

  return `
    <div id="storage-format-${format}"
      style="cursor:pointer;border:2px solid ${border};background:${bg};
        border-radius:var(--radius-md);padding:var(--space-4);
        transition:border-color 0.2s,background 0.2s;
        display:flex;flex-direction:column;gap:var(--space-2);"
      role="button" aria-pressed="${active}">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="color:${active ? 'var(--color-primary)' : 'var(--color-text-secondary)'};">${iconEl}</div>
        ${checkmark}
      </div>
      <div style="font-weight:600;font-size:var(--font-size-sm);">${i18n.t(titleKey as any)}</div>
      <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);line-height:1.4;">${i18n.t(descKey as any)}</div>
    </div>`;
}

export function buildDataHTML(): string {
  const { can } = usePermissions();
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
        <div style="margin-bottom:var(--space-6);">
          <div style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:var(--space-2);">
            ${i18n.t('settings.storageFormat' as any)}
          </div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);margin-bottom:var(--space-4);">
            ${i18n.t('settings.storageFormatSubtitle' as any)}
          </div>
          ${can('settings:changeStorage') ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-3);margin-bottom:var(--space-4);" id="storage-format-cards">
            ${buildStorageFormatCard('json', storageFormatService.current === 'json')}
            ${buildStorageFormatCard('excel', storageFormatService.current === 'excel')}
            ${buildStorageFormatCard('sqlite', storageFormatService.current === 'sqlite')}
          </div>` : ''}
          <div id="storage-format-info" style="
            padding:var(--space-3) var(--space-4);
            background:var(--color-bg-secondary);
            border:1px solid var(--color-border-subtle);
            border-radius:var(--radius-sm);
            font-size:var(--font-size-xs);
            color:var(--color-text-secondary);
            display:flex;align-items:center;gap:var(--space-2);
          ">
            ${storageFormatService.current === 'excel' && storageFormatService.resolveExcelPath()
              ? `${Icons.fileSpreadsheet(14)} ${i18n.t('settings.storageExcelPath' as any)}: <code style="color:var(--color-text-primary);font-family:var(--font-mono);word-break:break-all;">${storageFormatService.resolveExcelPath()}</code>`
              : storageFormatService.current === 'sqlite'
                ? `${Icons.database(14)} ${i18n.t('settings.storageSqlitePath' as any)}`
                : `${Icons.fileJson(14)} ${i18n.t('settings.storageJsonPath' as any)}`
            }
          </div>
        </div>
        <div class="divider" style="margin-bottom:var(--space-6);"></div>
        ` : ''}
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
            ${can('settings:exportData') ? `<button class="btn btn-secondary btn-sm" id="export-btn" style="margin-top:auto;">
              ${Icons.download(14)} ${i18n.t('settings.exportData' as any)}
            </button>` : ''}
          </div>

          <div style="display:flex;flex-direction:column;gap:var(--space-2);padding:var(--space-4);border:1px solid var(--color-border-subtle);border-radius:var(--radius-md);">
            <div style="color:var(--color-info);">${Icons.upload(24)}</div>
            <div style="font-weight:600;">${i18n.t('settings.importExcel' as any)}</div>
            <p style="font-size:var(--font-size-xs);color:var(--color-text-secondary);line-height:1.4;">
              ${isElectron ? i18n.t('settings.importExcelSubtitleWin' as any) : i18n.t('settings.importExcelSubtitleWeb' as any)}
            </p>
            ${can('settings:importData') ? (isElectron
              ? `<button class="btn btn-secondary btn-sm" id="import-btn" style="margin-top:auto;">${Icons.upload(14)} ${i18n.t('settings.importData' as any)}</button>`
              : `<label class="btn btn-secondary btn-sm" style="cursor:pointer;margin-top:auto;">${Icons.upload(14)} ${i18n.t('settings.importData' as any)}<input type="file" id="import-file" accept=".xlsx,.xls" style="display:none;" /></label>`
            ) : ''}
          </div>

          ${can('settings:clearData') ? `<div style="display:flex;flex-direction:column;gap:var(--space-2);padding:var(--space-4);border:1px solid var(--color-error-subtle);background:var(--color-error-subtle);border-radius:var(--radius-md);">
            <div style="color:var(--color-error);">${Icons.alertTriangle(24)}</div>
            <div style="font-weight:600;color:var(--color-error);">${i18n.t('settings.clearAllData' as any)}</div>
            <p style="font-size:var(--font-size-xs);color:var(--color-text-secondary);line-height:1.4;">
              ${i18n.t('settings.clearAllDataSubtitle' as any)}
            </p>
            <button class="btn btn-ghost btn-sm" id="clear-btn" style="color:var(--color-error);border:1px solid rgba(239,68,68,0.2);margin-top:auto;">
              ${Icons.trash(14)} ${i18n.t('common.delete' as any)}
            </button>
          </div>` : ''}
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

    // Storage format card clicks
    (['json', 'excel', 'sqlite'] as StorageFormat[]).forEach((format) => {
      page.querySelector(`#storage-format-${format}`)?.addEventListener('click', async () => {
        if (format === storageFormatService.current) return;
        await handleStorageFormatChange(format, page, electron);
      });
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

async function handleStorageFormatChange(
  newFormat: StorageFormat,
  page: HTMLElement,
  electron: ElectronAPI
): Promise<void> {
  notifications.info(i18n.t('settings.storageMigrating' as any));

  if (newFormat === 'sqlite') {
    const ok = await repository.migrateToSqlite();
    if (!ok) {
      notifications.error(i18n.t('settings.storageMigrationFailed' as any));
      return;
    }
    storageFormatService.excelFilePath = null;
    storageFormatService.set('sqlite');
    notifications.success(i18n.t('settings.storageSwitchedSqlite' as any));

  } else if (newFormat === 'excel') {
    const filePath = await electron.chooseExcelStorageFile();
    if (!filePath) return; // user cancelled

    const ok = await repository.migrateToExcel(filePath);
    if (!ok) {
      notifications.error(i18n.t('settings.storageMigrationFailed' as any));
      return;
    }
    storageFormatService.excelFilePath = filePath;
    storageFormatService.set('excel');
    notifications.success(i18n.t('settings.storageSwitchedExcel' as any));

  } else {
    // Switching to JSON
    const ok = await repository.migrateToJson();
    if (!ok) {
      notifications.error(i18n.t('settings.storageMigrationFailed' as any));
      return;
    }
    storageFormatService.excelFilePath = null;
    storageFormatService.set('json');
    notifications.success(i18n.t('settings.storageSwitchedJson' as any));
  }

  // Re-render cards and info row
  const cardsContainer = page.querySelector('#storage-format-cards');
  if (cardsContainer) {
    cardsContainer.innerHTML =
      buildStorageFormatCard('json', storageFormatService.current === 'json') +
      buildStorageFormatCard('excel', storageFormatService.current === 'excel') +
      buildStorageFormatCard('sqlite', storageFormatService.current === 'sqlite');

    (['json', 'excel', 'sqlite'] as StorageFormat[]).forEach((format) => {
      cardsContainer.querySelector(`#storage-format-${format}`)?.addEventListener('click', async () => {
        if (format === storageFormatService.current) return;
        await handleStorageFormatChange(format, page, electron);
      });
    });
  }

  const infoEl = page.querySelector('#storage-format-info');
  if (infoEl) {
    infoEl.innerHTML =
      storageFormatService.current === 'excel' && storageFormatService.resolveExcelPath()
        ? `${Icons.fileSpreadsheet(14)} ${i18n.t('settings.storageExcelPath' as any)}: <code style="color:var(--color-text-primary);font-family:var(--font-mono);word-break:break-all;">${storageFormatService.resolveExcelPath()}</code>`
        : storageFormatService.current === 'sqlite'
          ? `${Icons.database(14)} ${i18n.t('settings.storageSqlitePath' as any)}`
          : `${Icons.fileJson(14)} ${i18n.t('settings.storageJsonPath' as any)}`;
  }
}
