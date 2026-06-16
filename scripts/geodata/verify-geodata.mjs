// @ts-check
/**
 * WS1 — geodata verification check.
 *
 * Loads public/geodata/manifest.json, validates it against the architecture §5
 * schema, confirms each raster's byte length matches its declared dimensions,
 * samples a few coordinates, and validates rivers.geojson. Exits non-zero on
 * any failure. Run after build-geodata.mjs:
 *
 *   node scripts/geodata/verify-geodata.mjs
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', '..', 'public', 'geodata');

/** @type {string[]} */
const errors = [];
/** @param {boolean} cond @param {string} msg */
function check(cond, msg) {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    console.error(`  ✗ ${msg}`);
    errors.push(msg);
  }
}

/**
 * @param {Buffer} buf
 * @param {number} width
 * @param {number} height
 * @param {'int16' | 'uint8'} dtype
 * @param {number} lon
 * @param {number} lat
 */
function sample(buf, width, height, dtype, lon, lat) {
  let col = Math.floor(((lon + 180) / 360) * width);
  let row = Math.floor(((90 - lat) / 180) * height);
  col = Math.min(Math.max(col, 0), width - 1);
  row = Math.min(Math.max(row, 0), height - 1);
  const idx = row * width + col;
  return dtype === 'int16' ? buf.readInt16LE(idx * 2) : buf[idx];
}

console.log('Verifying geodata bundle…');

// 1. Manifest exists and matches §5 schema.
const manifestPath = join(OUT_DIR, 'manifest.json');
check(existsSync(manifestPath), 'manifest.json exists');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

check(manifest.version === 1, 'manifest.version === 1');
for (const layer of ['elevation', 'koppen']) {
  const m = manifest[layer];
  check(!!m && typeof m.file === 'string', `${layer}.file is a string`);
  check(Number.isInteger(m?.width) && m.width > 0, `${layer}.width is a positive integer`);
  check(Number.isInteger(m?.height) && m.height > 0, `${layer}.height is a positive integer`);
  check(
    Array.isArray(m?.bounds) && m.bounds.length === 4,
    `${layer}.bounds is a 4-tuple`,
  );
}
check(typeof manifest.elevation?.seaLevel === 'number', 'elevation.seaLevel is a number');
check(typeof manifest.rivers?.file === 'string', 'rivers.file is a string');

// 2. Raster byte lengths match declared dimensions.
const elevPath = join(OUT_DIR, manifest.elevation.file);
const kopPath = join(OUT_DIR, manifest.koppen.file);
check(existsSync(elevPath), `${manifest.elevation.file} exists`);
check(existsSync(kopPath), `${manifest.koppen.file} exists`);

const ew = manifest.elevation.width;
const eh = manifest.elevation.height;
const kw = manifest.koppen.width;
const kh = manifest.koppen.height;
const elevBuf = readFileSync(elevPath);
const kopBuf = readFileSync(kopPath);
check(elevBuf.length === ew * eh * 2, `elevation.bin length = ${ew}×${eh}×2 (= ${ew * eh * 2})`);
check(kopBuf.length === kw * kh, `koppen.bin length = ${kw}×${kh} (= ${kw * kh})`);

// 3. Value-range sanity.
let elevMin = Infinity;
let elevMax = -Infinity;
for (let i = 0; i < elevBuf.length; i += 2) {
  const v = elevBuf.readInt16LE(i);
  if (v < elevMin) elevMin = v;
  if (v > elevMax) elevMax = v;
}
check(elevMin >= -12000 && elevMax <= 9000, `elevation range plausible [${elevMin}, ${elevMax}] m`);
let kopMax = 0;
for (let i = 0; i < kopBuf.length; i++) if (kopBuf[i] > kopMax) kopMax = kopBuf[i];
check(kopMax <= 30, `koppen codes within 0..30 (max ${kopMax})`);

// 4. Sample a few coordinates (smoke — values must be readable & in range).
const samples = [
  { name: 'mid-Pacific (0,-150)', lon: -150, lat: 0 },
  { name: 'Sahara (15,20)', lon: 15, lat: 20 },
  { name: 'Himalaya (86,28)', lon: 86, lat: 28 },
  { name: 'Greenland (-42,72)', lon: -42, lat: 72 },
];
for (const s of samples) {
  const e = sample(elevBuf, ew, eh, 'int16', s.lon, s.lat);
  const k = sample(kopBuf, kw, kh, 'uint8', s.lon, s.lat);
  check(
    Number.isFinite(e) && Number.isInteger(k) && k >= 0 && k <= 30,
    `sample ${s.name}: elev=${e}m koppen=${k}`,
  );
}

// 5. Rivers GeoJSON parses and contains LineString features.
const riversPath = join(OUT_DIR, manifest.rivers.file);
check(existsSync(riversPath), `${manifest.rivers.file} exists`);
const rivers = JSON.parse(readFileSync(riversPath, 'utf8'));
check(rivers.type === 'FeatureCollection', 'rivers is a FeatureCollection');
check(Array.isArray(rivers.features) && rivers.features.length > 0, 'rivers has features');
const lineStrings = rivers.features.filter(
  (/** @type {any} */ f) =>
    f.geometry && (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'),
);
check(lineStrings.length > 0, `rivers contains ${lineStrings.length} LineString/MultiLineString features`);

// 6. Bundle size report.
const totalBytes =
  statSync(elevPath).size + statSync(kopPath).size + statSync(riversPath).size;
console.log(`\n  bundle size: ${(totalBytes / 1e6).toFixed(2)} MB (elevation + koppen + rivers)`);

if (errors.length) {
  console.error(`\n✗ verification FAILED with ${errors.length} error(s).`);
  process.exit(1);
}
console.log('\n✓ geodata verification PASSED.');
