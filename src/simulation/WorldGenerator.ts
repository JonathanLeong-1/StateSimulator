import { mulberry32 } from './rng';
import {
  getOffsetNeighbors,
  tileIndex,
  bfsConnectedComponents,
  bfsReachableCoastal,
} from './hexUtils';
import type { HexTile, WorldConfig, WorldData, TerrainType } from '../types/world';
import type { MapBuilderTile } from '../types/mapbuilder';

export class WorldGenerator {
  /**
   * Generates a complete `WorldData` object from the provided configuration.
   *
   * The generation algorithm proceeds in twelve sequential steps:
   *  1–2.  Allocate the flat tile array and assign `(q, r)` hex coordinates.
   *  3–4.  Produce landmass via two circular blobs flanking an ocean middle band,
   *        followed by a jitter pass that propagates land to neighboring tiles.
   *  5–7.  Assign terrain type (using latitude and elevation proxies), productivity,
   *        and movement-obstacle values — consuming exactly 5 RNG calls per tile
   *        to keep the sequence deterministic regardless of land/ocean status.
   *  8.    Pre-compute `allNeighborIndices` and `landNeighborIndices` for every tile.
   *  9.    Flag coastal tiles (land tiles that border at least one ocean tile).
   *  10.   BFS from each coastal tile to populate `coastalReachIndices` within
   *        `seaConquestRadius` hops through ocean.
   *  11.   Flood-fill connected land components and assign continent IDs (0 = largest).
   *  12.   Assemble and return the final `WorldData` record including per-continent
   *        land-tile counts.
   *
   * @param config - World configuration: grid dimensions, RNG seed, and sea-conquest radius.
   * @returns A fully-populated `WorldData` object ready for the `SimulationEngine`.
   */
  generate(config: WorldConfig): WorldData {
    const { width, height, seed, seaConquestRadius } = config;
    const total = width * height;
    const rand = mulberry32(seed);

    // Step 1-2: Initialize tiles with q/r coordinates
    const tiles: HexTile[] = [];
    for (let i = 0; i < total; i++) {
      const q = i % width;
      const r = Math.floor(i / width);
      tiles.push({
        index: i,
        q,
        r,
        terrain: 'ocean',
        productivity: 0,
        obstacle: 1,
        isCoastal: false,
        continent: null,
        allNeighborIndices: [],
        landNeighborIndices: [],
        coastalReachIndices: [],
      });
    }

    // Steps 3-4: Generate landmass — two circular blobs with ocean middle band
    const blobRadius = Math.min(width, height) * 0.28;
    const leftCX = width * 0.22;
    const leftCY = height * 0.5;
    const rightCX = width * 0.78;
    const rightCY = height * 0.5;
    const oceanBandLeft = width * 0.38;
    const oceanBandRight = width * 0.62;

    // Pass 1: Initial land determination — always consume 1 rand() per tile
    const isInitialLand = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      const { q, r } = tiles[i];
      const landRoll = rand();
      if (q >= oceanBandLeft && q <= oceanBandRight) {
        // Ocean middle band — rand consumed, tile stays ocean
        continue;
      }
      const distLeft = Math.sqrt((q - leftCX) ** 2 + (r - leftCY) ** 2);
      const distRight = Math.sqrt((q - rightCX) ** 2 + (r - rightCY) ** 2);
      const minDist = Math.min(distLeft, distRight);
      if (minDist < blobRadius * (0.7 + 0.6 * landRoll)) {
        isInitialLand[i] = 1;
      }
    }

    // Pass 2: Jitter — propagate land to neighbors (consume rand for every valid in-bounds neighbor)
    const isLand = new Uint8Array(isInitialLand);
    for (let i = 0; i < total; i++) {
      if (!isInitialLand[i]) continue;
      const { q, r } = tiles[i];
      for (const [nq, nr] of getOffsetNeighbors(q, r)) {
        if (nq < 0 || nq >= width || nr < 0 || nr >= height) continue;
        const jitterRoll = rand();
        // Ocean band tiles stay ocean regardless of jitter
        if (nq >= oceanBandLeft && nq <= oceanBandRight) continue;
        if (jitterRoll < 0.7) {
          isLand[tileIndex(nq, nr, width)] = 1;
        }
      }
    }

    // Steps 5-7: Assign terrain, productivity, obstacle
    // Always consume exactly 5 rand() per tile for determinism regardless of land/ocean
    for (let i = 0; i < total; i++) {
      const tile = tiles[i];
      const relR = tile.r / height;

      const r1 = rand(); // elevation proxy
      const r2 = rand(); // primary terrain / latitude roll
      const r3 = rand(); // secondary terrain roll
      const r4 = rand(); // productivity jitter
      const r5 = rand(); // obstacle jitter

      if (!isLand[i]) {
        tile.terrain = 'ocean';
        tile.productivity = 0;
        tile.obstacle = 1;
        continue;
      }

      // Terrain assignment — elevation proxy checked for mid-latitude first
      let terrain: TerrainType;
      if (relR < 0.12 || relR > 0.88) {
        terrain = 'tundra';
      } else if (relR <= 0.22 || relR >= 0.78) {
        // Near-polar band
        terrain = r2 < 0.30 ? 'tundra' : 'plains';
      } else if (r1 > 0.80) {
        // Elevation override: mountains
        terrain = 'mountains';
      } else if (r1 > 0.70) {
        // Elevation override: hills
        terrain = 'hills';
      } else if ((relR > 0.22 && relR < 0.35) || (relR > 0.65 && relR < 0.78)) {
        // Subtropical band
        terrain = r2 < 0.35 ? 'desert' : (r3 < 0.20 ? 'river_valley' : (r3 < 0.60 ? 'plains' : 'forest'));
      } else if (relR > 0.30 && relR < 0.70 && r2 < 0.20) {
        // Middle-latitude river valley
        terrain = 'river_valley';
      } else {
        // Remaining mid-latitude
        terrain = r3 < 0.40 ? 'forest' : 'plains';
      }

      tile.terrain = terrain;

      // Productivity by terrain
      switch (terrain) {
        case 'river_valley': tile.productivity = 0.85 + r4 * 0.15; break;
        case 'plains':       tile.productivity = 0.60 + r4 * 0.20; break;
        case 'forest':       tile.productivity = 0.45 + r4 * 0.15; break;
        case 'hills':        tile.productivity = 0.30 + r4 * 0.20; break;
        case 'tundra':       tile.productivity = 0.10 + r4 * 0.15; break;
        case 'mountains':    tile.productivity = 0.10 + r4 * 0.10; break;
        case 'desert':       tile.productivity = 0.10 + r4 * 0.10; break;
        default:             tile.productivity = 0;
      }

      // Obstacle by terrain
      switch (terrain) {
        case 'plains':       tile.obstacle = 0.05 + r5 * 0.10; break;
        case 'river_valley': tile.obstacle = 0.05 + r5 * 0.10; break;
        case 'forest':       tile.obstacle = 0.20 + r5 * 0.15; break;
        case 'hills':        tile.obstacle = 0.30 + r5 * 0.15; break;
        case 'tundra':       tile.obstacle = 0.40 + r5 * 0.20; break;
        case 'desert':       tile.obstacle = 0.40 + r5 * 0.20; break;
        case 'mountains':    tile.obstacle = 0.65 + r5 * 0.20; break;
        default:             tile.obstacle = 1;
      }
    }

    // Step 8: Pre-compute neighbor indices
    for (let i = 0; i < total; i++) {
      const tile = tiles[i];
      const allNeighbors: number[] = [];
      const landNeighbors: number[] = [];
      for (const [nq, nr] of getOffsetNeighbors(tile.q, tile.r)) {
        if (nq < 0 || nq >= width || nr < 0 || nr >= height) continue;
        const ni = tileIndex(nq, nr, width);
        allNeighbors.push(ni);
        if (tiles[ni].terrain !== 'ocean') {
          landNeighbors.push(ni);
        }
      }
      tile.allNeighborIndices = allNeighbors;
      tile.landNeighborIndices = landNeighbors;
    }

    // Step 9: isCoastal — land tile with at least one ocean neighbor
    for (let i = 0; i < total; i++) {
      const tile = tiles[i];
      if (tile.terrain === 'ocean') continue;
      tile.isCoastal = tile.allNeighborIndices.some(ni => tiles[ni].terrain === 'ocean');
    }

    // Step 10: coastalReachIndices via BFS through ocean (only for coastal tiles)
    for (let i = 0; i < total; i++) {
      const tile = tiles[i];
      if (tile.isCoastal) {
        tile.coastalReachIndices = bfsReachableCoastal(i, tiles, width, seaConquestRadius);
      }
    }

    // Step 11: Continent assignment via flood-fill on land tiles
    const landIndices = tiles
      .filter(t => t.terrain !== 'ocean')
      .map(t => t.index);

    const components = bfsConnectedComponents(
      landIndices,
      (idx) => tiles[idx].landNeighborIndices,
    );

    // Sort by size descending: largest = continent 0, second = continent 1, etc.
    components.sort((a, b) => b.length - a.length);

    for (let ci = 0; ci < components.length; ci++) {
      for (const ti of components[ci]) {
        tiles[ti].continent = ci;
      }
    }

    // Step 12: Build WorldData
    const totalLandTiles = landIndices.length;
    const continentLandCounts = new Array<number>(components.length).fill(0);
    for (const tile of tiles) {
      if (tile.continent !== null) {
        continentLandCounts[tile.continent]++;
      }
    }

    return { tiles, width, height, totalLandTiles, continentLandCounts };
  }

  static fromCustomMap(
    mapTiles: MapBuilderTile[],
    width: number,
    height: number,
  ): WorldData {
    const PRODUCTIVITY_DEFAULTS: Record<string, number> = {
      river_valley: 0.925, plains: 0.70, forest: 0.525, hills: 0.40,
      tundra: 0.175, mountains: 0.15, desert: 0.15, ocean: 0.0,
    };
    const OBSTACLE_DEFAULTS: Record<string, number> = {
      plains: 0.10, river_valley: 0.10, forest: 0.275, hills: 0.375,
      tundra: 0.50, desert: 0.50, mountains: 0.75, ocean: 1.0,
    };

    // Build HexTile[]
    const tiles: HexTile[] = mapTiles.map(mt => ({
      index: mt.index,
      q: mt.q,
      r: mt.r,
      terrain: mt.terrain,
      productivity: mt.productivityOverride !== null ? mt.productivityOverride : (PRODUCTIVITY_DEFAULTS[mt.terrain] ?? 0),
      obstacle: OBSTACLE_DEFAULTS[mt.terrain] ?? 1.0,
      isCoastal: false,
      continent: null,
      allNeighborIndices: [],
      landNeighborIndices: [],
      coastalReachIndices: [],
    }));

    // Build index lookup
    const indexMap = new Map<string, number>();
    for (const t of tiles) indexMap.set(`${t.q},${t.r}`, t.index);

    // Compute allNeighborIndices
    for (const t of tiles) {
      const neighbors = getOffsetNeighbors(t.q, t.r);
      t.allNeighborIndices = neighbors
        .map(([nq, nr]) => indexMap.get(`${nq},${nr}`) ?? -1)
        .filter(i => i >= 0);
    }

    // Compute landNeighborIndices
    for (const t of tiles) {
      t.landNeighborIndices = t.allNeighborIndices.filter(i => tiles[i].terrain !== 'ocean');
    }

    // Mark isCoastal
    for (const t of tiles) {
      if (t.terrain !== 'ocean') {
        t.isCoastal = t.allNeighborIndices.some(i => tiles[i].terrain === 'ocean');
      }
    }

    // BFS coastalReachIndices for coastal tiles
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].isCoastal) {
        tiles[i].coastalReachIndices = bfsReachableCoastal(i, tiles, width, 4);
      }
    }

    // Flood-fill continents on land tiles
    const landIndices = tiles.filter(t => t.terrain !== 'ocean').map(t => t.index);
    const components = bfsConnectedComponents(
      landIndices,
      (idx) => tiles[idx].landNeighborIndices,
    );
    components.sort((a, b) => b.length - a.length);

    for (let ci = 0; ci < components.length; ci++) {
      const contId = ci < 2 ? ci : null;
      for (const tileIdx of components[ci]) {
        tiles[tileIdx].continent = contId;
      }
    }

    const totalLandTiles = landIndices.length;
    const continentLandCounts: number[] = components.map(c => c.length);

    return { tiles, width, height, totalLandTiles, continentLandCounts };
  }
}
