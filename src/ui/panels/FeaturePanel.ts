/**
 * FeaturePanel - displays list of drawn features
 */

import { eventBus } from '../../core/EventBus';
import { BasePanel } from '../base/BasePanel';
import type { FeatureStore } from '../../data/FeatureStore';
import type { UrbanFeature } from '../../types';

const ICONS = {
  polygon: '⬡',
  line: '╱',
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>`
};

export class FeaturePanel extends BasePanel {
  private featureStore: FeatureStore;
  private selectedId: string | null = null;

  constructor(containerId: string, featureStore: FeatureStore) {
    super({ containerId, title: 'Features' });
    this.featureStore = featureStore;
  }

  protected render(): void {
    this.container.innerHTML = `
      <div class="feature-panel">
        <div class="panel-header">
          <span class="panel-title">Features</span>
          <span class="feature-count">${this.featureStore.count()}</span>
        </div>
        <div class="panel-content">
          <div class="feature-list" id="feature-list"></div>
        </div>
      </div>
    `;
    
    this.renderFeatureList();
  }

  private renderFeatureList(): void {
    const listEl = this.container.querySelector('#feature-list');
    if (!listEl) return;

    const features = this.featureStore.getAll().features;

    if (features.length === 0) {
      listEl.innerHTML = this.renderEmptyState(
        '⬡',
        'No features yet.<br>Draw a polygon or line.'
      );
      return;
    }

    listEl.innerHTML = features
      .map((f, i) => this.renderFeatureItem(f as UrbanFeature, i))
      .join('');
  }

  private renderFeatureItem(feature: UrbanFeature, index: number): string {
    const id = feature.properties?.id ?? '';
    const isSelected = id === this.selectedId;
    const type = feature.geometry.type;
    const icon = type === 'Polygon' ? ICONS.polygon : ICONS.line;
    const name = feature.properties.name || `${type} ${index + 1}`;
    
    return `
      <div class="feature-item ${isSelected ? 'selected' : ''}" data-id="${id}">
        <span class="feature-icon">${icon}</span>
        <span class="feature-name">${name}</span>
        <button class="feature-delete" data-action="delete" title="Delete">
          ${ICONS.trash}
        </button>
      </div>
    `;
  }

  protected setupEventListeners(): void {
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      const deleteBtn = target.closest('[data-action="delete"]');
      if (deleteBtn) {
        e.stopPropagation();
        const item = deleteBtn.closest('.feature-item') as HTMLElement;
        const id = item?.dataset.id;
        if (id) this.deleteFeature(id);
        return;
      }

      const item = target.closest('.feature-item') as HTMLElement;
      if (item) {
        const id = item.dataset.id;
        if (id) this.toggleSelection(id);
      }
    });

    this.subscribe('features:changed', () => this.render());
    
    this.subscribe('feature:selected', ({ id }: { id: string }) => {
      this.selectedId = id;
      this.renderFeatureList();
    });

    this.subscribe('feature:deselected', () => {
      this.selectedId = null;
      this.renderFeatureList();
    });
  }

  private toggleSelection(id: string): void {
    eventBus.emit('sidebar:feature:click', { id });
  }

  private deleteFeature(id: string): void {
    this.featureStore.remove(id);
    
    if (this.selectedId === id) {
      this.selectedId = null;
      eventBus.emit('feature:deselected');
    }
  }
}