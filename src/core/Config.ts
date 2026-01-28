export const Config = {
  map: {
    center: [37.618, 55.751] as [number, number],
    zoom: 14,
    minZoom: 1,
    maxZoom: 20,
    style: {
      backgroundColor: '#1a1a2e'
    },
    basemap: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
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