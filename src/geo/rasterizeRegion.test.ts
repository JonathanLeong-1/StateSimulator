import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { rasterizeRegion } from './rasterizeRegion';
import { loadGeoDatasetFromDir } from './GeoDataset.node';
import type { RasterGeoDataset } from './GeoDataset';
import type { SavedCustomMap } from '../types/mapbuilder';
import type { TerrainType } from '../types/world';

const VALID_TERRAIN: ReadonlySet<TerrainType> = new Set<TerrainType>([
  'ocean',
  'plains',
  'river_valley',
  'forest',
  'hills',
  'mountains',
  'desert',
  'tundra',
]);

/** Assert the structural invariants of a SavedCustomMap. */
function expectValidMap(map: SavedCustomMap): void {
  expect(map.version).toBe(1);
  expect(typeof map.name).toBe('string');
  expect(Number.isNaN(Date.parse(map.savedAt))).toBe(false);
  expect(map.width).toBeGreaterThanOrEqual(8);
  expect(map.height).toBeGreaterThanOrEqual(8);
  expect(map.tiles.length).toBe(map.width * map.height);
  for (let i = 0; i < map.tiles.length; i++) {
    const t = map.tiles[i];
    expect(t.index).toBe(i); // contiguous 0..n-1
    expect(VALID_TERRAIN.has(t.terrain)).toBe(true);
    expect(t.productivityOverride).toBeNull();
  }
}

/** Tally terrain counts for a quick histogram / assertions. */
function histogram(map: SavedCustomMap): Record<string, number> {
  const h: Record<string, number> = {};
  for (const t of map.tiles) h[t.terrain] = (h[t.terrain] ?? 0) + 1;
  return h;
}

describe('rasterizeRegion over the real bundled geodata', () => {
  let ds: RasterGeoDataset;

  beforeAll(() => {
    ds = loadGeoDatasetFromDir(join(process.cwd(), 'public', 'geodata'));
  });

  it('should produce a valid SavedCustomMap with contiguous indices', async () => {
    const map = await rasterizeRegion(
      { lonMin: -19, latMin: -35, lonMax: 52, latMax: 38 },
      ds,
      { name: 'Africa (test)', hexBudget: 1500 },
    );
    expectValidMap(map);
  });

  it('should classify open ocean as ocean', async () => {
    const map = await rasterizeRegion(
      { lonMin: -160, latMin: -20, lonMax: -140, latMax: 0 },
      ds,
      { name: 'Pacific (test)', hexBudget: 400 },
    );
    expectValidMap(map);
    const h = histogram(map);
    const ocean = h.ocean ?? 0;
    expect(ocean / map.tiles.length).toBeGreaterThan(0.7);
  });

  it('should yield some mountains over the Himalaya', async () => {
    const map = await rasterizeRegion(
      { lonMin: 80, latMin: 27, lonMax: 95, latMax: 36 },
      ds,
      { name: 'Himalaya (test)', hexBudget: 2000 },
    );
    expectValidMap(map);
    const h = histogram(map);
    expect(h.mountains ?? 0).toBeGreaterThan(0);
  });

  it('should yield some desert over the Sahara', async () => {
    const map = await rasterizeRegion(
      { lonMin: 10, latMin: 18, lonMax: 30, latMax: 28 },
      ds,
      { name: 'Sahara (test)', hexBudget: 1000 },
    );
    expectValidMap(map);
    const h = histogram(map);
    expect(h.desert ?? 0).toBeGreaterThan(0);
  });

  it('should honor an explicit supersample factor', async () => {
    const map = await rasterizeRegion(
      { lonMin: -10, latMin: 35, lonMax: 20, latMax: 55 },
      ds,
      { name: 'Western Europe (test)', hexBudget: 800, supersample: 2 },
    );
    expectValidMap(map);
  });
});
