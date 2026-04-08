/**
 * Top navigation bar component.
 * Shows page title, theme toggle, export button, user avatar, and logout.
 */

import { themeManager } from '@core/theme';
import { router } from '@core/router';
import { Icons } from './icons';
import { getInitials } from '@shared/utils/helpers';
import type { Route, User } from '@core/types';

const ROUTE_TITLES: Record<Route, string> = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  products: 'Products',
  sales: 'Sales',
  invoices: 'Invoices',
  users: 'Users',
  settings: 'Settings',
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

  // Export button
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn-secondary btn-sm';
  exportBtn.setAttribute('aria-label', 'Export data to Excel');
  exportBtn.innerHTML = `${Icons.download(16)} <span>Export</span>`;
  exportBtn.addEventListener('click', () => {
    import('@data/excelRepository').then(({ repository }) => {
      repository.exportToExcel().catch(console.error);
    });
  });

  // User menu (avatar + name + logout dropdown)
  const userMenu = buildUserMenu(currentUser, onLogout);

  right.appendChild(themeBtn);
  right.appendChild(exportBtn);
  right.appendChild(userMenu);

  topbar.appendChild(left);
  topbar.appendChild(right);

  // Update title on route change
  router.subscribe((route) => { title.textContent = ROUTE_TITLES[route]; });

  return topbar;
}

/** Build the user avatar + dropdown menu */
function buildUserMenu(user: User, onLogout: () => void): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'dropdown user-menu';

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

  const menu = document.createElement('div');
  menu.className = 'dropdown-menu user-dropdown';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `
    <div class="user-dropdown-header">
      <div class="user-dropdown-name">${user.name}</div>
      <div class="user-dropdown-email">${user.email}</div>
    </div>
    <div class="dropdown-divider"></div>
    <button class="dropdown-item" id="goto-settings" role="menuitem">
      ${Icons.settings(16)} Settings
    </button>
    <div class="dropdown-divider"></div>
    <button class="dropdown-item danger" id="logout-btn" role="menuitem">
      ${Icons.logOut(16)} Sign out
    </button>
  `;

  let open = false;

  const toggleMenu = () => {
    open = !open;
    menu.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', String(open));
  };

  const closeMenu = () => {
    open = false;
    menu.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  };

  trigger.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });

  menu.querySelector('#goto-settings')?.addEventListener('click', () => {
    closeMenu();
    import('@core/router').then(({ router }) => router.navigate('settings'));
  });

  menu.querySelector('#logout-btn')?.addEventListener('click', () => {
    closeMenu();
    onLogout();
  });

  // Close on outside click
  document.addEventListener('click', closeMenu);

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);
  return wrapper;
}
