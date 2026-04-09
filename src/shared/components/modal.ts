/**
 * Reusable modal dialog component.
 * - Closes only via X button or Cancel button.
 * - Validation errors appear inline inside the modal (not as toasts).
 * - onConfirm returning false (or throwing) keeps the modal open.
 */

import { i18n } from '@core/i18n';
import { Icons } from './icons';

export interface ModalOptions {
  title: string;
  content: HTMLElement | string;
  size?: 'sm' | 'md' | 'lg';
  /** Return false to keep the modal open (validation failed). Throw to show an error message. */
  onConfirm?: () => void | false | Promise<void | false>;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmClass?: string;
  hideFooter?: boolean;
}

/** Open a modal dialog and return a close function */
export function openModal(options: ModalOptions): () => void {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'modal-title');

  const sizeClass = options.size === 'lg' ? 'modal-lg' : options.size === 'sm' ? 'modal-sm' : '';

  const modal = document.createElement('div');
  modal.className = `modal ${sizeClass}`;

  // ── Header ──────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `
    <h2 class="modal-title" id="modal-title">${options.title}</h2>
    <button class="btn btn-ghost btn-icon close-btn" aria-label="Close modal">
      ${Icons.close()}
    </button>
  `;

  // ── Inline error banner (hidden by default) ──────────────────────────────
  const errorBanner = document.createElement('div');
  errorBanner.className = 'modal-error-banner';
  errorBanner.setAttribute('role', 'alert');
  errorBanner.setAttribute('aria-live', 'polite');
  errorBanner.style.display = 'none';

  // ── Body ─────────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'modal-body';
  body.appendChild(errorBanner);

  if (typeof options.content === 'string') {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = options.content;
    body.appendChild(wrapper);
  } else {
    body.appendChild(options.content);
  }

  modal.appendChild(header);
  modal.appendChild(body);

  // ── Footer ────────────────────────────────────────────────────────────────
  if (!options.hideFooter) {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = `
      <button class="btn btn-secondary cancel-btn">${options.cancelText ?? i18n.t('common.cancel')}</button>
      <button class="btn ${options.confirmClass ?? 'btn-primary'} confirm-btn">${options.confirmText ?? i18n.t('common.confirm')}</button>
    `;
    modal.appendChild(footer);
  }

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Focus first focusable element
  const focusable = modal.querySelectorAll<HTMLElement>(
    'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  focusable[0]?.focus();

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Show an inline error inside the modal and highlight invalid fields */
  const showError = (message: string, invalidIds: string[] = []) => {
    errorBanner.innerHTML = `
      <span class="modal-error-icon">${Icons.alertCircle(16)}</span>
      <span>${message}</span>
    `;
    errorBanner.style.display = 'flex';

    // Scroll banner into view
    errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Highlight invalid fields
    modal.querySelectorAll<HTMLElement>('.form-control').forEach((el) => {
      el.classList.remove('error');
    });
    invalidIds.forEach((id) => {
      modal.querySelector(`#${id}`)?.classList.add('error');
    });
  };

  const clearError = () => {
    errorBanner.style.display = 'none';
    errorBanner.innerHTML = '';
    modal.querySelectorAll<HTMLElement>('.form-control.error').forEach((el) => {
      el.classList.remove('error');
    });
  };

  // Clear error when user starts typing/changing any field
  modal.addEventListener('input', clearError, { passive: true });
  modal.addEventListener('change', clearError, { passive: true });

  // ── Close ─────────────────────────────────────────────────────────────────
  const close = () => {
    backdrop.style.opacity = '0';
    setTimeout(() => backdrop.remove(), 200);
    options.onCancel?.();
  };

  modal.querySelector('.close-btn')?.addEventListener('click', close);
  modal.querySelector('.cancel-btn')?.addEventListener('click', close);

  // ── Confirm ───────────────────────────────────────────────────────────────
  const confirmBtn = modal.querySelector<HTMLButtonElement>('.confirm-btn');
  confirmBtn?.addEventListener('click', async () => {
    if (!options.onConfirm) { backdrop.remove(); return; }

    confirmBtn.disabled = true;
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>`;

    try {
      const result = await options.onConfirm();
      if (result === false) {
        // Validation failed — keep modal open, error already shown by caller
        return;
      }
      backdrop.remove();
    } catch (err) {
      // Caller threw an error string or Error object — show it inline
      const msg = err instanceof Error ? err.message : String(err);
      showError(msg);
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = originalText;
    }
  });

  // Expose showError on the modal element so callers can use it
  (modal as unknown as HTMLElement & { showError: typeof showError }).showError = showError;

  return close;
}

/**
 * Show an inline validation error inside an open modal.
 * Pass the modal's content element (the form/div passed as `content`).
 */
export function showModalError(
  contentEl: HTMLElement,
  message: string,
  invalidIds: string[] = []
): void {
  // Walk up to find the modal
  const modal = contentEl.closest<HTMLElement>('.modal');
  if (!modal) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (modal as any).showError?.(message, invalidIds);
}

/** Show a simple confirmation dialog */
export function confirmDialog(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = i18n.t('common.delete'),
  confirmClass = 'btn-danger'
): void {
  const content = document.createElement('p');
  content.style.color = 'var(--color-text-secondary)';
  content.style.fontSize = 'var(--font-size-sm)';
  content.textContent = message;

  openModal({
    title,
    content,
    confirmText,
    confirmClass,
    onConfirm,
  });
}
