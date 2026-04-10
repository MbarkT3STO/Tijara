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

// ── Constants ────────────────────────────────────────────────────────────────

const IS_DEV = !app.isPackaged;
const DATA_DIR = join(app.getPath('userData'), 'tijara');
const DATA_FILE = join(DATA_DIR, 'data.json');

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
