/**
 * Sidebar theme service – manages dark/light sidebar variant.
 * Persists to localStorage and sets data-sidebar on <body> synchronously.
 * Follows the same pattern as layoutService.
 */

export type SidebarTheme = 'dark' | 'light';

type SidebarThemeCallback = (theme: SidebarTheme) => void;

const STORAGE_KEY = 'tijara_sidebar_theme';

class SidebarThemeService {
  private _current: SidebarTheme;
  private _listeners: Set<SidebarThemeCallback> = new Set();

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    this._current = stored === 'light' ? 'light' : 'dark';
    document.body.setAttribute('data-sidebar', this._current);
  }

  get current(): SidebarTheme {
    return this._current;
  }

  set(theme: SidebarTheme): void {
    if (this._current === theme) return;
    this._current = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    document.body.setAttribute('data-sidebar', theme);
    this._listeners.forEach((cb) => cb(theme));
  }

  toggle(): void {
    this.set(this._current === 'dark' ? 'light' : 'dark');
  }

  subscribe(cb: SidebarThemeCallback): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }
}

export const sidebarThemeService = new SidebarThemeService();
