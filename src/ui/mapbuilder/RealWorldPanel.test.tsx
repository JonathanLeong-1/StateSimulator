import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RealWorldPanel } from './RealWorldPanel';
import * as GeoDatasetBrowser from '../../geo/GeoDataset.browser';

// Mock the MapBuilder context
vi.mock('../mapbuilder/MapBuilderContext', () => ({
  useMapBuilder: () => ({
    loadMap: vi.fn(),
  }),
}));

describe('RealWorldPanel', () => {
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

  it('should render the panel with title', async () => {
    render(<RealWorldPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Real-World Region/i)).toBeDefined();
    });
  });

  it('should load geodata on mount', async () => {
    render(<RealWorldPanel />);
    await waitFor(() => {
      expect(GeoDatasetBrowser.loadGeoDatasetBrowser).toHaveBeenCalled();
    });
  });

  it('should show error if geodata fails to load', async () => {
    vi.spyOn(GeoDatasetBrowser, 'loadGeoDatasetBrowser').mockRejectedValueOnce(
      new Error('Network error')
    );
    render(<RealWorldPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load/i)).toBeDefined();
    });
  });
});
