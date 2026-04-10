/**
 * Client-side hash router.
 * Maps URL hashes to Route names and notifies listeners on navigation.
 */

import type { Route } from './types';

type RouteListener = (route: Route) => void;

const ROUTE_MAP: Record<string, Route> = {
  '#/dashboard': 'dashboard',
  '#/customers': 'customers',
  '#/products': 'products',
  '#/sales': 'sales',
  '#/invoices': 'invoices',
  '#/inventory': 'inventory',
  '#/suppliers': 'suppliers',
  '#/purchases': 'purchases',
  '#/returns': 'returns',
  '#/reports': 'reports',
  '#/users': 'users',
  '#/settings': 'settings',
  '#/accounting': 'accounting',
  '#/chart-of-accounts': 'chart-of-accounts',
  '#/journal': 'journal',
  '#/ledger': 'ledger',
  '#/trial-balance': 'trial-balance',
  '#/income-statement': 'income-statement',
  '#/balance-sheet': 'balance-sheet',
  '#/cash-flow': 'cash-flow',
  '#/tax-report': 'tax-report',
  '#/cost-centers': 'cost-centers',
  '#/fiscal-periods': 'fiscal-periods',
};

class Router {
  private listeners: RouteListener[] = [];
  private currentRoute: Route = 'dashboard';

  constructor() {
    window.addEventListener('hashchange', () => this.handleHashChange());
    window.addEventListener('load', () => this.handleHashChange());
  }

  /** Parse current hash and notify listeners */
  private handleHashChange(): void {
    const hash = window.location.hash || '#/dashboard';
    const route = ROUTE_MAP[hash] ?? 'dashboard';
    this.currentRoute = route;
    this.listeners.forEach((fn) => fn(route));
  }

  /** Navigate to a route */
  navigate(route: Route): void {
    window.location.hash = `#/${route}`;
  }

  /** Get current active route */
  getRoute(): Route {
    return this.currentRoute;
  }

  /** Subscribe to route changes */
  subscribe(listener: RouteListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

/** Singleton router instance */
export const router = new Router();
