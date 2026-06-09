# Architecture: UI Layout Rework — Immersive Map + Floating Overlays

- **Date**: 2026-06-08
- **Status**: APPROVED
- **Supersedes**: `.plans/project/2026-06-08-architecture-ui-overhaul.md` (layout layer only)
- **Branch**: `feature/frontend/ui-layout-v2`

---

## Overview

The simulation page is reworked so the map canvas fills the full viewport (minus the top header bar). All UI panels become floating overlays positioned absolutely on top of the map. No simulation logic, types, or renderer code changes.

---

## New Layout Diagram

```
┌─────────────────────────────────────────────────────┐  ← topBar (52px, fixed)
│  🌍 World Simulator       [Map Builder]   [Legend]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────┐     ┌──────────────────┐  │
│  │ ⚙ Sim Settings  ▶  │     │ Top States    ▼  │  │  ← top-left / top-right floats
│  │ (collapsed default) │     │  1. ██ Duchy… 12%│  │
│  └─────────────────────┘     │  2. ██ Roman… 8% │  │
│                               │  ─────────────── │  │
│         MAP CANVAS            │ ▶ Statistics      │  │
│         (full area)           └──────────────────┘  │
│                                                     │
│       ╔═════════════════════════════════════╗       │
│       ║  ▶ PLAY  │Step│×100│──speed──│Reset│       │  ← bottom center float
│       ║  Eurasia │ Random │ Political│Terrain│…    ║       │
│       ╚═════════════════════════════════════╝       │
└─────────────────────────────────────────────────────┘
```

---

## Component Changes

### NEW: `src/ui/BottomBar.tsx` + `src/styles/BottomBar.module.css`

Extracted from `ControlPanel`. Contains the primary simulation controls.

**Position:** `position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%)`  
**Background:** `rgba(12, 12, 22, 0.88)` + `backdrop-filter: blur(14px)`  
**Border:** `1px solid rgba(124, 58, 237, 0.3)`  
**Border-radius:** `20px`  
**Box-shadow:** `0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.1)`  
**Padding:** `10px 20px`  
**Layout:** `display: flex; align-items: center; gap: 6px`  

**Contents (left to right):**
1. **▶ PLAY / ⏸ PAUSE** — gradient button, height 44px, min-width 100px, font-size 15px, font-weight 700, glow on hover
2. Thin vertical separator (`1px solid rgba(255,255,255,0.1)`, height 30px, mx 4px)
3. **⏭ Step** + **⏭×100** — secondary buttons, height 36px
4. Separator
5. **Speed** — compact horizontal: label `⚡` + range slider (width 100px), no extra text
6. Separator
7. **↺ Reset** + **🗺 Eurasia** + **🌍 Random** — secondary buttons, height 36px
8. Separator
9. **Map mode row** — 4 pill buttons: Political | Terrain | Productivity | Obstacle (active = gradient fill + glow, inactive = ghost)

CSS classes:
- `.bar` — the outer pill container
- `.primaryBtn` — Play/Pause
- `.sep` — thin vertical divider
- `.btn` — secondary action buttons
- `.speedSlider` — the range input (width 90px)
- `.modeBtn` / `.modeBtnActive` — map mode pills

---

### NEW: `src/ui/SimSettings.tsx` + `src/styles/SimSettings.module.css`

Extracted from `ControlPanel`. Contains all simulation parameters.

**Position:** `position: absolute; top: 10px; left: 10px; z-index: 10`  
**Background/border/blur:** same as BottomBar  
**Border-radius:** `14px`  
**Default state:** collapsed (`const [open, setOpen] = useState(false)`)  

**Header** (always visible):
- `⚙ Simulation Settings` label + expand chevron (`›`/`‹`)
- Full-width clickable, height 40px, padding `0 14px`
- Background: transparent (border-radius clips the panel bg)

**Expanded body** (max-height 70vh, overflow-y auto, padding `12px 14px`, width 240px):
- Seed input (with Enter to apply label)
- Sliders: Conflict Frequency, Sea Conquest, Secession Rate, Geography Difficulty, Productivity Influence
- Checkboxes: Sea Conquest toggle, Secession toggle, Capital Distance Unrest, Split Disconnected
- Separator
- Row: 💾 Save | 📂 Load | 📷 Export

CSS classes:
- `.container` — outer positioned wrapper
- `.header` — clickable title row
- `.title` — gradient text label
- `.chevron` — rotation-animated icon
- `.body` — expandable content
- `.section` — groups within body
- `.label`, `.input`, `.slider`, `.toggleLabel`, `.btn`, `.buttonRow` — same semantics as current ControlPanel

---

### REWORKED: `src/ui/StatsPanel.tsx` + `src/styles/StatsPanel.module.css`

**Position:** `position: absolute; top: 10px; right: 10px; z-index: 10`  
**Background/border/blur:** same as BottomBar  
**Border-radius:** `14px`  
**Width:** `220px`  

**Two-level collapse:**
- **Outer toggle** — clicking the panel header collapses the entire panel. Default: expanded.
- **Inner toggle** — "Statistics" row at the bottom of the leaderboard expands/collapses the stats metrics grid. Default: collapsed.

**Structure when outer-expanded:**
```
┌──────────────────────────────┐
│ Top States               ▼  │  ← header, click collapses all
│──────────────────────────────│
│  1. ██ Mongol Empire   4823  │
│  2. ██ Han Dynasty     3102  │
│  …                          │
│──────────────────────────────│
│ ▶ Statistics                 │  ← inner toggle row
│ (stats grid if expanded)     │
└──────────────────────────────┘
```

**Structure when outer-collapsed:**
```
┌──────────────────────────────┐
│ Top States               ▶  │  ← header only
└──────────────────────────────┘
```

CSS classes (reuse/rename existing):
- `.panel` — outer container, `position: absolute; top: 10px; right: 10px`
- `.header` — top clickable row (outer toggle)
- `.headerTitle` — gradient text
- `.body` — leaderboard + inner-stats wrapper
- `.leaderboard`, `.lbRow`, `.lbRank`, `.lbSwatch`, `.lbName`, `.lbTiles`, `.lbPct` — unchanged
- `.statsToggle` — inner clickable row, border-top, cursor pointer, `font-size: 11px`
- `.statsGrid` — the metrics grid (same as existing `.grid`)
- `.label`, `.value` — same

**Leaderboard data:** same derivation as before.
**Stats section content:** Turn, Year, States, Largest State, Avg Size, HHI, Conflicts, Conquests, Secessions, Land Tiles (all existing).

---

### REWORKED: `src/ui/InfoPanel.tsx` + `src/ui/InfoPanel.module.css`

Currently lives inside `.rightColumn`. Must become a floating overlay.

**Position:** `position: absolute; bottom: 90px; right: 10px; z-index: 10; width: 220px`
(appears above the bottom bar when a state is selected; returns null when none selected — no change to logic)

**CSS changes only:** `.panel` gets `position: absolute; bottom: 90px; right: 10px; width: 220px; border-radius: 14px; backdrop-filter: blur(14px); background: rgba(12,12,22,0.88); border: 1px solid rgba(124,58,237,0.3)`.

---

### REWORKED: `src/App.tsx`

```tsx
// Remove:
import { ControlPanel } from './ui/ControlPanel';
// Remove: rightColumn div and everything in it

// Add:
import { BottomBar } from './ui/BottomBar';
import { SimSettings } from './ui/SimSettings';

// Simulate mode render becomes:
<div className={styles.main}>
  <MapCanvas />
  <SimSettings />
  <StatsPanel />
  <InfoPanel />
  <BottomBar />
</div>
```

The `MapCanvas` `.canvasWrapper` already has `flex: 1; position: relative; background: var(--color-bg)` so it fills `.main`.

---

### REWORKED: `src/styles/App.module.css`

- `.main`: keep `display: flex; flex: 1; overflow: hidden; position: relative` — **add `position: relative`** so absolute children are positioned within it.
- Remove `.rightColumn` class entirely.

---

### DELETED (or emptied): `src/ui/ControlPanel.tsx` + `src/styles/ControlPanel.module.css`

Content migrated to `BottomBar` and `SimSettings`. The file can remain but its export should be removed from `App.tsx`.

---

## Acceptance Criteria

1. Map canvas fills the full area below the header, edge-to-edge.
2. BottomBar floats centered at the bottom, does not span full width.
3. Play button is the tallest/widest element in the BottomBar, visually dominant.
4. SimSettings defaults to collapsed; clicking header expands/collapses it.
5. StatsPanel defaults to expanded with leaderboard visible; header click collapses entire panel.
6. Inner "Statistics" row within StatsPanel defaults to collapsed; clicking expands the metrics grid.
7. InfoPanel floats bottom-right when a state is selected.
8. All three floating panels use backdrop-blur glass style consistent with BottomBar.
9. No ControlPanel or rightColumn visible in simulate mode.
10. `npm run build` passes. `npm test` passes.
11. All sim controls (speed, seed, sliders, checkboxes, save/load/export) remain fully functional.

---

## What is NOT changing

- All simulation logic, engine, world generator, renderers
- MapBuilder mode (unchanged)
- Global CSS tokens (carry forward from previous overhaul)
- `Tooltip`, `EducationPanel`, `Legend` components
- `MapCanvas.tsx` and `MapCanvas.module.css` (canvasWrapper already fills its parent)
