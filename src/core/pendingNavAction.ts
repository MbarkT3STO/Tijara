/**
 * Pending navigation action store.
 * Set an action before navigating to a route; the page renderer
 * consumes it once after mounting to open the correct item detail.
 */

import type { Route } from './types';

export interface PendingNavAction {
  route: Route;
  itemId: string;
  itemType: 'view' | 'edit';
}

let _pending: PendingNavAction | null = null;

export function setPendingNavAction(action: PendingNavAction): void {
  _pending = action;
}

export function consumePendingNavAction(route: Route): PendingNavAction | null {
  if (_pending && _pending.route === route) {
    const action = _pending;
    _pending = null;
    return action;
  }
  return null;
}
