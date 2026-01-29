import { eventBus } from '../core/EventBus';
import { Config } from '../core/Config';
import { featureStore } from '../data/FeatureStore';
import { MapManager } from '../map/MapManager';
import { BaseTool } from './BaseTool';
import type { IDrawManager } from './BaseTool';
import { SelectTool } from './tools/SelectTool';
import { PolygonTool } from './tools/PolygonTool';
import { LineTool } from './tools/LineTool';
import type { MapClickEvent, MapMouseEvent, UrbanFeature } from '../types';

export class DrawManager implements IDrawManager {
  private mapManager: MapManager;
  private tools = new Map<string, BaseTool>();
  private activeTool: BaseTool | null = null;
  private selectedIds = new Set<string>();
  private isHoveringFeature = false;
  
  private readonly PREVIEW_SOURCE = 'draw-preview';
  private readonly PREVIEW_LINE_LAYER = 'draw-preview-line';
  private readonly PREVIEW_FILL_LAYER = 'draw-preview-fill';
  private readonly PREVIEW_POINTS_LAYER = 'draw-preview-points';
  
  private readonly FEATURES_SOURCE = 'features';
  private readonly FEATURES_FILL_LAYER = 'features-fill';
  private readonly FEATURES_LINE_LAYER = 'features-line';
  private readonly FEATURES_LINE_HITBOX_LAYER = 'features-line-hitbox';
  private readonly FEATURES_SELECTED_LAYER = 'features-selected';

  constructor(mapManager: MapManager) {
    this.mapManager = mapManager;
    this.init();
  }

  private init(): void {
    this.registerTools();
    this.setupLayers();
    this.setupEventListeners();
    this.disableMapDoubleClickZoom();
    this.activateTool('select');
  }

  private registerTools(): void {
    this.registerTool(new SelectTool(this));
    this.registerTool(new PolygonTool(this));
    this.registerTool(new LineTool(this));
  }

  private setupLayers(): void {
    this.setupFeaturesLayer();
    this.setupPreviewLayers();
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

    // Fill layer - only for Polygons
    this.mapManager.addLayer({
      id: this.FEATURES_FILL_LAYER,
      type: 'fill',
      source: this.FEATURES_SOURCE,
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.3
      }
    });

    // Line layer - for all features
    this.mapManager.addLayer({
      id: this.FEATURES_LINE_LAYER,
      type: 'line',
      source: this.FEATURES_SOURCE,
      paint: {
        'line-color': '#3b82f6',
        'line-width': 2
      }
    });

    // Invisible hitbox layer for lines (wider for easier selection)
    this.mapManager.addLayer({
      id: this.FEATURES_LINE_HITBOX_LAYER,
      type: 'line',
      source: this.FEATURES_SOURCE,
      paint: {
        'line-color': 'transparent',
        'line-width': 15
      }
    });

    // Selected features highlight
    this.mapManager.addLayer({
      id: this.FEATURES_SELECTED_LAYER,
      type: 'line',
      source: this.FEATURES_SOURCE,
      paint: {
        'line-color': '#f59e0b',
        'line-width': 3
      }
    });

    // Apply geometry type filters
    const map = this.mapManager.getMap();
    if (map) {
      map.setFilter(this.FEATURES_FILL_LAYER, ['==', ['geometry-type'], 'Polygon']);
      map.setFilter(this.FEATURES_LINE_HITBOX_LAYER, ['==', ['geometry-type'], 'LineString']);
    }

    eventBus.on('features:changed', () => {
      this.updateFeaturesLayer();
    });

    eventBus.on('sidebar:feature:click', ({ id }: { id: string }) => {
      if (this.selectedIds.has(id)) {
        this.clearSelection();
      } else {
        this.selectFeature(id);
      }
    });
  }

  private setupPreviewLayers(): void {
    const emptyGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: []
    };

    this.mapManager.addGeoJSONSource(this.PREVIEW_SOURCE, emptyGeoJSON);

    // Preview fill - only for polygons
    this.mapManager.addLayer({
      id: this.PREVIEW_FILL_LAYER,
      type: 'fill',
      source: this.PREVIEW_SOURCE,
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.2
      }
    });

    // Preview line
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

    // Preview points
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

    // Apply filter - fill only for polygons
    const map = this.mapManager.getMap();
    if (map) {
      map.setFilter(this.PREVIEW_FILL_LAYER, ['==', ['geometry-type'], 'Polygon']);
    }
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
      // Global Escape → switch to Select tool
      if (e.key === 'Escape') {
        this.deactivateTool();
        return;
      }
      
      this.activeTool?.onKeyDown?.(e);
    });

    this.setupHoverListeners();
  }

  private setupHoverListeners(): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    const interactiveLayers = [
      this.FEATURES_FILL_LAYER,
      this.FEATURES_LINE_LAYER,
      this.FEATURES_LINE_HITBOX_LAYER
    ];

    // Mouse enter feature
    interactiveLayers.forEach(layer => {
      map.on('mouseenter', layer, () => {
        if (this.activeTool?.id === 'select') {
          this.isHoveringFeature = true;
          this.mapManager.setCursor('pointer');
        }
      });

      map.on('mouseleave', layer, () => {
        if (this.activeTool?.id === 'select') {
          this.isHoveringFeature = false;
          this.mapManager.setCursor('grab');
        }
      });
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

  // ============================================
  // Public API
  // ============================================
  registerTool(tool: BaseTool): void {
    this.tools.set(tool.id, tool);
  }

  activateTool(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (!tool) return;

    this.activeTool?.deactivate();
    this.activeTool = tool;
    tool.activate();
    
    // Set appropriate cursor
    if (toolId === 'select') {
      this.mapManager.setCursor('grab');
    }
    
    eventBus.emit('tool:activate', toolId);
  }

  deactivateTool(): void {
    this.activeTool?.deactivate();
    const selectTool = this.tools.get('select');
    if (selectTool) {
      this.activeTool = selectTool;
      selectTool.activate();
      this.mapManager.setCursor('grab');
    }
  }

  getActiveTool(): BaseTool | null {
    return this.activeTool;
  }

  // ============================================
  // IDrawManager implementation
  // ============================================
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
      layers: [
        this.FEATURES_FILL_LAYER,
        this.FEATURES_LINE_LAYER,
        this.FEATURES_LINE_HITBOX_LAYER
      ]
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