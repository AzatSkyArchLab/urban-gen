/**
 * Urban Gen - Entry Point
 * 
 * Initialization order:
 * 1. app.init() - Core (Map, Layers, Draw)
 * 2. uiManager.init() - UI (Toolbar, Panels, StatusBar)
 */

import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/main.css';
import './styles/panels.css';

import { app } from './core/App';
import { uiManager } from './ui/UIManager';

async function bootstrap(): Promise<void> {
  try {
    // 1. Initialize core application
    await app.init('map');
    
    // 2. Initialize UI
    uiManager.init();
    
    console.log('Urban Gen started successfully');
  } catch (error) {
    console.error('Failed to start Urban Gen:', error);
    
    // Show error to user
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ef4444;">
          <div style="text-align: center;">
            <h2>Failed to load application</h2>
            <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        </div>
      `;
    }
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
