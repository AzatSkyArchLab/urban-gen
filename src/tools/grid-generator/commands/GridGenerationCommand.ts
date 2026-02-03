/**
 * GridGenerationCommand - command for grid generation (undo/redo support)
 */

import { BaseCommand } from '../../../core/commands/Command';
import type { GridGeneratorManager } from '../GridGeneratorManager';
import type { GridGeneratorState } from '../types';

export class GridGenerationCommand extends BaseCommand {
  readonly type = 'grid:generate';
  readonly description = 'Generate grid';

  private manager: GridGeneratorManager;
  private savedState: GridGeneratorState | null = null;
  private newState: GridGeneratorState | null = null;

  constructor(manager: GridGeneratorManager) {
    super();
    this.manager = manager;
  }

  /**
   * Called before processing to save current state
   */
  saveCurrentState(): void {
    this.savedState = this.cloneState(this.manager.getState());
  }

  /**
   * Called after processing to save new state
   */
  saveNewState(): void {
    this.newState = this.cloneState(this.manager.getState());
  }

  execute(): void {
    if (this.newState) {
      this.manager.restoreState(this.newState);
    }
  }

  undo(): void {
    if (this.savedState) {
      this.manager.restoreState(this.savedState);
    }
  }

  private cloneState(state: GridGeneratorState): GridGeneratorState {
    return JSON.parse(JSON.stringify(state));
  }
}
