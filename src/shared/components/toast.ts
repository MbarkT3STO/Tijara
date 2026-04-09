/**
 * Toast notification component.
 * Listens to the event bus and renders toast messages.
 */

import { eventBus, Events } from '@core/eventBus';
import type { AppNotification } from '@core/types';
import { Icons } from './icons';

const TOAST_ICONS: Record<AppNotification['type'], string> = {
  success: Icons.check(18),
  error: Icons.alertCircle(18),
  warning: Icons.alertTriangle(18),
  info: Icons.info(18),
};

const TOAST_COLORS: Record<AppNotification['type'], string> = {
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  warning: 'var(--color-warning)',
  info: 'var(--color-info)',
};

/** Initialize the toast container and subscribe to notifications */
export function initToasts(): void {
  const container = document.createElement('div');
  container.className = 'toast-container';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'false');
  document.body.appendChild(container);

  const style = document.createElement('style');
  style.textContent = `
    .toast-container {
      position: fixed;
      bottom: var(--space-6);
      inset-inline-end: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: var(--z-toast);
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      min-width: 300px;
      max-width: 420px;
      pointer-events: all;
      animation: toastSlideIn 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
      transition: opacity 300ms ease, transform 300ms ease;
      position: relative;
      overflow: hidden;
    }
    .toast.removing {
      opacity: 0;
      transform: translateX(calc(16px * var(--icon-flip, 1)));
    }
    .toast-accent {
      position: absolute;
      inset-inline-start: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      border-radius: var(--radius-xs) 0 0 var(--radius-xs);
    }
    .toast-icon {
      flex-shrink: 0;
      margin-top: 1px;
      margin-inline-start: 4px;
    }
    .toast-success .toast-icon { color: var(--color-success); }
    .toast-error .toast-icon { color: var(--color-error); }
    .toast-warning .toast-icon { color: var(--color-warning); }
    .toast-info .toast-icon { color: var(--color-info); }
    .toast-content { flex: 1; min-width: 0; }
    .toast-title {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      margin-bottom: 2px;
    }
    .toast-message {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      line-height: 1.4;
    }
    .toast-close {
      flex-shrink: 0;
      color: var(--color-text-tertiary);
      cursor: pointer;
      background: none;
      border: none;
      padding: 2px;
      display: flex;
      align-items: center;
      border-radius: var(--radius-xs);
      transition: color var(--transition-fast), background var(--transition-fast);
      margin-top: -2px;
    }
    .toast-close:hover {
      color: var(--color-text-primary);
      background: var(--color-bg-secondary);
    }
    .toast-progress {
      position: absolute;
      bottom: 0;
      inset-inline-start: 0;
      height: 2px;
      border-radius: 0 0 var(--radius-md) var(--radius-md);
      transition: width linear;
    }
    .toast-success .toast-progress { background: var(--color-success); }
    .toast-error .toast-progress { background: var(--color-error); }
    .toast-warning .toast-progress { background: var(--color-warning); }
    .toast-info .toast-progress { background: var(--color-info); }
    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateX(calc(24px * var(--icon-flip, 1))); }
      to { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);

  eventBus.on<AppNotification>(Events.NOTIFICATION, (notification) => {
    showToast(container, notification);
  });
}

/** Render a single toast */
function showToast(container: HTMLElement, notification: AppNotification): void {
  const duration = notification.duration ?? 4000;
  const accentColor = TOAST_COLORS[notification.type];

  const toast = document.createElement('div');
  toast.className = `toast toast-${notification.type}`;
  toast.setAttribute('role', 'alert');

  toast.innerHTML = `
    <div class="toast-accent" style="background:${accentColor};"></div>
    <span class="toast-icon">${TOAST_ICONS[notification.type]}</span>
    <div class="toast-content">
      <p class="toast-message">${notification.message}</p>
    </div>
    <button class="toast-close" aria-label="Dismiss notification">
      ${Icons.close(14)}
    </button>
    <div class="toast-progress" style="width:100%;"></div>
  `;

  container.appendChild(toast);

  const progress = toast.querySelector<HTMLElement>('.toast-progress');
  const closeBtn = toast.querySelector<HTMLButtonElement>('.toast-close');

  const remove = () => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  };

  closeBtn?.addEventListener('click', remove);

  if (progress) {
    requestAnimationFrame(() => {
      progress.style.transition = `width ${duration}ms linear`;
      progress.style.width = '0%';
    });
  }

  setTimeout(remove, duration);
}
