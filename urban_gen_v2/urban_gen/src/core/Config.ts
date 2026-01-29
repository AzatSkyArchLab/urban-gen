/**
 * Application configuration
 * 
 * Централизованное хранение всех настроек
 */

export const Config = {
  // Map settings
  map: {
    center: [37.618, 55.751] as [number, number],
    zoom: 14,
    minZoom: 2,
    maxZoom: 18,
    style: {
      backgroundColor: '#ffffff'
    }
  },

  // Basemap sources
  basemaps: {
    osm: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
    esriSatellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  },

  // Cursor styles
  cursors: {
    default: 'default',
    pointer: 'pointer',
    crosshair: 'crosshair',
    grab: 'grab',
    grabbing: 'grabbing'
  },

  // Snapping settings
  snap: {
    enabled: true,
    tolerance: 10,
    gridSize: 1
  },

  // Drawing settings
  draw: {
    defaultFillColor: '#3b82f6',
    defaultLineColor: '#3b82f6',
    defaultFillOpacity: 0.3,
    defaultLineWidth: 2,
    selectedColor: '#f59e0b',
    selectedWidth: 3,
    previewDasharray: [3, 3]
  },

  // API endpoints
  api: {
    tileServer: '',
    cfdServer: ''
  }
} as const;

// Type for config
export type AppConfig = typeof Config;
