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
    // Trimmed bbox: removes mostly-ocean Pacific edges while keeping all continents.
    // Corresponds to columns 70–416 of the Equal Earth full-world projection.
    bbox: { lonMin: -122, latMin: -90, lonMax: 164, latMax: 90 },
    hexBudget: 80_000,
  },
  {
    id: 'north-america',
    name: 'North America',
    // Trimmed bbox: removes mostly-ocean Pacific west edge (120 cols from left).
    bbox: { lonMin: -131, latMin: 7, lonMax: -52, latMax: 84 },
  },
  {
    id: 'south-america',
    name: 'South America',
    bbox: { lonMin: -82, latMin: -56, lonMax: -34, latMax: 13 },
  },
  {
    id: 'americas',
    name: 'Americas',
    bbox: { lonMin: -170, latMin: -56, lonMax: -34, latMax: 84 },
  },
  {
    id: 'africa',
    name: 'Africa',
    bbox: { lonMin: -19, latMin: -35, lonMax: 52, latMax: 38 },
  },
  {
    id: 'europe',
    name: 'Europe',
    bbox: { lonMin: -25, latMin: 34, lonMax: 45, latMax: 72 },
  },
  {
    id: 'asia',
    name: 'Asia',
    bbox: { lonMin: 25, latMin: -11, lonMax: 180, latMax: 78 },
  },
  {
    id: 'eurasia',
    name: 'Eurasia',
    bbox: { lonMin: -25, latMin: -11, lonMax: 170, latMax: 78 },
  },
  {
    id: 'oceania',
    name: 'Oceania',
    bbox: { lonMin: 110, latMin: -48, lonMax: 180, latMax: -10 },
  },
  {
    id: 'old-world',
    name: 'Old World',
    bbox: { lonMin: -25, latMin: -35, lonMax: 170, latMax: 78 },
  },
] as const;

/** Look up a default map definition by id. */
export function getDefaultMap(id: string): DefaultMapDef | undefined {
  return DEFAULT_MAPS.find((m) => m.id === id);
}
