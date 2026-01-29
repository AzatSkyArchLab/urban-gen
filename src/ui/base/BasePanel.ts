/**
 * BasePanel - abstract base class for UI panels
 * 
 * Provides common functionality:
 * - Container management
 * - Render lifecycle
 * - Event listener cleanup
 */

import { eventBus } from '../../core/EventBus';

export interface PanelOptions {
  containerId: string;
  title: string;
}

export abstract class BasePanel {
  protected container: HTMLElement;
  protected readonly title: string;
  private eventUnsubscribers: (() => void)[] = [];

  constructor(options: PanelOptions) {
    const el = document.getElementById(options.containerId);
    if (!el) {
      throw new Error(`Panel container #${options.containerId} not found`);
    }
    this.container = el;
    this.title = options.title;
  }

  /**
   * Initialize the panel
   */
  init(): void {
    this.render();
    this.setupEventListeners();
  }

  /**
   * Render the panel content
   */
  protected abstract render(): void;

  /**
   * Setup event listeners - override in subclass
   */
  protected setupEventListeners(): void {
    // Override in subclass
  }

  /**
   * Subscribe to an event (auto-cleanup on destroy)
   */
  protected subscribe<T = any>(event: string, callback: (data: T) => void): void {
    const unsubscribe = eventBus.on(event, callback);
    this.eventUnsubscribers.push(unsubscribe);
  }

  /**
   * Render the panel header
   */
  protected renderHeader(title: string): string {
    return `
      <div class="panel-header">
        <span class="panel-title">${title}</span>
      </div>
    `;
  }

  /**
   * Render an empty state
   */
  protected renderEmptyState(icon: string, message: string): string {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <div class="empty-state-text">${message}</div>
      </div>
    `;
  }

  /**
   * Update the panel (re-render specific parts)
   */
  update(): void {
    this.render();
  }

  /**
   * Destroy the panel and cleanup
   */
  destroy(): void {
    // Unsubscribe from all events
    for (const unsubscribe of this.eventUnsubscribers) {
      unsubscribe();
    }
    this.eventUnsubscribers = [];
    
    // Clear container
    this.container.innerHTML = '';
  }
}
