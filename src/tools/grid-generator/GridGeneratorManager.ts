/**
 * GridGeneratorManager - orchestrates the grid generation process
 *
 * Workflow:
 * 1. Receive polygon from user
 * 2. Query red_lines and osi_sush from map tiles
 * 3. Split polygon by red lines
 * 4. Filter out sub-polygons that collide with roads
 * 5. Generate grid and blocks for each valid sub-polygon
 * 6. Build connections from blocks to roads
 * 7. Visualize results
 */

import type { MapManager } from '../../map/MapManager';
import { eventBus } from '../../core/EventBus';
import { commandManager } from '../../core/commands/CommandManager';
import { GridLayer } from './layers/GridLayer';
import { GridGenerationCommand } from './commands/GridGenerationCommand';
import type {
  Coordinate,
  Point,
  SubPolygon,
  GridGeneratorState
} from './types';
import { GRID_CONFIG } from './types';
import { metersPerPixel, coordinatesToPixels } from './algorithms/geometry';
import {
  splitPolygonByLines,
  polygonCollidesWithRoads,
  lineFeaturesToPixels
} from './algorithms/PolygonClipper';
import { generateGrid, generateVariants } from './algorithms/GridBuilder';
import {
  findBlockPolygonIntersections,
  buildConnections
} from './algorithms/ConnectionBuilder';

export class GridGeneratorManager {
  private mapManager: MapManager;
  private gridLayer: GridLayer;
  private state: GridGeneratorState;

  constructor(mapManager: MapManager) {
    this.mapManager = mapManager;
    this.gridLayer = new GridLayer(mapManager);
    this.state = this.getInitialState();
  }

  private getInitialState(): GridGeneratorState {
    return {
      sourcePolygon: null,
      redLines: [],
      roads: [],
      subPolygons: [],
      isProcessing: false,
      currentGlobalVariant: 0,
      totalVariants: 0,
      generationZoom: 0,
      generationCenter: null
    };
  }

  init(): void {
    this.gridLayer.init();
  }

  /**
   * Process a polygon: split, filter, generate grid
   */
  async processPolygon(coordinates: Coordinate[]): Promise<void> {
    if (coordinates.length < 3) return;

    // Create command for undo/redo
    const command = new GridGenerationCommand(this);
    command.saveCurrentState();

    this.state.isProcessing = true;
    this.state.sourcePolygon = coordinates;
    eventBus.emit('grid-gen:processing:start');

    try {
      const map = this.mapManager.getMap();
      if (!map) throw new Error('Map not initialized');

      // Get projection functions
      const project = (lngLat: [number, number]) => map.project(lngLat);
      const unproject = (point: Point) => {
        const ll = map.unproject([point.x, point.y]);
        return { lng: ll.lng, lat: ll.lat };
      };

      // Convert source polygon to pixels
      const sourcePixels = coordinatesToPixels(coordinates, project);

      // Query features from map
      const { redLines, roads } = this.queryFeaturesInBounds(coordinates);

      // Convert to pixel coordinates
      const redLinesPixels = lineFeaturesToPixels(redLines, project);
      const roadsPixels = lineFeaturesToPixels(roads, project);

      // Debug: show polygon and line bounds
      console.log('[GridGen] Source polygon pixels:', sourcePixels.slice(0, 3), '...');
      if (redLinesPixels.length > 0) {
        console.log('[GridGen] First red line pixels:', redLinesPixels[0].slice(0, 3), '...');
      }

      this.state.redLines = redLines;
      this.state.roads = roads;

      // Split polygon by red lines
      const splitPolygons = splitPolygonByLines(sourcePixels, redLinesPixels);
      console.log('[GridGen] Split result:', splitPolygons.length, 'polygons');

      // Calculate cell size in pixels based on zoom
      const center = map.getCenter();
      const zoom = map.getZoom();
      const mpp = metersPerPixel(center.lat, zoom);
      const cellSizePixels = GRID_CONFIG.CELL_SIZE / mpp;

      // Store generation parameters for later use
      this.state.generationZoom = zoom;
      this.state.generationCenter = [center.lng, center.lat];

      // Create sub-polygons
      const subPolygons: SubPolygon[] = [];
      let totalVariants = 0;

      for (let idx = 0; idx < splitPolygons.length; idx++) {
        const poly = splitPolygons[idx];
        const isValid = !polygonCollidesWithRoads(poly, roadsPixels);

        // Convert back to coordinates
        const coords: Coordinate[] = poly.map((p) => {
          const lngLat = unproject(p);
          return [lngLat.lng, lngLat.lat];
        });

        const subPoly: SubPolygon = {
          id: `sub-${idx}`,
          coordinates: coords,
          pixelCoords: poly,
          isValid,
          currentVariant: 0
        };

        if (isValid) {
          // Generate grid
          const gridResult = generateGrid(poly, cellSizePixels);
          if (gridResult) {
            subPoly.gridCells = gridResult.cells;
            subPoly.bbox = gridResult.bbox;
          }

          // Generate placement variants
          const variants = generateVariants(poly, cellSizePixels);
          subPoly.variants = variants;
          totalVariants += variants.length || 1;

          // Build connections for the first variant
          if (variants.length > 0) {
            this.updateConnections(subPoly, roadsPixels);
          }
        }

        subPolygons.push(subPoly);
      }

      this.state.subPolygons = subPolygons;
      this.state.totalVariants = totalVariants;
      this.state.currentGlobalVariant = 0;

      // Update visualization
      this.updateVisualization();

      // Save new state and add to command history
      command.saveNewState();
      commandManager.execute(command);

      eventBus.emit('grid-gen:processing:complete', {
        subPolygonsCount: subPolygons.length,
        validCount: subPolygons.filter((p) => p.isValid).length,
        totalVariants
      });
    } catch (error) {
      console.error('Grid generation error:', error);
      eventBus.emit('grid-gen:processing:error', { error });
    } finally {
      this.state.isProcessing = false;
    }
  }

  /**
   * Query red_lines and osi_sush features from rendered tiles
   */
  private queryFeaturesInBounds(
    coordinates: Coordinate[]
  ): {
    redLines: GeoJSON.Feature<GeoJSON.LineString>[];
    roads: GeoJSON.Feature<GeoJSON.LineString>[];
  } {
    const map = this.mapManager.getMap();
    if (!map) return { redLines: [], roads: [] };

    // Calculate bounding box
    let minLng = Infinity,
      maxLng = -Infinity;
    let minLat = Infinity,
      maxLat = -Infinity;

    for (const [lng, lat] of coordinates) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }

    // Expand bounds slightly
    const padding = 0.001; // ~100m
    minLng -= padding;
    maxLng += padding;
    minLat -= padding;
    maxLat += padding;

    // Convert to screen coordinates
    const sw = map.project([minLng, minLat]);
    const ne = map.project([maxLng, maxLat]);

    // Query features in bounding box
    const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
      [Math.min(sw.x, ne.x), Math.min(sw.y, ne.y)],
      [Math.max(sw.x, ne.x), Math.max(sw.y, ne.y)]
    ];

    // Debug: list all available layers
    const style = map.getStyle();
    const layerIds = style?.layers?.map(l => l.id) || [];
    console.log('[GridGen] Available layers:', layerIds);

    // Query ALL features first to see what's there
    const allFeatures = map.queryRenderedFeatures(bbox);
    const uniqueSources = [...new Set(allFeatures.map(f => f.source))];
    const uniqueLayers = [...new Set(allFeatures.map(f => f.layer?.id))];
    console.log('[GridGen] Features in bbox - sources:', uniqueSources, 'layers:', uniqueLayers);

    // Query red_lines layer (layer id from LayerConfig)
    const redLinesRaw = map.queryRenderedFeatures(bbox, {
      layers: ['red-lines']
    });

    // Query osi_sush layer (layer id from LayerConfig)
    const roadsRaw = map.queryRenderedFeatures(bbox, {
      layers: ['osi-sush']
    });

    console.log('[GridGen] Raw query results - red-lines:', redLinesRaw.length, 'osi-sush:', roadsRaw.length);

    // Convert to LineString features
    const redLines = this.extractLineFeatures(redLinesRaw);
    const roads = this.extractLineFeatures(roadsRaw);

    console.log(
      `[GridGen] Extracted ${redLines.length} red lines, ${roads.length} roads`
    );

    return { redLines, roads };
  }

  /**
   * Extract LineString features from query results
   */
  private extractLineFeatures(
    features: maplibregl.MapGeoJSONFeature[]
  ): GeoJSON.Feature<GeoJSON.LineString>[] {
    const result: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    const seen = new Set<string>();

    for (const f of features) {
      // Handle both LineString and MultiLineString
      if (f.geometry.type === 'LineString') {
        const key = JSON.stringify(f.geometry.coordinates);
        if (!seen.has(key)) {
          seen.add(key);
          result.push(f as GeoJSON.Feature<GeoJSON.LineString>);
        }
      } else if (f.geometry.type === 'MultiLineString') {
        for (const coords of f.geometry.coordinates) {
          const key = JSON.stringify(coords);
          if (!seen.has(key)) {
            seen.add(key);
            result.push({
              type: 'Feature',
              properties: f.properties,
              geometry: {
                type: 'LineString',
                coordinates: coords
              }
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Update connections for a sub-polygon
   */
  private updateConnections(subPoly: SubPolygon, roadsPixels: Point[][]): void {
    if (!subPoly.variants || subPoly.variants.length === 0) return;

    const variant = subPoly.variants[subPoly.currentVariant];
    if (!variant) return;

    // Find intersection points
    const vertices = findBlockPolygonIntersections(
      variant.blocks,
      subPoly.pixelCoords
    );

    // Build connections
    const connections = buildConnections(
      vertices,
      roadsPixels,
      subPoly.pixelCoords
    );

    subPoly.connections = connections;
  }

  /**
   * Set variant for a specific sub-polygon
   */
  setSubPolygonVariant(subPolyId: string, variantIndex: number): void {
    const subPoly = this.state.subPolygons.find((p) => p.id === subPolyId);
    if (!subPoly || !subPoly.variants) return;

    const maxVariant = subPoly.variants.length - 1;
    subPoly.currentVariant = Math.max(0, Math.min(variantIndex, maxVariant));

    // Update connections for new variant
    const map = this.mapManager.getMap();
    if (map) {
      const project = (lngLat: [number, number]) => map.project(lngLat);
      const roadsPixels = lineFeaturesToPixels(this.state.roads, project);
      this.updateConnections(subPoly, roadsPixels);
    }

    this.updateVisualization();
    eventBus.emit('grid-gen:variant:changed', {
      subPolyId,
      variantIndex: subPoly.currentVariant
    });
  }

  /**
   * Set global variant (cycles through all sub-polygons)
   */
  setGlobalVariant(index: number): void {
    // Distribute variant index across sub-polygons
    let remaining = index;
    for (const subPoly of this.state.subPolygons) {
      if (!subPoly.isValid || !subPoly.variants) continue;

      const variantCount = subPoly.variants.length;
      subPoly.currentVariant = remaining % variantCount;
      remaining = Math.floor(remaining / variantCount);
    }

    this.state.currentGlobalVariant = index;

    // Update connections
    const map = this.mapManager.getMap();
    if (map) {
      const project = (lngLat: [number, number]) => map.project(lngLat);
      const roadsPixels = lineFeaturesToPixels(this.state.roads, project);
      for (const subPoly of this.state.subPolygons) {
        if (subPoly.isValid && subPoly.variants) {
          this.updateConnections(subPoly, roadsPixels);
        }
      }
    }

    this.updateVisualization();
    eventBus.emit('grid-gen:global-variant:changed', { index });
  }

  /**
   * Update visualization
   */
  private updateVisualization(): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    const currentZoom = map.getZoom();
    const zoomDiff = Math.abs(currentZoom - this.state.generationZoom);

    // If zoom changed significantly, recalculate blocks
    if (zoomDiff > 0.5 && this.state.subPolygons.length > 0) {
      console.log('[GridGen] Zoom changed, regenerating blocks...');
      this.regenerateBlocksAtCurrentZoom();
    }

    const unproject = (point: Point) => {
      const ll = map.unproject([point.x, point.y]);
      return { lng: ll.lng, lat: ll.lat };
    };

    this.gridLayer.update(this.state.subPolygons, true, unproject);
  }

  /**
   * Regenerate blocks at current zoom level
   */
  private regenerateBlocksAtCurrentZoom(): void {
    const map = this.mapManager.getMap();
    if (!map) return;

    const center = map.getCenter();
    const zoom = map.getZoom();
    const mpp = metersPerPixel(center.lat, zoom);
    const cellSizePixels = GRID_CONFIG.CELL_SIZE / mpp;

    const project = (lngLat: [number, number]) => map.project(lngLat);

    // Regenerate blocks for each valid sub-polygon
    for (const subPoly of this.state.subPolygons) {
      if (!subPoly.isValid) continue;

      // Recalculate pixel coords from geo coords
      subPoly.pixelCoords = subPoly.coordinates.map(c => project(c));

      // Regenerate grid
      const gridResult = generateGrid(subPoly.pixelCoords, cellSizePixels);
      if (gridResult) {
        subPoly.gridCells = gridResult.cells;
        subPoly.bbox = gridResult.bbox;
      }

      // Regenerate variants
      const variants = generateVariants(subPoly.pixelCoords, cellSizePixels);
      subPoly.variants = variants;

      // Update connections for current variant
      if (variants.length > 0) {
        const roadsPixels = lineFeaturesToPixels(this.state.roads, project);
        this.updateConnections(subPoly, roadsPixels);
      }
    }

    // Update stored zoom
    this.state.generationZoom = zoom;
    this.state.generationCenter = [center.lng, center.lat];
  }

  /**
   * Get current state
   */
  getState(): GridGeneratorState {
    return this.state;
  }

  /**
   * Get statistics for current state
   */
  getStats(): {
    totalSubPolygons: number;
    validSubPolygons: number;
    totalBlocks: number;
    totalConnections: number;
  } {
    let totalBlocks = 0;
    let totalConnections = 0;

    for (const subPoly of this.state.subPolygons) {
      if (!subPoly.isValid) continue;

      if (subPoly.variants && subPoly.variants[subPoly.currentVariant]) {
        totalBlocks += subPoly.variants[subPoly.currentVariant].blocks.length;
      }

      if (subPoly.connections) {
        totalConnections += subPoly.connections.length;
      }
    }

    return {
      totalSubPolygons: this.state.subPolygons.length,
      validSubPolygons: this.state.subPolygons.filter((p) => p.isValid).length,
      totalBlocks,
      totalConnections
    };
  }

  /**
   * Restore state from a saved state (for undo/redo)
   */
  restoreState(savedState: GridGeneratorState): void {
    this.state = JSON.parse(JSON.stringify(savedState));
    this.updateVisualization();
    eventBus.emit('grid-gen:state:restored');
  }

  /**
   * Clear all state and visualization
   */
  clear(): void {
    // Create command for undo support
    const command = new GridGenerationCommand(this);
    command.saveCurrentState();

    this.state = this.getInitialState();
    this.gridLayer.clear();

    command.saveNewState();
    commandManager.execute(command);

    eventBus.emit('grid-gen:cleared');
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.clear();
    this.gridLayer.destroy();
  }
}
