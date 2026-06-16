# Launch Plan: Real-World Map Import & Generation

- **Date**: 2026-06-16
- **Status**: APPROVED (immutable)
- **Architecture**: `.plans/project/2026-06-16-162511-architecture-real-world-maps.md`
- **Feature Fingerprint**: realworld-map-rasterizer + equal-area-projection + variable-grid + default-map-generator
- **Execution Mode**: Local sequential (single workspace)

---

## 1. Execution waves

| Wave | Workstreams | Lead(s) | Prerequisite |
|------|-------------|---------|--------------|
| 1 | WS1 Geodata prep, WS2 Rasterizer core, WS3 Variable grid | `@infra-lead`, `@backend-lead`, `@frontend-lead` | §5 manifest contract frozen |
| 2 | WS6 Build script, WS5 Manifest & bundling | `@infra-lead`, `@frontend-lead` | WS2 + WS3 merged |
| 3 | WS4 Region picker + dev generator UI; generate 10 maps; integrate | `@frontend-lead` | WS2 + WS3 + WS5 merged |

**Sync points**: end of Wave 1 (smoke-rasterize a small region using real datasets), end of Wave 2
(all 10 default maps generate & load), end of Wave 3 (UI end-to-end).

Each lead presents its execution plan to the human for approval (Gate 0), runs the 7-Gate sequence,
delegates to `@developer`/`@tester`/`@docs-writer`, and logs to `.agent-logs/project/`.
`@test-lead` is invoked in parallel with Wave 1 development to produce specs in `.test-specs/project/`.

---

## 2. Shared contracts (freeze before Wave 1)

- **Geodata manifest** — `public/geodata/manifest.json` exactly as in architecture §5.
- **`SavedCustomMap`** — unchanged (`src/types/mapbuilder.ts`); rasterizer output target.
- **`rasterizeRegion` signature** — architecture §7.1.
- **Budget constants** — `DEFAULT_HEX_BUDGET=40_000`, `MAX_HEX_BUDGET=64_000` (WS3-validated).
- **Default-map definitions** — architecture §9 bounding-box table, exported from `src/geo/defaultMaps.ts`.

---

## 3. Delegation payloads

### WS1 — Geodata preparation (`@infra-lead`)
- **Plan ref**: architecture §5.
- **Branch**: `feature/geodata/prep-and-manifest`
- **Task**: Add `scripts/geodata/` preprocessing that downloads/converts ETOPO/GEBCO elevation,
  Köppen–Geiger climate, and Natural Earth rivers into `public/geodata/{elevation.bin, koppen.bin,
  rivers.geojson}` plus `manifest.json` matching §5. Choose raster resolution balancing detail vs.
  a few-MB bundle. Document each dataset's source URL and license in a `public/geodata/README.md`.
- **Acceptance**: manifest validates against §5 schema; assets load and sample correctly via a
  throwaway Node check; licenses documented; total bundle within target size.

### WS2 — Shared rasterizer core (`@backend-lead`)
- **Plan ref**: architecture §3, §4, §6, §7.1.
- **Branch**: `feature/geo/rasterizer-core`
- **Task**: Implement `src/geo/`: `EqualEarth.ts` (forward + Newton inverse), `GeoDataset.ts`
  (manifest loader + nearest/bilinear sampling + river hit-test), `dimensionSolver.ts` (§4.3),
  `koppen.ts` (§6.1 table), `rasterizeRegion.ts` (§6 pipeline → `SavedCustomMap`), and
  `defaultMaps.ts` (§9 table). **No cosmetic post-processing** (§6.2) — classification output is
  serialized directly; islands and precise biome boundaries are preserved. Environment-agnostic;
  no DOM. Full unit tests per §13.
- **Acceptance**: `forward∘inverse` within 1e-6; solver hits budget ±5% and matches projected
  aspect; classifier passes fixture tests; `rasterizeRegion` produces a valid `SavedCustomMap`;
  all tests green.

### WS3 — Variable grid support (`@frontend-lead`)
- **Plan ref**: architecture §8.
- **Branch**: `feature/mapbuilder/variable-grid`
- **Task**: Convert `WIDTH/HEIGHT` constants in `MapBuilderContext.tsx` to state with
  `setDimensions`; ensure `MapBuilderRenderer`, canvas, and `fitToView` handle arbitrary aspect;
  update `SimulationContext.tsx` boot to read variable dims (boot map source finalized in WS5).
  Add a hex-budget/size selector surface. Benchmark and confirm/adjust `MAX_HEX_BUDGET`.
- **Acceptance**: builder + sim run correctly at multiple arbitrary dimensions; load/save round-trip
  variable sizes; performance documented at the chosen cap; existing tests stay green.

### WS6 — Default-map build script (`@infra-lead`)
- **Plan ref**: architecture §9, §10.
- **Branch**: `feature/geodata/generate-default-maps`
- **Task**: `scripts/generate-default-maps.ts` (Node) loads `public/geodata` via a fs-backed
  `GeoDataset`, calls `rasterizeRegion` for each of the 10 maps in `defaultMaps.ts`, and writes
  `public/maps/<name>.worldmap.json`. Idempotent; per-map budget overridable via CLI.
- **Acceptance**: all 10 files emit as valid `SavedCustomMap`; each re-imports via `loadMap`
  without error; script documented in README.

### WS5 — Default-map manifest & bundling (`@frontend-lead`)
- **Plan ref**: architecture §9, §10.
- **Branch**: `feature/mapbuilder/default-maps-manifest`
- **Task**: Add `public/defaultMaps.json` (name → file → bbox metadata); build a data-driven
  "Default Maps" picker in `MapBuilderPanel.tsx` replacing the hardcoded "🗺 Eurasia" button; set
  the app boot map (`SimulationContext.tsx`) to a chosen default from the manifest.
- **Acceptance**: picker lists all manifest entries and loads each; boot map comes from the
  manifest; removing/adding a manifest entry updates the UI with no code change.

### WS4 — Region picker + dev generator UI (`@frontend-lead`)
- **Plan ref**: architecture §10, §7.
- **Branch**: `feature/realworld/region-picker`
- **Task**: `src/ui/realworld/RealWorldPanel.tsx` — mini Equal Earth world map with a draggable/
  resizable bounding box, hex-budget preset selector, **Generate** (calls `rasterizeRegion` with a
  fetch-backed `GeoDataset`) → loads result into the builder. `DefaultMapGenerator.tsx` — TEMPORARY
  dev-only panel (gated by `?dev=1`/env flag) listing the 10 maps with Generate + Download per map
  (reusing existing save logic). Lazy-load geodata only when these panels open.
- **Acceptance**: picking a region generates and loads a map; dev panel generates & downloads each
  default; geodata fetched lazily; dev panel hidden for normal users.

---

## 4. Per-workstream completion bar (every WS)
- 7-Gate sequence completed; `@tester` verdict ALL PASS; `@code-reviewer` verdict APPROVE.
- `@docs-writer` updates `README.md` for user-facing pieces (region picker, default maps, build script).
- Session logs in `.agent-logs/project/`; dashboard events emitted; merged to `main` via PR.

---

## 5. Decisions locked (from interview)
- Projection: **Equal Earth**. Biomes: **Köppen–Geiger**. Rivers: **Natural Earth vectors** →
  `river_valley` overlay. Upload (Option C): **out of scope**.
- Dimensions: **fully customizable up front**; comparable hex budget across maps (shape varies).
- Default maps: the **10** listed in architecture §9.
- Temporary **download/edit/resubmit** round-trip provided via dev generator panel + manifest.

---

## 6. Approval gate
APPROVED by human on 2026-06-16. Both this launch plan and the architecture are now **immutable**.
Wave 1 begins with `@infra-lead`, `@backend-lead`, and `@frontend-lead` presenting Gate-0 execution
plans, with `@test-lead` invoked in parallel to produce specs.
