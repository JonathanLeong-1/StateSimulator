# Launch Plan: Eurasia Preset + Circle Default — v6
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Architecture Ref**: `.plans/project/2026-06-08-architecture-enhancements-v6.md`
- **Feature Fingerprint**: eurasia-preset + circle-default

---

## Execution Mode
Local sequential. One frontend workstream.

## Branch
`feature/frontend/eurasia-preset-circle-default`

---

## Gate 0: Pre-approved. Proceed immediately.

---

## Gate 1 — Branch Creation
Create: `git checkout -b feature/frontend/eurasia-preset-circle-default`

---

## Gate 2 — Developer Delegation Payload

**Plan ref**: `.plans/project/2026-06-08-architecture-enhancements-v6.md`  
**Branch**: `feature/frontend/eurasia-preset-circle-default`  
**Task**: Implement the two-feature v6 patch per the architecture document.

### Step A — Copy the Eurasia data file

Copy `src/My-Map.worldmap (24).json` to `public/eurasia.worldmap.json`.

```bash
cp "src/My-Map.worldmap (24).json" public/eurasia.worldmap.json
```

Do NOT modify the file contents. Do NOT import it into the TypeScript bundle.

### Step B — `src/SimulationContext.tsx`

**Imports** — at the top, ensure these are imported (they may already be):
```typescript
import type { MapBuilderTile } from './types/mapbuilder';
import type { TerrainType } from './types/world';
import type { SavedCustomMap } from './types/mapbuilder';
```

**Add `buildCircleWorld`** — a module-level function alongside the existing `buildWorld` function:
```typescript
function buildCircleWorld(settings: SimSettings): { world: WorldData; engine: SimulationEngine } {
  const WIDTH = 160, HEIGHT = 100;
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const radius = 38;
  const rng = mulberry32(12345);

  const tiles: MapBuilderTile[] = [];
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    const q = i % WIDTH;
    const r = Math.floor(i / WIDTH);
    const dist = Math.sqrt((q - cx) ** 2 + (r - cy) ** 2);
    let terrain: TerrainType = 'ocean';
    if (dist <= radius) {
      const rRatio = r / HEIGHT;
      if (rRatio < 0.12 || rRatio > 0.88) {
        terrain = 'tundra';
      } else if (rRatio >= 0.35 && rRatio <= 0.65) {
        const roll = rng();
        terrain = roll < 0.6 ? 'plains' : roll < 0.8 ? 'river_valley' : 'forest';
      } else {
        terrain = rng() < 0.5 ? 'desert' : 'hills';
      }
      if (rng() < 0.15) terrain = 'mountains';
    }
    tiles.push({ index: i, q, r, terrain, productivityOverride: null });
  }

  const world = WorldGenerator.fromCustomMap(tiles, WIDTH, HEIGHT);
  const engine = new SimulationEngine(world, settings);
  engine.initialize();
  return { world, engine };
}
```

**Change initial `useEffect`** — replace the body so it calls `buildCircleWorld` instead of `buildWorld`:
```typescript
useEffect(() => {
  const { world: w, engine } = buildCircleWorld(settingsRef.current);
  engineRef.current = engine;
  setWorld(w);
  setSimState(engine.getState());
}, []);
```

**Change `resetSim`** — replace `buildWorld(numSeed, settingsRef.current)` with `buildCircleWorld(settingsRef.current)` and remove the `parseInt(seedRef.current, 10) || 42` line:
```typescript
const resetSim = useCallback(() => {
  const { world: w, engine } = buildCircleWorld(settingsRef.current);
  engineRef.current = engine;
  animControllerRef.current = new AnimationController();
  setWorld(w);
  setSimState(engine.getState());
  setUIState(prev => ({
    ...prev,
    isPlaying: false,
    chartHistory: [],
    hoveredTileIndex: null,
    selectedStateId: null,
  }));
}, []);
```

**Delete `randomizeWorld`** — remove the entire `const randomizeWorld = useCallback(...)` block.

**Add `loadEurasia`** — add alongside the other callbacks:
```typescript
const loadEurasia = useCallback(() => {
  fetch('/eurasia.worldmap.json')
    .then(r => r.json())
    .then((data: SavedCustomMap) => {
      const tiles: MapBuilderTile[] = data.tiles.map(t => ({
        index: t.index,
        q: t.index % data.width,
        r: Math.floor(t.index / data.width),
        terrain: t.terrain,
        productivityOverride: t.productivityOverride,
      }));
      const worldData = WorldGenerator.fromCustomMap(tiles, data.width, data.height);
      loadCustomWorld(worldData);
    })
    .catch(err => console.error('Failed to load Eurasia map:', err));
}, [loadCustomWorld]);
```

**Update `SimContextValue` interface**:
- Remove `randomizeWorld: () => void;`
- Add `loadEurasia: () => void;`

**Update provider value object**:
- Remove `randomizeWorld,` from the object
- Add `loadEurasia,`

### Step C — `src/ui/ControlPanel.tsx`

1. In the destructuring from `useSimulation()`, replace `randomizeWorld` with `loadEurasia`.
2. Replace the button:
```tsx
// Remove:
<button className={styles.btn} onClick={randomizeWorld}>🎲 Random</button>
// Add:
<button className={styles.btn} onClick={loadEurasia}>🗺 Eurasia</button>
```

---

## Gate 2.5 — Test Spec (fallback: developer suggested)

Add one new test to `src/simulation/WorldGenerator.test.ts`:
```typescript
it('buildCircleWorld produces land tiles only within radius 38 of center', () => {
  // Inline the buildCircleWorld logic or expose it; alternatively test via SimulationContext
  // Simplest: inline-replicate and check all land tiles
  const WIDTH = 160, HEIGHT = 100;
  const cx = WIDTH / 2, cy = HEIGHT / 2;
  const radius = 38;
  // Generate tiles using the same algorithm
  // Assert every land tile satisfies dist <= radius + 1 (allow 1 hex tolerance)
});
```

Since `buildCircleWorld` is a module-level function in `SimulationContext.tsx` (not exported), the test can replicate the circle geometry check directly in `WorldGenerator.test.ts` as a purity test on `fromCustomMap`.

---

## Gate 3 — Tester
Run `npm test` — all 102+ tests must pass. Report verdict.

---

## Gate 4 — Code Reviewer
Review the three changed files. Verify:
- `fetch` error is caught and logged
- `SavedCustomMap` type assertion is safe (data from a trusted local file)
- No reference to `randomizeWorld` remains in the codebase
- `buildCircleWorld` is deterministic (fixed seed 12345)
- CSS / button row layout still looks correct after removing one button

---

## Gate 5 — Docs Writer
Update `README.md`:
- In the controls section: replace mention of `🎲 Random` with `🗺 Eurasia`
- Note that the default map is a large circle
- Note that `↺ Reset` returns to the circle map

---

## Gate 6 — Pre-commit Checklist
- [ ] `public/eurasia.worldmap.json` exists and is valid JSON
- [ ] `npm run build` succeeds with no errors
- [ ] `npm test` — all tests pass
- [ ] No `randomizeWorld` references remain (`grep -r randomizeWorld src/`)
- [ ] App loads with circle on first visit
- [ ] Eurasia button loads Eurasia without console errors
- [ ] Reset returns to circle
- [ ] Random Continents still works

---

## Gate 7 — Commit & Merge
Commit message: `feat(frontend): Eurasia preset button and circle default world`
Merge `feature/frontend/eurasia-preset-circle-default` → `main`
