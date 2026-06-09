# Launch Plan: Map Dimension 4× Expansion + Step ×100 Button
- **Date**: 2026-06-08
- **Architecture Reference**: .plans/project/2026-06-08-architecture-map-dimension-step100.md
- **Feature Fingerprint**: map-dimension-step100
- **Execution Mode**: sequential
- **Available Slots**: 1
- **Total Workstreams**: 1 (frontend)
- **Total Waves**: 1

---

## Dependency Graph

```
(no inter-workstream dependencies)

frontend  [Wave 1, sole workstream]
```

---

## Execution Schedule

### Wave 1 — Frontend Implementation
- **Parallel slots used**: 1
- **Workstreams**:
  - `frontend` → @frontend-lead [session #1]
- **Sync point**: Wave 1 is the only wave. After all gates pass, PR to `main`.

---

## Sequential Fallback Order
1. frontend → @frontend-lead

---

## Gate Sequence (per project standards)

| Gate | Action | Agent | Exit Condition |
|------|--------|-------|---------------|
| 0 | Plan Approval | human | Human confirms this launch plan |
| 1 | Branch Creation | @frontend-lead | Branch `feature/frontend/map-dimension-step100` exists |
| 2 | Implementation | @developer | All 6 files modified; completion report returned |
| 2.5 | Test Spec Readiness | @test-lead (or fallback) | Specs exist or fallback documented |
| 3 | Testing | @tester | `npm test` → ALL PASS verdict |
| 4 | Code Review | @code-reviewer | APPROVE verdict with no blocking findings |
| 5 | Documentation | @docs-writer | README updated if needed; completion report returned |
| 6 | Pre-Commit Checklist | @frontend-lead | All 8 checkboxes TRUE |
| 7 | Commit & Report | @frontend-lead | Session log written, events emitted, PR opened |

---

## Pre-Commit Checklist (Gate 6)

- [ ] Feature branch `feature/frontend/map-dimension-step100` is checked out
- [ ] `npm test` exits 0 (all tests pass)
- [ ] `npm run build` exits 0 (no type errors, no compile errors)
- [ ] `SimulationContext.tsx` dimensions changed to 160×100
- [ ] `MapBuilderContext.tsx` constants changed to 160/100
- [ ] `ControlPanel.tsx` "⏭+100" button added and wired to `stepN(100)`
- [ ] `stepN(n)` implemented and exported from SimulationContext
- [ ] No commented-out code in any modified file

---

## Merge Steps

1. Push branch: `git push origin feature/frontend/map-dimension-step100`
2. Open PR to `main` with title: `feat(frontend): 4x map dimensions (160×100) + Step ×100 button`
3. PR description must reference this launch plan.
4. PR must pass all CI checks (build + tests).
5. Squash-merge or merge commit — do NOT rebase over `main` history.

---

## Delegation Payloads

### Payload: Frontend → @frontend-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/project/2026-06-08-architecture-map-dimension-step100.md
- **Launch Plan**: .plans/project/2026-06-08-launch-plan-map-dimension-step100.md
- **Execution Mode**: sequential
- **Workstream Brief**: see below
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Confirm you have read (1) the architecture plan,
  (2) the delegation protocol, (3) will follow the 7-Gate sequence, (4) will
  present your execution plan before starting work, (5) acknowledge sequential
  mode, Wave 1 of 1.

---

## Workstream: Frontend — @frontend-lead
**Architecture Reference**: `.plans/project/2026-06-08-architecture-map-dimension-step100.md`
**Launch Plan Reference**: `.plans/project/2026-06-08-launch-plan-map-dimension-step100.md`

### Execution Context
- **Mode**: sequential
- **Wave**: 1 of 1
- **Parallel peers**: none
- **Prerequisites**: none
- **Codespace/Session**: sequential — sole workstream
- **Sync point**: after Gate 7, open PR to main

### Context
World-Simulator is a browser-based hex-grid geopolitical simulation (React 18 +
TypeScript + Vite 5, HTML5 Canvas). This workstream delivers two additive
features:
  Feature A — expand world from 80×50 to 160×100 tiles (4× area).
  Feature B — add a "Step ×100" bulk-advance button to the UI.
Both changes are self-contained within the existing frontend module.

### Scope
- Modify 3 source files (SimulationContext, MapBuilderContext, ControlPanel)
- Update 3 test files (SimulationEngine.test, WorldGenerator.test, StateManager.test)
- All changes on branch: feature/frontend/map-dimension-step100

### Tasks

#### Task 1 — Feature A: Expand map dimensions (SimulationContext.tsx)
File: `src/SimulationContext.tsx`
Inside `buildWorld()`, locate the object literal passed to `generator.generate(...)`.
Change `width: 80` → `width: 160`.
Change `height: 50` → `height: 100`.
Acceptance criteria: `generator.generate` is called with width=160, height=100.

#### Task 2 — Feature A: Expand builder dimensions (MapBuilderContext.tsx)
File: `src/ui/mapbuilder/MapBuilderContext.tsx`
Locate module-level constants (lines ~23-24):
  `const WIDTH = 80;`  →  `const WIDTH = 160;`
  `const HEIGHT = 50;` →  `const HEIGHT = 100;`
Acceptance criteria: MapBuilder initialises a 160×100 tile grid.

#### Task 3 — Feature B: Implement stepN (SimulationContext.tsx)
File: `src/SimulationContext.tsx`
Add `stepN(n: number): void` to the SimulationContextValue type and to the
context value object. Implementation:
  1. If uiState.isPlaying is true, set isPlaying to false (pause) synchronously.
  2. Call engine.current.step() exactly n times in a for loop.
  3. After the loop, call setSimState(engine.current.getState()) once.
  4. uiState.isPlaying must be false after this function returns.
Do NOT call setSimState inside the loop.
Acceptance criteria: stepN(100) advances turn by 100 and leaves isPlaying false.

#### Task 4 — Feature B: Add ⏭+100 button (ControlPanel.tsx)
File: `src/ui/ControlPanel.tsx`
Import stepN from useSimulation() alongside the existing destructured values.
In the first buttonRow div, add immediately after the "⏭ Step" button:
  <button className={styles.btn} onClick={() => stepN(100)} disabled={isPlaying}>
    ⏭+100
  </button>
Acceptance criteria: button is visible, disabled when isPlaying, calls stepN(100) when clicked.

#### Task 5 — Regression/update: SimulationEngine.test.ts
File: `src/simulation/SimulationEngine.test.ts`
  a. Search for any hard-coded 80 or 50 dimension values in test assertions; update to 160/100.
  b. Add test: create engine with generate({width:160, height:100, seed:42, seaConquestRadius:3}),
     call step() 100 times, assert engine.getState().turn === 100.

#### Task 6 — Regression/update: WorldGenerator.test.ts
File: `src/simulation/WorldGenerator.test.ts`
  a. Search for any hard-coded 80/50 dimension values; update to 160/100.
  b. Add or update test: generate({width:160,height:100,seed:1,seaConquestRadius:3})
     → result.tiles.length === 16000.

#### Task 7 — Regression check: StateManager.test.ts
File: `src/simulation/StateManager.test.ts`
  Inspect for dimension-dependent expectations. Update 80→160, 50→100 where found.
  If no dimension-dependent tests exist, no change needed (document this in completion report).

### Technical Decisions (from architecture)
- Language/Framework: TypeScript strict mode, React 18, Vite 5
- Engine access: via `engine.current` (useRef)
- State flush: `setSimState(engine.current.getState())` — single call after loop
- Context value type: `SimulationContextValue` — add `stepN: (n: number) => void`
- Button label: `⏭+100` (Unicode, consistent with existing buttons)
- Button class: `styles.btn` (existing CSS module class)
- Disabled condition: `disabled={isPlaying}` (same as "⏭ Step")
- Test runner: Vitest (`npm test`)
- Build: Vite (`npm run build`)

### Dependencies
- Depends on: None
- Depended on by: None

### Interfaces
- `stepN(n: number): void` must be added to the SimulationContextValue type
  and exported from the context so ControlPanel can consume it via useSimulation().

### Out of Scope
- Web worker offloading
- User-configurable step count UI
- Map dimension UI controls
- Changes to WorldGenerator terrain algorithms
- Changes to HexRenderer, AnimationController, MapModes
- Any other files not listed in Tasks 1–7
```

---

### Payload: @tester

```
## Tester Delegation Payload
- **Plan**: .plans/project/2026-06-08-launch-plan-map-dimension-step100.md
- **Branch**: feature/frontend/map-dimension-step100
- **Task**: Run the full test suite and return a verdict.

### Steps
1. git checkout feature/frontend/map-dimension-step100
2. npm install (if needed)
3. npm test
4. Record all pass/fail results.

### Required Test Coverage
- WorldGenerator: generate({width:160,height:100,...}) → tiles.length === 16000
- SimulationEngine: 100 x step() → turn === 100
- stepN(100) while paused: turn+100, isPlaying false
- stepN(100) while playing: pauses, turn+100, isPlaying false
- All pre-existing tests continue to pass

### Verdict Format
Return: "ALL PASS" or list each failure with file:line and error message.
Include: npm test stdout/stderr excerpt.
```

---

### Payload: @code-reviewer

```
## Code Reviewer Delegation Payload
- **Plan**: .plans/project/2026-06-08-launch-plan-map-dimension-step100.md
- **Branch**: feature/frontend/map-dimension-step100
- **Task**: Review all changes and return APPROVE or REQUEST_CHANGES.

### Files to Review
- src/SimulationContext.tsx (dimensions + stepN)
- src/ui/ControlPanel.tsx (new button)
- src/ui/mapbuilder/MapBuilderContext.tsx (constants)
- src/simulation/SimulationEngine.test.ts
- src/simulation/WorldGenerator.test.ts
- src/simulation/StateManager.test.ts

### Review Checklist
- [ ] stepN() pauses correctly when isPlaying is true
- [ ] stepN() calls engine.current.step() exactly n times (not n±1)
- [ ] setSimState called exactly once after the loop (not inside)
- [ ] ⏭+100 button disabled when isPlaying
- [ ] No commented-out code
- [ ] TypeScript strict mode: no type errors
- [ ] No regressions in existing logic
- [ ] OWASP Top 10: no new injection, XSS, or insecure deserialization vectors
  (Note: client-only app, no user input → DOM injection — verify button label is hardcoded)

### Verdict Format
Return: "APPROVE" or "REQUEST_CHANGES: <issue 1>, <issue 2>, ..."
```

---

### Payload: @docs-writer

```
## Docs Writer Delegation Payload
- **Plan**: .plans/project/2026-06-08-launch-plan-map-dimension-step100.md
- **Branch**: feature/frontend/map-dimension-step100
- **Task**: Update README.md if it documents map dimensions or controls.

### Steps
1. Read README.md for any mention of "80×50", "4,000 tiles", "Step" controls, or map dimensions.
2. If found: update mentions of 80×50 → 160×100, 4,000 → 16,000, add note about ⏭+100 button.
3. If not found: no changes needed — document this in completion report.
4. Do NOT modify TEMPLATE-GUIDE.md.

### Completion Report Fields
- Files modified (list)
- Summary of changes
- "Log Written: yes"
```

---

## Reproducibility Checksum

- **Architecture Hash**: (SHA-256 of architecture doc content — first 8 chars)
- **Plan Version**: 1
- **Prior Instances**: none

---

## Acceptance Criteria Checklist (final gate before merge)

- [ ] AC1: `WorldGenerator.generate({width:160,height:100,seed:1,seaConquestRadius:3}).tiles.length === 16000`
- [ ] AC2: `SimulationContext.buildWorld()` passes `width:160, height:100` to generator
- [ ] AC3: MapBuilder initialises with WIDTH=160, HEIGHT=100
- [ ] AC4: "⏭+100" button visible in ControlPanel next to "⏭ Step"
- [ ] AC5: stepN(100) while paused → turn+100, isPlaying=false
- [ ] AC6: stepN(100) while playing → pauses, turn+100, isPlaying=false
- [ ] AC7: play/pause, single-step, reset, randomize all work as before
- [ ] AC8: `npm test` passes (0 failures)
- [ ] AC9: `npm run build` succeeds (0 type errors)
