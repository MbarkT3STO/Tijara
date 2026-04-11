/**
 * Sidebar navigation component.
 * Supports Classic (full sidebar), Modern (icon rail), and Floating layouts.
 * Floating sidebar is collapsible with persisted state.
 *
 * Settings is intentionally excluded from the nav — it lives in the user menu.
 * Modern rail footer shows only the theme toggle (no avatar/settings).
 */

import { router } from '@core/router';
import { Icons } from './icons';
import { i18n } from '@core/i18n';
import { layoutService } from '@core/layout';
import { themeService } from '@core/theme';
import { hasPermission } from '@shared/utils/helpers';
import type { Route } from '@core/types';
import type { User } from '@core/types';

// Settings is intentionally absent — it's accessible via the user dropdown in the topbar.
const NAV_ITEMS: { route: Route; icon: (s?: number) => string; section?: string }[] = [
  // ── Main ──────────────────────────────────────────────────────────────────
  { route: 'dashboard',  icon: (s) => Icons.dashboard(s as any),   section: 'main' },

  // ── Operations (daily workflow: sell → bill → return → restock) ───────────
  { route: 'sales',      icon: (s) => Icons.sales(s as any),       section: 'operations' },
  { route: 'invoices',   icon: (s) => Icons.invoices(s as any) },
  { route: 'returns',    icon: (s) => Icons.refresh(s as any) },
  { route: 'purchases',  icon: (s) => Icons.shoppingCart(s as any) },

  // ── Catalog (what you sell and where it comes from) ───────────────────────
  { route: 'customers',  icon: (s) => Icons.customers(s as any),   section: 'catalog' },
  { route: 'products',   icon: (s) => Icons.products(s as any) },
  { route: 'inventory',  icon: (s) => Icons.package(s as any) },
  { route: 'suppliers',  icon: (s) => Icons.truck(s as any) },

  // ── Analytics ─────────────────────────────────────────────────────────────
  { route: 'reports',    icon: (s) => Icons.barChart(s as any),    section: 'analytics' },

  // ── Accounting ────────────────────────────────────────────────────────────
  { route: 'accounting',        icon: (s) => Icons.accounting(s as any),      section: 'accounting' },
  { route: 'chart-of-accounts', icon: (s) => Icons.chartOfAccounts(s as any) },
  { route: 'journal',           icon: (s) => Icons.journal(s as any) },
  { route: 'ledger',            icon: (s) => Icons.ledger(s as any) },
  { route: 'trial-balance',     icon: (s) => Icons.trialBalance(s as any) },
  { route: 'income-statement',  icon: (s) => Icons.incomeStatement(s as any) },
  { route: 'balance-sheet',     icon: (s) => Icons.balanceSheet(s as any) },
  { route: 'cash-flow',         icon: (s) => Icons.cashFlow(s as any) },
  { route: 'cost-centers',      icon: (s) => Icons.costCenter(s as any) },
  { route: 'fiscal-periods',    icon: (s) => Icons.calendar(s as any) },

  // ── Admin ─────────────────────────────────────────────────────────────────
  { route: 'users',      icon: (s) => Icons.users(s as any),       section: 'admin' },
];

const FLOAT_COLLAPSED_KEY = 'tijara_float_sidebar_collapsed';
const FLOAT_EXPANDED_KEY  = 'tijara_float_sidebar_expanded';
const CLASSIC_COLLAPSED_KEY = 'tijara_classic_sidebar_collapsed';

/** Build and return the sidebar element */
export function createSidebar(currentUser?: User): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.setAttribute('aria-label', 'Main navigation');
  sidebar.setAttribute('data-layout', layoutService.currentLayout);

  // ── Logo ──────────────────────────────────────────────────────────────────
  const logo = document.createElement('div');
  logo.className = 'sidebar-logo';
  logo.innerHTML = `
    <div class="sidebar-logo-icon" aria-hidden="true">
      <img src="./icons/icon-512.png" alt="Tijara" width="28" height="28" style="object-fit:contain; border-radius: 4px;" />
    </div>
    <span class="sidebar-logo-text">Ti<span>jara</span></span>
  `;

  // The SVG logo mark uses var(--color-primary) directly — no repaint hack needed.

  // ── Nav ───────────────────────────────────────────────────────────────────
  const nav = document.createElement('nav');
  nav.className = 'sidebar-nav';
  nav.setAttribute('role', 'navigation');

  const renderNav = () => {
    nav.innerHTML = '';
    let currentSection = '';

    // Permission check for nav items
    const RESTRICTED_ROUTES: Partial<Record<Route, string>> = {
      'users':              'page:users',
      'settings':           'page:settings',
      'reports':            'page:reports',
      'journal':            'page:journal',
      'chart-of-accounts':  'page:chart-of-accounts',
      'fiscal-periods':     'page:fiscal-periods',
      'cost-centers':       'page:cost-centers',
      'accounting':         'page:accounting',
      'trial-balance':      'page:trial-balance',
      'income-statement':   'page:income-statement',
      'balance-sheet':      'page:balance-sheet',
      'cash-flow':          'page:cash-flow',
      'tax-report':         'page:tax-report',
      'ledger':             'page:ledger',
    };

    const canSeeItem = (route: Route): boolean => {
      if (!currentUser) return true;
      const permission = RESTRICTED_ROUTES[route];
      if (!permission) return true;
      return hasPermission(currentUser.role, permission);
    };

    NAV_ITEMS.filter((item) => canSeeItem(item.route)).forEach((item) => {
      // Section label + gap divider
      if (item.section && item.section !== currentSection) {
        if (currentSection !== '') {
          const gap = document.createElement('div');
          gap.className = 'rail-section-gap';
          nav.appendChild(gap);
        }
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
      btn.setAttribute('data-nav-label', labelText);
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

  // ── Classic footer (collapse toggle) ─────────────────────────────────────
  const footer = document.createElement('div');
  footer.className = 'sidebar-footer';
  footer.innerHTML = `
    <button class="sidebar-toggle-btn" aria-label="Toggle sidebar" id="sidebar-toggle"
            style="transform: scaleX(var(--icon-flip));">
      ${Icons.chevronLeft()}
    </button>
  `;

  // ── Modern rail footer — theme toggle only ────────────────────────────────
  const railFooter = document.createElement('div');
  railFooter.className = 'rail-footer';

  const themeBtn = document.createElement('button');
  themeBtn.className = 'nav-item rail-theme-btn';
  themeBtn.setAttribute('aria-label', i18n.t('topbar.toggleTheme' as any));
  themeBtn.setAttribute('data-nav-label', i18n.t('topbar.toggleTheme' as any));

  const updateThemeIcon = () => {
    themeBtn.innerHTML = `<span class="nav-icon" aria-hidden="true">
      ${themeService.getTheme() === 'dark' ? Icons.sun(20) : Icons.moon(20)}
    </span>`;
  };
  updateThemeIcon();
  themeBtn.addEventListener('click', () => { themeService.toggle(); updateThemeIcon(); });
  themeService.subscribe(updateThemeIcon);
  railFooter.appendChild(themeBtn);

  // ── Floating footer (collapse toggle) ─────────────────────────────────────
  const floatFooter = document.createElement('div');
  floatFooter.className = 'sidebar-float-footer';
  floatFooter.innerHTML = `
    <button class="sidebar-toggle-btn float-collapse-btn" aria-label="Toggle sidebar"
            id="float-sidebar-toggle">
      ${Icons.chevronLeft()}
    </button>
  `;

  sidebar.appendChild(logo);
  sidebar.appendChild(nav);
  sidebar.appendChild(footer);
  sidebar.appendChild(railFooter);
  sidebar.appendChild(floatFooter);

  // ── Drag-to-scroll on sidebar nav ─────────────────────────────────────────
  applyDragScroll(nav);

  // ── Classic collapse toggle (persisted) ──────────────────────────────────
  let classicCollapsed = localStorage.getItem(CLASSIC_COLLAPSED_KEY) === 'true';
  const classicToggleBtn = footer.querySelector<HTMLButtonElement>('#sidebar-toggle')!;

  const applyClassicCollapsed = (collapsed: boolean, animate = false) => {
    if (!animate) sidebar.classList.add('no-transition');
    sidebar.classList.toggle('collapsed', collapsed);
    if (!animate) requestAnimationFrame(() => sidebar.classList.remove('no-transition'));
    classicToggleBtn.innerHTML = collapsed ? Icons.chevronRight() : Icons.chevronLeft();
    classicToggleBtn.style.transform = `scaleX(var(--icon-flip))`;
  };

  // Apply persisted state immediately (no animation on mount)
  if (layoutService.currentLayout === 'classic') {
    applyClassicCollapsed(classicCollapsed, false);
  }

  classicToggleBtn.addEventListener('click', () => {
    classicCollapsed = !classicCollapsed;
    localStorage.setItem(CLASSIC_COLLAPSED_KEY, String(classicCollapsed));
    applyClassicCollapsed(classicCollapsed, true);
  });

  // ── Floating collapse toggle (persisted) ──────────────────────────────────
  let floatCollapsed = localStorage.getItem(FLOAT_COLLAPSED_KEY) === 'true';
  const floatExpandedOverride = localStorage.getItem(FLOAT_EXPANDED_KEY) === 'true';

  /** Return the correct chevron icon for the button given the collapsed state and text direction.
   *  LTR: expanded → chevron-left (points left = "collapse"), collapsed → chevron-right (points right = "expand")
   *  RTL: mirrored — expanded → chevron-right, collapsed → chevron-left
   */
  const floatBtnIcon = (collapsed: boolean): string => {
    const isRtl = document.documentElement.getAttribute('dir') === 'rtl';
    if (isRtl) {
      return collapsed ? Icons.chevronLeft() : Icons.chevronRight();
    }
    return collapsed ? Icons.chevronRight() : Icons.chevronLeft();
  };

  const applyFloatCollapsed = (collapsed: boolean, animate = false) => {
    if (!animate) sidebar.classList.add('no-transition');
    sidebar.classList.toggle('float-collapsed', collapsed);
    if (!collapsed) {
      sidebar.classList.add('float-expanded-override');
      localStorage.setItem(FLOAT_EXPANDED_KEY, 'true');
    } else {
      sidebar.classList.remove('float-expanded-override');
      localStorage.removeItem(FLOAT_EXPANDED_KEY);
    }
    if (!animate) requestAnimationFrame(() => sidebar.classList.remove('no-transition'));
    const btn = floatFooter.querySelector<HTMLButtonElement>('#float-sidebar-toggle')!;
    btn.innerHTML = floatBtnIcon(collapsed);
  };

  if (layoutService.currentLayout === 'floating') {
    applyFloatCollapsed(floatCollapsed, false);
    if (floatExpandedOverride && !floatCollapsed) {
      sidebar.classList.add('float-expanded-override');
    }
  }

  floatFooter.querySelector<HTMLButtonElement>('#float-sidebar-toggle')!.addEventListener('click', () => {
    floatCollapsed = !floatCollapsed;
    localStorage.setItem(FLOAT_COLLAPSED_KEY, String(floatCollapsed));
    applyFloatCollapsed(floatCollapsed, true);
  });

  // ── Active route highlight ────────────────────────────────────────────────
  function updateActive(route: Route): void {
    nav.querySelectorAll<HTMLButtonElement>('.nav-item').forEach((btn) => {
      const isActive = btn.getAttribute('data-route') === route;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  router.subscribe(updateActive);

  // ── Respond to layout changes ─────────────────────────────────────────────
  layoutService.onLayoutChange((style) => {
    sidebar.setAttribute('data-layout', style);
    if (style === 'floating') {
      applyFloatCollapsed(floatCollapsed, false);
      if (!floatCollapsed && localStorage.getItem(FLOAT_EXPANDED_KEY) === 'true') {
        sidebar.classList.add('float-expanded-override');
      }
    } else if (style === 'classic') {
      sidebar.classList.remove('float-collapsed', 'float-expanded-override');
      applyClassicCollapsed(classicCollapsed, false);
    } else {
      sidebar.classList.remove('collapsed', 'float-collapsed', 'float-expanded-override');
    }
  });

  return sidebar;
}

// ── Drag-to-scroll helper ─────────────────────────────────────────────────────

/**
 * Enables click-and-drag scrolling on any scrollable element.
 * Distinguishes a drag from a regular click by movement threshold —
 * so nav item clicks still fire normally when the mouse barely moves.
 */
function applyDragScroll(el: HTMLElement): void {
  let isDragging = false;
  let startY = 0;
  let startScrollTop = 0;
  let moved = false;
  const THRESHOLD = 4; // px before we commit to a drag

  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;

    isDragging = true;
    moved = false;
    startY = e.clientY;
    startScrollTop = el.scrollTop;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const delta = e.clientY - startY;

    if (!moved && Math.abs(delta) < THRESHOLD) return;

    // Commit to drag mode
    moved = true;
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
    el.scrollTop = startScrollTop - delta;
    e.preventDefault();
  });

  // If the mouse is released without meaningful movement, treat as a normal click
  // by letting the event bubble. If it was a drag, suppress the click.
  el.addEventListener('click', (e) => {
    if (moved) e.stopPropagation();
  }, true);

  const stopDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    el.style.cursor = '';
    el.style.userSelect = '';
  };

  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('mouseleave', stopDrag);
}
