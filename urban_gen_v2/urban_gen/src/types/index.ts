// ============================================
// Coordinates & Geometry
// ============================================
export type Coordinate = [number, number];

// ============================================
// Map Events
// ============================================
export interface MapClickEvent {
  lngLat: { lng: number; lat: number };
  point: { x: number; y: number };
}

export interface MapMouseEvent {
  lngLat: { lng: number; lat: number };
  point: { x: number; y: number };
}

export interface MapMoveEvent {
  center: { lng: number; lat: number };
  zoom: number;
  bounds: any;
}

// ============================================
// Tools
// ============================================
export interface Tool {
  id: string;
  name: string;
  cursor: string;
  activate(): void;
  deactivate(): void;
  onMapClick?(e: MapClickEvent): void;
  onMapDoubleClick?(e: MapClickEvent): void;
  onMapMouseMove?(e: MapMouseEvent): void;
  onKeyDown?(e: KeyboardEvent): void;
}

// ============================================
// Features
// ============================================
export interface UrbanFeature extends GeoJSON.Feature {
  properties: {
    id: string;
    type: string;
    name?: string;
    createdAt: string;
    updatedAt?: string;
    [key: string]: any;
  };
}

export interface FeatureCollection extends GeoJSON.FeatureCollection {
  features: UrbanFeature[];
}

// ============================================
// Layers
// ============================================
export interface LayerStyle {
  color: string;
  width?: number;
  opacity?: number;
  dasharray?: number[];
}

export interface LayerState {
  id: string;
  visible: boolean;
  order: number;
  style: LayerStyle;
}

// ============================================
// UI
// ============================================
export interface PanelConfig {
  id: string;
  title: string;
  containerId: string;
  collapsed?: boolean;
}
