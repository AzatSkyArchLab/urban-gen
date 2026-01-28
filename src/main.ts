import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/main.css';
import { app } from './core/App';
import { uiManager } from './ui/UIManager';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await app.init('map');
    uiManager.init();
    
    console.log('Urban Gen started');
  } catch (error) {
    console.error('Failed to start:', error);
  }
});