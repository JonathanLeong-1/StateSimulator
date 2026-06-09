# Launch Plan: World Simulator Enhancements
- **Date**: 2026-06-08
- **Architecture Reference**: .plans/project/2026-06-08-architecture-enhancements-v1.md
- **Prior Plan Reference**: .plans/project/2026-06-07-202651-launch-plan-world-simulator.md
- **Feature Fingerprint**: bold-borders + sea-voyage-lines + map-builder
- **Execution Mode**: sequential (single workstream — all UI/renderer)
- **Total Workstreams**: 1
- **Total Waves**: 1

## Dependency Graph

```
[feature/ui/world-simulator-enhancements]
    Feature 1: Bold Borders (HexRenderer)
    Feature 2: Sea Voyage Arcs (AnimationController + HexRenderer + SimulationEngine + SimulationContext)
    Feature 3: Map Builder (new components + WorldGenerator extension + App integration)
```

All three features belong to the UI/renderer workstream. Feature 1 and 2 modify the existing renderer, Feature 3 adds a new mode. They can be implemented sequentially on the same branch in the order listed (1 → 2 → 3) since none conflict.

## Execution Schedule

### Wave 1 — UI Enhancements (ui)
- **Branch**: `feature/ui/world-simulator-enhancements`
- **Parallel slots**: 1
- **Workstream**: ui → @frontend-lead [session #1]
- **Prerequisite**: `main` is current (run `git pull origin main` first)
- **Deliverables**:
  - Bold embossed state borders with two-pass shadow rendering
  - Sea voyage arc animations with arrowheads
  - Complete Map Builder mode with all paint tools, biome selector, random continents, save/load
  - All tests passing
- **Sync point**: Merge `feature/ui/world-simulator-enhancements` to `main`

---

## Delegation Payload: UI → @frontend-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/project/2026-06-08-architecture-enhancements-v1.md
- **Launch Plan**: .plans/project/2026-06-08-launch-plan-enhancements.md
- **Execution Mode**: sequential
- **Workstream**: ui — Wave 1 of 1
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Confirm you have read the architecture plan, delegation protocol, will follow 7-gate sequence, will present execution plan for approval, and acknowledge Wave 1 of 1 position.

---

## Workstream: UI Enhancements — @frontend-lead
**Architecture Reference**: `.plans/project/2026-06-08-architecture-enhancements-v1.md`
**Launch Plan Reference**: `.plans/project/2026-06-08-launch-plan-enhancements.md`

### Execution Context
- **Mode**: sequential
- **Wave**: 1 of 1
- **Parallel peers**: none
- **Prerequisites**: `main` is current (all three prior waves merged)
- **Branch**: `feature/ui/world-simulator-enhancements`
- **Sync point**: Final wave — merge to `main` to complete enhancements

### Context
The World Simulator is fully functional (Waves 1–3 complete). This workstream adds three enhancements to the existing application:
1. Bolder state borders (rendering tweak)
2. Sea conquest voyage arc animations
3. A new Map Builder mode allowing users to paint custom worlds

### Feature 1: Bold State Borders

**Target file**: `src/renderer/HexRenderer.ts`

Replace the existing single-pass border rendering in PASS 3 (and the overlay border in PASS 2) with a two-pass, deduplicated approach:

**Deduplication rule**: For each tile, only draw a shared border edge when the current tile has a **lower index** than the neighbor tile (`tile.index < neighborIdx`). This ensures each shared edge is drawn exactly once.

**Two-pass rendering** (for each deduplicated edge):
- Pass A (shadow): `ctx.lineWidth = 4`, `ctx.strokeStyle = 'rgba(0,0,0,0.85)'`
- Pass B (bright): `ctx.lineWidth = 2`, `ctx.strokeStyle = 'rgba(255,255,255,0.95)'`

**Coastline borders** (land-ocean boundary):
- Draw as `rgba(20, 60, 100, 0.9)`, `lineWidth = 2`

**Political overlay mode**: Same two-pass approach, but Pass B uses the state's color at full alpha instead of white.

**Acceptance**: State shapes are visually unmistakable from a distance; no edge is drawn twice.

---

### Feature 2: Sea Conquest Voyage Arc Lines

**Files to modify:**
- `src/renderer/AnimationController.ts`
- `src/renderer/AnimationController.test.ts`
- `src/renderer/HexRenderer.ts`
- `src/simulation/SimulationEngine.ts`
- `src/SimulationContext.tsx`

#### AnimationController additions

Add a new `SeaVoyageAnimation` interface (private) and these public methods:

```typescript
markSeaVoyage(fromIndex: number, toIndex: number, succeeded: boolean): void
// Creates a 2000ms animation entry for this sea crossing.
// If an animation for the same (from, to) pair already exists, overwrite it (reset timer).

getActiveSeaVoyages(): ReadonlyArray<{
  fromIndex: number;
  toIndex: number;
  succeeded: boolean;
  opacity: number;   // remaining / total, [0,1]
}>
// Returns all active sea voyage animations (for the renderer to iterate).
```

The existing `tick(deltaMs)` must also decrement sea voyage timers and remove expired ones.

#### AnimationController tests

Add to `src/renderer/AnimationController.test.ts`:

```typescript
describe('markSeaVoyage', () => {
  it('creates an active voyage with opacity 1.0 immediately', ...)
  it('fades to 0 after 2000ms tick', ...)
  it('overwriting same from/to pair resets timer', ...)
  it('getActiveSeaVoyages returns empty when no voyages', ...)
  it('tick reduces voyage opacity proportionally', ...)
})
```

#### SimulationEngine additions

Add a private field:
```typescript
private lastSeaCrossings: Array<{ from: number; to: number; succeeded: boolean }> = [];
```

At the **start of `step()`**: `this.lastSeaCrossings = [];`

During Step 3 (conflict resolution), when `conflict.isSeaCrossing === true`:
```typescript
this.lastSeaCrossings.push({
  from: conflict.attackerTileIndex,
  to: conflict.targetTileIndex,
  succeeded: conflict.outcome === 'attacker_wins',
});
```

Add public method:
```typescript
getLastSeaCrossings(): ReadonlyArray<{ from: number; to: number; succeeded: boolean }> {
  return this.lastSeaCrossings;
}
```

#### SimulationContext change

In `doStep()`, after `engineRef.current.step()`, add:
```typescript
for (const crossing of engineRef.current.getLastSeaCrossings()) {
  animControllerRef.current.markSeaVoyage(crossing.from, crossing.to, crossing.succeeded);
}
```

#### HexRenderer — PASS 8 (Sea Voyage Arcs)

After PASS 7 (hovered tile highlight), add PASS 8. For each voyage in `animations.getActiveSeaVoyages()`:

1. `[x1, y1]` = `tileCenter(tiles[voyage.fromIndex].q, tiles[voyage.fromIndex].r)`
2. `[x2, y2]` = `tileCenter(tiles[voyage.toIndex].q, tiles[voyage.toIndex].r)`
3. Control point (arc peak):
   ```
   mx = (x1 + x2) / 2;  my = (y1 + y2) / 2
   dx = x2 - x1;        dy = y2 - y1
   cpX = mx - dy * 0.25
   cpY = my + dx * 0.25
   ```
4. Color: `rgba(255, 215, 0, ${opacity})` (gold) if `succeeded`; `rgba(100, 160, 255, ${opacity})` (steel blue) if failed
5. `ctx.lineWidth = 1.5`; draw the arc:
   ```
   ctx.beginPath();
   ctx.moveTo(x1, y1);
   ctx.quadraticCurveTo(cpX, cpY, x2, y2);
   ctx.stroke();
   ```
6. Arrowhead at `(x2, y2)` pointing in the direction from `(cpX, cpY)` to `(x2, y2)`:
   - Compute angle: `Math.atan2(y2 - cpY, x2 - cpX)`
   - Draw filled triangle: base 5px, height 8px, same color + alpha as arc line
   - Use `ctx.save()` / `ctx.restore()` with `ctx.translate(x2, y2)` + `ctx.rotate(angle)` + `ctx.fillStyle`

**Acceptance**: Sea crossing arcs appear briefly after each step when `enableSeaConquest` is active; gold for successful invasions, blue for failed ones; fade smoothly over 2 seconds.

---

### Feature 3: Map Builder Mode

#### Task 3a: Create `src/types/mapbuilder.ts`

```typescript
import type { TerrainType } from './world';

export type MapBuilderTool =
  | 'paint-land'
  | 'paint-ocean'
  | 'paint-biome'
  | 'paint-productivity';

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
  brushSize: number;            // 1–8
  selectedBiome: TerrainType;   // excludes 'ocean'
  productivityValue: number;    // 0.0–1.0
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
  tiles: Array<{
    index: number;
    terrain: TerrainType;
    productivityOverride: number | null;
  }>;
}
```

#### Task 3b: Add `WorldGenerator.fromCustomMap()` static method

In `src/simulation/WorldGenerator.ts`, add a static method. It must:

1. Build `HexTile[]` from the `MapBuilderTile[]` input:
   - Copy `index`, `q`, `r`, `terrain`
   - Productivity: use `productivityOverride` if non-null; else use terrain midpoint defaults:
     ```
     river_valley: 0.925, plains: 0.70, forest: 0.525, hills: 0.40,
     tundra: 0.175, mountains: 0.15, desert: 0.15, ocean: 0.0
     ```
   - Obstacle: use terrain defaults (midpoints):
     ```
     plains: 0.10, river_valley: 0.10, forest: 0.275, hills: 0.375,
     tundra: 0.50, desert: 0.50, mountains: 0.75, ocean: 1.0
     ```
   - Initialize `isCoastal = false`, `continent = null`, `allNeighborIndices = []`, `landNeighborIndices = []`, `coastalReachIndices = []`
2. Compute `allNeighborIndices` using `getAxialNeighbors()` + `tileIndex()` (same as `generate()`)
3. Compute `landNeighborIndices` (filter to non-ocean tiles)
4. Mark `isCoastal` (land tile with ≥1 ocean neighbor)
5. BFS `coastalReachIndices` using `bfsReachableCoastal(tiles, i, 4)` for each coastal tile
6. Flood-fill continents using `bfsConnectedComponents` on land tiles; assign `continent = 0` to largest, `1` to second, null for ocean
7. Count `totalLandTiles` and `continentLandCounts`
8. Return `{ tiles, width, height, totalLandTiles, continentLandCounts }`

This method is deterministic (no RNG). Add a test in `src/simulation/WorldGenerator.test.ts`:
```typescript
it('fromCustomMap produces valid WorldData from all-plains input', () => {
  // Create 10x10 all-plains tiles, call fromCustomMap, assert totalLandTiles === 100
})
```

#### Task 3c: Create `src/ui/mapbuilder/MapBuilderRenderer.ts`

A self-contained canvas renderer for the map builder. Must implement:

```typescript
class MapBuilderRenderer {
  constructor(canvas: HTMLCanvasElement, width: number, height: number)
  render(tiles: MapBuilderTile[], hoveredBrushIndices: Set<number>, hoveredIndex: number | null): void
  getTileAtPixel(x: number, y: number): number | null
  getBrushTileIndices(centerIndex: number, brushSize: number): Set<number>
  resize(w: number, h: number): void
}
```

Rendering passes:
1. Clear to `#0f1117`
2. Fill all tiles with `TERRAIN_COLORS[tile.terrain]` (import from `MapModes.ts` — `TERRAIN_COLORS` is already exported)
3. Draw hex grid lines: `rgba(255,255,255,0.07)` stroke at `lineWidth = 0.5` for all tiles
4. Brush preview: for tiles in `hoveredBrushIndices`, fill with `rgba(255,255,255,0.22)` overlay
5. Hovered tile highlight: if `hoveredIndex !== null`, draw dashed white outline

For `getBrushTileIndices()`: use a BFS/flood from center tile, limiting to `hexDistance ≤ brushSize`. Use `allNeighborIndices` from a pre-computed neighbor lookup (build during constructor). Hex distance formula: `max(|dq|, |dr|, |dq+dr|) / 2` (axial coordinates).

The renderer keeps a pre-computed `Map<number, [number, number]>` of tile centers and a neighbor lookup to avoid recalculating per frame.

**Test `src/ui/mapbuilder/MapBuilderRenderer.test.ts`**:
```typescript
// Test getBrushTileIndices with brushSize=1 returns center + up to 6 neighbors
// Test getBrushTileIndices with brushSize=0 returns only center tile
// Test getTileAtPixel returns null for out-of-bounds coordinates
```
(No canvas operations needed — use vitest with jsdom; mock the 2D context.)

#### Task 3d: Create `src/ui/mapbuilder/MapBuilderContext.tsx`

React context wrapping all map builder logic. Exports `MapBuilderProvider` and `useMapBuilder()` hook.

State is `MapBuilderState`. Key implementation details:

**Initial state** (all ocean, 80×50 grid):
```typescript
const tiles: MapBuilderTile[] = [];
for (let i = 0; i < 80 * 50; i++) {
  tiles.push({ index: i, q: i % 80, r: Math.floor(i / 80), terrain: 'ocean', productivityOverride: null });
}
```

**`applyBrush(centerIdx: number)`**:
- Get brush tile set from renderer ref (or recompute inline using hex distance)
- Apply tool to each tile in set
- For `paint-land`/`paint-biome` with `randomEnabled`:
  - Each tile: 70% chance → `selectedBiome`, 30% chance → random pick from `['plains','hills','forest','desert','tundra','river_valley','mountains']`
- For `paint-productivity` with `randomEnabled`:
  - Each tile: `productivityValue + (rand() - 0.5) * 0.5`, clamped to [0, 1]
- After painting: push current tiles to undo stack (max 50), mark `isDirty = true`

**`generateRandomContinents()`**:
- Use `mulberry32(Math.floor(Math.random() * 999999))` as RNG
- Generate 2–4 circular blobs (randomize position, radius, offset) — same algorithm as WorldGenerator but simplified for the builder
- Assign terrain by latitude (r value):
  - r < height*0.12 or r > height*0.88 → `tundra`
  - r near equator (height*0.35–0.65) → 60% `plains`, 20% `river_valley`, 20% `forest`
  - subtropical → `desert` or `hills`
  - random mountains scattered at ~15% of land tiles
- Use `mulberry32` so each call produces different results (different seed each time)

**`convertToWorldData()`**: Call `WorldGenerator.fromCustomMap(state.tiles, state.width, state.height)` and return the result.

**`saveMap()`**: 
```typescript
const saved: SavedCustomMap = {
  version: 1, name: state.name, savedAt: new Date().toISOString(),
  width: state.width, height: state.height,
  tiles: state.tiles.map(t => ({ index: t.index, terrain: t.terrain, productivityOverride: t.productivityOverride })),
};
// Trigger browser download of JSON
```

**`loadMap(json: string)`**: Parse JSON, validate `version === 1`, reconstruct tiles, set state.

**Undo/redo**: Maintain `historyStack: MapBuilderTile[][]` and `historyIndex: number`. Each brush stroke pushes a deep copy. Undo = historyIndex--, redo = historyIndex++.

#### Task 3e: Create `src/ui/mapbuilder/MapBuilderPanel.tsx` and `.module.css`

Left sidebar (~280px). Must be scrollable. Sections:

1. **Header**: "🗺 Map Builder" title + name input
2. **Generate**: "🎲 Random Continents" + "🗑 Clear Map" buttons (full-width)
3. **Tools** (single-row grid, 2×2):
   - 🌊 Ocean | 🌿 Land/Biome | ⛰ Productivity | (empty or future)
   - Active tool highlighted with `--color-accent` background
4. **Biome Selector** (only when tool = `paint-land` or `paint-biome`):
   - Label "Biome:"
   - 8 color swatch buttons in a 4×2 grid
   - Each: 28×28px rounded square with the terrain's hex color + tooltip with name
   - Selected biome has a white border ring
5. **Brush Settings**:
   - Label "Brush Size: {brushSize}"
   - Range slider 1–8
6. **Random Intersperse** checkbox (label: "Randomize within brush")
7. **Productivity** (only when tool = `paint-productivity`):
   - Label "Productivity: {value.toFixed(2)}"
   - Range slider 0–1 step 0.01
8. **File**:
   - 💾 Save Map | 📂 Load Map (hidden file input)
9. **Undo/Redo**:
   - ↩ Undo | ↪ Redo (icon buttons)
10. **Footer** (sticky bottom):
    - ▶ Run Simulation on This Map (primary, full-width green button)

CSS aesthetics:
- Same CSS variable system as simulation UI
- Panel has `overflow-y: auto`, `scrollbar-width: thin`, `scrollbar-color: var(--color-border) transparent`
- Buttons use same `.btn` visual language as ControlPanel
- Active tool button: `background: var(--color-accent)`, `color: #fff`, `border-color: var(--color-accent)`
- Section headings: small uppercase label, `color: var(--color-text-muted)`, `font-size: 0.7rem`, `letter-spacing: 0.08em`

#### Task 3f: Create `src/ui/mapbuilder/MapBuilderCanvas.tsx` and `.module.css`

Canvas host component. Must:
- Create `MapBuilderRenderer` on mount, store in ref
- Respond to `context.tiles` changes by re-rendering
- Handle mouse events:
  - `onMouseMove`: get tile at pixel → compute brush indices → update local hover state → re-render
  - `onMouseDown`: set `isPainting = true`, call `context.applyBrush(tileIdx)`
  - `onMouseMove` while `isPainting`: call `context.applyBrush(tileIdx)` (avoid re-painting same tile within single drag)
  - `onMouseUp` / `onMouseLeave`: clear `isPainting`
- Keyboard events (on window): `Ctrl+Z` → undo, `Ctrl+Shift+Z` / `Ctrl+Y` → redo, `[` → brush--, `]` → brush++
- Window resize: call `renderer.resize()`
- RAF loop for smooth brush preview (re-render on every frame)

Canvas style: `width: 100%`, `height: 100%`, `cursor: crosshair`, `display: block`

#### Task 3g: Integrate into `src/App.tsx`

Add `appMode` state:
```typescript
const [appMode, setAppMode] = useState<'simulate' | 'build'>('simulate');
```

Top bar: add a mode toggle button to the right of the title:
- When `appMode === 'simulate'`: show "🗺 Map Builder" button
- When `appMode === 'build'`: show "▶ Simulation" button
- Toggle switches `appMode`

When switching from `'build'` → `'simulate'`:
- Call `mapBuilderContext.convertToWorldData()` to get `WorldData`
- Call `simContext.loadCustomWorld(worldData)` to reset the simulation on the custom map
- Then set `appMode = 'simulate'`

Wrap the top-level render:
```tsx
{appMode === 'simulate' ? (
  <div className={styles.main}>
    <ControlPanel />
    <MapCanvas />
    <div className={styles.rightColumn}>...</div>
  </div>
) : (
  <MapBuilderProvider>
    <div className={styles.builderMain}>
      <MapBuilderPanel onRunSimulation={handleRunSimulation} />
      <MapBuilderCanvas />
    </div>
  </MapBuilderProvider>
)}
```

Add `.builderMain` CSS class: `display: flex; flex: 1; overflow: hidden;`

#### Task 3h: Add `loadCustomWorld` to `SimulationContext.tsx`

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

Expose `loadCustomWorld` in the context value interface and return value.

#### Task 3i: Update `src/styles/App.module.css`

Add:
```css
.builderMain {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.modeToggleBtn {
  /* Small pill button in top bar for mode switching */
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.15s, border-color 0.15s;
}

.modeToggleBtn:hover {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}
```

---

### Task Ordering for @developer

Implement in this exact order to avoid import errors:
1. `src/types/mapbuilder.ts` (types first)
2. `src/renderer/AnimationController.ts` (add sea voyage methods)
3. `src/simulation/SimulationEngine.ts` (add sea crossings tracking)
4. `src/simulation/WorldGenerator.ts` (add fromCustomMap)
5. `src/renderer/HexRenderer.ts` (bold borders + PASS 8 arcs)
6. `src/SimulationContext.tsx` (add loadCustomWorld, call markSeaVoyage)
7. `src/ui/mapbuilder/MapBuilderRenderer.ts` (renderer utility)
8. `src/ui/mapbuilder/MapBuilderContext.tsx` (context + logic)
9. `src/ui/mapbuilder/MapBuilderPanel.tsx` + `.module.css`
10. `src/ui/mapbuilder/MapBuilderCanvas.tsx` + `.module.css`
11. `src/App.tsx` + `src/styles/App.module.css` (integration)

### Tests

**@tester must verify:**
- `AnimationController.test.ts`: all existing tests still pass + new sea voyage tests pass
- `WorldGenerator.test.ts`: all existing tests pass + `fromCustomMap` test passes
- `MapBuilderRenderer.test.ts`: getBrushTileIndices + getTileAtPixel basic tests pass
- `npm run build` exits 0 (TypeScript compiles with zero errors)
- `npm test` all tests pass

### Acceptance Criteria (full feature)
1. State borders are visually unmistakable — embossed white borders, clearly delineating each state's territory
2. Sea voyages show gold/blue arcs with arrowheads, fading over ~2 seconds after each turn
3. Map Builder opens via header button, starts with all-ocean grid
4. Paint tools (land, ocean, biome, productivity) work with adjustable brush
5. Biome selector shows all 7 land biome types with correct colors
6. Random intersperse checkbox adds variation within brush strokes
7. Random Continents button generates plausible-looking landmasses
8. Save Map downloads valid JSON; Load Map restores the painted state
9. Run Simulation button switches to simulation mode, running on the custom map
10. Undo/redo (Ctrl+Z / Ctrl+Shift+Z) works correctly
11. All existing simulation functionality unaffected

### Out of Scope
- Mobile/touch support for map builder
- Multiple map slots (save/load is single-slot JSON download)
- Real-time multiplayer
- Import from external map formats
```

---

## Reproducibility Checksum
- **Architecture Hash**: 2026-06-08 (plan version 1, enhancements to v1 simulator)
- **Plan Version**: 1
- **Prior Instances**: none (first enhancement cycle)
