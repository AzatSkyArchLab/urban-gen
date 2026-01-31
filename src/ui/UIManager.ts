/**
 * UIManager - coordinates all UI components
 *
 * Responsibilities:
 * - Initialize all UI components in correct order
 * - Provide access to components
 * - Handle UI-level coordination
 *
 * Must be initialized AFTER app.init()
 */

import { eventBus } from '../core/EventBus';
import { app } from '../core/App';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';
import { LayerPanel } from './panels/LayerPanel';
import { FeaturePanel } from './panels/FeaturePanel';
import { FeaturePopup } from './FeaturePopup';
import { compassControl } from './CompassControl';

export class UIManager {
  private toolbar: Toolbar | null = null;
  private statusBar: StatusBar | null = null;
  private layerPanel: LayerPanel | null = null;
  private featurePanel: FeaturePanel | null = null;
  private featurePopup: FeaturePopup | null = null;
  private initialized = false;

  /**
   * Initialize all UI components
   */
  init(): void {
    if (this.initialized) {
      console.warn('UIManager already initialized');
      return;
    }

    if (!app.isInitialized) {
      throw new Error('UIManager.init() must be called after app.init()');
    }

    console.log('Initializing UI...');

    // Toolbar (left)
    this.toolbar = new Toolbar('toolbar');
    this.toolbar.init();

    // Layer panel (right, top)
    const layerManager = app.getLayerManager();
    if (layerManager) {
      this.layerPanel = new LayerPanel('layer-panel', layerManager);
      this.layerPanel.init();
    }

    // Feature panel (right, bottom)
    const featureStore = app.getFeatureStore();
    if (featureStore) {
      this.featurePanel = new FeaturePanel('feature-panel', featureStore);
      this.featurePanel.init();
    }

    // Status bar (bottom)
    this.statusBar = new StatusBar('status-bar');
    this.statusBar.init();

    // Compass control (map overlay)
    compassControl.init();

    // Feature popup for vector layers
    const mapManager = app.getMapManager();
    if (mapManager && layerManager) {
      this.featurePopup = new FeaturePopup(mapManager, layerManager);
      this.featurePopup.init([
        {
          layerId: 'osi-sush',
          titleField: 'na_obj',
          excludeFields: ['geom', 'id', 'ID'],
          hitboxSize: 20
        }
      ]);
    }

    this.initialized = true;
    eventBus.emit('ui:ready');
    console.log('UI initialized');
  }

  // ============================================
  // Getters
  // ============================================
  getToolbar(): Toolbar | null {
    return this.toolbar;
  }

  getStatusBar(): StatusBar | null {
    return this.statusBar;
  }

  getLayerPanel(): LayerPanel | null {
    return this.layerPanel;
  }

  getFeaturePanel(): FeaturePanel | null {
    return this.featurePanel;
  }

  getFeaturePopup(): FeaturePopup | null {
    return this.featurePopup;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton
export const uiManager = new UIManager();
