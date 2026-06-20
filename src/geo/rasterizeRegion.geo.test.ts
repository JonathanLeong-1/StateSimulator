/**
 * Geographic-correctness validation for the shared rasterizer core (§6).
 *
 * Complements `rasterizeRegion.test.ts` with the harder end-to-end checks the
 * Gate-3 review requires: real-world biome sanity over the bundled geodata
 * (Arctic tundra, whole-world mix), determinism, and a no-cosmetic-smoothing
 * proof (§6.2) using a synthetic single-cell island. Budgets are deliberately
 * small to keep runtime low.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { rasterizeRegion } from './rasterizeRegion';
import { loadGeoDatasetFromDir } from './GeoDataset.node';
import { RasterGeoDataset, type GeoManifest } from './GeoDataset';
import type { RasterGeoDataset as RasterGeoDatasetType } from './GeoDataset';
import type { SavedCustomMap } from '../types/mapbuilder';
import type { TerrainType } from '../types/world';
import type { BoundingBox } from './dimensionSolver';

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
  expect(map.width).toBeGreaterThan(0);
  expect(map.height).toBeGreaterThan(0);
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

describe('rasterizeRegion geographic correctness (real geodata)', () => {
  let ds: RasterGeoDatasetType;

  beforeAll(() => {
    ds = loadGeoDatasetFromDir(join(process.cwd(), 'public', 'geodata'));
  });

  it('should classify the mid-Pacific as essentially all ocean', async () => {
    const bbox: BoundingBox = { lonMin: -150, latMin: -10, lonMax: -130, latMax: 10 };
    const map = await rasterizeRegion(bbox, ds, { name: 'Pacific', hexBudget: 2000 });
    expectValidMap(map);
    const h = histogram(map);
     
    console.log('[geo] Pacific histogram:', JSON.stringify(h));
    const oceanFrac = (h.ocean ?? 0) / map.tiles.length;
    expect(oceanFrac).toBeGreaterThan(0.98);
  });

  it('should produce mountains over the Himalaya / Tibet', async () => {
    const bbox: BoundingBox = { lonMin: 80, latMin: 27, lonMax: 95, latMax: 36 };
    const map = await rasterizeRegion(bbox, ds, { name: 'Himalaya', hexBudget: 3000 });
    expectValidMap(map);
    const h = histogram(map);
     
    console.log('[geo] Himalaya histogram:', JSON.stringify(h));
    expect(h.mountains ?? 0).toBeGreaterThan(0);
  });

  it('should produce desert over the Sahara', async () => {
    const bbox: BoundingBox = { lonMin: 5, latMin: 18, lonMax: 30, latMax: 28 };
    const map = await rasterizeRegion(bbox, ds, { name: 'Sahara', hexBudget: 3000 });
    expectValidMap(map);
    const h = histogram(map);
     
    console.log('[geo] Sahara histogram:', JSON.stringify(h));
    expect(h.desert ?? 0).toBeGreaterThan(0);
  });

  it('should produce tundra over the high-Arctic (northern Siberia)', async () => {
    const bbox: BoundingBox = { lonMin: 60, latMin: 68, lonMax: 130, latMax: 78 };
    const map = await rasterizeRegion(bbox, ds, { name: 'Arctic', hexBudget: 4000 });
    expectValidMap(map);
    const h = histogram(map);
     
    console.log('[geo] Arctic histogram:', JSON.stringify(h));
    expect(h.tundra ?? 0).toBeGreaterThan(0);
  });

  it('should produce a healthy biome mix over the whole world', async () => {
    const bbox: BoundingBox = { lonMin: -180, latMin: -90, lonMax: 180, latMax: 90 };
    const map = await rasterizeRegion(bbox, ds, { name: 'World', hexBudget: 8000 });
    expectValidMap(map);
    const h = histogram(map);
     
    console.log('[geo] World histogram:', JSON.stringify(h));

    // Ocean dominates Earth's surface.
    const oceanFrac = (h.ocean ?? 0) / map.tiles.length;
    expect(oceanFrac).toBeGreaterThan(0.5);
    expect(oceanFrac).toBeLessThan(0.95);

    // Every major land biome should appear somewhere on the globe.
    for (const biome of ['forest', 'desert', 'plains', 'mountains', 'tundra'] as const) {
      expect(h[biome] ?? 0).toBeGreaterThan(0);
    }
  });

  it('should be deterministic for identical bbox + budget', async () => {
    const bbox: BoundingBox = { lonMin: -19, latMin: -35, lonMax: 52, latMax: 38 };
    const a = await rasterizeRegion(bbox, ds, { name: 'Africa', hexBudget: 2500 });
    const b = await rasterizeRegion(bbox, ds, { name: 'Africa', hexBudget: 2500 });
    expect(b.width).toBe(a.width);
    expect(b.height).toBe(a.height);
    expect(b.tiles.length).toBe(a.tiles.length);
    for (let i = 0; i < a.tiles.length; i++) {
      expect(b.tiles[i].terrain).toBe(a.tiles[i].terrain);
      expect(b.tiles[i].index).toBe(a.tiles[i].index);
    }
  });
});

/**
 * Build a synthetic dataset whose only land is a single 1°×1° cell at the
 * centre of a 15×15° window, everything else ocean. Used to prove the pipeline
 * performs NO cosmetic smoothing (§6.2): an isolated single-hex island must
 * survive rather than be dissolved into the surrounding ocean.
 */
function makeSingleIslandDataset(): RasterGeoDataset {
  const W = 15;
  const H = 15;
  const manifest: GeoManifest = {
    version: 1,
    elevation: { file: 'e.bin', width: W, height: H, bounds: [0, 0, 15, 15], seaLevel: 0 },
    koppen: { file: 'k.bin', width: W, height: H, bounds: [0, 0, 15, 15] },
    rivers: { file: 'r.geojson' },
  };
  const elevation = new Int16Array(W * H).fill(-200);
  const koppen = new Uint8Array(W * H).fill(0);
  // Single land cell at the centre (col 7, row 7).
  const islandIdx = 7 * W + 7;
  elevation[islandIdx] = 400; // land
  koppen[islandIdx] = 14; // Cfa → forest
  return RasterGeoDataset.fromBuffers(manifest, {
    elevation: elevation.buffer,
    koppen: koppen.buffer,
    rivers: { features: [] } as never,
  });
}

describe('rasterizeRegion has no cosmetic post-processing (§6.2)', () => {
  it('should preserve an isolated single-cell island rather than smoothing it away', async () => {
    const ds = makeSingleIslandDataset();
    const bbox: BoundingBox = { lonMin: 0, latMin: 0, lonMax: 15, latMax: 15 };
    // Use a budget large enough that hex cells are < 1° wide, ensuring at
    // least one hex center falls within the 1°×1° island cell regardless of
    // grid column alignment.  400 hexes over 15°×15° → ~0.8° cells.
    const map = await rasterizeRegion(bbox, ds, { name: 'Island', hexBudget: 400 });
    expectValidMap(map);
    const h = histogram(map);
     
    console.log('[geo] single-island histogram:', JSON.stringify(h), `${map.width}x${map.height}`);

    const land = map.tiles.filter((t) => t.terrain !== 'ocean');
    // The lone island survives (a smoothing pass would erase it) ...
    expect(land.length).toBeGreaterThanOrEqual(1);
    // ... and is NOT grown into a large blob — stays a small isolated island.
    expect(land.length).toBeLessThanOrEqual(6);
    // Surviving tiles are valid land biomes (the steep coastal relief here
    // classes the lone cell as hills via TRI; either way it is NOT ocean).
    expect(land.every((t) => VALID_TERRAIN.has(t.terrain) && t.terrain !== 'ocean')).toBe(true);
  });

  it('should remain ocean everywhere when there is no land at all', async () => {
    const W = 8;
    const H = 8;
    const manifest: GeoManifest = {
      version: 1,
      elevation: { file: 'e.bin', width: W, height: H, bounds: [0, 0, 10, 10], seaLevel: 0 },
      koppen: { file: 'k.bin', width: W, height: H, bounds: [0, 0, 10, 10] },
      rivers: { file: 'r.geojson' },
    };
    const ds = RasterGeoDataset.fromBuffers(manifest, {
      elevation: new Int16Array(W * H).fill(-500).buffer,
      koppen: new Uint8Array(W * H).fill(0).buffer,
      rivers: { features: [] } as never,
    });
    const map = await rasterizeRegion(
      { lonMin: 0, latMin: 0, lonMax: 10, latMax: 10 },
      ds,
      { name: 'AllOcean', hexBudget: 200 },
    );
    expectValidMap(map);
    expect(map.tiles.every((t) => t.terrain === 'ocean')).toBe(true);
  });

  it('should not throw when the dataset has null/empty river geometry', async () => {
    const W = 8;
    const H = 8;
    const manifest: GeoManifest = {
      version: 1,
      elevation: { file: 'e.bin', width: W, height: H, bounds: [0, 0, 10, 10], seaLevel: 0 },
      koppen: { file: 'k.bin', width: W, height: H, bounds: [0, 0, 10, 10] },
      rivers: { file: 'r.geojson' },
    };
    const ds = RasterGeoDataset.fromBuffers(manifest, {
      elevation: new Int16Array(W * H).fill(300).buffer, // all land
      koppen: new Uint8Array(W * H).fill(14).buffer, // Cfa → forest
      rivers: {
        features: [
          { geometry: null },
          { geometry: { type: 'LineString', coordinates: null } },
          {},
        ],
      } as never,
    });
    await expect(
      rasterizeRegion({ lonMin: 0, latMin: 0, lonMax: 10, latMax: 10 }, ds, {
        name: 'NullRivers',
        hexBudget: 200,
      }),
    ).resolves.toBeDefined();
  });
});
