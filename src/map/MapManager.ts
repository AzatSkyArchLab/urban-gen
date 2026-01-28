import maplibregl from 'maplibre-gl';
import { eventBus } from '../core/EventBus';
import { Config } from '../core/Config';

// ============================================
// Types
// ============================================
export interface LayerConfig {
  id: string;
  type: 'fill' | 'line' | 'circle' | 'symbol';
  source: string;
  paint: Record<string, any>;
  layout?: Record<string, any>;
  minzoom?: number;
  maxzoom?: number;
}

// ============================================
// MapManager
// ============================================
export class MapManager {
  private map: maplibregl.Map | null = null;
  private containerId: string;
  private currentBasemap: 'osm' | 'satellite' = 'osm';

  constructor(containerId: string) {
    this.containerId = containerId;
  }

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
          paint: {
            'background-color': Config.map.style.backgroundColor
          }
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
          layout: {
            'visibility': 'none'
          }
        }
      ]
    };
  }

  private setupMapEvents(): void {
    if (!this.map) return;

    this.map.on('click', (e) => {
      eventBus.emit('map:click', {
        lngLat: e.lngLat,
        point: e.point
      });
    });

    this.map.on('dblclick', (e) => {
      eventBus.emit('map:dblclick', {
        lngLat: e.lngLat,
        point: e.point
      });
    });

    this.map.on('mousemove', (e) => {
      eventBus.emit('map:mousemove', {
        lngLat: e.lngLat,
        point: e.point
      });
    });

    this.map.on('moveend', () => {
      eventBus.emit('map:moveend', {
        center: this.map!.getCenter(),
        zoom: this.map!.getZoom(),
        bounds: this.map!.getBounds()
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
    if (!this.map) return;
    this.map.addSource(id, { type: 'geojson', data });
    eventBus.emit('source:added', { id });
  }

  updateGeoJSONSource(id: string, data: GeoJSON.FeatureCollection): void {
    if (!this.map) return;
    const source = this.map.getSource(id) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(data);
      eventBus.emit('source:updated', { id });
    }
  }

  // ============================================
  // Layers
  // ============================================
  addLayer(config: LayerConfig): void {
    if (!this.map) return;

    this.map.addLayer({
      id: config.id,
      type: config.type,
      source: config.source,
      paint: config.paint,
      layout: config.layout ?? {},
      minzoom: config.minzoom,
      maxzoom: config.maxzoom
    } as maplibregl.LayerSpecification);

    eventBus.emit('layer:added', { id: config.id });
  }

  removeLayer(id: string): void {
    if (!this.map) return;
    if (this.map.getLayer(id)) {
      this.map.removeLayer(id);
      eventBus.emit('layer:removed', { id });
    }
  }

  setLayerVisibility(id: string, visible: boolean): void {
    if (!this.map) return;
    this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }

  // ============================================
  // Cursor
  // ============================================
  setCursor(cursor: string): void {
    const container = this.map?.getContainer();
    if (container) {
      container.style.cursor = cursor;
    }
  }

  // ============================================
  // Getters
  // ============================================
  getMap(): maplibregl.Map | null {
    return this.map;
  }

  getCenter(): maplibregl.LngLat | null {
    return this.map?.getCenter() ?? null;
  }

  getZoom(): number {
    return this.map?.getZoom() ?? 0;
  }

  getBounds(): maplibregl.LngLatBounds | null {
    return this.map?.getBounds() ?? null;
  }

  // ============================================
  // Navigation
  // ============================================
  flyTo(center: [number, number], zoom?: number): void {
    this.map?.flyTo({ center, zoom: zoom ?? this.map.getZoom() });
  }

  fitBounds(bounds: [[number, number], [number, number]], padding = 50): void {
    this.map?.fitBounds(bounds, { padding });
  }
}