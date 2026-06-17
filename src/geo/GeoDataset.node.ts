/**
 * Node-only fs-backed loader for {@link RasterGeoDataset}.
 *
 * Strictly a convenience for tests and the offline build script — it pulls the
 * bundled geodata off disk and hands the buffers to the environment-agnostic
 * {@link RasterGeoDataset.fromBuffers}. Browser code uses a fetch-backed loader
 * instead; the rasterizer core never imports this file.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RasterGeoDataset, type GeoManifest } from './GeoDataset';

/** Convert a Node Buffer to a standalone ArrayBuffer of exactly its bytes. */
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/**
 * Load the geodata bundle from a directory (default `public/geodata`).
 *
 * @param geodataDir directory containing manifest.json + the bundled assets
 */
export function loadGeoDatasetFromDir(geodataDir: string): RasterGeoDataset {
  const manifest = JSON.parse(
    readFileSync(join(geodataDir, 'manifest.json'), 'utf8'),
  ) as GeoManifest;

  const elevation = toArrayBuffer(readFileSync(join(geodataDir, manifest.elevation.file)));
  const koppen = toArrayBuffer(readFileSync(join(geodataDir, manifest.koppen.file)));
  const rivers = JSON.parse(readFileSync(join(geodataDir, manifest.rivers.file), 'utf8'));

  return RasterGeoDataset.fromBuffers(manifest, { elevation, koppen, rivers });
}
