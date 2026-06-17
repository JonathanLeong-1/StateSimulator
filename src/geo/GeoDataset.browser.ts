/**
 * Browser fetch-backed loader for {@link RasterGeoDataset}.
 *
 * Fetches the bundled geodata from public/geodata/ and constructs a
 * {@link RasterGeoDataset} with the same API as the Node fs-backed version.
 * Used by in-browser UI (region picker, dev generator).
 *
 * The rasterizer core never imports this file; it depends only on the
 * {@link GeoDataset} interface, so both Node and browser loaders work.
 */

import { RasterGeoDataset, type GeoManifest } from './GeoDataset';

/**
 * Load the geodata bundle from public/geodata/ via fetch.
 *
 * Fetches manifest.json, elevation.bin, koppen.bin, and rivers.geojson in parallel.
 * This is typically called once on first panel mount and cached in a ref.
 *
 * @throws Error if any fetch fails or if buffer sizes don't match manifest
 */
export async function loadGeoDatasetBrowser(): Promise<RasterGeoDataset> {
  const baseUrl = `${import.meta.env.BASE_URL}geodata/`;

  // Fetch all assets in parallel
  const [manifestResp, elevResp, koppenResp, riversResp] = await Promise.all([
    fetch(`${baseUrl}manifest.json`),
    fetch(`${baseUrl}elevation.bin`),
    fetch(`${baseUrl}koppen.bin`),
    fetch(`${baseUrl}rivers.geojson`),
  ]);

  if (!manifestResp.ok) {
    throw new Error(`Failed to fetch manifest: ${manifestResp.status} ${manifestResp.statusText}`);
  }
  if (!elevResp.ok) {
    throw new Error(`Failed to fetch elevation: ${elevResp.status} ${elevResp.statusText}`);
  }
  if (!koppenResp.ok) {
    throw new Error(`Failed to fetch koppen: ${koppenResp.status} ${koppenResp.statusText}`);
  }
  if (!riversResp.ok) {
    throw new Error(`Failed to fetch rivers: ${riversResp.status} ${riversResp.statusText}`);
  }

  const manifest: GeoManifest = await manifestResp.json();
  const elevBuf = await elevResp.arrayBuffer();
  const koppenBuf = await koppenResp.arrayBuffer();
  const rivers = await riversResp.json();

  return RasterGeoDataset.fromBuffers(manifest, {
    elevation: elevBuf,
    koppen: koppenBuf,
    rivers,
  });
}
