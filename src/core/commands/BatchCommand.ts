/**
 * BatchCommand - execute multiple commands as a single undoable action
 */

import { BaseCommand, type Command } from './Command';

export class BatchCommand extends BaseCommand {
  readonly type = 'batch';
  readonly description: string;

  private commands: Command[];

  constructor(commands: Command[], description?: string) {
    super();
    this.commands = commands;

    if (description) {
      this.description = description;
    } else if (commands.length === 1) {
      this.description = commands[0].description;
    } else {
      this.description = `${commands.length} actions`;
    }
  }

  execute(): void {
    for (const command of this.commands) {
      command.execute();
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  redo(): void {
    for (const command of this.commands) {
      if (command.redo) {
        command.redo();
      } else {
        command.execute();
      }
    }
  }
}
