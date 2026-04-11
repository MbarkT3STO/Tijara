/**
 * Electron main process.
 * Creates the BrowserWindow, handles IPC for file system operations,
 * and manages the application lifecycle.
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  nativeTheme,
  Menu,
  MenuItemConstructorOptions,
} from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

// ── Constants ────────────────────────────────────────────────────────────────

const IS_DEV = !app.isPackaged;
const DATA_DIR = join(app.getPath('userData'), 'tijara');
const DATA_FILE = join(DATA_DIR, 'data.json');
const SQLITE_FILE = join(DATA_DIR, 'tijara.db');

// ── SQLite connection (lazy, opened on first use) ─────────────────────────────

let _db: DatabaseType | null = null;

function getDb(): DatabaseType {
  if (_db) return _db;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  _db = new Database(SQLITE_FILE);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('synchronous = NORMAL');

  // Detect stale schema (old single-table 'collections' design) and wipe it
  // so the new 16-table schema is created cleanly.
  const hasOldSchema = _db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type='table' AND name='collections'`
  ).get();
  if (hasOldSchema) {
    console.log('[main] Detected old collections schema — dropping and recreating');
    const tables = (_db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[])
      .map((r) => r.name)
      .filter((n) => n !== 'sqlite_sequence');
    for (const t of tables) _db.prepare(`DROP TABLE IF EXISTS "${t}"`).run();
  }

  initSchema(_db);
  return _db;
}

/**
 * Create all 16 collection tables.
 * Scalar fields get proper columns; nested arrays (items/lines) stay as JSON TEXT.
 * All tables share the same id TEXT PRIMARY KEY pattern.
 */
function initSchema(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      sku TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '',
      description TEXT,
      reorder_point REAL NOT NULL DEFAULT 0,
      reorder_quantity REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL DEFAULT '',
      customer_id TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL DEFAULT '',
      items TEXT NOT NULL DEFAULT '[]',
      subtotal REAL NOT NULL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      payment_method TEXT NOT NULL DEFAULT 'cash',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL DEFAULT '',
      sale_id TEXT NOT NULL DEFAULT '',
      customer_id TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL DEFAULT '',
      items TEXT NOT NULL DEFAULT '[]',
      subtotal REAL NOT NULL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      amount_due REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      due_date TEXT NOT NULL DEFAULT '',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'viewer',
      avatar TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      last_login TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'adjustment',
      quantity REAL NOT NULL DEFAULT 0,
      stock_before REAL NOT NULL DEFAULT 0,
      stock_after REAL NOT NULL DEFAULT 0,
      reference TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      contact_person TEXT NOT NULL DEFAULT '',
      tax_id TEXT,
      website TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      po_number TEXT NOT NULL DEFAULT '',
      supplier_id TEXT NOT NULL DEFAULT '',
      supplier_name TEXT NOT NULL DEFAULT '',
      items TEXT NOT NULL DEFAULT '[]',
      subtotal REAL NOT NULL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      shipping_cost REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      payment_method TEXT NOT NULL DEFAULT 'cash',
      expected_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      return_number TEXT NOT NULL DEFAULT '',
      sale_id TEXT NOT NULL DEFAULT '',
      order_number TEXT NOT NULL DEFAULT '',
      customer_id TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL DEFAULT '',
      items TEXT NOT NULL DEFAULT '[]',
      subtotal REAL NOT NULL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      refund_amount REAL NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT 'other',
      status TEXT NOT NULL DEFAULT 'pending',
      refund_method TEXT NOT NULL DEFAULT 'cash',
      restock_items INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      name_ar TEXT,
      name_fr TEXT,
      type TEXT NOT NULL DEFAULT 'asset',
      category TEXT NOT NULL DEFAULT 'current_asset',
      normal_balance TEXT NOT NULL DEFAULT 'debit',
      parent_id TEXT,
      description TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      cost_center_id TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      entry_number TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      reference TEXT,
      source_type TEXT NOT NULL DEFAULT 'manual',
      source_id TEXT,
      lines TEXT NOT NULL DEFAULT '[]',
      total_debit REAL NOT NULL DEFAULT 0,
      total_credit REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      reversal_entry_id TEXT,
      posted_at TEXT,
      posted_by TEXT,
      fiscal_period_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS fiscal_periods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL DEFAULT '',
      end_date TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      is_current INTEGER NOT NULL DEFAULT 0,
      closed_at TEXT,
      closed_by TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS cost_centers (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      description TEXT,
      parent_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS tax_rates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      code TEXT NOT NULL DEFAULT '',
      rate REAL NOT NULL DEFAULT 0,
      account_id TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS journal_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      lines TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS product_cost_history (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL DEFAULT '',
      old_cost REAL NOT NULL DEFAULT 0,
      new_cost REAL NOT NULL DEFAULT 0,
      changed_at TEXT NOT NULL DEFAULT '',
      changed_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sales_customer_id       ON sales(customer_id);
    CREATE INDEX IF NOT EXISTS idx_sales_created_at        ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_invoices_customer_id    ON invoices(customer_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status         ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_journal_entries_date    ON journal_entries(date);
    CREATE INDEX IF NOT EXISTS idx_journal_entries_status  ON journal_entries(status);
    CREATE INDEX IF NOT EXISTS idx_journal_entries_period  ON journal_entries(fiscal_period_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_accounts_code           ON accounts(code);
    CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id   ON purchases(supplier_id);
  `);
}

// ── Window management ────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Tijara',
    icon: join(__dirname, '../../public/icons/icon-512.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0614' : '#f8f7ff',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false, // show after ready-to-show for smooth startup
  });

  // Load the app
  if (IS_DEV) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Show window gracefully once content is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  buildMenu();
}

// ── Application menu ─────────────────────────────────────────────────────────

function buildMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Export to Excel…',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('menu:export'),
        },
        {
          label: 'Import from Excel…',
          accelerator: 'CmdOrCtrl+I',
          click: () => mainWindow?.webContents.send('menu:import'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        ...(IS_DEV ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

/** Read persisted JSON data from disk */
ipcMain.handle('data:read', (): string | null => {
  try {
    if (existsSync(DATA_FILE)) {
      return readFileSync(DATA_FILE, 'utf-8');
    }
    return null;
  } catch (err) {
    console.error('[main] data:read error', err);
    return null;
  }
});

/** Write JSON data to disk */
ipcMain.handle('data:write', (_event, json: string): boolean => {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(DATA_FILE, json, 'utf-8');
    return true;
  } catch (err) {
    console.error('[main] data:write error', err);
    return false;
  }
});

/** Show save dialog and write Excel file */
ipcMain.handle('excel:export', async (_event, buffer: ArrayBuffer): Promise<boolean> => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
    title: 'Export Tijara Data',
    defaultPath: join(app.getPath('documents'), 'tijara-data.xlsx'),
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });

  if (canceled || !filePath) return false;

  try {
    writeFileSync(filePath, Buffer.from(buffer));
    shell.showItemInFolder(filePath);
    return true;
  } catch (err) {
    console.error('[main] excel:export error', err);
    return false;
  }
});

/** Show open dialog and read Excel file */
ipcMain.handle('excel:import', async (): Promise<ArrayBuffer | null> => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow!, {
    title: 'Import Tijara Data',
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  });

  if (canceled || filePaths.length === 0) return null;

  try {
    const buf = readFileSync(filePaths[0]);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch (err) {
    console.error('[main] excel:import error', err);
    return null;
  }
});

/** Get the path to the data file (for display in settings) */
ipcMain.handle('app:dataPath', (): string => DATA_FILE);

// ── Excel storage IPC ────────────────────────────────────────────────────────

/** Let user choose WHERE to save the Excel storage file (first-time setup) */
ipcMain.handle('storage:chooseExcelFile', async (): Promise<string | null> => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
    title: 'Choose Storage File Location',
    defaultPath: join(app.getPath('documents'), 'tijara-data.xlsx'),
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });
  return canceled || !filePath ? null : filePath;
});

/** Read the Excel storage file and return raw bytes */
ipcMain.handle('storage:readExcel', async (_event, filePath: string): Promise<ArrayBuffer | null> => {
  try {
    if (!existsSync(filePath)) return null;
    const buf = readFileSync(filePath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch (err) {
    console.error('[main] storage:readExcel error', err);
    return null;
  }
});

/** Write the Excel storage file (atomic: write to .tmp then rename) */
ipcMain.handle('storage:writeExcel', async (_event, buffer: ArrayBuffer, filePath: string): Promise<boolean> => {
  try {
    const { dirname, } = require('path') as typeof import('path');
    const { renameSync } = require('fs') as typeof import('fs');
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmpPath = filePath + '.tmp';
    writeFileSync(tmpPath, Buffer.from(buffer));
    renameSync(tmpPath, filePath);
    return true;
  } catch (err) {
    console.error('[main] storage:writeExcel error', err);
    return false;
  }
});

// ── SQLite storage IPC ────────────────────────────────────────────────────────

/**
 * Mapping from JS camelCase field names to SQLite snake_case column names.
 * Only fields that differ need to be listed; identical names are passed through.
 */
const CAMEL_TO_SNAKE: Record<string, Record<string, string>> = {
  products:        { reorderPoint: 'reorder_point', reorderQuantity: 'reorder_quantity', createdAt: 'created_at' },
  sales:           { orderNumber: 'order_number', customerId: 'customer_id', customerName: 'customer_name', taxRate: 'tax_rate', taxAmount: 'tax_amount', paymentStatus: 'payment_status', paymentMethod: 'payment_method', createdAt: 'created_at', updatedAt: 'updated_at' },
  invoices:        { invoiceNumber: 'invoice_number', saleId: 'sale_id', customerId: 'customer_id', customerName: 'customer_name', taxRate: 'tax_rate', taxAmount: 'tax_amount', amountPaid: 'amount_paid', amountDue: 'amount_due', dueDate: 'due_date', createdAt: 'created_at' },
  users:           { passwordHash: 'password_hash', lastLogin: 'last_login', createdAt: 'created_at' },
  stockMovements:  { productId: 'product_id', productName: 'product_name', stockBefore: 'stock_before', stockAfter: 'stock_after', createdAt: 'created_at' },
  suppliers:       { contactPerson: 'contact_person', taxId: 'tax_id', createdAt: 'created_at' },
  purchases:       { poNumber: 'po_number', supplierId: 'supplier_id', supplierName: 'supplier_name', taxRate: 'tax_rate', taxAmount: 'tax_amount', shippingCost: 'shipping_cost', amountPaid: 'amount_paid', paymentStatus: 'payment_status', paymentMethod: 'payment_method', expectedDate: 'expected_date', createdAt: 'created_at', updatedAt: 'updated_at' },
  returns:         { returnNumber: 'return_number', saleId: 'sale_id', orderNumber: 'order_number', customerId: 'customer_id', customerName: 'customer_name', taxRate: 'tax_rate', taxAmount: 'tax_amount', refundAmount: 'refund_amount', refundMethod: 'refund_method', restockItems: 'restock_items', createdAt: 'created_at', updatedAt: 'updated_at' },
  accounts:        { nameAr: 'name_ar', nameFr: 'name_fr', normalBalance: 'normal_balance', parentId: 'parent_id', isSystem: 'is_system', isActive: 'is_active', costCenterId: 'cost_center_id', createdAt: 'created_at' },
  journalEntries:  { entryNumber: 'entry_number', sourceType: 'source_type', sourceId: 'source_id', totalDebit: 'total_debit', totalCredit: 'total_credit', reversalEntryId: 'reversal_entry_id', postedAt: 'posted_at', postedBy: 'posted_by', fiscalPeriodId: 'fiscal_period_id', createdAt: 'created_at', updatedAt: 'updated_at' },
  fiscalPeriods:   { startDate: 'start_date', endDate: 'end_date', isCurrent: 'is_current', closedAt: 'closed_at', closedBy: 'closed_by', createdAt: 'created_at' },
  costCenters:     { parentId: 'parent_id', isActive: 'is_active', createdAt: 'created_at' },
  taxRates:        { accountId: 'account_id', isDefault: 'is_default', isActive: 'is_active', createdAt: 'created_at' },
  journalTemplates: { createdAt: 'created_at' },
  productCostHistory: { productId: 'product_id', productName: 'product_name', oldCost: 'old_cost', newCost: 'new_cost', changedAt: 'changed_at', changedBy: 'changed_by' },
};

// Reverse map: snake_case → camelCase per table
const SNAKE_TO_CAMEL: Record<string, Record<string, string>> = {};
for (const [table, map] of Object.entries(CAMEL_TO_SNAKE)) {
  SNAKE_TO_CAMEL[table] = {};
  for (const [camel, snake] of Object.entries(map)) {
    SNAKE_TO_CAMEL[table][snake] = camel;
  }
}

const TABLE_NAMES: Record<string, string> = {
  customers: 'customers', products: 'products', sales: 'sales',
  invoices: 'invoices', users: 'users', stockMovements: 'stock_movements',
  suppliers: 'suppliers', purchases: 'purchases', returns: 'returns',
  accounts: 'accounts', journalEntries: 'journal_entries',
  fiscalPeriods: 'fiscal_periods', costCenters: 'cost_centers',
  taxRates: 'tax_rates', journalTemplates: 'journal_templates',
  productCostHistory: 'product_cost_history',
};

// JSON columns that store nested arrays
const JSON_COLUMNS = new Set(['items', 'lines']);

/**
 * Canonical snake_case columns for each table — used by bulkInsert to ensure
 * every row provides exactly the right number of values regardless of which
 * optional fields are present on a given item.
 */
const TABLE_COLUMNS: Record<string, string[]> = {
  customers:            ['id','name','email','phone','address','city','country','notes','created_at'],
  products:             ['id','name','sku','category','price','cost','stock','unit','description','reorder_point','reorder_quantity','created_at'],
  sales:                ['id','order_number','customer_id','customer_name','items','subtotal','tax_rate','tax_amount','discount','total','status','payment_status','payment_method','notes','created_at','updated_at'],
  invoices:             ['id','invoice_number','sale_id','customer_id','customer_name','items','subtotal','tax_rate','tax_amount','discount','total','amount_paid','amount_due','status','due_date','notes','created_at'],
  users:                ['id','name','email','password_hash','role','avatar','active','last_login','created_at'],
  stock_movements:      ['id','product_id','product_name','type','quantity','stock_before','stock_after','reference','notes','created_at'],
  suppliers:            ['id','name','email','phone','address','city','country','contact_person','tax_id','website','notes','created_at'],
  purchases:            ['id','po_number','supplier_id','supplier_name','items','subtotal','tax_rate','tax_amount','shipping_cost','total','amount_paid','status','payment_status','payment_method','expected_date','notes','created_at','updated_at'],
  returns:              ['id','return_number','sale_id','order_number','customer_id','customer_name','items','subtotal','tax_rate','tax_amount','refund_amount','reason','status','refund_method','restock_items','notes','created_at','updated_at'],
  accounts:             ['id','code','name','name_ar','name_fr','type','category','normal_balance','parent_id','description','is_system','is_active','cost_center_id','created_at'],
  journal_entries:      ['id','entry_number','date','description','reference','source_type','source_id','lines','total_debit','total_credit','status','reversal_entry_id','posted_at','posted_by','fiscal_period_id','created_at','updated_at'],
  fiscal_periods:       ['id','name','start_date','end_date','status','is_current','closed_at','closed_by','created_at'],
  cost_centers:         ['id','code','name','description','parent_id','is_active','created_at'],
  tax_rates:            ['id','name','code','rate','account_id','is_default','is_active','created_at'],
  journal_templates:    ['id','name','description','lines','created_at'],
  product_cost_history: ['id','product_id','product_name','old_cost','new_cost','changed_at','changed_by'],
};

/** Convert a JS object (camelCase) to a DB row (snake_case), serializing JSON columns */
function toRow(collection: string, obj: Record<string, unknown>): Record<string, unknown> {
  const map = CAMEL_TO_SNAKE[collection] ?? {};
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    // Use explicit map first, then fall back to automatic camelCase → snake_case
    const col = map[k] ?? k.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (JSON_COLUMNS.has(k)) {
      row[col] = JSON.stringify(v ?? []);
    } else if (typeof v === 'boolean') {
      row[col] = v ? 1 : 0;
    } else {
      row[col] = v ?? null;
    }
  }
  return row;
}

/** Convert a DB row (snake_case) back to a JS object (camelCase), deserializing JSON columns */
function fromRow(collection: string, row: Record<string, unknown>): Record<string, unknown> {
  const map = SNAKE_TO_CAMEL[collection] ?? {};
  const obj: Record<string, unknown> = {};
  for (const [col, v] of Object.entries(row)) {
    // Use explicit map first, then fall back to automatic snake_case → camelCase
    const key = map[col] ?? col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (JSON_COLUMNS.has(key)) {
      try { obj[key] = JSON.parse(v as string); } catch { obj[key] = []; }
    } else if (col === 'active' || col === 'is_system' || col === 'is_active' ||
               col === 'is_current' || col === 'is_default' || col === 'restock_items') {
      obj[key] = v === 1 || v === '1' || v === true;
    } else {
      obj[key] = v ?? undefined;
    }
  }
  return obj;
}

/** Get all rows from a collection table */
ipcMain.handle('sqlite:getAll', (_event, collection: string): unknown[] => {
  try {
    const table = TABLE_NAMES[collection];
    if (!table) return [];
    const rows = getDb().prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
    return rows.map((r) => fromRow(collection, r));
  } catch (err) {
    console.error(`[main] sqlite:getAll(${collection}) error`, err);
    return [];
  }
});

/** Get a single row by id */
ipcMain.handle('sqlite:getById', (_event, collection: string, id: string): unknown | null => {
  try {
    const table = TABLE_NAMES[collection];
    if (!table) return null;
    const row = getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return row ? fromRow(collection, row) : null;
  } catch (err) {
    console.error(`[main] sqlite:getById(${collection}) error`, err);
    return null;
  }
});

/** Insert a new row */
ipcMain.handle('sqlite:insert', (_event, collection: string, item: Record<string, unknown>): boolean => {
  try {
    const table = TABLE_NAMES[collection];
    if (!table) return false;
    const cols = TABLE_COLUMNS[table];
    if (!cols) return false;
    const row = toRow(collection, item);
    const placeholders = cols.map(() => '?').join(', ');
    const values = cols.map((col) => row[col] ?? null);
    getDb().prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(...values);
    return true;
  } catch (err) {
    console.error(`[main] sqlite:insert(${collection}) error`, err);
    return false;
  }
});

/** Update an existing row by id */
ipcMain.handle('sqlite:update', (_event, collection: string, id: string, updates: Record<string, unknown>): boolean => {
  try {
    const table = TABLE_NAMES[collection];
    if (!table) return false;
    const row = toRow(collection, updates);
    const sets = Object.keys(row).map((col) => `${col} = ?`).join(', ');
    const result = getDb().prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(...Object.values(row), id);
    return result.changes > 0;
  } catch (err) {
    console.error(`[main] sqlite:update(${collection}) error`, err);
    return false;
  }
});

/** Delete a row by id */
ipcMain.handle('sqlite:delete', (_event, collection: string, id: string): boolean => {
  try {
    const table = TABLE_NAMES[collection];
    if (!table) return false;
    const result = getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    return result.changes > 0;
  } catch (err) {
    console.error(`[main] sqlite:delete(${collection}) error`, err);
    return false;
  }
});

/** Bulk insert all collections atomically — used for migration */
ipcMain.handle('sqlite:bulkInsert', (_event, allData: Record<string, unknown[]>): boolean => {
  try {
    const db = getDb();
    const tx = db.transaction(() => {
      for (const [collection, items] of Object.entries(allData)) {
        const table = TABLE_NAMES[collection];
        if (!table) continue;
        db.prepare(`DELETE FROM ${table}`).run();
        if (!Array.isArray(items) || items.length === 0) continue;

        const cols = TABLE_COLUMNS[table];
        if (!cols) continue;
        const placeholders = cols.map(() => '?').join(', ');
        const stmt = db.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`);

        for (const item of items) {
          // Convert camelCase item to snake_case row, then extract values
          // in the exact column order defined by TABLE_COLUMNS.
          const row = toRow(collection, item as Record<string, unknown>);
          const values = cols.map((col) => row[col] ?? null);
          stmt.run(...values);
        }
      }
    });
    tx();
    return true;
  } catch (err) {
    console.error('[main] sqlite:bulkInsert error', err);
    return false;
  }
});

/** Clear all rows from all tables */
ipcMain.handle('sqlite:clear', (): boolean => {
  try {
    const db = getDb();
    const tx = db.transaction(() => {
      for (const table of Object.values(TABLE_NAMES)) {
        db.prepare(`DELETE FROM ${table}`).run();
      }
    });
    tx();
    return true;
  } catch (err) {
    console.error('[main] sqlite:clear error', err);
    return false;
  }
});

/** Get the SQLite database file path */
ipcMain.handle('sqlite:dbPath', (): string => SQLITE_FILE);

/** Clear all data - delete the data file */
ipcMain.handle('data:clear', (): boolean => {
  try {
    if (existsSync(DATA_FILE)) {
      const fs = require('fs');
      fs.unlinkSync(DATA_FILE);
    }
    return true;
  } catch (err) {
    console.error('[main] data:clear error', err);
    return false;
  }
});

/** Export an invoice as PDF – renders HTML in a hidden window, saves via dialog */
ipcMain.handle('invoice:exportPDF', async (_event, html: string, invoiceNumber: string): Promise<boolean> => {
  // Create a hidden off-screen window to render the invoice HTML
  const pdfWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  try {
    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    const pdfBuffer = await pdfWin.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    });

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save Invoice as PDF',
      defaultPath: join(app.getPath('documents'), `${invoiceNumber}.pdf`),
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) return false;

    writeFileSync(filePath, pdfBuffer);
    shell.showItemInFolder(filePath);
    return true;
  } catch (err) {
    console.error('[main] invoice:exportPDF error', err);
    return false;
  } finally {
    pdfWin.destroy();
  }
});

/** Print an invoice – opens a visible preview window then triggers native print dialog */
ipcMain.handle('invoice:print', async (_event, html: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const printWin = new BrowserWindow({
      width: 900,
      height: 700,
      show: true,
      title: 'Invoice Preview',
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    printWin.webContents.once('did-finish-load', () => {
      printWin.webContents.print(
        { silent: false, printBackground: true, color: true },
        (success) => {
          printWin.destroy();
          resolve(success);
        }
      );
    });

    printWin.on('closed', () => resolve(false));
  });
});
ipcMain.handle('report:exportPDF', async (_event, html: string, filename: string): Promise<boolean> => {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return false;
  const pdfWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  try {
    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await pdfWin.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      landscape: false,
      margins: { marginType: 'custom', top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    });
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: 'Export PDF',
      defaultPath: join(app.getPath('documents'), filename),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return false;
    writeFileSync(filePath, pdf);
    shell.openPath(filePath);
    return true;
  } catch (err) {
    console.error('[main] report:exportPDF error', err);
    return false;
  } finally {
    pdfWin.destroy();
  }
});

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
