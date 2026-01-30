/**
 * Toolbar - tool selection panel
 * 
 * Features:
 * - Tool buttons with icons
 * - Keyboard shortcuts (V, P, L)
 * - Active tool highlighting
 */

import { eventBus } from '../core/EventBus';
import { app } from '../core/App';
import { importDialog } from './dialogs/ImportDialog';

// ============================================
// Icons
// ============================================
const ICONS = {
  select: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
  </svg>`,
  polygon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 2l9 4.5v7L12 22l-9-8.5v-7L12 2z"/>
  </svg>`,
  line: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="5" y1="19" x2="19" y2="5"/>
    <circle cx="5" cy="19" r="2"/>
    <circle cx="19" cy="5" r="2"/>
  </svg>`,
  import: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>`
};

// ============================================
// Tool Configuration
// ============================================
export class Toolbar {
  private container: HTMLElement;
  private activeTool: string = 'select';

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Toolbar container #${containerId} not found`);
    this.container = el;
  }

  init(): void {
    this.render();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
  }

  private render(): void {
    this.container.innerHTML = `
      <button class="tool-btn active" data-tool="select" data-tooltip="Select (V)">
        ${ICONS.select}
      </button>
      <div class="toolbar-divider"></div>
      <button class="tool-btn" data-tool="polygon" data-tooltip="Polygon (P)">
        ${ICONS.polygon}
      </button>
      <button class="tool-btn" data-tool="line" data-tooltip="Line (L)">
        ${ICONS.line}
      </button>
      <div class="toolbar-divider"></div>
      <button class="tool-btn" data-action="import" data-tooltip="Import GeoJSON (I)">
        ${ICONS.import}
      </button>
    `;
  }

  private setupEventListeners(): void {
    // Tool button clicks
    this.container.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.tool-btn') as HTMLElement;
      if (!btn) return;

      // Handle action buttons (import, etc.)
      const action = btn.dataset.action;
      if (action === 'import') {
        importDialog.show();
        return;
      }

      const tool = btn.dataset.tool;
      if (tool) this.selectTool(tool);
    });

    // Sync with DrawManager
    eventBus.on('tool:activated', ({ id }: { id: string }) => {
      this.setActive(id);
    });

    eventBus.on('tool:deactivated', () => {
      this.setActive('select');
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Import shortcut
      if (e.key.toLowerCase() === 'i') {
        importDialog.show();
        return;
      }

      const shortcuts: Record<string, string> = {
        'v': 'select',
        'p': 'polygon',
        'l': 'line'
      };

      const tool = shortcuts[e.key.toLowerCase()];
      if (tool) this.selectTool(tool);
    });
  }

  private selectTool(toolId: string): void {
    const drawManager = app.getDrawManager();
    if (!drawManager) return;

    if (toolId === 'select') {
      drawManager.deactivateTool();
    } else if (this.activeTool === toolId) {
      // Toggle off if same tool clicked
      drawManager.deactivateTool();
    } else {
      drawManager.activateTool(toolId);
    }
  }

  private setActive(toolId: string): void {
    this.activeTool = toolId;
    
    this.container.querySelectorAll('.tool-btn').forEach(btn => {
      const btnTool = btn.getAttribute('data-tool');
      btn.classList.toggle('active', btnTool === toolId);
    });
  }
}
