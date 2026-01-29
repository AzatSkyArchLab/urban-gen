import { eventBus } from '../../core/EventBus';
import { Config } from '../../core/Config';
import { featureStore } from '../../data/FeatureStore';
import { BaseDrawTool, IDrawManager } from '../BaseTool';
import type { MapClickEvent, UrbanFeature } from '../../types';

export class LineTool extends BaseDrawTool {
  id = 'line';
  name = 'Line';
  cursor = Config.cursors.crosshair;

  constructor(manager: IDrawManager) {
    super(manager);
  }

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