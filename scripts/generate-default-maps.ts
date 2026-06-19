/**
 * WS6 — Default-Map Build Script.
 *
 * Generates the 10 pre-packaged world maps from real-world geodata by:
 * 1. Loading geodata from public/geodata/ (elevation.bin, koppen.bin, rivers.geojson)
 * 2. Iterating over each region in DEFAULT_MAPS (src/geo/defaultMaps.ts)
 * 3. Rasterizing each region into a hex map via rasterizeRegion()
 * 4. Writing the result to public/maps/{id}.worldmap.json
 *
 * Usage:
 *   npx tsx scripts/generate-default-maps.ts
 *   npm run generate-maps
 *
 * Requires: geodata to exist (run 'npm run geodata:build' first).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadGeoDatasetFromDir } from '../src/geo/GeoDataset.node';
import { rasterizeRegion } from '../src/geo/rasterizeRegion';
import { DEFAULT_MAPS } from '../src/geo/defaultMaps';
import { DEFAULT_HEX_BUDGET } from '../src/geo/dimensionSolver';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

/**
 * Main execution.
 */
async function main(): Promise<void> {
  console.log('🗺️  Generating default maps...\n');

  // Load geodata once.
  const geodataDir = join(projectRoot, 'public', 'geodata');
  let dataset;
  try {
    dataset = loadGeoDatasetFromDir(geodataDir);
    console.log(`✓ Loaded geodata from ${geodataDir}\n`);
  } catch (err) {
    console.error(
      `❌ Failed to load geodata from ${geodataDir}:`,
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  if (!DEFAULT_MAPS || DEFAULT_MAPS.length === 0) {
    console.error('❌ No default maps defined in defaultMaps.ts');
    process.exit(1);
  }

  // Ensure output directory exists.
  const mapsDir = join(projectRoot, 'public', 'maps');
  try {
    mkdirSync(mapsDir, { recursive: true });
  } catch (err) {
    console.error(
      `❌ Failed to create maps directory:`,
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  // Rasterize each region.
  let successCount = 0;
  for (const region of DEFAULT_MAPS) {
    const start = Date.now();
    try {
      // Use per-map hexBudget if defined, otherwise fall back to default.
      const hexBudget = region.hexBudget ?? DEFAULT_HEX_BUDGET;

      const map = await rasterizeRegion(region.bbox, dataset, {
        name: region.name,
        hexBudget,
        dimensions: region.dimensions,
      });

      // Serialize to SavedCustomMap format.
      const savedMap = {
        version: 1 as const,
        name: region.name,
        savedAt: new Date().toISOString(),
        width: map.width,
        height: map.height,
        tiles: map.tiles,
      };

      const elapsed = Date.now() - start;
      const outputPath = join(mapsDir, `${region.id}.worldmap.json`);

      writeFileSync(outputPath, JSON.stringify(savedMap, null, 2) + '\n');

      console.log(
        `✓ ${region.name.padEnd(20)} ${map.tiles.length.toString().padStart(5)} tiles  ${elapsed.toString().padStart(5)}ms`,
      );
      successCount++;
    } catch (err) {
      const elapsed = Date.now() - start;
      console.error(
        `✗ ${region.name.padEnd(20)} FAILED after ${elapsed}ms:`,
        err instanceof Error ? err.message : String(err),
      );
      process.exit(1);
    }
  }

  console.log(`\n✓ Generated ${successCount} maps`);
  process.exit(0);
}

// Run.
main().catch((err) => {
  console.error(
    '💥 FATAL:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
