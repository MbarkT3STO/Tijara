/**
 * Color theme service – manages the 5 brand color presets.
 * Persists to localStorage and sets data-color-theme on <html> synchronously.
 * Follows the same pattern as themeManager and sidebarThemeService.
 */

export type ColorTheme = 'violet' | 'ocean' | 'forest' | 'copper' | 'slate';

type ColorThemeCallback = (theme: ColorTheme) => void;

const STORAGE_KEY = 'tijara_color_theme';

class ColorThemeService {
  private _current: ColorTheme;
  private _listeners: Set<ColorThemeCallback> = new Set();

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY) as ColorTheme | null;
    const valid: ColorTheme[] = ['violet', 'ocean', 'forest', 'copper', 'slate'];
    this._current = stored && valid.includes(stored) ? stored : 'violet';
    this._apply(this._current);
  }

  get current(): ColorTheme {
    return this._current;
  }

  private _apply(theme: ColorTheme): void {
    document.documentElement.setAttribute('data-color-theme', theme);
  }

  set(theme: ColorTheme): void {
    if (this._current === theme) return;
    this._current = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    this._apply(theme);
    this._listeners.forEach((cb) => cb(theme));
  }

  subscribe(cb: ColorThemeCallback): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }
}

export const colorThemeService = new ColorThemeService();
