# Architecture: UI Overhaul — Game-Style Dark Theme

- **Date**: 2026-06-08
- **Status**: APPROVED
- **Branch**: `feature/frontend/ui-overhaul`

---

## Overview

Full visual and structural overhaul of the World Simulator UI to produce a modern, dark, game-like aesthetic. Accent color is deep purple to match the logo. Changes touch every component but do not touch any simulation logic.

---

## Goals

| # | Goal |
|---|------|
| 1 | Dark game aesthetic with deep-purple accent, gradients, and glow effects |
| 2 | Eurasia map loads by default on startup |
| 3 | Controls (Play, Step, map, mode) are the most visually prominent UI elements |
| 4 | Remove Charts panel and Continent Unification section |
| 5 | StatsPanel is collapsible; gains a top-10 state leaderboard at the top |
| 6 | Map Builder biome selector and biome reference legend merged into one component |

---

## Design System

### Token changes in `src/styles/global.css`

```css
:root {
  --color-bg:           #0a0a12;
  --color-surface:      #12121e;
  --color-surface-2:    #1a1a2e;
  --color-border:       rgba(124, 58, 237, 0.18);
  --color-text:         #e2e8f0;
  --color-text-muted:   #94a3b8;

  /* Accent — deep purple */
  --color-accent:       #7c3aed;
  --color-accent-light: #a855f7;
  --color-accent-glow:  rgba(124, 58, 237, 0.35);

  /* Button gradients */
  --grad-primary:       linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  --grad-primary-hover: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);

  /* Misc */
  --color-ocean:        #1a3a5c;
  --radius-card:        10px;
  --shadow-card:        0 4px 24px rgba(0,0,0,0.6);
  --font-sans:          'Inter', system-ui, -apple-system, sans-serif;
}
```

### Button styles

**Primary action (Play)** — large gradient, purple glow on hover:
```css
background: var(--grad-primary);
box-shadow: 0 0 0 rgba(124,58,237,0);
transition: box-shadow 0.2s, filter 0.2s;
&:hover { box-shadow: 0 0 16px var(--color-accent-glow); filter: brightness(1.1); }
```

**Secondary/normal buttons** — dark surface, purple-tinted border:
```css
background: var(--color-surface-2);
border: 1px solid var(--color-border);
&:hover { border-color: var(--color-accent); color: var(--color-accent-light); }
```

**Active/selected state (map mode buttons)** — purple fill:
```css
background: var(--color-accent);
color: #fff;
box-shadow: 0 0 8px var(--color-accent-glow);
```

---

## File-by-File Specification

### 1. `src/styles/global.css`
Replace all CSS custom properties with the new design tokens above.

---

### 2. `src/styles/App.module.css`
- `.topBar`: taller (`height: 52px`), background uses `var(--color-surface)` with a subtle bottom border `1px solid var(--color-border)`, add `backdrop-filter: blur(8px)`.
- `.appTitle`: larger (`font-size: 18px`), letter-spacing `0.04em`, gradient text using `--grad-primary`.
- `.modeToggleBtn`: pill shape, gradient background, white text.
- `.rightColumn`: width unchanged (300px), but use `var(--color-surface)` background.

---

### 3. `src/styles/ControlPanel.module.css`
- `.panel`: wider (`width: 250px; min-width: 250px`), darker background `var(--color-surface)`.
- `.title`: remove (panel title is moved to topBar app title).
- `.section`: `border-bottom: 1px solid var(--color-border)`.
- `.primaryBtn` (Play/Pause): full-width, height `44px`, font-size `15px`, font-weight `700`, gradient background, uppercase, letter-spacing, glow on hover.
- `.btn`: apply secondary button style above; padding `6px 10px`, font-size `12px`, rounded `6px`.
- `.modeButtons`: 2×2 grid.
- `.modeActive`: purple fill + glow.
- `.modeBtn`: secondary style.
- `.label`: uppercase, letter-spacing `0.06em`, font-size `10px`.
- `.slider`: `accent-color: var(--color-accent)`.

---

### 4. `src/ui/ControlPanel.tsx`

**Structural changes:**
1. Move Play/Pause to its own prominent top section — full-width button, `height: 44px`.
2. Step and ×100 sit below Play in a row.
3. Reset, Eurasia, Random Continents sit in another row below.
4. Map Mode section — promote to just below transport controls, using a 2×2 button grid.
5. Speed slider and simulation parameters remain below in collapsible/sections.
6. Save/Load/Export moved to bottom.

No logic changes — only layout/class changes.

---

### 5. `src/styles/StatsPanel.module.css`
- Add `.header` — clickable row with title + toggle icon (▶/▼), cursor pointer.
- Add `.leaderboard` — table-like list for top-10.
- Add `.lbRow` — flex row: color swatch + name + tile count + %.
- Add `.lbSwatch` — 10×10px rounded square.
- Add `.lbRank` — muted rank number.
- Add `.lbPct` — right-aligned percentage.
- Keep `.grid` for statistics metrics below the leaderboard.
- Remove `.continents` / `.contRow` styles.

---

### 6. `src/ui/StatsPanel.tsx`

**Structural changes:**
1. Add `const [collapsed, setCollapsed] = useState(false)` state.
2. Header is a clickable `<div>` that toggles `collapsed`; shows `▼ Statistics` or `▶ Statistics`.
3. When `collapsed === true`, render only the header.
4. When expanded, render in order:
   a. **Leaderboard** — top 10 states sorted by `size` descending. Each row:
      - Rank number (1–10)
      - Color swatch (`state.color`)
      - State name (`state.name`)
      - Tile count (`state.size`)
      - % control (`(state.size / stats.totalLandTiles * 100).toFixed(1) + '%'`)
   b. **Stats grid** — Turn, Year, States, Largest State, Avg Size, HHI, Conflicts, Conquests, Secessions, Land Tiles (same as current).
5. Remove Continent Unification section entirely.

**Leaderboard data derivation:**
```typescript
const topStates = Array.from(simState.states.values())
  .sort((a, b) => b.size - a.size)
  .slice(0, 10);
```

---

### 7. `src/App.tsx`

1. Remove `import { Charts } from './ui/Charts'`.
2. Remove `<Charts />` from the `rightColumn` div.
3. Keep `<StatsPanel />` and `<InfoPanel />`.

No other changes.

---

### 8. `src/SimulationContext.tsx` — Default to Eurasia

Change the mount `useEffect` (currently calls `buildCircleWorld`) to fetch the Eurasia map instead, with `buildCircleWorld` as a fallback:

```typescript
useEffect(() => {
  fetch(`${import.meta.env.BASE_URL}eurasia.worldmap.json`)
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
      const engine = new SimulationEngine(worldData, settingsRef.current);
      engine.initialize();
      engineRef.current = engine;
      setWorld(worldData);
      setSimState(engine.getState());
    })
    .catch(() => {
      // fallback if asset unavailable (e.g., unit tests)
      const { world: w, engine } = buildCircleWorld(settingsRef.current);
      engineRef.current = engine;
      setWorld(w);
      setSimState(engine.getState());
    });
}, []);
```

---

### 9. `src/ui/mapbuilder/MapBuilderPanel.tsx` — Merged Biome Selector

**Remove:** the separate `BIOME_LEGEND` reference table section entirely.

**Change the biome selector section** to a unified grid where each cell shows:
- Color swatch (square, 16×16px)
- Biome name (e.g. "Plains")
- Productivity value (e.g. "~0.70")
- Clicking selects that biome (sets `selectedBiome`)
- Selected biome has a purple border/glow

Use `BIOME_LEGEND` (already defined at the top of the file) to drive the cells, skipping `ocean` (ocean is already handled as a tool, not a biome). Each cell is a `<button>` with a column-flex layout.

**Keep:** Tools section (paint-ocean, paint-land, paint-biome, paint-productivity) unchanged.

---

### 10. `src/ui/mapbuilder/MapBuilderPanel.module.css`

Add `.biomeGrid` — `display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px`.
Add `.biomeCard` — card button with swatch, name, productivity; border on hover.
Add `.biomeCardActive` — purple border + glow.
Add `.biomeSwatch` — colored square 16×16.
Add `.biomeProductivity` — small muted text for productivity value.

---

## Acceptance Criteria

1. App loads Eurasia map by default.
2. Play button is the most visually dominant control.
3. Map mode buttons are in a prominent 2×2 grid.
4. Charts panel is gone.
5. Continent Unification is gone from StatsPanel.
6. StatsPanel collapses/expands on header click.
7. Top-10 leaderboard renders with color swatch, name, tiles, and % when ≥1 state exists.
8. Map Builder has a single merged biome grid (no duplicate legend below).
9. Design is visually dark with purple accents, gradients on primary buttons, and glow on active elements.
10. `npm run build` passes.
11. `npm test` passes.

---

## What is NOT changing

- All simulation logic (`SimulationEngine`, `WorldGenerator`, `StateManager`, `hexUtils`, `rng`)
- `InfoPanel`, `Tooltip`, `EducationPanel`, `MapCanvas`, `Legend` (beyond global token updates)
- All types, all API surface
- `Charts.tsx` file can stay (just not rendered)
