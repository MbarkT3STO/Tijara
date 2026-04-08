/**
 * Notification service – shows toast messages in the UI.
 */

import type { AppNotification } from './types';
import { eventBus, Events } from './eventBus';

let counter = 0;

/** Show a toast notification */
function notify(
  type: AppNotification['type'],
  message: string,
  duration = 4000
): void {
  const notification: AppNotification = {
    id: `notif-${++counter}`,
    type,
    message,
    duration,
  };
  eventBus.emit(Events.NOTIFICATION, notification);
}

export const notifications = {
  success: (msg: string, duration?: number) => notify('success', msg, duration),
  error: (msg: string, duration?: number) => notify('error', msg, duration),
  warning: (msg: string, duration?: number) => notify('warning', msg, duration),
  info: (msg: string, duration?: number) => notify('info', msg, duration),
};
