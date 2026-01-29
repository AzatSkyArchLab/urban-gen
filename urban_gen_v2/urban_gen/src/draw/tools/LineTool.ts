/**
 * LineTool - draw lines/polylines
 * 
 * Usage:
 * - Click to add points
 * - Double-click or Enter to complete (min 2 points)
 * - Backspace to remove last point
 * - Escape to cancel
 */

import { eventBus } from '../../core/EventBus';
import { BaseDrawTool } from './BaseTool';
import type { IDrawManager } from './BaseTool';
import type { MapClickEvent, UrbanFeature } from '../../types';
import type { FeatureStore } from '../../data/FeatureStore';

export class LineTool extends BaseDrawTool {
  readonly id = 'line';
  readonly name = 'Line';

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
      geometry: {
        type: 'LineString',
        coordinates: coords
      }
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

    this.featureStore.add(line);
    eventBus.emit('draw:line:complete', line);
    
    this.reset();
    this.manager.clearPreview();
  }
}
