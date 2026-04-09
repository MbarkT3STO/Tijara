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
import { repository } from '@data/excelRepository';
import { layoutService } from '@core/layout';
import { sidebarThemeService } from '@core/sidebarTheme';
import type { ElectronAPI } from '../../../electron/preload';

function getElectron(): ElectronAPI | null {
  return (window as unknown as { electron?: ElectronAPI }).electron ?? null;
}

const isElectron = !!getElectron();

/** Common world currency codes for the selector */
const CURRENCIES: string[] = [
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'CAD', 'AUD', 'CHF', 'HKD',
  'SGD', 'SEK', 'NOK', 'DKK', 'NZD', 'MXN', 'BRL', 'ZAR', 'AED', 'SAR',
  'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'EGP', 'MAD', 'TND', 'DZD', 'LYD',
  'TRY', 'RUB', 'KRW', 'IDR', 'MYR', 'THB', 'PHP', 'PKR', 'BDT', 'NGN',
  'GHS', 'KES', 'ETB', 'TZS', 'UGX', 'XOF', 'XAF', 'ILS', 'CZK', 'PLN',
  'HUF', 'RON', 'HRK', 'BGN', 'CLP', 'COP', 'PEN', 'ARS',
];

/** Main Settings View */
export function renderSettings(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container';

  let currentLogo = profileService.get().logo || '';

  const render = () => {
    const profile = profileService.get();

    page.innerHTML = `
      <div style="max-width: 1000px; margin: 0 auto; width: 100%; display: grid; gap: var(--space-6);">

      <div class="page-header">
        <div>
          <h2 class="page-title">${i18n.t('settings.title' as any)}</h2>
          <p class="page-subtitle">${i18n.t('settings.subtitle' as any)}</p>
        </div>
        <div class="header-actions">
           <button class="btn btn-primary" id="save-profile-btn">
             ${Icons.check(16)} ${i18n.t('settings.saveProfile' as any)}
           </button>
        </div>
      </div>

        <!-- 1. BUSINESS IDENTITY -->
        <div class="card overflow-hidden">
          <div class="card-header" style="background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-subtle);">
            <div style="display:flex; align-items:center; gap:var(--space-3);">
              <div style="color:var(--color-primary);">${Icons.building(20)}</div>
              <h3 class="card-title">${i18n.t('settings.enterpriseProfile' as any)}</h3>
            </div>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-6);">
              
              <!-- Logo Section -->
              <div style="display:flex; flex-direction:column; gap:var(--space-4);">
                <div style="font-weight:600; font-size:var(--font-size-sm); color:var(--color-text-secondary);">${i18n.t('settings.companyLogo' as any)}</div>
                <div style="display:flex; align-items:center; gap:var(--space-4);">
                  <div id="logo-preview" style="
                    width:100px; height:100px; border-radius:var(--radius-md);
                    border:2px dashed var(--color-border);
                    display:flex; align-items:center; justify-content:center;
                    overflow:hidden; flex-shrink:0; background:var(--color-surface);
                    transition: border-color 0.2s;
                  ">
                    ${currentLogo
                      ? `<img src="${currentLogo}" alt="Logo" style="width:100%; height:100%; object-fit:contain;" />`
                      : `<span style="color:var(--color-text-tertiary);">${Icons.image(24)}</span>`
                    }
                  </div>
                  <div style="display:flex; flex-direction:column; gap:var(--space-2);">
                    <div style="font-size:var(--font-size-xs); color:var(--color-text-tertiary); max-width:200px;">${i18n.t('settings.logoHint' as any)}</div>
                    <div style="display:flex; gap:var(--space-2);">
                      <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
                        ${Icons.upload(14)} ${i18n.t('common.upload' as any)}
                        <input type="file" id="logo-input" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none;" />
                      </label>
                      ${currentLogo ? `<button class="btn btn-ghost btn-sm" id="logo-remove" style="color:var(--color-error);">${Icons.trash(14)}</button>` : ''}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Primary Info -->
              <div style="display:flex; flex-direction:column; gap:var(--space-4);">
                <div class="form-group">
                  <label class="form-label" for="ep-name">${i18n.t('settings.companyName' as any)}</label>
                  <input type="text" id="ep-name" class="form-control" placeholder="Acme Corporation" value="${profile.name}" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="ep-tagline">${i18n.t('settings.tagline' as any)}</label>
                  <input type="text" id="ep-tagline" class="form-control" placeholder="Technology Solutions" value="${profile.tagline}" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. CONTACT & LOCATION -->
        <div class="card">
          <div class="card-header" style="background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-subtle);">
            <div style="display:flex; align-items:center; gap:var(--space-3);">
              <div style="color:var(--color-primary);">${Icons.mapPin(20)}</div>
              <h3 class="card-title">${i18n.t('settings.contactDetails' as any)}</h3>
            </div>
          </div>
          <div class="card-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="ep-email">${i18n.t('settings.email' as any)}</label>
                <input type="email" id="ep-email" class="form-control" placeholder="billing@company.com" value="${profile.email}" />
              </div>
              <div class="form-group">
                <label class="form-label" for="ep-phone">${i18n.t('settings.phone' as any)}</label>
                <input type="tel" id="ep-phone" class="form-control force-ltr" placeholder="+1-555-0100" value="${profile.phone}" />
              </div>
            </div>
            <div class="form-group" style="margin-top:var(--space-4);">
              <label class="form-label" for="ep-address">${i18n.t('settings.address' as any)}</label>
              <input type="text" id="ep-address" class="form-control" placeholder="123 Business Ave" value="${profile.address}" />
            </div>
            <div class="form-row" style="margin-top:var(--space-4);">
              <div class="form-group">
                <label class="form-label" for="ep-city">${i18n.t('settings.city' as any)}</label>
                <input type="text" id="ep-city" class="form-control" placeholder="New York" value="${profile.city}" />
              </div>
              <div class="form-group">
                <label class="form-label" for="ep-country">${i18n.t('settings.country' as any)}</label>
                <input type="text" id="ep-country" class="form-control" placeholder="USA" value="${profile.country}" />
              </div>
            </div>
            <div class="form-row" style="margin-top:var(--space-4);">
              <div class="form-group">
                <label class="form-label" for="ep-website">${i18n.t('settings.website' as any)}</label>
                <div style="position:relative;">
                  <span style="position:absolute; left:var(--space-3); top:50%; transform:translateY(-50%); color:var(--color-text-tertiary);">${Icons.link(14)}</span>
                  <input type="url" id="ep-website" class="form-control" style="padding-left:var(--space-8);" placeholder="https://company.com" value="${profile.website}" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="ep-taxid">${i18n.t('settings.taxId' as any)}</label>
                <input type="text" id="ep-taxid" class="form-control" placeholder="US-123456789" value="${profile.taxId}" />
              </div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: var(--space-6);">
          
          <!-- 3. BILLING & INVOICING -->
          <div class="card">
            <div class="card-header" style="background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-subtle);">
              <div style="display:flex; align-items:center; gap:var(--space-3);">
                <div style="color:var(--color-primary);">${Icons.invoices(20)}</div>
                <h3 class="card-title">${i18n.t('nav.invoices' as any)}</h3>
              </div>
            </div>
            <div class="card-body" style="display:flex; flex-direction:column; gap:var(--space-4);">
              <div class="form-group">
                <label class="form-label" for="ep-currency">${i18n.t('settings.defaultCurrency' as any)}</label>
                <select id="ep-currency" class="form-control">
                  ${CURRENCIES.map((code) => `<option value="${code}" ${(profile.currency || 'USD') === code ? 'selected' : ''}>${code} — ${i18n.t(`currencies.${code}` as any)}</option>`).join('')}
                </select>
                <span class="form-hint">${i18n.t('settings.currencyHint' as any)}</span>
              </div>
              <div class="form-group">
                <label class="form-label" for="ep-default-tax">${i18n.t('settings.defaultTaxRate' as any)}</label>
                <div style="display:flex; align-items:center; gap:var(--space-2);">
                   <input type="number" id="ep-default-tax" class="form-control" placeholder="0" min="0" max="100" step="0.01" value="${profile.defaultTaxRate ?? 0}" />
                   <span style="font-weight:600; color:var(--color-text-tertiary);">%</span>
                </div>
                <span class="form-hint">${i18n.t('settings.defaultTaxHint' as any)}</span>
              </div>
              <div class="divider"></div>
              <div class="form-group">
                <label class="form-label" for="ep-pdf-lang">${i18n.t('settings.defaultPdfLanguage' as any)}</label>
                <select id="ep-pdf-lang" class="form-control">
                  <option value="en" ${profile.defaultPdfLanguage === 'en' ? 'selected' : ''}>🇺🇸 English</option>
                  <option value="fr" ${profile.defaultPdfLanguage === 'fr' ? 'selected' : ''}>🇫🇷 Français</option>
                  <option value="ar" ${profile.defaultPdfLanguage === 'ar' ? 'selected' : ''}>🇸🇦 العربية</option>
                </select>
                <span class="form-hint">${i18n.t('settings.pdfLanguageHint' as any)}</span>
              </div>
            </div>
          </div>

          <!-- 4. APP PREFERENCES -->
          <div class="card">
            <div class="card-header" style="background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-subtle);">
              <div style="display:flex; align-items:center; gap:var(--space-3);">
                <div style="color:var(--color-primary);">${Icons.settings(20)}</div>
                <h3 class="card-title">${i18n.t('settings.appearance' as any)}</h3>
              </div>
            </div>
            <div class="card-body" style="display:flex; flex-direction:column; gap:var(--space-5);">
              
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-weight: 600; font-size:var(--font-size-sm); margin-bottom: 2px;">${i18n.t('settings.language' as any)}</div>
                  <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${i18n.t('settings.selectLanguage' as any)}</div>
                </div>
                <div id="settings-lang-switcher"></div>
              </div>

              <div class="divider"></div>

              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-weight: 600; font-size:var(--font-size-sm); margin-bottom: 2px;">${i18n.t('settings.darkMode' as any)}</div>
                  <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${i18n.t('settings.darkModeSubtitle' as any)}</div>
                </div>
                <label class="toggle" aria-label="Toggle dark mode">
                  <input type="checkbox" class="toggle-input" id="dark-mode-toggle" ${themeManager.getTheme() === 'dark' ? 'checked' : ''} />
                  <span class="toggle-track"></span>
                </label>
              </div>

              <div class="divider"></div>

              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-weight: 600; font-size:var(--font-size-sm); margin-bottom: 2px;">${i18n.t('settings.lightSidebar' as any)}</div>
                  <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${i18n.t('settings.lightSidebarSubtitle' as any)}</div>
                </div>
                <label class="toggle" aria-label="Toggle sidebar theme">
                  <input type="checkbox" class="toggle-input" id="sidebar-theme-toggle" ${sidebarThemeService.current === 'light' ? 'checked' : ''} />
                  <span class="toggle-track"></span>
                </label>
              </div>

              <div class="divider"></div>

              <div>
                <div style="font-weight: 600; font-size:var(--font-size-sm); margin-bottom: var(--space-3);">${i18n.t('settings.themePreview' as any)}</div>
                <div style="display: flex; gap: var(--space-4);">
                  <div id="theme-light" style="flex:1; cursor: pointer; border: 2px solid ${themeManager.getTheme() === 'light' ? 'var(--color-primary)' : 'var(--color-border)'}; border-radius: var(--radius-md); padding: var(--space-2); transition: transform 0.2s;">
                    <div style="background: #f8f7ff; border-radius: var(--radius-sm); padding: var(--space-3); height: 70px; display: flex; flex-direction: column; gap: 6px;">
                      <div style="height: 8px; width: 60%; background: #9929ea; border-radius: 4px;"></div>
                      <div style="height: 6px; width: 80%; background: #e5e0f5; border-radius: 4px;"></div>
                    </div>
                    <div style="text-align: center; font-size: 11px; font-weight:500; margin-top: var(--space-2); color: var(--color-text-secondary);">${i18n.t('settings.light' as any)}</div>
                  </div>
                  <div id="theme-dark" style="flex:1; cursor: pointer; border: 2px solid ${themeManager.getTheme() === 'dark' ? 'var(--color-primary)' : 'var(--color-border)'}; border-radius: var(--radius-md); padding: var(--space-2); transition: transform 0.2s;">
                    <div style="background: #0a0614; border-radius: var(--radius-sm); padding: var(--space-3); height: 70px; display: flex; flex-direction: column; gap: 6px;">
                      <div style="height: 8px; width: 60%; background: #9929ea; border-radius: 4px;"></div>
                      <div style="height: 6px; width: 80%; background: #2a1f45; border-radius: 4px;"></div>
                    </div>
                    <div style="text-align: center; font-size: 11px; font-weight:500; margin-top: var(--space-2); color: var(--color-text-secondary);">${i18n.t('settings.dark' as any)}</div>
                  </div>
                </div>
              </div>

              <div class="divider"></div>

              <div>
                <div style="font-weight: 600; font-size:var(--font-size-sm); margin-bottom: var(--space-3);">${i18n.t('settings.layoutStyle' as any)}</div>
                <div style="display: flex; flex-wrap: wrap; gap: var(--space-3);">
                  <div id="layout-classic" style="flex:1; min-width: 100px; cursor:pointer; border: 1.5px solid ${layoutService.currentLayout === 'classic' ? 'var(--color-primary)' : 'var(--color-border)'}; border-radius: var(--radius-md); padding: var(--space-3); background: ${layoutService.currentLayout === 'classic' ? 'var(--color-primary-subtle)' : 'transparent'}; transition: border-color 0.2s, background 0.2s;">
                    <div style="background: var(--color-bg-secondary); border-radius: var(--radius-sm); height: 60px; display: flex; overflow: hidden; margin-bottom: var(--space-2);">
                      <div style="width: 28px; background: #0f0a1e; display: flex; flex-direction: column; gap: 3px; padding: 6px 4px;">
                        <div style="height: 4px; background: #9929ea; border-radius: 2px;"></div>
                        <div style="height: 3px; background: rgba(255,255,255,0.2); border-radius: 2px;"></div>
                        <div style="height: 3px; background: rgba(255,255,255,0.2); border-radius: 2px;"></div>
                        <div style="height: 3px; background: rgba(255,255,255,0.2); border-radius: 2px;"></div>
                      </div>
                      <div style="flex:1; padding: 6px; display: flex; flex-direction: column; gap: 3px;">
                        <div style="height: 4px; width: 70%; background: var(--color-border); border-radius: 2px;"></div>
                        <div style="height: 3px; width: 50%; background: var(--color-border-subtle); border-radius: 2px;"></div>
                      </div>
                    </div>
                    <div style="text-align:center; font-size:11px; font-weight:500; color:var(--color-text-secondary);">${i18n.t('settings.layoutClassic' as any)}</div>
                    <div style="text-align:center; font-size:10px; color:var(--color-text-tertiary); margin-top:2px;">${i18n.t('settings.layoutClassicDesc' as any)}</div>
                  </div>
                  <div id="layout-modern" style="flex:1; min-width: 100px; cursor:pointer; border: 1.5px solid ${layoutService.currentLayout === 'modern' ? 'var(--color-primary)' : 'var(--color-border)'}; border-radius: var(--radius-md); padding: var(--space-3); background: ${layoutService.currentLayout === 'modern' ? 'var(--color-primary-subtle)' : 'transparent'}; transition: border-color 0.2s, background 0.2s;">
                    <div style="background: var(--color-bg-secondary); border-radius: var(--radius-sm); height: 60px; display: flex; overflow: hidden; margin-bottom: var(--space-2);">
                      <div style="width: 14px; background: #0f0a1e; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 2px;">
                        <div style="width: 8px; height: 8px; background: #9929ea; border-radius: 2px;"></div>
                        <div style="width: 6px; height: 6px; background: rgba(255,255,255,0.3); border-radius: 1px;"></div>
                        <div style="width: 6px; height: 6px; background: rgba(255,255,255,0.3); border-radius: 1px;"></div>
                      </div>
                      <div style="flex:1; padding: 6px; display: flex; flex-direction: column; gap: 3px;">
                        <div style="height: 4px; width: 70%; background: var(--color-border); border-radius: 2px;"></div>
                        <div style="height: 3px; width: 50%; background: var(--color-border-subtle); border-radius: 2px;"></div>
                      </div>
                    </div>
                    <div style="text-align:center; font-size:11px; font-weight:500; color:var(--color-text-secondary);">${i18n.t('settings.layoutModern' as any)}</div>
                    <div style="text-align:center; font-size:10px; color:var(--color-text-tertiary); margin-top:2px;">${i18n.t('settings.layoutModernDesc' as any)}</div>
                  </div>
                  <div id="layout-floating" style="flex:1; min-width: 100px; cursor:pointer; border: 1.5px solid ${layoutService.currentLayout === 'floating' ? 'var(--color-primary)' : 'var(--color-border)'}; border-radius: var(--radius-md); padding: var(--space-3); background: ${layoutService.currentLayout === 'floating' ? 'var(--color-primary-subtle)' : 'transparent'}; transition: border-color 0.2s, background 0.2s;">
                    <div style="background: var(--color-bg-secondary); border-radius: var(--radius-sm); height: 60px; display: flex; gap: 3px; padding: 5px; margin-bottom: var(--space-2); overflow: hidden;">
                      <div style="width: 22px; background: var(--color-sidebar-bg); border-radius: 4px; display: flex; flex-direction: column; gap: 2px; padding: 4px 3px; flex-shrink:0;">
                        <div style="height: 3px; background: var(--color-primary); border-radius: 2px;"></div>
                        <div style="height: 2px; background: var(--color-sidebar-border); border-radius: 2px;"></div>
                        <div style="height: 2px; background: var(--color-sidebar-border); border-radius: 2px;"></div>
                      </div>
                      <div style="flex:1; display: flex; flex-direction: column; gap: 3px;">
                        <div style="height: 10px; background: var(--color-surface); border-radius: 4px; border: 1px solid var(--color-border-subtle);"></div>
                        <div style="flex:1; background: var(--color-surface); border-radius: 4px; border: 1px solid var(--color-border-subtle);"></div>
                      </div>
                    </div>
                    <div style="text-align:center; font-size:11px; font-weight:500; color:var(--color-text-secondary);">${i18n.t('settings.layoutFloating' as any)}</div>
                    <div style="text-align:center; font-size:10px; color:var(--color-text-tertiary); margin-top:2px;">${i18n.t('settings.layoutFloatingDesc' as any)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. SYSTEM & DATA -->
        <div class="card">
          <div class="card-header" style="background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-subtle);">
            <div style="display:flex; align-items:center; gap:var(--space-3);">
              <div style="color:var(--color-primary);">${Icons.database(20)}</div>
              <h3 class="card-title">${i18n.t('settings.dataManagement' as any)}</h3>
            </div>
          </div>
          <div class="card-body">
            
            ${isElectron ? `
            <div style="padding:var(--space-4); background:var(--color-bg-secondary); border-radius:var(--radius-md); margin-bottom:var(--space-6); border:1px solid var(--color-border);">
              <div style="display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-2);">
                <div style="color:var(--color-info);">${Icons.info(16)}</div>
                <div style="font-size:var(--font-size-sm); font-weight:600;">${i18n.t('settings.dataOnDisk' as any)}</div>
              </div>
              <div id="data-path" style="font-size:var(--font-size-xs); color:var(--color-text-tertiary); font-family:var(--font-mono); padding:var(--space-3); background:var(--color-surface); border-radius:var(--radius-sm); border:1px solid var(--color-border-subtle); word-break:break-all;">
                ${i18n.t('common.loading' as any)}
              </div>
            </div>
            ` : ''}

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-6);">
              
              <!-- Export Card -->
               <div style="display:flex; flex-direction:column; gap:var(--space-2); padding:var(--space-4); border:1px solid var(--color-border-subtle); border-radius:var(--radius-md);">
                 <div style="color:var(--color-success);">${Icons.download(24)}</div>
                 <div style="font-weight:600;">${i18n.t('settings.exportExcel' as any)}</div>
                 <p style="font-size:var(--font-size-xs); color:var(--color-text-secondary); line-height:1.4;">
                   ${isElectron ? i18n.t('settings.exportExcelSubtitleWin' as any) : i18n.t('settings.exportExcelSubtitleWeb' as any)}
                 </p>
                 <button class="btn btn-secondary btn-sm" id="export-btn" style="margin-top:auto;">
                   ${Icons.download(14)} ${i18n.t('settings.exportData' as any)}
                 </button>
               </div>

               <!-- Import Card -->
               <div style="display:flex; flex-direction:column; gap:var(--space-2); padding:var(--space-4); border:1px solid var(--color-border-subtle); border-radius:var(--radius-md);">
                 <div style="color:var(--color-info);">${Icons.upload(24)}</div>
                 <div style="font-weight:600;">${i18n.t('settings.importExcel' as any)}</div>
                 <p style="font-size:var(--font-size-xs); color:var(--color-text-secondary); line-height:1.4;">
                   ${isElectron ? i18n.t('settings.importExcelSubtitleWin' as any) : i18n.t('settings.importExcelSubtitleWeb' as any)}
                 </p>
                 ${isElectron
                   ? `<button class="btn btn-secondary btn-sm" id="import-btn" style="margin-top:auto;">${Icons.upload(14)} ${i18n.t('settings.importData' as any)}</button>`
                   : `<label class="btn btn-secondary btn-sm" style="cursor:pointer; margin-top:auto;">${Icons.upload(14)} ${i18n.t('settings.importData' as any)}<input type="file" id="import-file" accept=".xlsx,.xls" style="display:none;" /></label>`
                 }
               </div>

               <!-- Reset Card -->
               <div style="display:flex; flex-direction:column; gap:var(--space-2); padding:var(--space-4); border:1px solid var(--color-error-subtle); background:var(--color-error-subtle-22); border-radius:var(--radius-md);">
                 <div style="color:var(--color-error);">${Icons.alertTriangle(24)}</div>
                 <div style="font-weight:600; color:var(--color-error);">${i18n.t('settings.clearAllData' as any)}</div>
                 <p style="font-size:var(--font-size-xs); color:var(--color-text-secondary); line-height:1.4;">
                   ${i18n.t('settings.clearAllDataSubtitle' as any)}
                 </p>
                 <button class="btn btn-ghost btn-sm" id="clear-btn" style="color:var(--color-error); border:1px solid rgba(239, 68, 68, 0.2); margin-top:auto;">
                   ${Icons.trash(14)} ${i18n.t('common.delete' as any)}
                 </button>
               </div>
            </div>
          </div>
        </div>

        <!-- ABOUT -->
        <div style="text-align:center; padding:var(--space-8) 0; border-top:1px solid var(--color-border-subtle);">
          <div style="font-size:var(--font-size-sm); font-weight:600; color:var(--color-text-primary);">${i18n.t('settings.about' as any)}</div>
          <div style="font-size:var(--font-size-xs); color:var(--color-text-tertiary); margin-top:4px;">Version 1.0.0 · © 2024 Tijara App</div>
        </div>

      </div>
    `;

    // ── Language Switcher ───────────────────────────────────────────────────
    const langContainer = page.querySelector('#settings-lang-switcher');
    if (langContainer) {
      langContainer.appendChild(createLanguageSwitcher());
    }

    // ── Logo logic ──────────────────────────────────────────────────────────
    const logoInput = page.querySelector<HTMLInputElement>('#logo-input')!;
    const logoRemove = page.querySelector<HTMLButtonElement>('#logo-remove');
    const logoPreview = page.querySelector<HTMLElement>('#logo-preview')!;

    logoInput.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        notifications.error(i18n.t('settings.logoSizeMsg' as any));
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        currentLogo = base64;
        logoPreview.innerHTML = `<img src="${base64}" alt="Logo" style="width:100%; height:100%; object-fit:contain;" />`;
        if (!page.querySelector('#logo-remove')) render(); // re-render to show remove button
      };
      reader.readAsDataURL(file);
    });

    if (logoRemove) {
      logoRemove.addEventListener('click', () => {
        currentLogo = '';
        render();
      });
    }

    // ── Theme logic ─────────────────────────────────────────────────────────
    const darkToggle = page.querySelector<HTMLInputElement>('#dark-mode-toggle')!;
    darkToggle.addEventListener('change', (e) => {
      const isDark = (e.target as HTMLInputElement).checked;
      themeManager.setTheme(isDark ? 'dark' : 'light');
    });

    page.querySelector('#theme-light')?.addEventListener('click', () => {
      themeManager.setTheme('light');
    });
    page.querySelector('#theme-dark')?.addEventListener('click', () => {
      themeManager.setTheme('dark');
    });

    // ── Sidebar theme toggle ─────────────────────────────────────────────────
    const sidebarToggle = page.querySelector<HTMLInputElement>('#sidebar-theme-toggle');
    sidebarToggle?.addEventListener('change', (e) => {
      const isLight = (e.target as HTMLInputElement).checked;
      sidebarThemeService.set(isLight ? 'light' : 'dark');
    });

    // ── Layout Style ────────────────────────────────────────────────────────
    page.querySelector('#layout-classic')?.addEventListener('click', () => {
      layoutService.setLayout('classic');
      render();
    });
    page.querySelector('#layout-modern')?.addEventListener('click', () => {
      layoutService.setLayout('modern');
      render();
    });
    page.querySelector('#layout-floating')?.addEventListener('click', () => {
      layoutService.setLayout('floating');
      render();
    });

    // ── Save Profile ────────────────────────────────────────────────────────
    page.querySelector('#save-profile-btn')?.addEventListener('click', () => {
      const updated = {
        name: page.querySelector<HTMLInputElement>('#ep-name')!.value.trim(),
        tagline: page.querySelector<HTMLInputElement>('#ep-tagline')!.value.trim(),
        email: page.querySelector<HTMLInputElement>('#ep-email')!.value.trim(),
        phone: page.querySelector<HTMLInputElement>('#ep-phone')!.value.trim(),
        address: page.querySelector<HTMLInputElement>('#ep-address')!.value.trim(),
        city: page.querySelector<HTMLInputElement>('#ep-city')!.value.trim(),
        country: page.querySelector<HTMLInputElement>('#ep-country')!.value.trim(),
        website: page.querySelector<HTMLInputElement>('#ep-website')!.value.trim(),
        taxId: page.querySelector<HTMLInputElement>('#ep-taxid')!.value.trim(),
        defaultTaxRate: parseFloat(page.querySelector<HTMLInputElement>('#ep-default-tax')!.value) || 0,
        currency: page.querySelector<HTMLSelectElement>('#ep-currency')!.value,
        defaultPdfLanguage: page.querySelector<HTMLSelectElement>('#ep-pdf-lang')!.value,
        logo: currentLogo,
      };

      profileService.save(updated);
      notifications.success(i18n.t('settings.saveProfileSuccess' as any));
    });

    // ── Data Path ───────────────────────────────────────────────────────────
    if (isElectron) {
      getElectron()!.getDataPath()
        .then((path: string) => {
          const pathEl = page.querySelector('#data-path');
          if (pathEl) pathEl.textContent = path;
        });
    }

    // ── Export/Import ───────────────────────────────────────────────────────
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

    // ── Clear Data ──────────────────────────────────────────────────────────
    page.querySelector('#clear-btn')?.addEventListener('click', () => {
      import('@shared/components/modal').then(({ openModal }) => {
        const content = document.createElement('div');
        content.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; gap:var(--space-4); text-align:center; padding:var(--space-2) 0;">
            <div style="width:56px; height:56px; border-radius:var(--radius-full); background:var(--color-error-subtle); color:var(--color-error); display:flex; align-items:center; justify-content:center;">
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
          onConfirm: () => {
            localStorage.clear();
            notifications.success(i18n.t('settings.notifications.clearedSuccess' as any));
            setTimeout(() => window.location.reload(), 1500);
          }
        });
      });
    });
  };

  render();
  themeManager.subscribe(render);
  i18n.onLanguageChange(render);

  return page;
}
