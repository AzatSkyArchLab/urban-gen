/**
 * Application configuration
 */

export const Config = {
  map: {
    center: [37.618, 55.751] as [number, number],
    zoom: 14,
    minZoom: 2,
    maxZoom: 18,
    style: {
      backgroundColor: '#ffffff'
    }
  },

  basemaps: {
    osm: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
    // Esri World Imagery - public tiles
    esriSatellite: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  },

  cursors: {
    default: 'default',
    pointer: 'pointer',
    crosshair: 'crosshair',
    grab: 'grab',
    grabbing: 'grabbing'
  },

  snap: {
    enabled: true,
    tolerance: 10,
    gridSize: 1
  },

  draw: {
    fillColor: '#3b82f6',
    fillOpacity: 0.3,
    lineColor: '#3b82f6',
    lineWidth: 2,
    selectedColor: '#f59e0b',
    selectedWidth: 3,
    hitboxWidth: 15,
    previewOpacity: 0.2
  },

  api: {
    baseUrl: 'https://mdlaba.ru/urbangen/api',
    martinBaseUrl: 'https://mdlaba.ru/urbangen/tiles',
    martinAuth: 'urban:urban2026'
  }
} as const;

export type AppConfig = typeof Config;