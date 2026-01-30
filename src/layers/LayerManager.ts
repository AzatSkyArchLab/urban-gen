/**
 * LayerManager - manages vector tile layers from Martin server
 * 
 * Responsibilities:
 * - Add/remove vector tile sources and layers
 * - Control visibility, styling, ordering
 * - Provide layer state for UI
 */

import { eventBus } from '../core/EventBus';
import type { MapManager } from '../map/MapManager';
import {
  VECTOR_LAYERS,
  getTileUrl,
  getCategoryColorExpression,
  getCategoryWidthExpression,
  OSI_SUSH_DEFAULT_STYLE,
  type VectorLayerConfig,
  type LayerState
} from './LayerConfig';

export class LayerManager {
  private mapManager: MapManager;
  private layers = new Map<string, VectorLayerConfig>();
  private layerStates = new Map<string, LayerState>();
  private initialized = false;

  constructor(mapManager: MapManager) {
    this.mapManager = mapManager;
  }

  /**
   * Initialize layers from configuration
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Register all configured layers
    for (const config of VECTOR_LAYERS) {
      this.registerLayer(config);
    }

    // Add sources and layers to map
    await this.addAllLayers();
    
    this.initialized = true;
    eventBus.emit('layers:initialized');
  }

  private registerLayer(config: VectorLayerConfig): void {
    this.layers.set(config.id, config);
    this.layerStates.set(config.id, {
      id: config.id,
      visible: config.visible,
      order: config.order,
      style: { ...config.style }
    });
  }

  private async addAllLayers(): Promise<void> {
    // Sort by order (lower = bottom)
    const sorted = Array.from(this.layers.values())
      .sort((a, b) => a.order - b.order);

    for (const config of sorted) {
      this.addLayerToMap(config);
    }
  }

  private addLayerToMap(config: VectorLayerConfig): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    const state = this.layerStates.get(config.id);
    if (!state) return;

    const tileUrl = getTileUrl(config.sourceLayer);
    console.log(`Adding layer: ${config.id}, source: ${config.sourceId}, url: ${tileUrl}`);

    // Add source if not exists
    if (!map.getSource(config.sourceId)) {
      this.mapManager.addVectorSource(
        config.sourceId,
        [tileUrl],
        0,
        22
      );

      // Listen for source data errors
      map.on('error', (e: any) => {
        if (e.sourceId === config.sourceId) {
          console.error(`Tile load error for ${config.sourceId}:`, e.error?.message || e);
        }
      });
    }

    // Build and add layer
    const layerSpec = this.buildLayerSpec(config, state);
    console.log(`Layer spec:`, layerSpec);
    map.addLayer(layerSpec);

    eventBus.emit('layer:added', { id: config.id });
  }

  private buildLayerSpec(config: VectorLayerConfig, state: LayerState): any {
    const spec: any = {
      id: config.id,
      source: config.sourceId,
      'source-layer': config.sourceLayer,
      type: config.type,
      layout: {
        visibility: state.visible ? 'visible' : 'none'
      },
      paint: this.buildPaint(config, state)
    };

    return spec;
  }

  private buildPaint(config: VectorLayerConfig, state: LayerState): any {
    const paint: any = {};

    if (config.type === 'line') {
      // Category-based styling
      if (config.categoryField && config.categoryStyles) {
        paint['line-color'] = getCategoryColorExpression(
          config.categoryField,
          config.categoryStyles,
          OSI_SUSH_DEFAULT_STYLE.color
        );
        paint['line-width'] = getCategoryWidthExpression(
          config.categoryField,
          config.categoryStyles,
          OSI_SUSH_DEFAULT_STYLE.width
        );
      } else {
        paint['line-color'] = state.style.color;
        paint['line-width'] = state.style.width ?? 2;
      }

      if (state.style.opacity !== undefined) {
        paint['line-opacity'] = state.style.opacity;
      }
      if (config.style.dasharray) {
        paint['line-dasharray'] = config.style.dasharray;
      }
    } else if (config.type === 'fill') {
      paint['fill-color'] = state.style.color;
      paint['fill-opacity'] = state.style.opacity ?? 0.5;
    } else if (config.type === 'circle') {
      paint['circle-color'] = state.style.color;
      paint['circle-radius'] = state.style.width ?? 5;
      paint['circle-opacity'] = state.style.opacity ?? 1;
    }

    return paint;
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Set layer visibility
   */
  setVisibility(layerId: string, visible: boolean): void {
    const state = this.layerStates.get(layerId);
    if (!state) return;

    state.visible = visible;
    this.mapManager.setLayerVisibility(layerId, visible);
    eventBus.emit('layer:visibility:changed', { id: layerId, visible });
  }

  /**
   * Toggle layer visibility
   */
  toggleVisibility(layerId: string): void {
    const state = this.layerStates.get(layerId);
    if (state) {
      this.setVisibility(layerId, !state.visible);
    }
  }

  /**
   * Update layer style
   */
  updateStyle(layerId: string, style: Partial<LayerState['style']>): void {
    const config = this.layers.get(layerId);
    const state = this.layerStates.get(layerId);
    if (!config || !state) return;

    // Skip category-styled layers for color/width changes
    if (config.categoryField && config.categoryStyles) {
      if (style.opacity !== undefined) {
        state.style.opacity = style.opacity;
        this.mapManager.setPaintProperty(layerId, 'line-opacity', style.opacity);
      }
      return;
    }

    // Update state and map
    Object.assign(state.style, style);

    if (config.type === 'line') {
      if (style.color !== undefined) {
        this.mapManager.setPaintProperty(layerId, 'line-color', style.color);
      }
      if (style.width !== undefined) {
        this.mapManager.setPaintProperty(layerId, 'line-width', style.width);
      }
      if (style.opacity !== undefined) {
        this.mapManager.setPaintProperty(layerId, 'line-opacity', style.opacity);
      }
    }

    eventBus.emit('layer:style:changed', { id: layerId, style: state.style });
  }

  /**
   * Move layer up (increase z-order)
   */
  moveUp(layerId: string): void {
    this.reorderLayer(layerId, 1);
  }

  /**
   * Move layer down (decrease z-order)
   */
  moveDown(layerId: string): void {
    this.reorderLayer(layerId, -1);
  }

  private reorderLayer(layerId: string, direction: number): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    const layers = Array.from(this.layerStates.values())
      .sort((a, b) => a.order - b.order);
    
    const currentIndex = layers.findIndex(l => l.id === layerId);
    if (currentIndex === -1) return;

    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= layers.length) return;

    // Swap orders
    const temp = layers[currentIndex].order;
    layers[currentIndex].order = layers[newIndex].order;
    layers[newIndex].order = temp;

    // Move layer in MapLibre
    const targetLayerId = layers[newIndex].id;
    if (direction > 0) {
      map.moveLayer(layerId);
    } else {
      map.moveLayer(layerId, targetLayerId);
    }

    eventBus.emit('layer:order:changed', { id: layerId });
  }

  // ============================================
  // Getters
  // ============================================

  /**
   * Get all layer configs (sorted by order for UI)
   */
  getLayers(): VectorLayerConfig[] {
    return Array.from(this.layers.values())
      .sort((a, b) => {
        const stateA = this.layerStates.get(a.id);
        const stateB = this.layerStates.get(b.id);
        return (stateB?.order ?? 0) - (stateA?.order ?? 0);
      });
  }

  /**
   * Get layer state
   */
  getLayerState(layerId: string): LayerState | undefined {
    return this.layerStates.get(layerId);
  }

  /**
   * Get layer config
   */
  getLayerConfig(layerId: string): VectorLayerConfig | undefined {
    return this.layers.get(layerId);
  }

  /**
   * Check if layer is visible
   */
  isVisible(layerId: string): boolean {
    return this.layerStates.get(layerId)?.visible ?? false;
  }
}
