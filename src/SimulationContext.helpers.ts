import { WorldGenerator } from './simulation/WorldGenerator';
import { SimulationEngine } from './simulation/SimulationEngine';
import { mulberry32 } from './simulation/rng';
import { DEFAULT_GRID } from './geo/dimensionSolver';
import type { WorldData, TerrainType } from './types/world';
import type { SimSettings } from './types/ui';
import type { MapBuilderTile } from './types/mapbuilder';

/**
 * Builds a new world and engine. Settings are passed by reference so that
 * mutations to the settings object are reflected in subsequent engine steps.
 */
export function buildWorld(
  seed: number,
  settings: SimSettings,
): { world: WorldData; engine: SimulationEngine } {
  const generator = new WorldGenerator();
  const world = generator.generate({
    width: DEFAULT_GRID.width,
    height: DEFAULT_GRID.height,
    seed,
    seaConquestRadius: 4,
  });
  const engine = new SimulationEngine(world, settings);
  engine.initialize();
  return { world, engine };
}

export function buildCircleWorld(
  settings: SimSettings,
  width: number = DEFAULT_GRID.width,
  height: number = DEFAULT_GRID.height,
): { world: WorldData; engine: SimulationEngine } {
  const cx = width / 2;
  const cy = height / 2;
  // Radius as a ratio of the shorter axis so the disc scales with any grid.
  const radius = Math.min(width, height) * 0.38;
  const rng = mulberry32(12345);

  const tiles: MapBuilderTile[] = [];
  for (let i = 0; i < width * height; i++) {
    const q = i % width;
    const r = Math.floor(i / width);
    const dist = Math.sqrt((q - cx) ** 2 + (r - cy) ** 2);
    let terrain: TerrainType = 'ocean';
    if (dist <= radius) {
      const rRatio = r / height;
      if (rRatio < 0.12 || rRatio > 0.88) {
        terrain = 'tundra';
      } else if (rRatio >= 0.35 && rRatio <= 0.65) {
        const roll = rng();
        terrain = roll < 0.6 ? 'plains' : roll < 0.8 ? 'river_valley' : 'forest';
      } else {
        terrain = rng() < 0.5 ? 'desert' : 'hills';
      }
      if (rng() < 0.15) terrain = 'mountains';
    }
    tiles.push({ index: i, q, r, terrain, productivityOverride: null });
  }

  const world = WorldGenerator.fromCustomMap(tiles, width, height);
  const engine = new SimulationEngine(world, settings);
  engine.initialize();
  return { world, engine };
}

export function randomizeContinents(
  _settings: SimSettings,
  loadCustomWorld: (worldData: WorldData) => void,
): void {
  const WIDTH = DEFAULT_GRID.width;
  const HEIGHT = DEFAULT_GRID.height;
  // Blob radii scale with the shorter axis so continents fill any grid sensibly.
  const minDim = Math.min(WIDTH, HEIGHT);
  const rng = mulberry32(Math.floor(Math.random() * 999999));
  const numBlobs = 2 + Math.floor(rng() * 3);
  const blobCenters: Array<{ q: number; r: number; radius: number }> = [];
  for (let b = 0; b < numBlobs; b++) {
    blobCenters.push({
      q: Math.floor(rng() * WIDTH),
      r: Math.floor(rng() * HEIGHT),
      radius: minDim * 0.08 + rng() * minDim * 0.12,
    });
  }
  const tiles: MapBuilderTile[] = [];
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    const q = i % WIDTH;
    const r = Math.floor(i / WIDTH);
    const inBlob = blobCenters.some(blob => {
      const dq = q - blob.q;
      const dr = r - blob.r;
      return Math.sqrt(dq * dq + dr * dr) + (rng() - 0.5) * 3 <= blob.radius;
    });
    let terrain: TerrainType = 'ocean';
    if (inBlob) {
      const rRatio = r / HEIGHT;
      if (rRatio < 0.12 || rRatio > 0.88) {
        terrain = 'tundra';
      } else if (rRatio >= 0.35 && rRatio <= 0.65) {
        const roll = rng();
        terrain = roll < 0.6 ? 'plains' : roll < 0.8 ? 'river_valley' : 'forest';
      } else {
        terrain = rng() < 0.5 ? 'desert' : 'hills';
      }
      if (rng() < 0.15) terrain = 'mountains';
    }
    tiles.push({ index: i, q, r, terrain, productivityOverride: null });
  }
  const worldData = WorldGenerator.fromCustomMap(tiles, WIDTH, HEIGHT);
  loadCustomWorld(worldData);
}
