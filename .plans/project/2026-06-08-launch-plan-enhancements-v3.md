# Launch Plan: World Simulator Enhancements — v3
- **Date**: 2026-06-08
- **Architecture Reference**: .plans/project/2026-06-08-architecture-enhancements-v3.md
- **Supersedes**: .plans/project/2026-06-08-launch-plan-enhancements-v2.md
- **Feature Fingerprint**: flat-borders-v3 + rectangular-grid + left-drag-pan + hover-state
- **Execution Mode**: sequential (single workstream — all UI/renderer)
- **Total Workstreams**: 1
- **Total Waves**: 1

## Dependency Graph

```
[feature/ui/world-simulator-enhancements]
    Step 1: Coordinate system  (hexUtils + WorldGenerator import)
    Step 2: Sea voyage arcs    (AnimationController + SimulationEngine + SimulationContext)
    Step 3: HexRenderer        (even-q tileCenter + flat borders + hover-state + arcs)
    Step 4: MapCanvas          (left-drag pan + disambiguation)
    Step 5: Map Builder        (types + WorldGenerator.fromCustomMap + all mapbuilder/ files)
    Step 6: App integration    (App.tsx + CSS)
```

All steps on a single branch. Implement in order — later steps depend on earlier ones.

## Execution Schedule

### Wave 1 — UI Enhancements v3 (ui)
- **Branch**: `feature/ui/world-simulator-enhancements`
- **Parallel slots**: 1
- **Workstream**: ui → @frontend-lead
- **Prerequisite**: `main` is current (run `git pull origin main` first)
- **Deliverables**: all features below, all tests passing, `npm run build` exits 0
- **Sync point**: Merge `feature/ui/world-simulator-enhancements` to `main`

---

## Delegation Payload: UI → @frontend-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/project/2026-06-08-architecture-enhancements-v3.md
- **Launch Plan**: .plans/project/2026-06-08-launch-plan-enhancements-v3.md
- **Execution Mode**: sequential
- **Workstream**: ui — Wave 1 of 1
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Confirm you have read the v3 architecture plan, delegation protocol, will follow 7-gate sequence, will present execution plan for approval, and acknowledge Wave 1 of 1.

---

## Workstream: UI Enhancements v3 — @frontend-lead

**Architecture Reference**: `.plans/project/2026-06-08-architecture-enhancements-v3.md`
**Launch Plan Reference**: `.plans/project/2026-06-08-launch-plan-enhancements-v3.md`

### Execution Context
- **Mode**: sequential
- **Wave**: 1 of 1
- **Parallel peers**: none
- **Prerequisites**: `main` is current
- **Branch**: `feature/ui/world-simulator-enhancements`
- **Sync point**: merge to `main` when complete

### Context

The World Simulator is fully functional. This workstream implements four features. v3 supersedes both v1 and v2 plans — use ONLY the v3 architecture. Some tasks are carried forward from v2 unchanged; those are marked **(v2 retained)**.

---

## STEP 1: Hex Coordinate System → Even-Q Offset

### 1a. `src/simulation/hexUtils.ts`

**Rename** `getAxialNeighbors` → `getOffsetNeighbors` everywhere in this file.

**Replace the implementation** with column-dependent even-q offset neighbors:

```typescript
export function getOffsetNeighbors(q: number, r: number): [number, number][] {
  if (q % 2 === 0) {
    return [
      [q + 1, r],
      [q + 1, r - 1],
      [q,     r - 1],
      [q - 1, r - 1],
      [q - 1, r],
      [q,     r + 1],
    ];
  } else {
    return [
      [q + 1, r + 1],
      [q + 1, r],
      [q,     r - 1],
      [q - 1, r],
      [q - 1, r + 1],
      [q,     r + 1],
    ];
  }
}
```

**Replace `hexDistance`** with cube-coordinate conversion:

```typescript
export function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  // Convert even-q offset to cube coordinates
  function toCube(q: number, r: number): [number, number, number] {
    const x = q;
    const z = r - (q - (q & 1)) / 2;
    return [x, -x - z, z];
  }
  const [x1, y1, z1] = toCube(q1, r1);
  const [x2, y2, z2] = toCube(q2, r2);
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}
```

`tileIndex`, `bfsConnectedComponents`, `bfsReachableCoastal` — **no changes**.

### 1b. `src/simulation/WorldGenerator.ts`

Update the import line:
```typescript
// Old:
import { getAxialNeighbors, tileIndex, bfsConnectedComponents, bfsReachableCoastal } from './hexUtils';
// New:
import { getOffsetNeighbors, tileIndex, bfsConnectedComponents, bfsReachableCoastal } from './hexUtils';
```

Rename all call sites from `getAxialNeighbors(...)` → `getOffsetNeighbors(...)`.

### 1c. `src/simulation/hexUtils.test.ts`

- Rename all `getAxialNeighbors` references → `getOffsetNeighbors`
- Update expected neighbor arrays. For even-q: `(0,0)` should have neighbors `(1,0),(1,-1),(0,-1),(-1,-1),(-1,0),(0,1)`. For odd-q: `(1,0)` should have neighbors `(2,1),(2,0),(1,-1),(0,0),(0,1),(1,1)`.
- Add a `hexDistance` test using even-q offset: `hexDistance(0,0, 1,0)` should be `1`; `hexDistance(0,0, 2,0)` should be `2`; `hexDistance(0,0, 1,1)` should be `1` (for even-q=0, odd-q=1 edge case verify).

---

## STEP 2: Sea Voyage Arcs — State Color **(v2 retained, summarized)**

### 2a. `src/simulation/SimulationEngine.ts`

Add private field:
```typescript
private lastSeaCrossings: Array<{ from: number; to: number; succeeded: boolean; attackerStateId: number }> = [];
```

At the start of `step()`: `this.lastSeaCrossings = [];`

In conflict resolution, for each conflict where `isSeaCrossing === true`:
```typescript
this.lastSeaCrossings.push({
  from: conflict.attackerTileIndex,
  to: conflict.targetTileIndex,
  succeeded: conflict.outcome === 'attacker_wins',
  attackerStateId: conflict.attackerStateId,
});
```

Add:
```typescript
getLastSeaCrossings(): ReadonlyArray<{ from: number; to: number; succeeded: boolean; attackerStateId: number }> {
  return this.lastSeaCrossings;
}
```

### 2b. `src/renderer/AnimationController.ts`

Add private interface:
```typescript
interface SeaVoyageAnimation {
  fromIndex: number;
  toIndex: number;
  succeeded: boolean;
  remaining: number;
  total: number;
  stateColor: string;
}
```

Add private field: `private seaVoyages = new Map<string, SeaVoyageAnimation>();`
Key: `` `${fromIndex}_${toIndex}` ``

Add methods:
```typescript
markSeaVoyage(fromIndex: number, toIndex: number, succeeded: boolean, stateColor: string): void {
  const key = `${fromIndex}_${toIndex}`;
  this.seaVoyages.set(key, { fromIndex, toIndex, succeeded, remaining: 2000, total: 2000, stateColor });
}

getActiveSeaVoyages(): ReadonlyArray<{ fromIndex: number; toIndex: number; succeeded: boolean; opacity: number; stateColor: string }> {
  const result = [];
  for (const v of this.seaVoyages.values()) {
    result.push({ fromIndex: v.fromIndex, toIndex: v.toIndex, succeeded: v.succeeded, opacity: v.remaining / v.total, stateColor: v.stateColor });
  }
  return result;
}
```

Update `tick(deltaMs)` to also decrement `seaVoyages` timers and delete expired ones.

### 2c. `src/renderer/AnimationController.test.ts`

Add `describe('markSeaVoyage', ...)` block:
```typescript
it('creates active voyage with opacity 1.0 immediately', () => {
  const c = new AnimationController();
  c.markSeaVoyage(0, 1, true, '#ff0000');
  expect(c.getActiveSeaVoyages()[0].opacity).toBe(1.0);
});
it('returns stateColor matching input', () => {
  const c = new AnimationController();
  c.markSeaVoyage(0, 1, true, '#ff0000');
  expect(c.getActiveSeaVoyages()[0].stateColor).toBe('#ff0000');
});
it('fades to 0 after 2000ms tick', () => {
  const c = new AnimationController();
  c.markSeaVoyage(0, 1, true, '#ff0000');
  c.tick(2000);
  expect(c.getActiveSeaVoyages().length).toBe(0);
});
it('overwriting same from/to pair resets timer', () => {
  const c = new AnimationController();
  c.markSeaVoyage(0, 1, true, '#ff0000');
  c.tick(1500);
  c.markSeaVoyage(0, 1, false, '#00ff00');
  expect(c.getActiveSeaVoyages()[0].opacity).toBe(1.0);
});
it('tick reduces opacity proportionally', () => {
  const c = new AnimationController();
  c.markSeaVoyage(0, 1, true, '#aabbcc');
  c.tick(1000);
  expect(c.getActiveSeaVoyages()[0].opacity).toBeCloseTo(0.5);
});
```

### 2d. `src/SimulationContext.tsx`

In `doStep()`, after `engineRef.current.step()`, after the existing conquest/secession animation loop, add:
```typescript
const currentState = engineRef.current.getState();
for (const crossing of engineRef.current.getLastSeaCrossings()) {
  const stateColor = currentState.states.get(crossing.attackerStateId)?.color ?? '#ffffff';
  animControllerRef.current.markSeaVoyage(crossing.from, crossing.to, crossing.succeeded, stateColor);
}
```

Also add `loadCustomWorld` method (see Step 5h).

---

## STEP 3: HexRenderer Overhaul

### 3a. `src/renderer/MapModes.ts`

In `getTileColor`, change the `'political'` case to return terrain color (no state blend):
```typescript
case 'political':
  color = terrainColor;
  break;
```

Remove the `showPoliticalOverlay` param from `getTileColor` signature if it was added; the function should only take `(tile, mode, stateColor)` or just `(tile, mode)`.

### 3b. `src/renderer/HexRenderer.ts` — Complete render() overhaul

The render method must implement passes in this exact order:

**PASS 0: Background**
```typescript
ctx.clearRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#0f1117';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.save();
ctx.setTransform(camera.scale, 0, 0, camera.scale, camera.x, camera.y);
```

**PASS 1: Terrain fill**
For every tile: fill hex with `getTileColor(tile, uiState.mapMode, null)`. Ocean tiles use `#1a3a5c`. Pass the animation controller to `getTileColor` for flash effects OR apply flash in a separate pass — see PASS 5 for animations.

**PASS 1b: Political overlay** (only when `uiState.mapMode === 'political'`)
For every non-ocean tile with an assigned state: fill hex with `rgba(r,g,b,0.42)` using state color.

**PASS 1c: Hovered state overlay**
```typescript
const hoveredStateId = uiState.hoveredTileIndex !== null
  ? simState.ownership[uiState.hoveredTileIndex]
  : null;
if (hoveredStateId !== null && hoveredStateId >= 0) {
  const hState = simState.states.get(hoveredStateId);
  if (hState) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (const idx of hState.tileIndices) {
      const tile = tiles[idx];
      const [cx, cy] = this.tileCenter(tile.q, tile.r);
      const verts = hexVertices(cx, cy, HEX_SIZE - 0.5);
      ctx.beginPath();
      ctx.moveTo(verts[0][0], verts[0][1]);
      for (let i = 1; i < 6; i++) ctx.lineTo(verts[i][0], verts[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
```

**PASS 2: Borders (v3 two-category flat system)**

Collect edges:
```typescript
const greyEdges: Array<{ v1: [number,number]; v2: [number,number] }> = [];
const blackEdges: Array<{ v1: [number,number]; v2: [number,number] }> = [];

for (const tile of tiles) {
  const stateId = simState.ownership[tile.index];
  const [cx, cy] = this.tileCenter(tile.q, tile.r);
  const verts = hexVertices(cx, cy, HEX_SIZE - 0.5);
  for (let k = 0; k < 6; k++) {
    const neighborIdx = tile.allNeighborIndices[k];
    if (neighborIdx === undefined || neighborIdx < 0) continue;
    if (tile.index >= neighborIdx) continue; // dedup: only lower-index tile processes each edge
    const neighborState = simState.ownership[neighborIdx];
    const v1 = verts[k];
    const v2 = verts[(k + 1) % 6];
    if (tile.terrain !== 'ocean' && tiles[neighborIdx].terrain !== 'ocean' && stateId !== neighborState) {
      blackEdges.push({ v1, v2 });
    } else {
      greyEdges.push({ v1, v2 });
    }
  }
}

// Draw grey first (background grid)
ctx.lineWidth = 0.5;
ctx.strokeStyle = 'rgba(180,180,180,0.20)';
ctx.beginPath();
for (const { v1, v2 } of greyEdges) { ctx.moveTo(v1[0], v1[1]); ctx.lineTo(v2[0], v2[1]); }
ctx.stroke();

// Draw black on top (state borders)
ctx.lineWidth = 1.5;
ctx.strokeStyle = 'rgba(0,0,0,0.88)';
ctx.beginPath();
for (const { v1, v2 } of blackEdges) { ctx.moveTo(v1[0], v1[1]); ctx.lineTo(v2[0], v2[1]); }
ctx.stroke();
```

**PASS 3: State labels** *(unchanged from current code)*

**PASS 4: State name centroid labels** *(unchanged from current code)*

**PASS 5: Flash animations** (conquest/secession border flash) *(unchanged from current code)*

**PASS 6: Selected state outline** *(unchanged from current code)*

**PASS 7: Hovered tile indicator** — REPLACE the dashed outline with a small filled circle at the tile center:
```typescript
if (uiState.hoveredTileIndex !== null) {
  const tile = tiles[uiState.hoveredTileIndex];
  if (tile) {
    const [cx, cy] = this.tileCenter(tile.q, tile.r);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.70)';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
```

**PASS 8: Sea voyage arcs** *(from v2, unchanged)*

**Close transform:**
```typescript
ctx.restore();
```

### 3c. Update `tileCenter()` in `HexRenderer.ts`

```typescript
private tileCenter(q: number, r: number): [number, number] {
  return [
    HEX_SIZE * (3 / 2) * q,
    HEX_SIZE * Math.sqrt(3) * r + (q % 2 !== 0 ? HEX_SIZE * Math.sqrt(3) / 2 : 0),
  ];
}
```

---

## STEP 4: MapCanvas — Left-Drag Pan + Disambiguation

### `src/ui/MapCanvas.tsx`

Add refs:
```typescript
const dragStartPos = useRef<{ x: number; y: number } | null>(null);
const hasDragged = useRef(false);
const DRAG_THRESHOLD = 5;
```

Update `onMouseDown` (keep existing `isPanning.current` for middle/right):
```typescript
onMouseDown={(e) => {
  if (e.button === 0) {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    hasDragged.current = false;
    setIsNavigating(true); // immediate cursor feedback
  }
  if (e.button === 1 || e.button === 2) {
    isPanning.current = true;
    setIsNavigating(true);
    e.preventDefault();
  }
}}
```

Update `handleMouseMove`:
```typescript
const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
  // Left-drag pan
  if (dragStartPos.current !== null) {
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      hasDragged.current = true;
    }
  }
  if (hasDragged.current || isPanning.current) {
    rendererRef.current?.panBy(e.movementX, e.movementY);
    return;
  }
  // Hover logic
  if (!rendererRef.current || !canvasRef.current) return;
  const rect = canvasRef.current.getBoundingClientRect();
  const idx = rendererRef.current.getTileAtPixel(e.clientX - rect.left, e.clientY - rect.top);
  setUIState(prev => ({ ...prev, hoveredTileIndex: idx }));
}, [setUIState]);
```

Add `onMouseUp` handler:
```typescript
onMouseUp={(e) => {
  if (e.button === 0) {
    if (!hasDragged.current && dragStartPos.current !== null && canvasRef.current && rendererRef.current && simState) {
      // Confirmed click — select state
      const rect = canvasRef.current.getBoundingClientRect();
      const idx = rendererRef.current.getTileAtPixel(e.clientX - rect.left, e.clientY - rect.top);
      if (idx !== null) {
        const stateId = simState.ownership[idx];
        setUIState(prev => ({ ...prev, selectedStateId: stateId >= 0 ? stateId : null }));
      }
    }
    dragStartPos.current = null;
    hasDragged.current = false;
    setIsNavigating(false);
  }
  if (e.button === 1 || e.button === 2) {
    isPanning.current = false;
    setIsNavigating(false);
  }
}}
```

**Remove** the existing `handleClick` / `onClick` handler from the JSX (selection now in `onMouseUp`).

Update `handleMouseLeave`:
```typescript
const handleMouseLeave = useCallback(() => {
  isPanning.current = false;
  dragStartPos.current = null;
  hasDragged.current = false;
  setIsNavigating(false);
  setUIState(prev => ({ ...prev, hoveredTileIndex: null }));
}, [setUIState]);
```

### `src/ui/MapCanvas.module.css`

Update `.canvas`:
```css
.canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: default;
}
.navigating {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grabbing;
}
```

---

## STEP 5: Map Builder **(largely v2 retained)**

### 5a. `src/types/mapbuilder.ts` **(v2 unchanged)**

```typescript
import type { TerrainType } from './world';

export type MapBuilderTool = 'paint-land' | 'paint-ocean' | 'paint-biome' | 'paint-productivity';

export interface MapBuilderTile {
  index: number;
  q: number;
  r: number;
  terrain: TerrainType;
  productivityOverride: number | null;
}

export interface MapBuilderState {
  tiles: MapBuilderTile[];
  width: number;
  height: number;
  tool: MapBuilderTool;
  brushSize: number;            // 0–8; 0 = single hex
  selectedBiome: TerrainType;
  productivityValue: number;
  randomEnabled: boolean;
  name: string;
  isDirty: boolean;
}

export interface SavedCustomMap {
  version: 1;
  name: string;
  savedAt: string;
  width: number;
  height: number;
  tiles: Array<{ index: number; terrain: TerrainType; productivityOverride: number | null }>;
}
```

### 5b. `src/simulation/WorldGenerator.ts` — `fromCustomMap` **(v2 unchanged)**

Add static method `WorldGenerator.fromCustomMap(tiles: MapBuilderTile[], width: number, height: number): WorldData`:

1. Build `HexTile[]` from input. Productivity defaults (use `productivityOverride` if non-null, else midpoints):
   - river_valley: 0.925, plains: 0.70, forest: 0.525, hills: 0.40, tundra: 0.175, mountains: 0.15, desert: 0.15, ocean: 0.0
2. Obstacle defaults (midpoints):
   - plains: 0.10, river_valley: 0.10, forest: 0.275, hills: 0.375, tundra: 0.50, desert: 0.50, mountains: 0.75, ocean: 1.0
3. Compute `allNeighborIndices` using `getOffsetNeighbors(q, r)` (NOT `getAxialNeighbors`) — this is the v3 name
4. Compute `landNeighborIndices` (filter non-ocean)
5. Mark `isCoastal`
6. BFS `coastalReachIndices` with radius 4
7. Flood-fill continents with `bfsConnectedComponents`
8. Return `WorldData`

Add test in `src/simulation/WorldGenerator.test.ts`:
```typescript
it('fromCustomMap: all-plains 10x10 has totalLandTiles=100', () => {
  const tiles = Array.from({ length: 100 }, (_, i) => ({
    index: i, q: i % 10, r: Math.floor(i / 10), terrain: 'plains' as const, productivityOverride: null,
  }));
  const world = WorldGenerator.fromCustomMap(tiles, 10, 10);
  expect(world.totalLandTiles).toBe(100);
  expect(world.tiles.length).toBe(100);
});
```

### 5c. `src/ui/mapbuilder/MapBuilderRenderer.ts` **(v2 + v3 tileCenter)**

Implement `MapBuilderRenderer` with camera model (identical to `HexRenderer`). Key differences from `HexRenderer`:
- Render input is `MapBuilderTile[]` not `SimState`
- Passes: (1) clear, (2) terrain fill, (3) grey grid lines `rgba(255,255,255,0.07)` at `lineWidth=0.5`, (4) brush preview overlay, (5) hovered tile indicator

**`tileCenter(q, r)`** must use the **even-q offset formula** (same as `HexRenderer`):
```typescript
private tileCenter(q: number, r: number): [number, number] {
  return [
    HEX_SIZE * (3 / 2) * q,
    HEX_SIZE * Math.sqrt(3) * r + (q % 2 !== 0 ? HEX_SIZE * Math.sqrt(3) / 2 : 0),
  ];
}
```

`getBrushTileIndices(centerIndex, brushSize)`: BFS flood from center using `allNeighborIndices`. Pre-compute a neighbor lookup (`Map<number, number[]>`) during constructor. At `brushSize = 0` return `new Set([centerIndex])`.

Store tiles in constructor for `fitToView` and center lookup.

### 5d. `src/ui/mapbuilder/MapBuilderRenderer.test.ts` **(v2)**

```typescript
// Mock canvas context
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MapBuilderRenderer', () => {
  it('getBrushTileIndices size=0 returns only center', () => { ... });
  it('getBrushTileIndices size=1 returns center + neighbors', () => { ... });
  it('getTileAtPixel returns null for distant coordinates', () => { ... });
});
```

### 5e. `src/ui/mapbuilder/MapBuilderContext.tsx` **(v2)**

React context with `MapBuilderState`. Key:
- Initial state: 80×50 all-ocean grid
- `applyBrush(centerIdx)`: apply tool to brush tiles; with `randomEnabled`, 70% chance → selectedBiome, 30% → random land biome
- `generateRandomContinents()`: 2–4 blobs using `mulberry32(Math.floor(Math.random() * 999999))`, latitude-based terrain
- `saveMap()` / `loadMap(json)`: JSON download/restore
- Undo/redo: 50-step history stack via tile-array snapshots
- `convertToWorldData()`: call `WorldGenerator.fromCustomMap(...)`

### 5f. `src/ui/mapbuilder/MapBuilderPanel.tsx` + `.module.css` **(v2 + biome legend)**

Left sidebar (~280px). Sections as specified in v2 launch plan plus:

**Biome Legend** (read-only, below biome swatches):
```tsx
const BIOME_LEGEND = [
  { terrain: 'river_valley', label: 'River Valley', hint: '~0.93' },
  { terrain: 'plains',       label: 'Plains',       hint: '~0.70' },
  { terrain: 'forest',       label: 'Forest',       hint: '~0.53' },
  { terrain: 'hills',        label: 'Hills',        hint: '~0.40' },
  { terrain: 'desert',       label: 'Desert',       hint: '~0.15' },
  { terrain: 'tundra',       label: 'Tundra',       hint: '~0.18' },
  { terrain: 'mountains',    label: 'Mountains',    hint: '~0.15' },
  { terrain: 'ocean',        label: 'Ocean',        hint: 'impassable' },
] as const;
```

Each row: 16×16px color swatch + label + productivity hint (muted). Import `TERRAIN_COLORS` from `../../renderer/MapModes`.

**Brush Size label**: `brushSize === 0 ? 'Brush: Single hex' : brushSize === 1 ? 'Brush: 1 (ring)' : \`Brush: ${brushSize}\``

**Brush slider**: `min={0} max={8}`

All other sections as per v2 launch plan (tools, file save/load, undo/redo, run simulation button).

### 5g. `src/ui/mapbuilder/MapBuilderCanvas.tsx` + `.module.css` **(v2)**

Canvas host. Left click/drag = paint (unchanged). Middle/right drag = pan. Wheel = zoom.

**Keyboard handlers on window** (add `keydown` listener in `useEffect`):
- `Ctrl+Z`: `context.undo()`
- `Ctrl+Shift+Z` or `Ctrl+Y`: `context.redo()`
- `[`: decrease brush size by 1 (min 0)
- `]`: increase brush size by 1 (max 8)
- `R`: `renderer.resetView(canvas.offsetWidth, canvas.offsetHeight)`

RAF loop for continuous brush-preview re-render.

### 5h. `src/SimulationContext.tsx` — `loadCustomWorld` **(v2)**

```typescript
const loadCustomWorld = useCallback((worldData: WorldData) => {
  const engine = new SimulationEngine(worldData, settingsRef.current);
  engine.initialize();
  engineRef.current = engine;
  animControllerRef.current = new AnimationController();
  setWorld(worldData);
  setSimState(engine.getState());
  setUIState(prev => ({ ...prev, isPlaying: false, chartHistory: [], selectedStateId: null }));
}, []);
```

Add to `SimContextValue` interface and return value.

---

## STEP 6: App Integration

### 6a. `src/App.tsx` **(v2)**

Add `appMode: 'simulate' | 'build'` state. Top bar toggle button. When switching `'build'` → `'simulate'`: call `mapBuilderCtx.convertToWorldData()` → `simCtx.loadCustomWorld(worldData)`.

```tsx
{appMode === 'simulate' ? (
  <div className={styles.main}>
    <ControlPanel />
    <MapCanvas />
    <div className={styles.rightColumn}>...</div>
  </div>
) : (
  <MapBuilderProvider>
    <MapBuilderInner onRunSimulation={handleRunSimulation} />
  </MapBuilderProvider>
)}
```

Where `MapBuilderInner` is a small local component that calls `useMapBuilder()` to get the context for the `onRunSimulation` callback, then renders:
```tsx
<div className={styles.builderMain}>
  <MapBuilderPanel onRunSimulation={...} />
  <MapBuilderCanvas />
</div>
```

### 6b. `src/styles/App.module.css` **(v2)**

Add:
```css
.builderMain {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.modeToggleBtn {
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.15s, border-color 0.15s;
}
.modeToggleBtn:hover, .modeToggleBtn:focus-visible {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}
```

---

## Tests Summary for @tester

1. `src/simulation/hexUtils.test.ts` — rename + new neighbor values + hexDistance offset test
2. `src/renderer/AnimationController.test.ts` — new `markSeaVoyage` tests with `stateColor`
3. `src/renderer/MapModes.test.ts` — political mode returns terrain color
4. `src/simulation/WorldGenerator.test.ts` — `fromCustomMap` all-plains test
5. `src/ui/mapbuilder/MapBuilderRenderer.test.ts` — brush indices + getTileAtPixel tests
6. `npm run build` exits 0
7. `npm test` all suites pass

---

## Acceptance Criteria (v3 complete)

1. State borders are **solid thin black** where territories meet, **faint grey** everywhere else; uniform thickness; no multi-pass shadow
2. The hex grid fills a **rectangular** screen area — no diagonal empty corners; (0,0) is top-left, (79,0) is top-right at same height
3. **Left-click-drag** pans the simulation map; a click without significant movement (< 5px) still selects the state under the cursor
4. **Hovering** over any cell highlights the entire owning state with a soft white wash; tooltip still shows per-tile data
5. Sea voyage arcs appear in the attacking state's color; gold/blue removed
6. Canvas initially fits the entire map with 5% padding; scroll-wheel zooms; middle/right drag also pans
7. Map Builder mode accessible via header button; all paint tools work; biome legend visible
8. Save/load map round-trips correctly; Run Simulation builds on custom map
9. Undo/redo works in map builder; keyboard shortcuts functional
10. `npm run build` exits 0; `npm test` all pass

---

## Out of Scope (v3)
- Touch / pinch-to-zoom
- Minimap
- Animated pan/zoom easing
- Border color customization by user
- Mobile map builder support
```

---

## Reproducibility Checksum
- **Architecture Hash**: 2026-06-08-v3
- **Plan Version**: 3
- **Supersedes**: 2026-06-08-launch-plan-enhancements-v2.md (v2)
