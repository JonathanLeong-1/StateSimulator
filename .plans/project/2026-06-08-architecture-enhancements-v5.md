# Architecture: World Simulator Enhancements — v5
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Supersedes**: .plans/project/2026-06-08-architecture-enhancements-v4.md (additive patch)
- **Feature Fingerprint**: mapbuilder-space-pan

---

## Overview

This document is an additive patch on top of v4. All prior features are implemented and merged to `main`.

This v5 adds a single UX improvement: **Space + left-drag to pan** in the Map Builder canvas. The user should be able to hold the Space key and drag the map with the left mouse button to navigate, in addition to the existing middle/right-click drag that already works.

---

## Feature: Map Builder Space+Left-Drag Pan

### Problem
The map builder canvas only supports middle-click/right-click drag for panning. Users who expect left-drag navigation (a common convention) cannot easily navigate the map. Left-drag is already reserved for painting tiles, so a modifier key is required.

### Solution
Standard drawing-app UX: **hold Space, then left-drag to pan**. The cursor changes to `grab` while Space is held, and to `grabbing` while actively dragging. Releasing Space or mouse button returns to normal paint behavior. No new toolbar tool, no changes to painting behavior.

Middle/right-click drag pan is unchanged.

### Files Changed

| File | Change |
|------|--------|
| `src/ui/mapbuilder/MapBuilderCanvas.tsx` | Space key tracking, conditional pan in mousedown/mousemove/mouseup/mouseleave |
| `src/ui/mapbuilder/MapBuilderCanvas.module.css` | Add `.spaceReady { cursor: grab; }` |

No other files require modification. The renderer's `panBy()` method already exists.

---

## Implementation Specification

### `MapBuilderCanvas.tsx`

#### New state and refs
```typescript
const isSpacePanRef = useRef(false);
const [spaceHeld, setSpaceHeld] = useState(false);
```

#### Keyboard handler (add to existing `useEffect` keydown handler)
```typescript
// Existing:
const handleKey = (e: KeyboardEvent) => {
  // ... existing shortcuts ...
};
window.addEventListener('keydown', handleKey);
return () => window.removeEventListener('keydown', handleKey);
```

Replace with two listeners:
```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === ' ') {
    e.preventDefault();               // prevent page scroll
    if (!isSpacePanRef.current) {
      isSpacePanRef.current = true;
      setSpaceHeld(true);
    }
    return;
  }
  // ... existing shortcuts (undo/redo/tools/brush/reset) unchanged ...
};
const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === ' ') {
    isSpacePanRef.current = false;
    setSpaceHeld(false);
  }
};
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
return () => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
};
```

#### `handleMouseDown` — button 0 case
Before the existing paint logic, add:
```typescript
if (e.button === 0 && isSpacePanRef.current) {
  isPanningRef.current = true;
  setIsNavigating(true);
  e.preventDefault();
  return;                             // skip painting
}
```

#### `handleMouseUp` — button 0 case
After resetting painting refs, add:
```typescript
if (isPanningRef.current) {
  isPanningRef.current = false;
  setIsNavigating(false);
}
```
(This covers the Space+left-drag case; middle/right-click already handled by the earlier guard.)

#### `handleMouseLeave` — add Space reset
```typescript
isSpacePanRef.current = false;
setSpaceHeld(false);
```

#### Canvas className
```tsx
className={
  isNavigating ? styles.navigating
  : spaceHeld  ? styles.spaceReady
  : styles.canvas
}
```

### `MapBuilderCanvas.module.css`
```css
.spaceReady {
  cursor: grab;
}
```
(`styles.navigating` already sets `cursor: grabbing` or equivalent; verify it does — if not, add `cursor: grabbing` to it.)

---

## Acceptance Criteria

1. Holding Space while hovering over the map builder canvas changes the cursor to a grab hand.
2. Holding Space + left-click-drag pans the map smoothly in all directions.
3. Releasing Space or the mouse button returns to normal cursor and paint behavior.
4. Left-click without Space still paints tiles normally (no regression).
5. Middle-click/right-click drag still pans (no regression).
6. Scroll wheel zoom still works (no regression).
7. Space does not scroll the page while over the canvas.
8. Pressing `R` still resets the view (no regression).

---

## Branch Strategy
- Branch: `feature/frontend/mapbuilder-space-pan`

## Tests Required
- The keyboard-handler split (keydown/keyup) must be tested: simulate `Space` keydown and assert `isSpacePanRef.current` becomes true (unit test via mocked event).
- Verify existing MapBuilderRenderer tests still pass (`npm test`).
- Manual acceptance test against all 8 criteria above.

## Out of Scope
- Touch/trackpad drag (future enhancement)
- On-screen pan hint/tooltip in the panel (low priority; not part of this patch)
