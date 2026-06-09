# Architecture: World Simulator Enhancements — v1
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Prior Plan Reference**: .plans/project/2026-06-07-202651-architecture-world-simulator.md
- **Feature Fingerprint**: bold-borders + sea-voyage-lines + map-builder

---

## Overview

This document describes three additive enhancements to the existing World Simulator. All changes are confined to a single frontend workstream on `feature/ui/world-simulator-enhancements`. No backend or infrastructure changes are required.

### Scope Summary

| # | Feature | Impact | New Files | Modified Files |
|---|---------|--------|-----------|----------------|
| 1 | Bold State Borders | Renderer tweak | 0 | 1 |
| 2 | Sea Voyage Arc Lines | Animation + Renderer | 0 | 4 |
| 3 | Map Builder Mode | New major feature | 8 | 5 |

---

## Feature 1: Bold State Borders

### Problem
Current state borders (`lineWidth: 1.5`, `rgba(255,255,255,0.8)`) are hard to read, especially when many small states are packed together on terrain or political overlay maps.

### Solution
Replace the single-pass border draw with a **two-pass shadow + highlight rendering** technique that produces a crisp, embossed border highly visible on all terrain types.

### Algorithm

**Deduplication (critical)**: Currently every tile draws its own border edges, leading to each edge being drawn twice (once per adjacent tile). Replace with a single-owner rule: draw the shared edge only when the tile with the **lower index** is processed. This halves draw calls and eliminates overdraw artifacts.

**Two-pass rendering**:
1. **Pass A — Dark shadow halo** (`ctx.lineWidth = 4`, `ctx.strokeStyle = 'rgba(0,0,0,0.85)'`): draw the shared edge. Creates a dark background that separates colors cleanly.
2. **Pass B — Bright highlight** (`ctx.lineWidth = 2`, `ctx.strokeStyle = 'rgba(255,255,255,0.95)'`): draw the same edge on top. Creates a crisp white border.

Result: a "double-line" embossed border that pops on any background.

**Political overlay mode**: Use state color at full alpha for the highlight line (instead of white) to reinforce the state-color identity, while the dark shadow remains black.

**Border between land and ocean**: Draw a single 2px `rgba(20,60,100,0.9)` coastline border.

### Files Changed
- `src/renderer/HexRenderer.ts` — replace PASS 3 (and overlay PASS 2 border) with the new two-pass deduplication approach

---

## Feature 2: Sea Conquest Voyage Arc Lines

### Problem
Sea conquests are invisible — the player can't tell when cross-ocean attacks happen or succeed. The `enableSeaConquest` toggle exists but produces no visual feedback.

### Solution
Animated curved arcs (quadratic Bézier) drawn on the canvas whenever a sea crossing is attempted. Arcs fade out over 2 000 ms. Gold arc = successful invasion. Steel-blue arc = failed/stalemate.

### Data Flow

```
SimulationEngine.step()
    → records sea crossings in lastSeaCrossings[]
    ↓
SimulationContext.doStep()
    → reads engine.getLastSeaCrossings()
    → calls animationController.markSeaVoyage(from, to, succeeded)
    ↓
HexRenderer.render()  (via AnimationController.getActiveSeaVoyages())
    → draws arc pass AFTER tile and border passes
```

### AnimationController Extensions

```typescript
interface SeaVoyageAnimation {
  fromIndex: number;
  toIndex: number;
  succeeded: boolean;
  remaining: number;   // ms
  total: number;       // 2000ms
}

// New public methods:
markSeaVoyage(fromIndex: number, toIndex: number, succeeded: boolean): void
getActiveSeaVoyages(): ReadonlyArray<SeaVoyageAnimation>
```

### HexRenderer Arc Rendering (new PASS 8)

For each active sea voyage:
1. Compute `[x1, y1]` = `tileCenter(from.q, from.r)`  
2. Compute `[x2, y2]` = `tileCenter(to.q, to.r)`  
3. Control point = midpoint of line raised by 25% of line length perpendicularly:
   ```
   mx = (x1 + x2) / 2
   my = (y1 + y2) / 2
   dx = x2 - x1
   dy = y2 - y1
   perpX = -dy * 0.25
   perpY =  dx * 0.25
   cpX = mx + perpX
   cpY = my + perpY
   ```
4. Opacity = `remaining / total`
5. Arc color: `rgba(255, 215, 0, α)` (gold) for success; `rgba(100, 160, 255, α)` (steel blue) for failed
6. `ctx.lineWidth = 1.5`; draw `ctx.quadraticCurveTo(cpX, cpY, x2, y2)`
7. Arrowhead at `(x2, y2)`: draw a small (6px base, 8px height) filled triangle pointing from `(cpX, cpY)` toward `(x2, y2)`, same color and opacity

### SimulationEngine Extension

Add a private `lastSeaCrossings: Array<{ from: number; to: number; succeeded: boolean }> = []` field. During Step 3 (conflict resolution), when `isSeaCrossing === true`, push to `lastSeaCrossings`. Clear at the start of each `step()` call. Expose via `getLastSeaCrossings()`.

### Files Changed
- `src/renderer/AnimationController.ts` — add `SeaVoyageAnimation`, `markSeaVoyage()`, `getActiveSeaVoyages()`
- `src/renderer/AnimationController.test.ts` — add tests for new sea voyage methods
- `src/renderer/HexRenderer.ts` — add PASS 8 (sea voyage arcs)
- `src/simulation/SimulationEngine.ts` — add `lastSeaCrossings[]` + `getLastSeaCrossings()`
- `src/SimulationContext.tsx` — call `markSeaVoyage()` after each step

---

## Feature 3: Map Builder Mode

### Overview
A new top-level application mode (`'build'`) accessible via a toggle in the header. In builder mode the simulation panels are replaced with a full-width hex-grid canvas + a left control panel. The user paints the map, then launches the simulation on it.

### App-Level Mode Toggle
`App.tsx` gains a `appMode: 'simulate' | 'build'` React state (local, not in SimulationContext). The top bar shows a "🗺 Map Builder" / "▶ Run Simulation" toggle button. Switching to `simulate` from `build` triggers `WorldGenerator.fromCustomMap()` and resets the simulation.

### Data Model

**`src/types/mapbuilder.ts`** (new file):
```typescript
export type MapBuilderTool =
  | 'paint-land'
  | 'paint-ocean'
  | 'paint-biome'
  | 'paint-productivity';

export interface MapBuilderTile {
  index: number;
  q: number;
  r: number;
  terrain: TerrainType;              // 'ocean' = water
  productivityOverride: number | null; // null = use terrain defaults
}

export interface MapBuilderState {
  tiles: MapBuilderTile[];
  width: number;
  height: number;
  tool: MapBuilderTool;
  brushSize: number;                  // 1–8 (hex-hop radius)
  selectedBiome: TerrainType;         // used when tool = 'paint-biome'
  productivityValue: number;          // 0–1, used when tool = 'paint-productivity'
  randomEnabled: boolean;             // "random intersperse" toggle for current tool
  name: string;
  isDirty: boolean;                   // unsaved changes
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

### MapBuilderContext (`src/ui/mapbuilder/MapBuilderContext.tsx`)

Owns all map builder state. Key methods:

| Method | Description |
|--------|-------------|
| `applyBrush(centerTileIndex)` | Paint all tiles within `brushSize` hex-hops from center using current tool |
| `generateRandomContinents(seed?)` | Randomize landmasses using seeded blob algorithm |
| `randomizeCurrentElement()` | Randomly apply current tool element across all land tiles (respects randomEnabled) |
| `saveMap()` | JSON download of `SavedCustomMap` |
| `loadMap(json)` | Parse + validate + restore `MapBuilderState` |
| `convertToWorldData()` | Call `WorldGenerator.fromCustomMap()` and return `WorldData` |
| `undo()` / `redo()` | 50-step history via tile-array snapshots |
| `resetMap()` | Clear to all-ocean |

**Brush application logic**:
- Compute hex distance for all tiles from center
- Filter tiles with distance ≤ `brushSize`
- Apply tool:
  - `paint-land`: set terrain to `selectedBiome` (default: `'plains'`)
  - `paint-ocean`: set terrain to `'ocean'`, clear override
  - `paint-biome`: set terrain to `selectedBiome` for land tiles only
  - `paint-productivity`: set `productivityOverride` on land tiles
- **Random intersperse** (when `randomEnabled = true`):
  - `paint-land`: ~70% of brush tiles become `selectedBiome`, ~30% get random adjacent biome
  - `paint-biome`: same as above but only on existing land
  - `paint-productivity`: value varies ±0.25 per tile, clamped [0, 1]

**Random Continents generation**:
```
rand = mulberry32(seed ?? Date.now())
count = 2 + floor(rand() * 3)  // 2-4 blobs
for each blob:
  cx = width * (0.15 + rand() * 0.7)
  cy = height * (0.15 + rand() * 0.7)
  radius = min(width, height) * (0.15 + rand() * 0.2)
  assign land to tiles within radius * (0.6 + 0.8 * rand())
then apply latitude-based terrain assignment (same as WorldGenerator)
```

### MapBuilderRenderer (`src/ui/mapbuilder/MapBuilderRenderer.ts`)

Canvas renderer for the builder. Similar to HexRenderer but stripped to builder needs:

- `render(state: MapBuilderState, hoveredTileIndex: number | null, hoveredBrushIndices: Set<number>)`:
  1. Fill background `#0f1117`
  2. For each tile: draw filled hex using `TERRAIN_COLORS[tile.terrain]` (ocean = `#1a3a5c`)
  3. Grid overlay: draw hex outlines at `rgba(255,255,255,0.08)` (subtle grid for map building reference)
  4. Highlight brush preview: tiles in `hoveredBrushIndices` get a `rgba(255,255,255,0.25)` fill overlay
  5. Highlight hovered tile center with a small white dot
- `getTileAtPixel(x, y)`: same nearest-center algorithm as HexRenderer
- `getBrushTileIndices(centerIdx, brushSize)`: returns all tile indices within brush radius using hex distance
- `resize(w, h)`: update canvas size + recompute offsets
- Reuses `hexVertices()` and flat-top `tileCenter()` math (copied from HexRenderer — both are ≤15 lines)

### MapBuilderPanel (`src/ui/mapbuilder/MapBuilderPanel.tsx`)

Left control panel (~280px). Sections:

**World Settings**
- Map name text input
- Width/Height display (read-only — fixed to 80×50 matching sim defaults)

**Generate**
- `🎲 Random Continents` button (generates landmasses with random seed)
- `🗑 Clear (All Ocean)` button

**Tools** (icon buttons, single-select)
- 🌊 Paint Ocean
- 🌿 Paint Land / Biome (with biome selector)
- ⛰ Paint Productivity

**Biome Selector** (visible when `tool = 'paint-biome'` or `tool = 'paint-land'`)
- Row of 8 colored buttons, one per TerrainType (excluding ocean)
- Shows terrain name + color swatch

**Brush Size** slider (1–8)

**Random Intersperse** toggle checkbox — randomizes element placement within brush

**Productivity** (visible when `tool = 'paint-productivity'`)
- Slider 0.0–1.0 showing current value
- Random Intersperse toggle

**File**
- 💾 Save Map (JSON download)
- 📂 Load Map (file input)

**Run**
- ▶ Run Simulation on This Map (primary button, switches app to simulate mode)

### MapBuilderCanvas (`src/ui/mapbuilder/MapBuilderCanvas.tsx`)

- Hosts `<canvas>` via `useRef`
- On mount: create `MapBuilderRenderer`, attach to context
- Mouse events:
  - `onMouseMove`: call `getTileAtPixel()` → update hovered index → call `getBrushTileIndices()` → trigger brush preview re-render
  - `onMouseDown` + `onMouseMove` while pressed: call `ctx.applyBrush(tileIndex)` for each tile encountered (de-duplicate per drag stroke)
  - `onMouseLeave`: clear hover state
- Window resize: call `renderer.resize()`
- RAF loop: continuous re-render on every animation frame for smooth brush preview

### WorldGenerator Extension

Add a **static** method `WorldGenerator.fromCustomMap(tiles: MapBuilderTile[], width: number, height: number): WorldData`:

1. Build `HexTile[]` from MapBuilderTile — copy q, r, terrain, index
2. Assign productivity: use `productivityOverride` if non-null; else use terrain-default range midpoints (same values as in `generate()`)
3. Assign obstacle: use terrain defaults (same as `generate()`)
4. Compute `allNeighborIndices` and `landNeighborIndices` (same logic as `generate()`)
5. Mark `isCoastal` (land tile with ≥1 ocean neighbor)
6. BFS `coastalReachIndices` with fixed `seaConquestRadius = 4`
7. Flood-fill continents, assign `continent` IDs
8. Compute `totalLandTiles` and `continentLandCounts`
9. Return complete `WorldData`

This method does NOT use RNG (it is deterministic from the tile array).

### Keyboard Shortcuts (MapBuilderCanvas)
- `Ctrl+Z` → undo
- `Ctrl+Shift+Z` / `Ctrl+Y` → redo
- `L` → switch to paint-land tool
- `O` → switch to paint-ocean tool
- `B` → switch to paint-biome tool
- `P` → switch to paint-productivity tool
- `[` / `]` → decrease / increase brush size

### CSS Aesthetic Requirements
- Dark theme: same CSS variables as simulation (`--color-bg`, `--color-surface`, etc.)
- Tool buttons: 40×40px squares with icon + label below, active state uses `--color-accent` background
- Biome swatches: 24×24px rounded squares with the actual terrain color
- Brush preview: subtle `rgba(255,255,255,0.22)` overlay, no hard outline (cleaner look)
- Transition: fade between tool active states (`transition: background 0.15s`)
- Panel scrollable with thin custom scrollbar (`scrollbar-width: thin`)

---

## Interface Contracts

### AnimationController new additions
```typescript
// New method signatures (additive — no breaking changes):
markSeaVoyage(fromIndex: number, toIndex: number, succeeded: boolean): void;
getActiveSeaVoyages(): ReadonlyArray<SeaVoyageAnimation>;
```

### SimulationEngine new method
```typescript
getLastSeaCrossings(): ReadonlyArray<{ from: number; to: number; succeeded: boolean }>;
```

### WorldGenerator new static method
```typescript
static fromCustomMap(
  tiles: MapBuilderTile[],
  width: number,
  height: number
): WorldData;
```

### SimulationContext new method
```typescript
loadCustomWorld(worldData: WorldData): void;
```

---

## File Impact Summary

### New Files
| File | Description |
|------|-------------|
| `src/types/mapbuilder.ts` | MapBuilderTile, MapBuilderState, SavedCustomMap types |
| `src/ui/mapbuilder/MapBuilderContext.tsx` | React context + state management |
| `src/ui/mapbuilder/MapBuilderPanel.tsx` | Left sidebar controls |
| `src/ui/mapbuilder/MapBuilderCanvas.tsx` | Interactive canvas |
| `src/ui/mapbuilder/MapBuilderRenderer.ts` | Canvas renderer |
| `src/ui/mapbuilder/MapBuilderPanel.module.css` | Panel styles |
| `src/ui/mapbuilder/MapBuilderCanvas.module.css` | Canvas styles |
| `src/ui/mapbuilder/MapBuilderRenderer.test.ts` | Renderer unit tests |

### Modified Files
| File | Change |
|------|--------|
| `src/renderer/HexRenderer.ts` | Bold border two-pass, PASS 8 sea voyage arcs |
| `src/renderer/AnimationController.ts` | Add sea voyage tracking |
| `src/renderer/AnimationController.test.ts` | Add sea voyage tests |
| `src/simulation/SimulationEngine.ts` | Add `lastSeaCrossings[]` + getter |
| `src/simulation/WorldGenerator.ts` | Add `fromCustomMap()` static method |
| `src/SimulationContext.tsx` | Call `markSeaVoyage()`, add `loadCustomWorld()` |
| `src/App.tsx` | Mode toggle, conditional MapBuilder rendering |
| `src/styles/App.module.css` | Mode toggle button styles |

---

## Non-Goals
- Multiplayer, server-side storage, user accounts
- Custom map sharing/gallery
- Map import from external formats (GeoJSON, SVG, etc.)
- Animated transitions between app modes
- Mobile touch support for map builder (mouse-only in this version)
