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
  /** Print an invoice – opens native print dialog with preview */
  printInvoice: (html: string) => Promise<boolean>;
  /** Listen for menu-triggered export */
  onMenuExport: (callback: () => void) => () => void;
  /** Listen for menu-triggered import */
  onMenuImport: (callback: () => void) => () => void;
  /** Choose where to save the Excel storage file */
  chooseExcelStorageFile: () => Promise<string | null>;
  /** Read the Excel storage file as raw bytes */
  readExcelStorage: (filePath: string) => Promise<ArrayBuffer | null>;
  /** Write the Excel storage file from raw bytes */
  writeExcelStorage: (buffer: ArrayBuffer, filePath: string) => Promise<boolean>;
  // ── SQLite storage ──────────────────────────────────────────────────────
  /** Get all rows from a collection */
  sqliteGetAll: (collection: string) => Promise<unknown[]>;
  /** Get a single row by id */
  sqliteGetById: (collection: string, id: string) => Promise<unknown | null>;
  /** Insert a new row */
  sqliteInsert: (collection: string, item: Record<string, unknown>) => Promise<boolean>;
  /** Update an existing row by id */
  sqliteUpdate: (collection: string, id: string, updates: Record<string, unknown>) => Promise<boolean>;
  /** Delete a row by id */
  sqliteDelete: (collection: string, id: string) => Promise<boolean>;
  /** Bulk insert all collections atomically (migration) */
  sqliteBulkInsert: (allData: Record<string, unknown[]>) => Promise<boolean>;
  /** Clear all rows from all tables */
  sqliteClear: () => Promise<boolean>;
  /** Get the SQLite database file path */
  sqliteDbPath: () => Promise<string>;
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
  printInvoice: (html) => ipcRenderer.invoke('invoice:print', html),

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

  chooseExcelStorageFile: () => ipcRenderer.invoke('storage:chooseExcelFile'),
  readExcelStorage: (filePath) => ipcRenderer.invoke('storage:readExcel', filePath),
  writeExcelStorage: (buffer, filePath) => ipcRenderer.invoke('storage:writeExcel', buffer, filePath),

  sqliteGetAll: (collection) => ipcRenderer.invoke('sqlite:getAll', collection),
  sqliteGetById: (collection, id) => ipcRenderer.invoke('sqlite:getById', collection, id),
  sqliteInsert: (collection, item) => ipcRenderer.invoke('sqlite:insert', collection, item),
  sqliteUpdate: (collection, id, updates) => ipcRenderer.invoke('sqlite:update', collection, id, updates),
  sqliteDelete: (collection, id) => ipcRenderer.invoke('sqlite:delete', collection, id),
  sqliteBulkInsert: (allData) => ipcRenderer.invoke('sqlite:bulkInsert', allData),
  sqliteClear: () => ipcRenderer.invoke('sqlite:clear'),
  sqliteDbPath: () => ipcRenderer.invoke('sqlite:dbPath'),
};

contextBridge.exposeInMainWorld('electron', api);
