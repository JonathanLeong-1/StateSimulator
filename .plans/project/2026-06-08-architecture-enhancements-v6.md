# Architecture: World Simulator Enhancements — v6
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Supersedes**: .plans/project/2026-06-08-architecture-enhancements-v5.md (additive patch)
- **Feature Fingerprint**: eurasia-preset + circle-default

---

## Overview

Additive patch on top of v5. All prior features are implemented and merged to `main`.

This v6 covers two UX changes to the main simulation UI:

| # | Feature |
|---|---------|
| 1 | **Eurasia preset button** — replace `🎲 Random` in `ControlPanel.tsx` with `🗺 Eurasia`, which loads the user's pre-drawn Eurasia map JSON into the simulation |
| 2 | **Circle default** — on app load the initial world is a large filled circle instead of the two-blob default |

---

## Feature 1: Eurasia Preset Button

### Problem
The `🎲 Random` button calls `randomizeWorld()` (a seeded two-blob generator). The user wants this replaced by a named "Eurasia" preset loaded from a saved `.worldmap.json` file.

### Data file placement
The source file `src/My-Map.worldmap (24).json` must be placed at **`public/eurasia.worldmap.json`** so Vite's dev server and the production build both serve it as a static asset at the root URL `/eurasia.worldmap.json`.

The file is a valid `SavedCustomMap` (version 1, width 160, height 100, 16000 tiles). Do **not** import it directly into the bundle — it is ~800 KB and would inflate the JS bundle. Fetch it lazily on button click.

### `SimulationContext.tsx` changes

**New context member:**
```typescript
loadEurasia: () => void;
```

**Implementation** (alongside the other callbacks):
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

**`SimContextValue` interface** — add the new member:
```typescript
loadEurasia: () => void;
```

**Provider value** — include `loadEurasia` in the returned object.

Also **remove** `randomizeWorld` from the provider value object and the `SimContextValue` interface (it is no longer exposed to the UI; `resetSim` still calls `buildWorld` internally, so `buildWorld` stays). Actually: keep `randomizeWorld` in the codebase to avoid breaking `resetSim`? No — `resetSim` uses `buildWorld` directly, not `randomizeWorld`. So `randomizeWorld` can be removed from the interface and provider value. The internal `randomizeWorld` callback can simply be deleted.

### `ControlPanel.tsx` changes

1. Destructure `loadEurasia` from `useSimulation()` (remove `randomizeWorld`).
2. In the button row that contained `🎲 Random`, replace the button:
   ```tsx
   // Before:
   <button className={styles.btn} onClick={randomizeWorld}>🎲 Random</button>
   // After:
   <button className={styles.btn} onClick={loadEurasia}>🗺 Eurasia</button>
   ```

---

## Feature 2: Large Circle Default Map

### Problem
`buildWorld()` generates a two-blob world split by an ocean band. The user wants the initial world to be a single large filled circle.

### Solution
Add a `buildCircleWorld(settings)` helper function **inside `SimulationContext.tsx`** (a module-level function alongside `buildWorld`). The initial `useEffect` and `resetSim` both change to call `buildCircleWorld`. The `changeSeed`/`randomizeWorld` paths are not affected (they use `buildWorld` still — but `randomizeWorld` is being deleted, so only `changeSeed` and `resetSim` remain in that path).

Actually, to keep the semantics clean:
- **App load (initial `useEffect`)**: call `buildCircleWorld`
- **`resetSim`**: call `buildCircleWorld` (so Reset brings back the circle, not the two-blob world)
- **`changeSeed`**: keep calling `buildWorld` (seeded two-blob generator — used for reproducible seeds)
- **`randomizeWorld`**: deleted (the button is replaced)

### `buildCircleWorld` implementation

```typescript
function buildCircleWorld(settings: SimSettings): { world: WorldData; engine: SimulationEngine } {
  const WIDTH = 160, HEIGHT = 100;
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const radius = 38;  // ~38% of height; fills roughly 76% of the map height as diameter
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

> Note: RNG calls only happen for land tiles (inside the circle). This is fine — the map is deterministic for a fixed `radius` and the seed 12345.

### `SimulationContext.tsx` changes summary

- Add `buildCircleWorld` function (module-level, alongside `buildWorld`)
- Initial `useEffect`:
  ```typescript
  useEffect(() => {
    const { world: w, engine } = buildCircleWorld(settingsRef.current);
    engineRef.current = engine;
    setWorld(w);
    setSimState(engine.getState());
  }, []);
  ```
- `resetSim`: replace `buildWorld(numSeed, ...)` with `buildCircleWorld(settingsRef.current)` — and remove the seed parsing since the circle has no seed parameter

---

## Acceptance Criteria

1. App loads showing a single large circle landmass with latitude-appropriate biomes (tundra at poles, tropical/subtropical bands, plains and forest at mid-latitudes).
2. `↺ Reset` button restores the large circle world (not a random two-blob world).
3. `🗺 Eurasia` button loads the Eurasia map; the simulation starts paused with the Eurasia geography.
4. `🌍 Random Continents` button is unchanged and continues to work.
5. All existing controls (play/pause, step, step×100, speed, settings sliders, seed input) work normally after loading Eurasia or resetting.
6. No `🎲 Random` button visible in the UI.
7. `public/eurasia.worldmap.json` is present and served at `/eurasia.worldmap.json`.

---

## Files Changed

| File | Change |
|------|--------|
| `public/eurasia.worldmap.json` | New file — copy of the user's Eurasia map |
| `src/SimulationContext.tsx` | Add `buildCircleWorld`, update init/reset, add `loadEurasia`, remove `randomizeWorld`, update context interface |
| `src/ui/ControlPanel.tsx` | Replace `🎲 Random` button with `🗺 Eurasia` |

---

## Files NOT Changed

- `src/simulation/WorldGenerator.ts` — `fromCustomMap` already exists; no new methods needed
- `src/ui/mapbuilder/` — untouched
- Any renderer or test files not related to these features

---

## Branch Strategy
- Branch: `feature/frontend/eurasia-preset-circle-default`

## Tests Required
- `src/simulation/WorldGenerator.test.ts` or `src/simulation/SimulationEngine.test.ts` — add one test: `buildCircleWorld` produces a world where all land tiles are within radius 38 from center (or equivalently `totalLandTiles > 0` and no land tile has `dist > 39`). Can be extracted as a module-level helper test.
- Verify existing 102 tests still pass.
- Manual: open the app, confirm circle loads; click Eurasia, confirm Eurasia shape loads; click Reset, confirm circle returns.
