/**
 * Notification service – shows toast messages in the UI.
 * Also maintains an in-memory history log (max 50 entries).
 */

import type { AppNotification } from './types';
import { eventBus, Events } from './eventBus';

let counter = 0;

export interface NotificationHistoryEntry {
  id: string;
  type: AppNotification['type'];
  message: string;
  timestamp: number; // Date.now()
  read: boolean;
}

const MAX_HISTORY = 50;
const history: NotificationHistoryEntry[] = [];

/** Listeners for history changes */
const historyListeners: Array<() => void> = [];

function onHistoryChange(): void {
  historyListeners.forEach((fn) => fn());
}

/** Show a toast notification and record it in history */
function notify(
  type: AppNotification['type'],
  message: string,
  duration = 4000
): void {
  const id = `notif-${++counter}`;
  const notification: AppNotification = { id, type, message, duration };
  eventBus.emit(Events.NOTIFICATION, notification);

  // Record in history
  const entry: NotificationHistoryEntry = {
    id,
    type,
    message,
    timestamp: Date.now(),
    read: false,
  };
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
  onHistoryChange();
}

export const notifications = {
  success: (msg: string, duration?: number) => notify('success', msg, duration),
  error:   (msg: string, duration?: number) => notify('error',   msg, duration),
  warning: (msg: string, duration?: number) => notify('warning', msg, duration),
  info:    (msg: string, duration?: number) => notify('info',    msg, duration),

  /** Get a copy of the notification history */
  getHistory: (): NotificationHistoryEntry[] => [...history],

  /** Get count of unread notifications */
  getUnreadCount: (): number => history.filter((e) => !e.read).length,

  /** Mark all notifications as read */
  markAllRead: (): void => {
    history.forEach((e) => { e.read = true; });
    onHistoryChange();
  },

  /** Mark a single notification as read */
  markRead: (id: string): void => {
    const entry = history.find((e) => e.id === id);
    if (entry) { entry.read = true; onHistoryChange(); }
  },

  /** Subscribe to history changes */
  onHistoryChange: (fn: () => void): (() => void) => {
    historyListeners.push(fn);
    return () => {
      const idx = historyListeners.indexOf(fn);
      if (idx !== -1) historyListeners.splice(idx, 1);
    };
  },
};
