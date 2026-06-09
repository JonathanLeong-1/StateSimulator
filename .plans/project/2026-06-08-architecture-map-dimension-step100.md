# Architecture: Map Dimension 4x Expansion + Step ×100 Button
- **Date**: 2026-06-08
- **Architect**: architect
- **Status**: approved
- **Feature Fingerprint**: map-dimension-step100

---

## Feature Fingerprint

- **Canonical Name**: `map-dimension-step100`
- **Aliases**: 4x map area, bigger map, 160x100 grid, step 100, step N, bulk step
- **Category**: feature

---

## Project Summary

World-Simulator is a browser-based hex-grid geopolitical simulation (React 18 + TypeScript + Vite 5, HTML5 Canvas). This architecture document covers two additive changes:

- **Feature A** — Expand the simulation world from 80×50 (4,000 tiles) to 160×100 (16,000 tiles, 4× area).
- **Feature B** — Add a "Step ×100" control that advances the simulation by exactly 100 turns in a single synchronous batch without animating intermediate frames.

---

## Architecture Style

Single-workstream additive patch on the existing modular SPA (React + Canvas + TypeScript). No new modules, services, or infrastructure components are introduced. All changes are contained within the existing frontend module boundaries.

### Architecture Style Justification

Both features are small, scoped modifications to an already-implemented SPA. No new bounded context emerges; no inter-service boundary is crossed. A single-workstream sequential execution is the correct choice.

---

## Problem Statement

### Feature A — 4× Map Area
The simulation world is hard-coded to 80×50 tiles in two locations. Increasing to 160×100 creates a more geopolitically rich starting canvas. The WorldGenerator already computes landmass placement relative to `width`/`height` fractions, so no generation algorithm changes are required.

### Feature B — Step ×100
Users wishing to fast-forward to late-game states must click "⏭ Step" 100 times manually. A single-click bulk-step action eliminates this friction. Because the engine is deterministic and synchronous, 100 sequential `step()` calls are safe and cheap; no web worker or async scheduling is needed.

---

## Application Layers

### Frontend
- **Type**: SPA (existing)
- **Framework**: React 18 + TypeScript + Vite 5 (existing)
- **Key views modified**:
  - `SimulationContext.tsx` — world dimensions + new `stepN` action
  - `MapBuilderContext.tsx` — builder grid dimensions
  - `ControlPanel.tsx` — new UI button

### Backend / API
- None — this is a fully client-side application.

### Data Layer
- No schema changes. `WorldData` and `SimulationState` structures are unchanged; the tile count grows from 4,000 to 16,000 but the shape is identical.

### Background Processing
- None required. 100 synchronous `engine.step()` calls complete in well under 100 ms on modern hardware for a 16,000-tile world.

### External Integrations
- None.

---

## Infrastructure Components
All unchanged from the base architecture. This is a Vite SPA with no server-side components.

---

## Cross-Cutting Concerns

### Auth
Not applicable.

### Testing Strategy
- Update existing unit tests that assert hard-coded 80×50 dimensions to 160×100.
- Add new unit tests for `stepN(100)` behavior (turn count, isPlaying flag).
- Run full test suite (`npm test`) before merge.

### CI/CD
- Single feature branch: `feature/frontend/map-dimension-step100`
- Standard gate sequence (0–7) per project standards.
- Merge to `main` via PR after all gates pass.

---

## Repository Structure (changed files only)

```
src/
  SimulationContext.tsx              ← Feature A: dimensions; Feature B: stepN()
  ui/
    ControlPanel.tsx                 ← Feature B: Step ×100 button
    mapbuilder/
      MapBuilderContext.tsx          ← Feature A: WIDTH/HEIGHT constants
  simulation/
    SimulationEngine.test.ts         ← Regression: update 80/50 → 160/100
    WorldGenerator.test.ts           ← Regression: update 80/50 → 160/100
    StateManager.test.ts             ← Regression: verify / update if needed
```

---

## Naming Conventions

- **Branch**: `feature/frontend/map-dimension-step100`
- **Files**: existing naming conventions unchanged
- **Classes/Functions**: `stepN` (camelCase, consistent with `stepOnce`)
- **API Routes**: N/A
- **Commit format**: `feat(frontend): <description>`

---

## Interface Contracts

### New context action: `stepN(n: number): void`

```typescript
// Added to SimulationContextValue (src/SimulationContext.tsx)
stepN: (n: number) => void;
```

**Behavior contract**:
1. If `uiState.isPlaying === true`, set `isPlaying = false` (pause) before stepping.
2. Call `engine.current.step()` exactly `n` times synchronously in a loop.
3. After the loop, call `setSimState(engine.current.getState())` once to flush to React.
4. The resulting `uiState.isPlaying` is `false` regardless of entry state.
5. `n` must be a positive integer; callers are responsible for passing valid values.

### ControlPanel prop addition

`stepN` is consumed from `useSimulation()` context — no prop drilling changes required.

### Dimension constants

| Location | Before | After |
|---|---|---|
| `src/SimulationContext.tsx` `buildWorld()` | `width: 80, height: 50` | `width: 160, height: 100` |
| `src/ui/mapbuilder/MapBuilderContext.tsx` | `const WIDTH = 80; const HEIGHT = 50;` | `const WIDTH = 160; const HEIGHT = 100;` |

### Event / State Contracts

No new events. The existing `SimulationState` type is unchanged — only tile count grows.

### Configuration Blueprint

No environment variables or feature flags introduced. Dimensions are compile-time constants.

---

## File-by-File Change Plan

| File | Change |
|---|---|
| `src/SimulationContext.tsx` | 1. Change `width: 80` → `width: 160` and `height: 50` → `height: 100` inside `buildWorld()`. 2. Implement `stepN(n: number): void`. 3. Add `stepN` to the context value object and to the `SimulationContextValue` type. |
| `src/ui/mapbuilder/MapBuilderContext.tsx` | Change `const WIDTH = 80` → `const WIDTH = 160` and `const HEIGHT = 50` → `const HEIGHT = 100`. |
| `src/ui/ControlPanel.tsx` | Import `stepN` from `useSimulation()`. Add `<button className={styles.btn} onClick={() => stepN(100)} disabled={isPlaying}>⏭+100</button>` immediately after the existing "⏭ Step" button in the first `buttonRow` div. |
| `src/simulation/SimulationEngine.test.ts` | Update any hard-coded 80/50 expectations to 160/100. Add test: call `engine.step()` 100 times on a 160×100 world; assert `engine.getState().turn === 100`. |
| `src/simulation/WorldGenerator.test.ts` | Update any hard-coded 80/50 expectations to 160/100. Add/update test: `generate({ width: 160, height: 100, seed: 1, seaConquestRadius: 3 })` → `result.tiles.length === 16000`. |
| `src/simulation/StateManager.test.ts` | Inspect for dimension-dependent expectations; update 80/50 → 160/100 where found. |

---

## Test Specifications

### Unit — WorldGenerator (WorldGenerator.test.ts)

```
Test: "generates exactly 16,000 tiles for 160×100 world"
  Input: generate({ width: 160, height: 100, seed: 1, seaConquestRadius: 3 })
  Assert: result.tiles.length === 16000
```

### Unit — SimulationEngine (SimulationEngine.test.ts)

```
Test: "100 sequential step() calls advance turn to 100 on 160×100 world"
  Setup: construct engine with generate({ width: 160, height: 100, seed: 42, seaConquestRadius: 3 })
  Action: for (let i = 0; i < 100; i++) engine.step()
  Assert: engine.getState().turn === 100
```

### Integration — stepN (SimulationContext or dedicated stepN.test.ts)

```
Test: "stepN(100) while paused: advances turn by 100, isPlaying remains false"
  Setup: render SimulationContext with isPlaying = false, initial turn = 0
  Action: call stepN(100)
  Assert: engine.getState().turn === 100; uiState.isPlaying === false

Test: "stepN(100) while playing: pauses first, then advances turn by 100"
  Setup: render SimulationContext with isPlaying = true
  Action: call stepN(100)
  Assert: uiState.isPlaying === false; engine.getState().turn === 100
```

### Regression

All pre-existing tests in `src/simulation/*.test.ts` and `src/renderer/*.test.ts` must continue to pass unchanged (aside from dimension literal updates).

---

## Expected Output Manifest

| Workstream | Files Modified | New Exports / Behavior | Test Files Updated |
|---|---|---|---|
| frontend | `src/SimulationContext.tsx`, `src/ui/ControlPanel.tsx`, `src/ui/mapbuilder/MapBuilderContext.tsx` | `stepN(n)` action exported from context | `src/simulation/SimulationEngine.test.ts`, `src/simulation/WorldGenerator.test.ts`, `src/simulation/StateManager.test.ts` |

---

## Acceptance Criteria

1. `WorldGenerator.generate({ width: 160, height: 100, seed: 1, seaConquestRadius: 3 })` produces exactly 16,000 tiles.
2. `SimulationContext.buildWorld()` calls the generator with `width: 160, height: 100`.
3. MapBuilder initialises a 160×100 grid (WIDTH=160, HEIGHT=100).
4. "⏭+100" button is visible in ControlPanel, positioned next to the existing "⏭ Step" button.
5. Clicking "⏭+100" while paused: simulation stays paused; turn count advances by exactly 100.
6. Clicking "⏭+100" while playing: simulation pauses first, then advances by exactly 100, then remains paused.
7. Existing play/pause, single-step, reset, and randomize controls function identically to before.
8. `npm test` (vitest) passes with no failures.
9. `npm run build` (vite build) succeeds with no type errors.

---

## Out-of-Scope Items

- Web worker offloading for `stepN` — synchronous execution is sufficient at 16,000 tiles.
- User-configurable step count (e.g., "step ×N" input field) — only step-100 is in scope.
- Map dimension configurability via UI — dimensions remain compile-time constants.
- Performance profiling or render optimisation for the larger map — tracked separately if needed.
- Any changes to WorldGenerator terrain algorithms, state formation logic, or simulation formulas.
- Any changes to HexRenderer, AnimationController, or MapModes.

---

## Reproducibility Notes

- Vitest is the test runner (`npm test`). Tests live in `*.test.ts` files co-located with source.
- TypeScript strict mode is enabled. All new types must satisfy the strict compiler.
- The `SimulationContextValue` type (inferred from context value object) must include `stepN`.
- Follow existing camelCase function naming; `stepN` matches the pattern of `stepOnce`.
- React state update after batch loop: use the existing `setSimState` setter — do NOT call `setState` inside the loop.
- `engine` is a `useRef` — access via `engine.current`.

---

## Approval
- Approved by: human user
- Approved at: 2026-06-08
