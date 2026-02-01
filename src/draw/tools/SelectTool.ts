/**
 * SelectTool - selection and navigation tool
 *
 * Features:
 * - Click to select features
 * - Delete selected with Delete/Backspace
 * - Escape to clear selection
 */

import { Config } from '../../core/Config';
import { commandManager, RemoveFeatureCommand, BatchCommand } from '../../core/commands';
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
    if (selectedIds.length === 0) return;

    // Create commands for each deletion
    const commands = selectedIds.map(id =>
      new RemoveFeatureCommand(this.featureStore, id)
    );

    // Execute as batch for single undo
    if (commands.length === 1) {
      commandManager.execute(commands[0]);
    } else {
      commandManager.execute(new BatchCommand(commands, `Remove ${commands.length} features`));
    }

    this.manager.clearSelection();
  }
}
