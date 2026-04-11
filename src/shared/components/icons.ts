/**
 * SVG icon library — refined stroke icons.
 * stroke-width 2 for crisp rendering at small sizes in dark sidebars.
 * All icons are 20×20 by default, viewBox 0 0 24 24.
 */

type IconSize = 12 | 14 | 16 | 18 | 20 | 22 | 24 | 32;

function icon(path: string, size: IconSize = 20, sw = '2'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

export const Icons = {

  // ── Navigation ────────────────────────────────────────────────────────────

  /** Dashboard — home with door */
  dashboard: (s: IconSize = 20) =>
    icon('<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21V12h6v9"/>', s),

  /** Customers — single person */
  customers: (s: IconSize = 20) =>
    icon('<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>', s),

  /** Products — price tag */
  products: (s: IconSize = 20) =>
    icon('<path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.3-7.3a1 1 0 0 0 0-1.41Z"/><circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none"/>', s),

  /** Sales — receipt */
  sales: (s: IconSize = 20) =>
    icon('<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 10h8"/><path d="M8 14h6"/>', s),

  /** Invoices — document */
  invoices: (s: IconSize = 20) =>
    icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h4"/>', s),

  /** Inventory — warehouse shelves */
  package: (s: IconSize = 20) =>
    icon('<path d="M2 3h20v5H2z"/><path d="M2 8h20v5H2z"/><path d="M2 13h20v5H2z"/><path d="M5 3v15"/><path d="M19 3v15"/>', s),

  /** Suppliers — factory building */
  truck: (s: IconSize = 20) =>
    icon('<path d="M2 20V8l6-6h8l6 6v12H2Z"/><path d="M2 10h20"/><path d="M9 20v-6h6v6"/><path d="M9 4v6"/><path d="M15 4v6"/>', s),

  /** Purchases — clipboard with check */
  shoppingCart: (s: IconSize = 20) =>
    icon('<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 12 2 2 4-4"/>', s),

  /** Returns — undo arrow */
  refresh: (s: IconSize = 20) =>
    icon('<path d="M3 7h10a6 6 0 0 1 0 12H5"/><path d="m6 4-3 3 3 3"/>', s),

  /** Reports — bar chart */
  barChart: (s: IconSize = 20) =>
    icon('<path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="8" rx="1"/><rect x="13" y="6" width="3" height="12" rx="1"/><path d="m7 7 4-3 4 3 4-4" opacity=".5"/>', s),

  /** Users — two people */
  users: (s: IconSize = 20) =>
    icon('<circle cx="9" cy="7" r="3.5"/><path d="M2 21v-1a7 7 0 0 1 7-7v0a7 7 0 0 1 7 7v1"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M22 21v-1a4 4 0 0 0-3-3.87"/>', s),

  /** Settings — gear */
  settings: (s: IconSize = 20) =>
    icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>', s),

  // ── Theme ─────────────────────────────────────────────────────────────────

  sun: (s: IconSize = 20) =>
    icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>', s),

  moon: (s: IconSize = 20) =>
    icon('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', s),

  // ── Actions ───────────────────────────────────────────────────────────────

  plus: (s: IconSize = 20) =>
    icon('<path d="M12 5v14"/><path d="M5 12h14"/>', s),

  edit: (s: IconSize = 20) =>
    icon('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>', s),

  trash: (s: IconSize = 20) =>
    icon('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>', s),

  search: (s: IconSize = 20) =>
    icon('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>', s),

  close: (s: IconSize = 20) =>
    icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', s),

  check: (s: IconSize = 20) =>
    icon('<path d="M20 6 9 17l-5-5"/>', s),

  // ── Chevrons ──────────────────────────────────────────────────────────────

  chevronLeft: (s: IconSize = 20) =>
    icon('<path d="m15 18-6-6 6-6"/>', s),

  chevronRight: (s: IconSize = 20) =>
    icon('<path d="m9 18 6-6-6-6"/>', s),

  chevronDown: (s: IconSize = 20) =>
    icon('<path d="m6 9 6 6 6-6"/>', s),

  // ── UI chrome ─────────────────────────────────────────────────────────────

  menu: (s: IconSize = 20) =>
    icon('<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>', s),

  bell: (s: IconSize = 20) =>
    icon('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', s),

  logOut: (s: IconSize = 20) =>
    icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>', s),

  // ── Status / feedback ─────────────────────────────────────────────────────

  alertCircle: (s: IconSize = 20) =>
    icon('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>', s),

  alertTriangle: (s: IconSize = 20) =>
    icon('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>', s),

  info: (s: IconSize = 20) =>
    icon('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', s),

  // ── Trends ────────────────────────────────────────────────────────────────

  trendUp: (s: IconSize = 20) =>
    icon('<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>', s),

  trendDown: (s: IconSize = 20) =>
    icon('<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>', s),

  // ── Files & data ──────────────────────────────────────────────────────────

  download: (s: IconSize = 20) =>
    icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>', s),

  upload: (s: IconSize = 20) =>
    icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>', s),

  fileText: (s: IconSize = 20) =>
    icon('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M8 13h8"/><path d="M8 17h5"/>', s),

  database: (s: IconSize = 20) =>
    icon('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>', s),

  // ── Misc ──────────────────────────────────────────────────────────────────

  eye: (s: IconSize = 20) =>
    icon('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>', s),

  filter: (s: IconSize = 20) =>
    icon('<path d="M22 3H2l8 9.46V19l4 2v-8.54Z"/>', s),

  moreVertical: (s: IconSize = 20) =>
    icon('<circle cx="12" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>', s),

  sortAsc: (s: IconSize = 20) =>
    icon('<path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="M11 12h10"/><path d="M11 16h7"/><path d="M11 20h4"/>', s),

  sortDesc: (s: IconSize = 20) =>
    icon('<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h10"/><path d="M11 8h7"/><path d="M11 12h4"/>', s),

  printer: (s: IconSize = 20) =>
    icon('<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>', s),

  pieChart: (s: IconSize = 20) =>
    icon('<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>', s),

  building: (s: IconSize = 20) =>
    icon('<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>', s),

  image: (s: IconSize = 20) =>
    icon('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>', s),

  mapPin: (s: IconSize = 20) =>
    icon('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>', s),

  link: (s: IconSize = 20) =>
    icon('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>', s),

  dollarSign: (s: IconSize = 20) =>
    icon('<path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', s),

  shield: (s: IconSize = 20) =>
    icon('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/>', s),

  arrowRight: (s: IconSize = 20) =>
    icon('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', s),

  // ── Accounting ────────────────────────────────────────────────────────────

  /** Accounting — coins with arrows */
  accounting: (s: IconSize = 20) =>
    icon('<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>', s),

  /** Chart of Accounts — hierarchical list */
  chartOfAccounts: (s: IconSize = 20) =>
    icon('<path d="M3 5h4"/><path d="M3 12h4"/><path d="M3 19h4"/><path d="M9 5h12"/><path d="M9 12h12"/><path d="M9 19h12"/><path d="M7 5v14"/>', s),

  /** Journal — document with pen */
  journal: (s: IconSize = 20) =>
    icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m10.5 12.5 3 3-1.5.5-.5-1.5Z"/><path d="m13.5 12.5-1-1 1.5-1.5 1 1Z"/>', s),

  /** Ledger — open book with spine */
  ledger: (s: IconSize = 20) =>
    icon('<path d="M2 4a2 2 0 0 1 2-2h7v20H4a2 2 0 0 1-2-2Z"/><path d="M22 4a2 2 0 0 0-2-2h-7v20h7a2 2 0 0 0 2-2Z"/><path d="M11 2v20"/>', s),

  /** Trial Balance — balance scale */
  trialBalance: (s: IconSize = 20) =>
    icon('<path d="M12 3v18"/><path d="M3 7h18"/><path d="M5 7 3 14c1 2 4 2 4 0L5 7Z"/><path d="M19 7l-2 7c1 2 4 2 4 0L19 7Z"/><path d="M8 21h8"/>', s),

  /** Income Statement — dollar sign (P&L) */
  incomeStatement: (s: IconSize = 20) =>
    icon('<path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', s),

  /** Balance Sheet — two columns */
  balanceSheet: (s: IconSize = 20) =>
    icon('<rect x="2" y="3" width="9" height="18" rx="1"/><rect x="13" y="3" width="9" height="18" rx="1"/><path d="M6 7h1"/><path d="M6 11h1"/><path d="M6 15h1"/><path d="M17 7h1"/><path d="M17 11h1"/><path d="M17 15h1"/>', s),

  /** Cash Flow — wallet/card */
  cashFlow: (s: IconSize = 20) =>
    icon('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h.01"/><path d="M10 15h4"/>', s),

  /** Cost Center — org chart */
  costCenter: (s: IconSize = 20) =>
    icon('<rect x="9" y="2" width="6" height="4" rx="1"/><rect x="2" y="16" width="6" height="4" rx="1"/><rect x="16" y="16" width="6" height="4" rx="1"/><path d="M12 6v4"/><path d="M12 10H5v6"/><path d="M12 10h7v6"/>', s),

  /** Calendar */
  calendar: (s: IconSize = 20) =>
    icon('<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>', s),

  /** File JSON icon */
  fileJson: (s: IconSize = 20) =>
    icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1"/><path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1"/>', s),

  /** File spreadsheet icon */
  fileSpreadsheet: (s: IconSize = 20) =>
    icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="14" y2="9"/>', s),
};
