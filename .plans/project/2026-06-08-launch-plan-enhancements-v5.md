# Launch Plan: Map Builder Space+Pan — v5
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Architecture Ref**: `.plans/project/2026-06-08-architecture-enhancements-v5.md`
- **Feature Fingerprint**: mapbuilder-space-pan

---

## Execution Mode
Local sequential (single Codespace). One frontend workstream.

## Wave 1 — Implementation

### Branch
`feature/frontend/mapbuilder-space-pan`

### Scope
- `src/ui/mapbuilder/MapBuilderCanvas.tsx` — Space key tracking + pan logic
- `src/ui/mapbuilder/MapBuilderCanvas.module.css` — `.spaceReady` cursor class

### Developer Delegation Payload

**Plan ref**: `.plans/project/2026-06-08-architecture-enhancements-v5.md`  
**Branch**: `feature/frontend/mapbuilder-space-pan`  
**Task**: Implement Space + left-drag pan in the Map Builder canvas per the v5 architecture spec.

**Specific changes**:

1. **`MapBuilderCanvas.tsx`**
   - Add `const isSpacePanRef = useRef(false);` and `const [spaceHeld, setSpaceHeld] = useState(false);` to the component body.
   - Split the existing single `keydown` event listener into a `keydown` + `keyup` pair inside the same `useEffect`. The `keydown` handler intercepts `' '` (Space): calls `e.preventDefault()`, sets `isSpacePanRef.current = true` and `setSpaceHeld(true)` when not already set. All other existing key shortcuts remain unchanged. The new `keyup` handler clears `isSpacePanRef.current` and calls `setSpaceHeld(false)` when `e.key === ' '`. Both listeners must be registered and cleaned up in the same `useEffect` return.
   - In `handleMouseDown`: add a guard at the top of the button-0 branch — if `isSpacePanRef.current` is true, set `isPanningRef.current = true`, call `setIsNavigating(true)`, call `e.preventDefault()`, and return (skip paint).
   - In `handleMouseUp`: after the existing `isPaintingRef.current = false` reset for button 0, add: if `isPanningRef.current` is true at this point (Space-pan case), set `isPanningRef.current = false` and call `setIsNavigating(false)`.
   - In `handleMouseLeave`: add `isSpacePanRef.current = false; setSpaceHeld(false);` after the existing resets.
   - Change the canvas `className` to: `isNavigating ? styles.navigating : spaceHeld ? styles.spaceReady : styles.canvas`.

2. **`MapBuilderCanvas.module.css`**
   - Add `.spaceReady { cursor: grab; }`.
   - Verify `styles.navigating` sets `cursor: grabbing` (or `cursor: move`); add it if missing.

**Acceptance criteria** (see architecture doc section "Acceptance Criteria" for full list):
- Space held → grab cursor; Space + left drag → map pans smoothly
- Release Space or mouse → paint mode resumes, cursor reverts
- No regressions in painting, middle/right-click pan, scroll zoom, or keyboard shortcuts

---

## Wave 2 — Test, Review, Docs

### Tester Delegation Payload
**Branch**: `feature/frontend/mapbuilder-space-pan`  
**Task**: Run `npm test` and verify all existing tests still pass. Write at minimum one new unit test for the keydown/keyup Space logic (can be in `MapBuilderRenderer.test.ts` or a new file if the test framework supports it).

### Code Reviewer Delegation Payload
**Branch**: `feature/frontend/mapbuilder-space-pan`  
**Task**: Review the two changed files. Confirm: no regression in existing handlers, proper cleanup of both keydown and keyup listeners, no memory leaks, CSS cursor values are valid.

### Docs Writer Delegation Payload
**Branch**: `feature/frontend/mapbuilder-space-pan`  
**Task**: Update `README.md` map builder controls section to mention Space + left-drag to pan.

---

## Wave 3 — Merge

1. All tests pass (`npm test`)
2. Reviewer verdict: APPROVE
3. Merge `feature/frontend/mapbuilder-space-pan` → `main` via PR
4. Verify build passes after merge
