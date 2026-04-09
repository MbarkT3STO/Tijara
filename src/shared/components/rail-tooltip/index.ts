/**
 * Rail tooltip manager.
 * Shows floating label tooltips for nav items in Modern layout.
 * Appended to document.body to avoid overflow clipping.
 * Fully RTL-aware and viewport-clamped.
 */

import { layoutService } from '@core/layout';

const TOOLTIP_OFFSET = 8; // px gap between rail edge and tooltip
const RAIL_WIDTH = 52;    // matches --rail-width

let activeTooltip: HTMLElement | null = null;
let initialized = false;

function createTooltipEl(label: string, targetRect: DOMRect): HTMLElement {
  const isRtl = document.documentElement.dir === 'rtl';

  const tip = document.createElement('div');
  tip.className = 'rail-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.textContent = label;

  // Base styles
  tip.style.cssText = `
    position: fixed;
    background: #1e1f2e;
    color: #e0e0e0;
    font-size: 12px;
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

  // Measure tooltip after appending so we know its size
  const tipRect = tip.getBoundingClientRect();
  const tipH = tipRect.height;
  const tipW = tipRect.width;

  // Vertical: center on the target, clamped to viewport
  const targetCenterY = targetRect.top + targetRect.height / 2;
  let top = targetCenterY - tipH / 2;
  const margin = 6;
  top = Math.max(margin, Math.min(top, window.innerHeight - tipH - margin));

  // Horizontal: place on content side of rail
  let left: number;
  if (isRtl) {
    // Rail is on the right; tooltip appears to the left of the rail
    const railRight = window.innerWidth - RAIL_WIDTH;
    left = railRight - TOOLTIP_OFFSET - tipW;
    left = Math.max(margin, left);
    tip.style.transform = 'translateX(-4px)';
  } else {
    // Rail is on the left; tooltip appears to the right
    left = RAIL_WIDTH + TOOLTIP_OFFSET;
    left = Math.min(left, window.innerWidth - tipW - margin);
    tip.style.transform = 'translateX(4px)';
  }

  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;

  // Trigger animation on next frame
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
  if (layoutService.currentLayout !== 'modern') return;
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
    btn.addEventListener('mouseenter', onNavItemEnter);
    btn.addEventListener('mouseleave', onNavItemLeave);
  });
}

/** Re-attach after nav re-renders (language change) */
function reattach(sidebar: HTMLElement): void {
  // Remove old listeners by cloning is not ideal; instead we use a flag on the element
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

  attachListeners(sidebar);

  // Clean up tooltips when switching back to Classic
  layoutService.onLayoutChange((style) => {
    if (style === 'classic') removeTooltip();
    // Re-attach after potential DOM updates
    requestAnimationFrame(() => reattach(sidebar));
  });

  // Re-attach after language changes re-render nav items
  const observer = new MutationObserver(() => {
    reattach(sidebar);
  });
  const nav = sidebar.querySelector('.sidebar-nav');
  if (nav) {
    observer.observe(nav, { childList: true, subtree: false });
  }
}
