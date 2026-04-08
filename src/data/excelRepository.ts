/**
 * Data repository using SheetJS (xlsx) for Excel export/import.
 *
 * Storage strategy (in priority order):
 *  1. Electron IPC  – reads/writes a JSON file in the user's app data folder
 *                     via the preload bridge (window.electron).
 *  2. localStorage  – fallback for plain browser / dev without Electron.
 *
 * Excel export/import always goes through the native file dialog in Electron,
 * or falls back to browser download/File API otherwise.
 */

import * as XLSX from 'xlsx';
import type { Customer, Product, Sale, Invoice, User } from '@core/types';
import type { ElectronAPI } from '../../electron/preload';

/** All data collections stored in the workbook */
export interface WorkbookData {
  customers: Customer[];
  products: Product[];
  sales: Sale[];
  invoices: Invoice[];
  users: User[];
}

const SHEET_NAMES = {
  customers: 'Customers',
  products: 'Products',
  sales: 'Sales',
  invoices: 'Invoices',
  users: 'Users',
} as const;

const STORAGE_KEY = 'tijara-data';

/** Safely access the Electron bridge exposed by the preload script */
function getElectron(): ElectronAPI | null {
  return (window as unknown as { electron?: ElectronAPI }).electron ?? null;
}

class ExcelRepository {
  private data: WorkbookData = {
    customers: [],
    products: [],
    sales: [],
    invoices: [],
    users: [],
  };

  private initialized = false;

  // ── Init ──────────────────────────────────────────────────────────────────

  /** Load persisted data; seed with demo data on first run */
  async init(): Promise<void> {
    if (this.initialized) return;

    const raw = await this.loadRaw();
    if (raw) {
      try {
        this.data = JSON.parse(raw) as WorkbookData;
      } catch {
        this.data = this.getSeedData();
        await this.persist();
      }
    } else {
      this.data = this.getSeedData();
      await this.persist();
    }

    this.initialized = true;
  }

  /** Read raw JSON string from the best available storage */
  private async loadRaw(): Promise<string | null> {
    const electron = getElectron();
    if (electron) {
      return electron.readData();
    }
    return localStorage.getItem(STORAGE_KEY);
  }

  /** Write current data to the best available storage */
  private async persist(): Promise<void> {
    const json = JSON.stringify(this.data);
    const electron = getElectron();
    if (electron) {
      await electron.writeData(json);
    } else {
      localStorage.setItem(STORAGE_KEY, json);
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /** Get all items in a collection */
  getAll<K extends keyof WorkbookData>(collection: K): WorkbookData[K] {
    return [...this.data[collection]] as WorkbookData[K];
  }

  /** Get a single item by id */
  getById<K extends keyof WorkbookData>(
    collection: K,
    id: string
  ): WorkbookData[K][number] | undefined {
    return (this.data[collection] as { id: string }[]).find((item) => item.id === id) as
      | WorkbookData[K][number]
      | undefined;
  }

  /** Insert a new item */
  insert<K extends keyof WorkbookData>(collection: K, item: WorkbookData[K][number]): void {
    (this.data[collection] as WorkbookData[K][number][]).push(item);
    void this.persist();
  }

  /** Update an existing item by id */
  update<K extends keyof WorkbookData>(
    collection: K,
    id: string,
    updates: Partial<WorkbookData[K][number]>
  ): boolean {
    const arr = this.data[collection] as { id: string }[];
    const idx = arr.findIndex((item) => item.id === id);
    if (idx === -1) return false;
    arr[idx] = { ...arr[idx], ...updates };
    void this.persist();
    return true;
  }

  /** Delete an item by id */
  delete<K extends keyof WorkbookData>(collection: K, id: string): boolean {
    const arr = this.data[collection] as { id: string }[];
    const before = arr.length;
    (this.data[collection] as { id: string }[]) = arr.filter((item) => item.id !== id);
    void this.persist();
    return (this.data[collection] as { id: string }[]).length < before;
  }

  // ── Excel export ──────────────────────────────────────────────────────────

  /** Export all data to an Excel workbook */
  async exportToExcel(): Promise<void> {
    const wb = XLSX.utils.book_new();

    for (const [key, sheetName] of Object.entries(SHEET_NAMES)) {
      const collection = key as keyof WorkbookData;
      const rows = this.data[collection];

      if (rows.length === 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No data']]), sheetName);
        continue;
      }

      const flat = rows.map((row) => {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row as unknown as Record<string, unknown>)) {
          result[k] = typeof v === 'object' ? JSON.stringify(v) : v;
        }
        return result;
      });

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flat), sheetName);
    }

    const electron = getElectron();
    if (electron) {
      // In Electron: write to ArrayBuffer and send to main via IPC (native save dialog)
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
      await electron.exportExcel(buf);
    } else {
      // Browser fallback: trigger download
      XLSX.writeFile(wb, 'tijara-data.xlsx');
    }
  }

  // ── Excel import ──────────────────────────────────────────────────────────

  /** Import data from an Excel workbook */
  async importFromExcel(file?: File): Promise<void> {
    let buffer: ArrayBuffer | null = null;

    const electron = getElectron();
    if (electron) {
      // In Electron: open native file dialog
      buffer = await electron.importExcel();
      if (!buffer) return; // user cancelled
    } else if (file) {
      buffer = await file.arrayBuffer();
    } else {
      return;
    }

    const wb = XLSX.read(buffer, { type: 'array' });

    for (const [key, sheetName] of Object.entries(SHEET_NAMES)) {
      const collection = key as keyof WorkbookData;
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;

      const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
      const parsed = rows.map((row) => {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          if (typeof v === 'string') {
            try { result[k] = JSON.parse(v); } catch { result[k] = v; }
          } else {
            result[k] = v;
          }
        }
        return result;
      });

      (this.data[collection] as unknown[]) = parsed;
    }

    await this.persist();
  }

  /** Register menu-driven export/import listeners (Electron only) */
  registerMenuListeners(
    onExport: () => void,
    onImport: () => void
  ): (() => void) | undefined {
    const electron = getElectron();
    if (!electron) return undefined;
    const unExport = electron.onMenuExport(onExport);
    const unImport = electron.onMenuImport(onImport);
    return () => { unExport(); unImport(); };
  }

  // ── Seed data ─────────────────────────────────────────────────────────────

  private getSeedData(): WorkbookData {
    const now = new Date().toISOString();

    const customers: Customer[] = [
      { id: 'c1', name: 'Acme Corp', email: 'contact@acme.com', phone: '+1-555-0100', address: '123 Main St', city: 'New York', country: 'USA', createdAt: now, notes: 'Key account' },
      { id: 'c2', name: 'Globex Inc', email: 'info@globex.com', phone: '+1-555-0200', address: '456 Oak Ave', city: 'Los Angeles', country: 'USA', createdAt: now },
      { id: 'c3', name: 'Initech LLC', email: 'hello@initech.com', phone: '+1-555-0300', address: '789 Pine Rd', city: 'Chicago', country: 'USA', createdAt: now },
    ];

    const products: Product[] = [
      { id: 'p1', name: 'Laptop Pro 15', sku: 'LP-001', category: 'Electronics', price: 1299.99, cost: 850.0, stock: 45, unit: 'pcs', description: 'High-performance laptop', createdAt: now },
      { id: 'p2', name: 'Wireless Mouse', sku: 'WM-002', category: 'Accessories', price: 49.99, cost: 18.0, stock: 200, unit: 'pcs', createdAt: now },
      { id: 'p3', name: 'USB-C Hub', sku: 'UH-003', category: 'Accessories', price: 79.99, cost: 30.0, stock: 150, unit: 'pcs', createdAt: now },
      { id: 'p4', name: 'Monitor 27"', sku: 'MN-004', category: 'Electronics', price: 399.99, cost: 250.0, stock: 30, unit: 'pcs', createdAt: now },
    ];

    const saleItems = [
      { productId: 'p1', productName: 'Laptop Pro 15', quantity: 2, unitPrice: 1299.99, discount: 5, total: 2469.98 },
      { productId: 'p2', productName: 'Wireless Mouse', quantity: 2, unitPrice: 49.99, discount: 0, total: 99.98 },
    ];

    const sales: Sale[] = [
      { id: 's1', orderNumber: 'ORD-2024-001', customerId: 'c1', customerName: 'Acme Corp', items: saleItems, subtotal: 2569.96, taxRate: 10, taxAmount: 256.99, discount: 0, total: 2826.95, status: 'delivered', paymentStatus: 'paid', paymentMethod: 'transfer', createdAt: now, updatedAt: now },
      { id: 's2', orderNumber: 'ORD-2024-002', customerId: 'c2', customerName: 'Globex Inc', items: [{ productId: 'p3', productName: 'USB-C Hub', quantity: 5, unitPrice: 79.99, discount: 10, total: 359.96 }], subtotal: 359.96, taxRate: 10, taxAmount: 36.0, discount: 0, total: 395.96, status: 'confirmed', paymentStatus: 'unpaid', paymentMethod: 'card', createdAt: now, updatedAt: now },
    ];

    const invoices: Invoice[] = [
      { id: 'i1', invoiceNumber: 'INV-2024-001', saleId: 's1', customerId: 'c1', customerName: 'Acme Corp', items: saleItems, subtotal: 2569.96, taxRate: 10, taxAmount: 256.99, discount: 0, total: 2826.95, amountPaid: 2826.95, amountDue: 0, status: 'paid', dueDate: new Date(Date.now() + 30 * 86400000).toISOString(), createdAt: now },
    ];

    const users: User[] = [
      { id: 'u1', name: 'Admin User', email: 'admin@tijara.app', role: 'admin', active: true, createdAt: now },
      { id: 'u2', name: 'Sales Manager', email: 'manager@tijara.app', role: 'manager', active: true, createdAt: now },
    ];

    return { customers, products, sales, invoices, users };
  }
}

/** Singleton repository instance */
export const repository = new ExcelRepository();
