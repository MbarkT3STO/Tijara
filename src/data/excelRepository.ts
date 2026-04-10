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
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString();

    // ── Accounting seed data ──────────────────────────────────────────────
    const accounts: import('@core/types').Account[] = [
      { id: 'acc-1000', code: '1000', name: 'Cash and Cash Equivalents', nameAr: 'النقد وما يعادله', nameFr: 'Trésorerie et équivalents', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-1100', code: '1100', name: 'Accounts Receivable', nameAr: 'الذمم المدينة', nameFr: 'Créances clients', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-1200', code: '1200', name: 'Inventory', nameAr: 'المخزون', nameFr: 'Stocks', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-1300', code: '1300', name: 'Prepaid Expenses', nameAr: 'المصروفات المدفوعة مقدماً', nameFr: 'Charges payées d\'avance', type: 'asset', category: 'current_asset', normalBalance: 'debit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-1500', code: '1500', name: 'Property and Equipment', nameAr: 'الممتلكات والمعدات', nameFr: 'Immobilisations corporelles', type: 'asset', category: 'fixed_asset', normalBalance: 'debit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-1510', code: '1510', name: 'Accumulated Depreciation', nameAr: 'مجمع الاستهلاك', nameFr: 'Amortissements cumulés', type: 'asset', category: 'fixed_asset', normalBalance: 'credit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-2000', code: '2000', name: 'Accounts Payable', nameAr: 'الذمم الدائنة', nameFr: 'Fournisseurs', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-2100', code: '2100', name: 'Accrued Liabilities', nameAr: 'الالتزامات المستحقة', nameFr: 'Charges à payer', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-2200', code: '2200', name: 'Tax Payable', nameAr: 'ضريبة القيمة المضافة المستحقة', nameFr: 'TVA à payer', type: 'liability', category: 'current_liability', normalBalance: 'credit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-2500', code: '2500', name: 'Long-term Debt', nameAr: 'الديون طويلة الأجل', nameFr: 'Dettes à long terme', type: 'liability', category: 'long_term_liability', normalBalance: 'credit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-3000', code: '3000', name: 'Owner\'s Equity', nameAr: 'حقوق الملكية', nameFr: 'Capitaux propres', type: 'equity', category: 'owners_equity', normalBalance: 'credit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-3100', code: '3100', name: 'Retained Earnings', nameAr: 'الأرباح المحتجزة', nameFr: 'Bénéfices non distribués', type: 'equity', category: 'retained_earnings', normalBalance: 'credit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-4000', code: '4000', name: 'Sales Revenue', nameAr: 'إيرادات المبيعات', nameFr: 'Chiffre d\'affaires', type: 'revenue', category: 'operating_revenue', normalBalance: 'credit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-4100', code: '4100', name: 'Other Income', nameAr: 'إيرادات أخرى', nameFr: 'Autres produits', type: 'revenue', category: 'other_revenue', normalBalance: 'credit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-5000', code: '5000', name: 'Cost of Goods Sold', nameAr: 'تكلفة البضاعة المباعة', nameFr: 'Coût des marchandises vendues', type: 'expense', category: 'cost_of_goods_sold', normalBalance: 'debit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-6000', code: '6000', name: 'Salaries Expense', nameAr: 'مصروف الرواتب', nameFr: 'Charges de personnel', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-6100', code: '6100', name: 'Rent Expense', nameAr: 'مصروف الإيجار', nameFr: 'Charges de loyer', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-6200', code: '6200', name: 'Utilities Expense', nameAr: 'مصروف المرافق', nameFr: 'Charges de services', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-6300', code: '6300', name: 'Marketing Expense', nameAr: 'مصروف التسويق', nameFr: 'Charges marketing', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-6400', code: '6400', name: 'Depreciation Expense', nameAr: 'مصروف الاستهلاك', nameFr: 'Dotations aux amortissements', type: 'expense', category: 'operating_expense', normalBalance: 'debit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-7000', code: '7000', name: 'Interest Expense', nameAr: 'مصروف الفوائد', nameFr: 'Charges financières', type: 'expense', category: 'other_expense', normalBalance: 'debit', isSystem: true, isActive: true, createdAt: now },
      { id: 'acc-7100', code: '7100', name: 'Tax Expense', nameAr: 'مصروف الضريبة', nameFr: 'Charge d\'impôt', type: 'expense', category: 'tax_expense', normalBalance: 'debit', isSystem: true, isActive: true, createdAt: now },
    ];

    const fiscalPeriods: import('@core/types').FiscalPeriod[] = [
      {
        id: 'fp-current',
        name: `${today.toLocaleString('en-US', { month: 'long' })} ${today.getFullYear()}`,
        startDate: monthStart,
        endDate: monthEnd,
        status: 'open',
        isCurrent: true,
        createdAt: now,
      },
    ];

    const taxRates: import('@core/types').TaxRate[] = [
      { id: 'tr-1', name: 'Standard VAT', code: 'VAT', rate: 10, accountId: 'acc-2200', isDefault: true, isActive: true, createdAt: now },
    ];

    // Sample journal entries
    const journalEntries: import('@core/types').JournalEntry[] = [
      {
        id: 'je-1', entryNumber: 'JE-2024-0001', date: now, description: 'Sale to Acme Corp',
        reference: 'ORD-2024-001', sourceType: 'sale', sourceId: 's1',
        lines: [
          { id: 'jl-1a', accountId: 'acc-1100', accountCode: '1100', accountName: 'Accounts Receivable', debit: 2826.95, credit: 0 },
          { id: 'jl-1b', accountId: 'acc-4000', accountCode: '4000', accountName: 'Sales Revenue', debit: 0, credit: 2569.96 },
          { id: 'jl-1c', accountId: 'acc-2200', accountCode: '2200', accountName: 'Tax Payable', debit: 0, credit: 256.99 },
        ],
        totalDebit: 2826.95, totalCredit: 2826.95, status: 'posted',
        fiscalPeriodId: 'fp-current', createdAt: now, updatedAt: now,
      },
      {
        id: 'je-2', entryNumber: 'JE-2024-0002', date: now, description: 'Payment received from Acme Corp',
        reference: 'INV-2024-001', sourceType: 'invoice_payment', sourceId: 'i1',
        lines: [
          { id: 'jl-2a', accountId: 'acc-1000', accountCode: '1000', accountName: 'Cash and Cash Equivalents', debit: 2826.95, credit: 0 },
          { id: 'jl-2b', accountId: 'acc-1100', accountCode: '1100', accountName: 'Accounts Receivable', debit: 0, credit: 2826.95 },
        ],
        totalDebit: 2826.95, totalCredit: 2826.95, status: 'posted',
        fiscalPeriodId: 'fp-current', createdAt: now, updatedAt: now,
      },
      {
        id: 'je-3', entryNumber: 'JE-2024-0003', date: now, description: 'Monthly salaries',
        sourceType: 'manual',
        lines: [
          { id: 'jl-3a', accountId: 'acc-6000', accountCode: '6000', accountName: 'Salaries Expense', debit: 5000, credit: 0 },
          { id: 'jl-3b', accountId: 'acc-1000', accountCode: '1000', accountName: 'Cash and Cash Equivalents', debit: 0, credit: 5000 },
        ],
        totalDebit: 5000, totalCredit: 5000, status: 'posted',
        fiscalPeriodId: 'fp-current', createdAt: now, updatedAt: now,
      },
    ];

    const customers: Customer[] = [
      { id: 'c1', name: 'Acme Corp', email: 'contact@acme.com', phone: '+1-555-0100', address: '123 Main St', city: 'New York', country: 'USA', createdAt: now, notes: 'Key account' },
      { id: 'c2', name: 'Globex Inc', email: 'info@globex.com', phone: '+1-555-0200', address: '456 Oak Ave', city: 'Los Angeles', country: 'USA', createdAt: now },
      { id: 'c3', name: 'Initech LLC', email: 'hello@initech.com', phone: '+1-555-0300', address: '789 Pine Rd', city: 'Chicago', country: 'USA', createdAt: now },
    ];

    const products: Product[] = [
      { id: 'p1', name: 'Laptop Pro 15', sku: 'LP-001', category: 'Electronics', price: 1299.99, cost: 850.0, stock: 45, unit: 'pcs', description: 'High-performance laptop', reorderPoint: 10, reorderQuantity: 20, createdAt: now },
      { id: 'p2', name: 'Wireless Mouse', sku: 'WM-002', category: 'Accessories', price: 49.99, cost: 18.0, stock: 200, unit: 'pcs', reorderPoint: 30, reorderQuantity: 100, createdAt: now },
      { id: 'p3', name: 'USB-C Hub', sku: 'UH-003', category: 'Accessories', price: 79.99, cost: 30.0, stock: 150, unit: 'pcs', reorderPoint: 20, reorderQuantity: 50, createdAt: now },
      { id: 'p4', name: 'Monitor 27"', sku: 'MN-004', category: 'Electronics', price: 399.99, cost: 250.0, stock: 30, unit: 'pcs', reorderPoint: 5, reorderQuantity: 15, createdAt: now },
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
      { id: 'u1', name: 'Admin User', email: 'admin@tijara.app', passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', role: 'admin', active: true, createdAt: now },
      { id: 'u2', name: 'Sales Manager', email: 'manager@tijara.app', passwordHash: '866485796cfa8d7c0cf7111640205b83076433547577511d81f8030ae99ecea5', role: 'manager', active: true, createdAt: now },
    ];

    const seedJournalTemplates: import('@core/types').JournalTemplate[] = [
      {
        id: 'jt-payroll',
        name: 'Monthly Salaries',
        description: 'Monthly payroll entry',
        lines: [
          { accountId: 'acc-6000', accountCode: '6000', accountName: 'Salaries Expense', debit: 0, credit: 0 },
          { accountId: 'acc-2100', accountCode: '2100', accountName: 'Accrued Liabilities', debit: 0, credit: 0 },
        ],
        createdAt: now,
      },
      {
        id: 'jt-depreciation',
        name: 'Monthly Depreciation',
        description: 'Monthly depreciation entry',
        lines: [
          { accountId: 'acc-6400', accountCode: '6400', accountName: 'Depreciation Expense', debit: 0, credit: 0 },
          { accountId: 'acc-1510', accountCode: '1510', accountName: 'Accumulated Depreciation', debit: 0, credit: 0 },
        ],
        createdAt: now,
      },
      {
        id: 'jt-rent',
        name: 'Monthly Rent',
        description: 'Monthly rent payment',
        lines: [
          { accountId: 'acc-6100', accountCode: '6100', accountName: 'Rent Expense', debit: 0, credit: 0 },
          { accountId: 'acc-1000', accountCode: '1000', accountName: 'Cash and Cash Equivalents', debit: 0, credit: 0 },
        ],
        createdAt: now,
      },
    ];

    return { customers, products, sales, invoices, users, stockMovements: [], suppliers: [], purchases: [], returns: [], accounts, journalEntries, fiscalPeriods, costCenters: [], taxRates, journalTemplates: seedJournalTemplates };
  }
}

/** Singleton repository instance */
export const repository = new ExcelRepository();
