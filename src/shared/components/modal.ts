/**
 * Reusable modal dialog component.
 * Modals can only be closed via the X (close) button.
 * Backdrop clicks and Escape key are intentionally disabled.
 */

import { Icons } from './icons';

export interface ModalOptions {
  title: string;
  content: HTMLElement | string;
  size?: 'sm' | 'md' | 'lg';
  onConfirm?: () => void | Promise<void>;
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

  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `
    <h2 class="modal-title" id="modal-title">${options.title}</h2>
    <button class="btn btn-ghost btn-icon close-btn" aria-label="Close modal">
      ${Icons.close()}
    </button>
  `;

  const body = document.createElement('div');
  body.className = 'modal-body';
  if (typeof options.content === 'string') {
    body.innerHTML = options.content;
  } else {
    body.appendChild(options.content);
  }

  modal.appendChild(header);
  modal.appendChild(body);

  if (!options.hideFooter) {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = `
      <button class="btn btn-secondary cancel-btn">${options.cancelText ?? 'Cancel'}</button>
      <button class="btn ${options.confirmClass ?? 'btn-primary'} confirm-btn">${options.confirmText ?? 'Confirm'}</button>
    `;
    modal.appendChild(footer);
  }

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Focus the first focusable element inside the modal
  const focusable = modal.querySelectorAll<HTMLElement>(
    'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  focusable[0]?.focus();

  const close = () => {
    backdrop.style.opacity = '0';
    setTimeout(() => backdrop.remove(), 200);
    options.onCancel?.();
  };

  // X button and Cancel button are the only ways to close
  modal.querySelector('.close-btn')?.addEventListener('click', close);
  modal.querySelector('.cancel-btn')?.addEventListener('click', close);

  modal.querySelector('.confirm-btn')?.addEventListener('click', async () => {
    if (options.onConfirm) {
      await options.onConfirm();
    }
    backdrop.remove();
  });

  return close;
}

/** Show a simple confirmation dialog */
export function confirmDialog(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = 'Delete',
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
