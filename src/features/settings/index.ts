/**
 * Settings page – thin orchestrator.
 * Delegates to sub-modules: general, appearance, data, accounting.
 */

import { Icons } from '@shared/components/icons';
import { i18n } from '@core/i18n';
import { themeManager } from '@core/theme';
import { buildGeneralHTML, attachGeneralEvents } from './generalSettings';
import { buildAppearanceHTML, attachAppearanceEvents } from './appearanceSettings';
import { buildDataHTML, attachDataEvents } from './dataSettings';
import { buildAccountingSetupHTML, attachAccountingEvents } from './accountingSettings';

export function renderSettings(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container';

  let currentLogo = '';
  // Load logo from profile lazily to avoid circular import at module level
  import('@services/profileService').then(({ profileService }) => {
    currentLogo = profileService.get().logo || '';
    render();
  });

  const render = () => {
    page.innerHTML = `
      <div style="max-width:1000px;margin:0 auto;width:100%;display:grid;gap:var(--space-6);">
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

        ${buildGeneralHTML(currentLogo)}

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(450px,1fr));gap:var(--space-6);">
          ${buildAppearanceHTML()}
        </div>

        ${buildDataHTML()}

        ${buildAccountingSetupHTML()}

        <div style="text-align:center;padding:var(--space-8) 0;border-top:1px solid var(--color-border-subtle);">
          <div style="font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-primary);">${i18n.t('settings.about' as any)}</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-top:4px;">Version 1.0.0 · © 2024 Tijara App</div>
        </div>
      </div>
    `;

    attachGeneralEvents(page, () => currentLogo, (v) => { currentLogo = v; }, render);
    attachAppearanceEvents(page, render);
    attachDataEvents(page);
    attachAccountingEvents(page, render);
  };

  render();
  themeManager.subscribe(render);
  i18n.onLanguageChange(render);

  return page;
}
