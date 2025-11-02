/**
 * Event Bus - Simple pub/sub for widget components
 * Enables decoupled communication between mode renderers and core
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`EventBus error on ${event}:`, e);
        }
      });
    }
  }

  off(event) {
    this.listeners.delete(event);
  }

  clear() {
    this.listeners.clear();
  }
}

export const bus = new EventBus();
