/**
 * GridPanel - UI panel for grid generator controls
 *
 * Features:
 * - Variant slider (global)
 * - Per-sub-polygon variant controls
 * - Statistics display
 * - Clear button
 */

import { eventBus } from '../../../core/EventBus';
import type { GridGeneratorManager } from '../GridGeneratorManager';

export class GridPanel {
  private container: HTMLElement;
  private gridManager: GridGeneratorManager;

  get isVisible(): boolean {
    return !this.container.classList.contains('hidden');
  }

  constructor(containerId: string, gridManager: GridGeneratorManager) {
    const el = document.getElementById(containerId);
    if (!el) {
      // Create container if it doesn't exist
      const panel = document.createElement('div');
      panel.id = containerId;
      panel.className = 'grid-panel';
      document.body.appendChild(panel);
      this.container = panel;
    } else {
      this.container = el;
    }
    this.gridManager = gridManager;
  }

  init(): void {
    this.setupStyles();
    this.setupEventListeners();
    this.hide();
  }

  private setupStyles(): void {
    // Add styles if not already present
    if (document.getElementById('grid-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'grid-panel-styles';
    style.textContent = `
      .grid-panel {
        position: absolute;
        bottom: 40px;
        left: 60px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 16px;
        min-width: 320px;
        max-width: 400px;
        z-index: 100;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .grid-panel.hidden {
        display: none;
      }

      .grid-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e5e7eb;
      }

      .grid-panel-title {
        font-weight: 600;
        font-size: 14px;
        color: #1f2937;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .grid-panel-title::before {
        content: '⊞';
        font-size: 16px;
      }

      .grid-panel-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #6b7280;
        padding: 4px;
        line-height: 1;
      }

      .grid-panel-close:hover {
        color: #1f2937;
      }

      .grid-panel-section {
        margin-bottom: 12px;
      }

      .grid-panel-label {
        font-size: 12px;
        font-weight: 500;
        color: #6b7280;
        margin-bottom: 6px;
      }

      .grid-panel-slider-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .grid-panel-slider {
        flex: 1;
        height: 6px;
        border-radius: 3px;
        -webkit-appearance: none;
        appearance: none;
        background: #e5e7eb;
        outline: none;
      }

      .grid-panel-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #8b5cf6;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }

      .grid-panel-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #8b5cf6;
        cursor: pointer;
        border: none;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }

      .grid-panel-value {
        font-size: 12px;
        font-weight: 600;
        color: #8b5cf6;
        min-width: 60px;
        text-align: right;
      }

      .grid-panel-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #e5e7eb;
      }

      .grid-panel-stat {
        background: #f9fafb;
        border-radius: 6px;
        padding: 8px;
        text-align: center;
      }

      .grid-panel-stat-value {
        font-size: 18px;
        font-weight: 700;
        color: #1f2937;
      }

      .grid-panel-stat-label {
        font-size: 10px;
        color: #6b7280;
        margin-top: 2px;
      }

      .grid-panel-stat.valid .grid-panel-stat-value { color: #16a34a; }
      .grid-panel-stat.invalid .grid-panel-stat-value { color: #dc2626; }
      .grid-panel-stat.blocks .grid-panel-stat-value { color: #8b5cf6; }
      .grid-panel-stat.connections .grid-panel-stat-value { color: #0891b2; }

      .grid-panel-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .grid-panel-btn {
        flex: 1;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .grid-panel-btn.primary {
        background: #8b5cf6;
        color: white;
      }

      .grid-panel-btn.primary:hover {
        background: #7c3aed;
      }

      .grid-panel-btn.secondary {
        background: #f3f4f6;
        color: #374151;
      }

      .grid-panel-btn.secondary:hover {
        background: #e5e7eb;
      }

      .grid-panel-btn.danger {
        background: #fef2f2;
        color: #dc2626;
      }

      .grid-panel-btn.danger:hover {
        background: #fee2e2;
      }

      .grid-panel-subpolygons {
        max-height: 200px;
        overflow-y: auto;
        margin-top: 8px;
      }

      .grid-panel-subpoly {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 8px;
        background: #f9fafb;
        border-radius: 4px;
        margin-bottom: 4px;
        font-size: 11px;
      }

      .grid-panel-subpoly.invalid {
        background: #fef2f2;
        color: #dc2626;
      }

      .grid-panel-subpoly.valid {
        background: #f0fdf4;
      }

      .grid-panel-subpoly-name {
        font-weight: 500;
      }

      .grid-panel-subpoly-variant {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .grid-panel-subpoly-btn {
        background: #e5e7eb;
        border: none;
        border-radius: 3px;
        width: 20px;
        height: 20px;
        cursor: pointer;
        font-size: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .grid-panel-subpoly-btn:hover {
        background: #d1d5db;
      }

      .grid-panel-processing {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 20px;
        color: #6b7280;
        font-size: 12px;
      }

      .grid-panel-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #e5e7eb;
        border-top-color: #8b5cf6;
        border-radius: 50%;
        animation: grid-panel-spin 0.8s linear infinite;
      }

      @keyframes grid-panel-spin {
        to { transform: rotate(360deg); }
      }

      .grid-panel-empty {
        text-align: center;
        padding: 24px;
        color: #9ca3af;
        font-size: 12px;
      }

      .grid-panel-empty-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }
    `;
    document.head.appendChild(style);
  }

  private setupEventListeners(): void {
    eventBus.on('grid-gen:processing:start', () => {
      this.show();
      this.renderProcessing();
    });

    eventBus.on('grid-gen:processing:complete', () => {
      this.render();
    });

    eventBus.on('grid-gen:variant:changed', () => {
      this.render();
    });

    eventBus.on('grid-gen:global-variant:changed', () => {
      this.render();
    });

    eventBus.on('grid-gen:cleared', () => {
      this.hide();
    });

    eventBus.on('grid-gen:tool:activated', () => {
      // Show empty state when tool activated
      this.show();
      this.renderEmpty();
    });

    eventBus.on('grid-gen:tool:deactivated', () => {
      // Keep panel visible if there's data
      const state = this.gridManager.getState();
      if (state.subPolygons.length === 0) {
        this.hide();
      }
    });
  }

  show(): void {
    this.container.classList.remove('hidden');
  }

  hide(): void {
    this.container.classList.add('hidden');
  }

  private renderProcessing(): void {
    this.container.innerHTML = `
      <div class="grid-panel-header">
        <span class="grid-panel-title">Grid Generator</span>
      </div>
      <div class="grid-panel-processing">
        <div class="grid-panel-spinner"></div>
        <span>Processing polygon...</span>
      </div>
    `;
  }

  private renderEmpty(): void {
    this.container.innerHTML = `
      <div class="grid-panel-header">
        <span class="grid-panel-title">Grid Generator</span>
        <button class="grid-panel-close" onclick="this.closest('.grid-panel').classList.add('hidden')">&times;</button>
      </div>
      <div class="grid-panel-empty">
        <div class="grid-panel-empty-icon">⬡</div>
        <div>Draw a polygon to generate grid</div>
        <div style="margin-top: 4px; font-size: 10px;">Click to add points, double-click to finish</div>
      </div>
    `;
  }

  render(): void {
    const state = this.gridManager.getState();
    const stats = this.gridManager.getStats();

    if (state.subPolygons.length === 0) {
      this.renderEmpty();
      return;
    }

    const validPolygons = state.subPolygons.filter((p) => p.isValid);
    const totalVariants = validPolygons.reduce(
      (sum, p) => sum + (p.variants?.length || 1),
      0
    );

    this.container.innerHTML = `
      <div class="grid-panel-header">
        <span class="grid-panel-title">Grid Generator</span>
        <button class="grid-panel-close" id="grid-panel-close">&times;</button>
      </div>

      ${
        totalVariants > 1
          ? `
        <div class="grid-panel-section">
          <div class="grid-panel-label">Global Variant</div>
          <div class="grid-panel-slider-row">
            <input type="range" class="grid-panel-slider" id="global-variant-slider"
              min="0" max="${totalVariants - 1}" value="${state.currentGlobalVariant}">
            <span class="grid-panel-value">${state.currentGlobalVariant + 1} / ${totalVariants}</span>
          </div>
        </div>
      `
          : ''
      }

      <div class="grid-panel-section">
        <div class="grid-panel-label">Sub-polygons</div>
        <div class="grid-panel-subpolygons">
          ${state.subPolygons
            .map(
              (p, idx) => `
            <div class="grid-panel-subpoly ${p.isValid ? 'valid' : 'invalid'}">
              <span class="grid-panel-subpoly-name">
                ${p.isValid ? '✓' : '✗'} Polygon ${idx + 1}
              </span>
              ${
                p.isValid && p.variants && p.variants.length > 1
                  ? `
                <div class="grid-panel-subpoly-variant">
                  <button class="grid-panel-subpoly-btn" data-poly="${p.id}" data-action="prev">◀</button>
                  <span>${p.currentVariant + 1}/${p.variants.length}</span>
                  <button class="grid-panel-subpoly-btn" data-poly="${p.id}" data-action="next">▶</button>
                </div>
              `
                  : p.isValid
                  ? '<span style="color: #9ca3af;">1 variant</span>'
                  : '<span>Collides with road</span>'
              }
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="grid-panel-stats">
        <div class="grid-panel-stat valid">
          <div class="grid-panel-stat-value">${stats.validSubPolygons}</div>
          <div class="grid-panel-stat-label">Valid Areas</div>
        </div>
        <div class="grid-panel-stat invalid">
          <div class="grid-panel-stat-value">${stats.totalSubPolygons - stats.validSubPolygons}</div>
          <div class="grid-panel-stat-label">Excluded</div>
        </div>
        <div class="grid-panel-stat blocks">
          <div class="grid-panel-stat-value">${stats.totalBlocks}</div>
          <div class="grid-panel-stat-label">Blocks</div>
        </div>
        <div class="grid-panel-stat connections">
          <div class="grid-panel-stat-value">${stats.totalConnections}</div>
          <div class="grid-panel-stat-label">Connections</div>
        </div>
      </div>

      <div class="grid-panel-actions">
        <button class="grid-panel-btn danger" id="grid-clear-btn">Clear</button>
      </div>
    `;

    this.setupPanelEvents();
  }

  private setupPanelEvents(): void {
    // Close button
    const closeBtn = document.getElementById('grid-panel-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.hide();
    }

    // Global variant slider
    const slider = document.getElementById(
      'global-variant-slider'
    ) as HTMLInputElement;
    if (slider) {
      slider.oninput = () => {
        this.gridManager.setGlobalVariant(parseInt(slider.value));
      };
    }

    // Per-polygon variant buttons
    const variantBtns = this.container.querySelectorAll(
      '.grid-panel-subpoly-btn'
    );
    variantBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const polyId = target.dataset.poly!;
        const action = target.dataset.action!;

        const state = this.gridManager.getState();
        const poly = state.subPolygons.find((p) => p.id === polyId);
        if (!poly || !poly.variants) return;

        let newVariant = poly.currentVariant;
        if (action === 'prev') {
          newVariant = Math.max(0, newVariant - 1);
        } else {
          newVariant = Math.min(poly.variants.length - 1, newVariant + 1);
        }

        this.gridManager.setSubPolygonVariant(polyId, newVariant);
      });
    });

    // Clear button
    const clearBtn = document.getElementById('grid-clear-btn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        this.gridManager.clear();
      };
    }
  }

  destroy(): void {
    this.container.innerHTML = '';
    const styles = document.getElementById('grid-panel-styles');
    if (styles) styles.remove();
  }
}
