/**
 * Global keyboard shortcut system.
 * Registers Ctrl/Cmd+K (command palette), Ctrl/Cmd+N (new), Ctrl/Cmd+S (save), ? (help).
 */

import { i18n } from '@core/i18n';
import { router } from '@core/router';
import type { Route } from '@core/types';

interface ShortcutAction {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
  handler: () => void;
}

const registeredShortcuts: ShortcutAction[] = [];

/** Register a global keyboard shortcut */
export function registerShortcut(action: ShortcutAction): void {
  registeredShortcuts.push(action);
}

/** Remove all registered shortcuts */
export function clearShortcuts(): void {
  registeredShortcuts.length = 0;
}

/** Initialize the global shortcut listener */
export function initShortcuts(): void {
  document.addEventListener('keydown', handleKeyDown);
}

function handleKeyDown(e: KeyboardEvent): void {
  // Don't fire shortcuts when typing in inputs/textareas
  const tag = (e.target as HTMLElement).tagName;
  const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    || (e.target as HTMLElement).isContentEditable;

  const ctrl = e.ctrlKey || e.metaKey;

  // Ctrl+K — command palette (always fires, even in inputs)
  if (ctrl && e.key === 'k') {
    e.preventDefault();
    openCommandPalette();
    return;
  }

  if (isEditable) return;

  // Ctrl+N — context-aware new
  if (ctrl && e.key === 'n') {
    e.preventDefault();
    triggerNewAction();
    return;
  }

  // Ctrl+S — save current form
  if (ctrl && e.key === 's') {
    e.preventDefault();
    triggerSave();
    return;
  }

  // ? — shortcuts help
  if (e.key === '?' && !ctrl) {
    e.preventDefault();
    openShortcutsHelp();
    return;
  }

  // / — focus global search
  if (e.key === '/' && !ctrl) {
    e.preventDefault();
    const searchInput = document.querySelector<HTMLInputElement>('#global-search-input');
    if (searchInput) { searchInput.focus(); searchInput.select(); }
    return;
  }

  // Custom registered shortcuts
  for (const shortcut of registeredShortcuts) {
    const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
    const ctrlMatch = shortcut.ctrl ? ctrl : !ctrl;
    const shiftMatch = shortcut.shift ? e.shiftKey : true;
    if (keyMatch && ctrlMatch && shiftMatch) {
      e.preventDefault();
      shortcut.handler();
      return;
    }
  }
}

function triggerNewAction(): void {
  const route = router.getRoute();
  const newBtnSelectors = ['#add-sale-btn', '#add-invoice-btn', '#add-purchase-btn',
    '#add-return-btn', '#add-account-btn', '#add-je-btn', '#add-customer-btn',
    '#add-product-btn', '#add-supplier-btn', '#add-user-btn'];
  for (const sel of newBtnSelectors) {
    const btn = document.querySelector<HTMLButtonElement>(sel);
    if (btn) { btn.click(); return; }
  }
  // Fallback: click any "btn-primary" in the page header
  document.querySelector<HTMLButtonElement>('.page-header .btn-primary')?.click();
}

function triggerSave(): void {
  // Try to click the save/confirm button in an open modal first
  const modalSave = document.querySelector<HTMLButtonElement>('.modal .confirm-btn:not([disabled])');
  if (modalSave) { modalSave.click(); return; }
  // Then try page-level save buttons
  const pageSave = document.querySelector<HTMLButtonElement>('#save-profile-btn, [id$="-save-btn"]');
  pageSave?.click();
}

// ── Command Palette ───────────────────────────────────────────────────────────

const PALETTE_ROUTES: Array<{ route: Route; labelKey: string }> = [
  { route: 'dashboard',        labelKey: 'nav.dashboard' },
  { route: 'sales',            labelKey: 'nav.sales' },
  { route: 'invoices',         labelKey: 'nav.invoices' },
  { route: 'customers',        labelKey: 'nav.customers' },
  { route: 'products',         labelKey: 'nav.products' },
  { route: 'inventory',        labelKey: 'nav.inventory' },
  { route: 'suppliers',        labelKey: 'nav.suppliers' },
  { route: 'purchases',        labelKey: 'nav.purchases' },
  { route: 'returns',          labelKey: 'nav.returns' },
  { route: 'reports',          labelKey: 'nav.reports' },
  { route: 'accounting',       labelKey: 'nav.accounting' },
  { route: 'chart-of-accounts',labelKey: 'nav.chart-of-accounts' },
  { route: 'journal',          labelKey: 'nav.journal' },
  { route: 'ledger',           labelKey: 'nav.ledger' },
  { route: 'settings',         labelKey: 'nav.settings' },
  { route: 'users',            labelKey: 'nav.users' },
];

function openCommandPalette(): void {
  // Close any existing palette
  document.getElementById('cmd-palette-backdrop')?.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'cmd-palette-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', i18n.t('shortcuts.commandPalette' as any) || 'Command Palette');
  backdrop.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 9998;
    display: flex; align-items: flex-start; justify-content: center;
    padding-top: 15vh;
    backdrop-filter: blur(4px);
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    width: 560px; max-width: calc(100vw - 32px);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    overflow: hidden;
    animation: pageEnterAnim 150ms ease-out both;
  `;

  let selectedIdx = 0;
  let query = '';

  const getFiltered = () => PALETTE_ROUTES.filter((r) => {
    const label = i18n.t(r.labelKey as any) || r.route;
    return !query || label.toLowerCase().includes(query.toLowerCase()) || r.route.includes(query.toLowerCase());
  });

  const render = () => {
    const filtered = getFiltered();
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);border-bottom:1px solid var(--color-border);">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="cmd-input" type="text" placeholder="${i18n.t('shortcuts.searchPages' as any) || 'Search pages and actions...'}"
          value="${query}"
          style="flex:1;border:none;outline:none;background:transparent;font-size:var(--font-size-base);color:var(--color-text-primary);font-family:var(--font-family);"
          autocomplete="off" />
        <kbd style="font-size:10px;padding:2px 6px;background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:4px;color:var(--color-text-tertiary);">ESC</kbd>
      </div>
      <div style="max-height:320px;overflow-y:auto;padding:var(--space-2);">
        ${filtered.length === 0
          ? `<div style="padding:var(--space-6);text-align:center;color:var(--color-text-tertiary);font-size:var(--font-size-sm);">${i18n.t('common.noData')}</div>`
          : filtered.map((r, i) => `
            <button data-idx="${i}" class="cmd-item" style="
              display:flex;align-items:center;gap:var(--space-3);
              width:100%;padding:var(--space-2) var(--space-3);
              border:none;border-radius:var(--radius-sm);
              background:${i === selectedIdx ? 'var(--color-primary-subtle)' : 'transparent'};
              color:${i === selectedIdx ? 'var(--color-primary)' : 'var(--color-text-primary)'};
              cursor:pointer;text-align:start;font-size:var(--font-size-sm);
              font-family:var(--font-family);
            ">
              <span style="flex:1;">${i18n.t(r.labelKey as any) || r.route}</span>
              <kbd style="font-size:10px;padding:2px 6px;background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:4px;color:var(--color-text-tertiary);">↵</kbd>
            </button>`).join('')
        }
      </div>
      <div style="padding:var(--space-2) var(--space-4);border-top:1px solid var(--color-border);display:flex;gap:var(--space-4);font-size:10px;color:var(--color-text-tertiary);">
        <span>↑↓ ${i18n.t('shortcuts.navigate' as any) || 'navigate'}</span>
        <span>↵ ${i18n.t('shortcuts.select' as any) || 'select'}</span>
        <span>ESC ${i18n.t('shortcuts.close' as any) || 'close'}</span>
      </div>
    `;

    const input = panel.querySelector<HTMLInputElement>('#cmd-input')!;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    input.addEventListener('input', () => {
      query = input.value;
      selectedIdx = 0;
      render();
    });

    panel.querySelectorAll<HTMLButtonElement>('.cmd-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx')!);
        const item = filtered[idx];
        if (item) { router.navigate(item.route); close(); }
      });
      btn.addEventListener('mouseenter', () => {
        selectedIdx = parseInt(btn.getAttribute('data-idx')!);
        render();
      });
    });
  };

  const navigate = (dir: 1 | -1) => {
    const filtered = getFiltered();
    selectedIdx = Math.max(0, Math.min(filtered.length - 1, selectedIdx + dir));
    render();
  };

  const selectCurrent = () => {
    const filtered = getFiltered();
    const item = filtered[selectedIdx];
    if (item) { router.navigate(item.route); close(); }
  };

  const close = () => backdrop.remove();

  backdrop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); navigate(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); navigate(-1); }
    if (e.key === 'Enter') { e.preventDefault(); selectCurrent(); }
  });

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);
  render();
}

// ── Shortcuts Help Modal ──────────────────────────────────────────────────────

function openShortcutsHelp(): void {
  import('@shared/components/modal').then(({ openModal }) => {
    const content = document.createElement('div');
    const shortcuts = [
      { keys: 'Ctrl + K', desc: i18n.t('shortcuts.openPalette' as any) || 'Open command palette' },
      { keys: 'Ctrl + N', desc: i18n.t('shortcuts.newItem' as any) || 'Create new item' },
      { keys: 'Ctrl + S', desc: i18n.t('shortcuts.saveForm' as any) || 'Save current form' },
      { keys: '?',        desc: i18n.t('shortcuts.showHelp' as any) || 'Show this help' },
    ];
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--space-2);">
        ${shortcuts.map((s) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border-subtle);">
            <span style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">${s.desc}</span>
            <kbd style="font-size:var(--font-size-xs);padding:3px 8px;background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:var(--radius-xs);color:var(--color-text-primary);font-family:var(--font-family);">${s.keys}</kbd>
          </div>`).join('')}
      </div>
    `;
    openModal({
      title: i18n.t('shortcuts.title' as any) || 'Keyboard Shortcuts',
      content,
      hideFooter: false,
      confirmText: i18n.t('common.close'),
      onConfirm: () => {},
    });
  });
}
