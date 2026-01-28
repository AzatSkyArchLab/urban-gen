type Callback<T = any> = (data: T) => void;

class EventBus {
  private listeners = new Map<string, Set<Callback>>();

  on<T = any>(event: string, callback: Callback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: Callback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit<T = any>(event: string, data?: T): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  once<T = any>(event: string, callback: Callback<T>): void {
    const wrapper = (data: T) => {
      callback(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}

export const eventBus = new EventBus();