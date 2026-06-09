# Architecture: World Simulator Enhancements — v4
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Supersedes**: .plans/project/2026-06-08-architecture-enhancements-v3.md
- **Feature Fingerprint**: always-on-political-overlay + border-bug-fix + edge-flash + state-labels

---

## Overview

This document is an additive patch on top of v3. The v3 code is already merged to `main`. All v3 features (even-q grid, flat borders, left-drag pan, hover state highlight, map builder) are implemented and working. This v4 addresses three user-visible issues and adds one new feature.

### Change Summary (v3 → v4)

| # | Feature | Change |
|---|---------|--------|
| 1 | State color overlay | Apply the `rgba(r,g,b,0.42)` political overlay to **all map modes**, not just `'political'`; terrain remains visible through the tint |
| 2 | Border completeness fix | Bold black borders must appear on **all** frontier edges of every state — including the ocean/land boundary. The current bug draws grey for land-ocean edges even when those are the outer border of a state |
| 3 | Edge flash animations | Conquest/secession flashes move from per-tile fill blend to a **border-edge glow** — the edges of the affected tile pulse in the flash color instead of the tile's fill color changing |
| 4 | State name labels | Each state renders a centered text label showing its name + hex count; labels scale with camera zoom and are culled when the state is too small to display legibly |

---

## Feature 1: Always-On State Color Overlay

### Problem
The `rgba(r,g,b,0.42)` tint pass is currently gated on `uiState.mapMode === 'political'`. In every other mode (terrain, productivity, obstacle) the states look identical in color — the player cannot tell which territory belongs to whom.

### Solution
Remove the mode gate. Apply the state color overlay tint pass for **every mode**. The tint alpha stays at `0.42` so the underlying terrain/productivity/obstacle coloring remains clearly legible.

**The only condition for drawing the tint**: the tile is non-ocean and has an assigned state (`stateId >= 0`).

### Implementation

In `HexRenderer.render()`, change the guard from:
```typescript
if (uiState.mapMode === 'political') {
```
To simply removing the condition — the overlay pass runs unconditionally after PASS 1.

No other changes needed for this feature.

---

## Feature 2: Border Completeness — Land/Ocean Edges as State Frontiers

### Problem
The current border logic classifies edges as either:
- **blackEdge** (bold): `tileIsLand && neighborIsLand && stateId !== neighborState`
- **greyEdge** (faint): everything else — including land↔ocean borders

This means the coastline edge of a coastal state is rendered as a faint grey line. The state looks unbounded at the coast.

### Solution
Reclassify: an edge is a **state frontier** (bold black) if **either** of these is true:
1. Both tiles are land and they belong to different states (existing rule)
2. One tile is land with an assigned state and the other tile is ocean — i.e., the edge is the coastline of a named state

Ocean↔ocean edges remain grey (they are not borders of any state).

### Algorithm

```typescript
const isLandStateTile = (idx: number) =>
  tiles[idx]?.terrain !== 'ocean' && simState.ownership[idx] >= 0;

const isFrontierEdge = (
  tileA: HexTile, stateA: number,
  tileB: HexTile, stateB: number,
): boolean => {
  const aLandState = tileA.terrain !== 'ocean' && stateA >= 0;
  const bLandState = tileB.terrain !== 'ocean' && stateB >= 0;

  if (aLandState && bLandState) return stateA !== stateB;       // cross-state land border
  if (aLandState && !bLandState) return true;                   // land state meets ocean
  if (!aLandState && bLandState) return true;                   // ocean meets land state
  return false;                                                  // ocean–ocean: grey
};
```

Grey edges now only apply to ocean↔ocean shared edges (rare) and land↔land same-state interior edges.

**Visual result**: every state is completely bounded by bold black lines on all sides.

---

## Feature 3: Edge Flash Animations (Conquest & Secession)

### Problem
Currently `getFlashIntensity` and `getFlashType` are used in `getTileColor` (MapModes.ts) to blend the tile fill color toward gold or red during a flash. This causes the entire hex face to flash, which looks jarring and visually conflicts with the overlay tint.

### Solution
Move the flash signal from per-tile fill to **per-tile border glow**. Instead of changing the fill color, the renderer draws the hex outline in the flash color at varying alpha.

### AnimationController — New Public Method

Add:
```typescript
getFlashingTiles(): ReadonlyMap<number, { type: AnimationType; intensity: number }>
```

Returns all currently flashing tiles as a map from tileIndex → `{ type, intensity }`.

The existing `getFlashIntensity()` and `getFlashType()` methods are kept for backward compatibility but are no longer used by `getTileColor`.

### MapModes.ts — Remove Flash Blend

Remove the flash-blend block from `getTileColor`:
```typescript
// DELETE these lines:
const intensity = animations.getFlashIntensity(tile.index);
if (intensity > 0) {
  const flashType = animations.getFlashType(tile.index);
  const flashColor = flashType === 'conquest' ? '#ffd700' : '#ff4444';
  color = lerpColor(color, flashColor, intensity);
}
```

The `animations` parameter can be removed from `getTileColor`'s signature at the same time. Update all call sites in `HexRenderer`.

### HexRenderer — New Flash Pass (PASS 5)

After PASS 2 (borders) and before PASS 6 (selected state outline), add **PASS 5: Edge flash**:

```typescript
// PASS 5: Edge flash — conquest (gold) / secession (red)
const flashingTiles = animations.getFlashingTiles();
if (flashingTiles.size > 0) {
  for (const [tileIndex, { type, intensity }] of flashingTiles) {
    const tile = tiles[tileIndex];
    if (!tile) continue;
    const flashColor = type === 'conquest' ? `rgba(255,215,0,${intensity})` : `rgba(255,60,60,${intensity})`;
    const [cx, cy] = this.tileCenter(tile.q, tile.r);
    const verts = hexVertices(cx, cy, HEX_SIZE - 0.5);
    ctx.save();
    ctx.strokeStyle = flashColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(verts[0][0], verts[0][1]);
    for (let i = 1; i < 6; i++) ctx.lineTo(verts[i][0], verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}
```

**Flash colors**:
- Conquest: `rgba(255, 215, 0, intensity)` — gold
- Secession: `rgba(255, 60, 60, intensity)` — red-orange

The hex outline pulses brighter as `intensity` starts at 1.0 and fades to 0.

### Timing (unchanged)
- Conquest: 600ms total
- Secession: 800ms total

---

## Feature 4: State Name Labels

### Overview
Each state renders a centered text label at its visual centroid. The label shows:
```
StateNameHere
■ 42 tiles
```
(Two lines: name on top, tile count on bottom.)

Labels are drawn inside the camera transform (world space) so they scale naturally with zoom.

### Centroid Computation

The label position is the **unweighted average of all tile centers** in the state:

```typescript
function statecentroid(
  tileIndices: Set<number>,
  tiles: HexTile[],
  tileCenter: (q: number, r: number) => [number, number],
): [number, number] {
  let sx = 0, sy = 0;
  for (const idx of tileIndices) {
    const t = tiles[idx];
    const [x, y] = tileCenter(t.q, t.r);
    sx += x; sy += y;
  }
  const n = tileIndices.size;
  return [sx / n, sy / n];
}
```

This is computed **once per render frame** for each visible state (not cached, since states change every turn). Given ~100–1000 states with typical sizes, the loop is fast enough.

### Text Rendering

```typescript
// PASS 9: State labels
const MIN_TILES_FOR_LABEL = 3;   // don't label tiny city-states
const MIN_SCALE_FOR_LABEL = 0.5; // don't render labels when zoomed way out

if (this.camera.scale >= MIN_SCALE_FOR_LABEL) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const [, state] of simState.states) {
    if (state.size < MIN_TILES_FOR_LABEL) continue;

    const [cx, cy] = stateCentroid(state.tileIndices, tiles, this.tileCenter.bind(this));

    // Name line
    const fontSize = Math.max(7, Math.min(11, HEX_SIZE * 0.85));
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = 'rgba(0,0,0,0.70)';
    ctx.lineWidth = 2.5;
    ctx.strokeText(state.name, cx, cy - fontSize * 0.6);
    ctx.fillText(state.name, cx, cy - fontSize * 0.6);

    // Tile count line
    const countSize = Math.max(6, fontSize - 1.5);
    ctx.font = `400 ${countSize}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.70)';
    ctx.strokeStyle = 'rgba(0,0,0,0.60)';
    ctx.lineWidth = 2;
    const countText = `${state.size}`;
    ctx.strokeText(countText, cx, cy + countSize * 0.7);
    ctx.fillText(countText, cx, cy + countSize * 0.7);
  }
  ctx.restore();
}
```

**Readability technique**: each text line is stroked in semi-transparent black before being filled in white/light-grey, creating a halo effect that ensures legibility on any background color.

**Font sizing**: fixed at 7–11px world-space so the text scales with zoom — at 1× zoom the label is ~9px, at 3× zoom it reads comfortably at ~27px.

**Culling rules**:
- `state.size < MIN_TILES_FOR_LABEL (3)` → skip (micro-states are too small to display a label)
- `this.camera.scale < MIN_SCALE_FOR_LABEL (0.5)` → skip all labels (too zoomed out, would be unreadable noise)

### Label content
- Line 1: `state.name` (already a multi-syllable procedural name)
- Line 2: `state.size` (integer, just the tile count — no "tiles" suffix to keep it compact)

---

## Interface Contracts (v4 additions)

### AnimationController
```typescript
// New method (additive):
getFlashingTiles(): ReadonlyMap<number, { type: 'conquest' | 'secession'; intensity: number }>;
```

### MapModes.getTileColor — signature change
```typescript
// v3 signature:
getTileColor(tile: HexTile, mode: MapMode, stateColor: string | null, animations: AnimationController): string

// v4 signature (animations param removed):
getTileColor(tile: HexTile, mode: MapMode, stateColor: string | null): string
```

Update the single call site in `HexRenderer` accordingly.

---

## File Impact Summary

| File | Change |
|------|--------|
| `src/renderer/HexRenderer.ts` | Remove political-mode gate on overlay (Feature 1); fix border frontier logic (Feature 2); add PASS 5 edge flash (Feature 3); remove `animations` from `getTileColor` call; add PASS 9 state labels (Feature 4) |
| `src/renderer/MapModes.ts` | Remove `animations` parameter and flash-blend block from `getTileColor` |
| `src/renderer/AnimationController.ts` | Add `getFlashingTiles()` method |
| `src/renderer/AnimationController.test.ts` | Add tests for `getFlashingTiles()` |
| `src/renderer/MapModes.test.ts` | Remove animation mock from `getTileColor` call sites; add test that political + terrain modes return same color (terrain color) without state blend |

---

## Acceptance Criteria (v4)

1. In every map mode (terrain, productivity, obstacle, political), each state territory is visibly tinted in its own color while the underlying data layer remains legible
2. Every state is fully enclosed by bold black border lines on all sides — coastlines included
3. Conquest events flash a **gold edge glow** around the captured tile, not a fill color change
4. Secession events flash a **red edge glow** around the seceding tile
5. Every state with ≥ 3 tiles shows a two-line label (name + tile count) centered in its territory
6. Labels are not rendered when camera scale < 0.5 (very zoomed out)
7. Labels use stroke-then-fill halo technique ensuring legibility on all biome backgrounds
8. `npm run build` exits 0; `npm test` all pass

---

## Out of Scope (v4)
- Clickable labels
- Label collision avoidance / leader lines
- Font customization
- Label animation on conquest/merge
