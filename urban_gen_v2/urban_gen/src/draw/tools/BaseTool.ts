/**
 * BaseTool & BaseDrawTool - abstract base classes for tools
 * 
 * BaseTool - base for all tools (select, etc.)
 * BaseDrawTool - base for drawing tools (polygon, line, etc.)
 */

import { eventBus } from '../../core/EventBus';
import { Config } from '../../core/Config';
import type { Coordinate, Tool, MapClickEvent, MapMouseEvent } from '../../types';

// ============================================
// DrawManager Interface (to avoid circular deps)
// ============================================
export interface IDrawManager {
  setCursor(cursor: string): void;
  updatePreview(feature: GeoJSON.Feature | null): void;
  clearPreview(): void;
  selectFeature(id: string): void;
  clearSelection(): void;
  getSelectedIds(): string[];
  queryFeaturesAtPoint(point: { x: number; y: number }): any[];
}

// ============================================
// BaseTool
// ============================================
export abstract class BaseTool implements Tool {
  abstract readonly id: string;
  abstract readonly name: string;
  readonly cursor: string = Config.cursors.default;
  
  protected manager: IDrawManager;
  protected isActive = false;

  constructor(manager: IDrawManager) {
    this.manager = manager;
  }

  activate(): void {
    this.isActive = true;
    this.manager.setCursor(this.cursor);
    eventBus.emit('tool:activated', { id: this.id, cursor: this.cursor });
  }

  deactivate(): void {
    this.isActive = false;
    eventBus.emit('tool:deactivated', { id: this.id });
  }

  // Optional handlers - override in subclasses
  onMapClick?(e: MapClickEvent): void;
  onMapDoubleClick?(e: MapClickEvent): void;
  onMapMouseMove?(e: MapMouseEvent): void;
  onKeyDown?(e: KeyboardEvent): void;
}

// ============================================
// BaseDrawTool
// ============================================
export abstract class BaseDrawTool extends BaseTool {
  readonly cursor = Config.cursors.crosshair;
  
  protected points: Coordinate[] = [];
  protected tempPoint: Coordinate | null = null;

  activate(): void {
    super.activate();
    this.reset();
    eventBus.emit('draw:start');
  }

  deactivate(): void {
    super.deactivate();
    this.reset();
    this.manager.clearPreview();
    eventBus.emit('draw:end');
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
      eventBus.emit('draw:cancelled');
    } else if (e.key === 'Backspace' && this.points.length > 0) {
      e.preventDefault();
      this.points.pop();
      this.manager.updatePreview(this.getPreviewGeometry());
      eventBus.emit('draw:point:removed', { total: this.points.length });
    }
  }

  protected reset(): void {
    this.points = [];
    this.tempPoint = null;
  }

  /**
   * Get current preview geometry - implement in subclass
   */
  protected abstract getPreviewGeometry(): GeoJSON.Feature | null;

  /**
   * Complete the drawing - implement in subclass
   */
  protected abstract complete(): void;
}
