/**
 * Dimension solver (architecture §4).
 *
 * Converts a real-world bounding box + a target hex budget `N` into the
 * variable grid `width`/`height` written into a `SavedCustomMap`. The grid is
 * flat-top offset hexes (see `MapBuilderRenderer.tileCenter`); the solver keeps
 * `width·height ≈ N` across all maps while the *shape* follows the projected
 * region. Pure math — no DOM.
 */

import { forwardDeg } from './EqualEarth';

/** Default target hex count (Medium preset). */
export const DEFAULT_HEX_BUDGET = 40_000;
/** Hard cap on hex count (high-detail; WS3-validated). */
export const MAX_HEX_BUDGET = 64_000;
/** Lowest meaningful hex count (Custom clamp floor). */
export const MIN_HEX_BUDGET = 4_000;

/** Minimum grid dimension in either axis. */
const MIN_DIM = 8;

/**
 * Hex packing factor relating projected aspect to grid aspect.
 *
 * For flat-top hexes the column pitch is 1.5·s and the row pitch is √3·s, so
 * the physical aspect is `(gw·1.5)/(gh·√3)`. To match a projected aspect `a`
 * we need `gw/gh = a·(√3/1.5) = a·1.1547…` = `a·(2/√3)`.
 */
export const HEX_ASPECT_FACTOR = 2 / Math.sqrt(3); // ≈ 1.1547

export interface BoundingBox {
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
}

export interface ProjectedExtent {
  /** Projected width (maxX − minX). */
  width: number;
  /** Projected height (maxY − minY). */
  height: number;
  /** Projected aspect ratio width/height. */
  aspect: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface GridDimensions {
  width: number;
  height: number;
}

/**
 * Project a bounding box through Equal Earth and return its projected extent.
 *
 * The projection is curved, so the projected bounding rectangle is found by
 * sampling a grid of points across the box (interior + edges) and taking the
 * min/max of the projected coordinates. `samples` controls the grid density
 * per axis (default 17 → 17×17 points), which is ample for a tight extent.
 */
export function projectedExtent(bbox: BoundingBox, samples = 17): ProjectedExtent {
  const n = Math.max(2, samples);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < n; i++) {
    const lat = bbox.latMin + ((bbox.latMax - bbox.latMin) * i) / (n - 1);
    for (let j = 0; j < n; j++) {
      const lon = bbox.lonMin + ((bbox.lonMax - bbox.lonMin) * j) / (n - 1);
      const { x, y } = forwardDeg(lon, lat);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const aspect = height > 0 ? width / height : 1;
  return { width, height, aspect, minX, maxX, minY, maxY };
}

/**
 * Solve grid dimensions for a projected aspect and a target hex budget.
 *
 * Implements architecture §4.3:
 * ```
 * ratio = a · 1.1547
 * gh = round(sqrt(N / ratio))
 * gw = round(ratio · gh)
 * gw = clamp(gw, 8, …);  gh = clamp(gh, 8, …)
 * ```
 *
 * @param aspect projected aspect ratio (width/height); must be > 0
 * @param hexBudget target hex count N
 */
export function solveDimensions(aspect: number, hexBudget: number): GridDimensions {
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  const n = Math.max(1, hexBudget);
  const ratio = a * HEX_ASPECT_FACTOR;
  const gh = Math.round(Math.sqrt(n / ratio));
  const gw = Math.round(ratio * gh);
  return {
    width: Math.max(MIN_DIM, gw),
    height: Math.max(MIN_DIM, gh),
  };
}

/**
 * Convenience: project the bbox, then solve grid dimensions for the budget.
 */
export function solveDimensionsForBbox(
  bbox: BoundingBox,
  hexBudget: number,
): { dimensions: GridDimensions; extent: ProjectedExtent } {
  const extent = projectedExtent(bbox);
  const dimensions = solveDimensions(extent.aspect, hexBudget);
  return { dimensions, extent };
}

/**
 * Clamp an arbitrary (e.g. user-supplied) hex budget into the supported range.
 */
export function clampHexBudget(budget: number): number {
  if (!Number.isFinite(budget)) return DEFAULT_HEX_BUDGET;
  return Math.min(MAX_HEX_BUDGET, Math.max(MIN_HEX_BUDGET, Math.round(budget)));
}
