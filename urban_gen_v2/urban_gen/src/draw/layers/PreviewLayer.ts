/**
 * PreviewLayer - preview layer for drawing operations
 * 
 * Shows the geometry being drawn before it's completed
 */

import { Config } from '../../core/Config';
import type { MapManager } from '../../map/MapManager';

export class PreviewLayer {
  private mapManager: MapManager;

  // Layer IDs
  private readonly SOURCE_ID = 'draw-preview';
  private readonly FILL_LAYER = 'draw-preview-fill';
  private readonly LINE_LAYER = 'draw-preview-line';
  private readonly POINTS_LAYER = 'draw-preview-points';

  constructor(mapManager: MapManager) {
    this.mapManager = mapManager;
  }

  /**
   * Initialize preview layers
   */
  init(): void {
    this.createSource();
    this.createLayers();
    this.setupFilters();
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

    // Preview fill (polygons only)
    map.addLayer({
      id: this.FILL_LAYER,
      type: 'fill',
      source: this.SOURCE_ID,
      paint: {
        'fill-color': Config.draw.fillColor,
        'fill-opacity': Config.draw.previewOpacity
      }
    });

    // Preview line (dashed)
    map.addLayer({
      id: this.LINE_LAYER,
      type: 'line',
      source: this.SOURCE_ID,
      paint: {
        'line-color': Config.draw.lineColor,
        'line-width': Config.draw.lineWidth,
        'line-dasharray': [3, 3]
      }
    });

    // Preview points (vertices)
    map.addLayer({
      id: this.POINTS_LAYER,
      type: 'circle',
      source: this.SOURCE_ID,
      paint: {
        'circle-radius': 5,
        'circle-color': Config.draw.fillColor,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2
      }
    });
  }

  private setupFilters(): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    // Fill only for polygons
    map.setFilter(this.FILL_LAYER, ['==', ['geometry-type'], 'Polygon']);
  }

  /**
   * Update preview with a feature
   */
  update(feature: GeoJSON.Feature | null): void {
    const data: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: feature ? [feature] : []
    };
    this.mapManager.updateGeoJSONSource(this.SOURCE_ID, data);
  }

  /**
   * Clear preview
   */
  clear(): void {
    this.update(null);
  }
}
