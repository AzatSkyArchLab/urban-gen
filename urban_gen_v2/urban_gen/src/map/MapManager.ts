/**
 * MapManager - handles MapLibre GL map instance
 * 
 * Responsibilities:
 * - Create and configure map
 * - Manage basemaps
 * - Provide source/layer operations
 * - Emit map events to EventBus
 */

import maplibregl from 'maplibre-gl';
import { eventBus } from '../core/EventBus';
import { Config } from '../core/Config';

export class MapManager {
  private map: maplibregl.Map | null = null;
  private readonly containerId: string;
  private currentBasemap: 'osm' | 'satellite' = 'osm';

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  /**
   * Initialize the map
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.map = new maplibregl.Map({
          container: this.containerId,
          style: this.createBaseStyle(),
          center: Config.map.center,
          zoom: Config.map.zoom,
          minZoom: Config.map.minZoom,
          maxZoom: Config.map.maxZoom
        });

        this.map.on('load', () => {
          this.setupMapEvents();
          eventBus.emit('map:loaded');
          resolve();
        });

        this.map.on('error', (e) => {
          // Ignore tile loading errors (normal behavior)
          if (e.error?.message?.includes('tile') || e.sourceId) return;
          console.error('Map error:', e);
          reject(e);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private createBaseStyle(): maplibregl.StyleSpecification {
    return {
      version: 8,
      sources: {
        'osm': {
          type: 'raster',
          tiles: [Config.basemaps.osm],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors'
        },
        'esri-satellite': {
          type: 'raster',
          tiles: [Config.basemaps.esriSatellite],
          tileSize: 256,
          attribution: '© Esri'
        }
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': Config.map.style.backgroundColor }
        },
        {
          id: 'osm-tiles',
          type: 'raster',
          source: 'osm',
          minzoom: 0,
          maxzoom: 19
        },
        {
          id: 'satellite-tiles',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 19,
          layout: { visibility: 'none' }
        }
      ]
    };
  }

  private setupMapEvents(): void {
    if (!this.map) return;

    this.map.on('click', (e) => {
      eventBus.emit('map:click', { lngLat: e.lngLat, point: e.point });
    });

    this.map.on('dblclick', (e) => {
      eventBus.emit('map:dblclick', { lngLat: e.lngLat, point: e.point });
    });

    this.map.on('mousemove', (e) => {
      eventBus.emit('map:mousemove', { lngLat: e.lngLat, point: e.point });
    });

    this.map.on('moveend', () => {
      if (!this.map) return;
      eventBus.emit('map:moveend', {
        center: this.map.getCenter(),
        zoom: this.map.getZoom(),
        bounds: this.map.getBounds()
      });
    });
  }

  // ============================================
  // Basemap
  // ============================================
  setBasemap(type: 'osm' | 'satellite'): void {
    if (!this.map) return;
    this.currentBasemap = type;
    this.map.setLayoutProperty('osm-tiles', 'visibility', type === 'osm' ? 'visible' : 'none');
    this.map.setLayoutProperty('satellite-tiles', 'visibility', type === 'satellite' ? 'visible' : 'none');
    eventBus.emit('map:basemap:changed', { type });
  }

  getBasemap(): 'osm' | 'satellite' {
    return this.currentBasemap;
  }

  // ============================================
  // Sources
  // ============================================
  addGeoJSONSource(id: string, data: GeoJSON.FeatureCollection): void {
    if (!this.map || this.map.getSource(id)) return;
    this.map.addSource(id, { type: 'geojson', data });
  }

  updateGeoJSONSource(id: string, data: GeoJSON.FeatureCollection): void {
    if (!this.map) return;
    const source = this.map.getSource(id) as maplibregl.GeoJSONSource;
    source?.setData(data);
  }

  addVectorSource(id: string, tiles: string[], minzoom = 0, maxzoom = 16): void {
    if (!this.map || this.map.getSource(id)) return;
    this.map.addSource(id, { type: 'vector', tiles, minzoom, maxzoom });
  }

  // ============================================
  // Layers
  // ============================================
  addLayer(spec: maplibregl.LayerSpecification, beforeId?: string): void {
    if (!this.map || this.map.getLayer(spec.id)) return;
    this.map.addLayer(spec, beforeId);
  }

  removeLayer(id: string): void {
    if (!this.map || !this.map.getLayer(id)) return;
    this.map.removeLayer(id);
  }

  setLayerVisibility(id: string, visible: boolean): void {
    if (!this.map) return;
    this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }

  setPaintProperty(layerId: string, name: string, value: any): void {
    if (!this.map) return;
    this.map.setPaintProperty(layerId, name, value);
  }

  setFilter(layerId: string, filter: any): void {
    if (!this.map) return;
    this.map.setFilter(layerId, filter);
  }

  moveLayer(id: string, beforeId?: string): void {
    if (!this.map) return;
    this.map.moveLayer(id, beforeId);
  }

  // ============================================
  // Cursor
  // ============================================
  setCursor(cursor: string): void {
    const container = this.map?.getContainer();
    if (container) container.style.cursor = cursor;
  }

  // ============================================
  // Queries
  // ============================================
  queryRenderedFeatures(
    point: [number, number] | maplibregl.PointLike,
    options?: { layers?: string[] }
  ): maplibregl.MapGeoJSONFeature[] {
    if (!this.map) return [];
    return this.map.queryRenderedFeatures(point, options);
  }

  // ============================================
  // Layer Events
  // ============================================
  onLayerEvent(
    type: 'mouseenter' | 'mouseleave' | 'click',
    layerId: string,
    handler: (e: maplibregl.MapLayerMouseEvent) => void
  ): void {
    this.map?.on(type, layerId, handler);
  }

  // ============================================
  // Getters
  // ============================================
  getMap(): maplibregl.Map | null {
    return this.map;
  }

  getZoom(): number {
    return this.map?.getZoom() ?? Config.map.zoom;
  }

  getCenter(): maplibregl.LngLat | null {
    return this.map?.getCenter() ?? null;
  }

  // ============================================
  // Navigation
  // ============================================
  flyTo(center: [number, number], zoom?: number): void {
    this.map?.flyTo({ center, zoom });
  }

  fitBounds(bounds: maplibregl.LngLatBoundsLike, padding = 50): void {
    this.map?.fitBounds(bounds, { padding });
  }

  // ============================================
  // Utils
  // ============================================
  disableDoubleClickZoom(): void {
    this.map?.doubleClickZoom.disable();
  }
}
