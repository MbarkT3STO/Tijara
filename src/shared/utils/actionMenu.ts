/**
 * Shared three-dot action menu (body portal).
 * Appends a dropdown to document.body positioned near the trigger button,
 * escaping any overflow:hidden containers.
 */

import { Icons } from '@shared/components/icons';
import { i18n } from '@core/i18n';

export interface ActionMenuItem {
  label: string;
  icon: string;
  action: string;
  danger?: boolean;
  disabled?: boolean;
  dividerBefore?: boolean;
}

let _activePortal: HTMLElement | null = null;
let _activeTrigger: HTMLButtonElement | null = null;

function closeActivePortal(): void {
  _activePortal?.remove();
  _activePortal = null;
  _activeTrigger?.setAttribute('aria-expanded', 'false');
  _activeTrigger = null;
}

// Close on any outside click or scroll
document.addEventListener('click', closeActivePortal);
document.addEventListener('scroll', closeActivePortal, true);

/**
 * Build the three-dot trigger button HTML for use inside a table cell.
 * Use data-menu-id to link the trigger to its item id.
 */
export function menuTriggerHTML(id: string): string {
  return `<button
    class="btn btn-ghost btn-icon btn-sm menu-trigger"
    data-menu-id="${id}"
    aria-label="${i18n.t('common.actions')}"
    aria-haspopup="true"
    aria-expanded="false"
  >${Icons.moreVertical(16)}</button>`;
}

/**
 * Attach three-dot menu to all `.menu-trigger` buttons inside `container`.
 * `getItems` receives the item id and returns the menu items to show.
 * `onAction` receives (action, id) when a menu item is clicked.
 */
export function attachMenuTriggers(
  container: HTMLElement,
  getItems: (id: string) => ActionMenuItem[],
  onAction: (action: string, id: string) => void
): void {
  container.querySelectorAll<HTMLButtonElement>('.menu-trigger').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = trigger.getAttribute('data-menu-id')!;

      // Toggle off if same trigger clicked again
      if (_activeTrigger === trigger) {
        closeActivePortal();
        return;
      }
      closeActivePortal();

      const items = getItems(id);
      const rect = trigger.getBoundingClientRect();
      const menuWidth = 180;

      const portal = document.createElement('div');
      portal.setAttribute('role', 'menu');
      portal.setAttribute('aria-label', i18n.t('common.actions'));
      portal.innerHTML = items.map((item) => `
        ${item.dividerBefore ? '<div class="dropdown-divider"></div>' : ''}
        <button
          class="dropdown-item${item.danger ? ' danger' : ''}"
          data-action="${item.action}"
          role="menuitem"
          ${item.disabled ? 'disabled' : ''}
        >${item.icon} ${item.label}</button>
      `).join('');

      // Position: align to right edge of trigger, flip up if near bottom
      let top = rect.bottom + 4;
      let left = rect.right - menuWidth;
      if (top + items.length * 36 + 16 > window.innerHeight) top = rect.top - (items.length * 36 + 16);
      if (left < 8) left = 8;

      portal.style.cssText = `
        position:fixed;
        top:${top}px;
        left:${left}px;
        width:${menuWidth}px;
        z-index:9999;
        background:var(--color-surface);
        border:1px solid var(--color-border);
        border-radius:var(--radius-md);
        box-shadow:var(--shadow-lg);
        overflow:hidden;
        animation:slideUp 120ms ease;
      `;

      portal.addEventListener('click', (ev) => ev.stopPropagation());
      portal.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          closeActivePortal();
          onAction(btn.getAttribute('data-action')!, id);
        });
      });

      document.body.appendChild(portal);
      _activePortal = portal;
      _activeTrigger = trigger;
      trigger.setAttribute('aria-expanded', 'true');
    });
  });
}
