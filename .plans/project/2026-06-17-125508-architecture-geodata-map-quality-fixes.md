# Architecture: Geodata Map Quality Fixes

- **Date**: 2026-06-17
- **Status**: APPROVED (immutable after human approval)
- **Feature Fingerprint**: geodata-map-quality-fixes-v1
- **Related prior plans**: 2026-06-16-162511-architecture-real-world-maps.md (builds on the real-world map pipeline)

---

## 1. Overview

Four quality improvements to the real-world map rasterization pipeline:

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | Horizontal land line at poles (World, North America) | Supersamples outside Equal Earth projected bounds produce NaN lon → raster clamp artifact | Clamp supersample `sx`/`sy` to `[minX, maxX]`/`[minY, maxY]` before `inverse()` |
| 2 | Too mountainous | `DEFAULT_MOUNTAIN_THRESHOLD = 900 m` is too low for 18 km raster cells | Lower to 600 m; lower hill threshold 300 → 200 m |
| 3 | Coastline errors (missing Florida/Bangladesh, land bridges) | `isLand` uses `> seaLevel` (misses 0 m coastal cells); ETOPO ice-surface product has shallow shelves at slightly positive elevation | Use a configurable `seaLevelAdjustment` (+5 m default): land = `elevation > seaLevel + seaLevelAdjustment`; eliminates shallow shelf bridges while preserving true land |
| 4 | Excess ocean margins on some maps | Bounding boxes include large ocean-only areas | Trim `lonMax` on north-america/americas/eurasia/old-world |

---

## 2. Affected files

| File | Change |
|------|--------|
| `src/geo/rasterizeRegion.ts` | (1) Clamp supersamples; (2) Lower default thresholds; (3) Add `seaLevelAdjustment` option |
| `src/geo/GeoDataset.ts` | (3) Add `seaLevelAdjustment` param to `isLand()` / `RasterGeoDataset` |
| `src/geo/defaultMaps.ts` | (4) Trim bounding boxes |

No changes to engine, renderer, or UI — purely data-pipeline fixes.

---

## 3. Detailed changes

### 3.1 Supersample clamping (polar line fix)

**File:** `src/geo/rasterizeRegion.ts`

In the supersample loop:
```ts
const sx = cx + ((si + 0.5) / k - 0.5) * cellW;
const sy = cy + ((sj + 0.5) / k - 0.5) * cellH;
```
Add clamping:
```ts
const sxClamped = Math.min(maxX, Math.max(minX, sx));
const syClamped = Math.min(maxY, Math.max(minY, sy));
const ll = inverse(sxClamped, syClamped);
```
This prevents out-of-bounds projected coordinates from reaching `inverse()`, eliminating the NaN/Infinity longitude that causes the polar land-line artifact.

### 3.2 Mountain/hill threshold reduction

**File:** `src/geo/rasterizeRegion.ts`

```ts
// Before:
const DEFAULT_MOUNTAIN_THRESHOLD = 900;
const DEFAULT_HILL_THRESHOLD = 300;

// After:
const DEFAULT_MOUNTAIN_THRESHOLD = 600;
const DEFAULT_HILL_THRESHOLD = 200;
```

Rationale: At 1/6° ≈ 18 km cell resolution, TRI over a 3×3 neighbourhood spans ~54 km. A 900 m range is easily achieved by moderate plateaus and rolling highlands. 600 m better distinguishes true mountain ranges (Alps, Himalayas, Rockies, Andes) from highlands and plateaus.

### 3.3 Sea-level adjustment (coastline accuracy)

**Mechanism:**
- Add `seaLevelAdjustment?: number` to `RasterizeOptions` (default `5` metres).
- Pass it through to `dataset.isLand()` calls.
- Modify `RasterGeoDataset.isLand()` to accept an optional offset parameter: `elevation > seaLevel + adjustment`.

**Effect:**
- Shallow shelves at 1–5 m (ETOPO ice-surface product artefacts): English Channel avg ~−30 m but patches at +1–5 m → now correctly ocean.
- Torres Strait north of Australia: avg ~10–12 m below sea level; shallow areas at +1–5 m → correctly ocean.  
- Low-lying coastal deltas: Bangladesh at 5–10 m, Florida interior at 5–30 m → mostly still land. Only the absolute lowest coastal fringe (0–5 m) becomes ocean, which is geographically reasonable for sea-level-accurate maps.
- Note: Some very low deltas will lose a thin coastal fringe. This is the best single-parameter tradeoff. Authors can manually restore individual tiles using the Map Builder paint tools.

**Implementation:**
The `seaLevelAdjustment` is passed to rasterizeRegion as part of `RasterizeOptions`. The `GeoDataset.isLand()` interface gains an optional `adjustment` parameter.

### 3.4 Bounding box trimming

**File:** `src/geo/defaultMaps.ts`

Conservative trims — only remove clearly ocean-only margins:

| Map | Before | After | Rationale |
|-----|--------|-------|-----------|
| `north-america` | lonMax: `-10` | `-52` | Atlantic east of Newfoundland (~-52°) is empty ocean; Azores at -28° are out of North America scope |
| `americas` | lonMax: `-10` | `-34` → stays; lonMin: `-170` → stays | Brazil east coast at -34°; Aleutians reach -180° |
| `eurasia` | lonMax: `180` | `170` | Kamchatka/Commander Islands ~162–167°; 170° is safe margin |
| `old-world` | lonMax: `180` | `170` | Same as Eurasia — Pacific east of 170° is ocean |

Note: `world` and `south-america` left unchanged — world by definition spans full longitude range; South America's box is already tight.

---

## 4. API changes

### `RasterizeOptions` (additive, backward-compatible)
```ts
export interface RasterizeOptions {
  name: string;
  hexBudget: number;
  mountainThreshold?: number;
  hillThreshold?: number;
  supersample?: number;
  seaLevelAdjustment?: number;  // NEW — metres above sea level required for land (default: 5)
}
```

### `GeoDataset.isLand()` (additive parameter)
The interface gains an optional second parameter:
```ts
isLand(lonDeg: number, latDeg: number, seaLevelAdjustment?: number): boolean;
```
`RasterGeoDataset.isLand()` implements: `elevation > this.seaLevel + (seaLevelAdjustment ?? 0)`.

---

## 5. Testing

- Existing unit tests in `src/geo/rasterizeRegion.test.ts`, `src/geo/GeoDataset.test.ts` must still pass.
- The polar-line fix is verified by checking that the world map top row contains only ocean tiles (at 90° lat, no land should appear in a row-0 sample).
- Re-run `npm run generate-maps` after changes to verify visual output.

---

## 6. Execution

Single workstream — all changes are in the rasterizer/data pipeline layer.

### 6.1 Branch
`fix/geodata/map-quality-fixes`

### 6.2 Work items (for developer)
1. Edit `src/geo/rasterizeRegion.ts`:
   - Clamp `sx`/`sy` in supersample loop
   - Lower `DEFAULT_MOUNTAIN_THRESHOLD` to 600, `DEFAULT_HILL_THRESHOLD` to 200
   - Add `seaLevelAdjustment` option (default 5), thread it into `dataset.isLand()` calls
2. Edit `src/geo/GeoDataset.ts`:
   - Add optional `seaLevelAdjustment?: number` param to `GeoDataset.isLand()` interface
   - Implement in `RasterGeoDataset.isLand()`
3. Edit `src/geo/defaultMaps.ts`:
   - Trim `lonMax` for north-america (`-52`), eurasia (`170`), old-world (`170`)
4. Run `npm test` — all existing tests must pass.
5. Run `npm run generate-maps` to regenerate the map JSON files.

### 6.3 Acceptance criteria
- [ ] `npm test` passes with no regressions
- [ ] World map no longer has a horizontal land band across the top/bottom row
- [ ] Mountain coverage is visually reduced (compare before/after on Asia/Europe maps)
- [ ] English Channel and Torres Strait show as ocean
- [ ] Florida and Bangladesh peninsulas are present (may not be pixel-perfect — acceptable)
- [ ] north-america, eurasia, old-world maps have trimmed ocean margins

---

## 7. Notes / risks

- The `seaLevelAdjustment = 5 m` is a heuristic. If maps look worse after regeneration, it can be tuned to 3 m or 0 m (which reverts to the original `> seaLevel` behavior). This is configurable per-call.
- The bounding box trims are conservative; they can be further adjusted if edge content is clipped after visual review.
- Map JSON files in `public/maps/` must be regenerated after code changes. The plan does not regenerate them — the developer should run `npm run generate-maps` and commit the updated JSON files.
