# Architecture: World Simulator Enhancements — v7
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Supersedes**: `.plans/project/2026-06-08-architecture-enhancements-v6.md` (additive patch)
- **Feature Fingerprint**: sim-randomization + mapbuilder-eurasia-preset

---

## Overview

Additive patch on top of v6. All prior features are implemented and merged to `main`.

This v7 covers two independent changes:

| # | Feature |
|---|---------|
| 1 | **Simulation randomization** — each run (same map or different) produces a unique outcome; state colors also vary per-run |
| 2 | **Eurasia preset in Map Builder** — "🗺 Eurasia" button in the Map Builder panel loads the saved Eurasia `.worldmap.json` directly into the editor |

---

## Feature 1: Simulation Randomization

### Problem
`SimulationEngine` hard-codes its RNG seed as `world.tiles.length`:
```typescript
this.rng = mulberry32(world.tiles.length);
```
Any simulation run on the same world map produces **identical** outcomes turn-for-turn.
Separately, `StateManager.colorPool` is always initialized as `[0, 1, 2, ..., 39]` so the same state-index always gets the same hue, making the political map look identical across resets.

### Solution

#### A — `src/simulation/SimulationEngine.ts`

**Constructor signature change** — add optional `simSeed` parameter:
```typescript
constructor(world: WorldData, settings: SimSettings, simSeed?: number) {
```

**Seed resolution** — if `simSeed` is not provided, derive one from `Date.now()` XOR-ed with a `Math.random` integer so each instantiation is unique:
```typescript
const seed = simSeed !== undefined
  ? simSeed
  : (Date.now() ^ (Math.random() * 0xffffffff | 0)) >>> 0;
this.rng = mulberry32(seed);
```

No other constructor changes; `world.tiles.length` is no longer used as a seed.

#### B — `src/simulation/StateManager.ts`

**Constructor** — accept an optional `colorSeed?: number` parameter and use it to perform a Fisher-Yates shuffle of `colorPool` before any states are allocated:

```typescript
constructor(colorSeed?: number) {
  if (colorSeed !== undefined) {
    const rng = mulberry32(colorSeed);
    for (let i = this.colorPool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [this.colorPool[i], this.colorPool[j]] = [this.colorPool[j], this.colorPool[i]];
    }
  }
}
```

#### C — `src/simulation/SimulationEngine.ts` (initialize)

Pass the same derived `seed` to `StateManager` so color assignment is also varied:
```typescript
this.stateManager = new StateManager(seed);
```

The `seed` value must be stored as a private field before it is forwarded:
```typescript
private seed: number;
// In constructor:
this.seed = seed;
this.stateManager = new StateManager(seed);
this.rng = mulberry32(seed);
```

> **Note**: `StateManager` currently has no explicit constructor. Add one. The rest of its initialization (field declarations) stays the same.

#### D — `src/SimulationContext.tsx`

No changes needed — `SimulationEngine` already takes `(world, settings)` and the new third parameter defaults to a random value. All existing call-sites remain valid.

### Invariants preserved
- The test suite already seeds the engine explicitly in tests. Any tests that pass a seed will continue to produce deterministic results because the optional parameter defaults only when omitted.
- `mulberry32` itself is unchanged and remains deterministic given the same input.

---

## Feature 2: Eurasia Preset in Map Builder

### Problem
The Map Builder's GENERATE section only has "🎲 Random Continents" and "🗑 Clear Map". There is no way to start from the user's saved Eurasia map without leaving the builder to use the main simulation's Eurasia button.

### Data file
`public/eurasia.worldmap.json` already exists (placed there by v6). No file changes needed.

### `src/ui/mapbuilder/MapBuilderContext.tsx` changes

**Interface addition** — add to `MapBuilderContextValue`:
```typescript
loadEurasia: () => void;
```

**Implementation** — add inside `MapBuilderProvider`, after the `loadMap` callback:
```typescript
const loadEurasia = useCallback(() => {
  fetch('/eurasia.worldmap.json')
    .then(r => r.text())
    .then(loadMap)
    .catch(err => console.error('Failed to load Eurasia map:', err));
}, [loadMap]);
```

**Provider value** — add `loadEurasia` to the `value` object:
```typescript
const value: MapBuilderContextValue = {
  state, applyBrush, setTool, setBrushSize, setSelectedBiome,
  setProductivityValue, setRandomEnabled, setName,
  generateRandomContinents, clearMap, saveMap, loadMap, loadEurasia,
  undo, redo, convertToWorldData,
};
```

### `src/ui/mapbuilder/MapBuilderPanel.tsx` changes

Destructure `loadEurasia` from `ctx` (it is already available via `useMapBuilder()`).

Add a button to the **GENERATE** section immediately after the "🎲 Random Continents" button:
```tsx
<button className={styles.btn} onClick={ctx.loadEurasia}>🗺 Eurasia</button>
```

Full GENERATE section after change:
```tsx
<div className={styles.section}>
  <div className={styles.sectionLabel}>GENERATE</div>
  <button className={styles.btn} onClick={ctx.generateRandomContinents}>🎲 Random Continents</button>
  <button className={styles.btn} onClick={ctx.loadEurasia}>🗺 Eurasia</button>
  <button className={styles.btn} onClick={ctx.clearMap}>🗑 Clear Map</button>
</div>
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/simulation/SimulationEngine.ts` | Add `simSeed` param; store as `this.seed`; pass to `StateManager`; use for `mulberry32` |
| `src/simulation/StateManager.ts` | Add constructor with `colorSeed` param; Fisher-Yates shuffle on `colorPool` |
| `src/ui/mapbuilder/MapBuilderContext.tsx` | Add `loadEurasia` callback + interface member + provider value |
| `src/ui/mapbuilder/MapBuilderPanel.tsx` | Add "🗺 Eurasia" button in GENERATE section |

---

## Test Additions

| File | Test |
|------|------|
| `src/simulation/SimulationEngine.test.ts` | Two engines with same world but no explicit seed produce different ownership arrays after 10 steps |
| `src/simulation/SimulationEngine.test.ts` | Two engines with same explicit seed produce identical ownership arrays after 10 steps (determinism preserved) |
| `src/simulation/StateManager.test.ts` | `StateManager` with different `colorSeed` values allocates states with different colors |
| `src/ui/mapbuilder/MapBuilderCanvas.test.tsx` | `loadEurasia` is present on the context value |
