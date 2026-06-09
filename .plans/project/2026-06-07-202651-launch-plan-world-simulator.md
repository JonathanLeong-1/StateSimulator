# Launch Plan: World Simulator
- **Date**: 2026-06-07 20:26:51
- **Architecture Reference**: .plans/project/2026-06-07-202651-architecture-world-simulator.md
- **Feature Fingerprint**: browser-political-geography-simulator
- **Execution Mode**: sequential (3 dependent waves — no parallelism benefit)
- **Available Slots**: unlimited (Codespaces detected, but all waves are serial)
- **Total Workstreams**: 3
- **Total Waves**: 3

## Execution Mode Rationale

CODESPACES=true detected, so parallel execution is available. However, all three workstreams are strictly serial (each depends entirely on the previous), so parallel Codespace execution provides no benefit. Sequential execution in a single VS Code session is recommended. Each wave must complete and merge to `main` before the next begins.

## Dependency Graph

```
[infra] ──> [engine] ──> [ui]
```

- `engine` depends on `infra` (shared types, project scaffold, utilities)
- `ui` depends on `engine` (WorldGenerator, SimulationEngine, StateManager interfaces)
- All dependencies are strict — no workstream can begin until its predecessor has merged to `main`

## Execution Schedule

### Wave 1 — Project Foundation (infra)
- **Parallel slots used**: 1
- **Workstreams**: infra → @infra-lead [session #1]
- **Deliverables**: Vite+React+TypeScript scaffold, all shared type definitions, rng.ts, hexUtils.ts, global CSS, Vitest config
- **Sync point**: Wave 1 must merge `feature/infra/world-simulator-scaffold` to `main` before Wave 2 begins

### Wave 2 — Simulation Engine (engine)
- **Prerequisite**: Wave 1 merged to `main`; `git pull origin main` before starting
- **Parallel slots used**: 1
- **Workstreams**: engine → @backend-lead [session #2]
- **Deliverables**: WorldGenerator, SimulationEngine, StateManager, all unit tests passing
- **Sync point**: Wave 2 must merge `feature/engine/world-simulator-core` to `main` before Wave 3 begins

### Wave 3 — UI & Renderer (ui)
- **Prerequisite**: Wave 2 merged to `main`; `git pull origin main` before starting
- **Parallel slots used**: 1
- **Workstreams**: ui → @frontend-lead [session #3]
- **Deliverables**: Full working browser app, HexRenderer, all React components, Charts, Controls, README
- **Sync point**: Wave 3 merges `feature/ui/world-simulator-renderer` to `main` — project complete

## Sequential Fallback Order
1. infra → @infra-lead
2. engine → @backend-lead (after infra merges)
3. ui → @frontend-lead (after engine merges)

---

## Delegation Payloads

### Payload: Infra → @infra-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/project/2026-06-07-202651-architecture-world-simulator.md
- **Launch Plan**: .plans/project/2026-06-07-202651-launch-plan-world-simulator.md
- **Execution Mode**: sequential
- **Workstream**: infra — Wave 1 of 3
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Confirm you have read the architecture plan, delegation protocol, will follow 7-gate sequence, will present execution plan for approval, and acknowledge sequential Wave 1 position.

---

## Workstream: Infra — @infra-lead
**Architecture Reference**: `.plans/project/2026-06-07-202651-architecture-world-simulator.md`
**Launch Plan Reference**: `.plans/project/2026-06-07-202651-launch-plan-world-simulator.md`

### Execution Context
- **Mode**: sequential
- **Wave**: 1 of 3
- **Parallel peers**: none
- **Prerequisites**: none — this is Wave 1
- **Codespace/Session**: sequential session #1
- **Sync point**: After completion, merge `feature/infra/world-simulator-scaffold` to `main` before Wave 2 (engine) begins

### Context
This is a browser-based political geography simulator (no backend). The app is a React 18 + Vite 5 + TypeScript 5 SPA that renders a hex-grid simulation on HTML5 Canvas. This workstream scaffolds the entire project and provides the shared foundation that Wave 2 (engine) and Wave 3 (UI) depend on.

### Scope
Set up the complete project scaffold, shared TypeScript type definitions, foundational utility modules, CSS foundation, and Vitest configuration. Do NOT implement WorldGenerator, SimulationEngine, or any renderer — those are Wave 2 and Wave 3.

### Tasks

1. **Initialize Vite + React + TypeScript project**
   - Run `npm create vite@latest . -- --template react-ts` in `/workspaces/World-Simulator`
   - Install dependencies: `npm install`
   - Add Vitest: `npm install -D vitest @vitest/ui jsdom @testing-library/react`
   - Update `vite.config.ts` to add Vitest config block with jsdom environment
   - Verify `npm run dev` starts and `npm test` runs (with 0 tests initially passing)
   - Acceptance: `npm run dev` serves on localhost, `npm test` exits 0

2. **Write shared TypeScript types** — exactly as specified in architecture
   - `src/types/world.ts`: TerrainType, HexTile, WorldConfig, WorldData
   - `src/types/simulation.ts`: StateData, ConflictResult, SecessionEvent, SimStats, SimState
   - `src/types/ui.ts`: MapMode, SimSettings, ChartDataPoint, UIState
   - Add `src/types/index.ts` re-exporting everything
   - Types must match the architecture Interface Contracts EXACTLY (field names, types, nullability)
   - Acceptance: TypeScript compiles with `tsc --noEmit` (zero errors)

3. **Implement `src/simulation/rng.ts`**
   - Export `mulberry32(seed: number): () => number`
   - Must be a pure deterministic PRNG (mulberry32 algorithm)
   - Acceptance: `tests/rng.test.ts` passes — same seed same sequence, output in [0,1)

4. **Implement `src/simulation/hexUtils.ts`**
   - Export: `tileIndex`, `getAxialNeighbors`, `hexDistance`, `bfsConnectedComponents`, `bfsReachableCoastal`
   - Use axial (q, r) coordinate system; flat-top hexagon layout
   - `bfsConnectedComponents`: takes tile index array + neighbor function, returns array of connected component arrays
   - `bfsReachableCoastal`: BFS through ocean tiles from a coastal start; returns indices of coastal LAND tiles within maxRadius hops
   - Acceptance: `tests/hexUtils.test.ts` passes all specified cases

5. **Set up CSS foundation**
   - `src/styles/global.css`: CSS custom properties, dark mode (#0f1117 background, #e2e8f0 text), typography (Inter/system font)
   - Define CSS variables: `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-accent`, `--color-ocean`, `--radius-card`, `--shadow-card`
   - Import global.css in `src/main.tsx`
   - Stub CSS module files (empty or minimal): `App.module.css`, `ControlPanel.module.css`, `StatsPanel.module.css`, `Charts.module.css`
   - Acceptance: `npm run dev` shows dark background

6. **Stub the simulation and renderer modules** (empty exports to prevent import errors in Wave 3)
   - `src/simulation/WorldGenerator.ts`: export class WorldGenerator with stub `generate()` that throws NotImplemented
   - `src/simulation/SimulationEngine.ts`: export class SimulationEngine with all interface methods as stubs
   - `src/simulation/StateManager.ts`: export class StateManager with all interface methods as stubs
   - `src/renderer/HexRenderer.ts`: export class HexRenderer with stub `render()` and `getTileAtPixel()`
   - `src/renderer/MapModes.ts`: export stub functions
   - `src/renderer/AnimationController.ts`: export class AnimationController with stub methods
   - These are STUBS ONLY — no implementation. Wave 2 and 3 fill these in.
   - Acceptance: TypeScript compiles with zero errors after adding stubs

7. **Create `src/App.tsx` stub and `src/main.tsx`**
   - `src/main.tsx`: standard React 18 root mount with StrictMode
   - `src/App.tsx`: Stub that renders `<div>World Simulator — loading...</div>` (Wave 3 replaces this)
   - Acceptance: `npm run dev` shows the stub text

### Technical Decisions
- Language: TypeScript 5, strict mode (`"strict": true` in tsconfig)
- Framework: React 18 (hooks only, no class components)
- Build: Vite 5
- Test runner: Vitest 1.x with jsdom environment
- No CSS framework — pure CSS custom properties + CSS modules
- No state management library (React context only)

### Dependencies
- Depends on: nothing
- Depended on by: engine (Wave 2), ui (Wave 3)

### Interfaces to Deliver
ALL types in `src/types/` must exactly match the architecture Interface Contracts. The engine and UI leads will import these types and cannot proceed if they change.

### Out of Scope
- WorldGenerator, SimulationEngine, StateManager implementation (Wave 2)
- HexRenderer, MapModes, AnimationController implementation (Wave 3)
- All React UI components beyond App stub (Wave 3)
- README final content (Wave 3)
```

---

### Payload: Engine → @backend-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/project/2026-06-07-202651-architecture-world-simulator.md
- **Launch Plan**: .plans/project/2026-06-07-202651-launch-plan-world-simulator.md
- **Execution Mode**: sequential
- **Workstream**: engine — Wave 2 of 3
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Confirm you have read the architecture plan, delegation protocol, will follow 7-gate sequence, will present execution plan for approval, and acknowledge sequential Wave 2 position.

---

## Workstream: Engine — @backend-lead
**Architecture Reference**: `.plans/project/2026-06-07-202651-architecture-world-simulator.md`
**Launch Plan Reference**: `.plans/project/2026-06-07-202651-launch-plan-world-simulator.md`

### Execution Context
- **Mode**: sequential
- **Wave**: 2 of 3
- **Parallel peers**: none
- **Prerequisites**: Wave 1 (infra) merged to `main` — run `git pull origin main` first
- **Codespace/Session**: sequential session #2
- **Sync point**: After completion, merge `feature/engine/world-simulator-core` to `main` before Wave 3 (ui) begins

### Context
This is the simulation logic core of a browser-based political geography simulator. The infra workstream (Wave 1) has already scaffolded the project, defined all TypeScript types in `src/types/`, implemented `rng.ts` and `hexUtils.ts`. This workstream implements the three main simulation classes: WorldGenerator, SimulationEngine, StateManager.

### Scope
Implement the three simulation classes, replacing the stub implementations from Wave 1. Write full unit test coverage. All logic is pure TypeScript with no DOM or browser dependencies.

### Tasks

1. **Implement `src/simulation/WorldGenerator.ts`**

   The `generate(config: WorldConfig): WorldData` method must:
   - Create a flat array of `HexTile` objects sized `config.width * config.height`
   - Use `mulberry32(config.seed)` as the sole RNG source
   - Generate terrain using two procedural landmass blobs (circular gradient noise with jitter), ensuring ocean separates them in the middle ~20% of grid width
   - After generating landmasses, assign terrain types:
     - Far-north and far-south tiles → `tundra`
     - Mid-latitude tiles with low elevation → `plains`
     - Mid-latitude strips → `river_valley` (higher productivity)
     - Higher elevation → `mountains` or `hills`
     - Subtropical latitudes → `desert`
     - Mid-latitude mid-elevation → `forest`
   - Assign productivity values per terrain (use these exact values):
     - river_valley: 0.85-1.0
     - plains: 0.60-0.80
     - forest: 0.45-0.60
     - hills: 0.30-0.50
     - tundra: 0.10-0.25
     - mountains: 0.10-0.20
     - desert: 0.10-0.20
     - ocean: 0.0
   - Assign obstacle values per terrain:
     - plains: 0.05-0.15
     - river_valley: 0.05-0.15
     - forest: 0.20-0.35
     - hills: 0.30-0.45
     - tundra: 0.40-0.60
     - desert: 0.40-0.60
     - mountains: 0.65-0.85
     - ocean: 1.0
   - Pre-compute `allNeighborIndices` (all valid hex neighbors), `landNeighborIndices` (non-ocean neighbors)
   - Mark `isCoastal = true` for land tiles with at least one ocean neighbor
   - Pre-compute `coastalReachIndices` using `bfsReachableCoastal` with `config.seaConquestRadius`
   - Identify continents via flood-fill; assign `continent` (0 or 1) to each land tile; ocean tiles get `null`
   - Acceptance: WorldGenerator tests all pass; same seed always produces same output

2. **Implement `src/simulation/StateManager.ts`**

   - Maintain a pool of 40 distinct HSL colors (evenly distributed hue, high saturation, medium-high lightness for dark background)
   - `allocateState(capital, continent, rng)`: assign next available color from pool, generate name based on initial size (1), return StateData
   - `releaseState(id)`: return color to pool (LRU order for reuse)
   - `generateName(size, rng)`: 
     - size 1-4: pick from ["Tribe of X", "City of X", "X Settlement"] using fictional name parts
     - size 5-19: pick from ["Kingdom of X", "X League", "X Republic", "X Principality"]
     - size 20+: pick from ["X Empire", "X Confederation", "Great X", "X Federation"]
     - Use ~60 fictional syllables/roots: Aur, Vel, Nor, Cal, Ser, Vey, Mor, Tal, etc.
   - `renameState(id, name)`: override auto name with user-provided name
   - `computeStats(simState, totalLandTiles)`: calculate all SimStats fields including HHI
     - HHI = sum((state.size / totalLandTiles)^2 for all states)
     - continentUnificationScores[c] = maxStateSize_on_continent / totalLandTiles_on_continent
   - Acceptance: StateManager tests pass including name tier tests and color reuse

3. **Implement `src/simulation/SimulationEngine.ts`**

   The engine follows this EXACT turn order (do not deviate):
   ```
   Step 1: Snapshot current state powers (Map<stateId, power>)
   Step 2: Generate ALL conflict proposals using snapshot powers
   Step 3: Resolve all conflicts (update ownership array)
   Step 4: Apply secessions (if enabled)
   Step 5: Split disconnected states (if enabled)
   Step 6: Update state metadata (recalculate tiles, power, capital)
   Step 7: Compute and update stats
   Step 8: Increment turn counter
   ```

   **`initialize()`**: Create one state per land tile. Assign ownership. Allocate states via StateManager.

   **Conflict generation (Step 2)**:
   - For each land tile that has a land-neighbor owned by a different state:
     - Roll conflict chance: `rand() < baseConflictRate * tile.productivity * productivityInfluence`
     - If triggered: pick a random neighbor tile from a different state as target
     - If `enableSeaConquest` and tile is coastal: also chance to pick from `coastalReachIndices` (different state), scaled by `seaConquestChance`
     - Record ConflictResult with attacker/defender state IDs and tile indices
   - Use snapshotted state powers for all resolution

   **Conflict resolution (Step 3)**:
   - For each conflict proposal:
     - `obstacle = (attackerTile.obstacle + defenderTile.obstacle) / 2`
     - If sea crossing: `obstacle += 0.3`
     - `stalemate = rand() < clamp(obstacle * geographyDifficulty, 0, 0.75)`
     - If stalemate: outcome = "stalemate", no change
     - Else: `attackerWinChance = attackerPower / (attackerPower + defenderPower + obstacle * geographyDifficulty * defenderPower * 0.5)`
     - Roll: if `rand() < attackerWinChance` → attacker wins, change ownership[targetIndex] = attackerStateId
     - Record outcome in ConflictResult

   **Secession (Step 4)** (if `enableSecession = true`):
   - For each state with size > 1:
     - Find border tiles (tiles with at least one neighbor owned by different state or ocean)
     - `borderPressure = borderTileCount / max(1, state.size)`
     - For each border tile:
       - `distanceFactor = enableCapitalDistanceUnrest ? clamp(hexDistance(tile, capital) / 15, 1.0, 2.0) : 1.0`
       - `chance = clamp(secessionRate * tile.obstacle * borderPressure * distanceFactor, 0, 0.05)`
       - If `rand() < chance`: secede → create new 1-tile state, update ownership
       - Record SecessionEvent

   **Disconnected splitting (Step 5)** (if `enableDisconnectedSplit = true`):
   - For each state: run `bfsConnectedComponents` on its tile indices using `landNeighborIndices`
   - If multiple components found: keep largest for original state, create new 1-tile states for others
   - Use StateManager to allocate new states

   **`serialize()` / `deserialize()`**: JSON round-trip of SimState (convert Int32Array and Sets to arrays for JSON)

   Acceptance: All SimulationEngine tests pass; 100-step simulation produces consolidation

### Technical Decisions
- Language: TypeScript strict mode
- No external dependencies (pure TypeScript logic, no npm packages beyond dev)
- Use `Int32Array` for `ownership` (typed array, fast access)
- Use `Set<number>` for `state.tileIndices`
- All randomness through the single RNG instance created in constructor
- Default SimSettings values: baseConflictRate=0.3, seaConquestChance=0.1, secessionRate=0.3, geographyDifficulty=1.0, productivityInfluence=1.0, all toggles=true

### Dependencies
- Depends on: infra (Wave 1) — imports from `src/types/`, `src/simulation/rng.ts`, `src/simulation/hexUtils.ts`
- Depended on by: ui (Wave 3) — imports WorldGenerator, SimulationEngine, StateManager

### Interfaces to Preserve
The exact class signatures from the architecture Interface Contracts must be preserved. The UI lead will import these classes directly.

### Out of Scope
- React components, rendering, canvas drawing (Wave 3)
- CSS styling (Wave 1 + Wave 3)
- User interaction handling (Wave 3)
```

---

### Payload: UI → @frontend-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/project/2026-06-07-202651-architecture-world-simulator.md
- **Launch Plan**: .plans/project/2026-06-07-202651-launch-plan-world-simulator.md
- **Execution Mode**: sequential
- **Workstream**: ui — Wave 3 of 3
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Confirm you have read the architecture plan, delegation protocol, will follow 7-gate sequence, will present execution plan for approval, and acknowledge sequential Wave 3 position.

---

## Workstream: UI & Renderer — @frontend-lead
**Architecture Reference**: `.plans/project/2026-06-07-202651-architecture-world-simulator.md`
**Launch Plan Reference**: `.plans/project/2026-06-07-202651-launch-plan-world-simulator.md`

### Execution Context
- **Mode**: sequential
- **Wave**: 3 of 3
- **Parallel peers**: none
- **Prerequisites**: Wave 2 (engine) merged to `main` — run `git pull origin main` first
- **Codespace/Session**: sequential session #3
- **Sync point**: Final wave — merge `feature/ui/world-simulator-renderer` to `main` to complete the project

### Context
All simulation logic (WorldGenerator, SimulationEngine, StateManager) is complete from Wave 2. The project scaffold and types are complete from Wave 1. This workstream builds the full visual experience: Canvas hex renderer, React UI shell, control panel, stats panel, charts, tooltips, educational overlays, and wires everything together into a fully interactive browser application.

### Scope
Implement all renderer classes, all React components, all CSS styling, and integrate the full application. Write the README. The result must be a fully working, visually polished simulation that runs with `npm run dev`.

### Tasks

1. **Implement `src/renderer/AnimationController.ts`**
   - Track per-tile animations with type ("conquest" | "secession") and remaining duration
   - `markConquest(tileIndex)`: start 600ms flash animation (gold color flash)
   - `markSecession(tileIndex)`: start 800ms flash animation (red outline flash)
   - `tick(deltaMs)`: decrement all animation timers, clear expired ones
   - `getFlashIntensity(tileIndex)`: return 0-1 interpolated from remaining/total duration
   - `getFlashType(tileIndex)`: return type or null
   - Acceptance: flash intensities decay smoothly over specified duration

2. **Implement `src/renderer/MapModes.ts`**
   - `getTileColor(tile, mode, stateColor, animated)`: return CSS hex string
   - Modes:
     - "political": blend terrain base color (60%) + state color (40%); ocean = #1a3a5c
     - "terrain": pure terrain colors (ocean=#1a3a5c, plains=#8fa85a, river_valley=#6db56d, forest=#4a7c45, hills=#9a8c6e, mountains=#888888, desert=#d4b483, tundra=#c8d4e0)
     - "productivity": green heatmap (low=#1a2a1a, high=#00ff88) for land; ocean=#1a3a5c
     - "obstacle": red heatmap (low=#1a1a2a, high=#ff4444) for land; ocean=#1a3a5c
   - Apply conquest flash: lerp tile color toward #ffd700 at intensity
   - Apply secession flash: lerp tile color toward #ff4444 at intensity
   - Acceptance: colors look correct visually and match specifications

3. **Implement `src/renderer/HexRenderer.ts`**
   - Constructor takes canvas element and WorldData; computes hex pixel layout (flat-top hexagons)
   - HEX_SIZE: 12px by default (adjustable)
   - Pixel center of tile (q,r): standard flat-top axial-to-pixel formula
     - x = HEX_SIZE * (3/2 * q) + offsetX
     - y = HEX_SIZE * (sqrt(3) * (r + q/2)) + offsetY
   - `render(simState, uiState, animations)`:
     - Clear canvas
     - For each tile: draw filled hexagon with color from MapModes
     - Draw state borders: for each edge between tiles of different states, draw a slightly darker or white border line (1.5px)
     - Draw ocean slightly darker blue for depth
     - Highlight hovered tile with white outline (1.5px, dashed)
     - Highlight selected state tiles with bright white outline
     - Apply animation overlays from AnimationController
   - `getTileAtPixel(x, y)`: reverse the pixel-to-hex transform; return tile index or null
   - `resize(w, h)`: update canvas size, recompute offsets to center grid
   - Use flat-top hexagon vertex formula: vertex k at angle (60° * k)
   - Acceptance: map renders correctly, tiles are correctly sized and positioned

4. **Implement `src/SimulationContext.tsx`** (React context)
   - Holds: world, engine, stateManager, uiState, setUIState, renderer ref
   - On mount: create WorldGenerator, generate world with default config+seed, create engine+stateManager, initialize
   - Expose methods: playPause, stepOnce, resetSim, randomizeWorld, changeSettings, changeSeed
   - Simulation loop: use setInterval at `uiState.speed` ms; call engine.step(), update state, trigger re-render
   - After each step: call animationController.markConquest for each conquest, markSecession for each secession
   - RAF loop: continuous canvas redraw via requestAnimationFrame using latest state
   - Acceptance: play/pause/step all work correctly; simulation advances on play

5. **Implement `src/ui/MapCanvas.tsx`**
   - Hosts canvas element via `useRef`
   - On mount: create HexRenderer, AnimationController; wire to context
   - Handle mouse events: `onMouseMove` → call `getTileAtPixel` → update `hoveredTileIndex`; `onClick` → select state
   - Handle window resize: call `renderer.resize()`
   - Acceptance: canvas renders map; hover and click work

6. **Implement `src/ui/ControlPanel.tsx`**
   - Left sidebar panel
   - Play/Pause button (with icon)
   - Step Once button
   - Reset button
   - Randomize World button
   - Seed input (text field, updates on Enter)
   - Speed slider (50ms – 2000ms, logarithmic)
   - Conflict Frequency slider (0.1 – 1.0)
   - Sea Conquest Likelihood slider (0.0 – 0.5)
   - Secession Rate slider (0.0 – 1.0)
   - Geography Difficulty slider (0.2 – 2.0)
   - Productivity Influence slider (0.2 – 2.0)
   - Section: Toggles (4 checkboxes with labels)
   - Map mode selector (4 buttons: Political / Terrain / Productivity / Obstacle)
   - Save / Load JSON buttons
   - Export Map (screenshot) button
   - Each slider shows its current value
   - Acceptance: all controls are functional and wired to simulation context

7. **Implement `src/ui/StatsPanel.tsx`**
   - Right sidebar, top section
   - Display all SimStats fields with labels:
     - Turn / Year
     - Number of States
     - Largest State (size + % of land)
     - Average State Size
     - Herfindahl Index (with color coding: high=fragmented, low=unified)
     - Conflicts This Turn
     - Conquests This Turn
     - Secessions This Turn
     - Total Land Tiles
     - Continent Unification Scores (one per continent with label)
   - Update on every simulation step
   - Acceptance: stats display correctly and update in real time

8. **Implement `src/ui/Charts.tsx`**
   - SVG line charts (200px tall each), 3 charts stacked:
     1. Number of states over time
     2. Largest state share (0-100%) over time
     3. Herfindahl index (0-1) over time
   - Use `chartHistory` ring buffer (max 500 points) from UIState
   - Each chart: axis labels, grid lines, smooth SVG path (use `d="M ... L ... L ..."`)
   - Color-coded lines (states=blue, share=green, HHI=orange)
   - Auto-scale Y axis per chart
   - Acceptance: charts update in real time; smooth rendering at 60fps

9. **Implement `src/ui/Tooltip.tsx`**
   - Floating tooltip shown when hoveredTileIndex is non-null
   - Display: Terrain type, Productivity (0.00-1.00), Obstacle value, State name, State size, State power
   - Position near cursor (avoid overflow at screen edges)
   - Acceptance: tooltip appears on hover with correct data

10. **Implement `src/ui/InfoPanel.tsx`**
    - Show when a state is selected (click on map)
    - Display: State name (editable inline), State ID, Continent, Size, Power, Capital tile
    - Show list of terrain types in state
    - "Rename" button or inline edit
    - "Deselect" button
    - Acceptance: click on state shows panel; rename works

11. **Implement `src/ui/EducationPanel.tsx`**
    - Bottom bar, rotating tips every 8 seconds
    - Tips (cycle through these):
      - "Fertile areas generate stronger states."
      - "Mountains and deserts slow conquest."
      - "Large states with long frontiers fragment more easily."
      - "Seas make cross-continental conquest rare."
      - "The Herfindahl index measures political concentration — higher means more fragmented."
      - "Productivity influences which states initiate conflict."
      - "The Geography Difficulty slider amplifies terrain barriers."
    - Acceptance: tips rotate smoothly with fade transition

12. **Implement `src/ui/Legend.tsx`**
    - Compact legend panel showing color meanings for current map mode
    - Political: state count badge
    - Terrain: colored squares for each terrain type
    - Productivity/Obstacle: gradient bar (low → high)
    - Acceptance: legend updates when map mode changes

13. **Implement `src/App.tsx` (final)**
    - Three-column layout: [ControlPanel] [MapCanvas] [StatsPanel + Charts + InfoPanel]
    - Bottom bar: EducationPanel
    - Top bar: title + map mode selector + Legend
    - Wrap everything in SimulationContext provider
    - Responsive: canvas takes remaining space
    - Dark mode by default (uses global.css variables)
    - Acceptance: full app renders and is playable

14. **Save/Load and Export**
    - Save JSON: call `engine.serialize()`, trigger browser download of JSON file
    - Load JSON: file input → `engine.deserialize(json)` → reset UI state
    - Export screenshot: `canvas.toDataURL('image/png')` → trigger download
    - Acceptance: save/load round-trip preserves simulation state; screenshot downloads PNG

15. **Write README.md** (final project README)
    - Title + description
    - Features list
    - Quick start: `npm install && npm run dev`
    - Controls reference (all sliders/toggles explained)
    - Map modes explained
    - How the simulation works (brief educational section)
    - Attribution: inspired by NBER state-formation research
    - Acceptance: README is clear and complete

### Technical Decisions
- CSS: dark mode, CSS custom properties from global.css, CSS modules per component
- Canvas: flat-top hexagon layout, HEX_SIZE=12 default
- Animation: requestAnimationFrame loop for canvas; AnimationController for per-tile state
- Charts: pure SVG (no chart library dependency)
- Font: Inter (system fallback acceptable)
- Layout: CSS Grid for 3-column app layout

### Dependencies
- Depends on: engine (Wave 2) — imports WorldGenerator, SimulationEngine, StateManager
- Depends on: infra (Wave 1) — imports all types, rng, hexUtils, CSS foundation
- Depended on by: nothing (final wave)

### Out of Scope
- Backend, server, database (none needed)
- WorldGenerator, SimulationEngine, StateManager implementation (already done in Wave 2)
```

---

## Reproducibility Checksum

- **Architecture Hash**: 2026-06-07 (plan version 1, no prior instances)
- **Plan Version**: 1
- **Prior Instances**: none
