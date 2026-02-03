/**
 * GridGeneratorTool - drawing tool for grid generation
 *
 * Extends PolygonTool behavior:
 * - Click to add points
 * - Double-click or Enter to complete
 * - On complete: process polygon through GridGeneratorManager
 */

import { eventBus } from '../../core/EventBus';
import { Config } from '../../core/Config';
import type { Coordinate, MapClickEvent, MapMouseEvent } from '../../types';
import { BaseTool, type IDrawManager } from '../../draw/tools/BaseTool';
import { GridGeneratorManager } from './GridGeneratorManager';
import type { MapManager } from '../../map/MapManager';

export class GridGeneratorTool extends BaseTool {
  readonly id = 'grid-generator';
  readonly name = 'Grid Generator';
  readonly cursor = Config.cursors.crosshair;

  private points: Coordinate[] = [];
  private tempPoint: Coordinate | null = null;
  private gridManager: GridGeneratorManager;
  private _mapManager: MapManager; // Stored for potential future use

  constructor(
    drawManager: IDrawManager,
    mapManager: MapManager,
    gridManager: GridGeneratorManager
  ) {
    super(drawManager);
    this._mapManager = mapManager;
    this.gridManager = gridManager;
  }

  activate(): void {
    super.activate();
    this.reset();
    eventBus.emit('draw:start');
    eventBus.emit('grid-gen:tool:activated');
  }

  deactivate(): void {
    super.deactivate();
    this.reset();
    this.manager.clearPreview();
    eventBus.emit('draw:end');
    eventBus.emit('grid-gen:tool:deactivated');
  }

  onMapClick(e: MapClickEvent): void {
    const coord: Coordinate = [e.lngLat.lng, e.lngLat.lat];
    this.points.push(coord);
    this.manager.updatePreview(this.getPreviewGeometry());
    eventBus.emit('draw:point:added', { point: coord, total: this.points.length });
  }

  onMapDoubleClick(_e: MapClickEvent): void {
    // Prevent adding the double-click point
    if (this.points.length >= 3) {
      this.complete();
    }
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
    } else if (e.key === 'Enter' && this.points.length >= 3) {
      this.complete();
    } else if (e.key === 'Delete' || (e.key === 'Backspace' && this.points.length === 0)) {
      // Delete the grid generation result if no points are being drawn
      e.preventDefault();
      this.gridManager.clear();
    }
  }

  private getPreviewGeometry(): GeoJSON.Feature | null {
    if (this.points.length === 0) return null;

    const allPoints = this.tempPoint
      ? [...this.points, this.tempPoint]
      : this.points;

    if (allPoints.length < 2) {
      return {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: allPoints[0]
        }
      };
    }

    // Show as polygon if we have 3+ points
    if (allPoints.length >= 3) {
      return {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[...allPoints, allPoints[0]]]
        }
      };
    }

    // Show as line if only 2 points
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: allPoints
      }
    };
  }

  private complete(): void {
    if (this.points.length < 3) return;

    // Create a copy of points
    const polygonCoords = [...this.points];

    // Clear preview
    this.manager.clearPreview();

    // Process through grid manager
    this.gridManager.processPolygon(polygonCoords);

    // Reset for next polygon
    this.reset();

    eventBus.emit('grid-gen:polygon:completed', {
      pointCount: polygonCoords.length
    });
  }

  private reset(): void {
    this.points = [];
    this.tempPoint = null;
  }

  /**
   * Get the grid manager for external access
   */
  getGridManager(): GridGeneratorManager {
    return this.gridManager;
  }

  /**
   * Get the map manager for external access
   */
  getMapManager(): MapManager {
    return this._mapManager;
  }
}
