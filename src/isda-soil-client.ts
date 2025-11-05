/**
 * ISDA Soil API Client
 *
 * This module provides a TypeScript client for interacting with the ISDA Soil API,
 * which provides soil property data and analysis for African locations.
 *
 * Key Features:
 * - JWT authentication with automatic token refresh
 * - Fetches soil property data for specific coordinates
 * - Supports multiple soil depths (0-20cm, 20-50cm)
 * - Returns soil properties with uncertainty intervals
 *
 * @module isda-soil-client
 */

import fetch, { Response } from 'node-fetch';

/**
 * Configuration for ISDA Soil API
 */
export interface ISDASoilConfig {
  baseUrl: string;
  username: string;
  password: string;
}

/**
 * JWT Token response from login endpoint
 */
interface TokenResponse {
  access_token: string;
  token_type: string;
}

/**
 * Soil property value with uncertainty intervals
 */
export interface SoilPropertyValue {
  value: {
    unit: string | null;
    type: string;
    value: number;
  };
  depth: {
    value: string;
    unit: string;
  };
  uncertainty?: Array<{
    confidence_interval: string;
    lower_bound: number;
    upper_bound: number;
  }>;
}

/**
 * Soil property data structure
 */
export interface SoilPropertyData {
  [propertyName: string]: SoilPropertyValue[];
}

/**
 * Complete soil data response
 */
export interface ISDASoilResponse {
  property: SoilPropertyData;
}

/**
 * Available soil layers/properties metadata
 */
export interface SoilLayerMetadata {
  [propertyName: string]: {
    description: string;
    theme: string;
    unit: string | null;
    uncertainty: boolean;
    value: {
      type: string;
    };
    depths: {
      unit: string;
      values: string[];
    };
  };
}

/**
 * Layers response structure
 */
export interface LayersResponse {
  property: SoilLayerMetadata;
}

/**
 * Client for interacting with ISDA Soil API
 */
export class ISDASoilClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: ISDASoilConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.username = config.username;
    this.password = config.password;
  }

  /**
   * Authenticate and get JWT token
   * Token expires after 1 hour - cached and refreshed automatically
   */
  private async authenticate(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) { // Refresh 1 minute before expiry
      return this.accessToken;
    }

    const url = `${this.baseUrl}/login`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'ISDA-Soil-MCP-Server/1.0.0'
        },
        body: `username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ISDA Soil API authentication error (${response.status}): ${errorText || response.statusText}`);
      }

      const data = await response.json() as TokenResponse;

      if (!data.access_token) {
        throw new Error('Invalid API response: missing access_token');
      }

      // Cache token and set expiry
      this.accessToken = data.access_token;
      
      // Try to decode JWT to get actual expiry time, fallback to 1 hour if decoding fails
      try {
        // JWT format: header.payload.signature
        const payload = JSON.parse(Buffer.from(data.access_token.split('.')[1], 'base64').toString());
        if (payload.exp) {
          // JWT exp is in seconds, convert to milliseconds
          this.tokenExpiry = payload.exp * 1000;
        } else {
          // Fallback: assume 1 hour expiry
          this.tokenExpiry = Date.now() + 3600000;
        }
      } catch {
        // If JWT decoding fails, assume 1 hour expiry
        this.tokenExpiry = Date.now() + 3600000;
      }

      return this.accessToken;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Authentication request timed out after 30 seconds');
      }
      throw new Error(`Failed to authenticate with ISDA Soil API: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get soil property data for a specific location
   * @param lat Latitude coordinate (-90 to 90, exclusive)
   * @param lon Longitude coordinate (-180 to 180, exclusive)
   * @param depth Optional depth filter ("0-20" or "20-50")
   * @returns Soil property data for the location
   */
  async getSoilPropertyData(lat: number, lon: number, depth?: string): Promise<ISDASoilResponse> {
    // Validate inputs
    if (typeof lat !== 'number' || isNaN(lat) || lat <= -90 || lat >= 90) {
      throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90 (exclusive).`);
    }
    if (typeof lon !== 'number' || isNaN(lon) || lon <= -180 || lon >= 180) {
      throw new Error(`Invalid longitude: ${lon}. Must be between -180 and 180 (exclusive).`);
    }
    if (depth && depth !== '0-20' && depth !== '20-50') {
      throw new Error(`Invalid depth: ${depth}. Must be "0-20" or "20-50".`);
    }

    // Get authentication token
    const token = await this.authenticate();

    // Build URL with query parameters
    const url = new URL(`${this.baseUrl}/isdasoil/v2/soilproperty`);
    url.searchParams.append('lat', lat.toString());
    url.searchParams.append('lon', lon.toString());
    if (depth) {
      url.searchParams.append('depth', depth);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'ISDA-Soil-MCP-Server/1.0.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          // Token might be expired, try to refresh
          this.accessToken = null;
          return this.getSoilPropertyData(lat, lon, depth); // Retry once
        }
        throw new Error(`ISDA Soil API error (${response.status}): ${errorText || response.statusText}`);
      }

      const data = await response.json() as ISDASoilResponse;

      if (!data || typeof data !== 'object' || !data.property) {
        throw new Error('Invalid API response format: expected object with property field');
      }

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Soil property data request timed out after 30 seconds');
      }
      throw new Error(`Failed to fetch soil property data: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get available soil layers/properties metadata
   * @returns Metadata about available soil properties
   */
  async getAvailableLayers(): Promise<LayersResponse> {
    // Get authentication token
    const token = await this.authenticate();

    const url = `${this.baseUrl}/isdasoil/v2/layers`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'ISDA-Soil-MCP-Server/1.0.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          // Token might be expired, try to refresh
          this.accessToken = null;
          return this.getAvailableLayers(); // Retry once
        }
        throw new Error(`ISDA Soil API error (${response.status}): ${errorText || response.statusText}`);
      }

      const data = await response.json() as LayersResponse;

      if (!data || typeof data !== 'object' || !data.property) {
        throw new Error('Invalid API response format: expected object with property field');
      }

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Layers request timed out after 30 seconds');
      }
      throw new Error(`Failed to fetch available layers: ${error.message || 'Unknown error'}`);
    }
  }
}

