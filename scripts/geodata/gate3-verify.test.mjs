// @ts-check
/**
 * WS1 — Gate 3 geodata verification test (tester agent).
 *
 * Focused, self-contained Node test (no browser) that asserts the six
 * acceptance checks for the bundled geodata against architecture §5/§6:
 *
 *   1. Manifest schema (§5)
 *   2. Raster byte-length consistency (exact equality)
 *   3. Value-range sanity (elevation & koppen codes)
 *   4. Coordinate sampling with directional expectations
 *   5. rivers.geojson structure + coordinate bounds
 *   6. Repo hygiene — .cache/ cannot be committed
 *
 * Run:  node scripts/geodata/gate3-verify.test.mjs
 * Exits non-zero on any failed assertion.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const OUT_DIR = join(REPO_ROOT, 'public', 'geodata');

/** @type {{name: string, ok: boolean, detail: string}[]} */
const results = [];
/**
 * @param {string} name
 * @param {boolean} ok
 * @param {string} [detail]
 */
function assert(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const tag = ok ? '  ✓' : '  ✗';
  console.log(`${tag} ${name}${detail ? ` — ${detail}` : ''}`);
}

/**
 * Map lon/lat → raster cell value using manifest bounds (row 0 = north).
 * @param {Buffer} buf
 * @param {number} width
 * @param {number} height
 * @param {[number,number,number,number]} bounds [minLon,minLat,maxLon,maxLat]
 * @param {'int16'|'uint8'} dtype
 * @param {number} lon
 * @param {number} lat
 */
function sample(buf, width, height, bounds, dtype, lon, lat) {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  let col = Math.floor(((lon - minLon) / (maxLon - minLon)) * width);
  let row = Math.floor(((maxLat - lat) / (maxLat - minLat)) * height);
  col = Math.min(Math.max(col, 0), width - 1);
  row = Math.min(Math.max(row, 0), height - 1);
  const idx = row * width + col;
  return dtype === 'int16' ? buf.readInt16LE(idx * 2) : buf[idx];
}

console.log('Gate 3 — geodata verification\n');

// ── Load manifest ─────────────────────────────────────────────────────────
const manifest = JSON.parse(readFileSync(join(OUT_DIR, 'manifest.json'), 'utf8'));

// ── Check 1: Manifest schema (§5) ───────────────────────────────────────────
assert('1.manifest.version === 1', manifest.version === 1, `version=${manifest.version}`);
const EXPECTED_BOUNDS = [-180, -90, 180, 90];
for (const layer of ['elevation', 'koppen']) {
  const m = manifest[layer];
  assert(
    `1.${layer} has {file,width,height,bounds}`,
    !!m &&
      typeof m.file === 'string' &&
      Number.isInteger(m.width) &&
      Number.isInteger(m.height) &&
      Array.isArray(m.bounds) &&
      m.bounds.length === 4,
    `file=${m?.file} ${m?.width}×${m?.height}`,
  );
  assert(
    `1.${layer}.bounds === [-180,-90,180,90]`,
    Array.isArray(m?.bounds) && m.bounds.every((v, i) => v === EXPECTED_BOUNDS[i]),
    JSON.stringify(m?.bounds),
  );
  assert(`1.${layer} dims 2160×1080`, m?.width === 2160 && m?.height === 1080);
}
assert(
  '1.elevation.seaLevel is a number',
  typeof manifest.elevation.seaLevel === 'number',
  `seaLevel=${manifest.elevation.seaLevel}`,
);
assert(
  '1.rivers.file present',
  typeof manifest.rivers?.file === 'string',
  `rivers.file=${manifest.rivers?.file}`,
);

// ── Check 2: Byte-length consistency (exact) ────────────────────────────────
const ew = manifest.elevation.width;
const eh = manifest.elevation.height;
const kw = manifest.koppen.width;
const kh = manifest.koppen.height;
const elevBuf = readFileSync(join(OUT_DIR, manifest.elevation.file));
const kopBuf = readFileSync(join(OUT_DIR, manifest.koppen.file));
assert(
  '2.elevation.bin size === width*height*2',
  elevBuf.length === ew * eh * 2,
  `${elevBuf.length} === ${ew * eh * 2}`,
);
assert(
  '2.koppen.bin size === width*height*1',
  kopBuf.length === kw * kh,
  `${kopBuf.length} === ${kw * kh}`,
);

// ── Check 3: Value-range sanity ─────────────────────────────────────────────
let elevMin = Infinity;
let elevMax = -Infinity;
for (let i = 0; i < elevBuf.length; i += 2) {
  const v = elevBuf.readInt16LE(i);
  if (v < elevMin) elevMin = v;
  if (v > elevMax) elevMax = v;
}
assert(
  '3.elevation range ⊆ [-11000, 9000] m',
  elevMin >= -11000 && elevMax <= 9000,
  `[${elevMin}, ${elevMax}]`,
);
// Legend class-code set: 0 (ocean/no-data) plus 1..30.
const LEGEND_CODES = new Set([0, ...Array.from({ length: 30 }, (_, i) => i + 1)]);
let kopBad = -1;
for (let i = 0; i < kopBuf.length; i++) {
  if (!LEGEND_CODES.has(kopBuf[i])) {
    kopBad = kopBuf[i];
    break;
  }
}
assert(
  '3.koppen codes ⊆ legend set {0..30}',
  kopBad === -1,
  kopBad === -1 ? 'all in range' : `found out-of-range code ${kopBad}`,
);

// ── Check 4: Coordinate sampling (directional) ──────────────────────────────
const bounds = /** @type {[number,number,number,number]} */ (manifest.elevation.bounds);
const B_GROUP = new Set([4, 5, 6, 7]); // BWh, BWk, BSh, BSk — arid

const pacificElev = sample(elevBuf, ew, eh, bounds, 'int16', -160, 0);
assert('4.mid-Pacific (0°N,160°W) elevation ≤ 0', pacificElev <= 0, `elev=${pacificElev}m`);

const himalayaElev = sample(elevBuf, ew, eh, bounds, 'int16', 87, 28);
assert('4.Himalaya (28°N,87°E) elevation > 3000', himalayaElev > 3000, `elev=${himalayaElev}m`);

const saharaKoppen = sample(kopBuf, kw, kh, bounds, 'uint8', 20, 23);
assert(
  '4.Sahara (23°N,20°E) koppen ∈ arid B-group {4,5,6,7}',
  B_GROUP.has(saharaKoppen),
  `koppen=${saharaKoppen}`,
);

const amazonElev = sample(elevBuf, ew, eh, bounds, 'int16', -60, -3);
assert('4.Amazon (3°S,60°W) elevation > 0', amazonElev > 0, `elev=${amazonElev}m`);

// ── Check 5: Rivers structure + coordinate bounds ───────────────────────────
const rivers = JSON.parse(readFileSync(join(OUT_DIR, manifest.rivers.file), 'utf8'));
assert('5.rivers is a FeatureCollection', rivers.type === 'FeatureCollection');
assert(
  '5.rivers has features',
  Array.isArray(rivers.features) && rivers.features.length > 0,
  `${rivers.features?.length} features`,
);

let badGeomType = '';
let outOfBounds = '';
let coordCount = 0;
let nullGeomCount = 0;
/** @param {number[]} c */
function checkCoord(c) {
  coordCount++;
  const [lon, lat] = c;
  if (!(lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90)) {
    outOfBounds = `[${lon}, ${lat}]`;
  }
}
for (const f of rivers.features) {
  const g = f.geometry;
  if (!g) {
    nullGeomCount++;
    continue;
  }
  if (g.type === 'LineString') {
    g.coordinates.forEach(checkCoord);
  } else if (g.type === 'MultiLineString') {
    g.coordinates.forEach((/** @type {number[][]} */ line) => line.forEach(checkCoord));
  } else {
    badGeomType = g.type;
  }
}
assert(
  '5.no null-geometry features',
  nullGeomCount === 0,
  nullGeomCount === 0 ? 'all features have geometry' : `found ${nullGeomCount} null-geometry feature(s)`,
);
assert(
  '5.feature count === 477 (478 source minus 1 null geometry)',
  rivers.features.length === 477,
  `${rivers.features.length} features`,
);
assert(
  '5.every geometry is LineString/MultiLineString',
  badGeomType === '',
  badGeomType ? `found ${badGeomType}` : `${rivers.features.length} features`,
);
assert(
  '5.all coords within [-180,180]×[-90,90]',
  outOfBounds === '',
  outOfBounds ? `offender ${outOfBounds}` : `${coordCount} coords checked`,
);

// ── Check 6: Repo hygiene — .cache/ cannot be committed ─────────────────────
let hygieneOk = false;
let hygieneDetail = '';
try {
  const out = execFileSync('git', ['add', '-n', 'scripts/geodata'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const cacheLines = out
    .split('\n')
    .filter((l) => l.includes('.cache/'));
  hygieneOk = cacheLines.length === 0;
  hygieneDetail = hygieneOk
    ? 'no .cache/ paths staged'
    : `would add: ${cacheLines.slice(0, 3).join(' | ')}`;
} catch (err) {
  hygieneDetail = `git add -n failed: ${/** @type {Error} */ (err).message}`;
}
assert('6.git add -n scripts/geodata excludes .cache/', hygieneOk, hygieneDetail);

// ── Summary ─────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} assertions passed.`);
if (failed.length) {
  console.error(`\n✗ FAIL — ${failed.length} assertion(s):`);
  for (const f of failed) console.error(`   - ${f.name} (${f.detail})`);
  process.exit(1);
}
console.log('\n✓ ALL PASS');
