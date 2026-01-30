/**
 * EventBus - централизованная шина событий
 * 
 * Паттерн Pub/Sub для слабой связанности компонентов
 */

type Callback<T = any> = (data: T) => void;

class EventBus {
  private listeners = new Map<string, Set<Callback>>();

  /**
   * Подписка на событие
   * @returns Функция отписки
   */
  on<T = any>(event: string, callback: Callback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    return () => this.off(event, callback);
  }

  /**
   * Отписка от события
   */
  off(event: string, callback: Callback): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Одноразовая подписка
   */
  once<T = any>(event: string, callback: Callback<T>): void {
    const wrapper = (data: T) => {
      callback(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  /**
   * Публикация события
   */
  emit<T = any>(event: string, data?: T): void {
    this.listeners.get(event)?.forEach(cb => {
      try {
        cb(data);
      } catch (error) {
        console.error(`EventBus error in "${event}":`, error);
      }
    });
  }

  /**
   * Проверка наличия подписчиков
   */
  hasListeners(event: string): boolean {
    return (this.listeners.get(event)?.size ?? 0) > 0;
  }

  /**
   * Очистка всех подписок (для тестов)
   */
  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
