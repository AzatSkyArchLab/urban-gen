/**
 * SelectTool - selection and navigation tool
 * 
 * Features:
 * - Click to select features
 * - Delete selected with Delete/Backspace
 * - Escape to clear selection
 */

import { Config } from '../../core/Config';
import { BaseTool } from './BaseTool';
import type { IDrawManager } from './BaseTool';
import type { MapClickEvent } from '../../types';
import type { FeatureStore } from '../../data/FeatureStore';

export class SelectTool extends BaseTool {
  readonly id = 'select';
  readonly name = 'Select';
  readonly cursor = Config.cursors.grab;

  private featureStore: FeatureStore;

  constructor(manager: IDrawManager, featureStore: FeatureStore) {
    super(manager);
    this.featureStore = featureStore;
  }

  onMapClick(e: MapClickEvent): void {
    const features = this.manager.queryFeaturesAtPoint(e.point);
    
    if (features.length > 0) {
      const id = features[0].properties?.id;
      if (id) {
        this.manager.selectFeature(id);
      }
    } else {
      this.manager.clearSelection();
    }
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.deleteSelected();
    } else if (e.key === 'Escape') {
      this.manager.clearSelection();
    }
  }

  private deleteSelected(): void {
    const selectedIds = this.manager.getSelectedIds();
    
    for (const id of selectedIds) {
      this.featureStore.remove(id);
    }
    
    this.manager.clearSelection();
  }
}
