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
import { themeManager } from '@core/theme';
import type { Route } from '@core/types';
import type { User } from '@core/types';

// Settings is intentionally absent — it's accessible via the user dropdown in the topbar.
const NAV_ITEMS: { route: Route; icon: (s?: number) => string; section?: string }[] = [
  { route: 'dashboard', icon: (s) => Icons.dashboard(s),    section: 'main' },
  { route: 'customers', icon: (s) => Icons.customers(s),    section: 'management' },
  { route: 'products',  icon: (s) => Icons.products(s) },
  { route: 'inventory', icon: (s) => Icons.package(s) },
  { route: 'suppliers', icon: (s) => Icons.truck(s) },
  { route: 'purchases', icon: (s) => Icons.shoppingCart(s) },
  { route: 'returns',   icon: (s) => Icons.refresh(s) },
  { route: 'sales',     icon: (s) => Icons.sales(s) },
  { route: 'invoices',  icon: (s) => Icons.invoices(s) },
  { route: 'reports',   icon: (s) => Icons.barChart(s),     section: 'analytics' },
  { route: 'users',     icon: (s) => Icons.users(s),        section: 'admin' },
];

const FLOAT_COLLAPSED_KEY = 'tijara_float_sidebar_collapsed';
const FLOAT_EXPANDED_KEY  = 'tijara_float_sidebar_expanded';
const CLASSIC_COLLAPSED_KEY = 'tijara_classic_sidebar_collapsed';

/** Build and return the sidebar element */
export function createSidebar(_currentUser?: User): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.setAttribute('aria-label', 'Main navigation');
  sidebar.setAttribute('data-layout', layoutService.currentLayout);

  // ── Logo ──────────────────────────────────────────────────────────────────
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

  // ── Nav ───────────────────────────────────────────────────────────────────
  const nav = document.createElement('nav');
  nav.className = 'sidebar-nav';
  nav.setAttribute('role', 'navigation');

  const renderNav = () => {
    nav.innerHTML = '';
    let currentSection = '';

    NAV_ITEMS.forEach((item) => {
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
      ${themeManager.getTheme() === 'dark' ? Icons.sun(20) : Icons.moon(20)}
    </span>`;
  };
  updateThemeIcon();
  themeBtn.addEventListener('click', () => { themeManager.toggle(); updateThemeIcon(); });
  themeManager.subscribe(updateThemeIcon);
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
