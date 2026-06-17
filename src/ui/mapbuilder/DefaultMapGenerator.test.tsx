import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DefaultMapGenerator } from './DefaultMapGenerator';
import * as GeoDatasetBrowser from '../../geo/GeoDataset.browser';

describe('DefaultMapGenerator', () => {
  const mockGeodataset = {
    sampleElevation: vi.fn(() => 100),
    sampleKoppen: vi.fn(() => 5),
    isLand: vi.fn(() => true),
    riverNear: vi.fn(() => false),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(GeoDatasetBrowser, 'loadGeoDatasetBrowser').mockResolvedValue(mockGeodataset as any);
  });

  it('should render the dev panel', async () => {
    render(<DefaultMapGenerator />);
    await waitFor(() => {
      expect(screen.getByText(/Dev: Default Map Generator/i)).toBeDefined();
    });
  });

  it('should load geodata on mount', async () => {
    render(<DefaultMapGenerator />);
    await waitFor(() => {
      expect(GeoDatasetBrowser.loadGeoDatasetBrowser).toHaveBeenCalled();
    });
  });

  it('should show error if geodata load fails', async () => {
    vi.spyOn(GeoDatasetBrowser, 'loadGeoDatasetBrowser').mockRejectedValueOnce(
      new Error('Failed to load')
    );
    render(<DefaultMapGenerator />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load/)).toBeDefined();
    });
  });
});
