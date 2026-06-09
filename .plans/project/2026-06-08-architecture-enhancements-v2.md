# Architecture: World Simulator Enhancements — v2
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Supersedes**: .plans/project/2026-06-08-architecture-enhancements-v1.md
- **Prior Plan Reference**: .plans/project/2026-06-07-202651-architecture-world-simulator.md
- **Feature Fingerprint**: bold-borders-v2 + sea-voyage-lines-v2 + map-builder-v2 + pan-zoom

---

## Overview

This document supersedes v1 of the enhancements architecture and incorporates four areas of revision based on user feedback. All work remains confined to a single frontend workstream on `feature/ui/world-simulator-enhancements`. No backend or infrastructure changes are required.

### Change Summary (v1 → v2)

| # | Feature | Change |
|---|---------|--------|
| 1 | Political State Borders | Terrain visible through transparent state overlay; thin grid lines within states; bold colored borders only between different states |
| 2 | Sea Voyage Arcs | Arc/arrowhead color now uses the attacking state's own color instead of fixed gold/blue |
| 3 | Map Builder | Brush range extended to 0–8 (0 = single hex); biome key legend added below swatches |
| 4 | Pan/Zoom (NEW) | Full-screen canvas filling the viewport rectangle; mouse-wheel zoom + middle/right-drag pan for both the simulation viewer and the map builder; consistent scale between the two canvases |

---

## Feature 1 (Revised): Political State Borders

### Problem
v1 blended terrain and state color into a single opaque tile fill, hiding underlying geography and making borders hard to follow. The user wants the terrain map to remain legible beneath a semi-transparent state overlay, with a clear visual hierarchy: thin grid lines for same-state tile edges, bold colored borders at state boundaries.

### Solution

#### Tile Fill — Two Layers

1. **Base fill (always)**: `getTileColor(tile, mode, ...)` in `MapModes.ts` returns the **terrain color** regardless of map mode. The blending previously done for `'political'` mode is removed.

2. **Political overlay pass** (inserted between tile fill and border passes in `HexRenderer`):
   - Only active when `uiState.mapMode === 'political'`
   - For each tile with an assigned state (`stateId >= 0`), parse the state's hex `color` to `(r, g, b)` and fill the hex with `rgba(r, g, b, 0.42)`
   - Ocean tiles (`terrain === 'ocean'`) receive no overlay

   This gives every territory a distinct tinted wash that reads as the state's color while leaving the terrain texture visible.

#### Border Rendering — Three Tiers

**Tier 0 — Hex grid (political mode only)**:
- For all shared land-land edges (same or different state), after deduplication:
  - `ctx.lineWidth = 0.8`, `ctx.strokeStyle = 'rgba(255,255,255,0.12)'`
  - Draw the edge unconditionally (creates a subtle hex grid inside each state's territory)

**Tier 1 — Cross-state bold borders**:
- For shared land-land edges where `simState.ownership[tile.index] !== simState.ownership[neighborIdx]`:
  - **Pass A (shadow)**: `ctx.lineWidth = 3.5`, `ctx.strokeStyle = 'rgba(0,0,0,0.80)'`
  - **Pass B (highlight)**: `ctx.lineWidth = 2.0`, `ctx.strokeStyle = state.color` (the lower-index tile's state color at full alpha)
  - This two-pass approach makes territory boundaries unmistakably clear while each state's edge glows with its own color

**Tier 2 — Coastlines**:
- Unchanged from v1: `rgba(20,60,100,0.9)`, `lineWidth = 2`

**Non-political modes (terrain / productivity / obstacle)**:
- Same Tier 1 deduplication of cross-state borders with the v1 two-pass white highlight (`rgba(255,255,255,0.95)`)
- Coastlines unchanged

### File Changes
- `src/renderer/MapModes.ts` — remove political-mode blend from `getTileColor`; always return terrain color for non-ocean tiles
- `src/renderer/HexRenderer.ts` — add political overlay pass; revise border rendering into three tiers as above

---

## Feature 2 (Revised): Sea Conquest Voyage Arc Lines

### Change from v1
Arc and arrowhead color used to be fixed: gold for success, steel-blue for failure. The user wants the arc to use the attacking state's color, providing immediate visual association between the invading territory and the crossing.

### Data Flow (revised)

```
SimulationEngine.step()
    → records sea crossings WITH attackerStateId
    ↓
SimulationContext.doStep()
    → reads engine.getLastSeaCrossings()
    → looks up stateColor = simState.states.get(crossing.attackerStateId)?.color ?? '#ffffff'
    → calls animationController.markSeaVoyage(from, to, succeeded, stateColor)
    ↓
HexRenderer PASS 8
    → for each voyage: uses voyage.stateColor at voyage.opacity
```

### Interface Changes

**`SimulationEngine.lastSeaCrossings` element type** (additive field):
```typescript
{ from: number; to: number; succeeded: boolean; attackerStateId: number }
```

**`AnimationController`**:
```typescript
// SeaVoyageAnimation (private interface) adds:
stateColor: string;

// Updated signature:
markSeaVoyage(fromIndex: number, toIndex: number, succeeded: boolean, stateColor: string): void;

// Updated return type:
getActiveSeaVoyages(): ReadonlyArray<{
  fromIndex: number;
  toIndex: number;
  succeeded: boolean;
  opacity: number;
  stateColor: string;  // ← new
}>
```

### Rendering (PASS 8 update)
- Arc color: `ctx.strokeStyle = rgba(r, g, b, ${voyage.opacity})` where r/g/b are parsed from `voyage.stateColor`
- Arrowhead fill: same color
- `succeeded` hint: optionally add a small "✓" or "✗" symbol near the arrowhead tip — **out of scope for v2; do not implement**

### Files Changed
- `src/simulation/SimulationEngine.ts` — add `attackerStateId` to `lastSeaCrossings` push
- `src/SimulationContext.tsx` — look up state color, pass to `markSeaVoyage`
- `src/renderer/AnimationController.ts` — add `stateColor` field and parameter
- `src/renderer/AnimationController.test.ts` — update `markSeaVoyage` call signatures; assert `stateColor` is returned
- `src/renderer/HexRenderer.ts` — use `voyage.stateColor` for arc and arrowhead

---

## Feature 3 (Revised): Map Builder Mode

All components from v1 are retained. The two revisions are:

### 3a. Brush Size Range: 0–8

`MapBuilderState.brushSize` range is **0–8** (was 1–8).

- `brushSize = 0` → "Single hex" — only the center tile is selected
- `brushSize = 1` → center + immediate ring (up to 7 tiles)
- `brushSize = 2–8` → increasing hex-hop radii (unchanged from v1)

`getBrushTileIndices(centerIdx, 0)` naturally returns `{centerIdx}` because no neighbor has `hexDistance ≤ 0`.

**UI changes in `MapBuilderPanel`**:
- Slider range: `min="0" max="8"`
- Label: when `brushSize === 0` show "Brush: Single hex"; when `brushSize === 1` show "Brush: 1 (small ring)"; otherwise "Brush: {n}"
- Initial `brushSize` in `MapBuilderContext` state: `1` (unchanged)

### 3b. Biome Key/Legend

Below the biome selector swatches, add a read-only `BiomeLegend` section in `MapBuilderPanel`.

**Structure**:
```
BIOME REFERENCE
┌──────────────────────────────────────────┐
│ 🟩  River Valley   productivity ~0.93    │
│ 🟩  Plains         productivity ~0.70    │
│ 🟩  Forest         productivity ~0.53    │
│ 🟫  Hills          productivity ~0.40    │
│ 🟨  Desert         productivity ~0.15    │
│ ⬜  Tundra         productivity ~0.18    │
│ ⬜  Mountains      productivity ~0.15    │
│ 🟦  Ocean          (water, impassable)   │
└──────────────────────────────────────────┘
```

**Implementation**: a `<div>` table-like layout inside `MapBuilderPanel`, always visible (not collapsible). Each row: 16×16 px color swatch + biome name + productivity hint. Uses the same `TERRAIN_COLORS` map. Styled with small muted text, matching the panel's dark theme.

**Productivity defaults** (from `WorldGenerator.fromCustomMap` terrain midpoints):
| Terrain | Default Productivity |
|---------|---------------------|
| river_valley | ~0.93 |
| plains | ~0.70 |
| forest | ~0.53 |
| hills | ~0.40 |
| tundra | ~0.18 |
| desert | ~0.15 |
| mountains | ~0.15 |
| ocean | 0 (impassable) |

---

## Feature 4 (New): Pan/Zoom Navigation for Both Canvases

### Problem
The current canvas fit algorithm centers the map diagonally inside the available rectangle, clipping tiles at the edges of an axis-aligned bounding box. The user wants the full rectangular viewport filled and the ability to pan and zoom to explore large maps.

### Camera Model

Both `HexRenderer` and `MapBuilderRenderer` adopt a **camera transform** stored as:
```typescript
private camera = { x: 0, y: 0, scale: 1 };
```

The canvas 2D context is transformed at the start of each render frame:
```typescript
ctx.setTransform(camera.scale, 0, 0, camera.scale, camera.x, camera.y);
// ... all draw calls use world coordinates ...
ctx.setTransform(1, 0, 0, 1, 0, 0); // reset after drawing
```

**Coordinate spaces**:
- *World space*: raw hex tile positions, computed from `(q, r)` as before but with no offset baked in (origin = top-left of the map bounding box)
- *Screen space*: pixel coordinates relative to the canvas element

Transformation formulas:
```
screenX = worldX * scale + camera.x
screenY = worldY * scale + camera.y

worldX = (screenX - camera.x) / scale
worldY = (screenY - camera.y) / scale
```

### Initial Camera — `fitToView(w: number, h: number)`

Replaces the current `computeOffsets()` method in `HexRenderer` (and the equivalent in `MapBuilderRenderer`).

Algorithm:
```
1. Compute bounding box of all tile centers in world space:
   minWX, maxWX, minWY, maxWY
2. mapW = maxWX - minWX + HEX_SIZE * 2   (add 1 hex of padding)
   mapH = maxWY - minWY + HEX_SIZE * 2
3. scaleX = w / mapW
   scaleY = h / mapH
   camera.scale = min(scaleX, scaleY) * 0.95   (5% inset so no clipping)
4. camera.x = (w - mapW * camera.scale) / 2 - minWX * camera.scale + HEX_SIZE * camera.scale
   camera.y = (h - mapH * camera.scale) / 2 - minWY * camera.scale + HEX_SIZE * camera.scale
```

This centers the entire map and ensures the viewport is fully filled with no diagonal clipping.

### Camera Manipulation Methods (both renderers)

```typescript
panBy(dx: number, dy: number): void {
  this.camera.x += dx;
  this.camera.y += dy;
}

zoomAt(screenX: number, screenY: number, factor: number): void {
  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 10.0;
  const worldX = (screenX - this.camera.x) / this.camera.scale;
  const worldY = (screenY - this.camera.y) / this.camera.scale;
  this.camera.scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.camera.scale * factor));
  this.camera.x = screenX - worldX * this.camera.scale;
  this.camera.y = screenY - worldY * this.camera.scale;
}

resetView(w: number, h: number): void {
  this.fitToView(w, h);
}
```

### `getTileAtPixel` Update (both renderers)

Apply the inverse camera transform before nearest-center search:
```typescript
getTileAtPixel(sx: number, sy: number): number | null {
  const wx = (sx - this.camera.x) / this.camera.scale;
  const wy = (sy - this.camera.y) / this.camera.scale;
  // ... existing nearest-tile search using (wx, wy) against tileCenter() world coords ...
}
```

### `tileCenter` Update (both renderers)

Remove the camera offset from `tileCenter()`. It now returns **world-space** coordinates:
```typescript
private tileCenter(q: number, r: number): [number, number] {
  return [
    HEX_SIZE * (3 / 2) * q,
    HEX_SIZE * Math.sqrt(3) * (r + q / 2),
  ];
}
```

The camera transform is applied at render time via `ctx.setTransform`, so all draw calls use world coordinates.

### MapCanvas.tsx — Navigation Events

Add the following event handlers:

**Mouse wheel** (`onWheel`):
```typescript
onWheel={(e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  rendererRef.current?.zoomAt(x, y, factor);
}}
```
Add `{ passive: false }` to the event listener to allow `preventDefault()` (prevents page scroll).

**Middle/right-drag pan**:
```typescript
const isPanning = useRef(false);
const panStart = useRef({ x: 0, y: 0 });

onMouseDown={(e) => {
  if (e.button === 1 || e.button === 2) {
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }
}}

onMouseMove={(e) => {
  if (isPanning.current) {
    rendererRef.current?.panBy(e.movementX, e.movementY);
  } else {
    // existing hover logic
  }
}}

onMouseUp={(e) => {
  if (e.button === 1 || e.button === 2) isPanning.current = false;
}}

onContextMenu={(e) => e.preventDefault()}
```

**Cursor**: add a CSS class to the wrapper div — `cursor: grab` while middle/right button held, `cursor: grabbing` while dragging. Use a `useState<boolean>` for `isNavigating` to drive the class.

**Double-click to reset**: `onDoubleClick` with right-click calls `renderer.resetView(w, h)`.

### MapBuilderCanvas.tsx — Navigation Events

Identical pattern to `MapCanvas.tsx`. Disambiguation:
- `e.button === 0` (left): paint (existing behavior)
- `e.button === 1` (middle) or `e.button === 2` (right): pan

Keyboard shortcut addition:
- `R` key (with focus on canvas wrapper): call `renderer.resetView(w, h)` (reset to fit-to-view)

Existing shortcuts `[` / `]` for brush size remain unchanged.

### Scale Consistency

Both renderers:
- Use `HEX_SIZE = 12` (no change)
- Use the same `fitToView()` algorithm
- Start with `camera.scale = min(scaleX, scaleY) * 0.95` relative to their respective canvas dimensions

Since the map builder canvas is wider than the simulation canvas (no right panel), the map builder will have a **higher** initial zoom level if using the same map dimensions. This is the desired behavior: both show the full map, but the map builder's larger canvas gives more room. The user can zoom to the same level as the sim canvas manually.

The important fix is that neither canvas clips tiles diagonally any more — both show the complete rectangular extent of the map from the start.

### Files Changed
- `src/renderer/HexRenderer.ts` — replace `computeOffsets`+static `offsetX/Y` with camera model; add `panBy`, `zoomAt`, `resetView`, `fitToView`; update `tileCenter`, `getTileAtPixel`, `render`
- `src/ui/MapCanvas.tsx` — add wheel, middle-drag, right-drag handlers; cursor state
- `src/ui/MapCanvas.module.css` — add `.navigating` class
- `src/ui/mapbuilder/MapBuilderRenderer.ts` — same camera model as HexRenderer
- `src/ui/mapbuilder/MapBuilderCanvas.tsx` — same event additions as MapCanvas; `R` to reset view

---

## Interface Contracts (complete, v2)

### AnimationController
```typescript
markSeaVoyage(fromIndex: number, toIndex: number, succeeded: boolean, stateColor: string): void;

getActiveSeaVoyages(): ReadonlyArray<{
  fromIndex: number;
  toIndex: number;
  succeeded: boolean;
  opacity: number;
  stateColor: string;
}>
```

### SimulationEngine
```typescript
getLastSeaCrossings(): ReadonlyArray<{
  from: number;
  to: number;
  succeeded: boolean;
  attackerStateId: number;   // ← new in v2
}>
```

### WorldGenerator
```typescript
static fromCustomMap(
  tiles: MapBuilderTile[],
  width: number,
  height: number
): WorldData;
```

### SimulationContext
```typescript
loadCustomWorld(worldData: WorldData): void;
```

### HexRenderer (new public surface)
```typescript
panBy(dx: number, dy: number): void;
zoomAt(screenX: number, screenY: number, factor: number): void;
resetView(w: number, h: number): void;
```

### MapBuilderRenderer (new public surface)
```typescript
panBy(dx: number, dy: number): void;
zoomAt(screenX: number, screenY: number, factor: number): void;
resetView(w: number, h: number): void;
```

---

## File Impact Summary

### New Files (unchanged from v1)
| File | Description |
|------|-------------|
| `src/types/mapbuilder.ts` | MapBuilderTile, MapBuilderState, SavedCustomMap types |
| `src/ui/mapbuilder/MapBuilderContext.tsx` | React context + state management |
| `src/ui/mapbuilder/MapBuilderPanel.tsx` | Left sidebar controls (revised: brush 0–8, biome legend) |
| `src/ui/mapbuilder/MapBuilderPanel.module.css` | Panel styles (revised: biome legend rows) |
| `src/ui/mapbuilder/MapBuilderCanvas.tsx` | Interactive canvas (revised: pan/zoom events) |
| `src/ui/mapbuilder/MapBuilderCanvas.module.css` | Canvas styles |
| `src/ui/mapbuilder/MapBuilderRenderer.ts` | Renderer utility (revised: camera model) |
| `src/ui/mapbuilder/MapBuilderRenderer.test.ts` | Renderer unit tests (revised: camera tests) |

### Modified Files (v2 additions shown with ←)
| File | Changes |
|------|---------|
| `src/renderer/HexRenderer.ts` | Camera model ←; political overlay pass ←; revised border tiers ←; arc state color ← |
| `src/renderer/MapModes.ts` | Remove political blend from getTileColor ← |
| `src/renderer/AnimationController.ts` | stateColor param in markSeaVoyage ← |
| `src/renderer/AnimationController.test.ts` | Updated signatures ← |
| `src/simulation/SimulationEngine.ts` | attackerStateId in lastSeaCrossings ← |
| `src/SimulationContext.tsx` | Pass stateColor to markSeaVoyage ←; loadCustomWorld (v1) |
| `src/ui/MapCanvas.tsx` | Pan/zoom event handlers ← |
| `src/ui/MapCanvas.module.css` | .navigating cursor class ← |
| `src/App.tsx` | appMode toggle (v1) |
| `src/styles/App.module.css` | .builderMain, .modeToggleBtn (v1) |
| `src/simulation/WorldGenerator.ts` | fromCustomMap static method (v1) |
| `src/simulation/WorldGenerator.test.ts` | fromCustomMap test (v1) |

---

## Task Ordering for @developer (v2)

Implement in this exact order to avoid import errors:
1. `src/types/mapbuilder.ts` (types first, unchanged from v1)
2. `src/renderer/MapModes.ts` (remove political blend — small, early)
3. `src/renderer/AnimationController.ts` (add stateColor to markSeaVoyage + SeaVoyageAnimation)
4. `src/simulation/SimulationEngine.ts` (add attackerStateId to lastSeaCrossings)
5. `src/renderer/HexRenderer.ts` (camera model + political overlay + revised borders + arc color)
6. `src/simulation/WorldGenerator.ts` (add fromCustomMap)
7. `src/SimulationContext.tsx` (pass stateColor to markSeaVoyage; loadCustomWorld)
8. `src/ui/MapCanvas.tsx` + `MapCanvas.module.css` (pan/zoom events)
9. `src/ui/mapbuilder/MapBuilderRenderer.ts` (camera model — mirrors HexRenderer)
10. `src/ui/mapbuilder/MapBuilderContext.tsx` (context + logic, brush range 0–8)
11. `src/ui/mapbuilder/MapBuilderPanel.tsx` + `.module.css` (brush 0–8, biome legend)
12. `src/ui/mapbuilder/MapBuilderCanvas.tsx` + `.module.css` (pan/zoom events)
13. `src/App.tsx` + `src/styles/App.module.css` (integration)

---

## Acceptance Criteria (v2 complete)

1. **Political map** renders terrain colors beneath a transparent state tint; state boundaries are clearly visible as bold colored lines; same-state hex grid is a subtle thin mesh
2. **Sea voyage arcs** match the attacking state's color; gold/blue fallback only if state color is unavailable
3. **Map canvas (simulation)** fills the full viewport rectangle with no diagonal clipping; scroll wheel zooms; middle or right mouse drag pans; initial view shows entire map
4. **Map builder canvas** has identical pan/zoom behavior; initial view matches simulation scale for the same map dimensions; no "zoomed in to a small region" issue
5. **Brush size 0** selects a single hex; UI label reads "Single hex"
6. **Biome legend** is visible below the biome selector swatches; shows color swatch + name + productivity hint for all 8 terrain types
7. All v1 acceptance criteria (3–11) remain satisfied
8. `npm run build` exits 0; `npm test` all tests pass

---

## Out of Scope (v2)
- Touch/pinch-to-zoom support
- Minimap overview
- Labeling states on political map
- Custom color picker for map builder biomes
- Animated pan/zoom easing
