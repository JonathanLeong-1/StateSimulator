# Architecture: Welcome Splash v2 + BottomBar Scale-Up + Undo Stroke

- **Date**: 2026-06-08
- **Status**: APPROVED
- **Supersedes**: `.plans/project/2026-06-08-architecture-bottombar-v2.md` (additive patch)
- **Branch**: `feature/frontend/ui-polish-v3`

---

## Overview

Four targeted changes, no simulation logic touches:

| # | Change |
|---|--------|
| 1 | Welcome Splash — larger, higher, lighter tint, 2× background speed |
| 2 | Dismiss splash → load Eurasia (not circle world) |
| 3 | BottomBar — scale up, play button fills full bar height |
| 4 | Map Builder — stroke-level undo + rename button |

---

## Change 1 — Welcome Splash visual resizing

### `src/styles/WelcomeSplash.module.css`

```css
.overlay {
  /* lighten tint: was 0.72, now 0.40 */
  background: rgba(4, 4, 10, 0.40);
  /* other properties unchanged */
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;          /* shift card upward */
  justify-content: center;
  padding-top: 8vh;                 /* vertical offset from top */
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  cursor: pointer;
  animation: fadeIn 0.6s ease;
}

.card {
  text-align: center;
  max-width: 720px;                 /* was 520px */
  width: 90%;
  padding: 72px 64px;               /* was 52px 48px */
  background: rgba(12, 12, 24, 0.82);
  border: 1px solid rgba(124, 58, 237, 0.4);
  border-radius: 28px;              /* slightly larger */
  box-shadow: 0 0 100px rgba(124, 58, 237, 0.28), 0 32px 80px rgba(0,0,0,0.8);
  pointer-events: none;
}

.title {
  font-size: 90px;                  /* was 52px */
  font-weight: 900;
  letter-spacing: -0.03em;
  background: var(--grad-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 24px;
  line-height: 1;
}

.subtitle {
  font-size: 18px;                  /* was 15px */
  color: var(--color-text);
  line-height: 1.65;
  margin-bottom: 40px;
}

.hint {
  font-size: 13px;
  color: var(--color-text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
```

### `src/ui/WelcomeSplash.tsx`

Change only the `speed` value in the `useEffect`:
```typescript
// was 1800, double the speed (lower ms = faster):
setUIState(prev => ({ ...prev, isPlaying: true, speed: 900 }));
```

---

## Change 2 — Dismiss loads Eurasia, not circle world

### `src/App.tsx`

`handleDismissSplash` currently calls `simContext.resetSim()` which builds the circle world. Change to `simContext.loadEurasia()`:

```typescript
const handleDismissSplash = useCallback(() => {
  setShowSplash(false);
  simContext.loadEurasia();                              // was resetSim()
  simContext.setUIState(prev => ({ ...prev, isPlaying: false, speed: 300 }));
}, [simContext]);
```

`loadEurasia` is already on the `SimContextValue` interface and wired up.

---

## Change 3 — BottomBar scale-up

### `src/styles/BottomBar.module.css`

Targeted property changes only (do not rewrite the entire file, preserve all unchanged classes):

**`.bar`** — increase padding and min-width:
```css
padding: 20px 32px;          /* was 14px 24px */
min-width: 560px;            /* was 480px */
```

**`.colCenter`** — add `align-items: stretch` so the play button can fill:
```css
.colCenter {
  display: flex;
  align-items: stretch;      /* was center */
  justify-content: center;
  padding: 0 28px;           /* was 0 24px */
}
```

**`.primaryBtn`** — remove fixed height, let it fill parent, make it taller:
```css
.primaryBtn {
  align-self: stretch;       /* fill colCenter height */
  min-height: 88px;          /* was height: 64px */
  height: auto;
  min-width: 150px;          /* was 130px */
  font-size: 20px;           /* was 18px */
  letter-spacing: 0.09em;
  /* all other properties unchanged */
}
```

**`.btn`** (step/secondary buttons):
```css
.btn {
  height: 40px;              /* was 32px */
  font-size: 13px;           /* was 12px */
  padding: 0 14px;           /* was 0 10px */
}
```

**`.speedSlider`**:
```css
.speedSlider {
  width: 130px;              /* was 110px */
}
```

**`.modeBtn`** / **`.modeBtnActive`**:
```css
height: 36px;               /* was 30px */
font-size: 12px;            /* was 11px */
padding: 0 10px;            /* was 0 8px */
```

**`.modeGrid`**:
```css
.modeGrid {
  gap: 6px;                 /* was 5px */
}
```

No changes to `BottomBar.tsx` — the component JSX does not need editing.

---

## Change 4 — Map Builder stroke-level undo

### Background

`applyBrush` is called on every `mousemove` while painting. Currently it calls `pushHistory` on **every call**, so each hex painted is its own undo step. Stroke-level undo means the entire drag from `mousedown` to `mouseup` is one history entry.

### Implementation pattern

Use a `strokePendingRef` flag:
- `beginStroke()` sets the flag to `true`
- `applyBrush` pushes history **only once per stroke** (when the flag is true), then clears the flag
- Canvas calls `beginStroke()` on `mousedown` (before `applyBrush`)

### `src/ui/mapbuilder/MapBuilderContext.tsx`

**Add ref:**
```typescript
const strokePendingRef = useRef(false);
```

**Add `beginStroke` function:**
```typescript
const beginStroke = useCallback(() => {
  strokePendingRef.current = true;
}, []);
```

**Modify `applyBrush` — replace the existing `pushHistory(prev.tiles)` call:**

Current (inside `setState` callback, near the top of applyBrush):
```typescript
pushHistory(prev.tiles);
```
Replace with:
```typescript
if (strokePendingRef.current) {
  pushHistory(prev.tiles);
  strokePendingRef.current = false;
}
```

**Add `beginStroke` to the `MapBuilderContextValue` interface:**
```typescript
beginStroke: () => void;
```

**Add `beginStroke` to the `value` object:**
```typescript
const value: MapBuilderContextValue = {
  state, applyBrush, beginStroke, setTool, setBrushSize, setSelectedBiome,
  ...
};
```

### `src/ui/mapbuilder/MapBuilderCanvas.tsx`

In `handleMouseDown`, call `ctx.beginStroke()` before `ctx.applyBrush(idx)`:

Current:
```typescript
if (idx !== null) {
  isPaintingRef.current = true;
  lastPaintedIdxRef.current = idx;
  ctx.applyBrush(idx);
}
```
Replace with:
```typescript
if (idx !== null) {
  isPaintingRef.current = true;
  lastPaintedIdxRef.current = idx;
  ctx.beginStroke();
  ctx.applyBrush(idx);
}
```

### `src/ui/mapbuilder/MapBuilderPanel.tsx`

Rename the Undo button label to clarify it now undoes full strokes:

Current:
```tsx
<button className={styles.btn} onClick={ctx.undo}>↩ Undo</button>
```
Replace with:
```tsx
<button className={styles.btn} onClick={ctx.undo}>↩ Undo Stroke</button>
```

---

## Acceptance Criteria

1. Welcome splash overlay tint is noticeably lighter (map visible through it).
2. Welcome card is visibly larger with title ≥ 80px font.
3. Card is positioned in the upper portion of the screen (not centered vertically).
4. Background simulation speed is ~2× faster than before (900ms/step).
5. Dismissing the splash loads Eurasia, not the circle world.
6. BottomBar play button fills the full internal height of the bar.
7. BottomBar overall height is noticeably larger than before.
8. In Map Builder, painting from mousedown to mouseup is a single undo step.
9. Undo button in Map Builder panel reads "↩ Undo Stroke".
10. `npm run build` passes. `npm test` passes.

---

## What is NOT changing

- SimSettings, StatsPanel, InfoPanel, Legend, Tooltip, EducationPanel
- MapBuilderRenderer, HexRenderer, AnimationController, all simulation logic
- The `undo`/`redo` logic itself (just how history is accumulated)
- Any TypeScript types
