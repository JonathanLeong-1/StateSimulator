import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadGeoDatasetBrowser } from './GeoDataset.browser';

describe('loadGeoDatasetBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to provide all mock URLs
  const mockFetchSuccess = () => {
    const mockManifest = {
      version: 1,
      elevation: { file: 'elevation.bin', width: 100, height: 50, bounds: [-180, -90, 180, 90], seaLevel: 0 },
      koppen: { file: 'koppen.bin', width: 100, height: 50, bounds: [-180, -90, 180, 90] },
      rivers: { file: 'rivers.geojson' },
    };
    const elevBuffer = new ArrayBuffer(100 * 50 * 2);
    const koppenBuffer = new ArrayBuffer(100 * 50);
    const riverGeoJSON = { type: 'FeatureCollection', features: [] };

    return vi.fn((url: string) => {
      if (url.includes('manifest.json')) return Promise.resolve(new Response(JSON.stringify(mockManifest)));
      if (url.includes('elevation.bin')) return Promise.resolve(new Response(elevBuffer));
      if (url.includes('koppen.bin')) return Promise.resolve(new Response(koppenBuffer));
      if (url.includes('rivers.geojson')) return Promise.resolve(new Response(JSON.stringify(riverGeoJSON)));
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });
  };

  it('should successfully load geodata', async () => {
    global.fetch = mockFetchSuccess() as any;
    const dataset = await loadGeoDatasetBrowser();
    expect(dataset).toBeDefined();
    expect(dataset.isLand).toBeDefined();
  });

  it('should handle fetch errors gracefully', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    ) as any;
    await expect(loadGeoDatasetBrowser()).rejects.toThrow();
  });
});

