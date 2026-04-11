/**
 * Appearance settings sub-module: theme, layout, sidebar, color theme.
 */

import { themeManager } from '@core/theme';
import { Icons } from '@shared/components/icons';
import { i18n } from '@core/i18n';
import { createLanguageSwitcher } from '@shared/components/languageSwitcher';
import { layoutService } from '@core/layout';
import { sidebarThemeService } from '@core/sidebarTheme';
import { colorThemeService } from '@core/colorTheme';
import { densityService } from '@core/densityService';
import type { ColorTheme } from '@core/colorTheme';
import type { DensityMode } from '@core/densityService';

export function buildAppearanceHTML(): string {
  return `
    <div class="card">
      <div class="card-header" style="background:var(--color-bg-secondary);border-bottom:1px solid var(--color-border-subtle);">
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div style="color:var(--color-primary);">${Icons.settings(20)}</div>
          <h3 class="card-title">${i18n.t('settings.appearance' as any)}</h3>
        </div>
      </div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:var(--space-5);">

        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:2px;">${i18n.t('settings.language' as any)}</div>
            <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">${i18n.t('settings.selectLanguage' as any)}</div>
          </div>
          <div id="settings-lang-switcher"></div>
        </div>

        <div class="divider"></div>

        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:2px;">${i18n.t('settings.darkMode' as any)}</div>
            <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">${i18n.t('settings.darkModeSubtitle' as any)}</div>
          </div>
          <label class="toggle" aria-label="Toggle dark mode">
            <input type="checkbox" class="toggle-input" id="dark-mode-toggle" ${themeManager.getTheme() === 'dark' ? 'checked' : ''} />
            <span class="toggle-track"></span>
          </label>
        </div>

        <div class="divider"></div>

        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:2px;">${i18n.t('settings.lightSidebar' as any)}</div>
            <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">${i18n.t('settings.lightSidebarSubtitle' as any)}</div>
          </div>
          <label class="toggle" aria-label="Toggle sidebar theme">
            <input type="checkbox" class="toggle-input" id="sidebar-theme-toggle" ${sidebarThemeService.current === 'light' ? 'checked' : ''} />
            <span class="toggle-track"></span>
          </label>
        </div>

        <div class="divider"></div>

        <div>
          <div style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:var(--space-3);">${i18n.t('settings.colorTheme' as any)}</div>
          <div class="color-theme-swatches" id="color-theme-swatches">
            ${buildColorThemeSwatches()}
          </div>
        </div>

        <div class="divider"></div>

        <div>
          <div style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:var(--space-3);">${i18n.t('settings.themePreview' as any)}</div>
          <div style="display:flex;gap:var(--space-4);">
            <div id="theme-light" style="flex:1;cursor:pointer;border:2px solid ${themeManager.getTheme() === 'light' ? 'var(--color-primary)' : 'var(--color-border)'};border-radius:var(--radius-md);padding:var(--space-2);transition:transform 0.2s;">
              <div style="background:#f8f7ff;border-radius:var(--radius-sm);padding:var(--space-3);height:70px;display:flex;flex-direction:column;gap:6px;">
                <div style="height:8px;width:60%;background:var(--color-primary);border-radius:4px;"></div>
                <div style="height:6px;width:80%;background:var(--color-primary-subtle);border-radius:4px;"></div>
              </div>
              <div style="text-align:center;font-size:11px;font-weight:500;margin-top:var(--space-2);color:var(--color-text-secondary);">${i18n.t('settings.light' as any)}</div>
            </div>
            <div id="theme-dark" style="flex:1;cursor:pointer;border:2px solid ${themeManager.getTheme() === 'dark' ? 'var(--color-primary)' : 'var(--color-border)'};border-radius:var(--radius-md);padding:var(--space-2);transition:transform 0.2s;">
              <div style="background:#111111;border-radius:var(--radius-sm);padding:var(--space-3);height:70px;display:flex;flex-direction:column;gap:6px;">
                <div style="height:8px;width:60%;background:var(--color-primary);border-radius:4px;"></div>
                <div style="height:6px;width:80%;background:var(--color-primary-subtle);border-radius:4px;"></div>
              </div>
              <div style="text-align:center;font-size:11px;font-weight:500;margin-top:var(--space-2);color:var(--color-text-secondary);">${i18n.t('settings.dark' as any)}</div>
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <div>
          <div style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:4px;">${i18n.t('settings.density' as any)}</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);margin-bottom:var(--space-3);">${i18n.t('settings.densitySubtitle' as any)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);">
            ${buildDensityCard('compact', densityService.current === 'compact')}
            ${buildDensityCard('comfortable', densityService.current === 'comfortable')}
            ${buildDensityCard('spacious', densityService.current === 'spacious')}
          </div>
        </div>

        <div class="divider"></div>

        <div>
          <div style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:var(--space-3);">${i18n.t('settings.layoutStyle' as any)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);">
            ${buildLayoutCard('classic', layoutService.currentLayout === 'classic')}
            ${buildLayoutCard('modern', layoutService.currentLayout === 'modern')}
            ${buildLayoutCard('floating', layoutService.currentLayout === 'floating')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildDensityCard(id: DensityMode, active: boolean): string {
  const border = active ? 'var(--color-primary)' : 'var(--color-border)';
  const bg = active ? 'var(--color-primary-subtle)' : 'transparent';
  const rowHeights: Record<DensityMode, string> = {
    compact:     '3px,3px,3px',
    comfortable: '4px,4px,4px',
    spacious:    '6px,6px,6px',
  };
  const heights = rowHeights[id].split(',');
  const preview = heights.map(h =>
    `<div style="height:${h};background:var(--color-border);border-radius:2px;margin-bottom:3px;"></div>`
  ).join('');
  const labelKey = `settings.density${id.charAt(0).toUpperCase() + id.slice(1)}` as any;
  const descKey = `settings.density${id.charAt(0).toUpperCase() + id.slice(1)}Desc` as any;
  return `
    <div id="density-${id}" style="flex:1;min-width:90px;cursor:pointer;border:1.5px solid ${border};border-radius:var(--radius-md);padding:var(--space-3);background:${bg};transition:border-color 0.2s,background 0.2s;">
      <div style="background:var(--color-bg-secondary);border-radius:var(--radius-sm);height:50px;display:flex;flex-direction:column;justify-content:center;padding:var(--space-2);margin-bottom:var(--space-2);">${preview}</div>
      <div style="text-align:center;font-size:11px;font-weight:500;color:var(--color-text-secondary);">${i18n.t(labelKey)}</div>
      <div style="text-align:center;font-size:10px;color:var(--color-text-tertiary);margin-top:2px;">${i18n.t(descKey)}</div>
    </div>`;
}

function buildLayoutCard(id: 'classic' | 'modern' | 'floating', active: boolean): string {
  const border = active ? 'var(--color-primary)' : 'var(--color-border)';
  const bg = active ? 'var(--color-primary-subtle)' : 'transparent';
  const previews: Record<string, string> = {
    classic: `<div style="width:28px;background:#0f0a1e;display:flex;flex-direction:column;gap:3px;padding:6px 4px;"><div style="height:4px;background:var(--color-primary);border-radius:2px;"></div><div style="height:3px;background:rgba(255,255,255,0.2);border-radius:2px;"></div><div style="height:3px;background:rgba(255,255,255,0.2);border-radius:2px;"></div></div><div style="flex:1;padding:6px;display:flex;flex-direction:column;gap:3px;"><div style="height:4px;width:70%;background:var(--color-border);border-radius:2px;"></div><div style="height:3px;width:50%;background:var(--color-border-subtle);border-radius:2px;"></div></div>`,
    modern: `<div style="width:14px;background:#0f0a1e;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;"><div style="width:8px;height:8px;background:var(--color-primary);border-radius:2px;"></div><div style="width:6px;height:6px;background:rgba(255,255,255,0.3);border-radius:1px;"></div></div><div style="flex:1;padding:6px;display:flex;flex-direction:column;gap:3px;"><div style="height:4px;width:70%;background:var(--color-border);border-radius:2px;"></div></div>`,
    floating: `<div style="width:22px;background:var(--color-sidebar-bg);border-radius:4px;display:flex;flex-direction:column;gap:2px;padding:4px 3px;flex-shrink:0;"><div style="height:3px;background:var(--color-primary);border-radius:2px;"></div><div style="height:2px;background:var(--color-sidebar-border);border-radius:2px;"></div></div><div style="flex:1;display:flex;flex-direction:column;gap:3px;"><div style="height:10px;background:var(--color-surface);border-radius:4px;border:1px solid var(--color-border-subtle);"></div><div style="flex:1;background:var(--color-surface);border-radius:4px;border:1px solid var(--color-border-subtle);"></div></div>`,
  };
  return `
    <div id="layout-${id}" style="flex:1;min-width:100px;cursor:pointer;border:1.5px solid ${border};border-radius:var(--radius-md);padding:var(--space-3);background:${bg};transition:border-color 0.2s,background 0.2s;">
      <div style="background:var(--color-bg-secondary);border-radius:var(--radius-sm);height:60px;display:flex;overflow:hidden;margin-bottom:var(--space-2);gap:3px;padding:5px;">${previews[id]}</div>
      <div style="text-align:center;font-size:11px;font-weight:500;color:var(--color-text-secondary);">${i18n.t(`settings.layout${id.charAt(0).toUpperCase() + id.slice(1)}` as any)}</div>
      <div style="text-align:center;font-size:10px;color:var(--color-text-tertiary);margin-top:2px;">${i18n.t(`settings.layout${id.charAt(0).toUpperCase() + id.slice(1)}Desc` as any)}</div>
    </div>`;
}

export function attachAppearanceEvents(page: HTMLElement, rerender: () => void): void {
  const langContainer = page.querySelector('#settings-lang-switcher');
  if (langContainer) langContainer.appendChild(createLanguageSwitcher());

  page.querySelector<HTMLInputElement>('#dark-mode-toggle')?.addEventListener('change', (e) => {
    themeManager.setTheme((e.target as HTMLInputElement).checked ? 'dark' : 'light');
  });
  page.querySelector('#theme-light')?.addEventListener('click', () => { themeManager.setTheme('light'); rerender(); });
  page.querySelector('#theme-dark')?.addEventListener('click', () => { themeManager.setTheme('dark'); rerender(); });

  page.querySelector<HTMLInputElement>('#sidebar-theme-toggle')?.addEventListener('change', (e) => {
    sidebarThemeService.set((e.target as HTMLInputElement).checked ? 'light' : 'dark');
  });

  page.querySelector('#layout-classic')?.addEventListener('click', () => { layoutService.setLayout('classic'); rerender(); });
  page.querySelector('#layout-modern')?.addEventListener('click', () => { layoutService.setLayout('modern'); rerender(); });
  page.querySelector('#layout-floating')?.addEventListener('click', () => { layoutService.setLayout('floating'); rerender(); });

  // Density picker
  page.querySelector('#density-compact')?.addEventListener('click', () => { densityService.set('compact'); rerender(); });
  page.querySelector('#density-comfortable')?.addEventListener('click', () => { densityService.set('comfortable'); rerender(); });
  page.querySelector('#density-spacious')?.addEventListener('click', () => { densityService.set('spacious'); rerender(); });

  // Color theme swatches
  page.querySelectorAll<HTMLButtonElement>('[data-color-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-color-theme') as ColorTheme;
      colorThemeService.set(theme);
      // Update active state without full rerender
      page.querySelectorAll<HTMLButtonElement>('[data-color-theme]').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-color-theme') === theme);
      });
    });
  });
}

// ── Color theme swatch gradients ──────────────────────────────────────────────

const THEME_GRADIENTS: Record<ColorTheme, string> = {
  violet: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
  ocean:  'linear-gradient(135deg, #0891b2, #67e8f9)',
  forest: 'linear-gradient(135deg, #16a34a, #86efac)',
  copper: 'linear-gradient(135deg, #c2410c, #fb923c)',
  slate:  'linear-gradient(135deg, #334155, #94a3b8)',
};

const THEME_LABELS: Record<ColorTheme, string> = {
  violet: 'settings.colorThemeViolet',
  ocean:  'settings.colorThemeOcean',
  forest: 'settings.colorThemeForest',
  copper: 'settings.colorThemeCopper',
  slate:  'settings.colorThemeSlate',
};

function buildColorThemeSwatches(): string {
  const themes: ColorTheme[] = ['violet', 'ocean', 'forest', 'copper', 'slate'];
  const current = colorThemeService.current;
  return themes.map((theme) => `
    <div class="color-theme-swatch-wrap">
      <button
        class="color-theme-swatch${current === theme ? ' active' : ''}"
        data-color-theme="${theme}"
        aria-label="${i18n.t(THEME_LABELS[theme] as any)}"
        aria-pressed="${current === theme}"
        style="background: ${THEME_GRADIENTS[theme]};"
      ></button>
      <span class="color-theme-swatch-label">${i18n.t(THEME_LABELS[theme] as any)}</span>
    </div>
  `).join('');
}
