/**
 * LayerPanel - UI for vector tile layer management
 * 
 * Features:
 * - Toggle layer visibility
 * - Change layer color and width (editable layers)
 * - Reorder layers
 * - Show category legend (OSI roads)
 */

import { BasePanel } from '../base/BasePanel';
import type { LayerManager } from '../../layers/LayerManager';
import type { VectorLayerConfig } from '../../layers/LayerConfig';
import { app } from '../../core/App';

// ============================================
// Icons
// ============================================
const ICONS = {
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>`,
  chevronUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="18 15 12 9 6 15"/>
  </svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="6 9 12 15 18 9"/>
  </svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`,
  road: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M5 4v16M19 4v16M12 4v4M12 12v4M12 20v-1"/>
  </svg>`,
  line: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="5" y1="19" x2="19" y2="5"/>
  </svg>`,
  map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
    <line x1="8" y1="2" x2="8" y2="18"/>
    <line x1="16" y1="6" x2="16" y2="22"/>
  </svg>`,
  satellite: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>`
};

export class LayerPanel extends BasePanel {
  private layerManager: LayerManager;
  private expandedLayers = new Set<string>();
  private currentBasemap: 'osm' | 'satellite' = 'osm';

  constructor(containerId: string, layerManager: LayerManager) {
    super({ containerId, title: 'Vector Layers' });
    this.layerManager = layerManager;
  }

  protected render(): void {
    const layers = this.layerManager.getLayers();

    this.container.innerHTML = `
      <div class="layer-panel">
        ${this.renderBasemapSwitcher()}
        <div class="layer-panel-header">
          <span>Vector Layers</span>
        </div>
        <div class="layer-list">
          ${layers.length > 0
            ? layers.map(layer => this.renderLayerItem(layer)).join('')
            : '<div class="layer-empty">No vector layers available</div>'
          }
        </div>
      </div>
    `;
  }

  private renderBasemapSwitcher(): string {
    return `
      <div class="basemap-switcher">
        <div class="basemap-label">Basemap</div>
        <div class="basemap-options">
          <button class="basemap-btn ${this.currentBasemap === 'osm' ? 'active' : ''}"
                  data-basemap="osm" title="OpenStreetMap">
            ${ICONS.map}
            <span>Map</span>
          </button>
          <button class="basemap-btn ${this.currentBasemap === 'satellite' ? 'active' : ''}"
                  data-basemap="satellite" title="Satellite">
            ${ICONS.satellite}
            <span>Satellite</span>
          </button>
        </div>
      </div>
    `;
  }

  private renderLayerItem(config: VectorLayerConfig): string {
    const state = this.layerManager.getLayerState(config.id);
    if (!state) return '';

    const isVisible = state.visible;
    const isExpanded = this.expandedLayers.has(config.id);
    const hasCategoryStyles = config.categoryField && config.categoryStyles;
    const icon = config.sourceLayer.includes('osi') ? ICONS.road : ICONS.line;

    return `
      <div class="layer-item ${isVisible ? '' : 'layer-hidden'}" data-layer-id="${config.id}">
        <div class="layer-item-header">
          <button class="layer-btn visibility-btn" data-action="toggle-visibility" title="${isVisible ? 'Hide' : 'Show'}">
            ${isVisible ? ICONS.eye : ICONS.eyeOff}
          </button>
          
          <span class="layer-icon">${icon}</span>
          <span class="layer-name">${config.name}</span>
          
          <div class="layer-actions">
            <button class="layer-btn" data-action="move-up" title="Move Up">
              ${ICONS.chevronUp}
            </button>
            <button class="layer-btn" data-action="move-down" title="Move Down">
              ${ICONS.chevronDown}
            </button>
            ${config.editable || hasCategoryStyles ? `
              <button class="layer-btn expand-btn ${isExpanded ? 'expanded' : ''}" data-action="toggle-expand" title="Settings">
                ${ICONS.settings}
              </button>
            ` : ''}
          </div>
        </div>
        
        ${isExpanded ? this.renderLayerSettings(config) : ''}
      </div>
    `;
  }

  private renderLayerSettings(config: VectorLayerConfig): string {
    const state = this.layerManager.getLayerState(config.id);
    if (!state) return '';

    // Category legend for OSI roads
    if (config.categoryField && config.categoryStyles) {
      return this.renderCategoryLegend(config);
    }

    // Editable controls
    return `
      <div class="layer-settings">
        <div class="setting-row">
          <label>Color</label>
          <input type="color" class="color-picker" data-action="change-color" value="${state.style.color}">
        </div>
        <div class="setting-row">
          <label>Width</label>
          <input type="range" class="width-slider" data-action="change-width" 
                 min="1" max="10" step="0.5" value="${state.style.width ?? 2}">
          <span class="width-value">${state.style.width ?? 2}px</span>
        </div>
      </div>
    `;
  }

  private renderCategoryLegend(config: VectorLayerConfig): string {
    if (!config.categoryStyles) return '';

    const legendItems = Object.entries(config.categoryStyles)
      .map(([_, style]) => `
        <div class="legend-item">
          <span class="legend-line" style="background: ${style.color}; height: ${Math.min(style.width, 6)}px;"></span>
          <span class="legend-label">${style.label}</span>
        </div>
      `)
      .join('');

    return `
      <div class="layer-settings">
        <div class="category-legend">
          <div class="legend-title">Categories (${config.categoryField})</div>
          ${legendItems}
        </div>
      </div>
    `;
  }

  protected setupEventListeners(): void {
    // Click handlers for layer actions
    this.container.addEventListener('click', (e) => {
      // Basemap switcher
      const basemapBtn = (e.target as HTMLElement).closest('[data-basemap]') as HTMLElement;
      if (basemapBtn) {
        const basemap = basemapBtn.dataset.basemap as 'osm' | 'satellite';
        this.setBasemap(basemap);
        return;
      }

      // Layer actions
      const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement;
      if (!btn) return;

      const layerItem = btn.closest('.layer-item') as HTMLElement;
      const layerId = layerItem?.dataset.layerId;
      if (!layerId) return;

      this.handleAction(btn.dataset.action!, layerId);
    });

    // Width slider - update display on input (no re-render)
    this.container.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.dataset.action !== 'change-width') return;

      const width = parseFloat(target.value);
      const valueSpan = target.parentElement?.querySelector('.width-value');
      if (valueSpan) valueSpan.textContent = `${width}px`;
    });

    // Apply style changes on change event (after drag ends)
    this.container.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const layerItem = target.closest('.layer-item') as HTMLElement;
      const layerId = layerItem?.dataset.layerId;
      if (!layerId) return;

      if (target.dataset.action === 'change-color') {
        this.layerManager.updateStyle(layerId, { color: target.value });
      } else if (target.dataset.action === 'change-width') {
        const width = parseFloat(target.value);
        this.layerManager.updateStyle(layerId, { width });
      }
    });

    // Re-render on layer changes (except style - handled above)
    this.subscribe('layer:visibility:changed', () => this.render());
    this.subscribe('layer:order:changed', () => this.render());

    // Sync basemap state
    this.subscribe('map:basemap:changed', ({ type }: { type: 'osm' | 'satellite' }) => {
      this.currentBasemap = type;
      this.render();
    });
  }

  private setBasemap(type: 'osm' | 'satellite'): void {
    if (this.currentBasemap === type) return;

    const mapManager = app.getMapManager();
    if (mapManager) {
      mapManager.setBasemap(type);
      this.currentBasemap = type;
      this.render();
    }
  }

  private handleAction(action: string, layerId: string): void {
    switch (action) {
      case 'toggle-visibility':
        this.layerManager.toggleVisibility(layerId);
        break;
      case 'move-up':
        this.layerManager.moveUp(layerId);
        break;
      case 'move-down':
        this.layerManager.moveDown(layerId);
        break;
      case 'toggle-expand':
        if (this.expandedLayers.has(layerId)) {
          this.expandedLayers.delete(layerId);
        } else {
          this.expandedLayers.add(layerId);
        }
        this.render();
        break;
    }
  }
}
