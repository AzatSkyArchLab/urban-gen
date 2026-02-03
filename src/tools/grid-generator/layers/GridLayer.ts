/**
 * GridLayer - visualizes grid cells, blocks, and sub-polygons on the map
 */

import type { MapManager } from '../../../map/MapManager';
import type {
  SubPolygon,
  Point,
  Coordinate
} from '../types';

const LAYER_PREFIX = 'grid-gen';

export class GridLayer {
  private mapManager: MapManager;
  private sourceId = `${LAYER_PREFIX}-source`;
  private initialized = false;

  constructor(mapManager: MapManager) {
    this.mapManager = mapManager;
  }

  init(): void {
    if (this.initialized) return;

    const map = this.mapManager.getMap();
    if (!map) return;

    // Add GeoJSON source for all grid elements
    map.addSource(this.sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    // Sub-polygons fill (valid = green, invalid = red)
    map.addLayer({
      id: `${LAYER_PREFIX}-subpolygons-fill`,
      type: 'fill',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'subpolygon'],
      paint: {
        'fill-color': [
          'case',
          ['get', 'isValid'],
          'rgba(34, 197, 94, 0.2)', // green for valid
          'rgba(239, 68, 68, 0.2)' // red for invalid
        ],
        'fill-outline-color': [
          'case',
          ['get', 'isValid'],
          '#22c55e',
          '#ef4444'
        ]
      }
    });

    // Sub-polygons outline
    map.addLayer({
      id: `${LAYER_PREFIX}-subpolygons-line`,
      type: 'line',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'subpolygon'],
      paint: {
        'line-color': [
          'case',
          ['get', 'isValid'],
          '#16a34a',
          '#dc2626'
        ],
        'line-width': 2
      }
    });

    // Sub-polygon centroid labels with index
    map.addLayer({
      id: `${LAYER_PREFIX}-subpolygons-label`,
      type: 'symbol',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'subpolygon-label'],
      layout: {
        'text-field': ['get', 'index'],
        'text-size': 24,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-anchor': 'center'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': [
          'case',
          ['get', 'isValid'],
          '#16a34a',
          '#dc2626'
        ],
        'text-halo-width': 3
      }
    });

    // Grid cells (clean = green, affected = red)
    map.addLayer({
      id: `${LAYER_PREFIX}-cells-fill`,
      type: 'fill',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'cell'],
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'category'], 'clean'],
          'rgba(34, 197, 94, 0.15)',
          'rgba(239, 68, 68, 0.15)'
        ],
        'fill-outline-color': [
          'case',
          ['==', ['get', 'category'], 'clean'],
          '#22c55e',
          '#ef4444'
        ]
      }
    });

    // Blocks fill
    map.addLayer({
      id: `${LAYER_PREFIX}-blocks-fill`,
      type: 'fill',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'block'],
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.7
      }
    });

    // Blocks outline (white border, then colored)
    map.addLayer({
      id: `${LAYER_PREFIX}-blocks-outline-white`,
      type: 'line',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'block'],
      paint: {
        'line-color': '#ffffff',
        'line-width': 3
      }
    });

    map.addLayer({
      id: `${LAYER_PREFIX}-blocks-outline`,
      type: 'line',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'block'],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.5
      }
    });

    // Block labels
    map.addLayer({
      id: `${LAYER_PREFIX}-blocks-label`,
      type: 'symbol',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'block'],
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 14,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-anchor': 'center'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0,0,0,0.7)',
        'text-halo-width': 2
      }
    });

    // Connection lines (from intersection points to roads)
    map.addLayer({
      id: `${LAYER_PREFIX}-connections`,
      type: 'line',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'connection'],
      paint: {
        'line-color': '#00aa00',
        'line-width': 3,
        'line-opacity': 0.8
      }
    });

    // Intersection points (vertices)
    map.addLayer({
      id: `${LAYER_PREFIX}-vertices`,
      type: 'circle',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'vertex'],
      paint: {
        'circle-radius': 8,
        'circle-color': '#ff6600',
        'circle-stroke-color': '#ff3300',
        'circle-stroke-width': 2
      }
    });

    // Connection points on roads
    map.addLayer({
      id: `${LAYER_PREFIX}-connection-points`,
      type: 'circle',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'connection-point'],
      paint: {
        'circle-radius': 7,
        'circle-color': '#00ff00',
        'circle-stroke-color': '#008800',
        'circle-stroke-width': 2
      }
    });

    this.initialized = true;
  }

  /**
   * Update visualization with current state
   */
  update(
    subPolygons: SubPolygon[],
    showGrid: boolean,
    unproject: (point: Point) => { lng: number; lat: number }
  ): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    const features: GeoJSON.Feature[] = [];

    for (let i = 0; i < subPolygons.length; i++) {
      const subPoly = subPolygons[i];

      // Sub-polygon outline
      features.push({
        type: 'Feature',
        properties: {
          type: 'subpolygon',
          id: subPoly.id,
          isValid: subPoly.isValid
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[...subPoly.coordinates, subPoly.coordinates[0]]]
        }
      });

      // Centroid label with index
      const centroid = this.calculateCentroid(subPoly.coordinates);
      features.push({
        type: 'Feature',
        properties: {
          type: 'subpolygon-label',
          index: String(i),
          isValid: subPoly.isValid
        },
        geometry: {
          type: 'Point',
          coordinates: centroid
        }
      });

      // Skip invalid polygons for detailed visualization
      if (!subPoly.isValid) continue;

      // Grid cells
      if (showGrid && subPoly.gridCells) {
        for (const cell of subPoly.gridCells) {
          const coords = this.pixelCornersToCoords(cell.corners, unproject);
          features.push({
            type: 'Feature',
            properties: {
              type: 'cell',
              category: cell.category
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[...coords, coords[0]]]
            }
          });
        }
      }

      // Blocks from current variant
      if (subPoly.variants && subPoly.variants[subPoly.currentVariant]) {
        const variant = subPoly.variants[subPoly.currentVariant];

        for (const block of variant.blocks) {
          const coords = this.pixelCornersToCoords(block.corners, unproject);
          features.push({
            type: 'Feature',
            properties: {
              type: 'block',
              color: block.type.color,
              label: block.type.name
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[...coords, coords[0]]]
            }
          });
        }
      }

      // Connections
      if (subPoly.connections) {
        for (const conn of subPoly.connections) {
          const vertexCoord = unproject(conn.vertex.point);
          const pointCoord = unproject(conn.point);

          // Connection line
          features.push({
            type: 'Feature',
            properties: {
              type: 'connection',
              distance: conn.distance,
              angleToEdge: conn.angleToEdge
            },
            geometry: {
              type: 'LineString',
              coordinates: [
                [vertexCoord.lng, vertexCoord.lat],
                [pointCoord.lng, pointCoord.lat]
              ]
            }
          });

          // Vertex point
          features.push({
            type: 'Feature',
            properties: {
              type: 'vertex',
              index: conn.vertexIndex
            },
            geometry: {
              type: 'Point',
              coordinates: [vertexCoord.lng, vertexCoord.lat]
            }
          });

          // Connection point on road
          features.push({
            type: 'Feature',
            properties: {
              type: 'connection-point',
              index: conn.vertexIndex
            },
            geometry: {
              type: 'Point',
              coordinates: [pointCoord.lng, pointCoord.lat]
            }
          });
        }
      }
    }

    // Update source
    const source = map.getSource(this.sourceId) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features
      });
    }
  }

  /**
   * Convert pixel corners to coordinates
   */
  private pixelCornersToCoords(
    corners: Point[],
    unproject: (point: Point) => { lng: number; lat: number }
  ): Coordinate[] {
    return corners.map((c) => {
      const lngLat = unproject(c);
      return [lngLat.lng, lngLat.lat];
    });
  }

  /**
   * Calculate centroid of a polygon from coordinates
   */
  private calculateCentroid(coords: Coordinate[]): Coordinate {
    let cx = 0, cy = 0;
    for (const c of coords) {
      cx += c[0];
      cy += c[1];
    }
    return [cx / coords.length, cy / coords.length];
  }

  /**
   * Clear all visualization
   */
  clear(): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    const source = map.getSource(this.sourceId) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: []
      });
    }
  }

  /**
   * Toggle grid visibility
   */
  setGridVisible(visible: boolean): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    map.setLayoutProperty(
      `${LAYER_PREFIX}-cells-fill`,
      'visibility',
      visible ? 'visible' : 'none'
    );
  }

  /**
   * Remove all layers and sources
   */
  destroy(): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    const layers = [
      `${LAYER_PREFIX}-connection-points`,
      `${LAYER_PREFIX}-vertices`,
      `${LAYER_PREFIX}-connections`,
      `${LAYER_PREFIX}-blocks-label`,
      `${LAYER_PREFIX}-blocks-outline`,
      `${LAYER_PREFIX}-blocks-outline-white`,
      `${LAYER_PREFIX}-blocks-fill`,
      `${LAYER_PREFIX}-cells-fill`,
      `${LAYER_PREFIX}-subpolygons-label`,
      `${LAYER_PREFIX}-subpolygons-line`,
      `${LAYER_PREFIX}-subpolygons-fill`
    ];

    for (const layerId of layers) {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    }

    if (map.getSource(this.sourceId)) {
      map.removeSource(this.sourceId);
    }

    this.initialized = false;
  }
}
