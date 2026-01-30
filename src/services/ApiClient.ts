/**
 * ApiClient - HTTP client for Urban Planning API
 *
 * Handles authentication and request/response formatting
 */

import { Config } from '../core/Config';

export class ApiClient {
  private baseUrl: string;
  private authHeader: string;

  constructor() {
    this.baseUrl = Config.api.baseUrl;
    this.authHeader = 'Basic ' + btoa(Config.api.martinAuth);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Authorization': this.authHeader,
      ...options.headers
    };

    // Don't set Content-Type for FormData (browser will set it with boundary)
    if (!(options.body instanceof FormData)) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.detail || error.error || 'Request failed');
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    const options: RequestInit = { method: 'POST' };

    if (body instanceof FormData) {
      options.body = body;
    } else if (body) {
      options.body = JSON.stringify(body);
    }

    return this.request<T>(endpoint, options);
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Singleton instance
export const apiClient = new ApiClient();
