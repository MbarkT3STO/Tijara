/**
 * Rail tooltip manager.
 * Shows floating label tooltips for nav items when the sidebar is in a
 * collapsed/icon-only state — Modern layout always, Classic/Floating when collapsed.
 * Appended to document.body to avoid overflow clipping.
 * Fully RTL-aware and viewport-clamped.
 */

import { layoutService } from '@core/layout';

const TOOLTIP_OFFSET = 8; // px gap between sidebar edge and tooltip

let activeTooltip: HTMLElement | null = null;
let initialized = false;
let sidebarRef: HTMLElement | null = null;

/** Returns true when the sidebar is currently in icon-only (collapsed) mode */
function isSidebarCollapsed(): boolean {
  const layout = layoutService.currentLayout;

  if (layout === 'modern') return true;

  if (layout === 'classic') {
    return sidebarRef?.classList.contains('collapsed') ?? false;
  }

  if (layout === 'floating') {
    if (!sidebarRef) return false;
    // Explicitly collapsed by user
    if (sidebarRef.classList.contains('float-collapsed')) return true;
    // Auto-collapsed by CSS media query (≤1100px, no override)
    if (!sidebarRef.classList.contains('float-expanded-override')) {
      return window.innerWidth <= 1100;
    }
    return false;
  }

  return false;
}

function createTooltipEl(label: string, targetRect: DOMRect): HTMLElement {
  const isRtl = document.documentElement.dir === 'rtl';

  const tip = document.createElement('div');
  tip.className = 'rail-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.textContent = label;

  tip.style.cssText = `
    position: fixed;
    background: #1e1f2e;
    color: #e0e0e0;
    font-size: 12px;
    font-weight: 500;
    padding: 5px 10px;
    border-radius: 6px;
    border: 0.5px solid var(--color-border-tertiary);
    white-space: nowrap;
    pointer-events: none;
    z-index: 9999;
    opacity: 0;
    transition: opacity 120ms ease-out, transform 120ms ease-out;
    font-family: var(--font-family);
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  `;

  document.body.appendChild(tip);

  // Measure after appending so we know its size
  const tipRect = tip.getBoundingClientRect();
  const tipH = tipRect.height;
  const tipW = tipRect.width;

  // Vertical: center on the target, clamped to viewport
  const targetCenterY = targetRect.top + targetRect.height / 2;
  let top = targetCenterY - tipH / 2;
  const margin = 6;
  top = Math.max(margin, Math.min(top, window.innerHeight - tipH - margin));

  // Get the actual sidebar width from the DOM for accurate positioning
  const sidebarWidth = sidebarRef
    ? sidebarRef.getBoundingClientRect().width
    : 52;

  let left: number;
  if (isRtl) {
    // Sidebar is on the right; tooltip appears to the left of it
    const sidebarLeft = sidebarRef?.getBoundingClientRect().left ?? (window.innerWidth - sidebarWidth);
    left = sidebarLeft - TOOLTIP_OFFSET - tipW;
    left = Math.max(margin, left);
    tip.style.transform = 'translateX(-4px)';
  } else {
    // Sidebar is on the left; tooltip appears to the right of it
    const sidebarRight = sidebarRef?.getBoundingClientRect().right ?? sidebarWidth;
    left = sidebarRight + TOOLTIP_OFFSET;
    left = Math.min(left, window.innerWidth - tipW - margin);
    tip.style.transform = 'translateX(4px)';
  }

  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;

  // Trigger fade-in on next frame
  requestAnimationFrame(() => {
    tip.style.opacity = '1';
    tip.style.transform = 'translateX(0)';
  });

  return tip;
}

function removeTooltip(): void {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
}

function onNavItemEnter(e: MouseEvent): void {
  if (!isSidebarCollapsed()) return;
  removeTooltip();

  const btn = e.currentTarget as HTMLElement;
  const label = btn.getAttribute('data-nav-label');
  if (!label) return;

  const rect = btn.getBoundingClientRect();
  activeTooltip = createTooltipEl(label, rect);
}

function onNavItemLeave(): void {
  removeTooltip();
}

/** Attach tooltip listeners to all current .nav-item elements in the sidebar */
function attachListeners(sidebar: HTMLElement): void {
  sidebar.querySelectorAll<HTMLElement>('.nav-item').forEach((btn) => {
    if (btn.dataset.tooltipBound) return;
    btn.dataset.tooltipBound = '1';
    btn.addEventListener('mouseenter', onNavItemEnter);
    btn.addEventListener('mouseleave', onNavItemLeave);
  });
}

/** Initialise the tooltip manager for a given sidebar element */
export function initRailTooltips(sidebar: HTMLElement): void {
  if (initialized) return;
  initialized = true;
  sidebarRef = sidebar;

  attachListeners(sidebar);

  // Remove tooltip when switching to an expanded layout
  layoutService.onLayoutChange(() => {
    removeTooltip();
    requestAnimationFrame(() => attachListeners(sidebar));
  });

  // Re-attach after language changes re-render nav items
  const nav = sidebar.querySelector('.sidebar-nav');
  if (nav) {
    new MutationObserver(() => attachListeners(sidebar))
      .observe(nav, { childList: true, subtree: false });
  }

  // Remove tooltip on scroll (content area may scroll while sidebar is open)
  document.querySelector('.content-area')?.addEventListener('scroll', removeTooltip, { passive: true });
}
