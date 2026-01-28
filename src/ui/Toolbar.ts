import { eventBus } from '../core/EventBus';
import { app } from '../core/App';

const icons = {
  select: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>`,
  polygon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l9 4.5v7L12 22l-9-8.5v-7L12 2z"/></svg>`,
  line: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="19" x2="19" y2="5"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/></svg>`,
};

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
      <button class="tool-btn active" id="btn-select" data-tool="select" data-tooltip="Select (V)">
        ${icons.select}
      </button>
      <div class="toolbar-divider"></div>
      <button class="tool-btn" id="btn-polygon" data-tool="polygon" data-tooltip="Polygon (P)">
        ${icons.polygon}
      </button>
      <button class="tool-btn" id="btn-line" data-tool="line" data-tooltip="Line (L)">
        ${icons.line}
      </button>
    `;
  }

  private setupEventListeners(): void {
    this.container.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.tool-btn');
      if (!btn) return;
      
      const tool = btn.getAttribute('data-tool');
      if (tool) this.handleToolClick(tool);
    });

    eventBus.on('tool:activated', ({ id }: { id: string }) => {
      this.setActive(id);
    });

    eventBus.on('tool:deactivated', () => {
      this.setActive('select');
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      
      const shortcuts: Record<string, string> = {
        'v': 'select',
        'p': 'polygon',
        'l': 'line'
      };

      const tool = shortcuts[e.key.toLowerCase()];
      if (tool) this.handleToolClick(tool);
    });
  }

  private handleToolClick(tool: string): void {
    const drawManager = app.getDrawManager();
    
    if (tool === 'select') {
      drawManager?.deactivateTool();
    } else if (this.activeTool === tool) {
      drawManager?.deactivateTool();
    } else {
      drawManager?.activateTool(tool);
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