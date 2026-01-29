import { Config } from '../../core/Config';
import { featureStore } from '../../data/FeatureStore';
import { BaseTool, IDrawManager } from '../BaseTool';
import type { MapClickEvent } from '../../types';

export class SelectTool extends BaseTool {
  id = 'select';
  name = 'Select';
  cursor = Config.cursors.default;

  constructor(manager: IDrawManager) {
    super(manager);
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
      const selectedIds = this.manager.getSelectedIds();
      selectedIds.forEach(id => featureStore.remove(id));
      this.manager.clearSelection();
    } else if (e.key === 'Escape') {
      this.manager.clearSelection();
    }
  }
}