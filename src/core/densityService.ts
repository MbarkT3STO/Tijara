/**
 * Density service – manages UI density presets (compact / comfortable / spacious).
 * Persists to localStorage and sets data-density on <html> synchronously.
 * Follows the same pattern as colorThemeService.ts.
 */

export type DensityMode = 'compact' | 'comfortable' | 'spacious';

type DensityCallback = (density: DensityMode) => void;

const STORAGE_KEY = 'tijara_density';

class DensityService {
  private _current: DensityMode;
  private _listeners: Set<DensityCallback> = new Set();

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY) as DensityMode | null;
    const valid: DensityMode[] = ['compact', 'comfortable', 'spacious'];
    this._current = stored && valid.includes(stored) ? stored : 'comfortable';
    this._apply(this._current);
  }

  get current(): DensityMode {
    return this._current;
  }

  private _apply(density: DensityMode): void {
    if (density === 'comfortable') {
      document.documentElement.removeAttribute('data-density');
    } else {
      document.documentElement.setAttribute('data-density', density);
    }
  }

  set(density: DensityMode): void {
    if (this._current === density) return;
    this._current = density;
    localStorage.setItem(STORAGE_KEY, density);
    this._apply(density);
    this._listeners.forEach((cb) => cb(density));
  }

  subscribe(cb: DensityCallback): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }
}

export const densityService = new DensityService();
