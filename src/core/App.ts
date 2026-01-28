import { eventBus } from './EventBus';
import { MapManager } from '../map/MapManager';

// ============================================
// Types
// ============================================
export interface AppState {
  activeTool: string | null;
  selectedIds: string[];
  mode: '2d' | '3d';
  isDrawing: boolean;
  activeLayer: string | null;
}

// ============================================
// StateManager
// ============================================
class StateManager {
  private state: AppState = {
    activeTool: null,
    selectedIds: [],
    mode: '2d',
    isDrawing: false,
    activeLayer: null
  };

  get<K extends keyof AppState>(key: K): AppState[K] {
    return this.state[key];
  }

  set<K extends keyof AppState>(key: K, value: AppState[K]): void {
    const oldValue = this.state[key];
    if (oldValue === value) return;
    
    this.state[key] = value;
    eventBus.emit(`state:${key}:changed`, { oldValue, newValue: value });
  }

  getAll(): Readonly<AppState> {
    return { ...this.state };
  }
}

export const stateManager = new StateManager();

// ============================================
// App
// ============================================
class App {
  private mapManager: MapManager | null = null;
  private initialized = false;

  async init(containerId: string): Promise<void> {
    if (this.initialized) {
      console.warn('App already initialized');
      return;
    }

    try {
      this.mapManager = new MapManager(containerId);
      await this.mapManager.init();

      this.setupEventListeners();
      this.initialized = true;

      eventBus.emit('app:ready');
      console.log('App initialized successfully');
    } catch (error) {
      console.error('App initialization failed:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    eventBus.on<string>('tool:activate', (toolId) => {
      stateManager.set('activeTool', toolId);
    });

    eventBus.on('tool:deactivate', () => {
      stateManager.set('activeTool', null);
    });
  }

  getMapManager(): MapManager | null {
    return this.mapManager;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const app = new App();

// Реэкспорт для удобства
export { eventBus } from './EventBus';
export { Config } from './Config';