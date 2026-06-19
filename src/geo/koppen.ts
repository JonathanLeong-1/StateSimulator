/**
 * Köppen–Geiger class code → biome (`TerrainType`) mapping (architecture §6.1).
 *
 * The class codes are the integers stored in `koppen.bin`, defined by
 * `public/geodata/koppen_legend.txt` (Beck et al. 2023):
 *
 * ```
 *  0  Ocean/NoData     17 Dsa   25 Dfa
 *  1  Af   2  Am  3 Aw 18 Dsb   26 Dfb
 *  4  BWh  5  BWk       19 Dsc   27 Dfc
 *  6  BSh  7  BSk       20 Dsd   28 Dfd
 *  8  Csa  9  Csb 10 Csc 21 Dwa  29 ET
 * 11  Cwa 12  Cwb 13 Cwc 22 Dwb  30 EF
 * 14  Cfa 15  Cfb 16 Cfc 23 Dwc
 *                        24 Dwd
 * ```
 *
 * Grouping (per architecture §6.1):
 * - **E** (ET 29, EF 30) — polar/tundra/ice            → `tundra`
 * - **B** (BWh 4, BWk 5, BSh 6, BSk 7) — arid          → `desert`
 * - **A** tropical (Af/Am/Aw) + humid/temperate forest
 *   groups Cf*, Df*, Dw*, Cw*                          → `forest`
 * - **Cs\*** Mediterranean (Csa/Csb/Csc)               → `plains`
 * - Cold subarctic sparse-veg **Dfc 27, Dfd 28, Dwd 24** → `tundra`
 *
 * Codes not otherwise enumerated in the cold (D) group default to `forest`
 * (boreal/continental forest). `Ds*` (cold, dry-summer) is rare and treated as
 * continental forest. Köppen code `0` is ocean/no-data: the land/ocean call is
 * made from elevation, never from Köppen, so `0` only reaches this function for
 * a hex classed as land yet lacking climate data (e.g. a tiny island the
 * coarse Köppen raster missed); it falls back to a neutral `plains`.
 */

import type { TerrainType } from '../types/world';

/** Köppen code reserved for ocean / no-data. */
export const KOPPEN_OCEAN_CODE = 0;

/** Köppen codes whose veg is sparse subarctic → mapped to `tundra` (§6.1). */
const SUBARCTIC_TUNDRA_CODES: ReadonlySet<number> = new Set([24, 27, 28]); // Dwd, Dfc, Dfd

/** Polar codes → `tundra`. */
const POLAR_CODES: ReadonlySet<number> = new Set([29, 30]); // ET, EF

/** True-desert (hyper-arid/arid) codes → `desert`. */
const ARID_CODES: ReadonlySet<number> = new Set([4, 5]); // BWh, BWk

/** Semi-arid steppe codes → `plains` (Great Plains, Central Asian steppe, Sahel, Patagonia). */
const STEPPE_CODES: ReadonlySet<number> = new Set([6, 7]); // BSh, BSk

/** Mediterranean (Cs*) codes → `plains`. */
const MEDITERRANEAN_CODES: ReadonlySet<number> = new Set([8, 9, 10]); // Csa, Csb, Csc

/**
 * Map a Köppen–Geiger class code to a biome `TerrainType`.
 *
 * Always returns a valid non-ocean biome — ocean is determined upstream by
 * elevation, never here.
 *
 * @param code integer Köppen class code (0–30; unknown codes default to plains)
 */
export function koppenToBiome(code: number): TerrainType {
  if (POLAR_CODES.has(code)) return 'tundra';
  if (SUBARCTIC_TUNDRA_CODES.has(code)) return 'tundra';
  if (ARID_CODES.has(code)) return 'desert';
  if (STEPPE_CODES.has(code)) return 'plains';
  if (MEDITERRANEAN_CODES.has(code)) return 'plains';

  // Tropical (A: 1–3) and humid/temperate forest (Cf*, Cw*, Df*, Dw*, Ds*):
  // all remaining classified land climates → forest.
  if (code >= 1 && code <= 28) return 'forest';

  // 0 (ocean/no-data) or any out-of-range code → neutral fallback.
  return 'plains';
}
