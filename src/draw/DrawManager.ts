import { eventBus } from '../core/EventBus';
import { Config } from '../core/Config';
import { featureStore } from '../data/FeatureStore';
import { MapManager } from '../map/MapManager';
import type { Coordinate, Tool, MapClickEvent, MapMouseEvent, UrbanFeature } from '../types';

// ============================================
// BaseTool
// ============================================
export abstract class BaseTool implements Tool {
  abstract id: string;
  abstract name: string;
  cursor = Config.cursors.default;
  
  protected manager: DrawManager;
  protected isActive = false;

  constructor(manager: DrawManager) {
    this.manager = manager;
  }

  activate(): void {
    this.isActive = true;
    this.manager.setCursor(this.cursor);
    eventBus.emit('tool:activated', { id: this.id });
  }

  deactivate(): void {
    this.isActive = false;
    eventBus.emit('tool:deactivated', { id: this.id });
  }

  onMapClick?(e: MapClickEvent): void;
  onMapDoubleClick?(e: MapClickEvent): void;
  onMapMouseMove?(e: MapMouseEvent): void;
  onKeyDown?(e: KeyboardEvent): void;
}

// ============================================
// BaseDrawTool
// ============================================
export abstract class BaseDrawTool extends BaseTool {
  cursor = Config.cursors.crosshair;
  protected points: Coordinate[] = [];
  protected tempPoint: Coordinate | null = null;

  activate(): void {
    super.activate();
    this.reset();
  }

  deactivate(): void {
    super.deactivate();
    this.reset();
    this.manager.clearPreview();
  }

  onMapClick(e: MapClickEvent): void {
    const coord: Coordinate = [e.lngLat.lng, e.lngLat.lat];
    this.points.push(coord);
    this.manager.updatePreview(this.getPreviewGeometry());
    eventBus.emit('draw:point:added', { point: coord, total: this.points.length });
  }

  onMapMouseMove(e: MapMouseEvent): void {
    if (this.points.length === 0) return;
    this.tempPoint = [e.lngLat.lng, e.lngLat.lat];
    this.manager.updatePreview(this.getPreviewGeometry());
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.reset();
      this.manager.clearPreview();
    } else if (e.key === 'Backspace' && this.points.length > 0) {
      e.preventDefault();
      this.points.pop();
      this.manager.updatePreview(this.getPreviewGeometry());
    }
  }

  protected reset(): void {
    this.points = [];
    this.tempPoint = null;
  }

  protected abstract getPreviewGeometry(): GeoJSON.Feature | null;
  protected abstract complete(): void;
}

// ============================================
// SelectTool
// ============================================
export class SelectTool extends BaseTool {
  id = 'select';
  name = 'Select';
  cursor = Config.cursors.default;

  onMapClick(e: MapClickEvent): void {
    const features = this.manager.queryFeaturesAtPoint(e.point);
    
    if (features.length > 0) {
      const id = features[0].properties?.id;
      if (id) {
        this.manager.selectFeature(id);
      }
    } else {
      this.manager.clearSelection();
    }
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const selectedIds = this.manager.getSelectedIds();
      selectedIds.forEach(id => featureStore.remove(id));
      this.manager.clearSelection();
    } else if (e.key === 'Escape') {
      this.manager.clearSelection();
    }
  }
}

// ============================================
// PolygonTool
// ============================================
export class PolygonTool extends BaseDrawTool {
  id = 'polygon';
  name = 'Polygon';
  cursor = Config.cursors.crosshair;

  onMapDoubleClick(_e: MapClickEvent): void {
    if (this.points.length > 0) {
      this.points.pop();
    }
    if (this.points.length >= 3) {
      this.complete();
    }
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && this.points.length >= 3) {
      this.complete();
    } else {
      super.onKeyDown(e);
    }
  }

  protected getPreviewGeometry(): GeoJSON.Feature | null {
    if (this.points.length === 0) return null;

    const coords = [...this.points];
    if (this.tempPoint) coords.push(this.tempPoint);
    if (coords.length < 2) return null;

    if (coords.length < 3) {
      return {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords }
      };
    }

    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] }
    };
  }

  protected complete(): void {
    if (this.points.length < 3) return;

    const polygon: UrbanFeature = {
      type: 'Feature',
      properties: {
        id: crypto.randomUUID(),
        type: 'polygon',
        createdAt: new Date().toISOString()
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[...this.points, this.points[0]]]
      }
    };

    featureStore.add(polygon);
    eventBus.emit('draw:polygon:complete', polygon);
    this.reset();
    this.manager.clearPreview();
  }
}

// ============================================
// LineTool
// ============================================
export class LineTool extends BaseDrawTool {
  id = 'line';
  name = 'Line';
  cursor = Config.cursors.crosshair;

  onMapDoubleClick(_e: MapClickEvent): void {
    if (this.points.length > 0) {
      this.points.pop();
    }
    if (this.points.length >= 2) {
      this.complete();
    }
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && this.points.length >= 2) {
      this.complete();
    } else {
      super.onKeyDown(e);
    }
  }

  protected getPreviewGeometry(): GeoJSON.Feature | null {
    if (this.points.length === 0) return null;

    const coords = [...this.points];
    if (this.tempPoint) coords.push(this.tempPoint);
    if (coords.length < 2) return null;

    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords }
    };
  }

  protected complete(): void {
    if (this.points.length < 2) return;

    const line: UrbanFeature = {
      type: 'Feature',
      properties: {
        id: crypto.randomUUID(),
        type: 'line',
        createdAt: new Date().toISOString()
      },
      geometry: {
        type: 'LineString',
        coordinates: [...this.points]
      }
    };

    featureStore.add(line);
    eventBus.emit('draw:line:complete', line);
    this.reset();
    this.manager.clearPreview();
  }
}

// ============================================
// DrawManager
// ============================================
export class DrawManager {
  private mapManager: MapManager;
  private tools = new Map<string, BaseTool>();
  private activeTool: BaseTool | null = null;
  private selectedIds = new Set<string>();
  
  private readonly PREVIEW_SOURCE = 'draw-preview';
  private readonly PREVIEW_LINE_LAYER = 'draw-preview-line';
  private readonly PREVIEW_FILL_LAYER = 'draw-preview-fill';
  private readonly PREVIEW_POINTS_LAYER = 'draw-preview-points';
  
  private readonly FEATURES_SOURCE = 'features';
  private readonly FEATURES_FILL_LAYER = 'features-fill';
  private readonly FEATURES_LINE_LAYER = 'features-line';
  private readonly FEATURES_SELECTED_LAYER = 'features-selected';

  constructor(mapManager: MapManager) {
    this.mapManager = mapManager;
    this.init();
  }

  private init(): void {
    this.registerTool(new SelectTool(this));
    this.registerTool(new PolygonTool(this));
    this.registerTool(new LineTool(this));
    this.setupFeaturesLayer();
    this.setupPreviewLayers();
    this.setupEventListeners();
    this.disableMapDoubleClickZoom();
    
    // Activate select tool by default
    this.activateTool('select');
  }

  private disableMapDoubleClickZoom(): void {
    const map = this.mapManager.getMap();
    if (map) {
      map.doubleClickZoom.disable();
    }
  }

  private setupFeaturesLayer(): void {
    const emptyGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: []
    };

    this.mapManager.addGeoJSONSource(this.FEATURES_SOURCE, emptyGeoJSON);

    this.mapManager.addLayer({
      id: this.FEATURES_FILL_LAYER,
      type: 'fill',
      source: this.FEATURES_SOURCE,
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.3
      }
    });

    this.mapManager.addLayer({
      id: this.FEATURES_LINE_LAYER,
      type: 'line',
      source: this.FEATURES_SOURCE,
      paint: {
        'line-color': '#3b82f6',
        'line-width': 2
      }
    });

    this.mapManager.addLayer({
      id: this.FEATURES_SELECTED_LAYER,
      type: 'line',
      source: this.FEATURES_SOURCE,
      paint: {
        'line-color': '#f59e0b',
        'line-width': 3
      }
    });

    eventBus.on('features:changed', () => {
      this.updateFeaturesLayer();
    });
  }

  private setupPreviewLayers(): void {
    const emptyGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: []
    };

    this.mapManager.addGeoJSONSource(this.PREVIEW_SOURCE, emptyGeoJSON);

    this.mapManager.addLayer({
      id: this.PREVIEW_FILL_LAYER,
      type: 'fill',
      source: this.PREVIEW_SOURCE,
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.2
      }
    });

    this.mapManager.addLayer({
      id: this.PREVIEW_LINE_LAYER,
      type: 'line',
      source: this.PREVIEW_SOURCE,
      paint: {
        'line-color': '#3b82f6',
        'line-width': 2,
        'line-dasharray': [3, 3]
      }
    });

    this.mapManager.addLayer({
      id: this.PREVIEW_POINTS_LAYER,
      type: 'circle',
      source: this.PREVIEW_SOURCE,
      paint: {
        'circle-radius': 5,
        'circle-color': '#3b82f6',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2
      }
    });
  }

  private setupEventListeners(): void {
    eventBus.on<MapClickEvent>('map:click', (e) => {
      this.activeTool?.onMapClick?.(e);
    });

    eventBus.on<MapClickEvent>('map:dblclick', (e) => {
      this.activeTool?.onMapDoubleClick?.(e);
    });

    eventBus.on<MapMouseEvent>('map:mousemove', (e) => {
      this.activeTool?.onMapMouseMove?.(e);
    });

    document.addEventListener('keydown', (e) => {
      this.activeTool?.onKeyDown?.(e);
    });
  }

  private updateFeaturesLayer(): void {
    const allFeatures = featureStore.getAll();
    
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

    this.mapManager.updateGeoJSONSource(this.FEATURES_SOURCE, featuresWithSelection);

    const map = this.mapManager.getMap();
    if (map) {
      map.setFilter(this.FEATURES_SELECTED_LAYER, ['==', ['get', 'selected'], true]);
    }
  }

  registerTool(tool: BaseTool): void {
    this.tools.set(tool.id, tool);
  }

  activateTool(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (!tool) return;

    if (this.activeTool) {
      this.activeTool.deactivate();
    }
    
    this.activeTool = tool;
    tool.activate();
    eventBus.emit('tool:activate', toolId);
  }

  deactivateTool(): void {
    if (this.activeTool) {
      this.activeTool.deactivate();
    }
    
    // Switch to select tool
    const selectTool = this.tools.get('select');
    if (selectTool) {
      this.activeTool = selectTool;
      selectTool.activate();
    }
  }

  getActiveTool(): BaseTool | null {
    return this.activeTool;
  }

  selectFeature(id: string): void {
    this.selectedIds.clear();
    this.selectedIds.add(id);
    this.updateFeaturesLayer();
    eventBus.emit('feature:selected', { id });
  }

  clearSelection(): void {
    this.selectedIds.clear();
    this.updateFeaturesLayer();
    eventBus.emit('feature:deselected');
  }

  getSelectedIds(): string[] {
    return Array.from(this.selectedIds);
  }

  queryFeaturesAtPoint(point: { x: number; y: number }): UrbanFeature[] {
    const map = this.mapManager.getMap();
    if (!map) return [];

    const features = map.queryRenderedFeatures([point.x, point.y], {
      layers: [this.FEATURES_FILL_LAYER, this.FEATURES_LINE_LAYER]
    });

    return features as unknown as UrbanFeature[];
  }

  setCursor(cursor: string): void {
    this.mapManager.setCursor(cursor);
  }

  updatePreview(feature: GeoJSON.Feature | null): void {
    const data: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: feature ? [feature] : []
    };
    this.mapManager.updateGeoJSONSource(this.PREVIEW_SOURCE, data);
  }

  clearPreview(): void {
    this.updatePreview(null);
  }
}