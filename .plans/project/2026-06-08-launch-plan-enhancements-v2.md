# Launch Plan: World Simulator Enhancements — v2
- **Date**: 2026-06-08
- **Architecture Reference**: .plans/project/2026-06-08-architecture-enhancements-v2.md
- **Supersedes**: .plans/project/2026-06-08-launch-plan-enhancements.md
- **Prior Plan Reference**: .plans/project/2026-06-07-202651-launch-plan-world-simulator.md
- **Feature Fingerprint**: bold-borders-v2 + sea-voyage-lines-v2 + map-builder-v2 + pan-zoom
- **Execution Mode**: sequential (single workstream — all UI/renderer)
- **Total Workstreams**: 1
- **Total Waves**: 1

## Dependency Graph

```
[feature/ui/world-simulator-enhancements]
    Feature 1 (revised): Political Overlay Borders  (MapModes + HexRenderer)
    Feature 2 (revised): Sea Voyage Arcs — State Color  (AnimationController + SimulationEngine + SimulationContext + HexRenderer)
    Feature 3 (revised): Map Builder  (types + WorldGenerator + mapbuilder/* components)
    Feature 4 (new):     Pan/Zoom Navigation  (HexRenderer + MapBuilderRenderer + MapCanvas + MapBuilderCanvas)
```

Features 1 and 2 modify the renderer. Feature 3 adds new components. Feature 4 is threaded through both the simulation renderer and the map builder renderer. Implement in the order listed in the architecture doc (types → data → renderer → UI).

## Execution Schedule

### Wave 1 — UI Enhancements (ui)
- **Branch**: `feature/ui/world-simulator-enhancements`
- **Parallel slots**: 1
- **Workstream**: ui → @frontend-lead [session #1]
- **Prerequisite**: `main` is current (run `git pull origin main` first)
- **Deliverables**:
  - Political overlay: terrain visible through semi-transparent state tints; bold cross-state colored borders; subtle same-state hex grid
  - Sea voyage arcs colored with attacking state's color
  - Full-screen canvas with scroll-to-zoom and middle/right-drag pan — both simulation and map builder
  - Map builder with brush range 0–8 (single hex mode) and biome legend
  - Complete Map Builder mode with all paint tools, biome selector, random continents, save/load
  - All tests passing
- **Sync point**: Merge `feature/ui/world-simulator-enhancements` to `main`

---

## Delegation Payload: UI → @frontend-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/project/2026-06-08-architecture-enhancements-v2.md
- **Launch Plan**: .plans/project/2026-06-08-launch-plan-enhancements-v2.md
- **Execution Mode**: sequential
- **Workstream**: ui — Wave 1 of 1
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Confirm you have read the v2 architecture plan, delegation protocol, will follow 7-gate sequence, will present execution plan for approval, and acknowledge Wave 1 of 1 position.

---

## Workstream: UI Enhancements v2 — @frontend-lead

**Architecture Reference**: `.plans/project/2026-06-08-architecture-enhancements-v2.md`
**Launch Plan Reference**: `.plans/project/2026-06-08-launch-plan-enhancements-v2.md`

### Execution Context
- **Mode**: sequential
- **Wave**: 1 of 1
- **Parallel peers**: none
- **Prerequisites**: `main` is current
- **Branch**: `feature/ui/world-simulator-enhancements`
- **Sync point**: Final wave — merge to `main` to complete enhancements

### Context
The World Simulator is fully functional. This workstream adds four enhancements:
1. Revised political state borders (terrain visible under transparent state overlay; cross-state bold colored borders; same-state thin grid)
2. Sea voyage arcs use the attacking state's color
3. Full-screen canvas with pan/zoom navigation for both simulation and map builder canvases
4. Map Builder mode (brush range 0–8 with single-hex mode; biome legend; all paint tools; save/load)

All implementation details, interface contracts, and the exact task ordering for @developer are fully specified in the v2 architecture document. **Read it in full before drafting the execution plan.**

---

### Feature 1 (Revised): Political State Borders

**Files**: `src/renderer/MapModes.ts`, `src/renderer/HexRenderer.ts`

#### MapModes.ts change
Remove the blended political color from `getTileColor`. In political mode, `getTileColor` should return the terrain color only — the political overlay is drawn as a separate pass in `HexRenderer`.

Current code in `getTileColor`:
```typescript
case 'political':
  color = stateColor ? blendColors(terrainColor, stateColor, 0.6) : terrainColor;
  break;
```
Replace with:
```typescript
case 'political':
  color = terrainColor;
  break;
```

#### HexRenderer.ts changes

After the tile fill pass (filled hexagons), add a **political overlay pass** (only when `uiState.mapMode === 'political'`):
```typescript
// PASS 1b: Political overlay (semi-transparent state tint)
if (uiState.mapMode === 'political') {
  for (const tile of tiles) {
    if (tile.terrain === 'ocean') continue;
    const stateId = simState.ownership[tile.index];
    if (stateId < 0) continue;
    const state = simState.states.get(stateId);
    if (!state) continue;
    const [r, g, b] = hexToRgb(state.color);
    const [cx, cy] = this.tileCenter(tile.q, tile.r);
    ctx.beginPath();
    const verts = hexVertices(cx, cy, HEX_SIZE - 0.5);
    ctx.moveTo(verts[0][0], verts[0][1]);
    for (let i = 1; i < 6; i++) ctx.lineTo(verts[i][0], verts[i][1]);
    ctx.closePath();
    ctx.fillStyle = `rgba(${r},${g},${b},0.42)`;
    ctx.fill();
  }
}
```

You will need a private `hexToRgb(hex: string): [number, number, number]` helper in `HexRenderer` (copy from `MapModes.ts`).

Replace the existing border collection + rendering logic with **three tiers**:

**Tier 0 — same-state hex grid (political mode only)**:
- Collect ALL shared land-land edges (after deduplication by tile index)
- Draw in a single pass: `lineWidth = 0.8`, `strokeStyle = 'rgba(255,255,255,0.12)'`
- Only when `uiState.mapMode === 'political'`

**Tier 1 — cross-state borders**:
- Collect cross-state land-land edges (different `ownership` values)
- For **Pass A**: `lineWidth = 3.5`, `strokeStyle = 'rgba(0,0,0,0.80)'`
- For **Pass B**: `lineWidth = 2.0`, strokeStyle = the lower-index tile's state color at full alpha
- In non-political modes, Pass B uses `'rgba(255,255,255,0.95)'` instead of state color

**Tier 2 — coastlines**:
- Unchanged: `rgba(20,60,100,0.9)`, `lineWidth = 2`

**Acceptance**: in political mode, you can still read terrain shapes beneath the color wash; state boundaries pop as bold colored edges; hexes within the same territory show only a faint hex mesh.

---

### Feature 2 (Revised): Sea Voyage Arc Lines

**Files**: `src/simulation/SimulationEngine.ts`, `src/SimulationContext.tsx`, `src/renderer/AnimationController.ts`, `src/renderer/AnimationController.test.ts`, `src/renderer/HexRenderer.ts`

#### SimulationEngine.ts

Change `lastSeaCrossings` element type to include `attackerStateId`:
```typescript
private lastSeaCrossings: Array<{ from: number; to: number; succeeded: boolean; attackerStateId: number }> = [];
```

In the conflict loop push:
```typescript
this.lastSeaCrossings.push({
  from: conflict.attackerTileIndex,
  to: conflict.targetTileIndex,
  succeeded: conflict.outcome === 'attacker_wins',
  attackerStateId: conflict.attackerStateId,  // ← add this
});
```

Update `getLastSeaCrossings()` return type accordingly.

#### SimulationContext.tsx

In `doStep()`:
```typescript
const currentState = engineRef.current.getState();
for (const crossing of engineRef.current.getLastSeaCrossings()) {
  const stateColor = currentState.states.get(crossing.attackerStateId)?.color ?? '#ffffff';
  animControllerRef.current.markSeaVoyage(crossing.from, crossing.to, crossing.succeeded, stateColor);
}
```

#### AnimationController.ts

Update `SeaVoyageAnimation` interface:
```typescript
interface SeaVoyageAnimation {
  fromIndex: number;
  toIndex: number;
  succeeded: boolean;
  remaining: number;
  total: number;
  stateColor: string;  // ← new
}
```

Update `markSeaVoyage` signature:
```typescript
markSeaVoyage(fromIndex: number, toIndex: number, succeeded: boolean, stateColor: string): void
```

Update `getActiveSeaVoyages()` to return `stateColor` in each entry.

#### AnimationController.test.ts

Update all `markSeaVoyage` call sites to pass a `stateColor` string (e.g., `'#ff0000'`). Add assertions that `getActiveSeaVoyages()[0].stateColor === '#ff0000'`.

#### HexRenderer.ts — PASS 8

Replace:
```typescript
const color = voyage.succeeded
  ? `rgba(255, 215, 0, ${voyage.opacity})`
  : `rgba(100, 160, 255, ${voyage.opacity})`;
```
With:
```typescript
const [r, g, b] = hexToRgb(voyage.stateColor);
const color = `rgba(${r},${g},${b},${voyage.opacity})`;
```

---

### Feature 3 (Revised): Map Builder Mode

All components from the v1 launch plan apply with the following revisions:

#### Brush size range: 0–8

In `MapBuilderState` (comment in `src/types/mapbuilder.ts`):
```typescript
brushSize: number;  // 0–8; 0 = single hex, 1–8 = radius in hex-hops
```

In `MapBuilderPanel.tsx`:
```tsx
<input type="range" min={0} max={8} value={brushSize} ... />
// Label:
{brushSize === 0 ? 'Brush: Single hex' : `Brush: ${brushSize}`}
```

#### Biome Legend

Below the biome selector swatch grid in `MapBuilderPanel.tsx`, add a `BiomeLegend` sub-section. Import `TERRAIN_COLORS` from `MapModes.ts`. Render a row for each terrain type (including ocean):

```tsx
// Biome legend (read-only reference)
const BIOME_LEGEND = [
  { terrain: 'river_valley', label: 'River Valley', productivity: '~0.93' },
  { terrain: 'plains',       label: 'Plains',       productivity: '~0.70' },
  { terrain: 'forest',       label: 'Forest',       productivity: '~0.53' },
  { terrain: 'hills',        label: 'Hills',        productivity: '~0.40' },
  { terrain: 'desert',       label: 'Desert',       productivity: '~0.15' },
  { terrain: 'tundra',       label: 'Tundra',       productivity: '~0.18' },
  { terrain: 'mountains',    label: 'Mountains',    productivity: '~0.15' },
  { terrain: 'ocean',        label: 'Ocean',        productivity: 'impassable' },
] as const;
```

Each row: 16×16px color swatch (using `TERRAIN_COLORS[terrain]`) + terrain label (bold) + productivity hint (muted). Add styles in `MapBuilderPanel.module.css`.

All other map builder tasks (3a–3h) from the v1 launch plan remain fully in effect — refer to `.plans/project/2026-06-08-launch-plan-enhancements.md` for the complete task descriptions.

---

### Feature 4 (New): Pan/Zoom Navigation

**Files**: `src/renderer/HexRenderer.ts`, `src/ui/MapCanvas.tsx`, `src/ui/MapCanvas.module.css`, `src/ui/mapbuilder/MapBuilderRenderer.ts`, `src/ui/mapbuilder/MapBuilderCanvas.tsx`

#### HexRenderer.ts — Camera Model

Remove `private offsetX`, `private offsetY`. Add:
```typescript
private camera = { x: 0, y: 0, scale: 1 };
```

Replace `computeOffsets(w, h)` with `private fitToView(w: number, h: number)`:
```typescript
private fitToView(w: number, h: number): void {
  const { tiles } = this.world;
  if (tiles.length === 0) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const tile of tiles) {
    const [wx, wy] = this.tileCenter(tile.q, tile.r);
    if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
  }
  const mapW = maxX - minX + HEX_SIZE * 2;
  const mapH = maxY - minY + HEX_SIZE * 2;
  const scaleX = w / mapW;
  const scaleY = h / mapH;
  this.camera.scale = Math.min(scaleX, scaleY) * 0.95;
  this.camera.x = (w - mapW * this.camera.scale) / 2 - minX * this.camera.scale + HEX_SIZE * this.camera.scale;
  this.camera.y = (h - mapH * this.camera.scale) / 2 - minY * this.camera.scale + HEX_SIZE * this.camera.scale;
}
```

Update `tileCenter` to return pure world coords (no offset):
```typescript
private tileCenter(q: number, r: number): [number, number] {
  return [
    HEX_SIZE * (3 / 2) * q,
    HEX_SIZE * Math.sqrt(3) * (r + q / 2),
  ];
}
```

Wrap render with camera transform:
```typescript
render(...): void {
  const { ctx, canvas } = this;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  ctx.setTransform(this.camera.scale, 0, 0, this.camera.scale, this.camera.x, this.camera.y);
  
  // ... all existing draw passes (tiles, borders, overlays, arcs) ...
  
  ctx.restore();
}
```

Add public methods:
```typescript
panBy(dx: number, dy: number): void {
  this.camera.x += dx;
  this.camera.y += dy;
}

zoomAt(screenX: number, screenY: number, factor: number): void {
  const MIN_ZOOM = 0.2, MAX_ZOOM = 10.0;
  const wx = (screenX - this.camera.x) / this.camera.scale;
  const wy = (screenY - this.camera.y) / this.camera.scale;
  this.camera.scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.camera.scale * factor));
  this.camera.x = screenX - wx * this.camera.scale;
  this.camera.y = screenY - wy * this.camera.scale;
}

resetView(w: number, h: number): void {
  this.fitToView(w, h);
}
```

Update `getTileAtPixel(sx, sy)` to apply inverse camera transform:
```typescript
getTileAtPixel(sx: number, sy: number): number | null {
  const wx = (sx - this.camera.x) / this.camera.scale;
  const wy = (sy - this.camera.y) / this.camera.scale;
  // existing nearest-center search using (wx, wy)
}
```

Update `resize(w, h)` to call `fitToView(w, h)` (refit on resize).

#### MapCanvas.tsx — Navigation Events

```tsx
const isPanning = useRef(false);
const [isNavigating, setIsNavigating] = useState(false);

// Add to canvas element:
onWheel={(e) => {
  if (!rendererRef.current || !canvasRef.current) return;
  e.preventDefault();
  const rect = canvasRef.current.getBoundingClientRect();
  rendererRef.current.zoomAt(
    e.clientX - rect.left,
    e.clientY - rect.top,
    e.deltaY < 0 ? 1.12 : 1 / 1.12
  );
}}

onMouseDown={(e) => {
  if (e.button === 1 || e.button === 2) {
    isPanning.current = true;
    setIsNavigating(true);
    e.preventDefault();
  }
}}

onMouseMove={(e) => {
  if (isPanning.current) {
    rendererRef.current?.panBy(e.movementX, e.movementY);
    return;
  }
  // existing tile hover logic
}}

onMouseUp={(e) => {
  if (e.button === 1 || e.button === 2) {
    isPanning.current = false;
    setIsNavigating(false);
  }
}}

onMouseLeave={() => {
  isPanning.current = false;
  setIsNavigating(false);
  // existing hover clear
}}

onContextMenu={(e) => e.preventDefault()}
```

Add `{ passive: false }` for the wheel listener (use `useEffect` with `addEventListener` since React synthetic onWheel cannot call `preventDefault` in passive mode):
```typescript
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const handler = (e: WheelEvent) => {
    e.preventDefault();
    if (!rendererRef.current) return;
    const rect = canvas.getBoundingClientRect();
    rendererRef.current.zoomAt(
      e.clientX - rect.left,
      e.clientY - rect.top,
      e.deltaY < 0 ? 1.12 : 1 / 1.12
    );
  };
  canvas.addEventListener('wheel', handler, { passive: false });
  return () => canvas.removeEventListener('wheel', handler);
}, []);
```
(Remove `onWheel` from JSX to avoid duplicate.)

Apply cursor class: `className={isNavigating ? styles.navigating : styles.canvas}`

#### MapCanvas.module.css

Add:
```css
.navigating {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grabbing;
}
```

#### MapBuilderRenderer.ts — Camera Model

Apply the identical camera model as `HexRenderer`:
- Private `camera = { x: 0, y: 0, scale: 1 }`
- `fitToView(w, h)` using tile centers from the map builder tile array (stored as `this.tiles`)
- `tileCenter(q, r)` returns pure world coords
- `render()` wraps in `ctx.save() / ctx.setTransform(...) / ctx.restore()`
- `getTileAtPixel` applies inverse transform
- Public `panBy`, `zoomAt`, `resetView`

Constructor change: call `fitToView(w, h)` after storing tiles.

#### MapBuilderCanvas.tsx — Navigation Events

Apply the identical navigation event pattern as `MapCanvas.tsx` additions. Also:
- Add `R` key handler (on `keydown` on window): when `key === 'r' || key === 'R'`: call `renderer.resetView(canvas.offsetWidth, canvas.offsetHeight)`
- On `mouseleave`: clear `isPainting` and `isPanning`

---

### Tests Summary for @tester

**Must verify:**

1. `src/renderer/AnimationController.test.ts`
   - All existing tests pass with updated `markSeaVoyage(from, to, succeeded, stateColor)` signatures
   - New test: `getActiveSeaVoyages()` returns `stateColor` matching what was passed to `markSeaVoyage`

2. `src/renderer/MapModes.test.ts`
   - In political mode, `getTileColor` now returns terrain color (not blended with state color)
   - Confirm existing non-political mode tests still pass

3. `src/simulation/WorldGenerator.test.ts`
   - `fromCustomMap` test: all-plains 10×10 input → `totalLandTiles === 100`

4. `src/ui/mapbuilder/MapBuilderRenderer.test.ts`
   - `getBrushTileIndices(center, 0)` returns a set containing only `center`
   - `getBrushTileIndices(center, 1)` returns center + up to 6 neighbors
   - `getTileAtPixel` returns `null` for coordinates far outside the canvas

5. `npm run build` exits 0 (TypeScript compiles with zero errors)
6. `npm test` all test suites pass

---

### Acceptance Criteria (v2 complete)

1. Political map renders terrain colors beneath a transparent state tint; boundaries are bold colored lines; same-state interior shows only a faint hex mesh
2. Sea voyage arcs match the attacking state's color; fade over ~2 seconds
3. Simulation canvas fills the full viewport rectangle with no diagonal clipping; scroll wheel zooms centered on cursor; middle or right mouse drag pans
4. Map builder canvas has identical pan/zoom behavior; initial view shows the entire 80×50 grid (not a small region)
5. Brush size 0 selects a single hex; slider ranges 0–8; label reads "Single hex" at 0
6. Biome legend is visible below biome swatches showing color + name + productivity for all 8 terrain types
7. Map Builder opens via header button; starts with all-ocean 80×50 grid
8. Paint tools (land, ocean, biome, productivity) work with adjustable brush
9. Random Continents generates plausible landmasses; Clear resets to all-ocean
10. Save Map downloads valid JSON; Load Map restores painted state
11. Run Simulation button switches to simulation mode on the custom map
12. Undo/redo (Ctrl+Z / Ctrl+Shift+Z) works correctly
13. All existing simulation functionality unaffected
14. `npm run build` exits 0; `npm test` all pass

### Out of Scope
- Touch/pinch-to-zoom
- Minimap overview
- Animated pan/zoom easing
- Custom state color picker
- Mobile support for map builder
```

---

## Reproducibility Checksum
- **Architecture Hash**: 2026-06-08-v2 (enhancements with pan/zoom + border/arc revisions)
- **Plan Version**: 2
- **Supersedes**: 2026-06-08-launch-plan-enhancements.md (v1)
