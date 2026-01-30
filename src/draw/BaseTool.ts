import { eventBus } from '../core/EventBus';
import { Config } from '../core/Config';
import type { Coordinate, Tool, MapClickEvent, MapMouseEvent } from '../types';

// Forward declaration to avoid circular dependency
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
  abstract id: string;
  abstract name: string;
  cursor: string = Config.cursors.default;
  
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