/**
 * rasterizeRegion — the shared rasterizer core (architecture §6 & §7.1).
 *
 * Converts a real-world bounding box + a {@link GeoDataset} into a
 * `SavedCustomMap` by laying a flat-top offset hex grid over the box's Equal
 * Earth projection and classifying each hex's terrain. Pure & environment-
 * agnostic: identical in Node and the browser. Per §6.2 there is **no** cosmetic
 * post-processing — classification output is serialized directly, preserving
 * single-hex islands, narrow straits and precise biome boundaries.
 *
 * Pipeline per hex (§6):
 *   1. area-weighted land/ocean (majority of supersamples) → ocean stops here
 *   2. Terrain Ruggedness Index over the local elevation neighborhood
 *      → `mountains` / `hills`
 *   3. modal Köppen class over the land supersamples → biome
 *   4. river overlay → `river_valley` (land, not mountains)
 */

import type { SavedCustomMap } from '../types/mapbuilder';
import type { TerrainType } from '../types/world';
import { inverse } from './EqualEarth';
import { koppenToBiome } from './koppen';
import {
  projectedExtent,
  solveDimensions,
  type BoundingBox,
} from './dimensionSolver';
import type { GeoDataset } from './GeoDataset';

export interface RasterizeOptions {
  name: string;
  /** Target hex count N. */
  hexBudget: number;
  /** Local relief (metres) at/above which a hex becomes `mountains`. */
  mountainThreshold?: number;
  /** Local relief (metres) at/above which a hex becomes `hills`. */
  hillThreshold?: number;
  /** Supersampling factor k (k×k area-weighted samples per hex). Default 3. */
  supersample?: number;
}

/** Default local-relief thresholds (metres). */
const DEFAULT_MOUNTAIN_THRESHOLD = 1500;
const DEFAULT_HILL_THRESHOLD = 200;

/** Floor for the relief-sampling neighbourhood so it spans ≥ one source cell. */
const MIN_RELIEF_DELTA_DEG = 0.15;

/**
 * Rasterize a real-world region into a `SavedCustomMap`.
 *
 * @param bbox real-world bounding box (degrees)
 * @param dataset geodata sampling source
 * @param opts name, hex budget and optional classification tunables
 */
export async function rasterizeRegion(
  bbox: BoundingBox,
  dataset: GeoDataset,
  opts: RasterizeOptions,
): Promise<SavedCustomMap> {
  const k = Math.max(1, Math.floor(opts.supersample ?? 3));
  const mountainThreshold = opts.mountainThreshold ?? DEFAULT_MOUNTAIN_THRESHOLD;
  const hillThreshold = opts.hillThreshold ?? DEFAULT_HILL_THRESHOLD;

  const extent = projectedExtent(bbox);
  const { width, height } = solveDimensions(extent.aspect, opts.hexBudget);

  const { minX, maxX, minY, maxY } = extent;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const cellW = spanX / width;
  const cellH = spanY / height;

  const tiles: SavedCustomMap['tiles'] = new Array(width * height);

  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const index = r * width + q;

      // Projected center of this hex. Odd columns are offset half a row to
      // match the flat-top offset layout used across the app.
      const xFrac = (q + 0.5) / width;
      const rowPos = r + (q % 2 !== 0 ? 0.5 : 0);
      const yFrac = (rowPos + 0.5) / height;
      const cx = minX + xFrac * spanX;
      const cy = maxY - yFrac * spanY; // row 0 = north (top)

      const center = inverse(cx, cy);
      const centerLon = center.lonRad * (180 / Math.PI);
      const centerLat = center.latRad * (180 / Math.PI);

      // Polar guard: hexes whose center maps beyond ±88° are forced to ocean.
      // At exactly ±90° the ETOPO raster's row-0/last-row cells cover the pole
      // (Greenland/Antarctic ice) — positive elevation — which would make every
      // hex in the top/bottom row appear as a solid land band. Since these
      // extreme latitudes are uninteresting for the simulation (all ice/ocean),
      // treating them as ocean is both correct and artifact-free.
      if (Math.abs(centerLat) > 88) {
        tiles[index] = { index, terrain: 'ocean', productivityOverride: null };
        continue;
      }

      let landCount = 0;
      let total = 0;
      const koppenCounts = new Map<number, number>();
      for (let sj = 0; sj < k; sj++) {
        for (let si = 0; si < k; si++) {
          const sx = cx + ((si + 0.5) / k - 0.5) * cellW;
          const sy = cy + ((sj + 0.5) / k - 0.5) * cellH;
          // Clamp to projected bounds before inverse() to prevent NaN/Infinity
          // lon/lat at the poles (Equal Earth polar singularity).
          const sxClamped = Math.min(maxX, Math.max(minX, sx));
          const syClamped = Math.min(maxY, Math.max(minY, sy));
          const ll = inverse(sxClamped, syClamped);
          const lon = ll.lonRad * (180 / Math.PI);
          const lat = ll.latRad * (180 / Math.PI);
          total++;
          if (dataset.isLand(lon, lat)) {
            landCount++;
            const code = dataset.sampleKoppen(lon, lat);
            koppenCounts.set(code, (koppenCounts.get(code) ?? 0) + 1);
          }
        }
      }

      if (landCount * 2 <= total) {
        // Majority ocean (ties resolve to ocean — not a land majority).
        tiles[index] = { index, terrain: 'ocean', productivityOverride: null };
        continue;
      }

      // --- (2) ruggedness (TRI = local elevation range) ---
      const reliefDelta = reliefNeighborhoodDeg(cx, cy, cellW, cellH);
      let minElev = Infinity;
      let maxElev = -Infinity;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const lon = centerLon + di * reliefDelta;
          const lat = clampLat(centerLat + dj * reliefDelta);
          const elev = dataset.sampleElevation(lon, lat);
          if (elev < minElev) minElev = elev;
          if (elev > maxElev) maxElev = elev;
        }
      }
      const tri = maxElev - minElev;

      // --- (3) modal Köppen → biome ---
      let terrain: TerrainType;
      if (tri >= mountainThreshold) {
        terrain = 'mountains';
      } else if (tri >= hillThreshold) {
        terrain = 'hills';
      } else {
        terrain = koppenToBiome(modalCode(koppenCounts, dataset, centerLon, centerLat));
      }

      // --- (4) river overlay (land, not mountains) ---
      if (terrain !== 'mountains') {
        const hexRadiusDeg = 0.5 * Math.max(
          Math.abs(reliefDelta * 2),
          MIN_RELIEF_DELTA_DEG,
        );
        if (dataset.riverNear(centerLon, centerLat, hexRadiusDeg)) {
          terrain = 'river_valley';
        }
      }

      tiles[index] = { index, terrain, productivityOverride: null };
    }
  }

  return {
    version: 1,
    name: opts.name,
    savedAt: new Date().toISOString(),
    width,
    height,
    tiles,
  };
}

/** Clamp a latitude to the valid [-90, 90] range. */
function clampLat(lat: number): number {
  if (lat > 90) return 90;
  if (lat < -90) return -90;
  return lat;
}

/**
 * Estimate the geographic neighbourhood radius (degrees) for relief sampling.
 *
 * Inverse-projects the cell's half-extent in projected space to recover its
 * lon/lat span, then floors it at {@link MIN_RELIEF_DELTA_DEG} so the TRI
 * neighbourhood always spans at least one source raster cell — otherwise very
 * fine grids would sample a single raster cell and report zero relief.
 */
function reliefNeighborhoodDeg(cx: number, cy: number, cellW: number, cellH: number): number {
  const east = inverse(cx + cellW * 0.5, cy);
  const west = inverse(cx - cellW * 0.5, cy);
  const north = inverse(cx, cy + cellH * 0.5);
  const south = inverse(cx, cy - cellH * 0.5);
  const lonSpan = Math.abs((east.lonRad - west.lonRad) * (180 / Math.PI));
  const latSpan = Math.abs((north.latRad - south.latRad) * (180 / Math.PI));
  return Math.max(0.5 * lonSpan, 0.5 * latSpan, MIN_RELIEF_DELTA_DEG);
}

/**
 * Most frequent non-ocean Köppen code among land samples; falls back to the
 * center sample if the tally is empty (e.g. all samples were ocean no-data).
 */
function modalCode(
  counts: Map<number, number>,
  dataset: GeoDataset,
  centerLon: number,
  centerLat: number,
): number {
  let best = -1;
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (code === 0) continue; // skip ocean/no-data when a real class exists
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  if (best >= 0) return best;
  // Only ocean/no-data codes were tallied — fall back to the center sample.
  return dataset.sampleKoppen(centerLon, centerLat);
}
