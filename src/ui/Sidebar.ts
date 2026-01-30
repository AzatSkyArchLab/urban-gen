import { eventBus } from '../core/EventBus';
import { featureStore } from '../data/FeatureStore';
import type { UrbanFeature } from '../types';

export class Sidebar {
  private container: HTMLElement;
  private selectedId: string | null = null;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Sidebar container #${containerId} not found`);
    this.container = el;
  }

  init(): void {
    this.render();
    this.setupEventListeners();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="sidebar-section">
        <div class="sidebar-header">Features</div>
        <div class="sidebar-content">
          <div id="feature-list" class="feature-list"></div>
        </div>
      </div>
    `;
    
    this.renderFeatureList();
  }

  private setupEventListeners(): void {
    eventBus.on('features:changed', () => {
      this.renderFeatureList();
    });

    eventBus.on('feature:selected', ({ id }: { id: string }) => {
      this.selectedId = id;
      this.renderFeatureList();
    });

    eventBus.on('feature:deselected', () => {
      this.selectedId = null;
      this.renderFeatureList();
    });

    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      // Delete button
      const deleteBtn = target.closest('[data-action="delete"]');
      if (deleteBtn) {
        const item = deleteBtn.closest('.feature-item') as HTMLElement;
        const id = item?.dataset.id;
        if (id) {
          featureStore.remove(id);
          if (this.selectedId === id) {
            this.selectedId = null;
            eventBus.emit('feature:deselected');
          }
        }
        return;
      }

      // Item selection
      const item = target.closest('.feature-item');
      if (!item) return;

      const id = item.getAttribute('data-id');
      if (id) {
        eventBus.emit('sidebar:feature:click', { id });
      }
    });
  }

  private renderFeatureList(): void {
    const listEl = this.container.querySelector('#feature-list');
    if (!listEl) return;

    const features = featureStore.getAll().features;

    if (features.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⬡</div>
          <div class="empty-state-text">No features yet.<br>Draw a polygon or line.</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = features.map((f, i) => this.renderFeatureItem(f, i)).join('');
  }

  private renderFeatureItem(feature: UrbanFeature, index: number): string {
    const id = feature.properties?.id ?? '';
    const isSelected = id === this.selectedId;
    const type = feature.geometry.type;
    const icon = type === 'Polygon' ? '⬡' : '╱';
    
    return `
      <div class="feature-item ${isSelected ? 'selected' : ''}" data-id="${id}">
        <span class="feature-icon">${icon}</span>
        <span class="feature-name">${type} ${index + 1}</span>
        <button class="feature-delete" data-action="delete" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `;
  }
}
