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

import * as XLSX from 'xlsx-js-style';
import type { Customer, Product, Sale, Invoice, User, StockMovement, Supplier, Purchase, Return, Account, JournalEntry, FiscalPeriod, CostCenter, TaxRate, JournalTemplate } from '@core/types';
import type { ElectronAPI } from '../../electron/preload';

/** All data collections stored in the workbook */
export interface WorkbookData {
  customers: Customer[];
  products: Product[];
  sales: Sale[];
  invoices: Invoice[];
  users: User[];
  stockMovements: StockMovement[];
  suppliers: Supplier[];
  purchases: Purchase[];
  returns: Return[];
  accounts: Account[];
  journalEntries: JournalEntry[];
  fiscalPeriods: FiscalPeriod[];
  costCenters: CostCenter[];
  taxRates: TaxRate[];
  journalTemplates: JournalTemplate[];
}

const SHEET_NAMES = {
  customers: 'Customers',
  products: 'Products',
  sales: 'Sales',
  invoices: 'Invoices',
  users: 'Users',
  stockMovements: 'Stock Movements',
  suppliers: 'Suppliers',
  purchases: 'Purchases',
  returns: 'Returns',
  accounts: 'Accounts',
  journalEntries: 'Journal Entries',
  fiscalPeriods: 'Fiscal Periods',
  costCenters: 'Cost Centers',
  taxRates: 'Tax Rates',
  journalTemplates: 'Journal Templates',
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
    stockMovements: [],
    suppliers: [],
    purchases: [],
    returns: [],
    accounts: [],
    journalEntries: [],
    fiscalPeriods: [],
    costCenters: [],
    taxRates: [],
    journalTemplates: [],
  };

  private initialized = false;

  // ── Init ──────────────────────────────────────────────────────────────────

  /** Load persisted data; seed with demo data on first run */
  async init(): Promise<void> {
    if (this.initialized) return;

    const raw = await this.loadRaw();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<WorkbookData>;
        // Merge with defaults so any collection added after initial save
        // is always an array, never undefined (forward-compatibility guard).
        this.data = {
          customers:        Array.isArray(parsed.customers)        ? parsed.customers        : [],
          products:         Array.isArray(parsed.products)         ? parsed.products         : [],
          sales:            Array.isArray(parsed.sales)            ? parsed.sales            : [],
          invoices:         Array.isArray(parsed.invoices)         ? parsed.invoices         : [],
          users:            Array.isArray(parsed.users)            ? parsed.users            : [],
          stockMovements:   Array.isArray(parsed.stockMovements)   ? parsed.stockMovements   : [],
          suppliers:        Array.isArray(parsed.suppliers)        ? parsed.suppliers        : [],
          purchases:        Array.isArray(parsed.purchases)        ? parsed.purchases        : [],
          returns:          Array.isArray(parsed.returns)          ? parsed.returns          : [],
          accounts:         Array.isArray(parsed.accounts)         ? parsed.accounts         : [],
          journalEntries:   Array.isArray(parsed.journalEntries)   ? parsed.journalEntries   : [],
          fiscalPeriods:    Array.isArray(parsed.fiscalPeriods)    ? parsed.fiscalPeriods    : [],
          costCenters:      Array.isArray(parsed.costCenters)      ? parsed.costCenters      : [],
          taxRates:         Array.isArray(parsed.taxRates)         ? parsed.taxRates         : [],
          journalTemplates: Array.isArray(parsed.journalTemplates) ? parsed.journalTemplates : [],
        };

        // Patch products that predate the reorderPoint/reorderQuantity fields
        this.data.products = this.data.products.map((p) => ({
          ...p,
          reorderPoint:    p.reorderPoint    ?? 0,
          reorderQuantity: p.reorderQuantity ?? 0,
        }));
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

  /** Clear all data - reset to seed data and delete persisted storage */
  async clearAll(): Promise<void> {
    // Reset in-memory data to seed data
    this.data = this.getSeedData();
    
    // Clear localStorage
    localStorage.clear();
    
    // Clear Electron file storage if available
    const electron = getElectron();
    if (electron) {
      await electron.clearData();
    }
    
    // Persist the seed data
    await this.persist();
  }

  // ── Excel export ──────────────────────────────────────────────────────────

  /** Export all data to a beautifully styled Excel workbook */
  async exportToExcel(): Promise<void> {
    const profile = (() => {
      try {
        const raw = localStorage.getItem('tijara-profile');
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    })();
    const companyName: string = profile.name || 'Tijara';
    const currency: string    = profile.currency || 'USD';

    const wb = XLSX.utils.book_new();

    // Sheet configs: human-readable column headers + which fields to include
    const SHEET_CONFIGS: Record<keyof WorkbookData, { label: string; cols: { key: string; header: string; width: number; type?: 'currency' | 'date' | 'number' | 'text' }[] }> = {
      customers: {
        label: 'Customers',
        cols: [
          { key: 'name',      header: 'Name',         width: 28, type: 'text' },
          { key: 'email',     header: 'Email',        width: 30, type: 'text' },
          { key: 'phone',     header: 'Phone',        width: 18, type: 'text' },
          { key: 'address',   header: 'Address',      width: 30, type: 'text' },
          { key: 'city',      header: 'City',         width: 18, type: 'text' },
          { key: 'country',   header: 'Country',      width: 16, type: 'text' },
          { key: 'notes',     header: 'Notes',        width: 30, type: 'text' },
          { key: 'createdAt', header: 'Created',      width: 20, type: 'date' },
        ],
      },
      products: {
        label: 'Products',
        cols: [
          { key: 'name',            header: 'Name',            width: 28, type: 'text' },
          { key: 'sku',             header: 'SKU',             width: 14, type: 'text' },
          { key: 'category',        header: 'Category',        width: 18, type: 'text' },
          { key: 'price',           header: 'Selling Price',   width: 16, type: 'currency' },
          { key: 'cost',            header: 'Cost Price',      width: 14, type: 'currency' },
          { key: 'stock',           header: 'Stock',           width: 10, type: 'number' },
          { key: 'unit',            header: 'Unit',            width: 10, type: 'text' },
          { key: 'reorderPoint',    header: 'Reorder Point',   width: 14, type: 'number' },
          { key: 'reorderQuantity', header: 'Restock Qty',     width: 14, type: 'number' },
          { key: 'description',     header: 'Description',     width: 32, type: 'text' },
          { key: 'createdAt',       header: 'Created',         width: 20, type: 'date' },
        ],
      },
      sales: {
        label: 'Sales',
        cols: [
          { key: 'orderNumber',   header: 'Order #',        width: 18, type: 'text' },
          { key: 'customerName',  header: 'Customer',       width: 24, type: 'text' },
          { key: 'subtotal',      header: 'Subtotal',       width: 14, type: 'currency' },
          { key: 'taxRate',       header: 'Tax %',          width: 10, type: 'number' },
          { key: 'taxAmount',     header: 'Tax Amount',     width: 14, type: 'currency' },
          { key: 'discount',      header: 'Discount',       width: 12, type: 'currency' },
          { key: 'total',         header: 'Total',          width: 14, type: 'currency' },
          { key: 'status',        header: 'Status',         width: 14, type: 'text' },
          { key: 'paymentStatus', header: 'Payment',        width: 14, type: 'text' },
          { key: 'paymentMethod', header: 'Method',         width: 14, type: 'text' },
          { key: 'notes',         header: 'Notes',          width: 28, type: 'text' },
          { key: 'createdAt',     header: 'Date',           width: 20, type: 'date' },
        ],
      },
      invoices: {
        label: 'Invoices',
        cols: [
          { key: 'invoiceNumber', header: 'Invoice #',    width: 18, type: 'text' },
          { key: 'customerName',  header: 'Customer',     width: 24, type: 'text' },
          { key: 'subtotal',      header: 'Subtotal',     width: 14, type: 'currency' },
          { key: 'taxAmount',     header: 'Tax',          width: 12, type: 'currency' },
          { key: 'discount',      header: 'Discount',     width: 12, type: 'currency' },
          { key: 'total',         header: 'Total',        width: 14, type: 'currency' },
          { key: 'amountPaid',    header: 'Paid',         width: 14, type: 'currency' },
          { key: 'amountDue',     header: 'Balance Due',  width: 14, type: 'currency' },
          { key: 'status',        header: 'Status',       width: 14, type: 'text' },
          { key: 'dueDate',       header: 'Due Date',     width: 20, type: 'date' },
          { key: 'createdAt',     header: 'Created',      width: 20, type: 'date' },
        ],
      },
      purchases: {
        label: 'Purchases',
        cols: [
          { key: 'poNumber',      header: 'PO #',          width: 18, type: 'text' },
          { key: 'supplierName',  header: 'Supplier',      width: 24, type: 'text' },
          { key: 'subtotal',      header: 'Subtotal',      width: 14, type: 'currency' },
          { key: 'taxAmount',     header: 'Tax',           width: 12, type: 'currency' },
          { key: 'shippingCost',  header: 'Shipping',      width: 12, type: 'currency' },
          { key: 'total',         header: 'Total',         width: 14, type: 'currency' },
          { key: 'amountPaid',    header: 'Paid',          width: 14, type: 'currency' },
          { key: 'status',        header: 'Status',        width: 14, type: 'text' },
          { key: 'paymentStatus', header: 'Payment',       width: 14, type: 'text' },
          { key: 'paymentMethod', header: 'Method',        width: 14, type: 'text' },
          { key: 'expectedDate',  header: 'Expected Date', width: 20, type: 'date' },
          { key: 'createdAt',     header: 'Date',          width: 20, type: 'date' },
        ],
      },
      suppliers: {
        label: 'Suppliers',
        cols: [
          { key: 'name',          header: 'Company',        width: 28, type: 'text' },
          { key: 'contactPerson', header: 'Contact Person', width: 22, type: 'text' },
          { key: 'email',         header: 'Email',          width: 28, type: 'text' },
          { key: 'phone',         header: 'Phone',          width: 18, type: 'text' },
          { key: 'address',       header: 'Address',        width: 28, type: 'text' },
          { key: 'city',          header: 'City',           width: 16, type: 'text' },
          { key: 'country',       header: 'Country',        width: 16, type: 'text' },
          { key: 'taxId',         header: 'Tax ID',         width: 16, type: 'text' },
          { key: 'website',       header: 'Website',        width: 28, type: 'text' },
          { key: 'notes',         header: 'Notes',          width: 30, type: 'text' },
          { key: 'createdAt',     header: 'Created',        width: 20, type: 'date' },
        ],
      },
      stockMovements: {
        label: 'Stock Movements',
        cols: [
          { key: 'productName', header: 'Product',     width: 28, type: 'text' },
          { key: 'type',        header: 'Type',        width: 14, type: 'text' },
          { key: 'quantity',    header: 'Qty Change',  width: 12, type: 'number' },
          { key: 'stockBefore', header: 'Before',      width: 10, type: 'number' },
          { key: 'stockAfter',  header: 'After',       width: 10, type: 'number' },
          { key: 'reference',   header: 'Reference',   width: 18, type: 'text' },
          { key: 'notes',       header: 'Notes',       width: 30, type: 'text' },
          { key: 'createdAt',   header: 'Date',        width: 20, type: 'date' },
        ],
      },
      users: {
        label: 'Users',
        cols: [
          { key: 'name',         header: 'Name',          width: 24, type: 'text' },
          { key: 'email',        header: 'Email',         width: 30, type: 'text' },
          { key: 'role',         header: 'Role',          width: 14, type: 'text' },
          { key: 'passwordHash', header: 'Password Hash', width: 70, type: 'text' },
          { key: 'active',       header: 'Active',        width: 10, type: 'text' },
          { key: 'lastLogin',    header: 'Last Login',    width: 20, type: 'date' },
          { key: 'createdAt',    header: 'Created',       width: 20, type: 'date' },
        ],
      },
      returns: {
        label: 'Returns',
        cols: [
          { key: 'returnNumber',  header: 'Return #',      width: 18, type: 'text' },
          { key: 'orderNumber',   header: 'Order #',       width: 18, type: 'text' },
          { key: 'customerName',  header: 'Customer',      width: 24, type: 'text' },
          { key: 'subtotal',      header: 'Subtotal',      width: 14, type: 'currency' },
          { key: 'taxAmount',     header: 'Tax',           width: 12, type: 'currency' },
          { key: 'refundAmount',  header: 'Refund Amount', width: 16, type: 'currency' },
          { key: 'reason',        header: 'Reason',        width: 22, type: 'text' },
          { key: 'status',        header: 'Status',        width: 14, type: 'text' },
          { key: 'refundMethod',  header: 'Refund Method', width: 16, type: 'text' },
          { key: 'restockItems',  header: 'Restocked',     width: 12, type: 'text' },
          { key: 'notes',         header: 'Notes',         width: 30, type: 'text' },
          { key: 'createdAt',     header: 'Date',          width: 20, type: 'date' },
        ],
      },
      accounts: {
        label: 'Accounts',
        cols: [
          { key: 'code',          header: 'Code',          width: 12, type: 'text' },
          { key: 'name',          header: 'Name',          width: 30, type: 'text' },
          { key: 'type',          header: 'Type',          width: 14, type: 'text' },
          { key: 'category',      header: 'Category',      width: 22, type: 'text' },
          { key: 'normalBalance', header: 'Normal Balance',width: 16, type: 'text' },
          { key: 'isActive',      header: 'Active',        width: 10, type: 'text' },
          { key: 'isSystem',      header: 'System',        width: 10, type: 'text' },
          { key: 'createdAt',     header: 'Created',       width: 20, type: 'date' },
        ],
      },
      journalEntries: {
        label: 'Journal Entries',
        cols: [
          { key: 'entryNumber',   header: 'Entry #',       width: 18, type: 'text' },
          { key: 'date',          header: 'Date',          width: 20, type: 'date' },
          { key: 'description',   header: 'Description',   width: 32, type: 'text' },
          { key: 'reference',     header: 'Reference',     width: 18, type: 'text' },
          { key: 'sourceType',    header: 'Source',        width: 18, type: 'text' },
          { key: 'totalDebit',    header: 'Total Debit',   width: 16, type: 'currency' },
          { key: 'totalCredit',   header: 'Total Credit',  width: 16, type: 'currency' },
          { key: 'status',        header: 'Status',        width: 12, type: 'text' },
          { key: 'createdAt',     header: 'Created',       width: 20, type: 'date' },
        ],
      },
      fiscalPeriods: {
        label: 'Fiscal Periods',
        cols: [
          { key: 'name',          header: 'Name',          width: 24, type: 'text' },
          { key: 'startDate',     header: 'Start Date',    width: 20, type: 'date' },
          { key: 'endDate',       header: 'End Date',      width: 20, type: 'date' },
          { key: 'status',        header: 'Status',        width: 12, type: 'text' },
          { key: 'isCurrent',     header: 'Current',       width: 10, type: 'text' },
          { key: 'createdAt',     header: 'Created',       width: 20, type: 'date' },
        ],
      },
      costCenters: {
        label: 'Cost Centers',
        cols: [
          { key: 'code',          header: 'Code',          width: 12, type: 'text' },
          { key: 'name',          header: 'Name',          width: 28, type: 'text' },
          { key: 'description',   header: 'Description',   width: 32, type: 'text' },
          { key: 'isActive',      header: 'Active',        width: 10, type: 'text' },
          { key: 'createdAt',     header: 'Created',       width: 20, type: 'date' },
        ],
      },
      taxRates: {
        label: 'Tax Rates',
        cols: [
          { key: 'name',          header: 'Name',          width: 24, type: 'text' },
          { key: 'code',          header: 'Code',          width: 12, type: 'text' },
          { key: 'rate',          header: 'Rate %',        width: 10, type: 'number' },
          { key: 'isDefault',     header: 'Default',       width: 10, type: 'text' },
          { key: 'isActive',      header: 'Active',        width: 10, type: 'text' },
          { key: 'createdAt',     header: 'Created',       width: 20, type: 'date' },
        ],
      },
    };

    // ── Design tokens (matching CSS variables) ──────────────────────────────
    const C = {
      primary:        '9929EA', // --color-primary
      primaryDark:    '7A1FC0', // --color-primary-dark
      primaryLight:   'CC66DA', // --color-primary-light
      primarySubtle:  'F0E6FD', // light tint of primary
      white:          'FFFFFF',
      bgSecondary:    'F0EEFF', // --color-bg-secondary (light)
      border:         'E5E0F5', // --color-border
      textPrimary:    '0F0A1E', // --color-text-primary
      textSecondary:  '5A5070', // --color-text-secondary
      textTertiary:   '9B92B0', // --color-text-tertiary
      success:        '22C55E',
      successSubtle:  'DCFCE7',
      warning:        'F59E0B',
      warningSubtle:  'FEF3C7',
      error:          'EF4444',
      errorSubtle:    'FEE2E2',
      info:           '3B82F6',
      infoSubtle:     'DBEAFE',
      rowAlt:         'FAF8FF', // very light purple tint for alternating rows
    };

    // ── Style factories ─────────────────────────────────────────────────────
    const font = (bold = false, size = 11, color = C.textPrimary, italic = false) => ({
      name: 'Calibri', sz: size, bold, italic,
      color: { rgb: color },
    });

    const fill = (rgb: string) => ({ patternType: 'solid' as const, fgColor: { rgb } });

    const border = (color = C.border) => {
      const side = { style: 'thin' as const, color: { rgb: color } };
      return { top: side, bottom: side, left: side, right: side };
    };

    const thickBottomBorder = (color = C.primaryDark) => ({
      top:    { style: 'thin'   as const, color: { rgb: C.border } },
      bottom: { style: 'medium' as const, color: { rgb: color } },
      left:   { style: 'thin'   as const, color: { rgb: C.border } },
      right:  { style: 'thin'   as const, color: { rgb: C.border } },
    });

    const align = (h: 'left' | 'center' | 'right' = 'left', wrap = false) => ({
      horizontal: h, vertical: 'center' as const, wrapText: wrap,
    });

    // Status badge colors
    const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
      // Sales
      pending:   { bg: C.warningSubtle, fg: C.warning },
      confirmed: { bg: C.infoSubtle,    fg: C.info },
      shipped:   { bg: 'EDE9FE',        fg: '7C3AED' },
      delivered: { bg: C.successSubtle, fg: C.success },
      cancelled: { bg: 'F3F4F6',        fg: '6B7280' },
      // Invoices / Purchases
      draft:     { bg: 'F3F4F6',        fg: '6B7280' },
      sent:      { bg: C.infoSubtle,    fg: C.info },
      paid:      { bg: C.successSubtle, fg: C.success },
      overdue:   { bg: C.errorSubtle,   fg: C.error },
      ordered:   { bg: C.infoSubtle,    fg: C.info },
      received:  { bg: C.successSubtle, fg: C.success },
      // Payment
      unpaid:    { bg: C.errorSubtle,   fg: C.error },
      partial:   { bg: C.warningSubtle, fg: C.warning },
      // Returns
      approved:  { bg: C.successSubtle, fg: C.success },
      rejected:  { bg: C.errorSubtle,   fg: C.error },
      refunded:  { bg: 'EDE9FE',        fg: '7C3AED' },
      // Boolean
      true:      { bg: C.successSubtle, fg: C.success },
      false:     { bg: C.errorSubtle,   fg: C.error },
    };

    const now = new Date();
    const exportDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    for (const [key, config] of Object.entries(SHEET_CONFIGS)) {
      const collection = key as keyof WorkbookData;
      const rows = (this.data[collection] as unknown) as Record<string, unknown>[];
      const { cols } = config;
      const numCols = cols.length;

      // ── Build AOA (array of arrays) ───────────────────────────────────────
      // Row 0: Company banner
      // Row 1: Sheet title + export date
      // Row 2: empty spacer
      // Row 3: column headers
      // Row 4+: data rows

      const HEADER_ROW = 3; // 0-indexed
      const DATA_START  = 4;

      const aoa: unknown[][] = [
        [companyName, ...Array(numCols - 1).fill('')],                          // row 0 – banner
        [config.label, ...Array(numCols - 2).fill(''), `Exported: ${exportDate}`], // row 1 – title
        Array(numCols).fill(''),                                                 // row 2 – spacer
        cols.map((c) => c.header),                                               // row 3 – headers
        ...(rows.length === 0
          ? [['No data available', ...Array(numCols - 1).fill('')]]
          : rows.map((row) =>
              cols.map((c) => {
                const v = row[c.key];
                if (v === undefined || v === null) return '';
                if (c.type === 'date' && typeof v === 'string' && v) {
                  try { return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
                  catch { return v; }
                }
                if (typeof v === 'boolean') return v ? 'Yes' : 'No';
                if (typeof v === 'object') return JSON.stringify(v);
                return v;
              })
            )),
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // ── Column widths ─────────────────────────────────────────────────────
      ws['!cols'] = cols.map((c) => ({ wch: c.width }));

      // ── Row heights ───────────────────────────────────────────────────────
      ws['!rows'] = [
        { hpt: 36 }, // row 0 – banner
        { hpt: 28 }, // row 1 – title
        { hpt: 8  }, // row 2 – spacer
        { hpt: 22 }, // row 3 – headers
        ...Array(Math.max(rows.length, 1)).fill({ hpt: 20 }), // data rows
      ];

      // ── Merge banner across all columns ───────────────────────────────────
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } }, // banner
        { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 3 } }, // sheet title (leave last 2 cols for date)
      ];

      // ── Apply cell styles ─────────────────────────────────────────────────
      const totalRows = aoa.length;

      for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < numCols; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!ws[addr]) ws[addr] = { t: 's', v: '' };

          // ── Banner row (company name) ──────────────────────────────────
          if (r === 0) {
            ws[addr].s = {
              font: font(true, 18, C.white),
              fill: fill(C.primary),
              alignment: align(c === 0 ? 'left' : 'center'),
              border: { bottom: { style: 'medium' as const, color: { rgb: C.primaryDark } } },
            };
            continue;
          }

          // ── Title row ─────────────────────────────────────────────────
          if (r === 1) {
            const isDateCell = c === numCols - 1;
            ws[addr].s = {
              font: font(c === 0, isDateCell ? 10 : 14, isDateCell ? C.textTertiary : C.primaryDark),
              fill: fill(C.primarySubtle),
              alignment: align(isDateCell ? 'right' : 'left'),
              border: { bottom: { style: 'thin' as const, color: { rgb: C.border } } },
            };
            continue;
          }

          // ── Spacer row ────────────────────────────────────────────────
          if (r === 2) {
            ws[addr].s = { fill: fill(C.white), border: {} };
            continue;
          }

          // ── Header row ────────────────────────────────────────────────
          if (r === HEADER_ROW) {
            ws[addr].s = {
              font: font(true, 10, C.white),
              fill: fill(C.primaryDark),
              alignment: align('center'),
              border: thickBottomBorder(),
            };
            continue;
          }

          // ── Data rows ─────────────────────────────────────────────────
          const dataRowIdx = r - DATA_START;
          const isAlt      = dataRowIdx % 2 === 1;
          const colDef     = cols[c];
          const cellVal    = ws[addr].v;

          // Base style
          const baseStyle = {
            font: font(false, 10, C.textPrimary),
            fill: fill(isAlt ? C.rowAlt : C.white),
            alignment: align(
              colDef?.type === 'currency' || colDef?.type === 'number' ? 'right' : 'left',
              false
            ),
            border: border(),
          };

          // Status / badge columns — colorize
          const statusKey = typeof cellVal === 'string' ? cellVal.toLowerCase() : '';
          const isStatusCol = colDef?.key === 'status' || colDef?.key === 'paymentStatus' || colDef?.key === 'active';
          if (isStatusCol && STATUS_COLORS[statusKey]) {
            const sc = STATUS_COLORS[statusKey];
            ws[addr].s = {
              ...baseStyle,
              font: font(true, 10, sc.fg),
              fill: fill(sc.bg),
              alignment: align('center'),
            };
            continue;
          }

          // Currency columns — bold value, right-aligned
          if (colDef?.type === 'currency' && typeof cellVal === 'number') {
            ws[addr].s = {
              ...baseStyle,
              font: font(true, 10, C.textPrimary),
              alignment: align('right'),
            };
            // Apply number format
            ws[addr].z = `"${this._getCurrencySymbol(currency)}"#,##0.00`;
            continue;
          }

          // Number columns
          if (colDef?.type === 'number') {
            ws[addr].s = { ...baseStyle, alignment: align('right') };
            continue;
          }

          // Date columns — muted color
          if (colDef?.type === 'date') {
            ws[addr].s = { ...baseStyle, font: font(false, 10, C.textSecondary) };
            continue;
          }

          // First column (name/identifier) — slightly bolder
          if (c === 0 && rows.length > 0) {
            ws[addr].s = { ...baseStyle, font: font(true, 10, C.textPrimary) };
            continue;
          }

          ws[addr].s = baseStyle;
        }
      }

      // ── Empty-data row style ──────────────────────────────────────────────
      if (rows.length === 0) {
        const addr = XLSX.utils.encode_cell({ r: DATA_START, c: 0 });
        if (ws[addr]) {
          ws[addr].s = {
            font: font(false, 11, C.textTertiary, true),
            fill: fill(C.white),
            alignment: align('center'),
            border: border(),
          };
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, config.label);
    }

    // ── Write & deliver ───────────────────────────────────────────────────
    const electron = getElectron();
    if (electron) {
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true }) as ArrayBuffer;
      await electron.exportExcel(buf);
    } else {
      XLSX.writeFile(wb, 'tijara-data.xlsx', { cellStyles: true });
    }
  }

  /** Derive a simple currency symbol from an ISO code */
  private _getCurrencySymbol(code: string): string {
    try {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency', currency: code,
        minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(0);
      return formatted.replace(/[\d\s,.']/g, '').trim() || code;
    } catch { return code; }
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

    // Only seed users - admin account for initial setup
    const users: User[] = [
      { id: 'u1', name: 'Admin User', email: 'admin@tijara.app', passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', role: 'admin', active: true, createdAt: now },
    ];

    return {
      customers: [],
      products: [],
      sales: [],
      invoices: [],
      users,
      stockMovements: [],
      suppliers: [],
      purchases: [],
      returns: [],
      accounts: [],
      journalEntries: [],
      fiscalPeriods: [],
      costCenters: [],
      taxRates: [],
      journalTemplates: [],
    };
  }
}

/** Singleton repository instance */
export const repository = new ExcelRepository();
