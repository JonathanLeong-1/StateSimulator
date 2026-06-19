/**
 * The ten named default regions (architecture §9).
 *
 * Each entry is a starting bounding box; the round-trip authoring workflow
 * (§10) lets an author refine these by hand. Boxes use the same
 * `{ lonMin, latMin, lonMax, latMax }` shape consumed by `rasterizeRegion` and
 * the dimension solver.
 */

import type { BoundingBox } from './dimensionSolver';

export interface DefaultMapDef {
  /** Stable id (filename-safe). */
  id: string;
  /** Display name. */
  name: string;
  /** Real-world bounding box. */
  bbox: BoundingBox;
  /** Optional per-map hex budget override (else DEFAULT_HEX_BUDGET). */
  hexBudget?: number;
}

export const DEFAULT_MAPS: readonly DefaultMapDef[] = [
  {
    id: 'world',
    name: 'World',
    bbox: { lonMin: -142, latMin: -83, lonMax: 143, latMax: 83 },
    hexBudget: 64_000,
  },
  {
    id: 'north-america',
    name: 'North America',
    bbox: { lonMin: -148, latMin: 7, lonMax: -52, latMax: 84 },
    hexBudget: 64_000,
  },
  {
    id: 'south-america',
    name: 'South America',
    bbox: { lonMin: -82, latMin: -56, lonMax: -34, latMax: 13 },
    hexBudget: 64_000,
  },
  {
    id: 'americas',
    name: 'Americas',
    bbox: { lonMin: -148, latMin: -56, lonMax: -34, latMax: 84 },
    hexBudget: 64_000,
  },
  {
    id: 'africa',
    name: 'Africa',
    bbox: { lonMin: -19, latMin: -35, lonMax: 52, latMax: 38 },
    hexBudget: 64_000,
  },
  {
    id: 'europe',
    name: 'Europe',
    bbox: { lonMin: -18, latMin: 34, lonMax: 41, latMax: 72 },
    hexBudget: 64_000,
  },
  {
    id: 'asia',
    name: 'Asia',
    bbox: { lonMin: 32, latMin: -11, lonMax: 164, latMax: 78 },
    hexBudget: 64_000,
  },
  {
    id: 'eurasia',
    name: 'Eurasia',
    bbox: { lonMin: 1, latMin: -11, lonMax: 170, latMax: 78 },
    hexBudget: 64_000,
  },
  {
    id: 'oceania',
    name: 'Oceania',
    bbox: { lonMin: 110, latMin: -48, lonMax: 164, latMax: -10 },
    hexBudget: 64_000,
  },
  {
    id: 'old-world',
    name: 'Old World',
    bbox: { lonMin: 16, latMin: -35, lonMax: 170, latMax: 78 },
    hexBudget: 64_000,
  },
] as const;

/** Look up a default map definition by id. */
export function getDefaultMap(id: string): DefaultMapDef | undefined {
  return DEFAULT_MAPS.find((m) => m.id === id);
}
