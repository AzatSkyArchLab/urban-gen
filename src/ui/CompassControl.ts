/**
 * CompassControl - North arrow indicator with reset bearing on click
 *
 * Features:
 * - Shows north direction
 * - Rotates with map bearing
 * - Resets bearing to 0 on click
 */

import { app } from '../core/App';

const COMPASS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <polygon points="12 2 19 21 12 17 5 21" fill="currentColor" stroke="none"/>
</svg>`;

export class CompassControl {
  private container: HTMLElement | null = null;
  private compassEl: HTMLElement | null = null;

  init(): void {
    this.createCompass();
    this.setupEventListeners();
  }

  private createCompass(): void {
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) return;

    this.container = document.createElement('div');
    this.container.className = 'compass-control';
    this.container.innerHTML = `
      <button class="compass-btn" title="Reset to North">
        ${COMPASS_ICON}
      </button>
    `;

    mapContainer.appendChild(this.container);
    this.compassEl = this.container.querySelector('.compass-btn');
  }

  private setupEventListeners(): void {
    // Click to reset bearing
    this.container?.addEventListener('click', () => {
      const mapManager = app.getMapManager();
      mapManager?.resetBearing();
    });

    // Update rotation on map rotate
    const mapManager = app.getMapManager();
    mapManager?.onRotate(() => this.updateRotation());
  }

  private updateRotation(): void {
    const mapManager = app.getMapManager();
    const bearing = mapManager?.getBearing() ?? 0;

    if (this.compassEl) {
      this.compassEl.style.transform = `rotate(${-bearing}deg)`;
    }
  }
}

export const compassControl = new CompassControl();
