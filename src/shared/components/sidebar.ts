/**
 * Sidebar navigation component.
 */

import { router } from '@core/router';
import { Icons } from './icons';
import type { Route } from '@core/types';

interface NavItem {
  route: Route;
  label: string;
  icon: string;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { route: 'dashboard', label: 'Dashboard',  icon: Icons.dashboard(),  section: 'Main' },
  { route: 'customers', label: 'Customers',  icon: Icons.customers(),  section: 'Management' },
  { route: 'products',  label: 'Products',   icon: Icons.products() },
  { route: 'inventory', label: 'Inventory',  icon: Icons.package() },
  { route: 'suppliers', label: 'Suppliers',  icon: Icons.truck() },
  { route: 'sales',     label: 'Sales',      icon: Icons.sales() },
  { route: 'invoices',  label: 'Invoices',   icon: Icons.invoices() },
  { route: 'reports',   label: 'Reports',    icon: Icons.barChart(),   section: 'Analytics' },
  { route: 'users',     label: 'Users',      icon: Icons.users(),      section: 'Admin' },
  { route: 'settings',  label: 'Settings',   icon: Icons.settings() },
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

  let currentSection = '';
  NAV_ITEMS.forEach((item) => {
    if (item.section && item.section !== currentSection) {
      currentSection = item.section;
      const label = document.createElement('div');
      label.className = 'sidebar-section-label';
      label.textContent = item.section;
      nav.appendChild(label);
    }

    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.setAttribute('data-route', item.route);
    btn.setAttribute('aria-label', item.label);
    btn.innerHTML = `
      <span class="nav-icon" aria-hidden="true">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
    `;

    btn.addEventListener('click', () => router.navigate(item.route));
    nav.appendChild(btn);
  });

  // Footer with collapse toggle
  const footer = document.createElement('div');
  footer.className = 'sidebar-footer';
  footer.innerHTML = `
    <button class="sidebar-toggle-btn" aria-label="Toggle sidebar" id="sidebar-toggle">
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
  updateActive(router.getRoute());

  return sidebar;
}
