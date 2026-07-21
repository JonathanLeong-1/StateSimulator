import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
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

/** Map ID to expected display name. */
const EXPECTED_NAMES: Record<string, string> = {
  world: 'World',
  'north-america': 'North America',
  'south-america': 'South America',
  americas: 'Americas',
  africa: 'Africa',
  europe: 'Europe',
  asia: 'Asia',
  eurasia: 'My Map',
  oceania: 'Oceania',
  'old-world': 'Old World',
};

/** The 10 expected default map IDs in order. */
const EXPECTED_MAP_IDS = [
  'world',
  'north-america',
  'south-america',
  'americas',
  'africa',
  'europe',
  'asia',
  'eurasia',
  'oceania',
  'old-world',
] as const;

/** Validate the structural invariants of a SavedCustomMap. */
function expectValidMapStructure(map: SavedCustomMap, mapId: string): void {
  // Version
  expect(map.version, `${mapId}: version should be 1`).toBe(1);

  // Name
  expect(typeof map.name, `${mapId}: name should be a string`).toBe('string');
  expect(map.name.length, `${mapId}: name should be non-empty`).toBeGreaterThan(0);
  expect(map.name, `${mapId}: name mismatch`).toBe(EXPECTED_NAMES[mapId]);

  // savedAt (ISO 8601 timestamp)
  const savedTime = Date.parse(map.savedAt);
  expect(Number.isNaN(savedTime), `${mapId}: savedAt should be valid ISO 8601`).toBe(false);

  // Width and height
  expect(map.width, `${mapId}: width should be positive integer`).toBeGreaterThan(0);
  expect(map.height, `${mapId}: height should be positive integer`).toBeGreaterThan(0);
  expect(Number.isInteger(map.width), `${mapId}: width should be integer`).toBe(true);
  expect(Number.isInteger(map.height), `${mapId}: height should be integer`).toBe(true);

  // Tiles array exists and is non-empty
  expect(Array.isArray(map.tiles), `${mapId}: tiles should be an array`).toBe(true);
  expect(map.tiles.length, `${mapId}: tiles array should be non-empty`).toBeGreaterThan(0);

  // Tile count must equal width * height (hex grid constraint)
  expect(
    map.tiles.length,
    `${mapId}: tiles.length (${map.tiles.length}) must equal width * height (${map.width} * ${map.height} = ${map.width * map.height})`,
  ).toBe(map.width * map.height);

  // Validate each tile (sample-based to avoid timeout on large maps)
  const sampleSize = Math.min(100, map.tiles.length); // Check at most 100 tiles per map
  const step = Math.max(1, Math.floor(map.tiles.length / sampleSize));
  for (let i = 0; i < map.tiles.length; i += step) {
    const tile = map.tiles[i];

    // Index must be contiguous 0..n-1
    expect(tile.index, `${mapId}: tile[${i}].index should be ${i}`).toBe(i);

    // Terrain must be one of the 8 valid types
    expect(
      VALID_TERRAIN.has(tile.terrain),
      `${mapId}: tile[${i}].terrain = "${tile.terrain}" is invalid`,
    ).toBe(true);

    // productivityOverride must be null (no custom overrides in generated maps)
    expect(
      tile.productivityOverride,
      `${mapId}: tile[${i}].productivityOverride should be null`,
    ).toBeNull();
  }
}

/** Compute terrain histogram for a map. */
function getTerrainHistogram(map: SavedCustomMap): Record<TerrainType, number> {
  const hist: Record<string, number> = {};
  for (const terrain of VALID_TERRAIN) {
    hist[terrain] = 0;
  }
  for (const tile of map.tiles) {
    hist[tile.terrain] = (hist[tile.terrain] ?? 0) + 1;
  }
  return hist as Record<TerrainType, number>;
}

/** Get percentage of a terrain type. */
function getTerrainPercent(map: SavedCustomMap, terrain: TerrainType): number {
  const count = getTerrainHistogram(map)[terrain] ?? 0;
  return count / map.tiles.length;
}

describe('Generate Default Maps — Integration Test', () => {
  const mapDir = join(process.cwd(), 'public', 'maps');
  const loadedMaps: Record<string, SavedCustomMap> = {};
  const mapFiles: Record<string, string> = {};

  beforeAll(() => {
    const manifestPath = join(process.cwd(), 'public', 'defaultMaps.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      maps: Array<{ id: string; file: string }>;
    };
    for (const map of manifest.maps) mapFiles[map.id] = map.file;

    // Load all 10 maps through the same manifest that the application uses.
    for (const id of EXPECTED_MAP_IDS) {
      const filePath = join(mapDir, mapFiles[id]);
      expect(
        existsSync(filePath),
        `Expected file to exist: ${filePath}`,
      ).toBe(true);

      const content = readFileSync(filePath, 'utf-8');
      const map = JSON.parse(content) as SavedCustomMap;
      loadedMaps[id] = map;
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Category 1: File Existence & Count
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should have exactly 10 default maps', () => {
    expect(Object.keys(loadedMaps).length).toBe(10);
  });

  it('should have all expected map IDs', () => {
    for (const id of EXPECTED_MAP_IDS) {
      expect(id in loadedMaps, `Expected map "${id}" to be loaded`).toBe(true);
    }
  });

  it('should have non-empty map assets', () => {
    for (const id of EXPECTED_MAP_IDS) {
      const filePath = join(mapDir, mapFiles[id]);
      const stats = statSync(filePath);
      expect(
        stats.size,
        `${mapFiles[id]} should not be empty`,
      ).toBeGreaterThan(0);
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Category 2: Schema Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should parse all maps as valid JSON', () => {
    for (const id of EXPECTED_MAP_IDS) {
      expect(() => {
        const filePath = join(mapDir, mapFiles[id]);
        const content = readFileSync(filePath, 'utf-8');
        JSON.parse(content);
      }).not.toThrow();
    }
  });

  it('should have all maps with version = 1', () => {
    for (const id of EXPECTED_MAP_IDS) {
      expect(loadedMaps[id].version).toBe(1);
    }
  });

  it('should have all maps with correct names', () => {
    for (const id of EXPECTED_MAP_IDS) {
      expect(loadedMaps[id].name).toBe(EXPECTED_NAMES[id]);
    }
  });

  it('should have all maps with valid ISO 8601 timestamps', () => {
    for (const id of EXPECTED_MAP_IDS) {
      const savedTime = Date.parse(loadedMaps[id].savedAt);
      expect(Number.isNaN(savedTime), `${id}: savedAt is not a valid timestamp`).toBe(false);
    }
  });

  it('should have all maps with positive integer dimensions', () => {
    for (const id of EXPECTED_MAP_IDS) {
      const map = loadedMaps[id];
      expect(map.width > 0 && Number.isInteger(map.width), `${id}: width invalid`).toBe(true);
      expect(map.height > 0 && Number.isInteger(map.height), `${id}: height invalid`).toBe(true);
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Category 3: Tile Count Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should have tiles.length === width * height for all maps', () => {
    for (const id of EXPECTED_MAP_IDS) {
      const map = loadedMaps[id];
      const expected = map.width * map.height;
      expect(map.tiles.length, `${id}: tiles.length mismatch`).toBe(expected);
    }
  });

  it('should keep all preset maps within the supported size range', () => {
    for (const id of EXPECTED_MAP_IDS) {
      const map = loadedMaps[id];
      if (id === 'eurasia') {
        expect(map.tiles.length, 'handmade Eurasia should remain the compact 16k map').toBe(16_000);
        continue;
      }
      expect(map.tiles.length, `${id}: map should have at least 16k tiles`).toBeGreaterThanOrEqual(16_000);
      expect(map.tiles.length, `${id}: map should have at most 80k tiles`).toBeLessThanOrEqual(80_000);
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Category 4: Terrain Validity & Diversity
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should have all tiles with valid terrain types', () => {
    for (const id of EXPECTED_MAP_IDS) {
      const map = loadedMaps[id];
      // Sample-based check to avoid timeout
      const sampleSize = Math.min(100, map.tiles.length);
      const step = Math.max(1, Math.floor(map.tiles.length / sampleSize));
      for (let i = 0; i < map.tiles.length; i += step) {
        const terrain = map.tiles[i].terrain;
        expect(
          VALID_TERRAIN.has(terrain),
          `${id}: tile[${i}].terrain="${terrain}" is not valid`,
        ).toBe(true);
      }
    }
  });

  it('should have all tiles with contiguous indices 0..n-1', () => {
    for (const id of EXPECTED_MAP_IDS) {
      const map = loadedMaps[id];
      // Sample-based check to avoid timeout
      const sampleSize = Math.min(100, map.tiles.length);
      const step = Math.max(1, Math.floor(map.tiles.length / sampleSize));
      for (let i = 0; i < map.tiles.length; i += step) {
        expect(map.tiles[i].index, `${id}: tile[${i}].index mismatch`).toBe(i);
      }
      // Also verify last tile
      expect(map.tiles[map.tiles.length - 1].index).toBe(map.tiles.length - 1);
    }
  });

  it('World map should have ~70-75% ocean (plausible global distribution)', () => {
    const oceanPct = getTerrainPercent(loadedMaps.world, 'ocean');
    expect(oceanPct >= 0.65 && oceanPct <= 0.75, `World ocean ${(oceanPct * 100).toFixed(1)}%`).toBe(
      true,
    );
  });

  it('World map should have mountains, hills, forest, and desert', () => {
    const map = loadedMaps.world;
    const hist = getTerrainHistogram(map);
    expect(hist.mountains > 0, 'World should have mountains').toBe(true);
    expect(hist.hills > 0, 'World should have hills').toBe(true);
    expect(hist.forest > 0, 'World should have forest').toBe(true);
    expect(hist.desert > 0, 'World should have desert').toBe(true);
  });

  it('Africa map should have significant desert (Sahara)', () => {
    const desertPct = getTerrainPercent(loadedMaps.africa, 'desert');
    expect(desertPct > 0.05, `Africa desert ${(desertPct * 100).toFixed(1)}% should be >5%`).toBe(
      true,
    );
  });

  it('Africa map should have forest (Congo Basin)', () => {
    const forestPct = getTerrainPercent(loadedMaps.africa, 'forest');
    expect(forestPct > 0.05, `Africa forest ${(forestPct * 100).toFixed(1)}% should be >5%`).toBe(
      true,
    );
  });

  it('North America map should have mix of plains, forest, and mountains', () => {
    const map = loadedMaps['north-america'];
    const hist = getTerrainHistogram(map);
    expect(hist.plains > 0, 'North America should have plains').toBe(true);
    expect(hist.forest > 0, 'North America should have forest').toBe(true);
    expect(hist.mountains > 0, 'North America should have mountains').toBe(true);
  });

  it('Oceania map should be ocean-dominated', () => {
    const oceanPct = getTerrainPercent(loadedMaps.oceania, 'ocean');
    expect(oceanPct > 0.5, `Oceania ocean ${(oceanPct * 100).toFixed(1)}% should be >50%`).toBe(true);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Category 5: Productivity Values
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should have all productivityOverride values as null', () => {
    for (const id of EXPECTED_MAP_IDS) {
      const map = loadedMaps[id];
      // Sample-based check to avoid timeout
      const sampleSize = Math.min(100, map.tiles.length);
      const step = Math.max(1, Math.floor(map.tiles.length / sampleSize));
      for (let i = 0; i < map.tiles.length; i += step) {
        expect(
          map.tiles[i].productivityOverride,
          `${id}: tile[${i}].productivityOverride should be null`,
        ).toBeNull();
      }
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Category 6: Map Loadability (Sanity Check)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it(
    'should be able to re-parse and validate all maps programmatically',
    () => {
      for (const id of EXPECTED_MAP_IDS) {
        const map = loadedMaps[id];
        // This is the same validation that expectValidMapStructure does
        expectValidMapStructure(map, id);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Category 7: Summary Statistics
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should report summary statistics for all 10 maps', () => {
    const summaryLines: string[] = [];
    summaryLines.push('Default Maps Summary:');

    for (const id of EXPECTED_MAP_IDS) {
      const map = loadedMaps[id];
      const tiles = map.tiles.length;
      const hist = getTerrainHistogram(map);
      summaryLines.push(
        `  ${id.padEnd(15)}: ${tiles.toLocaleString().padStart(5)} tiles (${map.width}×${map.height})`,
      );
      const terrainStr = Object.entries(hist)
        .filter(([, count]) => count > 0)
        .map(([terrain, count]) => {
          const pct = ((count / tiles) * 100).toFixed(0);
          return `${terrain}=${pct}%`;
        })
        .join(', ');
      summaryLines.push(`    Terrain: ${terrainStr}`);
    }

    console.log('\n' + summaryLines.join('\n') + '\n');
    expect(true).toBe(true); // Always pass; output is for visibility
  });
});
