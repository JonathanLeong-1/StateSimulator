# Architecture: World Simulator Enhancements — v3
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Supersedes**: .plans/project/2026-06-08-architecture-enhancements-v2.md
- **Prior Plan References**: .plans/project/2026-06-07-202651-architecture-world-simulator.md, .plans/project/2026-06-08-architecture-enhancements-v2.md
- **Feature Fingerprint**: flat-borders-v3 + rectangular-grid + left-drag-pan + hover-state

---

## Overview

This document supersedes v2 based on three additional user requirements:

1. **Borders**: Remove all shadow/highlight/tier complexity. Replace with a simple two-category line system: solid dark black on state-crossing edges, faint grey on all other edges (same-state, ocean-ocean, land-ocean). Uniform line thickness throughout.
2. **Rectangular map**: The hex grid must occupy a rectangular screen extent — no diagonal/parallelogram corners. Requires changing the hex coordinate system to even-q offset throughout (renderer + simulation neighbor logic).
3. **Interactions**: Left-click-and-drag pans the simulation map (with drag-threshold to keep click-to-select working); hovering over any cell highlights the entire owning state; right/middle drag also pans as a fallback.

All other v2 features (sea voyage arcs, map builder, pan/zoom) remain fully in effect with these layered changes.

---

## Change Summary (v2 → v3)

| # | Area | v2 Behaviour | v3 Behaviour |
|---|------|-------------|--------------|
| 1 | State borders | Three-tier: same-state grid (thin white) + cross-state shadow+state-color highlight + coastline | Two-tier: all edges grey except cross-state = solid black; uniform thickness |
| 2 | Map grid shape | Axial coords → parallelogram bounding box | Even-q offset coords → rectangular bounding box; fills screen |
| 3 | Pan gesture | Middle or right mouse drag only | Left drag (primary) + middle/right drag (secondary); drag-threshold distinguishes from click |
| 4 | Hover behaviour | Highlights only the single hovered tile (dashed outline) | Highlights ALL tiles belonging to the hovered state (semi-transparent overlay) + tile info tooltip unchanged |

---

## Feature 1 (v3): Simplified Flat Border System

### Problem with v2 Borders
The v2 three-tier border system (Tier 0 same-state grid / Tier 1 two-pass shadow+state-color / Tier 2 coastline) was visually noisy and produced colored borders that competed with the political overlay tint.

### v3 Border Specification

**Two categories of edges.** Decide category per shared edge based on state ownership:

| Edge type | Line width | Stroke style |
|-----------|-----------|--------------|
| Cross-state (different `ownership` values for both land tiles) | `1.5` | `rgba(0, 0, 0, 0.88)` — solid near-black |
| All others (same-state land/land, land/ocean, ocean/ocean) | `0.5` | `rgba(180, 180, 180, 0.20)` — faint grey |

**Deduplication**: Only process an edge once — when `tile.index < neighborIdx`. This halves draw calls.

**Single draw loop** (no multi-pass, no tiers). Collect edge lists, draw grey first (background), then black on top:

```typescript
// Collect
const greyEdges: Array<[[number,number],[number,number]]> = [];
const blackEdges: Array<[[number,number],[number,number]]> = [];

for (const tile of tiles) {
  const stateId = simState.ownership[tile.index];
  const [cx, cy] = this.tileCenter(tile.q, tile.r);
  const verts = hexVertices(cx, cy, HEX_SIZE - 0.5);
  for (let k = 0; k < 6; k++) {
    const neighborIdx = tile.allNeighborIndices[k];
    if (neighborIdx === undefined || neighborIdx < 0) continue;
    if (tile.index >= neighborIdx) continue; // dedup
    const neighborState = simState.ownership[neighborIdx];
    const tileIsLand = tile.terrain !== 'ocean';
    const neighborIsLand = tiles[neighborIdx].terrain !== 'ocean';
    const v1 = verts[k];
    const v2 = verts[(k + 1) % 6];
    if (tileIsLand && neighborIsLand && stateId !== neighborState) {
      blackEdges.push([v1, v2]);
    } else {
      greyEdges.push([v1, v2]);
    }
  }
}

// Draw grey edges
ctx.lineWidth = 0.5;
ctx.strokeStyle = 'rgba(180,180,180,0.20)';
ctx.beginPath();
for (const [v1, v2] of greyEdges) { ctx.moveTo(v1[0],v1[1]); ctx.lineTo(v2[0],v2[1]); }
ctx.stroke();

// Draw black edges on top
ctx.lineWidth = 1.5;
ctx.strokeStyle = 'rgba(0,0,0,0.88)';
ctx.beginPath();
for (const [v1, v2] of blackEdges) { ctx.moveTo(v1[0],v1[1]); ctx.lineTo(v2[0],v2[1]); }
ctx.stroke();
```

**All map modes** use this same border logic. The only difference between modes is the tile fill color (terrain / productivity heatmap / obstacle heatmap / political overlay).

**Remove** from `HexRenderer`:
- The existing `showPoliticalOverlay` branch border code
- The Tier 0 / Tier 1 / Tier 2 classification
- All `ctx.lineWidth = 3.5` / Pass A shadow / Pass B state-color-highlight code

**Remove** from `MapModes.ts`:
- The `showPoliticalOverlay` param (was already removed in v2; confirm it's gone)

### Files Changed
- `src/renderer/HexRenderer.ts` — replace existing border collection/draw code with the two-category approach above

---

## Feature 2 (v3): Rectangular Hex Grid — Even-Q Offset Coordinates

### Problem
The current axial coordinate system renders the 80×50 hex grid as a **parallelogram**: as column q increases, the entire column shifts down by `q/2` rows. Tile (79, 0) is rendered ~820 px below tile (0, 0) on screen. The upper-left and lower-right canvas areas are empty; the upper-right and lower-left have tiles.

`fitToView` correctly computes the bounding box, so the map fills the canvas rectangle — but the filled area is a diagonal parallelogram, not a rectangle.

### Solution: Even-Q Offset Flat-Top Layout

Switch the entire project to **even-q offset** hex coordinates. Even-q offset is a well-known alternative to axial for flat-top hexagons where the pixel layout is:

```
pixelX(q, r) = HEX_SIZE * (3/2) * q
pixelY(q, r) = HEX_SIZE * √3 * r  +  (q % 2 !== 0 ? HEX_SIZE * √3 / 2 : 0)
```

Even columns (`q % 2 === 0`) have no vertical offset. Odd columns (`q % 2 !== 0`) are shifted down by half a hex height. This creates a true rectangular grid — tile (0, 0) is in the top-left, tile (79, 0) is in the top-right (same y), and all corner areas are filled.

### Required Changes

#### `src/simulation/hexUtils.ts`

**`getAxialNeighbors(q, r)`** must be replaced with **`getOffsetNeighbors(q, r)`** using even-q offset neighbor formulas:

```typescript
export function getOffsetNeighbors(q: number, r: number): [number, number][] {
  if (q % 2 === 0) {
    // Even column: the column to the right/left is NOT shifted, so the
    // "diagonal" neighbor is above (r-1), not at the same r.
    return [
      [q + 1, r],      // E  (right-same-row)
      [q + 1, r - 1],  // NE (right-above)
      [q,     r - 1],  // N  (above)
      [q - 1, r - 1],  // NW (left-above)
      [q - 1, r],      // W  (left-same-row)
      [q,     r + 1],  // S  (below)
    ];
  } else {
    // Odd column: shifted down by half, so diagonal neighbors are below (r+1).
    return [
      [q + 1, r + 1],  // SE (right-below)
      [q + 1, r],      // E  (right-same-row)
      [q,     r - 1],  // N  (above)
      [q - 1, r],      // W  (left-same-row)
      [q - 1, r + 1],  // SW (left-below)
      [q,     r + 1],  // S  (below)
    ];
  }
}
```

Rename the export from `getAxialNeighbors` to `getOffsetNeighbors` throughout. Update all import sites: `hexUtils.ts`, `WorldGenerator.ts`, `SimulationEngine.ts` (any place that calls `getAxialNeighbors`).

**`hexDistance(q1, r1, q2, r2)`** must convert from even-q offset to cube coordinates first:

```typescript
export function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  // Convert even-q offset → cube coordinates
  function toCube(q: number, r: number): [number, number, number] {
    const x = q;
    const z = r - (q - (q & 1)) / 2;
    const y = -x - z;
    return [x, y, z];
  }
  const [x1, y1, z1] = toCube(q1, r1);
  const [x2, y2, z2] = toCube(q2, r2);
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}
```

**`bfsReachableCoastal`** and **`bfsConnectedComponents`** do NOT change — they operate on pre-computed `allNeighborIndices` arrays and are topology-agnostic.

**`tileIndex(q, r, width)`** does NOT change — it remains `r * width + q` (tile at column q, row r).

#### `src/renderer/HexRenderer.ts` — `tileCenter()`

```typescript
private tileCenter(q: number, r: number): [number, number] {
  return [
    HEX_SIZE * (3 / 2) * q,
    HEX_SIZE * Math.sqrt(3) * r + (q % 2 !== 0 ? HEX_SIZE * Math.sqrt(3) / 2 : 0),
  ];
}
```

#### `src/ui/mapbuilder/MapBuilderRenderer.ts` — `tileCenter()`

Same formula as above (copy exactly). The map builder and simulation renderer must use identical coordinate mappings so pan/zoom levels are consistent when switching modes.

#### `src/simulation/WorldGenerator.ts`

Update all calls from `getAxialNeighbors(...)` → `getOffsetNeighbors(...)`. No other change required — the neighbor pre-computation in Step 8 uses the function directly.

### Breaking Change Notice
Changing from axial to even-q offset neighbors alters which tiles are considered adjacent. This changes state expansion paths, conquest routes, and coastal reach. **Existing simulation seeds will produce different world shapes and game outcomes.** This is intentional — the rectangular grid is a better visual foundation. Seeds are not guaranteed stable across this version boundary.

### Vertex Drawing (no change)
The `hexVertices(cx, cy, size)` function uses `angle = 60° * k` for flat-top hexagons. This remains correct with even-q offset rendering — the hex SHAPE is unchanged; only the center positions shift. The `allNeighborIndices[k]` ↔ vertex-k edge correspondence also remains correct because `getOffsetNeighbors` returns neighbors in the same 6-position order (and the vertex formula independently draws 6 edges).

---

## Feature 3 (v3): Left-Drag Pan + Hover State Highlight

### 3a. Left-Drag Pan (Simulation Canvas)

**Problem**: v2 specifies middle/right-button only for pan. The user wants left-click-and-drag to also pan, which is more intuitive on trackpads and mice without middle buttons.

**Disambiguation rule**: A "click" is a `mousedown → mouseup` with `< 5px` total displacement. A "drag" is a `mousedown → mousemove (≥5px)` sequence. Only a confirmed click fires state-selection logic; a confirmed drag fires pan logic.

**Implementation in `src/ui/MapCanvas.tsx`**:

```typescript
const dragStartPos = useRef<{ x: number; y: number } | null>(null);
const hasDragged = useRef(false);
const DRAG_THRESHOLD = 5; // px

// onMouseDown (left button = e.button === 0)
dragStartPos.current = { x: e.clientX, y: e.clientY };
hasDragged.current = false;
// (keep existing middle/right-button check for isPanning.current)

// onMouseMove
if (dragStartPos.current !== null) {
  const dx = e.clientX - dragStartPos.current.x;
  const dy = e.clientY - dragStartPos.current.y;
  if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
    hasDragged.current = true;
  }
}
if (hasDragged.current || isPanning.current) {
  // panning: always use movementX/Y
  rendererRef.current?.panBy(e.movementX, e.movementY);
  if (!isNavigating) setIsNavigating(true);
  return; // skip hover logic while panning
}
// existing hover tile logic

// onMouseUp (left button)
if (!hasDragged.current) {
  // confirmed click — run selection logic
  const idx = rendererRef.current?.getTileAtPixel(x, y) ?? null;
  if (idx !== null) {
    const stateId = simState?.ownership[idx] ?? -1;
    setUIState(prev => ({ ...prev, selectedStateId: stateId >= 0 ? stateId : null }));
  }
}
dragStartPos.current = null;
hasDragged.current = false;
setIsNavigating(false);
```

**Remove** the existing `onClick` handler from the canvas JSX (selection is now handled in `onMouseUp`).

**Cursor**:
- Default: `cursor: default` (crosshair was removed in favour of normal cursor since left-drag pans)
- While navigating: `cursor: grabbing`
- Optionally: `cursor: grab` while left button is held but no movement yet (needs `onMouseDown` CSS trigger — implement via `isNavigating` state set immediately on `mousedown`)

**Middle/right-drag** keeps working unchanged as an alternative pan gesture.

**Map Builder canvas**: Left drag continues to PAINT (no change to `MapBuilderCanvas.tsx`). Middle/right drag continues to pan. No change needed.

### 3b. Hover State Highlight

**Problem**: v2 only highlighted the single hovered tile with a dashed outline. The user wants the entire owning state to be highlighted on hover.

**New render pass in `HexRenderer.render()`**: Insert after the political overlay pass (PASS 1b) and before borders (existing PASS 2+):

```
PASS 1c: Hovered state fill overlay
- Compute: hoveredStateId = uiState.hoveredTileIndex !== null
    ? simState.ownership[uiState.hoveredTileIndex]
    : null
- If hoveredStateId >= 0 and state exists in simState.states:
    ctx.save();
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = '#ffffff';
    for (const idx of simState.states.get(hoveredStateId).tileIndices:
      const [cx, cy] = tileCenter(tile.q, tile.r)
      draw filled hex at (cx, cy)
    ctx.restore();
```

**Remove** the existing PASS 7 "hovered tile dashed outline" (replaced by the full state highlight above). The tooltip still uses `uiState.hoveredTileIndex` for per-tile data — this is unchanged.

**Selected state highlight**: Keep the existing bright white outline drawn for `uiState.selectedStateId`. The hover state uses a FILL overlay (soft white wash), while the selected state uses an OUTLINE — these are visually distinct.

### Files Changed
- `src/ui/MapCanvas.tsx` — left-drag pan, drag-threshold click disambiguation, remove `onClick` handler
- `src/renderer/HexRenderer.ts` — PASS 1c hover state fill; remove PASS 7 hovered tile outline

---

## Unchanged Features from v2 (Fully Retained)

The following sections of v2 architecture are **fully in effect and unchanged**:

- **Feature 2 (v2): Sea Conquest Voyage Arc Lines** — all of it: `AnimationController` sea voyage tracking, `SimulationEngine.lastSeaCrossings` with `attackerStateId`, `SimulationContext` calling `markSeaVoyage`, `HexRenderer` PASS 8 arcs with state color
- **Feature 3 (v2): Map Builder Mode** — all tasks 3a through 3h from the v2 launch plan, with the v2 revisions (brush range 0–8, biome legend)  
  - **Note**: `MapBuilderRenderer.tileCenter()` must use even-q offset formula (from Feature 2 v3 above)
- **Feature 4 (v2): Pan/Zoom Navigation** — camera model, `fitToView`, `zoomAt`, `panBy`, `resetView`, wheel zoom — all unchanged. Only the pan GESTURE additions in `MapCanvas.tsx` change (per Feature 3 v3 above)

---

## Interface Contracts (v3 complete)

### `hexUtils.ts`

```typescript
// Renamed from getAxialNeighbors:
export function getOffsetNeighbors(q: number, r: number): [number, number][];

// Updated signature (unchanged interface, updated implementation):
export function hexDistance(q1: number, r1: number, q2: number, r2: number): number;

// Unchanged:
export function tileIndex(q: number, r: number, width: number): number;
export function bfsConnectedComponents(...): number[][];
export function bfsReachableCoastal(...): number[];
```

### `HexRenderer` (v3 additions)

```typescript
// tileCenter now uses even-q offset formula (internal, no API change)
// PASS 1c hover state overlay (internal, no API change)
// PASS 2 borders simplified to two-category system (internal, no API change)
// All public methods unchanged: panBy, zoomAt, resetView, resize, getTileAtPixel, render
```

### `AnimationController` (unchanged from v2)

```typescript
markSeaVoyage(fromIndex: number, toIndex: number, succeeded: boolean, stateColor: string): void;
getActiveSeaVoyages(): ReadonlyArray<{ fromIndex: number; toIndex: number; succeeded: boolean; opacity: number; stateColor: string; }>;
```

### `SimulationEngine` (unchanged from v2)

```typescript
getLastSeaCrossings(): ReadonlyArray<{ from: number; to: number; succeeded: boolean; attackerStateId: number; }>;
```

### `WorldGenerator` (unchanged from v2)

```typescript
static fromCustomMap(tiles: MapBuilderTile[], width: number, height: number): WorldData;
```

### `SimulationContext` (unchanged from v2)

```typescript
loadCustomWorld(worldData: WorldData): void;
```

---

## File Impact Summary (v3 delta from v2)

### Modified vs v2

| File | v3 Change |
|------|-----------|
| `src/simulation/hexUtils.ts` | Rename `getAxialNeighbors` → `getOffsetNeighbors`; column-dependent neighbor offsets; update `hexDistance` to cube conversion |
| `src/simulation/WorldGenerator.ts` | Update import: `getOffsetNeighbors` |
| `src/simulation/SimulationEngine.ts` | Update import: `getOffsetNeighbors` (if directly imported) |
| `src/renderer/HexRenderer.ts` | Even-q offset `tileCenter()`; simplified two-category border pass; add PASS 1c hover state overlay; remove PASS 7 hovered tile outline |
| `src/ui/MapCanvas.tsx` | Left-drag pan + drag-threshold click disambiguation; remove `onClick` from JSX |
| `src/ui/mapbuilder/MapBuilderRenderer.ts` | Even-q offset `tileCenter()` |

### Test Updates Required

| Test File | Change |
|-----------|--------|
| `src/simulation/hexUtils.test.ts` | Rename `getAxialNeighbors` calls → `getOffsetNeighbors`; update expected neighbor values; add `hexDistance` offset-coordinate test |
| `src/renderer/MapModes.test.ts` | Confirm political mode returns terrain color (no state blend) |
| `src/renderer/AnimationController.test.ts` | Update `markSeaVoyage` signatures (add `stateColor` param — from v2) |
| `src/simulation/WorldGenerator.test.ts` | Add `fromCustomMap` test (from v2) |
| `src/ui/mapbuilder/MapBuilderRenderer.test.ts` | New file — brush indices + getTileAtPixel (from v2) |

---

## Implementation Order for @developer

```
1.  src/simulation/hexUtils.ts          — rename + offset neighbors + hexDistance
2.  src/simulation/WorldGenerator.ts    — update import
3.  src/simulation/SimulationEngine.ts  — update import if needed; add lastSeaCrossings (v2)
4.  src/renderer/AnimationController.ts — add sea voyage methods (v2)
5.  src/renderer/HexRenderer.ts         — even-q tileCenter + v3 borders + PASS 1c hover + PASS 8 arcs (v2)
6.  src/SimulationContext.tsx           — add loadCustomWorld + markSeaVoyage call (v2)
7.  src/ui/MapCanvas.tsx                — left-drag pan + drag-threshold + remove onClick
8.  src/types/mapbuilder.ts             — new file (v2)
9.  src/simulation/WorldGenerator.ts    — add fromCustomMap static (v2)
10. src/ui/mapbuilder/MapBuilderRenderer.ts — new file, even-q tileCenter (v2 + v3)
11. src/ui/mapbuilder/MapBuilderContext.tsx — new file (v2)
12. src/ui/mapbuilder/MapBuilderPanel.tsx + .module.css — new files (v2)
13. src/ui/mapbuilder/MapBuilderCanvas.tsx + .module.css — new files (v2)
14. src/App.tsx + src/styles/App.module.css — mode toggle integration (v2)
```

---

## Non-Goals (v3)
- Animated pan/zoom easing
- Pinch-to-zoom / touch events
- Border color customization
- Minimap
- Mobile support for map builder
