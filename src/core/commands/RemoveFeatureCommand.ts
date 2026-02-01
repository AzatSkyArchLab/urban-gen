/**
 * RemoveFeatureCommand - remove a feature from the store
 */

import { BaseCommand } from './Command';
import type { FeatureStore } from '../../data/FeatureStore';
import type { UrbanFeature } from '../../types';

export class RemoveFeatureCommand extends BaseCommand {
  readonly type = 'feature:remove';
  readonly description: string;

  private featureStore: FeatureStore;
  private featureId: string;
  private savedFeature: UrbanFeature | null = null;

  constructor(featureStore: FeatureStore, featureId: string) {
    super();
    this.featureStore = featureStore;
    this.featureId = featureId;

    // Save feature for undo
    const feature = featureStore.get(featureId);
    if (feature) {
      // Deep clone to preserve state
      this.savedFeature = JSON.parse(JSON.stringify(feature));
    }

    const featureType = feature?.properties?.type ?? 'feature';
    this.description = `Remove ${featureType}`;
  }

  execute(): void {
    // Save feature before removing (in case execute is called again)
    if (!this.savedFeature) {
      const feature = this.featureStore.get(this.featureId);
      if (feature) {
        this.savedFeature = JSON.parse(JSON.stringify(feature));
      }
    }

    this.featureStore.remove(this.featureId);
  }

  undo(): void {
    if (this.savedFeature) {
      this.featureStore.add(this.savedFeature);
    }
  }
}
