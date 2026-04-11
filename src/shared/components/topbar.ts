/**
 * Top navigation bar component.
 * Shows page title, theme toggle, notifications bell, and user menu.
 * Both dropdowns use body portals to avoid overflow clipping.
 * In Modern layout: slim 36px height with breadcrumb trail.
 */

import { themeService } from '@core/theme';
import { router } from '@core/router';
import { Icons } from './icons';
import { getInitials, escapeHtml } from '@shared/utils/helpers';
import { alertService } from '@services/alertService';
import { notifications } from '@core/notifications';
import { i18n } from '@core/i18n';
import { layoutService } from '@core/layout';
import type { User } from '@core/types';
import type { SystemAlert } from '@services/alertService';
import type { NotificationHistoryEntry } from '@core/notifications';



const SEVERITY_COLORS: Record<SystemAlert['severity'], { icon: string; color: string; bg: string; border: string }> = {
  error:   { icon: Icons.alertCircle(16), color: 'var(--color-error)',   bg: 'var(--color-error-subtle)',   border: 'rgba(239,68,68,.2)' },
  warning: { icon: Icons.alertCircle(16), color: 'var(--color-warning)', bg: 'var(--color-warning-subtle)', border: 'rgba(245,158,11,.2)' },
  info:    { icon: Icons.info(16),        color: 'var(--color-info)',    bg: 'var(--color-info-subtle)',    border: 'rgba(59,130,246,.2)' },
};

const CATEGORY_ICONS: Record<SystemAlert['category'], string> = {
  inventory: Icons.package(16),
  invoice:   Icons.invoices(16),
  purchase:  Icons.truck(16),
  return:    Icons.refresh(16),
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
  menuBtn.setAttribute('aria-label', i18n.t('topbar.toggleMenu' as any));
  menuBtn.innerHTML = Icons.menu();
  menuBtn.addEventListener('click', onMenuToggle);

  const title = document.createElement('h1');
  title.className = 'topbar-title';
  title.id = 'page-title';
  title.textContent = i18n.t(`nav.${router.getRoute()}` as any) || router.getRoute();

  // Breadcrumb (visible in Modern layout only via CSS)
  const breadcrumb = document.createElement('nav');
  breadcrumb.className = 'topbar-breadcrumb';
  breadcrumb.setAttribute('aria-label', 'breadcrumb');

  const updateBreadcrumb = () => {
    const pageName = i18n.t(`nav.${router.getRoute()}` as any) || router.getRoute();
    const appName = i18n.t('app.name' as any);
    breadcrumb.innerHTML = `
      <span style="color:var(--color-text-tertiary);">${appName}</span>
      <span style="color:var(--color-text-tertiary);margin:0 4px;">/</span>
      <span style="color:var(--color-text-secondary);">${pageName}</span>
    `;
  };
  updateBreadcrumb();

  left.appendChild(menuBtn);
  left.appendChild(title);
  left.appendChild(breadcrumb);

  // ── Global Search ─────────────────────────────────────────────────────────
  const searchWrapper = buildSearchBar();

  // ── Right ─────────────────────────────────────────────────────────────────
  const right = document.createElement('div');
  right.className = 'topbar-right';

  // Theme toggle
  const themeBtn = document.createElement('button');
  themeBtn.className = 'btn btn-ghost btn-icon';
  themeBtn.setAttribute('aria-label', i18n.t('topbar.toggleTheme' as any));
  themeBtn.setAttribute('data-tooltip', i18n.t('topbar.toggleTheme' as any));
  const updateThemeIcon = () => {
    themeBtn.innerHTML = themeService.getTheme() === 'dark' ? Icons.sun() : Icons.moon();
  };
  updateThemeIcon();
  themeBtn.addEventListener('click', () => { themeService.toggle(); updateThemeIcon(); });
  themeService.subscribe(updateThemeIcon);

  // Notifications bell
  const bellWrapper = buildBellButton();

  // User menu trigger
  const userTrigger = buildUserTrigger(currentUser);

  right.appendChild(themeBtn);
  right.appendChild(bellWrapper);
  right.appendChild(userTrigger);

  topbar.appendChild(left);
  topbar.appendChild(searchWrapper);
  topbar.appendChild(right);

  // In Modern layout, hide theme toggle (it's in the rail footer)
  const updateTopbarForLayout = (style: string) => {
    themeBtn.style.display = style === 'modern' ? 'none' : '';
    menuBtn.style.display = (style === 'modern' || style === 'floating') ? 'none' : '';
  };
  updateTopbarForLayout(layoutService.currentLayout);
  layoutService.onLayoutChange(updateTopbarForLayout);

  // Update title on route change
  const updateTitle = () => {
    title.textContent = i18n.t(`nav.${router.getRoute()}` as any);
    updateBreadcrumb();
  };
  router.subscribe(() => {
    updateTitle();
    // Refresh badge on every navigation (data may have changed)
    refreshBadge(bellWrapper);
  });
  i18n.onLanguageChange(updateTitle);

  // Refresh bell badge when notification history changes
  notifications.onHistoryChange(() => refreshBadge(bellWrapper));

  // ── Shared portal close state ─────────────────────────────────────────────
  let activePortal: HTMLElement | null = null;
  let activeTrigger: HTMLElement | null = null;

  const closePortal = () => {
    activePortal?.remove();
    activePortal = null;
    activeTrigger?.setAttribute('aria-expanded', 'false');
    activeTrigger = null;
  };
  document.addEventListener('click', closePortal);

  // ── Notifications portal ──────────────────────────────────────────────────
  const bellBtn = bellWrapper.querySelector<HTMLButtonElement>('#bell-btn')!;

  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeTrigger === bellBtn) { closePortal(); return; }
    closePortal();

    const alerts = alertService.getAlerts();
    const history = notifications.getHistory();
    const rect = bellBtn.getBoundingClientRect();
    const menuWidth = 360;
    const isRtl = document.documentElement.dir === 'rtl';
    const left = isRtl
      ? Math.max(8, rect.left)
      : Math.max(8, rect.right - menuWidth);
    const top = rect.bottom + 6;

    const portal = document.createElement('div');
    portal.setAttribute('role', 'menu');
    portal.setAttribute('aria-label', i18n.t('topbar.notifications' as any));
    portal.style.cssText = `
      position: fixed;
      top: ${top}px;
      left: ${left}px;
      width: ${menuWidth}px;
      max-height: 520px;
      overflow-y: auto;
      z-index: 9999;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      animation: slideUp 150ms ease;
    `;

    portal.innerHTML = buildNotificationsHTML(alerts, history);
    portal.addEventListener('click', (e) => e.stopPropagation());

    // Wire up "Go to" navigation links
    portal.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach((link) => {
      link.addEventListener('click', () => {
        closePortal();
        window.location.hash = link.getAttribute('data-nav')!;
      });
    });

    // Mark all read button
    portal.querySelector('#notif-mark-all-read')?.addEventListener('click', () => {
      notifications.markAllRead();
      refreshBadge(bellWrapper);
      closePortal();
    });

    document.body.appendChild(portal);
    activePortal = portal;
    activeTrigger = bellBtn;
    bellBtn.setAttribute('aria-expanded', 'true');
  });

  // ── User dropdown portal ──────────────────────────────────────────────────
  userTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeTrigger === userTrigger) { closePortal(); return; }
    closePortal();

    const rect = userTrigger.getBoundingClientRect();
    const menuWidth = 220;
    const left = Math.max(8, rect.right - menuWidth);
    const top = rect.bottom + 6;

    const portal = document.createElement('div');
    portal.setAttribute('role', 'menu');
    portal.setAttribute('aria-label', i18n.t('topbar.userMenu' as any));
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
          <span class="badge badge-primary" style="font-size: 10px;">${i18n.t(`users.roles.${currentUser.role}` as any)}</span>
        </div>
      </div>
      <button class="dropdown-item" id="portal-settings" role="menuitem">
        ${Icons.settings(16)} <span data-i18n="nav.settings">${i18n.t('nav.settings')}</span>
      </button>
      <div class="dropdown-divider"></div>
      <button class="dropdown-item danger" id="portal-logout" role="menuitem">
        ${Icons.logOut(16)} <span data-i18n="topbar.signOut">${i18n.t('topbar.signOut')}</span>
      </button>
    `;

    portal.addEventListener('click', (e) => e.stopPropagation());
    portal.querySelector('#portal-settings')?.addEventListener('click', () => { closePortal(); router.navigate('settings'); });
    portal.querySelector('#portal-logout')?.addEventListener('click', () => { closePortal(); showSignOutConfirmation(onLogout); });

    document.body.appendChild(portal);
    activePortal = portal;
    activeTrigger = userTrigger;
    userTrigger.setAttribute('aria-expanded', 'true');
  });

  return topbar;
}

// ── Bell button builder ───────────────────────────────────────────────────────

function buildBellButton(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;display:inline-flex;';

  const alertCount = alertService.getCount();
  const unreadCount = notifications.getUnreadCount();
  const totalCount = alertCount + unreadCount;

  wrapper.innerHTML = `
    <button
      id="bell-btn"
      class="btn btn-ghost btn-icon"
      aria-label="${i18n.t('topbar.notifications')}${totalCount > 0 ? ` (${totalCount})` : ''}"
      aria-haspopup="true"
      aria-expanded="false"
      data-tooltip="${i18n.t('topbar.notifications')}"
      style="position:relative;"
    >
      ${Icons.bell()}
      ${totalCount > 0 ? `
        <span id="bell-badge" style="
          position: absolute;
          top: 2px; right: 2px;
          min-width: 16px; height: 16px;
          padding: 0 4px;
          background: var(--color-error);
          color: white;
          font-size: 10px;
          font-weight: 700;
          border-radius: var(--radius-full);
          display: flex; align-items: center; justify-content: center;
          line-height: 1;
          pointer-events: none;
        ">${totalCount > 99 ? '99+' : totalCount}</span>
      ` : ''}
    </button>
  `;

  return wrapper;
}

function refreshBadge(wrapper: HTMLElement): void {
  const alertCount = alertService.getCount();
  const unreadCount = notifications.getUnreadCount();
  const totalCount = alertCount + unreadCount;
  const btn = wrapper.querySelector<HTMLButtonElement>('#bell-btn');
  if (!btn) return;

  btn.setAttribute('aria-label', `${i18n.t('topbar.notifications')}${totalCount > 0 ? ` (${totalCount})` : ''}`);

  let badge = wrapper.querySelector<HTMLElement>('#bell-badge');
  if (totalCount > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'bell-badge';
      badge.style.cssText = `
        position: absolute;
        top: 2px; right: 2px;
        min-width: 16px; height: 16px;
        padding: 0 4px;
        background: var(--color-error);
        color: white;
        font-size: 10px;
        font-weight: 700;
        border-radius: var(--radius-full);
        display: flex; align-items: center; justify-content: center;
        line-height: 1;
        pointer-events: none;
      `;
      btn.appendChild(badge);
    }
    badge.textContent = totalCount > 99 ? '99+' : String(totalCount);
  } else {
    badge?.remove();
  }
}

// ── Notifications dropdown HTML ───────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return i18n.t('topbar.justNow' as any) || 'Just now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

const HISTORY_TYPE_COLORS: Record<string, string> = {
  success: 'var(--color-success)',
  error:   'var(--color-error)',
  warning: 'var(--color-warning)',
  info:    'var(--color-info)',
};

function buildNotificationsHTML(alerts: SystemAlert[], history: NotificationHistoryEntry[]): string {
  const totalCount = alerts.length + history.filter((h) => !h.read).length;
  const header = `
    <div style="
      display:flex;align-items:center;justify-content:space-between;
      padding:var(--space-3) var(--space-4);
      border-bottom:1px solid var(--color-border);
      position:sticky;top:0;
      background:var(--color-surface);
      z-index:1;
    ">
      <div style="display:flex;align-items:center;gap:var(--space-2);">
        <span style="font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-primary);">${i18n.t('topbar.notifications')}</span>
        ${totalCount > 0 ? `<span class="badge badge-error" style="font-size:10px;">${totalCount}</span>` : ''}
      </div>
      ${history.some((h) => !h.read) ? `<button id="notif-mark-all-read" style="font-size:var(--font-size-xs);color:var(--color-primary);background:none;border:none;cursor:pointer;padding:0;">${i18n.t('topbar.markAllRead' as any) || 'Mark all read'}</button>` : ''}
    </div>
  `;

  if (alerts.length === 0 && history.length === 0) {
    return header + `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:var(--space-10) var(--space-6);gap:var(--space-3);text-align:center;">
        <div style="width:48px;height:48px;border-radius:var(--radius-full);background:var(--color-success-subtle);color:var(--color-success);display:flex;align-items:center;justify-content:center;">${Icons.check(24)}</div>
        <div style="font-size:var(--font-size-sm);font-weight:500;color:var(--color-text-primary);">${i18n.t('topbar.allClear')}</div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">${i18n.t('topbar.noAlerts')}</div>
      </div>
    `;
  }

  // System alerts section
  const alertItems = alerts.map((alert) => {
    const s = SEVERITY_COLORS[alert.severity];
    const catIcon = CATEGORY_ICONS[alert.category];
    return `
      <a data-nav="${alert.route}" style="display:flex;align-items:flex-start;gap:var(--space-3);padding:var(--space-3) var(--space-4);border-bottom:1px solid var(--color-border-subtle);cursor:pointer;text-decoration:none;transition:background var(--transition-fast);"
        onmouseenter="this.style.background='var(--color-primary-subtle)'"
        onmouseleave="this.style.background='transparent'"
        role="menuitem">
        <div style="width:36px;height:36px;border-radius:var(--radius-sm);background:${s.bg};color:${s.color};border:1px solid ${s.border};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${catIcon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--font-size-sm);font-weight:600;color:${s.color};margin-bottom:2px;">${alert.title}</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${alert.message}</div>
        </div>
        <div style="color:var(--color-text-tertiary);flex-shrink:0;margin-top:2px;">${Icons.arrowRight(14)}</div>
      </a>`;
  }).join('');

  // History section
  const historyItems = history.slice(0, 20).map((entry) => {
    const color = HISTORY_TYPE_COLORS[entry.type] || 'var(--color-info)';
    return `
      <div style="display:flex;align-items:flex-start;gap:var(--space-3);padding:var(--space-3) var(--space-4);border-bottom:1px solid var(--color-border-subtle);${!entry.read ? 'background:var(--color-primary-subtle);' : ''}">
        <div style="width:8px;height:8px;border-radius:var(--radius-full);background:${color};flex-shrink:0;margin-top:5px;${entry.read ? 'opacity:0.3;' : ''}"></div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--font-size-xs);color:var(--color-text-primary);line-height:1.4;">${entry.message}</div>
        </div>
        <div style="font-size:10px;color:var(--color-text-tertiary);flex-shrink:0;white-space:nowrap;">${formatRelativeTime(entry.timestamp)}</div>
      </div>`;
  }).join('');

  const alertSection = alerts.length > 0 ? `
    <div style="padding:var(--space-2) var(--space-4) var(--space-1);font-size:10px;font-weight:600;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.06em;">${i18n.t('topbar.systemAlerts' as any) || 'System Alerts'}</div>
    ${alertItems}
  ` : '';

  const historySection = history.length > 0 ? `
    <div style="padding:var(--space-2) var(--space-4) var(--space-1);font-size:10px;font-weight:600;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.06em;">${i18n.t('topbar.recentActivity' as any) || 'Recent Activity'}</div>
    ${historyItems}
  ` : '';

  return header + `<div>${alertSection}${historySection}</div>`;
}

// ── Global Search ─────────────────────────────────────────────────────────────

function buildSearchBar(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'topbar-search';

  const searchBar = document.createElement('div');
  searchBar.className = 'search-bar';
  searchBar.style.width = '100%';

  const searchIcon = document.createElement('span');
  searchIcon.className = 'search-icon';
  searchIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

  const input = document.createElement('input');
  input.id = 'global-search-input';
  input.type = 'search';
  input.className = 'form-control';
  input.autocomplete = 'off';
  input.style.cssText = 'height:34px;font-size:var(--font-size-sm);';

  const kbd = document.createElement('kbd');
  kbd.className = 'search-ctrlk-hint';
  kbd.textContent = 'Ctrl K';

  // Update placeholder on language change
  const updatePlaceholder = () => {
    input.placeholder = i18n.t('topbar.search' as any) || i18n.t('common.search' as any) || 'Search...';
  };
  updatePlaceholder();
  i18n.onLanguageChange(updatePlaceholder);

  searchBar.appendChild(searchIcon);
  searchBar.appendChild(input);
  searchBar.appendChild(kbd);
  wrapper.appendChild(searchBar);

  let resultsPortal: HTMLElement | null = null;
  let selectedIdx = 0;
  // Track whether a result click is in progress to prevent premature close
  let isClickingResult = false;

  const closeResults = () => {
    resultsPortal?.remove();
    resultsPortal = null;
  };

  const navigateToResult = (route: string, itemId: string) => {
    const routeKey = route as Parameters<typeof router.navigate>[0];
    input.value = '';
    closeResults();
    // Set pending action so the page opens the item detail after mounting
    import('@core/pendingNavAction').then(({ setPendingNavAction }) => {
      setPendingNavAction({ route: routeKey as any, itemId, itemType: 'view' });
      router.navigate(routeKey as any);
    });
  };

  const showResults = async (query: string) => {
    closeResults();
    if (!query.trim()) return;

    const q = query.toLowerCase();

    const [
      { customerService },
      { productService },
      { supplierService },
      { invoiceService },
    ] = await Promise.all([
      import('@services/customerService'),
      import('@services/productService'),
      import('@services/supplierService'),
      import('@services/invoiceService'),
    ]);

    type SearchResult = { type: string; label: string; sub: string; route: string; id: string };
    const results: SearchResult[] = [];

    customerService.getAll()
      .filter((c) => c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((c) => results.push({ type: i18n.t('nav.customers'), label: c.name, sub: c.email || '', route: 'customers', id: c.id }));

    productService.getAll()
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((p) => results.push({ type: i18n.t('nav.products'), label: p.name, sub: p.sku || '', route: 'products', id: p.id }));

    supplierService.getAll()
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 2)
      .forEach((s) => results.push({ type: i18n.t('nav.suppliers'), label: s.name, sub: s.email || '', route: 'suppliers', id: s.id }));

    invoiceService.getAll()
      .filter((inv) => inv.invoiceNumber.toLowerCase().includes(q) || inv.customerName.toLowerCase().includes(q))
      .slice(0, 2)
      .forEach((inv) => results.push({ type: i18n.t('nav.invoices'), label: inv.invoiceNumber, sub: inv.customerName, route: 'invoices', id: inv.id }));

    if (results.length === 0) return;

    selectedIdx = 0;
    const rect = wrapper.getBoundingClientRect();
    const isRtl = document.documentElement.dir === 'rtl';

    resultsPortal = document.createElement('div');
    resultsPortal.setAttribute('role', 'listbox');
    resultsPortal.setAttribute('aria-label', i18n.t('topbar.search' as any));
    resultsPortal.style.cssText = `
      position:fixed;
      top:${rect.bottom + 4}px;
      ${isRtl ? `right:${window.innerWidth - rect.right}px` : `left:${rect.left}px`};
      width:${rect.width}px;
      min-width:280px;
      background:var(--color-surface);
      border:1px solid var(--color-border);
      border-radius:var(--radius-md);
      box-shadow:var(--shadow-lg);
      z-index:9999;
      overflow:hidden;
      animation:slideUp 120ms ease-out both;
    `;

    const renderItems = () => {
      if (!resultsPortal) return;
      resultsPortal.innerHTML = results.map((r, i) => `
        <button
          role="option"
          data-idx="${i}"
          data-route="${r.route}"
          data-id="${r.id}"
          aria-selected="${i === selectedIdx}"
          style="
            display:flex;align-items:center;gap:var(--space-3);
            width:100%;padding:var(--space-2) var(--space-3);
            border:none;border-bottom:1px solid var(--color-border-subtle);
            background:${i === selectedIdx ? 'var(--color-primary-subtle)' : 'var(--color-surface)'};
            color:var(--color-text-primary);cursor:pointer;text-align:start;
            font-family:var(--font-family);
            transition:background 80ms ease;
          "
        >
          <span style="font-size:9px;padding:2px 6px;background:var(--color-bg-secondary);border-radius:var(--radius-xs);color:var(--color-text-tertiary);white-space:nowrap;flex-shrink:0;">${escapeHtml(r.type)}</span>
          <span style="flex:1;font-size:var(--font-size-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(r.label)}</span>
          ${r.sub ? `<span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;">${escapeHtml(r.sub)}</span>` : ''}
        </button>
      `).join('');

      resultsPortal.querySelectorAll<HTMLButtonElement>('[data-idx]').forEach((btn) => {
        btn.addEventListener('mouseenter', () => {
          selectedIdx = parseInt(btn.getAttribute('data-idx')!);
          renderItems();
        });

        // Use mousedown instead of click so it fires before the document blur/click
        // that would otherwise remove the portal first
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault(); // prevent input blur
          isClickingResult = true;
          const route = btn.getAttribute('data-route')!;
          const id = btn.getAttribute('data-id')!;
          navigateToResult(route, id);
          isClickingResult = false;
        });
      });
    };

    renderItems();
    document.body.appendChild(resultsPortal);
  };

  let searchTimer: ReturnType<typeof setTimeout>;
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => showResults(input.value), 250);
  });

  input.addEventListener('keydown', (e) => {
    if (!resultsPortal) return;
    const items = resultsPortal.querySelectorAll<HTMLButtonElement>('[data-idx]');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
      renderActiveItem(resultsPortal, selectedIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = Math.max(selectedIdx - 1, 0);
      renderActiveItem(resultsPortal, selectedIdx);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = resultsPortal.querySelector<HTMLButtonElement>(`[data-idx="${selectedIdx}"]`);
      if (active) {
        const route = active.getAttribute('data-route')!;
        const id = active.getAttribute('data-id')!;
        navigateToResult(route, id);
      }
    } else if (e.key === 'Escape') {
      closeResults();
      input.blur();
    }
  });

  input.addEventListener('focus', () => { if (input.value) showResults(input.value); });

  input.addEventListener('blur', () => {
    // Delay close so mousedown on a result fires first
    if (!isClickingResult) {
      setTimeout(() => { if (!isClickingResult) closeResults(); }, 150);
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target as Node) && !resultsPortal?.contains(e.target as Node)) {
      closeResults();
    }
  });

  // Ctrl+K / Cmd+K focuses the search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      if (!document.getElementById('cmd-palette-backdrop')) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    }
  });

  return wrapper;
}

/** Update highlight without full re-render for keyboard nav */
function renderActiveItem(portal: HTMLElement, activeIdx: number): void {
  portal.querySelectorAll<HTMLButtonElement>('[data-idx]').forEach((btn) => {
    const idx = parseInt(btn.getAttribute('data-idx')!);
    btn.style.background = idx === activeIdx ? 'var(--color-primary-subtle)' : 'var(--color-surface)';
    btn.setAttribute('aria-selected', String(idx === activeIdx));
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUserTrigger(user: User): HTMLButtonElement {
  const trigger = document.createElement('button');
  trigger.className = 'user-menu-trigger';
  trigger.setAttribute('aria-label', i18n.t('topbar.userMenu' as any));
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `
    <div class="avatar avatar-sm">${getInitials(user.name)}</div>
    <div class="user-menu-info">
      <span class="user-menu-name">${user.name}</span>
      <span class="user-menu-role">${i18n.t(`users.roles.${user.role}` as any)}</span>
    </div>
    ${Icons.chevronDown(14)}
  `;
  return trigger;
}

function showSignOutConfirmation(onConfirm: () => void): void {
  import('./modal').then(({ openModal }) => {
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-4);text-align:center;padding:var(--space-2) 0;">
        <div style="
          width:56px;height:56px;border-radius:var(--radius-full);
          background:var(--color-error-subtle);color:var(--color-error);
          display:flex;align-items:center;justify-content:center;
        ">${Icons.logOut(24)}</div>
        <div>
          <p style="font-size:var(--font-size-base);color:var(--color-text-primary);font-weight:500;margin-bottom:var(--space-2);">${i18n.t('topbar.signOutConfirm')}</p>
          <p style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">${i18n.t('topbar.signOutHint')}</p>
        </div>
      </div>
    `;
    openModal({ title: i18n.t('topbar.signOut'), content, confirmText: i18n.t('topbar.signOut'), cancelText: i18n.t('topbar.stay'), confirmClass: 'btn-danger', size: 'sm', onConfirm });
  });
}
