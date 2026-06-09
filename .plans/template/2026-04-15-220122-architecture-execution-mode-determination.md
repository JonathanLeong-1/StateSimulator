# Architecture: Execution Mode Determination Phase

- **Date**: 2026-04-15 22:01:22
- **Architect**: architect
- **Status**: approved

## Project Summary

Add an Execution Mode Determination phase to the architect agent's workflow. This new phase
is inserted between the existing Phase 3 (Save Architecture) and Phase 4 (Workstream Decomposition),
becoming the new Phase 4 — with subsequent phases renumbered accordingly.

The phase queries the user about their development environment (local VS Code vs. GitHub Codespaces),
analyzes the workstream dependency graph to compute parallel execution waves, and produces a
Launch Plan document that tells the user exactly how to execute workstreams in their chosen mode.

This is a documentation/configuration change to the multi-agent template itself. No application
code is involved.

## Architecture Style

Documentation + agent definition configuration change (Markdown files only).

## Scope of Change

### Phase Renumbering

| Current Phase | New Phase | Name                              |
|---------------|-----------|-----------------------------------|
| Phase 1       | Phase 1   | Discovery                         |
| Phase 2       | Phase 2   | Architecture Design               |
| Phase 3       | Phase 3   | Save Approved Architecture        |
| *(none)*      | **Phase 4** | **Execution Mode Determination** (NEW) |
| Phase 4       | Phase 5   | Workstream Decomposition (updated)|
| Phase 5       | Phase 6   | Delegation (updated)              |

### New Phase 4: Execution Mode Determination

#### Step 1: Environment Detection & Query

1. **Auto-detect**: Check `` environment variable via terminal command.
   - If set → suggest "Parallel (Codespaces)" mode
   - If not set → suggest "Sequential (local)" mode
2. **Ask the user** via `askQuestions` to confirm or override:
   - **Parallel (Codespaces)** — One Codespace per lead, maximum parallelism
   - **Sequential (Local VS Code)** — One lead at a time in a single window
   - **Constrained Parallel** — User specifies available Codespace slot count
3. If "Constrained Parallel" selected, follow-up question to get slot count (2, 3, 4, 5+).
4. **Default** (backward-compatible): If the user skips the question → sequential mode.

#### Step 2: Dependency Graph Analysis

Using workstreams identified during Phase 2, build a DAG and compute execution waves:

1. **Identify edges**: For each workstream, note dependencies (e.g., frontend → backend).
2. **Topological sort into waves**:
   - **Wave 1**: Workstreams with no dependencies (in-degree = 0)
   - **Wave 2**: Workstreams whose dependencies are all in Wave 1
   - **Wave N**: Workstreams whose dependencies are all in prior waves
3. **Calculate parallelism**: `parallel_slots_needed = max(|Wave_i|)` across all waves.
4. **Constrained scheduling**: If slots < max wave width, split oversized waves into sub-waves.

Example:
`
Workstreams: infra, backend, frontend, mobile
Dependencies: frontend → backend, mobile → backend, backend → infra

DAG:  infra → backend → frontend
                     → mobile

Waves:
  Wave 1: [infra]              (1 slot)
  Wave 2: [backend]            (1 slot)
  Wave 3: [frontend, mobile]   (2 slots)

Max parallelism needed: 2
Total execution waves: 3
`

#### Step 3: Produce the Launch Plan

Save to `.plans/<date>-<time>-launch-plan-<project>.md`:

`markdown
# Launch Plan: <Project Name>
- **Date**: <YYYY-MM-DD HH:MM:SS>
- **Architecture Reference**: .plans/<architecture-file>.md
- **Execution Mode**: <parallel | sequential | constrained-parallel>
- **Available Slots**: <number or "unlimited">
- **Total Workstreams**: <N>
- **Total Waves**: <N>

## Dependency Graph
<ASCII DAG or adjacency list>

## Execution Schedule

### Wave 1 — <description>
- **Parallel slots used**: <N>
- **Workstreams**:
  - <workstream> → @<lead> [Codespace/session assignment]
- **Sync point**: All Wave 1 must complete and merge to main before Wave 2

### Wave 2 — <description>
- **Prerequisite**: Wave 1 merged
- **Parallel slots used**: <N>
- **Workstreams**:
  - <workstream> → @<lead> [Codespace/session assignment]
- **Sync point**: ...

## Sequential Fallback Order
1. <workstream> → @<lead>
2. <workstream> → @<lead>
...
`

#### Step 4: Emit Dashboard Event

`
node dashboard/lib/emit-event.js architect plan-saved \
  --plan ".plans/<launch-plan>.md" \
  --detail "Launch plan saved (mode: <mode>)"
`

### Updated Phase 5: Mode-Aware Workstream Briefs

The existing workstream brief format gains an **Execution Context** block:

`markdown
---
## Workstream: <Name> — @<lead-agent>
**Architecture Reference**: `.plans/<architecture-file>.md`
**Launch Plan Reference**: `.plans/<launch-plan-file>.md`

### Execution Context
- **Mode**: <parallel | sequential | constrained-parallel>
- **Wave**: <N> of <total waves>
- **Parallel peers**: <other workstreams in this wave, or "none">
- **Prerequisites**: <workstreams that must merge before this starts>
- **Codespace/Session**: <#N or "sequential — run after <previous>">
- **Sync point**: <what must happen after this completes before dependents start>

### Context
<existing format>

### Scope
<existing format>

### Tasks
<existing format>

### Technical Decisions (from architecture)
<existing format>

### Dependencies
<existing format>

### Interfaces
<existing format>

### Out of Scope
<existing format>
---
`

**Mode-specific formatting rules**:
- **Parallel**: Include Codespace assignment numbers, sync points, merge ordering.
  Each brief is self-contained for pasting into a fresh Codespace.
- **Sequential**: Include linear ordering (Run #N of M), explicit dependency on prior
  workstream completion, `git pull origin main` reminders between workstreams.
- **Constrained parallel**: Include wave assignment with sub-wave scheduling for
  over-capacity waves.

### Updated Phase 6: Mode-Aware Handshake

The Architect → Lead Handshake Payload gains two new fields:

`markdown
## Architect Handshake
- **Architecture Plan**: <path to .plans/project/ architecture file>
- **Launch Plan**: <path to .plans/project/ launch plan file>          ← NEW
- **Execution Mode**: <parallel | sequential | constrained>   ← NEW
- **Workstream Brief**: <the full workstream task brief>
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Lead MUST confirm:
  1. It has read the architecture plan
  2. It has read the delegation protocol
  3. It will follow the 7-Gate mandatory sequence
  4. It will present its execution plan to the human before starting
  5. It acknowledges its execution mode and wave assignment  ← NEW
`

## Files to Change

| File | Change | Description |
|------|--------|-------------|
| `.github/agents/architect.agent.md` | Major edit | Insert Phase 4 (Execution Mode Determination), renumber Phase 4→5 and Phase 5→6, update Phase 5 brief format with Execution Context block, update Phase 6 handshake with Launch Plan + Execution Mode fields |
| `TEMPLATE-GUIDE.md` | Edit | Update Orchestrator Runbook to include execution mode step between plan approval and workstream delegation, update phase numbering references, document Launch Plan format, update "Single-Machine Alternative" and "Parallel Workstreams" sections |
| `.github/copilot-instructions.md` | Minor edit | Add mention that launch plans are saved to `.plans/` alongside architecture docs, note that workstream briefs now include execution context metadata |
| `.github/prompts/design-architecture.prompt.md` | Minor edit | Update numbered workflow steps from 6 to 7 to reflect the new phase |

## Design Decisions

1. **Separate Launch Plan file**: Architecture describes *what* to build. Launch Plan describes *how to execute*. Separation allows re-running execution mode without re-approving architecture.

2. **Auto-detect with confirmation**: `` is reliable but user might want sequential even in Codespaces (debugging, learning). Always confirm.

3. **Multi-phase wave model**: Real projects have dependency chains (infra → backend → frontend). Wave model handles this naturally.

4. **Constrained parallel support**: Not everyone has unlimited Codespace hours. Supporting "I have N slots" makes the template practical for budget-conscious teams.

5. **Sequential fallback always included**: Even in parallel mode, include a linear ordering as fallback if a Codespace fails or user switches mid-execution.

6. **Backward compatibility**: Skipping the environment question defaults to sequential — identical to current behavior. Existing projects are unaffected.

7. **No external dependencies**: All logic is in agent definition Markdown. No npm packages, scripts, or tools required.

## Constraints

- [x] Backward compatible (defaults to sequential if skipped)
- [x] No external dependencies added
- [x] Works within existing 7-gate delegation protocol
- [x] Architect remains sole editor of `.plans/`
- [x] Documentation/configuration changes only

## Approval

- Approved by: human user
- Approved at: 2026-04-15 22:01:22
