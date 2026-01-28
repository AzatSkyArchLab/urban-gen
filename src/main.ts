import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/main.css';
import { app } from './core/App';

// Запуск приложения
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await app.init('map');
    console.log('Urban Gen started');
  } catch (error) {
    console.error('Failed to start:', error);
  }
});