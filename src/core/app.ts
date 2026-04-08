/**
 * Application bootstrap – assembles the shell layout and wires up routing.
 */

import { router } from './router';
import { createSidebar } from '@shared/components/sidebar';
import { createTopbar } from '@shared/components/topbar';
import { initToasts } from '@shared/components/toast';
import { repository } from '@data/excelRepository';
import type { Route } from './types';

/** Lazy-loaded page renderers */
const PAGE_RENDERERS: Record<Route, () => Promise<HTMLElement>> = {
  dashboard: () => import('@features/dashboard/dashboard').then((m) => m.renderDashboard()),
  customers: () => import('@features/customers/customers').then((m) => m.renderCustomers()),
  products: () => import('@features/products/products').then((m) => m.renderProducts()),
  sales: () => import('@features/sales/sales').then((m) => m.renderSales()),
  invoices: () => import('@features/invoices/invoices').then((m) => m.renderInvoices()),
  users: () => import('@features/users/users').then((m) => m.renderUsers()),
  settings: () => import('@features/settings/settings').then((m) => m.renderSettings()),
};

/** Bootstrap the application */
export async function bootstrap(root: HTMLElement): Promise<void> {
  // Initialize data layer
  await repository.init();

  // Register Electron menu listeners (export/import from File menu)
  repository.registerMenuListeners(
    () => repository.exportToExcel().catch(console.error),
    async () => {
      await repository.importFromExcel();
      window.location.reload();
    }
  );

  // Initialize toast notifications
  initToasts();

  // Build shell
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const sidebar = createSidebar();

  // Mobile overlay
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.addEventListener('click', closeMobileMenu);

  const mainArea = document.createElement('div');
  mainArea.className = 'main-area';

  const topbar = createTopbar(() => toggleMobileMenu());

  const contentArea = document.createElement('main');
  contentArea.className = 'content-area';
  contentArea.setAttribute('id', 'main-content');
  contentArea.setAttribute('role', 'main');
  contentArea.setAttribute('aria-labelledby', 'page-title');

  mainArea.appendChild(topbar);
  mainArea.appendChild(contentArea);

  shell.appendChild(sidebar);
  shell.appendChild(mainArea);

  root.appendChild(overlay);
  root.appendChild(shell);

  // Mobile menu helpers
  function toggleMobileMenu() {
    const isOpen = sidebar.classList.contains('mobile-open');
    if (isOpen) {
      closeMobileMenu();
    } else {
      sidebar.classList.add('mobile-open');
      overlay.classList.add('visible');
    }
  }

  function closeMobileMenu() {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('visible');
  }

  // Route handler
  async function handleRoute(route: Route) {
    closeMobileMenu();

    // Show loading state
    contentArea.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 200px;">
        <div class="spinner"></div>
      </div>
    `;

    try {
      const renderer = PAGE_RENDERERS[route];
      const pageEl = await renderer();
      contentArea.innerHTML = '';
      contentArea.appendChild(pageEl);
      // Scroll to top on navigation
      contentArea.scrollTop = 0;
    } catch (err) {
      console.error('Failed to load page:', err);
      contentArea.innerHTML = `
        <div class="content-inner">
          <div class="empty-state">
            <div class="empty-state-icon" style="color: var(--color-error);">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p class="empty-state-title">Failed to load page</p>
            <p class="empty-state-desc">Something went wrong. Please try again.</p>
            <button class="btn btn-primary" onclick="window.location.reload()">Reload</button>
          </div>
        </div>
      `;
    }
  }

  // Subscribe to route changes
  router.subscribe(handleRoute);

  // Load initial route
  await handleRoute(router.getRoute());
}
