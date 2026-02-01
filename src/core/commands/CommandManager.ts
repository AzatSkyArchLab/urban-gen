/**
 * CommandManager - manages command history for undo/redo
 *
 * Features:
 * - Execute commands and track history
 * - Undo/redo with stack management
 * - Configurable history limit
 * - Events for UI updates
 */

import { eventBus } from '../EventBus';
import type { Command } from './Command';

export interface CommandManagerConfig {
  /** Maximum history size (default: 50) */
  maxHistory?: number;
}

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory: number;
  private isExecuting = false;

  constructor(config: CommandManagerConfig = {}) {
    this.maxHistory = config.maxHistory ?? 50;
  }

  /**
   * Execute a command and add to history
   */
  execute(command: Command): void {
    if (this.isExecuting) {
      console.warn('CommandManager: Already executing a command');
      return;
    }

    this.isExecuting = true;

    try {
      command.execute();

      // Add to undo stack
      this.undoStack.push(command);

      // Trim history if needed
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }

      // Clear redo stack (new action invalidates redo history)
      this.redoStack = [];

      this.emitChange();
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Undo the last command
   */
  undo(): boolean {
    if (!this.canUndo()) return false;

    const command = this.undoStack.pop()!;

    try {
      command.undo();
      this.redoStack.push(command);
      this.emitChange();
      eventBus.emit('command:undo', { command });
      return true;
    } catch (error) {
      console.error('CommandManager: Undo failed', error);
      // Restore command to undo stack on failure
      this.undoStack.push(command);
      return false;
    }
  }

  /**
   * Redo the last undone command
   */
  redo(): boolean {
    if (!this.canRedo()) return false;

    const command = this.redoStack.pop()!;

    try {
      if (command.redo) {
        command.redo();
      } else {
        command.execute();
      }
      this.undoStack.push(command);
      this.emitChange();
      eventBus.emit('command:redo', { command });
      return true;
    } catch (error) {
      console.error('CommandManager: Redo failed', error);
      // Restore command to redo stack on failure
      this.redoStack.push(command);
      return false;
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get undo stack size
   */
  getUndoCount(): number {
    return this.undoStack.length;
  }

  /**
   * Get redo stack size
   */
  getRedoCount(): number {
    return this.redoStack.length;
  }

  /**
   * Get last command description (for UI)
   */
  getUndoDescription(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  /**
   * Get next redo description (for UI)
   */
  getRedoDescription(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.emitChange();
  }

  /**
   * Emit change event for UI updates
   */
  private emitChange(): void {
    eventBus.emit('command:history:changed', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.getUndoCount(),
      redoCount: this.getRedoCount(),
      undoDescription: this.getUndoDescription(),
      redoDescription: this.getRedoDescription()
    });
  }
}

// Singleton instance
export const commandManager = new CommandManager();
