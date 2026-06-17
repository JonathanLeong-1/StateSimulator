# `src/geo` — Real-World Map Rasterizer Core

The shared, environment-agnostic core that turns **real-world geographic data**
into a simulation map (`SavedCustomMap`). It is the single pure engine behind
both delivery front-ends: the offline Node build script and the in-browser
region picker. No DOM, no `fs`, no `fetch` here — the same code runs identically
in Node and the browser.

> **Authoritative design:** the full rationale, contracts, and data model live in
> [`.plans/project/2026-06-16-162511-architecture-real-world-maps.md`](../../.plans/project/2026-06-16-162511-architecture-real-world-maps.md)
> (§3 projection, §4 dimensions, §6 classification, §7 module map). This README
> is a developer-facing tour of the code, not a replacement for that document.

---

## Purpose

Generate simulation maps from baked-in public-domain geodata rather than
hand-painting or random generation. The core's **sole job is assigning a
`TerrainType` to every hex** — coastlines, productivity, obstacles, and
continents are all derived downstream by `WorldGenerator.fromCustomMap`. The
output plugs into the existing `loadMap` → `fromCustomMap(tiles, width, height)`
pipeline with **no engine changes**.

## Design tenets

- **Equal-area, never conformal.** Region selection and grid layout happen in
  **Equal Earth** projected space, so every hex covers a roughly constant
  real-world area — no Mercator-style high-latitude inflation.
- **Comparable hex budget across maps.** Every map targets roughly the same hex
  count `N`; only the *shape* (aspect ratio) follows the selected region.
  Smaller regions therefore get **higher resolution** automatically.
- **Geographic accuracy over aesthetics.** Output faithfully reflects the source
  data. There is **no** smoothing, island/lake removal, or cosmetic cleanup.
  Supersampling is **area-weighting only** (accurate classification of what
  genuinely occupies a hex) — it is *not* a smoothing pass. Single-hex islands,
  narrow straits, and precise biome boundaries are preserved exactly as the data
  and grid resolution yield them.

---

## Module map

| File | Responsibility |
|------|----------------|
| [`EqualEarth.ts`](EqualEarth.ts) | Equal Earth forward/inverse projection (pure math, §3). |
| [`dimensionSolver.ts`](dimensionSolver.ts) | Bounding box + hex budget → variable `{ width, height }` (§4). Also exports `gridForBudget`/`DEFAULT_GRID`, which back the Map Builder's blank-map size presets (Small/Medium/Large). |
| [`GeoDataset.ts`](GeoDataset.ts) | Environment-agnostic geodata sampling (elevation / Köppen / land / rivers) over in-memory buffers. |
| [`GeoDataset.node.ts`](GeoDataset.node.ts) | **Node-only** `fs` loader for tests and the build script. The browser uses a `fetch` loader (lands in WS4); the core never imports this file. |
| [`koppen.ts`](koppen.ts) | Köppen–Geiger class code → biome `TerrainType` (§6.1). |
| [`rasterizeRegion.ts`](rasterizeRegion.ts) | **The core** — `(bbox, dataset, opts) → SavedCustomMap` (§6). |
| [`defaultMaps.ts`](defaultMaps.ts) | The 10 named default regions (bbox + optional budget, §9). |

Test files (`*.test.ts`) run in Node and are excluded from the production app
build (see [Build & type-check seam](#build--type-check-seam)).

---

## The `GeoDataset` browser-vs-node seam

`rasterizeRegion` depends only on the `GeoDataset` **interface** — four sampling
methods over already-loaded buffers:

```ts
interface GeoDataset {
  sampleElevation(lonDeg, latDeg): number;   // metres, nearest-neighbour
  sampleKoppen(lonDeg, latDeg): number;      // Köppen class code
  isLand(lonDeg, latDeg): boolean;           // elevation > sea level
  riverNear(lonDeg, latDeg, radiusDeg): boolean;
}
```

The concrete `RasterGeoDataset.fromBuffers(manifest, buffers)` holds the raster
buffers and a spatial-hash river index — pure lookups, no I/O. Only the **buffer
loading** differs per environment:

- **Node** (tests + build script): `loadGeoDatasetFromDir()` in `GeoDataset.node.ts`
  reads `public/geodata/` off disk.
- **Browser** (region picker, WS4): a `fetch`-backed loader supplies the same
  `manifest` + `buffers` to `RasterGeoDataset.fromBuffers`.

This keeps the rasterizer itself identical in both worlds — the only thing that
changes is who hands it the bytes.

---

## Classification pipeline (per hex)

`rasterizeRegion` lays a flat-top offset hex grid over the box's Equal Earth
extent, inverse-projects each hex center to lon/lat, supersamples a `k×k` grid
(default `k = 3`) across the hex footprint, then classifies **in this order**
(§6):

1. **Land / ocean** — area-weighted over supersamples. If the hex footprint is
   *not* a land majority → `ocean` (stop here; ties resolve to ocean).
2. **Ruggedness** — Terrain Ruggedness Index (local elevation range) over the
   hex neighbourhood: `TRI ≥ mountainThreshold` → `mountains`;
   `TRI ≥ hillThreshold` → `hills`.
3. **Biome** — modal Köppen class over the land supersamples →
   `koppenToBiome(...)`.
4. **River overlay** — if a river passes within the hex radius **and** the hex
   is land and not `mountains` → `river_valley`.

The result is serialized directly into `SavedCustomMap.tiles` with **no
post-processing**.

---

## Public API surface

```ts
// rasterizeRegion.ts
function rasterizeRegion(
  bbox: BoundingBox,            // { lonMin, lonMax, latMin, latMax }
  dataset: GeoDataset,
  opts: RasterizeOptions,      // { name, hexBudget, mountainThreshold?, hillThreshold?, supersample? }
): Promise<SavedCustomMap>;

// dimensionSolver.ts
const DEFAULT_HEX_BUDGET = 40_000;   // Medium preset
const MAX_HEX_BUDGET     = 64_000;   // high-detail hard cap (WS3-validated)
const MIN_HEX_BUDGET     = 4_000;    // custom-budget floor
function clampHexBudget(budget: number): number;
function projectedExtent(bbox: BoundingBox, samples?: number): ProjectedExtent;
function solveDimensions(aspect: number, hexBudget: number): GridDimensions;

// koppen.ts
function koppenToBiome(code: number): TerrainType;

// EqualEarth.ts
function forward(lonRad, latRad): ProjectedPoint;     // + forwardDeg
function inverse(x, y): LonLatRad;                    // + inverseDeg

// GeoDataset.ts
class RasterGeoDataset implements GeoDataset {
  static fromBuffers(manifest: GeoManifest, buffers: GeoBuffers): RasterGeoDataset;
}

// defaultMaps.ts
const DEFAULT_MAPS: readonly DefaultMapDef[];          // the 10 regions
function getDefaultMap(id: string): DefaultMapDef | undefined;
```

### Example: Node build script (WS6)

```ts
import { loadGeoDatasetFromDir } from './geo/GeoDataset.node';
import { rasterizeRegion } from './geo/rasterizeRegion';
import { DEFAULT_MAPS, getDefaultMap } from './geo/defaultMaps';
import { DEFAULT_HEX_BUDGET } from './geo/dimensionSolver';

const dataset = loadGeoDatasetFromDir('public/geodata');

for (const def of DEFAULT_MAPS) {
  const map = await rasterizeRegion(def.bbox, dataset, {
    name: def.name,
    hexBudget: def.hexBudget ?? DEFAULT_HEX_BUDGET,
  });
  // map is a SavedCustomMap → write to public/maps/<id>.worldmap.json
}
```

### Example: in-browser region picker (WS4)

```ts
import { rasterizeRegion } from './geo/rasterizeRegion';
import { clampHexBudget } from './geo/dimensionSolver';
import { RasterGeoDataset } from './geo/GeoDataset';

// A fetch-backed loader supplies manifest + buffers (WS4):
const dataset = RasterGeoDataset.fromBuffers(manifest, buffers);

const map = await rasterizeRegion(
  { lonMin, lonMax, latMin, latMax },   // user-dragged bbox
  dataset,
  { name: 'My Region', hexBudget: clampHexBudget(userBudget) },
);
// hand `map` to the existing loadMap → WorldGenerator.fromCustomMap pipeline
```

---

## Build & type-check seam

The production app build **excludes** test files and the Node-only loader so
`node:fs` / `node:path` never reach the browser bundle. Those files are
type-checked separately with Node types:

```bash
npm run typecheck:test   # type-checks *.test.ts + GeoDataset.node.ts (tsconfig.test.json)
```

The app's own `tsconfig.app.json` covers the browser-safe core.

## Default maps integration

The 10 pre-built regional maps defined in `defaultMaps.ts` are:
1. **Generated offline** by `scripts/generate-default-maps.ts` (Node), which calls `rasterizeRegion` for each region and writes the output to `public/maps/<id>.worldmap.json`
2. **Bundled** as metadata in `public/defaultMaps.json` (manifest listing name, file path, bbox, and hex budget per map)
3. **Loaded by users** via the "Load Default Map" dropdown in the Map Builder UI, which fetches the manifest and allows users to pick and load any of the 10 pre-baked worlds for customization

No additional code is needed to add a new default map — simply add an entry to `DEFAULT_MAPS` in `defaultMaps.ts`, re-run the build script, and the manifest and picker UI update automatically.
