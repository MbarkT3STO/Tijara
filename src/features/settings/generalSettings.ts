/**
 * General settings sub-module: company info, currency, language.
 */

import { Icons } from '@shared/components/icons';
import { i18n } from '@core/i18n';
import { notifications } from '@core/notifications';
import { profileService } from '@services/profileService';
import type { ElectronAPI } from '../../../electron/preload';

function getElectron(): ElectronAPI | null {
  return (window as unknown as { electron?: ElectronAPI }).electron ?? null;
}

const CURRENCIES: string[] = [
  'USD','EUR','GBP','JPY','CNY','INR','CAD','AUD','CHF','HKD',
  'SGD','SEK','NOK','DKK','NZD','MXN','BRL','ZAR','AED','SAR',
  'QAR','KWD','BHD','OMR','JOD','EGP','MAD','TND','DZD','LYD',
  'TRY','RUB','KRW','IDR','MYR','THB','PHP','PKR','BDT','NGN',
  'GHS','KES','ETB','TZS','UGX','XOF','XAF','ILS','CZK','PLN',
  'HUF','RON','HRK','BGN','CLP','COP','PEN','ARS',
];

export function buildGeneralHTML(currentLogo: string): string {
  const profile = profileService.get();
  return `
    <!-- Business Identity -->
    <div class="card overflow-hidden">
      <div class="card-header" style="background:var(--color-bg-secondary);border-bottom:1px solid var(--color-border-subtle);">
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div style="color:var(--color-primary);">${Icons.building(20)}</div>
          <h3 class="card-title">${i18n.t('settings.enterpriseProfile' as any)}</h3>
        </div>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-6);">
          <!-- Logo -->
          <div style="display:flex;flex-direction:column;gap:var(--space-4);">
            <div style="font-weight:600;font-size:var(--font-size-sm);color:var(--color-text-secondary);">${i18n.t('settings.companyLogo' as any)}</div>
            <div style="display:flex;align-items:center;gap:var(--space-4);">
              <div id="logo-preview" style="width:100px;height:100px;border-radius:var(--radius-md);border:2px dashed var(--color-border);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;background:var(--color-surface);">
                ${currentLogo ? `<img src="${currentLogo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />` : `<span style="color:var(--color-text-tertiary);">${Icons.image(24)}</span>`}
              </div>
              <div style="display:flex;flex-direction:column;gap:var(--space-2);">
                <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);max-width:200px;">${i18n.t('settings.logoHint' as any)}</div>
                <div style="display:flex;gap:var(--space-2);">
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
          <div style="display:flex;flex-direction:column;gap:var(--space-4);">
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

    <!-- Contact & Location -->
    <div class="card">
      <div class="card-header" style="background:var(--color-bg-secondary);border-bottom:1px solid var(--color-border-subtle);">
        <div style="display:flex;align-items:center;gap:var(--space-3);">
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
              <span style="position:absolute;left:var(--space-3);top:50%;transform:translateY(-50%);color:var(--color-text-tertiary);">${Icons.link(14)}</span>
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

    <!-- Billing & Invoicing -->
    <div class="card">
      <div class="card-header" style="background:var(--color-bg-secondary);border-bottom:1px solid var(--color-border-subtle);">
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div style="color:var(--color-primary);">${Icons.invoices(20)}</div>
          <h3 class="card-title">${i18n.t('nav.invoices' as any)}</h3>
        </div>
      </div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:var(--space-4);">
        <div class="form-group">
          <label class="form-label" for="ep-currency">${i18n.t('settings.defaultCurrency' as any)}</label>
          <select id="ep-currency" class="form-control">
            ${CURRENCIES.map((code) => `<option value="${code}" ${(profile.currency || 'USD') === code ? 'selected' : ''}>${code} — ${i18n.t(`currencies.${code}` as any)}</option>`).join('')}
          </select>
          <span class="form-hint">${i18n.t('settings.currencyHint' as any)}</span>
        </div>
        <div class="form-group">
          <label class="form-label" for="ep-default-tax">${i18n.t('settings.defaultTaxRate' as any)}</label>
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <input type="number" id="ep-default-tax" class="form-control" placeholder="0" min="0" max="100" step="0.01" value="${profile.defaultTaxRate ?? 0}" />
            <span style="font-weight:600;color:var(--color-text-tertiary);">%</span>
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
  `;
}

export function attachGeneralEvents(
  page: HTMLElement,
  getCurrentLogo: () => string,
  setCurrentLogo: (v: string) => void,
  rerender: () => void
): void {
  const logoInput = page.querySelector<HTMLInputElement>('#logo-input');
  const logoRemove = page.querySelector<HTMLButtonElement>('#logo-remove');
  const logoPreview = page.querySelector<HTMLElement>('#logo-preview');

  logoInput?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { notifications.error(i18n.t('settings.logoSizeMsg' as any)); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setCurrentLogo(base64);
      if (logoPreview) logoPreview.innerHTML = `<img src="${base64}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
      if (!page.querySelector('#logo-remove')) rerender();
    };
    reader.readAsDataURL(file);
  });

  logoRemove?.addEventListener('click', () => { setCurrentLogo(''); rerender(); });

  page.querySelector('#save-profile-btn')?.addEventListener('click', () => {
    const g = <T extends HTMLElement>(id: string) => page.querySelector<T>(`#${id}`)!;
    profileService.save({
      name:               (g<HTMLInputElement>('ep-name')).value.trim(),
      tagline:            (g<HTMLInputElement>('ep-tagline')).value.trim(),
      email:              (g<HTMLInputElement>('ep-email')).value.trim(),
      phone:              (g<HTMLInputElement>('ep-phone')).value.trim(),
      address:            (g<HTMLInputElement>('ep-address')).value.trim(),
      city:               (g<HTMLInputElement>('ep-city')).value.trim(),
      country:            (g<HTMLInputElement>('ep-country')).value.trim(),
      website:            (g<HTMLInputElement>('ep-website')).value.trim(),
      taxId:              (g<HTMLInputElement>('ep-taxid')).value.trim(),
      defaultTaxRate:     parseFloat((g<HTMLInputElement>('ep-default-tax')).value) || 0,
      currency:           (g<HTMLSelectElement>('ep-currency')).value,
      defaultPdfLanguage: (g<HTMLSelectElement>('ep-pdf-lang')).value,
      logo:               getCurrentLogo(),
    });
    notifications.success(i18n.t('settings.saveProfileSuccess' as any));
  });

  // Data path (Electron only)
  const electron = getElectron();
  if (electron) {
    electron.getDataPath().then((path: string) => {
      const el = page.querySelector('#data-path');
      if (el) el.textContent = path;
    });
  }
}
