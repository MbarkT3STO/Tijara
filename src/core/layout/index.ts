/**
 * Layout service – manages Classic vs Modern layout switching.
 * Persists to localStorage and notifies subscribers on change.
 * Sets data-layout on <body> synchronously so CSS can react immediately.
 */

export type LayoutStyle = 'classic' | 'modern' | 'floating';

type LayoutChangeCallback = (style: LayoutStyle) => void;

const STORAGE_KEY = 'tijara_layout';

class LayoutServiceImpl {
  private _current: LayoutStyle;
  private _listeners: Set<LayoutChangeCallback> = new Set();

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    this._current = stored === 'modern' ? 'modern' : stored === 'floating' ? 'floating' : 'classic';
    // Apply synchronously before first paint to avoid flash
    document.body.setAttribute('data-layout', this._current);
  }

  get currentLayout(): LayoutStyle {
    return this._current;
  }

  setLayout(style: LayoutStyle): void {
    if (this._current === style) return;
    this._current = style;
    localStorage.setItem(STORAGE_KEY, style);
    document.body.setAttribute('data-layout', style);
    this._listeners.forEach((cb) => cb(style));
  }

  onLayoutChange(cb: LayoutChangeCallback): void {
    this._listeners.add(cb);
  }

  offLayoutChange(cb: LayoutChangeCallback): void {
    this._listeners.delete(cb);
  }
}

export const layoutService = new LayoutServiceImpl();
