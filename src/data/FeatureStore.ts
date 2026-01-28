import { eventBus } from '../core/EventBus';
import type { UrbanFeature, UrbanFeatureCollection } from '../types';

export class FeatureStore {
  private features = new Map<string, UrbanFeature>();

  add(feature: UrbanFeature): void {
    const id = feature.properties?.id ?? crypto.randomUUID();
    feature.properties = { ...feature.properties, id };
    
    this.features.set(id, feature);
    eventBus.emit('features:added', { feature });
    eventBus.emit('features:changed', this.getAll());
  }

  remove(id: string): boolean {
    const deleted = this.features.delete(id);
    if (deleted) {
      eventBus.emit('features:removed', { id });
      eventBus.emit('features:changed', this.getAll());
    }
    return deleted;
  }

  get(id: string): UrbanFeature | undefined {
    return this.features.get(id);
  }

  getAll(): UrbanFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: Array.from(this.features.values())
    };
  }

  clear(): void {
    this.features.clear();
    eventBus.emit('features:cleared');
    eventBus.emit('features:changed', this.getAll());
  }

  count(): number {
    return this.features.size;
  }
}

export const featureStore = new FeatureStore();