/**
 * API types for Urban Planning backend
 */

export interface LayerInfo {
  id: string;
  name: string;
  description?: string;
  feature_count: number;
  geometry_type?: string;
  bounds?: [number, number, number, number];
  created_at: string;
  file_size: number;
}

export interface LayerListResponse {
  layers: LayerInfo[];
  total: number;
}

export interface UploadResponse {
  success: boolean;
  layer_id: string;
  name: string;
  feature_count: number;
  message: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
}

export interface ApiError {
  error: string;
  detail?: string;
}
