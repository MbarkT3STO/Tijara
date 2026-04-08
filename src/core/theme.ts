/**
 * Theme manager – handles light/dark mode switching.
 * Persists preference to localStorage and respects prefers-color-scheme.
 */

import type { Theme } from './types';

type ThemeListener = (theme: Theme) => void;

const STORAGE_KEY = 'tijara-theme';

class ThemeManager {
  private current: Theme;
  private listeners: ThemeListener[] = [];

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      this.current = stored;
    } else {
      this.current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    this.apply(this.current);

    // Listen for OS-level changes when no preference is stored
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  /** Apply theme to document root */
  private apply(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /** Get current theme */
  getTheme(): Theme {
    return this.current;
  }

  /** Set and persist theme */
  setTheme(theme: Theme): void {
    this.current = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    this.apply(theme);
    this.listeners.forEach((fn) => fn(theme));
  }

  /** Toggle between light and dark */
  toggle(): void {
    this.setTheme(this.current === 'light' ? 'dark' : 'light');
  }

  /** Subscribe to theme changes */
  subscribe(listener: ThemeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

/** Singleton theme manager */
export const themeManager = new ThemeManager();
