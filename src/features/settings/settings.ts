/**
 * Settings page – theme, data management, app info.
 * Detects Electron environment and uses native dialogs when available.
 */

import { themeManager } from '@core/theme';
import { notifications } from '@core/notifications';
import { Icons } from '@shared/components/icons';
import { profileService } from '@services/profileService';
import { i18n } from '@core/i18n';
import { createLanguageSwitcher } from '@shared/components/languageSwitcher';
import type { ElectronAPI } from '../../../electron/preload';

function getElectron(): ElectronAPI | null {
  return (window as unknown as { electron?: ElectronAPI }).electron ?? null;
}

const isElectron = !!getElectron();

/** Common world currencies for the selector */
const CURRENCIES: { code: string; name: string }[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'QAR', name: 'Qatari Riyal' },
  { code: 'KWD', name: 'Kuwaiti Dinar' },
  { code: 'BHD', name: 'Bahraini Dinar' },
  { code: 'OMR', name: 'Omani Rial' },
  { code: 'JOD', name: 'Jordanian Dinar' },
  { code: 'EGP', name: 'Egyptian Pound' },
  { code: 'MAD', name: 'Moroccan Dirham' },
  { code: 'TND', name: 'Tunisian Dinar' },
  { code: 'DZD', name: 'Algerian Dinar' },
  { code: 'LYD', name: 'Libyan Dinar' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'RUB', name: 'Russian Ruble' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'ETB', name: 'Ethiopian Birr' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'XOF', name: 'West African CFA Franc' },
  { code: 'XAF', name: 'Central African CFA Franc' },
  { code: 'ILS', name: 'Israeli Shekel' },
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'HUF', name: 'Hungarian Forint' },
  { code: 'RON', name: 'Romanian Leu' },
  { code: 'HRK', name: 'Croatian Kuna' },
  { code: 'BGN', name: 'Bulgarian Lev' },
  { code: 'CLP', name: 'Chilean Peso' },
  { code: 'COP', name: 'Colombian Peso' },
  { code: 'PEN', name: 'Peruvian Sol' },
  { code: 'ARS', name: 'Argentine Peso' },
];

/** Render and return the settings page */
export function renderSettings(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'content-inner animate-fade-in';

  const profile = profileService.get();

  page.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">${i18n.t('settings.title')}</h2>
        <p class="page-subtitle">${i18n.t('settings.subtitle')}</p>
      </div>
    </div>

    <div style="display: grid; gap: var(--space-5); max-width: 720px;">

      <!-- Enterprise Profile -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${i18n.t('settings.enterpriseProfile')}</h3>
          <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">${i18n.t('settings.enterpriseSubtitle')}</span>
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
              <div style="font-weight:500;">${i18n.t('settings.companyLogo')}</div>
              <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">${i18n.t('settings.logoHint')}</div>
              <div style="display:flex;gap:var(--space-2);">
                <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
                  ${Icons.upload(14)} ${i18n.t('common.upload')}
                  <input type="file" id="logo-input" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none;" />
                </label>
                ${profile.logo ? `<button class="btn btn-ghost btn-sm" id="logo-remove" style="color:var(--color-error);">${Icons.trash(14)} ${i18n.t('common.remove')}</button>` : ''}
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Company details -->
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ep-name">${i18n.t('settings.companyName')}</label>
              <input type="text" id="ep-name" class="form-control" placeholder="Acme Corporation" value="${profile.name}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="ep-tagline">${i18n.t('settings.tagline')}</label>
              <input type="text" id="ep-tagline" class="form-control" placeholder="Technology Solutions" value="${profile.tagline}" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ep-email">${i18n.t('settings.email')}</label>
              <input type="email" id="ep-email" class="form-control" placeholder="billing@company.com" value="${profile.email}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="ep-phone">${i18n.t('settings.phone')}</label>
              <input type="tel" id="ep-phone" class="form-control" placeholder="+1-555-0100" value="${profile.phone}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="ep-address">${i18n.t('settings.address')}</label>
            <input type="text" id="ep-address" class="form-control" placeholder="123 Business Ave" value="${profile.address}" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ep-city">${i18n.t('settings.city')}</label>
              <input type="text" id="ep-city" class="form-control" placeholder="New York" value="${profile.city}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="ep-country">${i18n.t('settings.country')}</label>
              <input type="text" id="ep-country" class="form-control" placeholder="USA" value="${profile.country}" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ep-website">${i18n.t('settings.website')}</label>
              <input type="url" id="ep-website" class="form-control" placeholder="https://company.com" value="${profile.website}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="ep-taxid">${i18n.t('settings.taxId')}</label>
              <input type="text" id="ep-taxid" class="form-control" placeholder="US-123456789" value="${profile.taxId}" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ep-default-tax">${i18n.t('settings.defaultTaxRate')}</label>
              <input type="number" id="ep-default-tax" class="form-control" placeholder="0" min="0" max="100" step="0.01" value="${profile.defaultTaxRate ?? 0}" />
              <span class="form-hint">${i18n.t('settings.defaultTaxHint')}</span>
            </div>
            <div class="form-group">
              <label class="form-label" for="ep-currency">${i18n.t('settings.defaultCurrency')}</label>
              <select id="ep-currency" class="form-control">
                ${CURRENCIES.map((c) => `<option value="${c.code}" ${(profile.currency || 'USD') === c.code ? 'selected' : ''}>${c.code} — ${c.name}</option>`).join('')}
              </select>
              <span class="form-hint">${i18n.t('settings.currencyHint')}</span>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;">
            <button class="btn btn-primary" id="save-profile-btn">
              ${Icons.check(16)} ${i18n.t('settings.saveProfile')}
            </button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${i18n.t('settings.appearance')}</h3>
        </div>
        <div class="card-body" style="display: flex; flex-direction: column; gap: var(--space-5);">
          
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-weight: 500; margin-bottom: 4px;">${i18n.t('settings.language')}</div>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${i18n.t('settings.selectLanguage')}</div>
            </div>
            <div id="settings-lang-switcher"></div>
          </div>

          <div class="divider"></div>

          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-weight: 500; margin-bottom: 4px;">${i18n.t('settings.darkMode')}</div>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${i18n.t('settings.darkModeSubtitle')}</div>
            </div>
            <label class="toggle" aria-label="Toggle dark mode">
              <input type="checkbox" class="toggle-input" id="dark-mode-toggle" ${themeManager.getTheme() === 'dark' ? 'checked' : ''} />
              <span class="toggle-track"></span>
            </label>
          </div>

          <div class="divider"></div>

          <div>
            <div style="font-weight: 500; margin-bottom: var(--space-3);">${i18n.t('settings.themePreview')}</div>
            <div style="display: flex; gap: var(--space-3);">
              <div id="theme-light" style="cursor: pointer; border: 2px solid ${themeManager.getTheme() === 'light' ? 'var(--color-primary)' : 'var(--color-border)'}; border-radius: var(--radius-sm); padding: var(--space-2);">
                <div style="background: #f8f7ff; border-radius: var(--radius-xs); padding: var(--space-3); height: 80px; display: flex; flex-direction: column; gap: 6px;">
                  <div style="height: 8px; width: 60%; background: #9929ea; border-radius: 4px;"></div>
                  <div style="height: 6px; width: 80%; background: #e5e0f5; border-radius: 4px;"></div>
                  <div style="height: 6px; width: 70%; background: #e5e0f5; border-radius: 4px;"></div>
                </div>
                <div style="text-align: center; font-size: var(--font-size-xs); margin-top: var(--space-2); color: var(--color-text-secondary);">${i18n.t('settings.light')}</div>
              </div>
              <div id="theme-dark" style="cursor: pointer; border: 2px solid ${themeManager.getTheme() === 'dark' ? 'var(--color-primary)' : 'var(--color-border)'}; border-radius: var(--radius-sm); padding: var(--space-2);">
                <div style="background: #0a0614; border-radius: var(--radius-xs); padding: var(--space-3); height: 80px; display: flex; flex-direction: column; gap: 6px;">
                  <div style="height: 8px; width: 60%; background: #9929ea; border-radius: 4px;"></div>
                  <div style="height: 6px; width: 80%; background: #2a1f45; border-radius: 4px;"></div>
                  <div style="height: 6px; width: 70%; background: #2a1f45; border-radius: 4px;"></div>
                </div>
                <div style="text-align: center; font-size: var(--font-size-xs); margin-top: var(--space-2); color: var(--color-text-secondary);">${i18n.t('settings.dark')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Data Management -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${i18n.t('settings.dataManagement')}</h3>
        </div>
        <div class="card-body" style="display: flex; flex-direction: column; gap: var(--space-4);">

          ${isElectron ? `
          <div style="display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3); background: var(--color-bg-secondary); border-radius: var(--radius-sm);">
            <span style="color: var(--color-primary); flex-shrink: 0; margin-top: 2px;">${Icons.info(16)}</span>
            <div>
              <div style="font-size: var(--font-size-sm); font-weight: 500; margin-bottom: 2px;">${i18n.t('settings.dataOnDisk')}</div>
              <div id="data-path" style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-family: monospace; word-break: break-all;">${i18n.t('common.loading')}</div>
            </div>
          </div>
          <div class="divider"></div>
          ` : ''}

          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3);">
            <div>
              <div style="font-weight: 500; margin-bottom: 4px;">${i18n.t('settings.exportExcel')}</div>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${isElectron ? i18n.t('settings.exportExcelSubtitleWin') : i18n.t('settings.exportExcelSubtitleWeb')}</div>
            </div>
            <button class="btn btn-secondary" id="export-btn">
              ${Icons.download(16)} ${i18n.t('settings.exportData')}
            </button>
          </div>

          <div class="divider"></div>

          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3);">
            <div>
              <div style="font-weight: 500; margin-bottom: 4px;">${i18n.t('settings.importExcel')}</div>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${isElectron ? i18n.t('settings.importExcelSubtitleWin') : i18n.t('settings.importExcelSubtitleWeb')}</div>
            </div>
            ${isElectron
              ? `<button class="btn btn-secondary" id="import-btn">${Icons.upload(16)} ${i18n.t('settings.importData')}</button>`
              : `<label class="btn btn-secondary" style="cursor: pointer;">${Icons.upload(16)} ${i18n.t('settings.importData')}<input type="file" id="import-file" accept=".xlsx,.xls" style="display: none;" /></label>`
            }
          </div>

          <div class="divider"></div>

          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3);">
            <div>
              <div style="font-weight: 500; margin-bottom: 4px; color: var(--color-error);">${i18n.t('settings.clearAllData')}</div>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${i18n.t('settings.clearAllDataSubtitle')}</div>
            </div>
            <button class="btn btn-danger" id="clear-data-btn">
              ${Icons.trash(16)} ${i18n.t('settings.clearAllData')}
            </button>
          </div>
        </div>
      </div>

      <!-- About -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${i18n.t('settings.about')}</h3>
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
            <div style="color: var(--color-text-secondary);">${i18n.t('settings.version')}</div>
            <div>1.0.0</div>
            <div style="color: var(--color-text-secondary);">${i18n.t('settings.platform')}</div>
            <div>${isElectron ? i18n.t('settings.desktop') : i18n.t('settings.web')}</div>
            <div style="color: var(--color-text-secondary);">${i18n.t('settings.storage')}</div>
            <div>${isElectron ? i18n.t('settings.appDataStorage') : i18n.t('settings.webStorage')}</div>
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
      notifications.error(i18n.t('settings.logoSizeMsg' as any) || 'Logo file must be under 2 MB.');
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

  // Language switcher
  page.querySelector('#settings-lang-switcher')?.appendChild(createLanguageSwitcher());

  // Save profile
  page.querySelector('#save-profile-btn')?.addEventListener('click', () => {
    profileService.save({
      name:           (page.querySelector('#ep-name')        as HTMLInputElement).value.trim(),
      tagline:        (page.querySelector('#ep-tagline')     as HTMLInputElement).value.trim(),
      email:          (page.querySelector('#ep-email')       as HTMLInputElement).value.trim(),
      phone:          (page.querySelector('#ep-phone')       as HTMLInputElement).value.trim(),
      address:        (page.querySelector('#ep-address')     as HTMLInputElement).value.trim(),
      city:           (page.querySelector('#ep-city')        as HTMLInputElement).value.trim(),
      country:        (page.querySelector('#ep-country')     as HTMLInputElement).value.trim(),
      website:        (page.querySelector('#ep-website')     as HTMLInputElement).value.trim(),
      taxId:          (page.querySelector('#ep-taxid')       as HTMLInputElement).value.trim(),
      defaultTaxRate: parseFloat((page.querySelector('#ep-default-tax') as HTMLInputElement).value) || 0,
      currency:       (page.querySelector('#ep-currency')    as HTMLSelectElement).value,
      logo:           currentLogo,
    });
    notifications.success(i18n.t('settings.notifications.profileSaved' as any));
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
      notifications.success(isElectron ? i18n.t('settings.notifications.exportSuccess' as any) : i18n.t('settings.notifications.exportSuccess' as any));
    } catch {
      notifications.error(i18n.t('settings.notifications.exportFailed' as any));
    }
  });

  // ── Import ──────────────────────────────────────────────────────────────

  if (isElectron) {
    page.querySelector('#import-btn')?.addEventListener('click', async () => {
      const { repository } = await import('@data/excelRepository');
      try {
        await repository.importFromExcel();
        notifications.success(i18n.t('settings.notifications.importSuccess' as any));
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        notifications.error(i18n.t('settings.notifications.importFailed' as any));
      }
    });
  } else {
    page.querySelector<HTMLInputElement>('#import-file')?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const { repository } = await import('@data/excelRepository');
      try {
        await repository.importFromExcel(file);
        notifications.success(i18n.t('settings.notifications.importSuccess' as any));
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        notifications.error(i18n.t('settings.notifications.importFailed' as any));
      }
    });
  }

  // ── Clear data ──────────────────────────────────────────────────────────

  page.querySelector('#clear-data-btn')?.addEventListener('click', () => {
    import('@shared/components/modal').then(({ confirmDialog }) => {
      confirmDialog(
        i18n.t('settings.modals.clearDataTitle' as any),
        i18n.t('settings.modals.clearDataMsg' as any),
        async () => {
          const electron = getElectron();
          if (electron) {
            await electron.writeData('');
          } else {
            localStorage.removeItem('tijara-data');
          }
          notifications.success(i18n.t('settings.notifications.clearedSuccess' as any));
          setTimeout(() => window.location.reload(), 1500);
        },
        i18n.t('settings.modals.clearDataTitle' as any),
        'btn-danger'
      );
    });
  });

  return page;
}
