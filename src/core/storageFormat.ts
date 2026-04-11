/**
 * Storage format service – manages whether data is persisted as JSON, Excel,
 * or SQLite. Persists the preference to localStorage.
 * Follows the same singleton pattern as colorThemeService.ts / densityService.ts.
 */

export type StorageFormat = 'json' | 'excel' | 'sqlite';

const STORAGE_KEY = 'tijara_storage_format';
const EXCEL_PATH_KEY = 'tijara_excel_path';

class StorageFormatService {
  private _current: StorageFormat;
  private _excelFilePath: string | null = null;

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY) as StorageFormat | null;
    if (stored === 'excel' || stored === 'sqlite') {
      this._current = stored;
    } else {
      this._current = 'json';
    }
    const savedPath = localStorage.getItem(EXCEL_PATH_KEY);
    if (savedPath) this._excelFilePath = savedPath;
  }

  get current(): StorageFormat {
    return this._current;
  }

  /** The absolute path of the Excel file used for storage (Electron only) */
  get excelFilePath(): string | null {
    return this._excelFilePath;
  }

  set excelFilePath(path: string | null) {
    this._excelFilePath = path;
    if (path) localStorage.setItem(EXCEL_PATH_KEY, path);
    else localStorage.removeItem(EXCEL_PATH_KEY);
  }

  /** Resolve the stored Excel file path (from localStorage) */
  resolveExcelPath(): string | null {
    return this._excelFilePath ?? localStorage.getItem(EXCEL_PATH_KEY);
  }

  /**
   * Change storage format. Caller is responsible for migrating data first.
   * Call storageFormatService.set() AFTER data has been saved in the new format.
   */
  set(format: StorageFormat): void {
    this._current = format;
    localStorage.setItem(STORAGE_KEY, format);
  }
}

export const storageFormatService = new StorageFormatService();
