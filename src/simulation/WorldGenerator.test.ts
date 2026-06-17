import { describe, it, expect } from 'vitest';
import { WorldGenerator } from './WorldGenerator';

const defaultConfig = { width: 40, height: 25, seed: 42, seaConquestRadius: 3 };

describe('WorldGenerator', () => {
  it('should generate correct number of tiles', () => {
    const world = new WorldGenerator().generate(defaultConfig);
    expect(world.tiles.length).toBe(defaultConfig.width * defaultConfig.height);
  });

  it('should be deterministic — same seed same output', () => {
    const world1 = new WorldGenerator().generate(defaultConfig);
    const world2 = new WorldGenerator().generate(defaultConfig);
    expect(world1.tiles.map(t => t.terrain)).toEqual(world2.tiles.map(t => t.terrain));
  });

  it('should produce different output for different seeds', () => {
    const world1 = new WorldGenerator().generate(defaultConfig);
    const world2 = new WorldGenerator().generate({ ...defaultConfig, seed: 99 });
    const differs = world1.tiles.some((t, i) => t.terrain !== world2.tiles[i].terrain);
    expect(differs).toBe(true);
  });

  it('should have all tiles with valid terrain types', () => {
    const validTerrains = new Set([
      'ocean', 'plains', 'river_valley', 'forest', 'hills', 'mountains', 'desert', 'tundra',
    ]);
    const world = new WorldGenerator().generate(defaultConfig);
    for (const tile of world.tiles) {
      expect(validTerrains.has(tile.terrain)).toBe(true);
    }
  });

  it('should have ocean tiles with productivity 0', () => {
    const world = new WorldGenerator().generate(defaultConfig);
    for (const tile of world.tiles) {
      if (tile.terrain === 'ocean') {
        expect(tile.productivity).toBe(0);
      }
    }
  });

  it('should have ocean tiles with obstacle 1', () => {
    const world = new WorldGenerator().generate(defaultConfig);
    for (const tile of world.tiles) {
      if (tile.terrain === 'ocean') {
        expect(tile.obstacle).toBe(1);
      }
    }
  });

  it('should have at least some land tiles', () => {
    const world = new WorldGenerator().generate(defaultConfig);
    expect(world.totalLandTiles).toBeGreaterThan(0);
  });

  it('should have valid neighbor indices for all tiles', () => {
    const total = defaultConfig.width * defaultConfig.height;
    const world = new WorldGenerator().generate(defaultConfig);
    for (const tile of world.tiles) {
      for (const ni of tile.allNeighborIndices) {
        expect(ni).toBeGreaterThanOrEqual(0);
        expect(ni).toBeLessThan(total);
      }
    }
  });

  it('should mark coastal tiles correctly', () => {
    const world = new WorldGenerator().generate(defaultConfig);
    for (const tile of world.tiles) {
      if (tile.isCoastal) {
        const hasOceanNeighbor = tile.allNeighborIndices.some(
          ni => world.tiles[ni].terrain === 'ocean',
        );
        expect(hasOceanNeighbor).toBe(true);
      }
    }
  });

  it('should have correct totalLandTiles count', () => {
    const world = new WorldGenerator().generate(defaultConfig);
    const landCount = world.tiles.filter(t => t.terrain !== 'ocean').length;
    expect(world.totalLandTiles).toBe(landCount);
  });

  it('should assign continents to all land tiles', () => {
    const world = new WorldGenerator().generate(defaultConfig);
    for (const tile of world.tiles) {
      if (tile.terrain !== 'ocean') {
        expect(tile.continent).not.toBeNull();
      }
    }
  });

  it('should have null continent for ocean tiles', () => {
    const world = new WorldGenerator().generate(defaultConfig);
    for (const tile of world.tiles) {
      if (tile.terrain === 'ocean') {
        expect(tile.continent).toBeNull();
      }
    }
  });

  it('fromCustomMap produces valid WorldData from all-plains input', () => {
    const width = 10;
    const height = 10;
    const tiles = [];
    for (let i = 0; i < width * height; i++) {
      tiles.push({ index: i, q: i % width, r: Math.floor(i / width), terrain: 'plains' as const, productivityOverride: null });
    }
    const worldData = WorldGenerator.fromCustomMap(tiles, width, height);
    expect(worldData.totalLandTiles).toBe(100);
    expect(worldData.tiles).toHaveLength(100);
  });

  it('should generate 16000 tiles for 160x100 world', () => {
    const world = new WorldGenerator().generate({ width: 160, height: 100, seed: 42, seaConquestRadius: 4 });
    expect(world.tiles.length).toBe(160 * 100);
  });

  it('generates width*height tiles with valid terrain at varied dimensions', () => {
    const validTerrains = new Set([
      'ocean', 'plains', 'river_valley', 'forest', 'hills', 'mountains', 'desert', 'tundra',
    ]);
    for (const [width, height] of [[200, 120], [80, 60], [320, 200]] as const) {
      const world = new WorldGenerator().generate({ width, height, seed: 7, seaConquestRadius: 4 });
      expect(world.tiles.length).toBe(width * height);
      // grid coordinates span the full requested dimensions
      expect(world.width).toBe(width);
      expect(world.height).toBe(height);
      for (const tile of world.tiles) {
        expect(validTerrains.has(tile.terrain)).toBe(true);
      }
    }
  });

  it('generates a structurally valid world at a non-1.6 (square) aspect', () => {
    const validTerrains = new Set([
      'ocean', 'plains', 'river_valley', 'forest', 'hills', 'mountains', 'desert', 'tundra',
    ]);
    const width = 120, height = 120;
    const total = width * height;
    const world = new WorldGenerator().generate({ width, height, seed: 11, seaConquestRadius: 4 });
    expect(world.tiles.length).toBe(total);
    expect(world.totalLandTiles).toBeGreaterThan(0);
    for (const tile of world.tiles) {
      expect(validTerrains.has(tile.terrain)).toBe(true);
      // Neighbor indices stay in range at an odd aspect.
      for (const ni of tile.allNeighborIndices) {
        expect(ni).toBeGreaterThanOrEqual(0);
        expect(ni).toBeLessThan(total);
      }
      // Coastal flag implies an ocean neighbor; continents assigned to all land.
      if (tile.isCoastal) {
        expect(tile.allNeighborIndices.some(ni => world.tiles[ni].terrain === 'ocean')).toBe(true);
      }
      if (tile.terrain !== 'ocean') {
        expect(tile.continent).not.toBeNull();
      } else {
        expect(tile.continent).toBeNull();
      }
    }
  });

  it('fromCustomMap yields a structurally valid world at multiple dimensions', () => {
    for (const [width, height] of [[80, 60], [200, 120], [120, 120]] as const) {
      const total = width * height;
      const tiles = [];
      for (let i = 0; i < total; i++) {
        const q = i % width;
        const r = Math.floor(i / width);
        // Central rectangle of land surrounded by ocean → guarantees coast.
        const land = q > width * 0.25 && q < width * 0.75 && r > height * 0.25 && r < height * 0.75;
        tiles.push({
          index: i, q, r,
          terrain: land ? ('plains' as const) : ('ocean' as const),
          productivityOverride: null,
        });
      }
      const world = WorldGenerator.fromCustomMap(tiles, width, height);
      expect(world.tiles).toHaveLength(total);
      expect(world.width).toBe(width);
      expect(world.height).toBe(height);
      expect(world.totalLandTiles).toBeGreaterThan(0);
      // Land forms one connected continent (id 0); coastal ring borders ocean.
      const landTiles = world.tiles.filter(t => t.terrain !== 'ocean');
      expect(landTiles.every(t => t.continent !== null)).toBe(true);
      expect(world.tiles.some(t => t.isCoastal)).toBe(true);
      for (const tile of world.tiles) {
        for (const ni of tile.allNeighborIndices) {
          expect(ni).toBeGreaterThanOrEqual(0);
          expect(ni).toBeLessThan(total);
        }
      }
    }
  });

  it('circle algorithm: fromCustomMap produces world with land tiles all within circle radius', () => {
    const WIDTH = 160, HEIGHT = 100;
    const cx = WIDTH / 2, cy = HEIGHT / 2, radius = 38;
    const tiles = [];
    for (let i = 0; i < WIDTH * HEIGHT; i++) {
      const q = i % WIDTH;
      const r = Math.floor(i / WIDTH);
      const dist = Math.sqrt((q - cx) ** 2 + (r - cy) ** 2);
      const terrain = dist <= radius ? ('plains' as const) : ('ocean' as const);
      tiles.push({ index: i, q, r, terrain, productivityOverride: null });
    }
    const world = WorldGenerator.fromCustomMap(tiles, WIDTH, HEIGHT);
    expect(world.totalLandTiles).toBeGreaterThan(0);
    for (const tile of world.tiles) {
      if (tile.terrain !== 'ocean') {
        const dist = Math.sqrt((tile.q - cx) ** 2 + (tile.r - cy) ** 2);
        expect(dist).toBeLessThanOrEqual(39);
      }
    }
  });
});
