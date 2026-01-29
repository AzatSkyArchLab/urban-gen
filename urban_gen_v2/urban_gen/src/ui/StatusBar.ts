/**
 * StatusBar - displays current status
 * 
 * Shows:
 * - Mouse coordinates
 * - Zoom level
 * - Active tool
 */

import { eventBus } from '../core/EventBus';

interface StatusElements {
  coords: HTMLElement | null;
  zoom: HTMLElement | null;
  tool: HTMLElement | null;
}

export class StatusBar {
  private container: HTMLElement;
  private elements: StatusElements = { coords: null, zoom: null, tool: null };

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`StatusBar container #${containerId} not found`);
    this.container = el;
  }

  init(): void {
    this.render();
    this.cacheElements();
    this.setupEventListeners();
  }

  private render(): void {
    this.container.innerHTML = `
      <span class="status-item" id="status-coords">0.00000, 0.00000</span>
      <span class="status-item" id="status-zoom">Zoom: 14.0</span>
      <span class="status-item" id="status-tool">Tool: Select</span>
    `;
  }

  private cacheElements(): void {
    this.elements = {
      coords: document.getElementById('status-coords'),
      zoom: document.getElementById('status-zoom'),
      tool: document.getElementById('status-tool')
    };
  }

  private setupEventListeners(): void {
    // Mouse move → update coordinates
    eventBus.on('map:mousemove', ({ lngLat }: { lngLat: { lng: number; lat: number } }) => {
      this.updateCoords(lngLat.lng, lngLat.lat);
    });

    // Map move → update zoom
    eventBus.on('map:moveend', ({ zoom }: { zoom: number }) => {
      this.updateZoom(zoom);
    });

    // Tool change → update tool name
    eventBus.on('tool:activated', ({ id }: { id: string }) => {
      this.updateTool(id);
    });

    eventBus.on('tool:deactivated', () => {
      this.updateTool('select');
    });
  }

  private updateCoords(lng: number, lat: number): void {
    if (this.elements.coords) {
      this.elements.coords.textContent = `${lng.toFixed(5)}, ${lat.toFixed(5)}`;
    }
  }

  private updateZoom(zoom: number): void {
    if (this.elements.zoom) {
      this.elements.zoom.textContent = `Zoom: ${zoom.toFixed(1)}`;
    }
  }

  private updateTool(toolId: string): void {
    if (!this.elements.tool) return;
    
    const names: Record<string, string> = {
      select: 'Select',
      polygon: 'Polygon',
      line: 'Line'
    };
    
    this.elements.tool.textContent = `Tool: ${names[toolId] ?? toolId}`;
  }
}
