// @ts-check
/**
 * Synthetic placeholder geodata generators (WS1 fallback).
 *
 * These produce geographically *plausible but clearly synthetic* rasters that
 * conform exactly to the architecture §5 manifest schema, so that downstream
 * workstreams (WS2 rasterizer core, WS6 build script) can be exercised before
 * the real public-domain datasets are available in a given environment.
 *
 * The data here is NOT real-world data. When these are used, build-geodata.mjs
 * writes a SYNTHETIC.txt marker and the public/geodata/README.md is annotated.
 * Replace with real data by re-running `node scripts/geodata/build-geodata.mjs`
 * in an environment with network access.
 *
 * No smoothing/cleanup is applied to any real data path; this synthetic module
 * is the only place values are fabricated, and it is explicitly labelled.
 */

import { writeFileSync } from 'node:fs';

/**
 * Canonical GloH2O / Beck et al. (2023) Köppen-Geiger class codes (1..30).
 * 0 is reserved for ocean / no-data. This table is also documented in the
 * generated README and is the authoritative reference WS2 maps to biomes.
 * @type {Record<number, string>}
 */
export const KOPPEN_CLASSES = {
  0: 'Ocean/NoData',
  1: 'Af', 2: 'Am', 3: 'Aw',
  4: 'BWh', 5: 'BWk', 6: 'BSh', 7: 'BSk',
  8: 'Csa', 9: 'Csb', 10: 'Csc',
  11: 'Cwa', 12: 'Cwb', 13: 'Cwc',
  14: 'Cfa', 15: 'Cfb', 16: 'Cfc',
  17: 'Dsa', 18: 'Dsb', 19: 'Dsc', 20: 'Dsd',
  21: 'Dwa', 22: 'Dwb', 23: 'Dwc', 24: 'Dwd',
  25: 'Dfa', 26: 'Dfb', 27: 'Dfc', 28: 'Dfd',
  29: 'ET', 30: 'EF',
};

/**
 * Convert a raster (row, col) to (lon, lat) at the centre of the cell, given a
 * full-globe raster with bounds [-180, -90, 180, 90]. Row 0 is the north edge.
 * @param {number} row
 * @param {number} col
 * @param {number} width
 * @param {number} height
 * @returns {{ lon: number; lat: number }}
 */
function cellToLonLat(row, col, width, height) {
  const lon = -180 + ((col + 0.5) / width) * 360;
  const lat = 90 - ((row + 0.5) / height) * 180;
  return { lon, lat };
}

/**
 * Generate a synthetic Int16 elevation raster (row-major, little-endian) and
 * write it to `outPath`. Land masses are formed from a few low-frequency
 * sinusoids so that there are continents, oceans, and mountain ridges; values
 * are bounded well within Int16 range.
 * @param {string} outPath
 * @param {number} width
 * @param {number} height
 */
export function generateSyntheticElevation(outPath, width, height) {
  const buf = Buffer.alloc(width * height * 2);
  const d2r = Math.PI / 180;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const { lon, lat } = cellToLonLat(row, col, width, height);
      const la = lat * d2r;
      const lo = lon * d2r;
      // Low-frequency "continents" landmask field.
      const continents =
        Math.sin(lo * 1.5) * Math.cos(la * 1.2) +
        0.6 * Math.sin(lo * 0.7 + 1.3) * Math.cos(la * 2.1) +
        0.4 * Math.cos(lo * 2.3 - 0.5) * Math.cos(la * 0.8);
      // Mountain ridges (higher frequency) only contribute on land.
      const ridges =
        Math.abs(Math.sin(lo * 6 + la * 4)) * Math.abs(Math.cos(la * 5));
      // Poles tend toward land/ice; deep oceans elsewhere.
      const polar = Math.max(0, Math.abs(lat) - 60) / 30;
      const field = continents + polar * 0.8;
      let elev;
      if (field > 0.15) {
        elev = Math.round(50 + field * 600 + ridges * 2600);
      } else {
        elev = Math.round(-200 + field * 5000); // ocean depths (negative)
      }
      if (elev > 8800) elev = 8800;
      if (elev < -10000) elev = -10000;
      buf.writeInt16LE(elev, (row * width + col) * 2);
    }
  }
  writeFileSync(outPath, buf);
}

/**
 * Generate a synthetic Uint8 Köppen class raster aligned with the elevation
 * raster. Ocean cells (elevation <= 0) are class 0; land cells are assigned a
 * latitude-banded Köppen class using the canonical 1..30 codes.
 * @param {string} outPath
 * @param {Buffer} elevation  Int16LE elevation buffer to derive land/ocean.
 * @param {number} width
 * @param {number} height
 */
export function generateSyntheticKoppen(outPath, elevation, width, height) {
  const buf = Buffer.alloc(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = row * width + col;
      const elev = elevation.readInt16LE(idx * 2);
      if (elev <= 0) {
        buf[idx] = 0; // ocean
        continue;
      }
      const { lat } = cellToLonLat(row, col, width, height);
      const abs = Math.abs(lat);
      let code;
      if (abs < 10) code = 1; // Af tropical
      else if (abs < 20) code = 3; // Aw tropical savanna
      else if (abs < 30) code = 4; // BWh hot desert belt
      else if (abs < 45) code = 14; // Cfa humid temperate
      else if (abs < 60) code = 26; // Dfb continental
      else if (abs < 70) code = 27; // Dfc subarctic
      else code = 29; // ET tundra
      // High elevations trend toward tundra regardless of latitude.
      if (elev > 3000) code = 29;
      buf[idx] = code;
    }
  }
  writeFileSync(outPath, buf);
}

/**
 * Generate a small synthetic rivers GeoJSON (a handful of LineStrings) so the
 * river-overlay path in WS2 has data to hit-test against.
 * @param {string} outPath
 */
export function generateSyntheticRivers(outPath) {
  /** @type {{ type: string; properties: Record<string, unknown>; geometry: { type: string; coordinates: number[][] } }[]} */
  const features = [
    { name: 'Synthetic River A', coords: [[-60, -3], [-58, -2], [-55, -1], [-50, 0]] },
    { name: 'Synthetic River B', coords: [[10, 48], [12, 46], [14, 44], [16, 42]] },
    { name: 'Synthetic River C', coords: [[100, 30], [105, 28], [110, 25], [115, 22]] },
    { name: 'Synthetic River D', coords: [[30, 5], [31, 0], [32, -5], [33, -10]] },
  ].map((r) => ({
    type: 'Feature',
    properties: { name: r.name, synthetic: true },
    geometry: { type: 'LineString', coordinates: r.coords },
  }));
  const fc = { type: 'FeatureCollection', features };
  writeFileSync(outPath, JSON.stringify(fc));
}
