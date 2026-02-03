/**
 * Grid Generator Module
 *
 * Experimental tool for grid-based urban planning.
 *
 * To remove this module:
 * 1. Delete this folder: src/tools/grid-generator/
 * 2. Remove import and registration in src/draw/DrawManager.ts
 * 3. Remove panel container from index.html (if added)
 */

export { GridGeneratorTool } from './GridGeneratorTool';
export { GridGeneratorManager } from './GridGeneratorManager';
export { GridPanel } from './ui/GridPanel';
export { GridLayer } from './layers/GridLayer';

// Types
export type {
  Point,
  Coordinate,
  SubPolygon,
  PlacedBlock,
  PlacementVariant,
  ConnectionPoint,
  GridGeneratorState
} from './types';

export { GRID_CONFIG } from './types';

// Algorithms (for testing/extension)
export * from './algorithms/geometry';
export * from './algorithms/PolygonClipper';
export * from './algorithms/GridBuilder';
export * from './algorithms/ConnectionBuilder';
