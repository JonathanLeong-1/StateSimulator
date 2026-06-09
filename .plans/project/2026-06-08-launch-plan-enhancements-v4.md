# Launch Plan: World Simulator Enhancements — v4
- **Date**: 2026-06-08
- **Architecture Reference**: .plans/project/2026-06-08-architecture-enhancements-v4.md
- **Supersedes**: .plans/project/2026-06-08-launch-plan-enhancements-v3.md
- **Feature Fingerprint**: always-on-political-overlay + border-bug-fix + edge-flash + state-labels
- **Execution Mode**: sequential (single workstream — all renderer)
- **Total Workstreams**: 1
- **Total Waves**: 1

## Context

v3 is merged to `main`. This plan is a focused patch on the renderer and animation system — no new files are needed, all changes are in existing files. The branch is `feature/ui/world-simulator-enhancements-v4`.

## Dependency Graph

```
[feature/ui/world-simulator-enhancements-v4]
    Step 1: AnimationController  (add getFlashingTiles)
    Step 2: MapModes             (remove animations param from getTileColor)
    Step 3: HexRenderer          (overlay always-on + border fix + edge flash + labels)
    Step 4: Tests                (AnimationController + MapModes updates)
```

No new files. All changes in `src/renderer/`.

---

## Delegation Payload: UI → @frontend-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/project/2026-06-08-architecture-enhancements-v4.md
- **Launch Plan**: .plans/project/2026-06-08-launch-plan-enhancements-v4.md
- **Execution Mode**: sequential
- **Workstream**: ui — Wave 1 of 1
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Confirm you have read the v4 architecture plan, delegation protocol, will follow 7-gate sequence, will present execution plan for approval, and acknowledge Wave 1 of 1.

---

## Workstream: UI Enhancements v4 — @frontend-lead

**Architecture Reference**: `.plans/project/2026-06-08-architecture-enhancements-v4.md`
**Launch Plan Reference**: `.plans/project/2026-06-08-launch-plan-enhancements-v4.md`

### Execution Context
- **Mode**: sequential
- **Wave**: 1 of 1
- **Parallel peers**: none
- **Prerequisites**: `main` is current (v3 merged)
- **Branch**: `feature/ui/world-simulator-enhancements-v4`
- **Sync point**: merge to `main` when complete

### Context

v3 is on `main`. This is a targeted renderer patch with four changes:
1. State color overlay now applies in all map modes, not just political
2. Bold borders now appear on all state frontier edges including coastlines
3. Flash animations move from tile fill to edge glow
4. State name + tile-count labels appear on the map

All changes are in `src/renderer/` only.

---

## STEP 1: `src/renderer/AnimationController.ts`

Add the following method to `AnimationController`:

```typescript
getFlashingTiles(): ReadonlyMap<number, { type: AnimationType; intensity: number }> {
  const result = new Map<number, { type: AnimationType; intensity: number }>();
  for (const [idx, anim] of this.animations) {
    result.set(idx, { type: anim.type, intensity: anim.remaining / anim.total });
  }
  return result;
}
```

Keep `getFlashIntensity()` and `getFlashType()` — do **not** remove them (they may be used in tests; just leave them in place).

---

## STEP 2: `src/renderer/MapModes.ts`

### 2a. Remove `animations` parameter from `getTileColor`

Current signature:
```typescript
export function getTileColor(
  tile: HexTile,
  mode: MapMode,
  _stateColor: string | null,
  animations: AnimationController,
): string
```

New signature:
```typescript
export function getTileColor(
  tile: HexTile,
  mode: MapMode,
  _stateColor: string | null,
): string
```

Remove the import of `AnimationController` from this file.

### 2b. Remove the flash-blend block

Delete these lines from the function body:
```typescript
// Apply animation flash
const intensity = animations.getFlashIntensity(tile.index);
if (intensity > 0) {
  const flashType = animations.getFlashType(tile.index);
  const flashColor = flashType === 'conquest' ? '#ffd700' : '#ff4444';
  color = lerpColor(color, flashColor, intensity);
}
```

Also delete the now-unused `lerpColor` helper **only if** it has no other callers in this file. (It is currently used by `heatmapColor` → keep it. Actually `lerpColor` is used by `heatmapColor` only, so keep `lerpColor`. The chain: `getTileColor` calls `heatmapColor` calls `lerpColor`.)

---

## STEP 3: `src/renderer/HexRenderer.ts`

Apply four distinct changes in order.

### 3a. Fix `getTileColor` call site

In PASS 1 (terrain fill loop), the current call is:
```typescript
const color = getTileColor(tile, uiState.mapMode, stateColor, animations);
```

Change to:
```typescript
const color = getTileColor(tile, uiState.mapMode, null);
```

(The `stateColor` arg was already `_stateColor` — unused. Pass `null` explicitly. Remove `animations` arg.)

### 3b. Remove the political-mode gate on PASS 1b

Current code:
```typescript
// PASS 1b: Political overlay (semi-transparent state tint)
if (uiState.mapMode === 'political') {
  for (const tile of tiles) {
    ...
  }
}
```

Change to (remove the `if` wrapper, keep the loop body):
```typescript
// PASS 1b: State color overlay (always active — tint on all modes)
for (const tile of tiles) {
  if (tile.terrain === 'ocean') continue;
  const stateId = simState.ownership[tile.index];
  if (stateId == null || stateId < 0) continue;
  const state = simState.states.get(stateId);
  if (!state) continue;
  const [r, g, b] = this.hexToRgb(state.color);
  const [cx, cy] = this.tileCenter(tile.q, tile.r);
  const verts = hexVertices(cx, cy, HEX_SIZE - 0.5);
  ctx.beginPath();
  ctx.moveTo(verts[0][0], verts[0][1]);
  for (let i = 1; i < 6; i++) ctx.lineTo(verts[i][0], verts[i][1]);
  ctx.closePath();
  ctx.fillStyle = `rgba(${r},${g},${b},0.42)`;
  ctx.fill();
}
```

### 3c. Fix PASS 2 border frontier logic

Replace the current `if/else` inside the edge loop:
```typescript
// OLD:
if (tileIsLand && neighborIsLand && stateId !== neighborState) {
  blackEdges.push([v1, v2]);
} else {
  greyEdges.push([v1, v2]);
}
```

With the new frontier classification:
```typescript
// NEW:
const tileHasState = tile.terrain !== 'ocean' && stateId >= 0;
const neighborHasState = tiles[neighborIdx]?.terrain !== 'ocean' && neighborState >= 0;

const isFrontier =
  (tileHasState && neighborHasState && stateId !== neighborState) || // cross-state
  (tileHasState && !neighborHasState) ||                             // land state meets ocean/unowned
  (!tileHasState && neighborHasState);                               // ocean meets land state

if (isFrontier) {
  blackEdges.push([v1, v2]);
} else {
  greyEdges.push([v1, v2]);
}
```

This ensures coastlines of named states are always rendered as bold black borders.

### 3d. Add PASS 5: Edge flash

After PASS 2 (border draw) and before the selected state outline block, insert:

```typescript
// PASS 5: Edge flash — conquest (gold) / secession (red)
const flashingTiles = animations.getFlashingTiles();
if (flashingTiles.size > 0) {
  for (const [tileIndex, { type, intensity }] of flashingTiles) {
    const tile = tiles[tileIndex];
    if (!tile) continue;
    const flashColor = type === 'conquest'
      ? `rgba(255,215,0,${intensity})`
      : `rgba(255,60,60,${intensity})`;
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

### 3e. Add PASS 9: State name labels

After PASS 8 (sea voyage arcs) and before the closing `ctx.restore()`, insert:

```typescript
// PASS 9: State name labels
const MIN_TILES_FOR_LABEL = 3;
const MIN_SCALE_FOR_LABEL = 0.5;

if (this.camera.scale >= MIN_SCALE_FOR_LABEL) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const [, state] of simState.states) {
    if (state.size < MIN_TILES_FOR_LABEL) continue;

    // Compute centroid (average of tile centers)
    let sx = 0, sy = 0;
    for (const idx of state.tileIndices) {
      const t = tiles[idx];
      if (!t) continue;
      const [tx, ty] = this.tileCenter(t.q, t.r);
      sx += tx; sy += ty;
    }
    const cx = sx / state.tileIndices.size;
    const cy = sy / state.tileIndices.size;

    const fontSize = Math.max(7, Math.min(11, HEX_SIZE * 0.85));
    const lineGap = fontSize * 1.3;

    // Name — stroke halo then fill
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.70)';
    ctx.strokeText(state.name, cx, cy - lineGap * 0.4);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(state.name, cx, cy - lineGap * 0.4);

    // Tile count — stroke halo then fill
    const countSize = Math.max(6, fontSize - 1.5);
    ctx.font = `400 ${countSize}px sans-serif`;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.60)';
    ctx.strokeText(`${state.size}`, cx, cy + lineGap * 0.55);
    ctx.fillStyle = 'rgba(255,255,255,0.70)';
    ctx.fillText(`${state.size}`, cx, cy + lineGap * 0.55);
  }

  ctx.restore();
}
```

---

## STEP 4: Tests

### `src/renderer/AnimationController.test.ts`

Add to the existing test file:

```typescript
describe('getFlashingTiles', () => {
  it('returns empty map when no animations active', () => {
    const c = new AnimationController();
    expect(c.getFlashingTiles().size).toBe(0);
  });
  it('returns conquest tile with intensity 1.0 immediately after mark', () => {
    const c = new AnimationController();
    c.markConquest(5);
    const ft = c.getFlashingTiles();
    expect(ft.get(5)?.type).toBe('conquest');
    expect(ft.get(5)?.intensity).toBe(1.0);
  });
  it('returns secession tile with correct type', () => {
    const c = new AnimationController();
    c.markSecession(7);
    expect(c.getFlashingTiles().get(7)?.type).toBe('secession');
  });
  it('intensity decreases after tick', () => {
    const c = new AnimationController();
    c.markConquest(1);       // 600ms total
    c.tick(300);
    const intensity = c.getFlashingTiles().get(1)?.intensity ?? 0;
    expect(intensity).toBeCloseTo(0.5);
  });
  it('tile removed from map after full duration', () => {
    const c = new AnimationController();
    c.markConquest(2);
    c.tick(600);
    expect(c.getFlashingTiles().has(2)).toBe(false);
  });
});
```

### `src/renderer/MapModes.test.ts`

Update any existing calls to `getTileColor` that pass an `animations` argument — remove the last argument. Ensure the test still passes.

If a test for the flash blend exists (checking that tile color changes toward gold on conquest), **delete** that test — the behavior no longer exists in `getTileColor`.

---

## Acceptance Criteria (v4 complete)

1. Every map mode (terrain, productivity, obstacle, political) shows state territories with their distinct color tint; terrain remains legible through the `0.42` alpha overlay
2. Every state is fully enclosed by bold black border lines — coastlines are bold, not grey
3. Conquest events produce a **gold edge glow** fading over 600ms on the affected tile (no fill change)
4. Secession events produce a **red edge glow** fading over 800ms on the affected tile (no fill change)
5. States with ≥ 3 tiles display a two-line label (name, then tile count) centered in their territory
6. Labels use stroke-then-fill halo rendering and are legible on all biome backgrounds
7. No labels rendered when camera `scale < 0.5`
8. `npm run build` exits 0; `npm test` all pass (including updated `AnimationController` and `MapModes` tests)

---

## Out of Scope (v4)
- Label collision avoidance
- Animated labels
- Clickable labels
- User-customizable label font/size
```

---

## Reproducibility Checksum
- **Architecture Hash**: 2026-06-08-v4 (renderer patch on v3)
- **Plan Version**: 4
- **Supersedes**: 2026-06-08-launch-plan-enhancements-v3.md
