import { Toolbar } from './Toolbar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';

export class UIManager {
  private toolbar: Toolbar | null = null;
  private sidebar: Sidebar | null = null;
  private statusBar: StatusBar | null = null;

  init(): void {
    this.toolbar = new Toolbar('toolbar');
    this.toolbar.init();

    this.sidebar = new Sidebar('sidebar');
    this.sidebar.init();

    this.statusBar = new StatusBar('status-bar');
    this.statusBar.init();
  }

  getToolbar(): Toolbar | null {
    return this.toolbar;
  }

  getSidebar(): Sidebar | null {
    return this.sidebar;
  }

  getStatusBar(): StatusBar | null {
    return this.statusBar;
  }
}

export const uiManager = new UIManager();