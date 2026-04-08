/**
 * Settings page – theme, data management, app info.
 * Detects Electron environment and uses native dialogs when available.
 */

import { themeManager } from '@core/theme';
import { notifications } from '@core/notifications';
import { Icons } from '@shared/components/icons';
import { profileService } from '@services/profileService';
import type { ElectronAPI } from '../../../electron/preload';

function getElectron(): ElectronAPI | null {
  return (window as unknown as { electron?: ElectronAPI }).electron ?? null;
}

const isElectron = !!getElectron();

/** Render and return the settings page */
export function renderSettings(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  const profile = profileService.get();

  page.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Settings</h2>
        <p class="page-subtitle">Manage your application preferences and data.</p>
      </div>
    </div>

    <div style="display: grid; gap: var(--space-5); max-width: 720px;">

      <!-- Enterprise Profile -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Enterprise Profile</h3>
          <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">Appears on all invoices</span>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:var(--space-5);">

          <!-- Logo upload -->
          <div style="display:flex;align-items:center;gap:var(--space-5);">
            <div id="logo-preview" style="
              width:96px;height:96px;border-radius:var(--radius-md);
              border:2px dashed var(--color-border);
              display:flex;align-items:center;justify-content:center;
              overflow:hidden;flex-shrink:0;background:var(--color-bg-secondary);
              transition:border-color var(--transition-fast);
            ">
              ${profile.logo
                ? `<img src="${profile.logo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`
                : `<span style="color:var(--color-text-tertiary);">${Icons.upload(24)}</span>`
              }
            </div>
            <div style="display:flex;flex-direction:column;gap:var(--space-2);">
              <div style="font-weight:500;">Company Logo</div>
              <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">PNG, JPG or SVG · Max 2 MB · Recommended 400×200px</div>
              <div style="display:flex;gap:var(--space-2);">
                <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
                  ${Icons.upload(14)} Upload
                  <input type="file" id="logo-input" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none;" />
                </label>
                ${profile.logo ? `<button class="btn btn-ghost btn-sm" id="logo-remove" style="color:var(--color-error);">${Icons.trash(14)} Remove</button>` : ''}
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Company details -->
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ep-name">Company Name</label>
              <input type="text" id="ep-name" class="form-control" placeholder="Acme Corporation" value="${profile.name}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="ep-tagline">Tagline / Industry</label>
              <input type="text" id="ep-tagline" class="form-control" placeholder="Technology Solutions" value="${profile.tagline}" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ep-email">Email</label>
              <input type="email" id="ep-email" class="form-control" placeholder="billing@company.com" value="${profile.email}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="ep-phone">Phone</label>
              <input type="tel" id="ep-phone" class="form-control" placeholder="+1-555-0100" value="${profile.phone}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="ep-address">Address</label>
            <input type="text" id="ep-address" class="form-control" placeholder="123 Business Ave" value="${profile.address}" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ep-city">City</label>
              <input type="text" id="ep-city" class="form-control" placeholder="New York" value="${profile.city}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="ep-country">Country</label>
              <input type="text" id="ep-country" class="form-control" placeholder="USA" value="${profile.country}" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ep-website">Website</label>
              <input type="url" id="ep-website" class="form-control" placeholder="https://company.com" value="${profile.website}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="ep-taxid">Tax ID / VAT Number</label>
              <input type="text" id="ep-taxid" class="form-control" placeholder="US-123456789" value="${profile.taxId}" />
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;">
            <button class="btn btn-primary" id="save-profile-btn">
              ${Icons.check(16)} Save Profile
            </button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Appearance</h3>
        </div>
        <div class="card-body" style="display: flex; flex-direction: column; gap: var(--space-5);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-weight: 500; margin-bottom: 4px;">Dark Mode</div>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Switch between light and dark themes</div>
            </div>
            <label class="toggle" aria-label="Toggle dark mode">
              <input type="checkbox" class="toggle-input" id="dark-mode-toggle" ${themeManager.getTheme() === 'dark' ? 'checked' : ''} />
              <span class="toggle-track"></span>
            </label>
          </div>

          <div class="divider"></div>

          <div>
            <div style="font-weight: 500; margin-bottom: var(--space-3);">Theme Preview</div>
            <div style="display: flex; gap: var(--space-3);">
              <div id="theme-light" style="cursor: pointer; border: 2px solid ${themeManager.getTheme() === 'light' ? 'var(--color-primary)' : 'var(--color-border)'}; border-radius: var(--radius-sm); padding: var(--space-2);">
                <div style="background: #f8f7ff; border-radius: var(--radius-xs); padding: var(--space-3); height: 80px; display: flex; flex-direction: column; gap: 6px;">
                  <div style="height: 8px; width: 60%; background: #9929ea; border-radius: 4px;"></div>
                  <div style="height: 6px; width: 80%; background: #e5e0f5; border-radius: 4px;"></div>
                  <div style="height: 6px; width: 70%; background: #e5e0f5; border-radius: 4px;"></div>
                </div>
                <div style="text-align: center; font-size: var(--font-size-xs); margin-top: var(--space-2); color: var(--color-text-secondary);">Light</div>
              </div>
              <div id="theme-dark" style="cursor: pointer; border: 2px solid ${themeManager.getTheme() === 'dark' ? 'var(--color-primary)' : 'var(--color-border)'}; border-radius: var(--radius-sm); padding: var(--space-2);">
                <div style="background: #0a0614; border-radius: var(--radius-xs); padding: var(--space-3); height: 80px; display: flex; flex-direction: column; gap: 6px;">
                  <div style="height: 8px; width: 60%; background: #9929ea; border-radius: 4px;"></div>
                  <div style="height: 6px; width: 80%; background: #2a1f45; border-radius: 4px;"></div>
                  <div style="height: 6px; width: 70%; background: #2a1f45; border-radius: 4px;"></div>
                </div>
                <div style="text-align: center; font-size: var(--font-size-xs); margin-top: var(--space-2); color: var(--color-text-secondary);">Dark</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Data Management -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Data Management</h3>
        </div>
        <div class="card-body" style="display: flex; flex-direction: column; gap: var(--space-4);">

          ${isElectron ? `
          <div style="display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3); background: var(--color-bg-secondary); border-radius: var(--radius-sm);">
            <span style="color: var(--color-primary); flex-shrink: 0; margin-top: 2px;">${Icons.info(16)}</span>
            <div>
              <div style="font-size: var(--font-size-sm); font-weight: 500; margin-bottom: 2px;">Data stored on disk</div>
              <div id="data-path" style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-family: monospace; word-break: break-all;">Loading path…</div>
            </div>
          </div>
          <div class="divider"></div>
          ` : ''}

          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3);">
            <div>
              <div style="font-weight: 500; margin-bottom: 4px;">Export to Excel</div>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${isElectron ? 'Save all data as an Excel workbook via native dialog' : 'Download all data as an Excel workbook (.xlsx)'}</div>
            </div>
            <button class="btn btn-secondary" id="export-btn">
              ${Icons.download(16)} Export Data
            </button>
          </div>

          <div class="divider"></div>

          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3);">
            <div>
              <div style="font-weight: 500; margin-bottom: 4px;">Import from Excel</div>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${isElectron ? 'Open a previously exported Excel file via native dialog' : 'Import data from a previously exported Excel file'}</div>
            </div>
            ${isElectron
              ? `<button class="btn btn-secondary" id="import-btn">${Icons.upload(16)} Import Data</button>`
              : `<label class="btn btn-secondary" style="cursor: pointer;">${Icons.upload(16)} Import Data<input type="file" id="import-file" accept=".xlsx,.xls" style="display: none;" /></label>`
            }
          </div>

          <div class="divider"></div>

          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3);">
            <div>
              <div style="font-weight: 500; margin-bottom: 4px; color: var(--color-error);">Clear All Data</div>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Permanently delete all stored data and reset to defaults</div>
            </div>
            <button class="btn btn-danger" id="clear-data-btn">
              ${Icons.trash(16)} Clear Data
            </button>
          </div>
        </div>
      </div>

      <!-- About -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">About Tijara</h3>
        </div>
        <div class="card-body">
          <div style="display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-4);">
            <div style="width: 56px; height: 56px; background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light)); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-primary);">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <div>
              <div style="font-size: var(--font-size-xl); font-weight: 700;">Tijara</div>
              <div style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">Sales Management System</div>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); font-size: var(--font-size-sm);">
            <div style="color: var(--color-text-secondary);">Version</div>
            <div>1.0.0</div>
            <div style="color: var(--color-text-secondary);">Platform</div>
            <div>${isElectron ? 'Electron (Desktop)' : 'Web Browser'}</div>
            <div style="color: var(--color-text-secondary);">Storage</div>
            <div>${isElectron ? 'App data folder (JSON + Excel export)' : 'localStorage (Excel export available)'}</div>
          </div>
        </div>
      </div>

    </div>
  `;

  // ── Enterprise Profile ──────────────────────────────────────────────────

  let currentLogo = profile.logo;

  // Logo upload
  page.querySelector<HTMLInputElement>('#logo-input')?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notifications.error('Logo file must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      currentLogo = reader.result as string;
      const preview = page.querySelector<HTMLElement>('#logo-preview')!;
      preview.innerHTML = `<img src="${currentLogo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
      preview.style.borderStyle = 'solid';
      preview.style.borderColor = 'var(--color-primary)';
    };
    reader.readAsDataURL(file);
  });

  // Logo remove
  page.querySelector('#logo-remove')?.addEventListener('click', () => {
    currentLogo = '';
    const preview = page.querySelector<HTMLElement>('#logo-preview')!;
    preview.innerHTML = `<span style="color:var(--color-text-tertiary);">${Icons.upload(24)}</span>`;
    preview.style.borderStyle = 'dashed';
    preview.style.borderColor = 'var(--color-border)';
  });

  // Save profile
  page.querySelector('#save-profile-btn')?.addEventListener('click', () => {
    profileService.save({
      name:    (page.querySelector('#ep-name')    as HTMLInputElement).value.trim(),
      tagline: (page.querySelector('#ep-tagline') as HTMLInputElement).value.trim(),
      email:   (page.querySelector('#ep-email')   as HTMLInputElement).value.trim(),
      phone:   (page.querySelector('#ep-phone')   as HTMLInputElement).value.trim(),
      address: (page.querySelector('#ep-address') as HTMLInputElement).value.trim(),
      city:    (page.querySelector('#ep-city')    as HTMLInputElement).value.trim(),
      country: (page.querySelector('#ep-country') as HTMLInputElement).value.trim(),
      website: (page.querySelector('#ep-website') as HTMLInputElement).value.trim(),
      taxId:   (page.querySelector('#ep-taxid')   as HTMLInputElement).value.trim(),
      logo:    currentLogo,
    });
    notifications.success('Enterprise profile saved. It will appear on all future invoices.');
  });

  // ── Theme controls ──────────────────────────────────────────────────────

  const toggle = page.querySelector<HTMLInputElement>('#dark-mode-toggle')!;
  toggle.addEventListener('change', () => {
    themeManager.setTheme(toggle.checked ? 'dark' : 'light');
    updateThemePreviews();
  });

  page.querySelector('#theme-light')?.addEventListener('click', () => {
    themeManager.setTheme('light');
    toggle.checked = false;
    updateThemePreviews();
  });

  page.querySelector('#theme-dark')?.addEventListener('click', () => {
    themeManager.setTheme('dark');
    toggle.checked = true;
    updateThemePreviews();
  });

  function updateThemePreviews() {
    const isDark = themeManager.getTheme() === 'dark';
    const lightCard = page.querySelector<HTMLElement>('#theme-light');
    const darkCard = page.querySelector<HTMLElement>('#theme-dark');
    if (lightCard) lightCard.style.borderColor = !isDark ? 'var(--color-primary)' : 'var(--color-border)';
    if (darkCard) darkCard.style.borderColor = isDark ? 'var(--color-primary)' : 'var(--color-border)';
  }

  // ── Data path (Electron only) ───────────────────────────────────────────

  if (isElectron) {
    getElectron()!.getDataPath().then((p) => {
      const el = page.querySelector('#data-path');
      if (el) el.textContent = p;
    });
  }

  // ── Export ──────────────────────────────────────────────────────────────

  page.querySelector('#export-btn')?.addEventListener('click', async () => {
    const { repository } = await import('@data/excelRepository');
    try {
      await repository.exportToExcel();
      notifications.success(isElectron ? 'Data exported successfully.' : 'Data exported to tijara-data.xlsx');
    } catch {
      notifications.error('Export failed.');
    }
  });

  // ── Import ──────────────────────────────────────────────────────────────

  if (isElectron) {
    page.querySelector('#import-btn')?.addEventListener('click', async () => {
      const { repository } = await import('@data/excelRepository');
      try {
        await repository.importFromExcel();
        notifications.success('Data imported. Reloading…');
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        notifications.error('Import failed. Make sure it is a valid Tijara export.');
      }
    });
  } else {
    page.querySelector<HTMLInputElement>('#import-file')?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const { repository } = await import('@data/excelRepository');
      try {
        await repository.importFromExcel(file);
        notifications.success('Data imported. Reloading…');
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        notifications.error('Import failed. Make sure it is a valid Tijara export.');
      }
    });
  }

  // ── Clear data ──────────────────────────────────────────────────────────

  page.querySelector('#clear-data-btn')?.addEventListener('click', () => {
    import('@shared/components/modal').then(({ confirmDialog }) => {
      confirmDialog(
        'Clear All Data',
        'This will permanently delete ALL data including customers, products, sales, and invoices. This cannot be undone.',
        async () => {
          const electron = getElectron();
          if (electron) {
            await electron.writeData('');
          } else {
            localStorage.removeItem('tijara-data');
          }
          notifications.success('All data cleared. Reloading…');
          setTimeout(() => window.location.reload(), 1500);
        },
        'Clear All Data',
        'btn-danger'
      );
    });
  });

  return page;
}
