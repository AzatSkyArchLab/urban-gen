/**
 * FeaturePopup - displays feature attributes on map click
 *
 * Features:
 * - Show popup with feature properties on click
 * - Cursor change on hover (pointer) - only when SelectTool is active
 * - Configurable hitbox size for easier selection
 * - Works with vector tile layers
 */

import maplibregl from 'maplibre-gl';
import { eventBus } from '../core/EventBus';
import { Config } from '../core/Config';
import type { MapManager } from '../map/MapManager';
import type { LayerManager } from '../layers/LayerManager';

export interface PopupConfig {
  layerId: string;
  titleField?: string;
  excludeFields?: string[];
  hitboxSize?: number;
}

const DEFAULT_EXCLUDE_FIELDS = ['id', 'geom', 'geometry', 'ogc_fid'];
const DEFAULT_HITBOX_SIZE = 15;

export class FeaturePopup {
  private mapManager: MapManager;
  private popup: maplibregl.Popup | null = null;
  private configs: PopupConfig[] = [];
  private initialized = false;
  private isHovering = false;
  private isDragging = false;
  private currentTool = 'select';
  private maxHitbox = DEFAULT_HITBOX_SIZE;

  constructor(mapManager: MapManager, _layerManager: LayerManager) {
    this.mapManager = mapManager;
    void _layerManager;
  }

  /**
   * Initialize popup functionality for specified layers
   */
  init(configs: PopupConfig[]): void {
    if (this.initialized) return;

    this.configs = configs;
    this.maxHitbox = Math.max(
      DEFAULT_HITBOX_SIZE,
      ...configs.map(c => c.hitboxSize ?? DEFAULT_HITBOX_SIZE)
    );

    this.setupPopup();
    this.setupInteractions();
    this.setupToolTracking();

    this.initialized = true;
    eventBus.emit('popup:initialized');
  }

  private setupPopup(): void {
    this.popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '320px',
      className: 'feature-popup'
    });
  }

  /**
   * Track active tool to enable/disable cursor management
   */
  private setupToolTracking(): void {
    eventBus.on<string>('tool:activate', (toolId) => {
      this.currentTool = toolId;
      // Reset hover state when switching tools
      if (toolId !== 'select') {
        this.isHovering = false;
      }
    });
  }

  /**
   * Get layer IDs that currently exist on the map
   */
  private getActiveLayerIds(): string[] {
    const map = this.mapManager.getMap();
    if (!map) return [];

    return this.configs
      .map(c => c.layerId)
      .filter(id => map.getLayer(id));
  }

  /**
   * Setup mouse interactions for hover and click
   */
  private setupInteractions(): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    const canvas = map.getCanvas();

    // Track drag state to not interfere with pan cursor
    canvas.addEventListener('mousedown', () => {
      this.isDragging = true;
    });

    canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Hover: change cursor when near features (only for select tool)
    map.on('mousemove', (e: maplibregl.MapMouseEvent) => {
      this.handleMouseMove(e);
    });

    // Click: show popup
    map.on('click', (e: maplibregl.MapMouseEvent) => {
      this.handleClick(e);
    });
  }

  private handleMouseMove(e: maplibregl.MapMouseEvent): void {
    // Only manage cursor for select tool
    if (this.currentTool !== 'select') return;

    // Don't interfere with drag/pan cursor
    if (this.isDragging) return;

    const map = this.mapManager.getMap();
    if (!map) return;

    const layerIds = this.getActiveLayerIds();
    if (layerIds.length === 0) {
      if (this.isHovering) {
        map.getCanvas().style.cursor = Config.cursors.grab;
        this.isHovering = false;
      }
      return;
    }

    const features = this.queryFeaturesAtPoint(map, e.point, layerIds);
    const hasFeatures = features.length > 0;

    if (hasFeatures && !this.isHovering) {
      map.getCanvas().style.cursor = Config.cursors.pointer;
      this.isHovering = true;
    } else if (!hasFeatures && this.isHovering) {
      map.getCanvas().style.cursor = Config.cursors.grab;
      this.isHovering = false;
    }
  }

  private handleClick(e: maplibregl.MapMouseEvent): void {
    // Only show popup for select tool
    if (this.currentTool !== 'select') return;

    const map = this.mapManager.getMap();
    if (!map) return;

    const layerIds = this.getActiveLayerIds();
    if (layerIds.length === 0) return;

    const features = this.queryFeaturesAtPoint(map, e.point, layerIds);
    if (features.length === 0) return;

    const feature = features[0];
    const config = this.configs.find(c => c.layerId === feature.layer?.id);

    if (config) {
      this.showPopup(e.lngLat, feature, config);
    }
  }

  /**
   * Query features within hitbox around a point
   */
  private queryFeaturesAtPoint(
    map: maplibregl.Map,
    point: maplibregl.Point,
    layerIds: string[]
  ): maplibregl.MapGeoJSONFeature[] {
    const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
      [point.x - this.maxHitbox, point.y - this.maxHitbox],
      [point.x + this.maxHitbox, point.y + this.maxHitbox]
    ];

    return map.queryRenderedFeatures(bbox, { layers: layerIds });
  }

  private showPopup(
    lngLat: maplibregl.LngLat,
    feature: maplibregl.MapGeoJSONFeature,
    config: PopupConfig
  ): void {
    const map = this.mapManager.getMap();
    if (!map || !this.popup) return;

    const html = this.buildPopupContent(feature, config);

    this.popup
      .setLngLat(lngLat)
      .setHTML(html)
      .addTo(map);

    eventBus.emit('popup:show', { layerId: config.layerId, feature });
  }

  private buildPopupContent(
    feature: maplibregl.MapGeoJSONFeature,
    config: PopupConfig
  ): string {
    const props = feature.properties || {};
    const excludeFields = new Set([
      ...DEFAULT_EXCLUDE_FIELDS,
      ...(config.excludeFields || [])
    ]);

    // Title
    const title = config.titleField && props[config.titleField]
      ? props[config.titleField]
      : 'Feature';

    // Properties table
    const rows = Object.entries(props)
      .filter(([key]) => !excludeFields.has(key.toLowerCase()))
      .map(([key, value]) => {
        const displayValue = this.formatValue(value);
        const displayKey = this.formatKey(key);
        return `
          <tr>
            <td class="popup-key">${displayKey}</td>
            <td class="popup-value">${displayValue}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <div class="popup-content">
        <div class="popup-title">${title}</div>
        ${rows ? `
          <table class="popup-table">
            <tbody>${rows}</tbody>
          </table>
        ` : '<div class="popup-empty">No attributes</div>'}
      </div>
    `;
  }

  private formatKey(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '<span class="popup-null">null</span>';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Close popup
   */
  close(): void {
    this.popup?.remove();
  }

  /**
   * Destroy popup instance
   */
  destroy(): void {
    this.close();
    this.popup = null;
    this.isHovering = false;
    this.isDragging = false;
    this.initialized = false;
  }
}
