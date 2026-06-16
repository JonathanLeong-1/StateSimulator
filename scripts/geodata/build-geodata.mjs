// @ts-check
/**
 * WS1 — Geodata preparation build script.
 *
 * Downloads open public-domain / CC-BY geodata, downsamples and converts it
 * into the compact runtime assets described by architecture §5, and writes the
 * manifest. Each layer is built independently: if a real source cannot be
 * obtained (no network, source moved, GDAL unavailable), that layer falls back
 * to a clearly-labelled SYNTHETIC placeholder (see synthetic.mjs) so downstream
 * workstreams are unblocked. The real-vs-synthetic provenance of every emitted
 * asset is recorded in public/geodata/PROVENANCE.json.
 *
 * Geographic-accuracy tenet: the real-data path applies NO smoothing or
 * cleanup. Rasters are downsampled with nearest-neighbour resampling (no
 * blending), and river geometry is taken from Natural Earth's own 50m product
 * without additional simplification.
 *
 * Usage:
 *   node scripts/geodata/build-geodata.mjs            # build all layers
 *   node scripts/geodata/build-geodata.mjs --synthetic # force synthetic for all
 *   node scripts/geodata/build-geodata.mjs --only=elevation,rivers
 *
 * Requirements for the real-data path: `curl`, `unzip`, and GDAL
 * (`gdalwarp`, `ogr2ogr`) on PATH.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  statSync,
  rmSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateSyntheticElevation,
  generateSyntheticKoppen,
  generateSyntheticRivers,
  KOPPEN_CLASSES,
} from './synthetic.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const CACHE_DIR = join(__dirname, '.cache');
const OUT_DIR = join(REPO_ROOT, 'public', 'geodata');

// ---- Frozen contract (architecture §5) -----------------------------------
const WIDTH = 2160;
const HEIGHT = 1080;
/** @type {[number, number, number, number]} */
const BOUNDS = [-180, -90, 180, 90];
const SEA_LEVEL = 0;

// ---- Source datasets ------------------------------------------------------
const SOURCES = {
  elevation: {
    name: 'ETOPO 2022 (60 arc-second, ice/sea surface elevation)',
    url: 'https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif',
    license: 'Public domain (U.S. Government work, NOAA NCEI)',
    cache: join(CACHE_DIR, 'etopo_2022_60s_surface.tif'),
  },
  koppen: {
    name: 'Köppen-Geiger climate classification V3 (Beck et al. 2023), 1991-2020 @ 0.1°',
    url: 'https://ndownloader.figshare.com/files/61012822',
    license: 'CC BY 4.0 — cite Beck et al. (2023), Scientific Data 10, 724',
    cache: join(CACHE_DIR, 'koppen_geiger_tif.zip'),
  },
  rivers: {
    name: 'Natural Earth 50m Rivers + Lake Centerlines',
    url: 'https://naciscdn.org/naturalearth/50m/physical/ne_50m_rivers_lake_centerlines.zip',
    license: 'Public domain (Natural Earth)',
    cache: join(CACHE_DIR, 'ne_50m_rivers.zip'),
  },
};

// ---- CLI ------------------------------------------------------------------
const args = process.argv.slice(2);
const FORCE_SYNTHETIC = args.includes('--synthetic');
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;
/** @param {string} layer */
const wants = (layer) => !ONLY || ONLY.includes(layer);

// ---- Helpers --------------------------------------------------------------
/**
 * @param {string} cmd
 * @param {string[]} cmdArgs
 * @returns {string}
 */
function sh(cmd, cmdArgs) {
  return execFileSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** @param {string} cmd @returns {boolean} */
function have(cmd) {
  try {
    execFileSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** @param {string} url @param {string} dest */
function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 0) {
    console.log(`  cached: ${dest} (${(statSync(dest).size / 1e6).toFixed(1)} MB)`);
    return;
  }
  console.log(`  downloading ${url}`);
  sh('curl', ['-sS', '-L', '--retry', '3', '--retry-delay', '2', '-C', '-', '-o', dest, url]);
}

/**
 * Warp + convert a single-band raster to a row-major raw binary at the frozen
 * grid using nearest-neighbour resampling (no smoothing). Returns the output
 * path. Writes little-endian byte order regardless of host.
 * @param {string} srcPath
 * @param {string} outBin
 * @param {'Int16' | 'Byte'} dataType
 * @param {number} srcNoData
 * @param {number} dstNoData
 */
function rasterToBin(srcPath, outBin, dataType, srcNoData, dstNoData) {
  const tmpBil = join(CACHE_DIR, `tmp_${dataType}.bil`);
  for (const ext of ['.bil', '.hdr', '.prj', '.stx', '.aux.xml']) {
    const f = tmpBil.replace(/\.bil$/, ext);
    if (existsSync(f)) rmSync(f);
  }
  sh('gdalwarp', [
    '-overwrite',
    '-t_srs', 'EPSG:4326',
    '-te', String(BOUNDS[0]), String(BOUNDS[1]), String(BOUNDS[2]), String(BOUNDS[3]),
    '-ts', String(WIDTH), String(HEIGHT),
    '-r', 'near',
    '-ot', dataType,
    '-srcnodata', String(srcNoData),
    '-dstnodata', String(dstNoData),
    '-of', 'EHdr',
    srcPath,
    tmpBil,
  ]);
  const hdr = readFileSync(tmpBil.replace(/\.bil$/, '.hdr'), 'utf8');
  const byteOrderMatch = hdr.match(/BYTEORDER\s+(\w)/i);
  const isBigEndian = byteOrderMatch ? byteOrderMatch[1].toUpperCase() === 'M' : false;
  let raw = readFileSync(tmpBil);
  if (dataType === 'Int16' && isBigEndian) {
    raw.swap16();
  }
  const expected = WIDTH * HEIGHT * (dataType === 'Int16' ? 2 : 1);
  if (raw.length !== expected) {
    throw new Error(`Unexpected raster size for ${outBin}: got ${raw.length}, want ${expected}`);
  }
  writeFileSync(outBin, raw);
  return outBin;
}

/** Recursively find files under `dir` matching `pred`. @param {string} dir @param {(p:string)=>boolean} pred @returns {string[]} */
function findFiles(dir, pred) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...findFiles(full, pred));
    else if (pred(full)) out.push(full);
  }
  return out;
}

// ---- Layer builders -------------------------------------------------------
/** @returns {{ source: string; url: string; license: string }} */
function buildElevationReal() {
  download(SOURCES.elevation.url, SOURCES.elevation.cache);
  rasterToBin(SOURCES.elevation.cache, join(OUT_DIR, 'elevation.bin'), 'Int16', -99999, 0);
  return { source: SOURCES.elevation.name, url: SOURCES.elevation.url, license: SOURCES.elevation.license };
}

/** @returns {{ source: string; url: string; license: string }} */
function buildKoppenReal() {
  download(SOURCES.koppen.url, SOURCES.koppen.cache);
  const extractDir = join(CACHE_DIR, 'koppen_extract');
  if (!existsSync(extractDir)) mkdirSync(extractDir, { recursive: true });
  sh('unzip', ['-o', '-q', SOURCES.koppen.cache, '-d', extractDir]);
  // Prefer the 1991-2020 present-day map at 0.1° resolution.
  const tifs = findFiles(extractDir, (p) => /\.tif$/i.test(p));
  const pick =
    tifs.find((p) => /1991_2020/.test(p) && /0p1\b|0p1\.tif/.test(p)) ||
    tifs.find((p) => /1991_2020/.test(p)) ||
    tifs[0];
  if (!pick) throw new Error('No Köppen GeoTIFF found in archive');
  rasterToBin(pick, join(OUT_DIR, 'koppen.bin'), 'Byte', 0, 0);
  // Copy the legend if present so WS2 has the authoritative code table.
  const legend = findFiles(extractDir, (p) => /legend\.txt$/i.test(p))[0];
  if (legend) copyFileSync(legend, join(OUT_DIR, 'koppen_legend.txt'));
  return { source: `${SOURCES.koppen.name} [${pick.split('/').pop()}]`, url: SOURCES.koppen.url, license: SOURCES.koppen.license };
}

/** @returns {{ source: string; url: string; license: string }} */
function buildRiversReal() {
  download(SOURCES.rivers.url, SOURCES.rivers.cache);
  const extractDir = join(CACHE_DIR, 'rivers_extract');
  if (!existsSync(extractDir)) mkdirSync(extractDir, { recursive: true });
  sh('unzip', ['-o', '-q', SOURCES.rivers.cache, '-d', extractDir]);
  const shp = findFiles(extractDir, (p) => /\.shp$/i.test(p))[0];
  if (!shp) throw new Error('No shapefile found in Natural Earth rivers archive');
  const out = join(OUT_DIR, 'rivers.geojson');
  if (existsSync(out)) rmSync(out);
  // Convert to WGS84 GeoJSON LineStrings, keeping only the name attribute.
  // No geometry simplification is applied — Natural Earth's 50m product is the
  // already-generalised source; we add zero cleanup. We DO drop features whose
  // geometry is NULL (a validity fix, not smoothing): a null-geometry feature
  // carries no coordinates and would break the WS2 river hit-test.
  sh('ogr2ogr', [
    '-f', 'GeoJSON',
    '-t_srs', 'EPSG:4326',
    '-select', 'name',
    '-where', 'OGR_GEOMETRY IS NOT NULL',
    '-lco', 'COORDINATE_PRECISION=5',
    out,
    shp,
  ]);
  return { source: SOURCES.rivers.name, url: SOURCES.rivers.url, license: SOURCES.rivers.license };
}

/** @param {string} layer @param {() => {source:string;url:string;license:string}} realFn @returns {{ real: boolean; source: string; url: string; license: string; error?: string }} */
function buildLayer(layer, realFn) {
  if (FORCE_SYNTHETIC) {
    return { real: false, source: 'synthetic placeholder (--synthetic)', url: '', license: 'N/A' };
  }
  try {
    console.log(`\n[${layer}] building from real source…`);
    const meta = realFn();
    console.log(`[${layer}] ✓ real data`);
    return { real: true, ...meta };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[${layer}] ⚠ real-source build failed: ${msg}`);
    console.warn(`[${layer}] → falling back to SYNTHETIC placeholder`);
    return { real: false, source: 'synthetic placeholder (real source unavailable)', url: '', license: 'N/A', error: msg };
  }
}

// ---- Main -----------------------------------------------------------------
function main() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const gdalOk = have('gdalwarp') && have('ogr2ogr');
  const curlOk = have('curl');
  const unzipOk = have('unzip');
  if (!FORCE_SYNTHETIC && !(gdalOk && curlOk && unzipOk)) {
    console.warn('⚠ Missing tooling (need curl, unzip, GDAL). Some layers will be synthetic.');
  }

  // Seed provenance from any existing PROVENANCE.json so a `--only` run that
  // rebuilds a subset of layers preserves the provenance of layers it did NOT
  // touch (instead of clobbering them with an empty map).
  /** @type {Record<string, any>} */
  const provenance = {};
  const provPath = join(OUT_DIR, 'PROVENANCE.json');
  if (existsSync(provPath)) {
    try {
      const prior = JSON.parse(readFileSync(provPath, 'utf8'));
      if (prior && prior.layers && typeof prior.layers === 'object') {
        Object.assign(provenance, prior.layers);
      }
    } catch {
      // Corrupt/old file — ignore and start fresh.
    }
  }

  // Elevation first — Köppen synthetic fallback derives land/ocean from it.
  if (wants('elevation')) {
    const r = buildLayer('elevation', buildElevationReal);
    if (!r.real) generateSyntheticElevation(join(OUT_DIR, 'elevation.bin'), WIDTH, HEIGHT);
    provenance.elevation = r;
  }

  if (wants('koppen')) {
    const r = buildLayer('koppen', buildKoppenReal);
    if (!r.real) {
      const elev = readFileSync(join(OUT_DIR, 'elevation.bin'));
      generateSyntheticKoppen(join(OUT_DIR, 'koppen.bin'), elev, WIDTH, HEIGHT);
    }
    provenance.koppen = r;
  }

  if (wants('rivers')) {
    const r = buildLayer('rivers', buildRiversReal);
    if (!r.real) generateSyntheticRivers(join(OUT_DIR, 'rivers.geojson'));
    provenance.rivers = r;
  }

  // Synthetic status is derived from the FULL merged provenance map (including
  // layers preserved from a prior run), not just this run's subset.
  const anySynthetic = Object.values(provenance).some((v) => !v.real);

  // Manifest — EXACT architecture §5 schema (no extra keys).
  const manifest = {
    version: 1,
    elevation: { file: 'elevation.bin', width: WIDTH, height: HEIGHT, bounds: BOUNDS, seaLevel: SEA_LEVEL },
    koppen: { file: 'koppen.bin', width: WIDTH, height: HEIGHT, bounds: BOUNDS },
    rivers: { file: 'rivers.geojson' },
  };
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  // Provenance record (separate from the frozen manifest).
  writeFileSync(
    provPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        grid: { width: WIDTH, height: HEIGHT, bounds: BOUNDS, seaLevel: SEA_LEVEL },
        koppenClasses: KOPPEN_CLASSES,
        layers: provenance,
      },
      null,
      2,
    ) + '\n',
  );

  // Synthetic marker for at-a-glance status.
  const markerPath = join(OUT_DIR, 'SYNTHETIC.txt');
  if (anySynthetic) {
    const synthLayers = Object.entries(provenance)
      .filter(([, v]) => !v.real)
      .map(([k]) => k);
    writeFileSync(
      markerPath,
      `One or more bundled layers are SYNTHETIC placeholders, not real-world data: ${synthLayers.join(', ')}.\n` +
        `Re-run \`node scripts/geodata/build-geodata.mjs\` in an environment with network + GDAL to replace them.\n` +
        `See PROVENANCE.json for per-layer detail.\n`,
    );
  } else if (existsSync(markerPath)) {
    rmSync(markerPath);
  }

  // Summary
  console.log('\n=== geodata build summary ===');
  for (const [layer, r] of Object.entries(provenance)) {
    console.log(`  ${layer.padEnd(10)} ${r.real ? 'REAL     ' : 'SYNTHETIC'} ${r.source}`);
  }
  console.log(`  manifest:   ${join(OUT_DIR, 'manifest.json')}`);
  console.log(`  provenance: ${join(OUT_DIR, 'PROVENANCE.json')}`);
  if (anySynthetic) console.log('  ⚠ SYNTHETIC placeholders present — see SYNTHETIC.txt');
}

main();
