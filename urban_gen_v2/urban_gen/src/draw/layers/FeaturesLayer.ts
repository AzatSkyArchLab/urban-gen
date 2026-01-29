/**
 * FeaturesLayer - manages map layers for drawn features
 * 
 * Responsibilities:
 * - Create and manage MapLibre layers for features
 * - Handle selection highlighting
 * - Update layers when features change
 */

import { eventBus } from '../../core/EventBus';
import { Config } from '../../core/Config';
import type { MapManager } from '../../map/MapManager';
import type { FeatureStore } from '../../data/FeatureStore';

export class FeaturesLayer {
  private mapManager: MapManager;
  private featureStore: FeatureStore;
  private selectedIds = new Set<string>();

  // Layer IDs
  private readonly SOURCE_ID = 'features';
  private readonly FILL_LAYER = 'features-fill';
  private readonly LINE_LAYER = 'features-line';
  private readonly LINE_HITBOX_LAYER = 'features-line-hitbox';
  private readonly SELECTED_LAYER = 'features-selected';

  constructor(mapManager: MapManager, featureStore: FeatureStore) {
    this.mapManager = mapManager;
    this.featureStore = featureStore;
  }

  /**
   * Initialize layers on the map
   */
  init(): void {
    this.createSource();
    this.createLayers();
    this.setupFilters();
    this.setupEventListeners();
  }

  private createSource(): void {
    this.mapManager.addGeoJSONSource(this.SOURCE_ID, {
      type: 'FeatureCollection',
      features: []
    });
  }

  private createLayers(): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    // Fill layer (polygons only)
    map.addLayer({
      id: this.FILL_LAYER,
      type: 'fill',
      source: this.SOURCE_ID,
      paint: {
        'fill-color': Config.draw.fillColor,
        'fill-opacity': Config.draw.fillOpacity
      }
    });

    // Line layer (all geometries)
    map.addLayer({
      id: this.LINE_LAYER,
      type: 'line',
      source: this.SOURCE_ID,
      paint: {
        'line-color': Config.draw.lineColor,
        'line-width': Config.draw.lineWidth
      }
    });

    // Invisible hitbox for easier line selection
    map.addLayer({
      id: this.LINE_HITBOX_LAYER,
      type: 'line',
      source: this.SOURCE_ID,
      paint: {
        'line-color': 'transparent',
        'line-width': Config.draw.hitboxWidth
      }
    });

    // Selected features highlight
    map.addLayer({
      id: this.SELECTED_LAYER,
      type: 'line',
      source: this.SOURCE_ID,
      paint: {
        'line-color': Config.draw.selectedColor,
        'line-width': Config.draw.selectedWidth
      }
    });
  }

  private setupFilters(): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    // Fill only for polygons
    map.setFilter(this.FILL_LAYER, ['==', ['geometry-type'], 'Polygon']);
    
    // Hitbox only for lines
    map.setFilter(this.LINE_HITBOX_LAYER, ['==', ['geometry-type'], 'LineString']);
    
    // Selected filter (initially none selected)
    map.setFilter(this.SELECTED_LAYER, ['==', ['get', 'selected'], true]);
  }

  private setupEventListeners(): void {
    // Update when features change
    eventBus.on('features:changed', () => this.update());

    // Handle selection from sidebar
    eventBus.on('sidebar:feature:click', ({ id }: { id: string }) => {
      if (this.selectedIds.has(id)) {
        this.clearSelection();
      } else {
        this.selectFeature(id);
      }
    });
  }

  /**
   * Update the source data
   */
  update(): void {
    const allFeatures = this.featureStore.getAll();
    
    // Add selection property to features
    const featuresWithSelection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: allFeatures.features.map(f => ({
        ...f,
        properties: {
          ...f.properties,
          selected: this.selectedIds.has(f.properties?.id ?? '')
        }
      }))
    };

    this.mapManager.updateGeoJSONSource(this.SOURCE_ID, featuresWithSelection);
  }

  /**
   * Select a feature
   */
  selectFeature(id: string): void {
    this.selectedIds.clear();
    this.selectedIds.add(id);
    this.update();
    eventBus.emit('feature:selected', { id });
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedIds.clear();
    this.update();
    eventBus.emit('feature:deselected');
  }

  /**
   * Get selected feature IDs
   */
  getSelectedIds(): string[] {
    return Array.from(this.selectedIds);
  }

  /**
   * Query features at a point
   */
  queryAtPoint(point: { x: number; y: number }): any[] {
    return this.mapManager.queryRenderedFeatures([point.x, point.y], {
      layers: [this.FILL_LAYER, this.LINE_LAYER, this.LINE_HITBOX_LAYER]
    });
  }

  /**
   * Get interactive layer IDs (for hover events)
   */
  getInteractiveLayers(): string[] {
    return [this.FILL_LAYER, this.LINE_LAYER, this.LINE_HITBOX_LAYER];
  }
}
