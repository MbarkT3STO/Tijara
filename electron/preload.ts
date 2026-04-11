/**
 * Electron preload script.
 * Exposes a safe, typed API to the renderer via contextBridge.
 * The renderer never has direct access to Node.js or Electron internals.
 */

import { contextBridge, ipcRenderer } from 'electron';

/** The API surface exposed to the renderer process */
export interface ElectronAPI {
  /** Read persisted JSON data from disk */
  readData: () => Promise<string | null>;
  /** Write JSON data to disk */
  writeData: (json: string) => Promise<boolean>;
  /** Clear all data - delete the data file */
  clearData: () => Promise<boolean>;
  /** Export data as Excel – opens native save dialog */
  exportExcel: (buffer: ArrayBuffer) => Promise<boolean>;
  /** Import data from Excel – opens native open dialog */
  importExcel: () => Promise<ArrayBuffer | null>;
  /** Get the path to the data file */
  getDataPath: () => Promise<string>;
  /** Export a single invoice as PDF – opens native save dialog */
  exportInvoicePDF: (html: string, invoiceNumber: string) => Promise<boolean>;
  /** Export a report as PDF – opens native save dialog */
  exportReportPDF: (html: string, filename: string) => Promise<boolean>;
  /** Listen for menu-triggered export */
  onMenuExport: (callback: () => void) => () => void;
  /** Listen for menu-triggered import */
  onMenuImport: (callback: () => void) => () => void;
}

const api: ElectronAPI = {
  readData: () => ipcRenderer.invoke('data:read'),
  writeData: (json) => ipcRenderer.invoke('data:write', json),
  clearData: () => ipcRenderer.invoke('data:clear'),
  exportExcel: (buffer) => ipcRenderer.invoke('excel:export', buffer),
  importExcel: () => ipcRenderer.invoke('excel:import'),
  getDataPath: () => ipcRenderer.invoke('app:dataPath'),
  exportInvoicePDF: (html, invoiceNumber) => ipcRenderer.invoke('invoice:exportPDF', html, invoiceNumber),
  exportReportPDF: (html, filename) => ipcRenderer.invoke('report:exportPDF', html, filename),

  onMenuExport: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu:export', handler);
    return () => ipcRenderer.removeListener('menu:export', handler);
  },

  onMenuImport: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu:import', handler);
    return () => ipcRenderer.removeListener('menu:import', handler);
  },
};

contextBridge.exposeInMainWorld('electron', api);
