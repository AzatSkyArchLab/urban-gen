import { eventBus } from '../../core/EventBus';
import { Config } from '../../core/Config';
import { featureStore } from '../../data/FeatureStore';
import { BaseDrawTool } from '../BaseTool';
import type { IDrawManager } from '../BaseTool';
import type { MapClickEvent, UrbanFeature } from '../../types';

export class PolygonTool extends BaseDrawTool {
  id = 'polygon';
  name = 'Polygon';
  cursor = Config.cursors.crosshair;

  constructor(manager: IDrawManager) {
    super(manager);
  }

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