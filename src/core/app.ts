/**
 * Application bootstrap.
 * 1. Initialises data + auth
 * 2. Shows the auth screen if no valid session exists
 * 3. Builds the main shell once authenticated
 */

import { router } from './router';
import { authService } from '@services/authService';
import { createSidebar } from '@shared/components/sidebar';
import { createTopbar } from '@shared/components/topbar';
import { initToasts } from '@shared/components/toast';
import { repository } from '@data/excelRepository';
import type { Route, User } from './types';

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

export async function bootstrap(root: HTMLElement): Promise<void> {
  await repository.init();

  repository.registerMenuListeners(
    () => repository.exportToExcel().catch(console.error),
    async () => {
      await repository.importFromExcel();
      window.location.reload();
    }
  );

  initToasts();

  const sessionUser = authService.restoreSession();
  if (sessionUser) {
    buildShell(root, sessionUser);
  } else {
    showAuthScreen(root);
  }
}

function showAuthScreen(root: HTMLElement): void {
  import('@features/auth/auth').then(({ renderAuthScreen }) => {
    const authEl = renderAuthScreen((user: User) => {
      root.removeChild(authEl);
      buildShell(root, user);
    });
    root.appendChild(authEl);
  });
}

function buildShell(root: HTMLElement, user: User): void {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const sidebar = createSidebar();

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.addEventListener('click', () => closeMobileMenu(sidebar, overlay));

  const mainArea = document.createElement('div');
  mainArea.className = 'main-area';

  const topbar = createTopbar(
    () => toggleMobileMenu(sidebar, overlay),
    user,
    () => handleLogout(root, shell, overlay)
  );

  const contentArea = document.createElement('main');
  contentArea.className = 'content-area';
  contentArea.id = 'main-content';
  contentArea.setAttribute('role', 'main');
  contentArea.setAttribute('aria-labelledby', 'page-title');

  mainArea.appendChild(topbar);
  mainArea.appendChild(contentArea);
  shell.appendChild(sidebar);
  shell.appendChild(mainArea);
  root.appendChild(overlay);
  root.appendChild(shell);

  router.subscribe((route) => loadPage(route, contentArea, sidebar, overlay));
  void loadPage(router.getRoute(), contentArea, sidebar, overlay);
}

async function loadPage(
  route: Route,
  contentArea: HTMLElement,
  sidebar: HTMLElement,
  overlay: HTMLElement
): Promise<void> {
  closeMobileMenu(sidebar, overlay);
  contentArea.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;"><div class="spinner"></div></div>`;
  try {
    const el = await PAGE_RENDERERS[route]();
    contentArea.innerHTML = '';
    contentArea.appendChild(el);
    contentArea.scrollTop = 0;
  } catch (err) {
    console.error('Failed to load page:', err);
    contentArea.innerHTML = `<div class="content-inner"><div class="empty-state"><p class="empty-state-title">Failed to load page</p><button class="btn btn-primary" onclick="window.location.reload()">Reload</button></div></div>`;
  }
}

function toggleMobileMenu(sidebar: HTMLElement, overlay: HTMLElement): void {
  sidebar.classList.contains('mobile-open')
    ? closeMobileMenu(sidebar, overlay)
    : openMobileMenu(sidebar, overlay);
}

function openMobileMenu(sidebar: HTMLElement, overlay: HTMLElement): void {
  sidebar.classList.add('mobile-open');
  overlay.classList.add('visible');
}

function closeMobileMenu(sidebar: HTMLElement, overlay: HTMLElement): void {
  sidebar.classList.remove('mobile-open');
  overlay.classList.remove('visible');
}

function handleLogout(root: HTMLElement, shell: HTMLElement, overlay: HTMLElement): void {
  authService.logout();
  if (root.contains(shell)) root.removeChild(shell);
  if (root.contains(overlay)) root.removeChild(overlay);
  window.location.hash = '#/dashboard';
  showAuthScreen(root);
}
