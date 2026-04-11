/**
 * Empty state component.
 * Renders an SVG illustration + heading + subtext + optional CTA button.
 * All colors use CSS variables for dark mode compatibility.
 */

export interface EmptyStateOptions {
  icon?: string;          // SVG string (from Icons.*) — defaults to a generic box
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
  compact?: boolean;      // Smaller padding for inline use
}

const DEFAULT_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    <line x1="12" y1="12" x2="12" y2="16"/>
    <line x1="10" y1="14" x2="14" y2="14"/>
  </svg>
`;

export function createEmptyState(options: EmptyStateOptions): HTMLElement {
  const el = document.createElement('div');
  el.className = 'empty-state-component';
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: ${options.compact ? 'var(--space-8)' : 'var(--space-12)'} var(--space-6);
    gap: var(--space-3);
  `;

  const iconWrap = document.createElement('div');
  iconWrap.style.cssText = `
    width: 72px; height: 72px;
    border-radius: var(--radius-full);
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: var(--space-2);
  `;
  iconWrap.innerHTML = options.icon ?? DEFAULT_ICON;

  const titleEl = document.createElement('p');
  titleEl.className = 'empty-state-title';
  titleEl.style.cssText = `
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    margin: 0;
  `;
  titleEl.textContent = options.title;

  el.appendChild(iconWrap);
  el.appendChild(titleEl);

  if (options.subtitle) {
    const sub = document.createElement('p');
    sub.style.cssText = `
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      max-width: 360px;
      line-height: var(--line-height-relaxed);
      margin: 0;
    `;
    sub.textContent = options.subtitle;
    el.appendChild(sub);
  }

  if (options.ctaLabel && options.onCta) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.style.marginTop = 'var(--space-2)';
    btn.textContent = options.ctaLabel;
    btn.addEventListener('click', options.onCta);
    el.appendChild(btn);
  }

  return el;
}
