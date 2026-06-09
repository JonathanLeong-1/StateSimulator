# Architecture: BottomBar Rework + Welcome Splash

- **Date**: 2026-06-08
- **Status**: APPROVED
- **Supersedes**: `.plans/project/2026-06-08-architecture-ui-layout-v2.md` (additive patch)
- **Branch**: `feature/frontend/ui-bottombar-v2`

---

## Overview

Three targeted changes on top of the current layout-v2 implementation:

| # | Change |
|---|--------|
| 1 | Move Eurasia / Random map buttons from `BottomBar` to `SimSettings` |
| 2 | Rework `BottomBar` into a two-row layout with Play centred, Step+Speed left, 2×2 view modes right |
| 3 | New `WelcomeSplash` overlay — auto-plays slow simulation as dynamic background, click-to-dismiss resets sim |

---

## Change 1 — Map buttons move to SimSettings

### `src/ui/BottomBar.tsx`
Remove:
- `loadEurasia` and `randomizeContinents` destructuring from `useSimulation()`
- `🗺 Eurasia` button
- `🌍 Random` button
- The `sep` between Reset and those buttons
- `↺ Reset` is kept

### `src/ui/SimSettings.tsx`
Add a new `section` titled **"MAP"** (above the Seed section) containing:
```tsx
import { useSimulation } from '../SimulationContext'; // already imported
// Add to destructuring:
loadEurasia,
randomizeContinents,
resetSim,
// Move reset here too so all map-change actions are in one place
```
Section content:
```tsx
<div className={styles.section}>
  <label className={styles.label}>Map</label>
  <div className={styles.buttonRow}>
    <button className={styles.btn} onClick={loadEurasia}>🗺 Eurasia</button>
    <button className={styles.btn} onClick={randomizeContinents}>🌍 Random</button>
    <button className={styles.btn} onClick={resetSim}>↺ Reset</button>
  </div>
</div>
```
Also remove `resetSim` from `BottomBar`.

---

## Change 2 — BottomBar two-row layout

### Layout diagram

```
┌──────────────────────────────────────────────────────────────┐
│  [⏭ Step ] [⏭×100]   │  ▶▶ PLAY / ⏸ PAUSE  │  VIEW MODE   │
│  [─── Speed ────── ]  │                      │  [Pol][Ter]  │
│                       │                      │  [Pro][Obs]  │
└──────────────────────────────────────────────────────────────┘
```

The bar uses a **3-column CSS grid**:
- Column 1: Step controls stack + Speed slider stack
- Column 2: Play/Pause (taller, centred)
- Column 3: "View Mode" label + 2×2 mode grid

### `src/styles/BottomBar.module.css` — full replacement

```css
.bar {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: grid;
  grid-template-columns: auto auto auto;
  align-items: center;
  gap: 0;
  padding: 14px 24px;
  background: rgba(12, 12, 22, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(124, 58, 237, 0.35);
  border-radius: 22px;
  box-shadow: 0 8px 48px rgba(0,0,0,0.75), 0 0 0 1px rgba(124,58,237,0.12);
  white-space: nowrap;
  min-width: 480px;
}

/* Column separators */
.colLeft  { display: flex; flex-direction: column; gap: 8px; align-items: stretch; padding-right: 20px; border-right: 1px solid rgba(255,255,255,0.08); }
.colCenter { display: flex; align-items: center; justify-content: center; padding: 0 24px; }
.colRight  { display: flex; flex-direction: column; gap: 6px; align-items: center; padding-left: 20px; border-left: 1px solid rgba(255,255,255,0.08); }

/* Left column */
.stepRow   { display: flex; gap: 6px; }
.speedRow  { display: flex; align-items: center; gap: 8px; }
.speedLabelSlow { font-size: 9px; color: var(--color-text-muted); flex-shrink: 0; }
.speedLabelFast { font-size: 9px; color: var(--color-accent-light); flex-shrink: 0; }
.speedSlider {
  width: 110px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

/* Center column */
.primaryBtn {
  height: 64px;
  min-width: 130px;
  background: var(--grad-primary);
  border: none;
  border-radius: 14px;
  color: #fff;
  font-size: 18px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  padding: 0 24px;
  transition: box-shadow 0.2s, filter 0.2s;
  box-shadow: 0 4px 20px rgba(124,58,237,0.4);
}
.primaryBtn:hover {
  box-shadow: 0 0 28px var(--color-accent-glow), 0 4px 20px rgba(124,58,237,0.4);
  filter: brightness(1.12);
}

/* Right column */
.viewModeLabel {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
}
.modeGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}

/* Buttons */
.btn {
  height: 32px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--color-border);
  border-radius: 7px;
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
  padding: 0 10px;
  transition: border-color 0.15s, color 0.15s;
  white-space: nowrap;
}
.btn:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent-light); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

.modeBtn {
  height: 30px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(124,58,237,0.2);
  border-radius: 7px;
  color: var(--color-text-muted);
  font-size: 11px;
  cursor: pointer;
  padding: 0 8px;
  transition: all 0.15s;
}
.modeBtn:hover { border-color: var(--color-accent); color: var(--color-accent-light); }

.modeBtnActive {
  height: 30px;
  background: var(--grad-primary);
  border: none;
  border-radius: 7px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 0 8px;
  box-shadow: 0 0 10px var(--color-accent-glow);
}
```

### `src/ui/BottomBar.tsx` — full replacement

```tsx
import { useSimulation } from '../SimulationContext';
import styles from '../styles/BottomBar.module.css';

export function BottomBar() {
  const { uiState, setUIState, playPause, stepOnce, stepN } = useSimulation();
  const { isPlaying, speed, mapMode } = uiState;

  // Inverted: slider value 100 = fastest (50ms), value 0 = slowest (2000ms)
  const toSlider = (ms: number) =>
    100 - Math.round((Math.log(ms) - Math.log(50)) / (Math.log(2000) - Math.log(50)) * 100);
  const fromSlider = (v: number) =>
    Math.round(Math.exp(Math.log(50) + ((100 - v) / 100) * (Math.log(2000) - Math.log(50))));

  return (
    <div className={styles.bar}>
      {/* Left: Step + Speed */}
      <div className={styles.colLeft}>
        <div className={styles.stepRow}>
          <button className={styles.btn} onClick={stepOnce} disabled={isPlaying}>⏭ Step</button>
          <button className={styles.btn} onClick={() => stepN(100)} disabled={isPlaying}>⏭×100</button>
        </div>
        <div className={styles.speedRow}>
          <span className={styles.speedLabelSlow}>Slow</span>
          <input
            type="range" min={0} max={100} step={1}
            value={toSlider(speed)}
            onChange={e => setUIState(prev => ({ ...prev, speed: fromSlider(Number(e.target.value)) }))}
            className={styles.speedSlider}
          />
          <span className={styles.speedLabelFast}>Fast</span>
        </div>
      </div>

      {/* Center: Play/Pause */}
      <div className={styles.colCenter}>
        <button className={styles.primaryBtn} onClick={playPause}>
          {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
        </button>
      </div>

      {/* Right: View mode 2×2 */}
      <div className={styles.colRight}>
        <span className={styles.viewModeLabel}>View Mode</span>
        <div className={styles.modeGrid}>
          {(['political', 'terrain', 'productivity', 'obstacle'] as const).map(mode => (
            <button
              key={mode}
              className={mapMode === mode ? styles.modeBtnActive : styles.modeBtn}
              onClick={() => setUIState(prev => ({ ...prev, mapMode: mode }))}
            >
              {mode === 'political' ? 'Political'
               : mode === 'terrain' ? 'Terrain'
               : mode === 'productivity' ? 'Productivity'
               : 'Obstacle'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Change 3 — Welcome Splash

### New files
- `src/ui/WelcomeSplash.tsx`
- `src/styles/WelcomeSplash.module.css`

### Behaviour

1. On first render (`App.tsx`), `showSplash` state is `true`.
2. A `useEffect` in `WelcomeSplash` runs on mount: calls `setUIState(prev => ({ ...prev, isPlaying: true, speed: 1800 }))` to start the sim slowly.
3. Clicking anywhere on the splash calls `onDismiss`.
4. `onDismiss` in `App.tsx`:
   - Sets `showSplash = false`
   - Calls `resetSim()` to restore the Eurasia default state
   - Calls `setUIState(prev => ({ ...prev, isPlaying: false, speed: 300 }))` to pause and reset speed

### `src/styles/WelcomeSplash.module.css`

```css
.overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 4, 10, 0.72);
  backdrop-filter: blur(2px);
  cursor: pointer;
  animation: fadeIn 0.6s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.card {
  text-align: center;
  max-width: 520px;
  padding: 52px 48px;
  background: rgba(12, 12, 24, 0.82);
  border: 1px solid rgba(124, 58, 237, 0.4);
  border-radius: 24px;
  box-shadow: 0 0 80px rgba(124, 58, 237, 0.25), 0 24px 64px rgba(0,0,0,0.8);
  pointer-events: none;  /* let overlay capture click */
}

.title {
  font-size: 52px;
  font-weight: 900;
  letter-spacing: -0.02em;
  background: var(--grad-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 20px;
  line-height: 1;
}

.subtitle {
  font-size: 15px;
  color: var(--color-text);
  line-height: 1.6;
  margin-bottom: 32px;
}

.hint {
  font-size: 12px;
  color: var(--color-text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}
```

### `src/ui/WelcomeSplash.tsx`

```tsx
import { useEffect } from 'react';
import { useSimulation } from '../SimulationContext';
import styles from '../styles/WelcomeSplash.module.css';

interface Props {
  onDismiss: () => void;
}

export function WelcomeSplash({ onDismiss }: Props) {
  const { setUIState } = useSimulation();

  // Start playing slowly while splash is shown
  useEffect(() => {
    setUIState(prev => ({ ...prev, isPlaying: true, speed: 1800 }));
  }, [setUIState]);

  return (
    <div className={styles.overlay} onClick={onDismiss}>
      <div className={styles.card}>
        <div className={styles.title}>Welcome!</div>
        <p className={styles.subtitle}>
          Watch civilizations rise and fall in real time — a procedural political
          simulator where states conquer, fragment, and reform across a living world map.
        </p>
        <span className={styles.hint}>Click anywhere to begin</span>
      </div>
    </div>
  );
}
```

### `src/App.tsx` changes

```tsx
// Add import:
import { WelcomeSplash } from './ui/WelcomeSplash';

// Add state:
const [showSplash, setShowSplash] = useState(true);

// Add handler:
const handleDismissSplash = useCallback(() => {
  setShowSplash(false);
  simContext.resetSim();
  simContext.setUIState(prev => ({ ...prev, isPlaying: false, speed: 300 }));
}, [simContext]);

// In simulate mode render, add WelcomeSplash above BottomBar:
{showSplash && <WelcomeSplash onDismiss={handleDismissSplash} />}
```

---

## Acceptance Criteria

1. `BottomBar` contains no Eurasia/Random/Reset buttons.
2. `SimSettings` MAP section has Eurasia, Random, Reset buttons.
3. `BottomBar` is two-row: left=Step+Speed, center=Play, right=ViewMode 2×2.
4. Speed slider is inverted (right = fast, left = slow); labelled "Slow"/"Fast".
5. Play button is visually largest element in the bar (height 64px, gradient, glow).
6. View mode section has "View Mode" label above the 2×2 grid.
7. Welcome splash appears on first load, covering the map area (not the topBar).
8. Simulation auto-plays at 1800ms/step while splash is visible.
9. Clicking splash: removes splash, resets sim, pauses at default 300ms speed.
10. `npm run build` passes. `npm test` passes.
