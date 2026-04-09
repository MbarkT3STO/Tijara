/**
 * Top navigation bar component.
 * Shows page title, theme toggle, notifications bell, and user menu.
 * Both dropdowns use body portals to avoid overflow clipping.
 */

import { themeManager } from '@core/theme';
import { router } from '@core/router';
import { Icons } from './icons';
import { getInitials } from '@shared/utils/helpers';
import { alertService } from '@services/alertService';
import { createLanguageSwitcher } from './languageSwitcher';
import { i18n } from '@core/i18n';
import type { User } from '@core/types';
import type { SystemAlert } from '@services/alertService';



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

  left.appendChild(menuBtn);
  left.appendChild(title);

  // ── Right ─────────────────────────────────────────────────────────────────
  const right = document.createElement('div');
  right.className = 'topbar-right';

  // Theme toggle
  const themeBtn = document.createElement('button');
  themeBtn.className = 'btn btn-ghost btn-icon';
  themeBtn.setAttribute('aria-label', i18n.t('topbar.toggleTheme' as any));
  themeBtn.setAttribute('data-tooltip', i18n.t('topbar.toggleTheme' as any));
  const updateThemeIcon = () => {
    themeBtn.innerHTML = themeManager.getTheme() === 'dark' ? Icons.sun() : Icons.moon();
  };
  updateThemeIcon();
  themeBtn.addEventListener('click', () => { themeManager.toggle(); updateThemeIcon(); });
  themeManager.subscribe(updateThemeIcon);

  // Language switcher
  const langSwitcher = createLanguageSwitcher();

  // Notifications bell
  const bellWrapper = buildBellButton();

  // User menu trigger
  const userTrigger = buildUserTrigger(currentUser);

  right.appendChild(langSwitcher);
  right.appendChild(themeBtn);
  right.appendChild(bellWrapper);
  right.appendChild(userTrigger);

  topbar.appendChild(left);
  topbar.appendChild(right);

  // Update title on route change
  const updateTitle = () => {
    title.textContent = i18n.t(`nav.${router.getRoute()}` as any);
  };
  router.subscribe(() => {
    updateTitle();
    // Refresh badge on every navigation (data may have changed)
    refreshBadge(bellWrapper);
  });
  i18n.onLanguageChange(updateTitle);

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
    const rect = bellBtn.getBoundingClientRect();
    const menuWidth = 340;
    const left = Math.max(8, rect.right - menuWidth);
    const top = rect.bottom + 6;

    const portal = document.createElement('div');
    portal.setAttribute('role', 'menu');
    portal.setAttribute('aria-label', i18n.t('topbar.notifications' as any));
    portal.style.cssText = `
      position: fixed;
      top: ${top}px;
      left: ${left}px;
      width: ${menuWidth}px;
      max-height: 480px;
      overflow-y: auto;
      z-index: 9999;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      animation: slideUp 150ms ease;
    `;

    portal.innerHTML = buildNotificationsHTML(alerts);
    portal.addEventListener('click', (e) => e.stopPropagation());

    // Wire up "Go to" navigation links
    portal.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach((link) => {
      link.addEventListener('click', () => {
        closePortal();
        window.location.hash = link.getAttribute('data-nav')!;
      });
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

  const count = alertService.getCount();

  wrapper.innerHTML = `
    <button
      id="bell-btn"
      class="btn btn-ghost btn-icon"
      aria-label="${i18n.t('topbar.notifications')}${count > 0 ? ` (${count})` : ''}"
      aria-haspopup="true"
      aria-expanded="false"
      data-tooltip="${i18n.t('topbar.notifications')}"
      style="position:relative;"
    >
      ${Icons.bell()}
      ${count > 0 ? `
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
        ">${count > 99 ? '99+' : count}</span>
      ` : ''}
    </button>
  `;

  return wrapper;
}

function refreshBadge(wrapper: HTMLElement): void {
  const count = alertService.getCount();
  const btn = wrapper.querySelector<HTMLButtonElement>('#bell-btn');
  if (!btn) return;

  btn.setAttribute('aria-label', `${i18n.t('topbar.notifications')}${count > 0 ? ` (${count})` : ''}`);

  let badge = wrapper.querySelector<HTMLElement>('#bell-badge');
  if (count > 0) {
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
    badge.textContent = count > 99 ? '99+' : String(count);
  } else {
    badge?.remove();
  }
}

// ── Notifications dropdown HTML ───────────────────────────────────────────────

function buildNotificationsHTML(alerts: SystemAlert[]): string {
  const header = `
    <div style="
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-border);
      position: sticky; top: 0;
      background: var(--color-surface);
      z-index: 1;
    ">
      <div style="display:flex;align-items:center;gap:var(--space-2);">
        <span style="font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-primary);">${i18n.t('topbar.notifications')}</span>
        ${alerts.length > 0 ? `<span class="badge badge-error" style="font-size:10px;">${alerts.length}</span>` : ''}
      </div>
      ${alerts.length > 0 ? `<span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">${alerts.filter(a => a.severity === 'error').length} ${i18n.t('topbar.critical')}</span>` : ''}
    </div>
  `;

  if (alerts.length === 0) {
    return header + `
      <div style="
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: var(--space-10) var(--space-6);
        gap: var(--space-3);
        text-align: center;
      ">
        <div style="
          width: 48px; height: 48px; border-radius: var(--radius-full);
          background: var(--color-success-subtle); color: var(--color-success);
          display: flex; align-items: center; justify-content: center;
        ">${Icons.check(24)}</div>
        <div style="font-size:var(--font-size-sm);font-weight:500;color:var(--color-text-primary);">${i18n.t('topbar.allClear')}</div>
        <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">${i18n.t('topbar.noAlerts')}</div>
      </div>
    `;
  }

  const items = alerts.map((alert) => {
    const s = SEVERITY_COLORS[alert.severity];
    const catIcon = CATEGORY_ICONS[alert.category];
    return `
      <a data-nav="${alert.route}" style="
        display: flex; align-items: flex-start; gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--color-border-subtle);
        cursor: pointer;
        text-decoration: none;
        transition: background var(--transition-fast);
      "
      onmouseenter="this.style.background='var(--color-primary-subtle)'"
      onmouseleave="this.style.background='transparent'"
      role="menuitem"
      >
        <!-- Severity dot + category icon -->
        <div style="
          width: 36px; height: 36px; border-radius: var(--radius-sm);
          background: ${s.bg}; color: ${s.color};
          border: 1px solid ${s.border};
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        ">${catIcon}</div>

        <!-- Text -->
        <div style="flex:1;min-width:0;">
          <div style="
            font-size: var(--font-size-sm); font-weight: 600;
            color: ${s.color};
            margin-bottom: 2px;
          ">${alert.title}</div>
          <div style="
            font-size: var(--font-size-xs);
            color: var(--color-text-secondary);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          ">${alert.message}</div>
        </div>

        <!-- Arrow -->
        <div style="color:var(--color-text-tertiary);flex-shrink:0;margin-top:2px;">
          ${Icons.arrowRight(14)}
        </div>
      </a>
    `;
  }).join('');

  return header + `<div>${items}</div>`;
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
