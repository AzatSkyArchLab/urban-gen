/**
 * LayerService - API operations for layers
 *
 * Provides methods for:
 * - Listing layers
 * - Uploading GeoJSON
 * - Fetching layer data
 * - Deleting layers
 */

import { apiClient } from './ApiClient';
import type { LayerInfo, LayerListResponse, UploadResponse, HealthResponse } from '../types/api';

export class LayerService {
  /**
   * Check API health
   */
  async checkHealth(): Promise<HealthResponse> {
    return apiClient.get<HealthResponse>('/health');
  }

  /**
   * List all available layers
   */
  async listLayers(): Promise<LayerInfo[]> {
    const response = await apiClient.get<LayerListResponse>('/layers');
    return response.layers;
  }

  /**
   * Get layer metadata
   */
  async getLayer(layerId: string): Promise<LayerInfo> {
    return apiClient.get<LayerInfo>(`/layers/${layerId}`);
  }

  /**
   * Get layer GeoJSON data
   */
  async getLayerGeoJSON(layerId: string): Promise<GeoJSON.FeatureCollection> {
    return apiClient.get<GeoJSON.FeatureCollection>(`/layers/${layerId}/geojson`);
  }

  /**
   * Upload GeoJSON file as new layer
   */
  async uploadLayer(
    file: File,
    name?: string,
    description?: string
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    if (name) {
      formData.append('name', name);
    }
    if (description) {
      formData.append('description', description);
    }

    return apiClient.post<UploadResponse>('/layers/upload', formData);
  }

  /**
   * Delete a layer
   */
  async deleteLayer(layerId: string): Promise<void> {
    await apiClient.delete(`/layers/${layerId}`);
  }
}

// Singleton instance
export const layerService = new LayerService();
