/**
 * Grid Generator Types
 *
 * Isolated module for experimental grid generation functionality.
 * Can be safely removed by deleting this folder and one import line.
 */

export type Point = { x: number; y: number };
export type Coordinate = [number, number]; // [lng, lat]

export interface BoundingBox {
  center: Point;
  width: number;
  height: number;
  angle: number;
  ux: number;
  uy: number;
  vx: number;
  vy: number;
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  origin: Point;
}

export interface GridCell {
  corners: Point[];
  gridPos: { x: number; y: number };
  category: 'clean' | 'affected';
}

export interface BlockType {
  width: number;
  height: number;
  name: string;
  color: string;
}

export interface PlacedBlock {
  type: BlockType;
  gridPos: { x: number; y: number };
  size: { w: number; h: number };
  corners: Point[];
  category: 'clean' | 'affected';
}

export interface PlacementStrategy {
  direction: 'right_down' | 'left_down' | 'down_right' | 'down_left';
  preferWide: boolean;
  preferTall: boolean;
  swap32and22: boolean;
}

export interface PlacementVariant {
  id: number;
  blocks: PlacedBlock[];
  strategy: PlacementStrategy;
  stats: {
    totalBlocks: number;
    totalCells: number;
    largeBlocks: number;
    largeBlocksCells: number;
    coverage: number;
  };
}

export interface IntersectionPoint {
  point: Point;
  blockIndex: number;
  blockEdgeIndex: number;
  polyEdgeIndex: number;
  closestSegment: {
    start: Point;
    end: Point;
    index: number;
  };
}

export interface ConnectionPoint {
  point: Point;
  roadIdx: number;
  distance: number;
  vertexIndex: number;
  vertex: IntersectionPoint;
  angleDeg: number;
  angleToEdge: number;
  polyEdgeIndex: number;
}

export interface SubPolygon {
  id: string;
  coordinates: Coordinate[];
  pixelCoords: Point[];
  isValid: boolean; // false if collides with roads
  bbox?: BoundingBox;
  gridCells?: GridCell[];
  variants?: PlacementVariant[];
  currentVariant: number;
  connections?: ConnectionPoint[];
}

export interface GridGeneratorState {
  sourcePolygon: Coordinate[] | null;
  redLines: GeoJSON.Feature<GeoJSON.LineString>[];
  roads: GeoJSON.Feature<GeoJSON.LineString>[];
  subPolygons: SubPolygon[];
  isProcessing: boolean;
  currentGlobalVariant: number;
  totalVariants: number;
}

// Configuration
export const GRID_CONFIG = {
  CELL_SIZE: 57, // meters
  SCALE: 1, // will be calculated based on zoom
  BLOCK_TYPES: [
    { width: 3, height: 2, name: '3x2', color: '#8b5cf6' },
    { width: 2, height: 2, name: '2x2', color: '#06b6d4' },
    { width: 3, height: 1, name: '3x1', color: '#10b981' },
    { width: 2, height: 1, name: '2x1', color: '#f59e0b' },
    { width: 1, height: 1, name: '1x1', color: '#6366f1' }
  ] as BlockType[],
  STRATEGIES_COUNT: 20,
  ANGLE_TOLERANCE: 20
} as const;
