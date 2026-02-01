/**
 * AddFeatureCommand - add a feature to the store
 */

import { BaseCommand } from './Command';
import type { FeatureStore } from '../../data/FeatureStore';
import type { UrbanFeature } from '../../types';

export class AddFeatureCommand extends BaseCommand {
  readonly type = 'feature:add';
  readonly description: string;

  private featureStore: FeatureStore;
  private feature: UrbanFeature;
  private featureId: string;

  constructor(featureStore: FeatureStore, feature: UrbanFeature) {
    super();
    this.featureStore = featureStore;
    this.feature = feature;
    this.featureId = feature.properties?.id ?? '';

    const featureType = feature.properties?.type ?? 'feature';
    this.description = `Add ${featureType}`;
  }

  execute(): void {
    this.featureStore.add(this.feature);
  }

  undo(): void {
    this.featureStore.remove(this.featureId);
  }
}
