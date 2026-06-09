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
    expect(world.tiles.length).toBe(16000);
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
