/**
 * DrawManager - coordinates drawing tools and layers
 */

import { eventBus } from '../core/EventBus';
import { Config } from '../core/Config';
import type { MapManager } from '../map/MapManager';
import type { FeatureStore } from '../data/FeatureStore';
import { FeaturesLayer } from './layers/FeaturesLayer';
import { PreviewLayer } from './layers/PreviewLayer';
import { BaseTool, type IDrawManager } from './tools/BaseTool';
import { SelectTool } from './tools/SelectTool';
import { PolygonTool } from './tools/PolygonTool';
import { LineTool } from './tools/LineTool';
import type { MapClickEvent, MapMouseEvent } from '../types';

export class DrawManager implements IDrawManager {
  private mapManager: MapManager;
  private featureStore: FeatureStore;
  
  private featuresLayer: FeaturesLayer;
  private previewLayer: PreviewLayer;
  
  private tools = new Map<string, BaseTool>();
  private activeTool: BaseTool | null = null;

  constructor(mapManager: MapManager, featureStore: FeatureStore) {
    this.mapManager = mapManager;
    this.featureStore = featureStore;
    
    this.featuresLayer = new FeaturesLayer(mapManager, featureStore);
    this.previewLayer = new PreviewLayer(mapManager);
    
    this.init();
  }

  private init(): void {
    this.featuresLayer.init();
    this.previewLayer.init();
    this.registerTools();
    this.setupEventListeners();
    this.mapManager.disableDoubleClickZoom();
    this.activateTool('select');
  }

  private registerTools(): void {
    this.registerTool(new SelectTool(this, this.featureStore));
    this.registerTool(new PolygonTool(this, this.featureStore));
    this.registerTool(new LineTool(this, this.featureStore));
    console.log('Tools registered:', Array.from(this.tools.keys()));
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key === 'Escape' && this.activeTool?.id !== 'select') {
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

    const interactiveLayers = this.featuresLayer.getInteractiveLayers();
    console.log('Setting up hover for layers:', interactiveLayers);

    // Hover only for drawn features (user's polygons/lines)
    // Vector tile layers (osi-sush) are handled by FeaturePopup
    map.on('mousemove', (e) => {
      if (this.activeTool?.id !== 'select') return;

      const existingLayers = interactiveLayers.filter(id => map.getLayer(id));
      if (existingLayers.length === 0) return;

      const features = map.queryRenderedFeatures(e.point, {
        layers: existingLayers
      });

      if (features.length > 0) {
        this.setCursor(Config.cursors.pointer);
      }
      // Don't reset cursor here - let FeaturePopup handle osi-sush hover
    });
  }

  registerTool(tool: BaseTool): void {
    this.tools.set(tool.id, tool);
  }

  activateTool(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (!tool) {
      console.warn(`Tool "${toolId}" not found`);
      return;
    }

    console.log(`Activating tool: ${toolId}, cursor: ${tool.cursor}`);
    
    this.activeTool?.deactivate();
    this.activeTool = tool;
    tool.activate();
    
    eventBus.emit('tool:activate', toolId);
  }

  deactivateTool(): void {
    this.activeTool?.deactivate();
    this.activateTool('select');
    eventBus.emit('tool:deactivate');
  }

  getActiveTool(): BaseTool | null {
    return this.activeTool;
  }

  getTool(id: string): BaseTool | undefined {
    return this.tools.get(id);
  }

  getToolIds(): string[] {
    return Array.from(this.tools.keys());
  }

  setCursor(cursor: string): void {
    this.mapManager.setCursor(cursor);
  }

  updatePreview(feature: GeoJSON.Feature | null): void {
    this.previewLayer.update(feature);
  }

  clearPreview(): void {
    this.previewLayer.clear();
  }

  selectFeature(id: string): void {
    this.featuresLayer.selectFeature(id);
  }

  clearSelection(): void {
    this.featuresLayer.clearSelection();
  }

  getSelectedIds(): string[] {
    return this.featuresLayer.getSelectedIds();
  }

  queryFeaturesAtPoint(point: { x: number; y: number }): any[] {
    return this.featuresLayer.queryAtPoint(point);
  }
}