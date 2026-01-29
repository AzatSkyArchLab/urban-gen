/**
 * DrawManager - coordinates drawing tools and layers
 * 
 * Responsibilities:
 * - Register and manage tools
 * - Handle tool switching
 * - Coordinate between tools and map layers
 * - Forward map events to active tool
 * 
 * Does NOT:
 * - Store features (that's FeatureStore)
 * - Manage vector tile layers (that's LayerManager)
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
  
  // Layers
  private featuresLayer: FeaturesLayer;
  private previewLayer: PreviewLayer;
  
  // Tools
  private tools = new Map<string, BaseTool>();
  private activeTool: BaseTool | null = null;

  constructor(mapManager: MapManager, featureStore: FeatureStore) {
    this.mapManager = mapManager;
    this.featureStore = featureStore;
    
    // Create layers
    this.featuresLayer = new FeaturesLayer(mapManager, featureStore);
    this.previewLayer = new PreviewLayer(mapManager);
    
    this.init();
  }

  private init(): void {
    // Initialize layers
    this.featuresLayer.init();
    this.previewLayer.init();
    
    // Register tools
    this.registerTools();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Disable double-click zoom (interferes with drawing)
    this.mapManager.disableDoubleClickZoom();
    
    // Start with select tool
    this.activateTool('select');
  }

  private registerTools(): void {
    this.registerTool(new SelectTool(this, this.featureStore));
    this.registerTool(new PolygonTool(this, this.featureStore));
    this.registerTool(new LineTool(this, this.featureStore));
  }

  private setupEventListeners(): void {
    // Forward map events to active tool
    eventBus.on<MapClickEvent>('map:click', (e) => {
      this.activeTool?.onMapClick?.(e);
    });

    eventBus.on<MapClickEvent>('map:dblclick', (e) => {
      this.activeTool?.onMapDoubleClick?.(e);
    });

    eventBus.on<MapMouseEvent>('map:mousemove', (e) => {
      this.activeTool?.onMapMouseMove?.(e);
    });

    // Global keyboard handling
    document.addEventListener('keydown', (e) => {
      // Don't handle if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Global Escape → switch to Select tool
      if (e.key === 'Escape' && this.activeTool?.id !== 'select') {
        this.deactivateTool();
        return;
      }
      
      this.activeTool?.onKeyDown?.(e);
    });

    // Setup hover listeners for select tool
    this.setupHoverListeners();
  }

  private setupHoverListeners(): void {
    const interactiveLayers = this.featuresLayer.getInteractiveLayers();
    
    for (const layerId of interactiveLayers) {
      this.mapManager.onLayerEvent('mouseenter', layerId, () => {
        if (this.activeTool?.id === 'select') {
          this.mapManager.setCursor(Config.cursors.pointer);
        }
      });

      this.mapManager.onLayerEvent('mouseleave', layerId, () => {
        if (this.activeTool?.id === 'select') {
          this.mapManager.setCursor(Config.cursors.grab);
        }
      });
    }
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Register a tool
   */
  registerTool(tool: BaseTool): void {
    this.tools.set(tool.id, tool);
  }

  /**
   * Activate a tool by ID
   */
  activateTool(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (!tool) {
      console.warn(`Tool "${toolId}" not found`);
      return;
    }

    // Deactivate current tool
    this.activeTool?.deactivate();
    
    // Activate new tool
    this.activeTool = tool;
    tool.activate();
    
    // Set appropriate cursor for select tool
    if (toolId === 'select') {
      this.mapManager.setCursor(Config.cursors.grab);
    }
    
    eventBus.emit('tool:activate', toolId);
  }

  /**
   * Deactivate current tool (switch to select)
   */
  deactivateTool(): void {
    this.activeTool?.deactivate();
    this.activateTool('select');
    eventBus.emit('tool:deactivate');
  }

  /**
   * Get active tool
   */
  getActiveTool(): BaseTool | null {
    return this.activeTool;
  }

  /**
   * Get tool by ID
   */
  getTool(id: string): BaseTool | undefined {
    return this.tools.get(id);
  }

  /**
   * Get all registered tool IDs
   */
  getToolIds(): string[] {
    return Array.from(this.tools.keys());
  }

  // ============================================
  // IDrawManager Implementation
  // ============================================

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
