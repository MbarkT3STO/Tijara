/**
 * SVG icon library — refined stroke icons.
 * stroke-width 1.75 for a modern, balanced weight.
 * All icons are 20×20 by default, viewBox 0 0 24 24.
 */

type IconSize = 12 | 14 | 16 | 18 | 20 | 22 | 24 | 32;

function icon(path: string, size: IconSize = 20, sw = '1.75'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

export const Icons = {

  // ── Navigation ────────────────────────────────────────────────────────────

  /** Dashboard — four rounded tiles */
  dashboard: (s: IconSize = 20) =>
    icon('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>', s),

  /** Customers — person with subtle second silhouette */
  customers: (s: IconSize = 20) =>
    icon('<circle cx="8" cy="7" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6v1"/><path d="M19 8v6m-3-3h6" opacity=".5"/>', s),

  /** Products — clean 3-D box */
  products: (s: IconSize = 20) =>
    icon('<path d="M20.5 7.5 12 3 3.5 7.5v9L12 21l8.5-4.5v-9Z"/><path d="M12 3v18"/><path d="m3.5 7.5 8.5 5 8.5-5"/>', s),

  /** Sales — upward trend with dollar mark */
  sales: (s: IconSize = 20) =>
    icon('<path d="M3 17 9 11l4 4 8-8"/><path d="M17 9h4v4"/>', s),

  /** Invoices — document with lines */
  invoices: (s: IconSize = 20) =>
    icon('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M8 13h8"/><path d="M8 17h5"/>', s),

  /** Inventory / package with shelf lines */
  package: (s: IconSize = 20) =>
    icon('<path d="M11 21H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/><path d="M22 13V5a2 2 0 0 0-2-2h-5"/><path d="M14 2h-4v6l2-1.5L14 8V2Z"/><path d="M8 21h8"/><path d="M12 17v4"/>', s),

  /** Suppliers — truck side view */
  truck: (s: IconSize = 20) =>
    icon('<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>', s),

  /** Purchases — shopping bag */
  shoppingCart: (s: IconSize = 20) =>
    icon('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>', s),

  /** Returns — rotate-left arrow */
  refresh: (s: IconSize = 20) =>
    icon('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74"/><path d="M3 3v5h5"/>', s),

  /** Reports — bar chart ascending */
  barChart: (s: IconSize = 20) =>
    icon('<path d="M3 3v18h18"/><path d="M7 16v-5"/><path d="M11 16V9"/><path d="M15 16v-3"/><path d="M19 16V7"/>', s),

  /** Users — two people */
  users: (s: IconSize = 20) =>
    icon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', s),

  /** Settings — sliders / tune */
  settings: (s: IconSize = 20) =>
    icon('<path d="M20 7H4"/><path d="M20 12H4"/><path d="M20 17H4"/><circle cx="8" cy="7" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="8" cy="17" r="2" fill="currentColor" stroke="none"/>', s),

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

  /** Accounting — landmark/columned building */
  accounting: (s: IconSize = 20) =>
    icon('<path d="M3 22h18"/><path d="M6 18V11"/><path d="M10 18V11"/><path d="M14 18V11"/><path d="M18 18V11"/><path d="M2 11l10-7 10 7"/>', s),

  /** Chart of Accounts — list-tree */
  chartOfAccounts: (s: IconSize = 20) =>
    icon('<path d="M21 12H9"/><path d="M21 6H9"/><path d="M21 18H9"/><path d="M3 6v4c0 1.1.9 2 2 2h2"/><path d="M3 10v6c0 1.1.9 2 2 2h2"/>', s),

  /** Journal — book-open */
  journal: (s: IconSize = 20) =>
    icon('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>', s),

  /** Ledger — book */
  ledger: (s: IconSize = 20) =>
    icon('<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>', s),

  /** Trial Balance — scale */
  trialBalance: (s: IconSize = 20) =>
    icon('<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>', s),

  /** Income Statement — trending-up */
  incomeStatement: (s: IconSize = 20) =>
    icon('<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>', s),

  /** Balance Sheet — layers */
  balanceSheet: (s: IconSize = 20) =>
    icon('<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>', s),

  /** Cash Flow — arrow-left-right */
  cashFlow: (s: IconSize = 20) =>
    icon('<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>', s),

  /** Cost Center — git-branch */
  costCenter: (s: IconSize = 20) =>
    icon('<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>', s),

  /** Calendar */
  calendar: (s: IconSize = 20) =>
    icon('<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', s),
};
