/**
 * Top navigation bar component.
 * Shows page title, theme toggle, and user menu with sign-out confirmation.
 * User dropdown uses a body portal to avoid overflow clipping.
 */

import { themeManager } from '@core/theme';
import { router } from '@core/router';
import { Icons } from './icons';
import { getInitials } from '@shared/utils/helpers';
import type { Route, User } from '@core/types';

const ROUTE_TITLES: Record<Route, string> = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  products:  'Products',
  sales:     'Sales',
  invoices:  'Invoices',
  inventory: 'Inventory',
  users:     'Users',
  settings:  'Settings',
};

/** Build and return the topbar element */
export function createTopbar(
  onMenuToggle: () => void,
  currentUser: User,
  onLogout: () => void
): HTMLElement {
  const topbar = document.createElement('header');
  topbar.className = 'topbar';
  topbar.setAttribute('role', 'banner');

  // ── Left ──────────────────────────────────────────────────────────────────
  const left = document.createElement('div');
  left.className = 'topbar-left';

  const menuBtn = document.createElement('button');
  menuBtn.className = 'mobile-menu-btn';
  menuBtn.setAttribute('aria-label', 'Toggle navigation menu');
  menuBtn.innerHTML = Icons.menu();
  menuBtn.addEventListener('click', onMenuToggle);

  const title = document.createElement('h1');
  title.className = 'topbar-title';
  title.id = 'page-title';
  title.textContent = ROUTE_TITLES[router.getRoute()];

  left.appendChild(menuBtn);
  left.appendChild(title);

  // ── Right ─────────────────────────────────────────────────────────────────
  const right = document.createElement('div');
  right.className = 'topbar-right';

  // Theme toggle
  const themeBtn = document.createElement('button');
  themeBtn.className = 'btn btn-ghost btn-icon';
  themeBtn.setAttribute('aria-label', 'Toggle dark/light mode');
  themeBtn.setAttribute('data-tooltip', 'Toggle theme');

  const updateThemeIcon = () => {
    themeBtn.innerHTML = themeManager.getTheme() === 'dark' ? Icons.sun() : Icons.moon();
  };
  updateThemeIcon();
  themeBtn.addEventListener('click', () => { themeManager.toggle(); updateThemeIcon(); });
  themeManager.subscribe(updateThemeIcon);

  // User menu trigger
  const userTrigger = buildUserTrigger(currentUser);

  right.appendChild(themeBtn);
  right.appendChild(userTrigger);

  topbar.appendChild(left);
  topbar.appendChild(right);

  // Update title on route change
  router.subscribe((route) => { title.textContent = ROUTE_TITLES[route]; });

  // ── User dropdown portal ──────────────────────────────────────────────────
  let activePortal: HTMLElement | null = null;

  const closePortal = () => {
    activePortal?.remove();
    activePortal = null;
    userTrigger.setAttribute('aria-expanded', 'false');
  };

  document.addEventListener('click', closePortal);

  userTrigger.addEventListener('click', (e) => {
    e.stopPropagation();

    if (activePortal) {
      closePortal();
      return;
    }

    const rect = userTrigger.getBoundingClientRect();
    const menuWidth = 220;
    const left = Math.max(8, rect.right - menuWidth);
    const top = rect.bottom + 6;

    const portal = document.createElement('div');
    portal.setAttribute('role', 'menu');
    portal.setAttribute('aria-label', 'User menu');
    portal.style.cssText = `
      position: fixed;
      top: ${top}px;
      left: ${left}px;
      width: ${menuWidth}px;
      z-index: 9999;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      animation: slideUp 150ms ease;
    `;

    portal.innerHTML = `
      <div style="padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border);">
        <div style="font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-primary);">${currentUser.name}</div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top: 2px; word-break: break-all;">${currentUser.email}</div>
        <div style="margin-top: var(--space-2);">
          <span class="badge badge-primary" style="font-size: 10px; text-transform: capitalize;">${currentUser.role}</span>
        </div>
      </div>
      <button class="dropdown-item" id="portal-settings" role="menuitem">
        ${Icons.settings(16)} Settings
      </button>
      <div class="dropdown-divider"></div>
      <button class="dropdown-item danger" id="portal-logout" role="menuitem">
        ${Icons.logOut(16)} Sign out
      </button>
    `;

    portal.addEventListener('click', (e) => e.stopPropagation());

    portal.querySelector('#portal-settings')?.addEventListener('click', () => {
      closePortal();
      router.navigate('settings');
    });

    portal.querySelector('#portal-logout')?.addEventListener('click', () => {
      closePortal();
      showSignOutConfirmation(onLogout);
    });

    document.body.appendChild(portal);
    activePortal = portal;
    userTrigger.setAttribute('aria-expanded', 'true');
  });

  return topbar;
}

/** Build the user avatar trigger button */
function buildUserTrigger(user: User): HTMLButtonElement {
  const trigger = document.createElement('button');
  trigger.className = 'user-menu-trigger';
  trigger.setAttribute('aria-label', `User menu for ${user.name}`);
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `
    <div class="avatar avatar-sm">${getInitials(user.name)}</div>
    <div class="user-menu-info">
      <span class="user-menu-name">${user.name}</span>
      <span class="user-menu-role">${user.role}</span>
    </div>
    ${Icons.chevronDown(14)}
  `;
  return trigger;
}

/** Show a sign-out confirmation modal */
function showSignOutConfirmation(onConfirm: () => void): void {
  import('./modal').then(({ openModal }) => {
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-4); text-align: center; padding: var(--space-2) 0;">
        <div style="
          width: 56px; height: 56px; border-radius: var(--radius-full);
          background: var(--color-error-subtle); color: var(--color-error);
          display: flex; align-items: center; justify-content: center;
        ">
          ${Icons.logOut(24)}
        </div>
        <div>
          <p style="font-size: var(--font-size-base); color: var(--color-text-primary); font-weight: 500; margin-bottom: var(--space-2);">
            Sign out of Tijara?
          </p>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
            Your data is saved automatically. You can sign back in at any time.
          </p>
        </div>
      </div>
    `;

    openModal({
      title: 'Sign Out',
      content,
      confirmText: 'Sign Out',
      cancelText: 'Stay',
      confirmClass: 'btn-danger',
      size: 'sm',
      onConfirm,
    });
  });
}
