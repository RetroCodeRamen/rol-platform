/**
 * Shared HTTP Client
 * 
 * Centralizes authentication, CSRF token handling, and error handling
 * for all API requests. Reduces duplication across services.
 */

import { getCSRFToken } from '@/lib/security/csrfClient';

export interface HttpClientOptions extends RequestInit {
  requireAuth?: boolean; // Default: true
  requireCSRF?: boolean; // Default: true
  skipErrorHandling?: boolean; // Default: false
}

export class HttpClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Make an authenticated API request
   */
  async request<T = any>(
    endpoint: string,
    options: HttpClientOptions = {}
  ): Promise<T> {
    const {
      requireAuth = true,
      requireCSRF = true,
      skipErrorHandling = false,
      headers = {},
      ...fetchOptions
    } = options;

    const url = `${this.baseUrl}${endpoint}`;
    const requestHeaders = new Headers(headers);

    // Set Content-Type if not already set
    if (!requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json');
    }

    // Add CSRF token if required
    if (requireCSRF) {
      try {
        const csrfToken = await getCSRFToken();
        if (csrfToken) {
          requestHeaders.set('X-CSRF-Token', csrfToken);
        }
      } catch (error) {
        // CSRF token fetch failed, but continue with request
        // (some endpoints might not require CSRF)
      }
    }

    // Always include credentials for cookies
    const response = await fetch(url, {
      ...fetchOptions,
      headers: requestHeaders,
      credentials: 'include',
    });

    // Handle errors unless explicitly skipped
    if (!skipErrorHandling && !response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP error! status: ${response.status}`,
      }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    // Return JSON if response has content
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return response as any;
  }

  /**
   * Convenience methods
   */
  async get<T = any>(endpoint: string, options?: HttpClientOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T = any>(
    endpoint: string,
    body?: any,
    options?: HttpClientOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T = any>(
    endpoint: string,
    body?: any,
    options?: HttpClientOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = any>(
    endpoint: string,
    options?: HttpClientOptions
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Export singleton instance for convenience
export const httpClient = new HttpClient();

