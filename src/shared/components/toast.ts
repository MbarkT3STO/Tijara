/**
 * Toast notification component.
 * Listens to the event bus and renders toast messages.
 */

import { eventBus, Events } from '@core/eventBus';
import type { AppNotification } from '@core/types';
import { Icons } from './icons';

const TOAST_ICONS: Record<AppNotification['type'], string> = {
  success: Icons.check(),
  error: Icons.alertCircle(),
  warning: Icons.alertCircle(),
  info: Icons.info(),
};

/** Initialize the toast container and subscribe to notifications */
export function initToasts(): void {
  const container = document.createElement('div');
  container.className = 'toast-container';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'false');
  document.body.appendChild(container);

  // Inject toast styles
  const style = document.createElement('style');
  style.textContent = `
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
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
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      min-width: 280px;
      max-width: 400px;
      pointer-events: all;
      animation: slideIn 250ms ease;
      transition: opacity 300ms ease, transform 300ms ease;
    }
    .toast.removing {
      opacity: 0;
      transform: translateX(16px);
    }
    .toast-icon {
      flex-shrink: 0;
      margin-top: 1px;
    }
    .toast-success .toast-icon { color: var(--color-success); }
    .toast-error .toast-icon { color: var(--color-error); }
    .toast-warning .toast-icon { color: var(--color-warning); }
    .toast-info .toast-icon { color: var(--color-info); }
    .toast-content { flex: 1; }
    .toast-message {
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
      line-height: 1.4;
    }
    .toast-close {
      flex-shrink: 0;
      color: var(--color-text-tertiary);
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
      display: flex;
      align-items: center;
      transition: color var(--transition-fast);
    }
    .toast-close:hover { color: var(--color-text-primary); }
    .toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      border-radius: 0 0 var(--radius-md) var(--radius-md);
      transition: width linear;
    }
    .toast-success .toast-progress { background: var(--color-success); }
    .toast-error .toast-progress { background: var(--color-error); }
    .toast-warning .toast-progress { background: var(--color-warning); }
    .toast-info .toast-progress { background: var(--color-info); }
  `;
  document.head.appendChild(style);

  eventBus.on<AppNotification>(Events.NOTIFICATION, (notification) => {
    showToast(container, notification);
  });
}

/** Render a single toast */
function showToast(container: HTMLElement, notification: AppNotification): void {
  const duration = notification.duration ?? 4000;

  const toast = document.createElement('div');
  toast.className = `toast toast-${notification.type}`;
  toast.setAttribute('role', 'alert');
  toast.style.position = 'relative';
  toast.style.overflow = 'hidden';

  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[notification.type]}</span>
    <div class="toast-content">
      <p class="toast-message">${notification.message}</p>
    </div>
    <button class="toast-close" aria-label="Dismiss notification">
      ${Icons.close(16)}
    </button>
    <div class="toast-progress" style="width: 100%"></div>
  `;

  container.appendChild(toast);

  const progress = toast.querySelector<HTMLElement>('.toast-progress');
  const closeBtn = toast.querySelector<HTMLButtonElement>('.toast-close');

  const remove = () => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  };

  closeBtn?.addEventListener('click', remove);

  // Animate progress bar
  if (progress) {
    requestAnimationFrame(() => {
      progress.style.transition = `width ${duration}ms linear`;
      progress.style.width = '0%';
    });
  }

  setTimeout(remove, duration);
}
