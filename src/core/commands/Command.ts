/**
 * Command - base interface for undo/redo operations
 *
 * Implements Command Pattern for reversible actions.
 * Each command encapsulates an action that can be executed,
 * undone, and redone.
 */

export interface Command {
  /** Unique command type identifier */
  readonly type: string;

  /** Human-readable description for UI/logging */
  readonly description: string;

  /** Execute the command */
  execute(): void;

  /** Reverse the command */
  undo(): void;

  /** Re-execute after undo (default: call execute) */
  redo?(): void;
}

/**
 * Base class for commands with common functionality
 */
export abstract class BaseCommand implements Command {
  abstract readonly type: string;
  abstract readonly description: string;

  abstract execute(): void;
  abstract undo(): void;

  redo(): void {
    this.execute();
  }
}
