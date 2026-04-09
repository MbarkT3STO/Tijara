/**
 * Sidebar navigation component.
 */

import { router } from '@core/router';
import { Icons } from './icons';
import { i18n } from '@core/i18n';
import type { Route } from '@core/types';



const NAV_ITEMS: { route: Route; icon: (s?: any) => string; section?: string }[] = [
  { route: 'dashboard', icon: (s) => Icons.dashboard(s), section: 'main' },
  { route: 'customers', icon: (s) => Icons.customers(s), section: 'management' },
  { route: 'products',  icon: (s) => Icons.products(s) },
  { route: 'inventory', icon: (s) => Icons.package(s) },
  { route: 'suppliers', icon: (s) => Icons.truck(s) },
  { route: 'purchases', icon: (s) => Icons.shoppingCart(s) },
  { route: 'returns',   icon: (s) => Icons.refresh(s) },
  { route: 'sales',     icon: (s) => Icons.sales(s) },
  { route: 'invoices',  icon: (s) => Icons.invoices(s) },
  { route: 'reports',   icon: (s) => Icons.barChart(s),  section: 'analytics' },
  { route: 'users',     icon: (s) => Icons.users(s),     section: 'admin' },
  { route: 'settings',  icon: (s) => Icons.settings(s) },
];

/** Build and return the sidebar element */
export function createSidebar(): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.setAttribute('aria-label', 'Main navigation');

  // Logo
  const logo = document.createElement('div');
  logo.className = 'sidebar-logo';
  logo.innerHTML = `
    <div class="sidebar-logo-icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    </div>
    <span class="sidebar-logo-text">Ti<span>jara</span></span>
  `;

  // Nav
  const nav = document.createElement('nav');
  nav.className = 'sidebar-nav';
  nav.setAttribute('role', 'navigation');

  const renderNav = () => {
    nav.innerHTML = '';
    let currentSection = '';
    NAV_ITEMS.forEach((item) => {
      if (item.section && item.section !== currentSection) {
        currentSection = item.section;
        const label = document.createElement('div');
        label.className = 'sidebar-section-label';
        label.textContent = i18n.t(`nav.${item.section}` as any);
        nav.appendChild(label);
      }

      const btn = document.createElement('button');
      btn.className = 'nav-item';
      btn.setAttribute('data-route', item.route);
      const labelText = i18n.t(`nav.${item.route}` as any);
      btn.setAttribute('aria-label', labelText);
      btn.innerHTML = `
        <span class="nav-icon" aria-hidden="true">${item.icon(20)}</span>
        <span class="nav-label">${labelText}</span>
      `;

      btn.addEventListener('click', () => router.navigate(item.route));
      nav.appendChild(btn);
    });
    updateActive(router.getRoute());
  };

  renderNav();
  i18n.onLanguageChange(renderNav);

  // Footer with collapse toggle
  const footer = document.createElement('div');
  footer.className = 'sidebar-footer';
  footer.innerHTML = `
    <button class="sidebar-toggle-btn" aria-label="Toggle sidebar" id="sidebar-toggle" style="transform: scaleX(var(--icon-flip));">
      ${Icons.chevronLeft()}
    </button>
  `;

  sidebar.appendChild(logo);
  sidebar.appendChild(nav);
  sidebar.appendChild(footer);

  // Collapse toggle
  let collapsed = false;
  const toggleBtn = footer.querySelector<HTMLButtonElement>('#sidebar-toggle')!;
  toggleBtn.addEventListener('click', () => {
    collapsed = !collapsed;
    sidebar.classList.toggle('collapsed', collapsed);
    toggleBtn.innerHTML = collapsed ? Icons.chevronRight() : Icons.chevronLeft();
  });

  // Highlight active route
  function updateActive(route: Route) {
    nav.querySelectorAll<HTMLButtonElement>('.nav-item').forEach((btn) => {
      const isActive = btn.getAttribute('data-route') === route;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  router.subscribe(updateActive);

  return sidebar;
}
