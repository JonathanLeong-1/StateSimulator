# Architecture: Real-World Map Import & Generation

- **Date**: 2026-06-16
- **Status**: APPROVED (immutable)
- **Feature Fingerprint**: realworld-map-rasterizer + equal-area-projection + variable-grid + default-map-generator
- **Related prior plans**: builds on the Map Builder pipeline (`fromCustomMap`, `SavedCustomMap`, bundled `eurasia.worldmap.json`) established across the v1–v7 enhancement plans.

---

## 1. Overview

Add the ability to generate simulation maps from **real-world geographic data** instead of
hand-painting or random generation. The system bakes open, public-domain geodata into the app,
projects it through an **equal-area (Equal Earth)** projection, and rasterizes a user- or
script-selected real-world bounding box into the existing hex-grid map format.

This delivers three capabilities:

| # | Capability | Delivery Model |
|---|-----------|----------------|
| 1 | **Default maps** — pre-generated world & continent maps shipped with the app | Offline Node build script (Option A) |
| 2 | **Region picker** — users select a real-world area in-app and generate a map | In-browser UI using bundled datasets (Option B) |
| 3 | **Default-map round-trip** — author generates → downloads → edits in builder → resubmits as new default | Temporary dev generator panel + data-driven manifest |

Arbitrary user file upload (GeoJSON/GeoTIFF) is **explicitly out of scope** per requirements.

### Design tenets
- **One shared core, two front-ends.** A single pure rasterizer module powers both the Node build
  script and the in-browser picker. ~80% of the logic is UI-free and unit-testable.
- **The output is just per-hex terrain.** The map format only needs a `TerrainType` per hex;
  `productivity`, `obstacle`, coastlines, and continents are all derived downstream by
  `WorldGenerator.fromCustomMap`. The rasterizer's sole job is assigning terrain.
- **Equal-area, never conformal.** Equal Earth keeps real-world area-per-hex roughly constant;
  no Mercator-style high-latitude inflation.
- **Comparable hex budget across maps.** Every map targets roughly the same hex count; only the
  *shape* (aspect ratio) changes with the selected region. Smaller regions therefore get higher
  resolution automatically.
- **Geographic accuracy over aesthetics.** Maps faithfully reflect the source data — islands (even
  single-hex), coastlines, and biome boundaries are preserved as the data dictates. No smoothing or
  cosmetic modification is applied. Fidelity is bounded only by the grid resolution and source-raster
  detail, not by post-processing.

---

## 2. Target data model (unchanged contracts)

The rasterizer must emit a `SavedCustomMap` (`src/types/mapbuilder.ts`):

```ts
interface SavedCustomMap {
  version: 1;
  name: string;
  savedAt: string;
  width: number;   // now variable — no longer fixed at 160
  height: number;  // now variable — no longer fixed at 100
  tiles: Array<{ index: number; terrain: TerrainType; productivityOverride: number | null }>;
}
```

`TerrainType` = `ocean | plains | river_valley | forest | hills | mountains | desert | tundra`
(`src/types/world.ts`). This file plugs directly into the existing `loadMap` →
`WorldGenerator.fromCustomMap(tiles, width, height)` pipeline with **no engine changes**.

---

## 3. Projection: Equal Earth

- **Projection**: Equal Earth (Šavrič, Patterson, Jenny 2018) — an equal-area pseudocylindrical
  projection. Chosen for natural-looking whole-world maps with true area preservation.
- **Forward** (lon λ in radians, lat φ in radians):
  ```
  A1=1.340264, A2=-0.081106, A3=0.000893, A4=0.003796
  θ = asin( (√3 / 2) · sin φ )
  x = (2√3 · λ · cos θ) / (3 · (9A4θ⁸ + 7A3θ⁶ + 3A2θ² + A1))
  y = A4θ⁹ + A3θ⁷ + A2θ³ + A1θ
  ```
- **Inverse**: Newton–Raphson on `y` to recover θ, then φ; λ from the x equation. (~5 iterations,
  tolerance 1e-9.) Needed to map projected-grid cells back to lon/lat for dataset sampling.
- **Regional crops**: the selected bounding box (lon/lat) is projected through Equal Earth; the
  grid is laid out in projected space over the box's projected extent. Area stays consistent
  whether the region is global or a single country.

> **Antarctica**: Equal Earth represents the full ±90° latitude range, so "whole world incl.
> Antarctica" needs no special handling — the box simply spans the globe.

---

## 4. Variable dimensions & resolution model

### 4.1 Inputs
- A **real-world bounding box** `{ lonMin, lonMax, latMin, latMax }`.
- A **target hex budget** `N` (preset or custom integer).

### 4.2 Hex-budget presets
The grid is flat-top offset hexes (see `MapBuilderRenderer.tileCenter`). Budget presets:

| Preset | Target hexes | Notes |
|--------|--------------|-------|
| Small  | ~16,000 | parity with current 160×100 |
| Medium | ~40,000 | new default |
| Large  | ~64,000 | high-detail |
| Custom | user integer, clamped to `[4,000, MAX_HEX_BUDGET]` | |

- `DEFAULT_HEX_BUDGET = 40_000`
- `MAX_HEX_BUDGET = 64_000` (hard cap; **subject to performance validation in WS3** — leads may
  lower it if the simulation/renderer degrades, or raise it if headroom exists).

### 4.3 Dimension solver
Given projected box width `PW`, height `PH`, projected aspect `a = PW / PH`, and target `N`:

```
// flat-top hex packing: column pitch = 1.5·s, row pitch = √3·s
// physical aspect = (gw·1.5) / (gh·√3) must equal a
//   ⇒ gw/gh = a · (√3 / 1.5) = a · 1.1547
ratio = a · 1.1547
gh = round( sqrt( N / ratio ) )
gw = round( ratio · gh )
gw = clamp(gw, 8, …);  gh = clamp(gh, 8, …)
```

This yields comparable `gw·gh ≈ N` across all maps while the **shape** follows the region. Result
is the variable `width`/`height` written into the `SavedCustomMap`.

---

## 5. Bundled datasets (preprocessed)

All sources are public-domain or permissively licensed. A preprocessing step (WS1) downscales and
converts them into compact runtime assets under `public/geodata/`, described by a manifest. The
in-browser core fetches these once; sampling is then pure array lookups.

| Layer | Source | License | Runtime asset |
|-------|--------|---------|---------------|
| Elevation + land/ocean | ETOPO1 / GEBCO downsampled (single elevation raster; ocean = elevation ≤ sea level) | Public domain | `elevation.bin` (Int16, row-major) + dims in manifest |
| Biome (climate) | **Köppen–Geiger** (Beck et al., 1991–2020) reclassified | CC-BY 4.0 | `koppen.bin` (Uint8 class codes) |
| Rivers | Natural Earth Rivers (10m/50m, simplified) | Public domain | `rivers.geojson` (LineStrings) |

Manifest `public/geodata/manifest.json`:
```json
{
  "version": 1,
  "elevation": { "file": "elevation.bin", "width": 2160, "height": 1080,
                 "bounds": [-180,-90,180,90], "seaLevel": 0 },
  "koppen":    { "file": "koppen.bin", "width": 2160, "height": 1080,
                 "bounds": [-180,-90,180,90] },
  "rivers":    { "file": "rivers.geojson" }
}
```
> Target total bundle size: a few MB. Resolution of bundled rasters (e.g. 2160×1080 = 1/6°) is a
> WS1 decision balancing detail vs. size; must be fine enough to fill the largest single-region
> grid without visible blockiness.

---

## 6. Per-hex classification pipeline

For each hex, compute its center lon/lat (inverse-project the grid cell), then **supersample** a
small kxk grid of sample points across the hex footprint (default k=3). Supersampling here is purely
for **accurate area-weighted classification** of what genuinely occupies the hex (so a hex that is
mostly land is not flipped to ocean by a single unlucky center sample) — it is **not** smoothing and
does not erase small features that legitimately dominate a hex:

1. **Land/ocean** — area-weighted from samples: if the majority of the hex footprint is at or below
   sea level → `ocean` (stop). A hex genuinely dominated by a small island stays land.
2. **Ruggedness** — Terrain Ruggedness Index (TRI = local elevation std-dev/range) over the hex
   neighborhood:
   - `TRI ≥ mountainThreshold` → `mountains`
   - `TRI ≥ hillThreshold` → `hills`
3. **Biome** — modal Köppen class over samples → biome via the mapping table below. Biome boundaries
   follow the source data exactly; no cross-hex smoothing.
4. **River overlay** — if a river LineString passes within the hex radius AND terrain is land and
   not `mountains` → `river_valley`.

### 6.1 Köppen → biome mapping
| Köppen group | Biome |
|--------------|-------|
| E (ET, EF) — polar/tundra/ice | `tundra` |
| B (BWh, BWk, BSh, BSk) — arid/semi-arid | `desert` |
| Af, Am, Aw — tropical; Cf*, Df*, Dw*, Cw* — humid/temperate forest | `forest` |
| Cs* (Mediterranean), remaining temperate grassland/steppe | `plains` |
| Dfd/Dwd/Dfc cold subarctic with sparse veg | `tundra` |

> Exact class-code table is finalized in WS2 against the actual Köppen codes shipped by WS1.

### 6.2 No cosmetic post-processing
Per the geographic-accuracy tenet, there is **no** island/lake removal and **no** biome smoothing.
Single-hex islands, narrow straits, lakes, and precise biome boundaries are all retained exactly as
the source data and grid resolution yield them. Classification output is serialized directly. Any
correction a map author wants is done deliberately by hand via the round-trip workflow (§10), never
automatically.

---

## 7. Component / module map

```
public/geodata/                 # WS1 — bundled, preprocessed datasets + manifest
src/geo/                        # WS2 — shared pure rasterizer core (no DOM)
  EqualEarth.ts                 #   forward/inverse projection
  GeoDataset.ts                 #   loads manifest + raster/vector assets, sampling API
  dimensionSolver.ts            #   bounding box + budget → {width,height}
  rasterizeRegion.ts            #   the core: (bbox, width, height, opts) → SavedCustomMap
  koppen.ts                     #   class → biome table
  defaultMaps.ts                #   the 10 named regions (bbox + default budget)
  *.test.ts                     #   unit tests (Node, no browser)
src/ui/realworld/               # WS4 — in-browser region picker + dev generator panel
  RealWorldPanel.tsx            #   mini Equal Earth map, draggable bbox, budget preset, Generate
  DefaultMapGenerator.tsx       #   TEMPORARY dev panel: list 10 maps, generate, download
scripts/geodata/                # WS1 — preprocessing scripts (download/convert sources)
scripts/generate-default-maps.ts# WS6 — Node build script → public/maps/*.worldmap.json
public/maps/                    # WS5 — generated default map files
public/defaultMaps.json         # WS5 — manifest of default maps (name → file)
```

### 7.1 Core interface contract (WS2)
```ts
interface RasterizeOptions {
  name: string;
  hexBudget: number;            // target N
  mountainThreshold?: number;
  hillThreshold?: number;
  supersample?: number;         // k, default 3 (accurate area-weighted classification only)
}

// Pure, environment-agnostic. Runs identically in Node and the browser.
async function rasterizeRegion(
  bbox: { lonMin: number; lonMax: number; latMin: number; latMax: number },
  dataset: GeoDataset,
  opts: RasterizeOptions,
): Promise<SavedCustomMap>;
```

The browser provides a `GeoDataset` backed by `fetch`; the Node script provides one backed by
`fs`. The rasterizer itself is identical in both.

---

## 8. Variable-grid impact (WS3)

The engine is mostly ready — `fromCustomMap(tiles, width, height)` already accepts dimensions, and
`MapBuilderRenderer` computes `tileSize` from `width/height`. The required changes:

- **`src/ui/mapbuilder/MapBuilderContext.tsx`** — `WIDTH=160`/`HEIGHT=100` constants become state;
  add `setDimensions(width, height)` and a "new blank map at size" path; history/undo stay valid.
- **`src/SimulationContext.tsx`** — default boot map becomes a generated default (see WS5) instead
  of hardcoded Eurasia; load path already reads `data.width/data.height`.
- **Layout/CSS** — any assumption of 1.6:1 aspect in canvas/containers must flex to arbitrary
  aspect ratios (letterbox within the canvas via existing `fitToView`).
- **Performance validation** — empirically confirm the chosen `MAX_HEX_BUDGET` runs smoothly in
  the simulation loop and renderer; record findings and adjust the cap if needed.

---

## 9. Default maps (WS5/WS6)

Ten maps, each with an approximate bounding box (author-tunable later via the dev generator). All
use `DEFAULT_HEX_BUDGET` unless overridden:

| Map | lonMin | latMin | lonMax | latMax | Notes |
|-----|-------:|-------:|-------:|-------:|-------|
| World | -180 | -90 | 180 | 90 | includes Antarctica |
| North America | -170 | 7 | -10 | 84 | includes Greenland |
| South America | -82 | -56 | -34 | 13 | |
| Americas | -170 | -56 | -34 | 84 | |
| Africa | -19 | -35 | 52 | 38 | |
| Europe | -25 | 34 | 45 | 72 | includes Iceland |
| Asia | 25 | -11 | 180 | 78 | includes maritime SE Asia |
| Eurasia | -25 | -11 | 180 | 78 | |
| Oceania | 110 | -48 | 180 | -10 | Australia + New Zealand |
| Old World | -25 | -35 | 180 | 78 | Africa + Europe + Asia |

These are starting boxes; the round-trip workflow (§10) lets the author refine them.

---

## 10. Default-map round-trip (temporary authoring workflow)

1. **Generate** — the **Default Map Generator** dev panel (WS4, behind a `?dev=1` / env flag) lists
   the 10 maps. The author picks a budget preset, clicks **Generate** per map (uses WS2 core), and
   **Downloads** the resulting `.worldmap.json` (reuses existing save logic).
2. **Edit** — author opens the file in the Map Builder via existing `loadMap`, adjusts shape/biomes
   by hand, and **Saves** (existing `saveMap`) → edited `.worldmap.json`.
3. **Resubmit as default** — author drops the edited file into `public/maps/` and ensures an entry
   exists in `public/defaultMaps.json`. It now appears in the data-driven "Default Maps" picker
   (replacing the hardcoded "🗺 Eurasia" button) and can be set as the boot map.

The Node build script (WS6) automates step 1 for all maps at once; the dev panel covers ad-hoc
single-map regeneration. The panel is explicitly **temporary/dev-only** and gated from normal users.

---

## 11. Workstream decomposition

| WS | Title | Lead | Summary |
|----|-------|------|---------|
| WS1 | Geodata preparation | `@infra-lead` | Download/convert/downsample sources → `public/geodata/` + manifest; document licenses |
| WS2 | Shared rasterizer core | `@backend-lead` | `src/geo/` projection, dataset sampling, dimension solver, classifier (no cosmetic post-processing), default-map defs; full unit tests |
| WS3 | Variable grid support | `@frontend-lead` | Dynamic dimensions in builder context/renderer/sim boot; perf-validate hex budget |
| WS4 | Region picker + dev generator UI | `@frontend-lead` | `RealWorldPanel` (bbox + budget + Generate) and temporary `DefaultMapGenerator` panel |
| WS5 | Default-map manifest & bundling | `@frontend-lead` | `public/defaultMaps.json`, data-driven Default Maps picker, replace hardcoded Eurasia boot |
| WS6 | Default-map build script | `@infra-lead` | `scripts/generate-default-maps.ts` → emits all 10 `public/maps/*.worldmap.json` |

### Dependencies
- WS2 depends on the **manifest contract** from WS1 (§5) — that contract is frozen first so WS1/WS2
  proceed against it concurrently.
- WS3 is independent and can start immediately.
- WS4, WS5, WS6 depend on WS2 (the core) and WS3 (variable grid).

---

## 12. Execution mode

- **Mode**: Local sequential (single macOS workspace; no Codespaces parallelism required).
- **Waves**:
  - **Wave 1** — Freeze §5 manifest contract → WS1 (geodata prep) + WS2 (core). WS3 (variable grid)
    runs alongside as it is contract-independent.
  - **Wave 2** — WS6 (build script) + WS5 (manifest/bundling) on top of WS2/WS3.
  - **Wave 3** — WS4 (region picker + dev generator UI); generate the 10 default maps; integration.
- **Sync points**: end of Wave 1 (core + datasets verified together via a smoke rasterization);
  end of Wave 2 (default maps generate & load); end of Wave 3 (UI end-to-end).

---

## 13. Testing strategy (high level — `@test-lead` to expand)

- **WS2 (pure)**: projection round-trip (forward∘inverse ≈ identity); dimension solver hits budget
  within tolerance and matches projected aspect; classifier unit tests over synthetic
  elevation/Köppen fixtures; area-weighted land/ocean keeps a hex genuinely dominated by a small
  island as land; river overlay hits known cells.
- **WS3**: builder/renderer render at several arbitrary dimensions; load/save round-trips variable
  sizes; performance benchmark at `MAX_HEX_BUDGET`.
- **WS4/WS5**: panel generates a small map and loads it into the builder; default-maps manifest
  drives the picker; boot map loads from manifest.
- **WS6**: script emits valid `SavedCustomMap` JSON for all 10 maps; each re-imports cleanly.

---

## 14. Open risks & mitigations

| Risk | Mitigation |
|------|------------|
| Bundle size from rasters | Downsample aggressively; quantize; lazy-fetch geodata only when the Real-World panel/generator is opened |
| Performance at high hex budgets | `MAX_HEX_BUDGET` validated empirically in WS3; lower if needed |
| Köppen class → biome mismatches look off | Tunable thresholds + the manual round-trip workflow (§10) to correct any map by hand |
| `river_valley` sparse/over-eager | Use a simplified rivers set + radius tuning; rivers are an overlay the author can edit |
| Equal Earth pole shape squish | Accepted trade-off (area is preserved; only shape compresses where it's mostly ocean/ice) |
| Single-hex islands/speckle at coarse budgets read as noisy | Accepted — fidelity is intended; raise hex budget for finer coastlines, or edit by hand via §10 |

---

## 15. Approval

APPROVED by human on 2026-06-16. This document and its companion Launch Plan
(`2026-06-16-162511-launch-plan-real-world-maps.md`) are now **immutable**. Leads execute under the
7-Gate protocol.
