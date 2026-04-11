/**
 * Custom print preview modal.
 * Renders the invoice HTML inside an in-app modal with zoom, print and PDF export actions.
 * Works in both Electron and web — no native print dialog dependency.
 */

import { Icons } from './icons';
import { i18n } from '@core/i18n';
import type { Invoice } from '@core/types';
import { buildInvoiceHTML } from '@shared/utils/invoicePdf';

function getElectron() {
  return (window as any).electron ?? null;
}

export async function openPrintPreview(invoice: Invoice): Promise<void> {
  const html = await buildInvoiceHTML(invoice);

  // ── Overlay ───────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = '__print-preview-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(0,0,0,0.75);
    display: flex; flex-direction: column;
    animation: fadeIn 150ms ease;
  `;

  // ── Toolbar ───────────────────────────────────────────────────────────────
  const toolbar = document.createElement('div');
  toolbar.style.cssText = `
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 var(--space-5);
    height: 56px;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    gap: var(--space-3);
  `;

  const left = document.createElement('div');
  left.style.cssText = 'display:flex;align-items:center;gap:var(--space-3);';
  left.innerHTML = `
    <span style="font-weight:600;font-size:var(--font-size-sm);color:var(--color-text-primary);">
      ${i18n.t('common.print')} — ${invoice.invoiceNumber}
    </span>
  `;

  // Zoom controls
  let zoom = 100;
  const zoomLabel = document.createElement('span');
  zoomLabel.style.cssText = 'font-size:var(--font-size-xs);color:var(--color-text-secondary);min-width:40px;text-align:center;';
  zoomLabel.textContent = '100%';

  const zoomOut = document.createElement('button');
  zoomOut.className = 'btn btn-ghost btn-icon btn-sm';
  zoomOut.title = i18n.t('common.view');
  zoomOut.innerHTML = Icons.chevronLeft(16);

  const zoomIn = document.createElement('button');
  zoomIn.className = 'btn btn-ghost btn-icon btn-sm';
  zoomIn.title = i18n.t('common.view');
  zoomIn.innerHTML = Icons.chevronRight(16);

  const zoomControls = document.createElement('div');
  zoomControls.style.cssText = 'display:flex;align-items:center;gap:4px;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:2px;';
  zoomControls.appendChild(zoomOut);
  zoomControls.appendChild(zoomLabel);
  zoomControls.appendChild(zoomIn);

  const right = document.createElement('div');
  right.style.cssText = 'display:flex;align-items:center;gap:var(--space-2);';

  const pdfBtn = document.createElement('button');
  pdfBtn.className = 'btn btn-secondary btn-sm';
  pdfBtn.innerHTML = `${Icons.download(16)} ${i18n.t('common.exportPdf')}`;

  const printBtn = document.createElement('button');
  printBtn.className = 'btn btn-primary btn-sm';
  printBtn.innerHTML = `${Icons.printer(16)} ${i18n.t('common.print')}`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-ghost btn-icon btn-sm';
  closeBtn.setAttribute('aria-label', i18n.t('common.close'));
  closeBtn.innerHTML = Icons.close(16);

  right.appendChild(pdfBtn);
  right.appendChild(printBtn);
  right.appendChild(closeBtn);

  toolbar.appendChild(left);
  toolbar.appendChild(zoomControls);
  toolbar.appendChild(right);

  // ── Preview area ──────────────────────────────────────────────────────────
  const previewArea = document.createElement('div');
  previewArea.style.cssText = `
    flex: 1; overflow: auto;
    background: #525659;
    display: flex; justify-content: center;
    padding: var(--space-6);
  `;

  const pageWrapper = document.createElement('div');
  pageWrapper.style.cssText = `
    width: 794px;
    transform-origin: top center;
    transition: transform 150ms ease;
    box-shadow: 0 4px 32px rgba(0,0,0,0.5);
  `;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    width: 100%; border: none; display: block;
    background: #fff;
    min-height: 1123px;
  `;
  iframe.setAttribute('title', `Invoice ${invoice.invoiceNumber}`);

  pageWrapper.appendChild(iframe);
  previewArea.appendChild(pageWrapper);

  overlay.appendChild(toolbar);
  overlay.appendChild(previewArea);
  document.body.appendChild(overlay);

  // Write HTML into iframe
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }

  // Auto-size iframe height to content after load
  iframe.onload = () => {
    const body = iframe.contentDocument?.body;
    if (body) {
      iframe.style.height = Math.max(1123, body.scrollHeight + 48) + 'px';
    }
  };

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const applyZoom = () => {
    pageWrapper.style.transform = `scale(${zoom / 100})`;
    zoomLabel.textContent = `${zoom}%`;
    // Adjust wrapper height so scrolling works correctly
    pageWrapper.style.marginBottom = zoom < 100
      ? `${-(iframe.offsetHeight * (1 - zoom / 100))}px`
      : '0';
  };

  zoomOut.addEventListener('click', () => { zoom = Math.max(50, zoom - 10); applyZoom(); });
  zoomIn.addEventListener('click', () => { zoom = Math.min(150, zoom + 10); applyZoom(); });

  // ── Close ─────────────────────────────────────────────────────────────────
  const close = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 150ms ease';
    setTimeout(() => overlay.remove(), 150);
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });

  // ── Print ─────────────────────────────────────────────────────────────────
  printBtn.addEventListener('click', async () => {
    const electron = getElectron();
    if (electron?.printInvoice) {
      // Electron: use IPC with a visible window for proper print dialog
      await electron.printInvoice(html);
    } else {
      // Web: print the iframe content
      iframe.contentWindow?.print();
    }
  });

  // ── PDF export ────────────────────────────────────────────────────────────
  pdfBtn.addEventListener('click', async () => {
    pdfBtn.setAttribute('disabled', 'true');
    pdfBtn.innerHTML = `<span class="spinner" style="width:14px;height:14px;"></span>`;
    try {
      const electron = getElectron();
      if (electron?.exportInvoicePDF) {
        await electron.exportInvoicePDF(html, invoice.invoiceNumber);
      } else {
        iframe.contentWindow?.print();
      }
    } finally {
      pdfBtn.removeAttribute('disabled');
      pdfBtn.innerHTML = `${Icons.download(16)} ${i18n.t('common.exportPdf')}`;
    }
  });
}
