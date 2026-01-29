/**
 * FeatureStore - хранилище нарисованных объектов
 * 
 * Ответственности:
 * - CRUD операции с features
 * - Эмит событий при изменениях
 * - Сериализация/десериализация
 */

import { eventBus } from '../core/EventBus';
import type { UrbanFeature } from '../types';

export class FeatureStore {
  private features: Map<string, UrbanFeature> = new Map();

  /**
   * Add a feature
   */
  add(feature: UrbanFeature): void {
    const id = feature.properties?.id;
    if (!id) {
      console.warn('Feature has no ID, skipping');
      return;
    }
    
    this.features.set(id, feature);
    eventBus.emit('features:changed');
    eventBus.emit('feature:added', { id, feature });
  }

  /**
   * Remove a feature by ID
   */
  remove(id: string): boolean {
    if (!this.features.has(id)) return false;
    
    this.features.delete(id);
    eventBus.emit('features:changed');
    eventBus.emit('feature:removed', { id });
    return true;
  }

  /**
   * Get a feature by ID
   */
  get(id: string): UrbanFeature | undefined {
    return this.features.get(id);
  }

  /**
   * Update feature properties
   */
  update(id: string, updates: Partial<UrbanFeature['properties']>): boolean {
    const feature = this.features.get(id);
    if (!feature) return false;

    feature.properties = {
      ...feature.properties,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    eventBus.emit('features:changed');
    eventBus.emit('feature:updated', { id, feature });
    return true;
  }

  /**
   * Get all features as GeoJSON FeatureCollection
   */
  getAll(): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: Array.from(this.features.values())
    };
  }

  /**
   * Get features as array
   */
  toArray(): UrbanFeature[] {
    return Array.from(this.features.values());
  }

  /**
   * Get feature IDs
   */
  getIds(): string[] {
    return Array.from(this.features.keys());
  }

  /**
   * Check if feature exists
   */
  has(id: string): boolean {
    return this.features.has(id);
  }

  /**
   * Get feature count
   */
  count(): number {
    return this.features.size;
  }

  /**
   * Clear all features
   */
  clear(): void {
    this.features.clear();
    eventBus.emit('features:changed');
    eventBus.emit('features:cleared');
  }

  /**
   * Import features from GeoJSON
   */
  import(geojson: GeoJSON.FeatureCollection): void {
    for (const feature of geojson.features) {
      if (feature.properties?.id) {
        this.features.set(feature.properties.id, feature as UrbanFeature);
      }
    }
    eventBus.emit('features:changed');
    eventBus.emit('features:imported', { count: geojson.features.length });
  }

  /**
   * Export features to GeoJSON string
   */
  export(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }
}

// Singleton instance
export const featureStore = new FeatureStore();
