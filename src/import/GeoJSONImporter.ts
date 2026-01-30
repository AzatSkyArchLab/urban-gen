/**
 * GeoJSONImporter - handles importing GeoJSON files to the server
 *
 * Features:
 * - File validation
 * - Upload to API
 * - Add layer to map
 */

import { eventBus } from '../core/EventBus';
import { layerService } from '../services/LayerService';
import type { UploadResponse } from '../types/api';

export interface ImportResult {
  success: boolean;
  layerId?: string;
  name?: string;
  featureCount?: number;
  error?: string;
}

export class GeoJSONImporter {
  /**
   * Validate file before upload
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    // Check file extension
    const validExtensions = ['.geojson', '.json'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(ext)) {
      return {
        valid: false,
        error: 'Invalid file type. Please upload .geojson or .json file.'
      };
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File too large. Maximum size is 50MB.'
      };
    }

    return { valid: true };
  }

  /**
   * Import GeoJSON file
   */
  async import(
    file: File,
    name?: string,
    description?: string
  ): Promise<ImportResult> {
    // Validate file
    const validation = this.validateFile(file);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    try {
      eventBus.emit('import:start', { fileName: file.name });

      // Upload to API
      const response: UploadResponse = await layerService.uploadLayer(
        file,
        name,
        description
      );

      if (response.success) {
        eventBus.emit('import:complete', {
          layerId: response.layer_id,
          name: response.name,
          featureCount: response.feature_count
        });

        return {
          success: true,
          layerId: response.layer_id,
          name: response.name,
          featureCount: response.feature_count
        };
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      eventBus.emit('import:error', { error: errorMessage });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Read file as text (for preview)
   */
  async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Parse GeoJSON from text (for preview)
   */
  parseGeoJSON(text: string): GeoJSON.FeatureCollection | null {
    try {
      const data = JSON.parse(text);

      // Normalize to FeatureCollection
      if (data.type === 'FeatureCollection') {
        return data;
      } else if (data.type === 'Feature') {
        return { type: 'FeatureCollection', features: [data] };
      } else if (data.coordinates) {
        return {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: data,
            properties: {}
          }]
        };
      }

      return null;
    } catch {
      return null;
    }
  }
}

// Singleton instance
export const geoJSONImporter = new GeoJSONImporter();
