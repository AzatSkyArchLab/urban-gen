/**
 * App - главный координатор приложения
 * 
 * Ответственности:
 * - Инициализация core-компонентов (Map, Draw, Layers)
 * - Управление состоянием приложения
 * - НЕ занимается UI (это UIManager)
 */

import { eventBus } from './EventBus';
import { MapManager } from '../map/MapManager';
import { DrawManager } from '../draw/DrawManager';
import { LayerManager } from '../layers/LayerManager';
import { featureStore, FeatureStore } from '../data/FeatureStore';

// ============================================
// App State
// ============================================
export interface AppState {
  activeTool: string | null;
  selectedFeatureIds: string[];
  mode: '2d' | '3d';
  isDrawing: boolean;
}

class StateManager {
  private state: AppState = {
    activeTool: null,
    selectedFeatureIds: [],
    mode: '2d',
    isDrawing: false
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
  private drawManager: DrawManager | null = null;
  private layerManager: LayerManager | null = null;
  private initialized = false;

  /**
   * Initialize the application
   * @param mapContainerId - ID of the map container element
   */
  async init(mapContainerId: string): Promise<void> {
    if (this.initialized) {
      console.warn('App already initialized');
      return;
    }

    try {
      // 1. Map must be initialized first
      this.mapManager = new MapManager(mapContainerId);
      await this.mapManager.init();

      // 2. Layer manager (vector tile layers)
      this.layerManager = new LayerManager(this.mapManager);
      await this.layerManager.init();

      // 3. Draw manager (tools and feature layers)
      this.drawManager = new DrawManager(this.mapManager, featureStore);

      // 4. Setup global event listeners
      this.setupEventListeners();
      
      this.initialized = true;
      eventBus.emit('app:ready');
      console.log('App initialized');
    } catch (error) {
      console.error('App initialization failed:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Sync tool activation with state
    eventBus.on<string>('tool:activate', (toolId) => {
      stateManager.set('activeTool', toolId);
    });

    eventBus.on('tool:deactivate', () => {
      stateManager.set('activeTool', null);
    });

    // Sync drawing state
    eventBus.on('draw:start', () => {
      stateManager.set('isDrawing', true);
    });

    eventBus.on('draw:end', () => {
      stateManager.set('isDrawing', false);
    });
  }

  // ============================================
  // Getters
  // ============================================
  getMapManager(): MapManager | null {
    return this.mapManager;
  }

  getDrawManager(): DrawManager | null {
    return this.drawManager;
  }

  getLayerManager(): LayerManager | null {
    return this.layerManager;
  }

  getFeatureStore(): FeatureStore {
    return featureStore;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
export const app = new App();
