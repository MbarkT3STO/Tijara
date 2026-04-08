/**
 * Top navigation bar component.
 * Contains page title, theme toggle, and export button.
 */

import { themeManager } from '@core/theme';
import { router } from '@core/router';
import { Icons } from './icons';
import type { Route } from '@core/types';

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
export function createTopbar(onMenuToggle: () => void): HTMLElement {
  const topbar = document.createElement('header');
  topbar.className = 'topbar';
  topbar.setAttribute('role', 'banner');

  // Left side
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

  // Right side
  const right = document.createElement('div');
  right.className = 'topbar-right';

  // Theme toggle button
  const themeBtn = document.createElement('button');
  themeBtn.className = 'btn btn-ghost btn-icon';
  themeBtn.setAttribute('aria-label', 'Toggle dark/light mode');
  themeBtn.setAttribute('data-tooltip', 'Toggle theme');

  const updateThemeIcon = () => {
    const isDark = themeManager.getTheme() === 'dark';
    themeBtn.innerHTML = isDark ? Icons.sun() : Icons.moon();
  };

  updateThemeIcon();
  themeBtn.addEventListener('click', () => {
    themeManager.toggle();
    updateThemeIcon();
  });
  themeManager.subscribe(updateThemeIcon);

  // Export to Excel button
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn-secondary btn-sm';
  exportBtn.setAttribute('aria-label', 'Export data to Excel');
  exportBtn.innerHTML = `${Icons.download(16)} <span>Export</span>`;
  exportBtn.addEventListener('click', () => {
    import('@data/excelRepository').then(({ repository }) => {
      repository.exportToExcel().catch(console.error);
    });
  });

  // User avatar (static for now)
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.setAttribute('title', 'Admin User');
  avatar.setAttribute('aria-label', 'Logged in as Admin User');
  avatar.textContent = 'AU';

  right.appendChild(themeBtn);
  right.appendChild(exportBtn);
  right.appendChild(avatar);

  topbar.appendChild(left);
  topbar.appendChild(right);

  // Update page title on route change
  router.subscribe((route) => {
    title.textContent = ROUTE_TITLES[route];
  });

  return topbar;
}
