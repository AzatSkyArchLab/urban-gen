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
    osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    esriSatellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
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
  api: {
    tileServer: '',
    cfdServer: ''
  }
};