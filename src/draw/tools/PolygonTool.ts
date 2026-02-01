/**
 * PolygonTool - draw polygons
 *
 * Usage:
 * - Click to add points
 * - Double-click or Enter to complete (min 3 points)
 * - Backspace to remove last point
 * - Escape to cancel
 */

import { eventBus } from '../../core/EventBus';
import { commandManager, AddFeatureCommand } from '../../core/commands';
import { BaseDrawTool } from './BaseTool';
import type { IDrawManager } from './BaseTool';
import type { MapClickEvent, UrbanFeature } from '../../types';
import type { FeatureStore } from '../../data/FeatureStore';

export class PolygonTool extends BaseDrawTool {
  readonly id = 'polygon';
  readonly name = 'Polygon';

  private featureStore: FeatureStore;

  constructor(manager: IDrawManager, featureStore: FeatureStore) {
    super(manager);
    this.featureStore = featureStore;
  }

  onMapDoubleClick(_e: MapClickEvent): void {
    // Remove the extra point added by the double-click
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

    // Not enough points for any geometry
    if (coords.length < 2) return null;

    // Show as line until we have 3 points
    if (coords.length < 3) {
      return {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coords
        }
      };
    }

    // Show as closed polygon
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[...coords, coords[0]]]
      }
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

    // Use command for undo/redo support
    commandManager.execute(new AddFeatureCommand(this.featureStore, polygon));
    eventBus.emit('draw:polygon:complete', polygon);

    this.reset();
    this.manager.clearPreview();
  }
}
