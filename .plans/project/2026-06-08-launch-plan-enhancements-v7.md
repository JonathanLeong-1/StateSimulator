# Launch Plan: Simulation Randomization + MapBuilder Eurasia Preset — v7
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Architecture Ref**: `.plans/project/2026-06-08-architecture-enhancements-v7.md`
- **Feature Fingerprint**: sim-randomization + mapbuilder-eurasia-preset

---

## Execution Mode
Local sequential. One frontend workstream.

## Branch
`feature/frontend/sim-randomization-mapbuilder-eurasia`

---

## Gate 0: Pre-approved. Proceed immediately.

---

## Gate 1 — Branch Creation
```bash
git checkout -b feature/frontend/sim-randomization-mapbuilder-eurasia
```

---

## Gate 2 — Developer Delegation Payload

**Plan ref**: `.plans/project/2026-06-08-architecture-enhancements-v7.md`
**Branch**: `feature/frontend/sim-randomization-mapbuilder-eurasia`
**Task**: Implement the two-feature v7 patch per the architecture document.

### Step A — `src/simulation/StateManager.ts`

Add an explicit constructor that accepts an optional `colorSeed` parameter. Use it to Fisher-Yates shuffle `colorPool` so state colors vary per run.

The existing field declarations remain. Only add:

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

Add the import at the top of the file:
```typescript
import { mulberry32 } from './rng';
```

### Step B — `src/simulation/SimulationEngine.ts`

1. Add `private seed: number;` to the class fields.
2. Change the constructor signature to `constructor(world: WorldData, settings: SimSettings, simSeed?: number)`.
3. Replace the RNG initialization block:
```typescript
const seed = simSeed !== undefined
  ? simSeed
  : (Date.now() ^ (Math.random() * 0xffffffff | 0)) >>> 0;
this.seed = seed;
this.stateManager = new StateManager(seed);
this.rng = mulberry32(seed);
```
Remove the old `this.stateManager = new StateManager();` and `this.rng = mulberry32(world.tiles.length);` lines.

### Step C — `src/ui/mapbuilder/MapBuilderContext.tsx`

1. Add `loadEurasia: () => void;` to the `MapBuilderContextValue` interface.
2. Add the implementation callback inside `MapBuilderProvider`, after `loadMap`:
```typescript
const loadEurasia = useCallback(() => {
  fetch('/eurasia.worldmap.json')
    .then(r => r.text())
    .then(loadMap)
    .catch(err => console.error('Failed to load Eurasia map:', err));
}, [loadMap]);
```
3. Add `loadEurasia` to the `value` object.

### Step D — `src/ui/mapbuilder/MapBuilderPanel.tsx`

In the GENERATE section, add a "🗺 Eurasia" button between "🎲 Random Continents" and "🗑 Clear Map":
```tsx
<button className={styles.btn} onClick={ctx.loadEurasia}>🗺 Eurasia</button>
```

### Acceptance Criteria
- Running the same map twice produces visibly different political outcomes and different state colors
- Passing an explicit `simSeed` to `SimulationEngine` still produces deterministic results
- "🗺 Eurasia" button appears in Map Builder GENERATE panel and loads the Eurasia map into the editor
- All existing tests pass

---

## Gate 2.5 — Test Spec Readiness (Fallback: developer-suggested)

Tests to add:

1. **`src/simulation/SimulationEngine.test.ts`** — non-determinism by default:
```typescript
it('produces different results on two runs with no explicit seed', () => {
  const world = generator.generate({ width: 10, height: 10, seed: 1, seaConquestRadius: 2 });
  const e1 = new SimulationEngine(world, defaultSettings);
  const e2 = new SimulationEngine(world, defaultSettings);
  e1.initialize(); e2.initialize();
  for (let i = 0; i < 10; i++) { e1.step(); e2.step(); }
  const o1 = Array.from(e1.getState().ownership);
  const o2 = Array.from(e2.getState().ownership);
  // Statistically near-certain to differ; extremely unlikely to be identical
  expect(o1).not.toEqual(o2);
});
```

2. **`src/simulation/SimulationEngine.test.ts`** — determinism with explicit seed:
```typescript
it('produces identical results when given the same explicit seed', () => {
  const world = generator.generate({ width: 10, height: 10, seed: 1, seaConquestRadius: 2 });
  const e1 = new SimulationEngine(world, defaultSettings, 9999);
  const e2 = new SimulationEngine(world, defaultSettings, 9999);
  e1.initialize(); e2.initialize();
  for (let i = 0; i < 10; i++) { e1.step(); e2.step(); }
  expect(Array.from(e1.getState().ownership)).toEqual(Array.from(e2.getState().ownership));
});
```

3. **`src/simulation/StateManager.test.ts`** — color variation with different seeds:
```typescript
it('allocates different first-state colors for different colorSeeds', () => {
  const sm1 = new StateManager(1);
  const sm2 = new StateManager(999);
  const rng = mulberry32(0);
  const s1 = sm1.allocateState(0, null, rng);
  const s2 = sm2.allocateState(0, null, rng);
  expect(s1.color).not.toBe(s2.color);
});
```

---

## Gate 3 — Testing
Run: `npm test -- --run`

---

## Gate 4 — Code Review
Reviewer verifies:
- No commented-out code
- `SimulationEngine` existing call-sites all remain compatible (third param is optional)
- `StateManager` existing instantiation sites (only `SimulationEngine`) are updated
- Fetch in `loadEurasia` handles errors

---

## Gate 5 — Documentation
`@docs-writer` updates `README.md` to note that each simulation run is now unique by default.

---

## Gate 6 — Pre-Commit Checklist
- [ ] Branch: `feature/frontend/sim-randomization-mapbuilder-eurasia`
- [ ] All new tests present and passing
- [ ] No commented-out code
- [ ] No direct `main` commits
- [ ] `SimulationEngine` call-sites verified
- [ ] Fetch error handled in `loadEurasia`
- [ ] README updated
- [ ] Session log written

---

## Gate 7 — Commit & Report
Commit message:
```
feat(simulation): non-deterministic sim runs + mapbuilder Eurasia preset

- SimulationEngine now seeds RNG from Date.now() XOR Math.random by default,
  so each run on the same map produces a unique outcome
- StateManager shuffles colorPool with the same seed, varying state colors
- MapBuilderContext: add loadEurasia() fetching /eurasia.worldmap.json
- MapBuilderPanel: add 🗺 Eurasia button in GENERATE section
```
