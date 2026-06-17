import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SimulationProvider, useSimulation } from './SimulationContext';
import { DEFAULT_GRID } from './geo/dimensionSolver';

/**
 * WS3 area #4 — the procedural generators (buildCircleWorld via mount-fallback /
 * resetSim, and randomizeContinents) must no longer hardcode 160×100 and must
 * produce a valid WorldData with land at the shared DEFAULT_GRID dimensions.
 */
describe('SimulationContext procedural generators (variable-grid default)', () => {
  beforeEach(() => {
    // Force the mount effect down the buildCircleWorld fallback path (no network
    // in tests) so the default world is the procedural circle generator output.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in test'))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mount fallback builds a circle world at the default grid with land present', async () => {
    const { result } = renderHook(() => useSimulation(), { wrapper: SimulationProvider });
    await waitFor(() => expect(result.current.world).not.toBeNull());
    const world = result.current.world!;
    expect(world.width).toBe(DEFAULT_GRID.width);
    expect(world.height).toBe(DEFAULT_GRID.height);
    expect(world.tiles).toHaveLength(DEFAULT_GRID.width * DEFAULT_GRID.height);
    expect(world.totalLandTiles).toBeGreaterThan(0);
  });

  it('resetSim rebuilds a circle world at the default grid (no hardcoded 160×100)', async () => {
    const { result } = renderHook(() => useSimulation(), { wrapper: SimulationProvider });
    await waitFor(() => expect(result.current.world).not.toBeNull());
    act(() => result.current.resetSim());
    const world = result.current.world!;
    expect(world.width).toBe(DEFAULT_GRID.width);
    expect(world.height).toBe(DEFAULT_GRID.height);
    expect(world.tiles).toHaveLength(DEFAULT_GRID.width * DEFAULT_GRID.height);
    expect(world.totalLandTiles).toBeGreaterThan(0);
  });

  it('randomizeContinents produces a valid world at the default grid with land', async () => {
    const { result } = renderHook(() => useSimulation(), { wrapper: SimulationProvider });
    await waitFor(() => expect(result.current.world).not.toBeNull());
    act(() => result.current.randomizeContinents());
    const world = result.current.world!;
    expect(world.width).toBe(DEFAULT_GRID.width);
    expect(world.height).toBe(DEFAULT_GRID.height);
    expect(world.tiles).toHaveLength(DEFAULT_GRID.width * DEFAULT_GRID.height);
    expect(world.totalLandTiles).toBeGreaterThan(0);
    // The two largest landmasses get continent ids 0/1; ocean tiles have none.
    // (fromCustomMap intentionally leaves smaller blobs' continent null.)
    expect(world.tiles.some(t => t.continent === 0)).toBe(true);
    for (const tile of world.tiles) {
      if (tile.terrain === 'ocean') expect(tile.continent).toBeNull();
    }
  });
});
