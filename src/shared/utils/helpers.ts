import { i18n } from '@core/i18n';
import type { UserRole } from '@core/types';

/**
 * Escape HTML special characters to prevent XSS.
 * Always use this when inserting user-provided strings into innerHTML.
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Permission map: which roles can perform which actions */
const PERMISSIONS: Record<string, UserRole[]> = {
  'page:users':          ['admin'],
  'page:settings':       ['admin', 'manager'],
  'page:journal':        ['admin', 'manager'],
  'page:accounts':       ['admin', 'manager'],
  'page:fiscalPeriods':  ['admin'],
  'page:costCenters':    ['admin', 'manager'],
  'action:delete':       ['admin', 'manager'],
  'action:editSale':     ['admin', 'manager', 'sales'],
  'action:createSale':   ['admin', 'manager', 'sales'],
  'action:editInvoice':  ['admin', 'manager'],
  'action:postJournal':  ['admin', 'manager'],
  'action:closeperiod':  ['admin'],
  'action:manageUsers':  ['admin'],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return (PERMISSIONS[permission] ?? []).includes(role);
}

export function canView(role: UserRole, page: string): boolean {
  const restrictedPages = ['users', 'settings', 'journal', 'accounts', 'fiscalPeriods'];
  if (role === 'viewer' && restrictedPages.includes(page)) return false;
  return hasPermission(role, `page:${page}`) || !PERMISSIONS[`page:${page}`];
}

/** Generate a random UUID-like ID */
export function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11);
}

/** Get current date as ISO string */
export function getCurrentISODate(): string {
  return new Date().toISOString();
}

/**
 * Active currency code — set by profileService on init.
 * Defaults to USD until the profile is loaded.
 */
let _activeCurrency = 'USD';

/** Called by profileService after loading to set the active currency globally */
export function setActiveCurrency(code: string): void {
  _activeCurrency = code || 'USD';
}

/**
 * Common locale mapping with forced numbering system (latn) and calendar (gregory).
 */
export function getLocale(lang: string): string {
  const map: Record<string, string> = {
    en: 'en-US',
    fr: 'fr-FR',
    ar: 'ar-u-nu-latn-ca-gregory' // Force Latin numerals and Gregorian calendar
  };
  return map[lang] || lang;
}

/**
 * Format a number as currency using the active profile currency.
 * Pass an explicit currency code to override (e.g. in PDF generation).
 * @param amount - The numeric amount
 * @param currency - ISO 4217 code; defaults to the active profile currency
 * @param langOverride - Optional language code to use for formatting
 */
export function formatCurrency(amount: number, currency?: string, langOverride?: string): string {
  const code = currency || _activeCurrency;
  const lang = langOverride || i18n.currentLanguage;
  
  return new Intl.NumberFormat(getLocale(lang), {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date string for display.
 * @param isoDate - ISO date string
 * @param langOverride - Optional language code to use for formatting
 */
export function formatDate(isoDate: string, langOverride?: string): string {
  const lang = langOverride || i18n.currentLanguage;
  
  return new Intl.DateTimeFormat(getLocale(lang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(isoDate));
}

/**
 * Format a date string with time.
 * @param isoDate - ISO date string
 * @param langOverride - Optional language code to use for formatting
 */
export function formatDateTime(isoDate: string, langOverride?: string): string {
  const lang = langOverride || i18n.currentLanguage;
  
  return new Intl.DateTimeFormat(getLocale(lang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

/**
 * Truncate a string to a max length.
 * @param str - Input string
 * @param max - Maximum length
 */
export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/**
 * Debounce a function call.
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Sort an array of objects by a key.
 */
export function sortBy<T>(arr: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
  return [...arr].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av < bv) return direction === 'asc' ? -1 : 1;
    if (av > bv) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Get initials from a full name.
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format a percentage value.
 * @param value - Numeric value (e.g. 15.5 for 15.5%)
 * @param decimals - Decimal places
 * @param showSign - Whether to prefix with + or -
 * @param langOverride - Optional language code to use for formatting
 */
export function formatPercent(value: number, decimals = 1, showSign = true, langOverride?: string): string {
  const lang = langOverride || i18n.currentLanguage;
  
  const formatted = new Intl.NumberFormat(getLocale(lang), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));

  const sign = showSign ? (value >= 0 ? '+' : '-') : (value < 0 ? '-' : '');
  return `${sign}${formatted}%`;
}

const AUTO_NOTE_PREFIX = '__auto__:';

/**
 * Encode a system-generated movement note as a translatable token.
 * Format: __auto__:<key>:<ref>
 */
export function autoNote(key: string, ref: string): string {
  return `${AUTO_NOTE_PREFIX}${key}:${ref}`;
}

/**
 * Resolve a movement note for display.
 * If it's an auto-generated token, translate it; otherwise return as-is.
 */
export function resolveMovementNote(note: string | undefined): string {
  if (!note) return '—';
  if (!note.startsWith(AUTO_NOTE_PREFIX)) return note;

  const body = note.slice(AUTO_NOTE_PREFIX.length);
  const colonIdx = body.indexOf(':');
  const key = colonIdx === -1 ? body : body.slice(0, colonIdx);
  const ref = colonIdx === -1 ? '' : body.slice(colonIdx + 1);

  return i18n.t(`inventory.autoNotes.${key}` as any, { ref });
}
