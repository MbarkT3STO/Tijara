/**
 * Simple typed event bus for cross-module communication.
 * Avoids tight coupling between features.
 */

type EventHandler<T = unknown> = (payload: T) => void;

class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  /** Subscribe to an event */
  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler as EventHandler);
    return () => this.off(event, handler);
  }

  /** Unsubscribe from an event */
  off<T>(event: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(event);
    if (list) {
      this.handlers.set(
        event,
        list.filter((h) => h !== handler)
      );
    }
  }

  /** Emit an event with payload */
  emit<T>(event: string, payload: T): void {
    this.handlers.get(event)?.forEach((h) => h(payload));
  }
}

/** Singleton event bus */
export const eventBus = new EventBus();

/** Well-known event names */
export const Events = {
  DATA_CHANGED: 'data:changed',
  NOTIFICATION: 'notification',
  MODAL_OPEN: 'modal:open',
  MODAL_CLOSE: 'modal:close',
} as const;
