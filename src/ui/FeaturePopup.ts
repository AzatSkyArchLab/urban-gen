/**
 * FeaturePopup - displays feature attributes on map click
 *
 * Features:
 * - Show popup with feature properties on click
 * - Cursor change on hover (pointer)
 * - Works with vector tile layers (osi_sush, etc.)
 */

import maplibregl from 'maplibre-gl';
import { eventBus } from '../core/EventBus';
import type { MapManager } from '../map/MapManager';
import type { LayerManager } from '../layers/LayerManager';

export interface PopupConfig {
  layerId: string;
  titleField?: string;
  excludeFields?: string[];
  hitboxSize?: number; // pixels around click point for hit detection
}

const DEFAULT_EXCLUDE_FIELDS = ['id', 'geom', 'geometry', 'ogc_fid'];
const DEFAULT_HITBOX_SIZE = 15; // pixels

export class FeaturePopup {
  private mapManager: MapManager;
  private popup: maplibregl.Popup | null = null;
  private configs: PopupConfig[] = [];
  private initialized = false;

  constructor(mapManager: MapManager, _layerManager: LayerManager) {
    this.mapManager = mapManager;
    // LayerManager reserved for future use (layer-specific popup configs)
    void _layerManager;
  }

  /**
   * Initialize popup functionality for specified layers
   */
  init(configs: PopupConfig[]): void {
    if (this.initialized) return;

    this.configs = configs;
    this.setupPopup();
    this.setupLayerInteractions();

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

  private setupLayerInteractions(): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    // Store layer IDs - don't filter by existence (layers may load later)
    const configuredLayerIds = this.configs.map(c => c.layerId);

    // Get max hitbox for hover detection
    const maxHitbox = Math.max(
      ...this.configs.map(c => c.hitboxSize ?? DEFAULT_HITBOX_SIZE)
    );

    // Track hover state to avoid excessive cursor changes
    let isHovering = false;

    // Cursor change on hover using bbox query (same hitbox as click)
    map.on('mousemove', (e) => {
      // Filter to existing layers at runtime (layers load async)
      const layerIds = configuredLayerIds.filter(id => map.getLayer(id));
      if (layerIds.length === 0) {
        if (isHovering) {
          this.mapManager.setCursor('');
          isHovering = false;
        }
        return;
      }

      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - maxHitbox, e.point.y - maxHitbox],
        [e.point.x + maxHitbox, e.point.y + maxHitbox]
      ];

      const features = map.queryRenderedFeatures(bbox, { layers: layerIds });
      const hasFeatures = features.length > 0;

      if (hasFeatures && !isHovering) {
        this.mapManager.setCursor('pointer');
        isHovering = true;
      } else if (!hasFeatures && isHovering) {
        this.mapManager.setCursor('');
        isHovering = false;
      }
    });

    // Click handler with expanded hitbox using bbox query
    map.on('click', (e) => {
      // Filter to existing layers at runtime
      const layerIds = configuredLayerIds.filter(id => map.getLayer(id));
      if (layerIds.length > 0) {
        this.handleMapClick(e, layerIds);
      }
    });
  }

  private handleMapClick(e: maplibregl.MapMouseEvent, layerIds: string[]): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    // Find config with largest hitbox for query
    const maxHitbox = Math.max(
      ...this.configs.map(c => c.hitboxSize ?? DEFAULT_HITBOX_SIZE)
    );

    // Create bbox around click point
    const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
      [e.point.x - maxHitbox, e.point.y - maxHitbox],
      [e.point.x + maxHitbox, e.point.y + maxHitbox]
    ];

    // Query features in bbox
    const features = map.queryRenderedFeatures(bbox, { layers: layerIds });

    if (features.length === 0) return;

    // Find the config for this feature's layer
    const feature = features[0];
    const config = this.configs.find(c => c.layerId === feature.layer?.id);

    if (config) {
      this.showPopup(e.lngLat, feature, config);
    }
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
      : `Feature`;

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
    // Convert snake_case to Title Case
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
    this.initialized = false;
  }
}
