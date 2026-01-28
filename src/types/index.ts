import type { Feature, FeatureCollection, Geometry, LineString, Polygon } from 'geojson';

// ============================================
// Geometry Types
// ============================================
export type Coordinate = [number, number];
export type Coordinate3D = [number, number, number];

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ============================================
// GeoJSON Extensions
// ============================================
export interface FeatureProperties {
  id?: string;
  name?: string;
  type?: string;
  selected?: boolean;
  [key: string]: any;
}

export type UrbanFeature = Feature<Geometry, FeatureProperties>;
export type UrbanFeatureCollection = FeatureCollection<Geometry, FeatureProperties>;

// ============================================
// Tool Types
// ============================================
export interface Tool {
  id: string;
  name: string;
  cursor: string;
  activate(): void;
  deactivate(): void;
  onMapClick?(e: MapClickEvent): void;
  onMapMouseMove?(e: MapMouseEvent): void;
  onKeyDown?(e: KeyboardEvent): void;
}

export interface MapClickEvent {
  lngLat: { lng: number; lat: number };
  point: { x: number; y: number };
}

export interface MapMouseEvent {
  lngLat: { lng: number; lat: number };
  point: { x: number; y: number };
}

// ============================================
// Drawing Types
// ============================================
export interface DrawState {
  points: Coordinate[];
  isComplete: boolean;
}

// ============================================
// Road Types
// ============================================
export interface RoadSegment {
  id: string;
  geometry: LineString;
  properties: {
    highway?: string;
    name?: string;
    lanes?: number;
    width?: number;
  };
}

// ============================================
// Building Types
// ============================================
export interface Building {
  id: string;
  geometry: Polygon;
  properties: {
    height?: number;
    floors?: number;
    type?: string;
  };
}