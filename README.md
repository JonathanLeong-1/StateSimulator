# State Simulator

A browser-based political geography simulator. Watch states form, expand, fragment, and consolidate across a procedurally generated hex-grid world.

Inspired by research on state formation and territorial consolidation.

## Features

- **Procedural world generation** — Circle-landmass default map on a 160 × 100 rectangular even-q offset hex grid (16,000 tiles) with terrain diversity (plains, forests, mountains, deserts, tundra, river valleys). A fixed-seed circular continent centered at (80, 50) with radius 38 loads on startup and on every Reset
- **Eurasia preset** — One-click **🗺 Eurasia** button loads a hand-crafted Eurasia map (`public/eurasia.worldmap.json`) into the simulation
- **Non-deterministic simulation runs** — Each simulation run (even on the same map) produces a unique political outcome: the RNG is seeded from `Date.now()` XOR a random integer at startup, so state colors and territorial expansion differ every time. Passing an explicit seed to `SimulationEngine` restores full determinism for reproducible results
- **Political simulation** — States conquer neighbors, secede, and split based on power, terrain, and geographic factors
- **Sea conquest** — Coastal states can project power across oceans to nearby coastlines
- **Voyage arc animations** — When sea conquest is enabled, animated Bézier arcs appear after each simulation step showing cross-sea attacks in the attacking state's own color; arcs fade over ~2 seconds
- **Always-on state color overlay** — Every map mode (Political, Terrain, Productivity, Obstacle) renders a semi-transparent state color tint (`rgba` at 0.42 alpha) over each state's territory. Underlying terrain and heatmap data remain fully legible through the tint
- **Complete state borders** — Every state frontier is enclosed by bold black border lines, including edges along coastlines. Land–ocean boundaries are now rendered the same as inter-state land borders — bold, not faint grey
- **Edge flash animations** — Conquest and secession events produce a colored edge glow on the affected tile rather than a fill color change. Conquest glows gold (fades over 600 ms); secession glows red (fades over 800 ms)
- **State name labels** — Any state with 3 or more tiles displays a centered label showing the state name and its hex tile count. Labels use stroke-then-fill halo rendering for legibility on any background color. Labels are hidden when camera zoom falls below 0.5×
- **Political map mode** — State color tint and bold borders visible by default; hovering any tile highlights the entire owning state with a subtle white overlay
- **Pan & zoom navigation** — Both the simulation view and Map Builder support scroll-wheel zoom (centered on cursor) and always start with a full fit-to-view of the map; the simulation view also supports left mouse button drag to pan (a 5-pixel threshold distinguishes drag from click so short clicks still select states); middle/right mouse button drag pans in both views
- **Real-time statistics** — Turn counter, state count, Herfindahl index, continent unification scores
- **Live charts** — Track state count, largest state share, and HHI over time
- **4 map modes** — Political, Terrain, Productivity, Obstacle
- **Full controls** — Adjustable conflict rate, secession rate, geography difficulty, and more
- **Save/Load** — Export simulation state to JSON and restore it
- **Map Builder** — Paint custom hex worlds from scratch using paint tools, biome selector, and procedural continent generation, then launch the simulation directly on your creation

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## GitHub Pages Deployment

This repository publishes the built Vite app through GitHub Pages Actions.

1. Push changes to `main`.
2. The `Deploy to GitHub Pages` workflow builds the app with the correct base path, uploads `dist/` as a Pages artifact, and deploys it automatically.
3. In GitHub repository settings, set Pages source to GitHub Actions if it is not already configured.

## Controls

| Control | Description |
|---------|-------------|
| **Play/Pause** | Start or pause the simulation |
| **Step** | Advance one turn (only when paused) |
| **⏭×100** | Pause and advance exactly 100 turns in one click (fast-forward to late-game) |
| **Reset** | Restart the simulation — returns to the circle-landmass default |
| **🗺 Eurasia** | Load the hand-crafted Eurasia map |
| **Seed** | Set a specific seed for reproducible worlds (press Enter to apply) |
| **Speed** | Milliseconds between steps (50ms = fast, 2000ms = slow) |
| **Conflict Frequency** | How often states initiate conflicts (0.1–1.0) |
| **Sea Conquest** | Probability of sea-crossing attacks (0.0–0.5) |
| **Secession Rate** | How often border tiles break away (0.0–1.0) |
| **Geography Difficulty** | Amplifies terrain barriers to conquest (0.2–2.0) |
| **Productivity Influence** | How much tile productivity drives conflict (0.2–2.0) |
| **Sea Conquest toggle** | Enable/disable cross-sea attacks |
| **Secession toggle** | Enable/disable state fragmentation |
| **Capital Distance Unrest** | Border tiles far from capital are more likely to secede |
| **Split Disconnected** | Isolated state enclaves form new states |
| **Save (💾 Save)** | Export simulation state to a JSON file |
| **Load (📂 Load)** | Restore simulation state from a JSON file |
| **Export Map (📷 Export)** | Download the current map view as a PNG screenshot |

## Map Modes

| Mode | Description |
|------|-------------|
| **Political** | State color tint + bold borders + state name labels; hover a tile to highlight the entire owning state (default) |
| **Terrain** | Raw terrain types with state color tint overlay and bold state borders |
| **Productivity** | Green heatmap with state color tint overlay and bold state borders; brighter = more productive |
| **Obstacle** | Red heatmap with state color tint overlay and bold state borders; brighter = harder to conquer |

## Map Builder

The Map Builder lets you design a custom world before running the simulation on it. Click **🗺 Map Builder** in the header to enter the mode.

### Pan & Zoom

Both the simulation view and the Map Builder canvas support free pan and zoom:

| Action | Result |
|--------|--------|
| **Scroll wheel** | Zoom in / out, centered on the cursor |
| **Middle mouse drag** | Pan the view |
| **Right mouse drag** | Pan the view |
| **Hold `Space` + left drag** | Pan the view (Map Builder only) |
| **`R` key** (Map Builder) | Reset view to fit the full map |

The initial view always fits the entire map with no clipping.

### Paint Tools

| Tool | Key | Description |
|------|-----|-------------|
| **Land/Biome** | `L` | Paint land hexes using the selected biome |
| **Ocean** | `O` | Paint ocean hexes |
| **Biome** | `B` | Change land hexes to the selected biome without affecting ocean |
| **Productivity** | `P` | Cycle through productivity levels (low → medium → high) |

### Biome Selector

Choose from 7 land terrain types — Plains, River Valley, Forest, Hills, Desert, Tundra, and Mountains — each displayed with a color swatch matching the in-simulation terrain palette. A **biome reference legend** is always visible below the swatches, showing the color, name, and productivity value for every terrain type.

### Brush Controls

| Control | Description |
|---------|-------------|
| **Brush Size** | Radius 0–8; `0` = single hex mode (shown as "Single hex" in the UI); adjust with the slider or `[` / `]` keys |
| **Random Intersperse** | When enabled, brushstrokes scatter tiles naturally rather than filling a solid circle |

### Map Actions

| Action | Description |
|--------|-------------|
| **Random Continents** | Procedurally generate landmasses on the blank canvas |
| **Eurasia** | Load the hand-crafted Eurasia map directly into the editor |
| **Clear Map** | Reset the entire grid to ocean |
| **Undo / Redo** | Up to 50 steps — `Ctrl+Z` / `Ctrl+Shift+Z` |
| **Save Map (💾)** | Download the current map layout as a JSON file |
| **Load Map (📂)** | Load a previously saved map JSON |
| **▶ Run Simulation on This Map** | Switch to simulation mode using your custom world as the starting state |

### Workflow

1. Click **🗺 Map Builder** in the header.
2. Start with a blank ocean grid (160 × 100 hexes) or click **Random Continents** for a procedurally generated starting point.
3. Select a paint tool and biome, then click or drag to paint tiles.
4. Use **Save Map** to preserve your work; use **Load Map** to restore it later.
5. Click **▶ Run Simulation on This Map** to hand the world to the simulator and watch it play out.

## How It Works

Each turn:
1. **Conflict proposals** are generated — productive tiles on state borders roll for attacks
2. **Conflict resolution** — attacker vs. defender power, modified by terrain obstacle and geography difficulty
3. **Secession** — border tiles with high obstacle and far from capital may break away
4. **Disconnected splitting** — isolated state enclaves become new states
5. **Statistics update** — HHI, largest state share, continent scores

**Power** is the sum of productivity across all tiles a state owns. Larger, more fertile states win conflicts more often — but their long borders also make them vulnerable to secession.

The **Herfindahl-Hirschman Index (HHI)** measures political fragmentation: a high value means many small states; approaching 0 means one state dominates.

## Attribution

Simulation mechanics inspired by NBER research on state formation and the dynamics of territorial consolidation.
