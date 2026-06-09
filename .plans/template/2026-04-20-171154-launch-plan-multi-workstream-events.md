# Launch Plan: Multi-Workstream Dashboard Event Aggregation

- **Date**: 2026-04-20 17:11:54
- **Architecture Reference**: .plans/template/2026-04-20-171154-architecture-multi-workstream-events.md
- **Feature Fingerprint**: multi-workstream-dashboard-events
- **Execution Mode**: sequential
- **Available Slots**: 1 (single VS Code window)
- **Total Workstreams**: 3
- **Total Waves**: 2

## Dependency Graph

```
core-pipeline → dashboard-ui
              → agent-definitions
```

- `dashboard-ui` depends on `core-pipeline` (needs workstream data in SessionState and multi-file server)
- `agent-definitions` depends on `core-pipeline` (needs push-events.js and pull-events.js CLIs to exist)
- `dashboard-ui` and `agent-definitions` are independent of each other

## Execution Schedule

### Wave 1 — Core Event Pipeline

- **Parallel slots used**: 1
- **Workstreams**:
  - core-pipeline → @backend-lead [session #1]
- **Sync point**: All Wave 1 work must complete, tests pass, and merge to `main` before Wave 2 begins

### Wave 2 — UI + Agent Definitions

- **Prerequisite**: Wave 1 merged to `main`
- **Parallel slots used**: 1 (sequential — run one at a time)
- **Workstreams**:
  - dashboard-ui → @frontend-lead [session #2]
  - agent-definitions → @infra-lead [session #3]
- **Sync point**: Each workstream merges to `main` before the next begins

## Sequential Fallback Order

1. core-pipeline → @backend-lead
2. dashboard-ui → @frontend-lead
3. agent-definitions → @infra-lead

## Delegation Payloads

### Payload: Core Event Pipeline → @backend-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/template/2026-04-20-171154-architecture-multi-workstream-events.md
- **Launch Plan**: .plans/template/2026-04-20-171154-launch-plan-multi-workstream-events.md
- **Execution Mode**: sequential
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Lead MUST confirm:
  1. It has read the architecture plan
  2. It has read the delegation protocol
  3. It will follow the 7-Gate mandatory sequence
  4. It will present its execution plan to the human before starting
  5. It acknowledges its execution mode and wave assignment

---
## Workstream: Core Event Pipeline — @backend-lead
**Architecture Reference**: `.plans/template/2026-04-20-171154-architecture-multi-workstream-events.md`
**Launch Plan Reference**: `.plans/template/2026-04-20-171154-launch-plan-multi-workstream-events.md`

### Execution Context
- **Mode**: sequential
- **Wave**: 1 of 2
- **Parallel peers**: none
- **Prerequisites**: none
- **Codespace/Session**: sequential — run first
- **Sync point**: Must merge to main before Wave 2 begins

### Context
The Agent Monitor Dashboard currently reads from a single `.agent-events/events.jsonl` file. When parallel workstreams run on isolated filesystems (separate Codespaces), the dashboard only sees events from its co-located workstream. This workstream builds the foundation: per-workstream event file routing, git-based cross-Codespace transport, multi-file state processing, and multi-file server watching.

### Scope
All backend/library changes to the dashboard event pipeline:
- Event file routing in log-event.js
- New push-events.js and pull-events.js CLIs
- SessionState multi-workstream enhancements
- Server multi-file watching and git-poll support
- .gitignore update

### Tasks

1. **Modify `dashboard/lib/log-event.js`** — Route events to `events-<workstream>.jsonl` when `opts.workstream` is present. When absent, write to `events.jsonl` (backward compatible). Validate workstream name matches `/^[a-z][a-z0-9-]*$/`.
   - **Acceptance criteria**: Events with `workstream: "backend"` are written to `.agent-events/events-backend.jsonl`. Events without workstream are written to `.agent-events/events.jsonl`. Invalid workstream names throw an error.

2. **Create `dashboard/lib/push-events.js`** — CLI script that commits local event files to the `agent-events` orphan branch and force-pushes. Supports `--workstream <name>` (single file), `--all` (all files), and `--wipe` (clear remote first).
   - **Acceptance criteria**: `node dashboard/lib/push-events.js --workstream backend` creates/updates `events-backend.jsonl` on the `agent-events` branch. `--wipe` clears all files on the branch first. `--all` pushes all `events-*.jsonl` files. Creates the orphan branch if it doesn't exist. Uses git worktree to avoid touching the current working directory.

3. **Create `dashboard/lib/pull-events.js`** — CLI script that fetches the `agent-events` branch and copies all `events-*.jsonl` files to local `.agent-events/`. Supports `--once` (default) and `--interval <ms>`.
   - **Acceptance criteria**: `node dashboard/lib/pull-events.js` fetches the branch and copies files. Graceful handling if branch doesn't exist. `--interval 5000` polls every 5 seconds.

4. **Modify `dashboard/lib/state.js`** — Add `workstream` field to agent state. Store workstream from events. Add `getWorkstreams()` method returning distinct workstream names. Ensure `session-start` resets all workstream data.
   - **Acceptance criteria**: `processEvent({agent: "dev", event: "spawned", workstream: "backend"})` stores `workstream: "backend"` on the agent. `getWorkstreams()` returns `["backend"]`. `getState()` includes workstream on agents. `reset()` clears workstream tracking.

5. **Modify `dashboard/server.js`** — Watch all `events-*.jsonl` files in `.agent-events/` (not just `events.jsonl`). Track byte offsets per file. When `DASHBOARD_GIT_POLL=true`, run `pull-events.js --interval 5000` as a child process. `session-start` from architect wipes all `events-*.jsonl` files.
   - **Acceptance criteria**: Server detects new events from `events-backend.jsonl` and pushes via SSE. Multiple files watched simultaneously. Git-poll starts when env var is set. Session-start truncates all event files.

6. **Modify `.gitignore`** — Change `.agent-events/events.jsonl` to `.agent-events/events*.jsonl` to cover all workstream files.
   - **Acceptance criteria**: `git status` does not show any `events-*.jsonl` files as untracked.

7. **Write/update tests**:
   - `dashboard/test/emit-event.test.js` — Add tests for workstream-routed event emission
   - `dashboard/test/state.test.js` — Add tests for multi-workstream state, getWorkstreams(), session-start multi-file wipe
   - `dashboard/test/server.test.js` — Add tests for multi-file watching
   - `dashboard/test/push-events.test.js` — New: tests for push-events CLI (mock git)
   - `dashboard/test/pull-events.test.js` — New: tests for pull-events CLI (mock git)
   - **Acceptance criteria**: All tests pass with `npm test` in dashboard directory. Coverage of happy paths and error cases.

### Technical Decisions (from architecture)
- Language/Framework: Node.js, zero external dependencies
- Key libraries: Node.js built-ins only (fs, path, child_process for git)
- Patterns: Append-only JSONL, incremental byte-offset reads, file-per-workstream isolation
- Git worktree for push-events to avoid disturbing the current checkout
- Force-push per file is safe (exclusive ownership)
- Workstream name validation: `/^[a-z][a-z0-9-]*$/`

### Dependencies
- Depends on: None (Wave 1)
- Depended on by: dashboard-ui (@frontend-lead), agent-definitions (@infra-lead)

### Interfaces
- `logAgentEvent(opts)` — enhanced with workstream routing (used by emit-event.js and potentially other callers)
- `push-events.js` CLI — called by lead agents after each gate
- `pull-events.js` CLI — called by dashboard server or manually
- `SessionState.getWorkstreams()` — new method consumed by frontend
- `SessionState.getState()` — returns workstream field in agent objects (consumed by SSE stream and /api/state)
- Server SSE events — include workstream field (consumed by frontend app.js)

### Out of Scope
- Frontend UI changes (workstream badges, filters) — that's @frontend-lead's workstream
- Agent definition file updates (--workstream flags) — that's @infra-lead's workstream
- No changes to the dashboard's HTML, CSS, or frontend JS
```

### Payload: Dashboard UI — @frontend-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/template/2026-04-20-171154-architecture-multi-workstream-events.md
- **Launch Plan**: .plans/template/2026-04-20-171154-launch-plan-multi-workstream-events.md
- **Execution Mode**: sequential
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Lead MUST confirm:
  1. It has read the architecture plan
  2. It has read the delegation protocol
  3. It will follow the 7-Gate mandatory sequence
  4. It will present its execution plan to the human before starting
  5. It acknowledges its execution mode and wave assignment

---
## Workstream: Dashboard UI — @frontend-lead
**Architecture Reference**: `.plans/template/2026-04-20-171154-architecture-multi-workstream-events.md`
**Launch Plan Reference**: `.plans/template/2026-04-20-171154-launch-plan-multi-workstream-events.md`

### Execution Context
- **Mode**: sequential
- **Wave**: 2 of 2
- **Parallel peers**: agent-definitions (but run sequentially since local mode)
- **Prerequisites**: core-pipeline (Wave 1) must be merged to main
- **Codespace/Session**: sequential — run after core-pipeline merges
- **Sync point**: Must merge to main before agent-definitions workstream begins

### Context
The core event pipeline (Wave 1) has added per-workstream event files, multi-file watching in the server, and workstream fields in SessionState. This workstream adds the frontend UI elements so the human can see and filter workstream data in the dashboard.

### Scope
All frontend/UI changes to the dashboard:
- Workstream badges on graph nodes
- Workstream filter toggle buttons
- Event feed workstream attribution
- CSS for workstream colors and badges

### Tasks

1. **Modify `dashboard/public/app.js`** — Add `workstreamFilter` set and `workstreams` array to `appState`. Process `workstream` field from agent data. Add `toggleWorkstreamFilter()` function. Call `renderWorkstreamFilters()` from `renderAll()`. Show workstream badge in agent detail panel. Filter graph nodes and events by workstream when filter is active.
   - **Acceptance criteria**: When agents have workstream fields, the UI shows which workstream each agent belongs to. Filter buttons appear for each active workstream. Clicking a filter toggles visibility. When no filter is active, all workstreams are shown.

2. **Modify `dashboard/public/graph.js`** — Add workstream badge rendering on graph nodes. Use a small colored rectangle/tag below or beside the agent name showing the workstream name. Assign distinct colors per workstream (e.g., backend=blue, frontend=green, infra=orange). Hide nodes that don't match the active workstream filter.
   - **Acceptance criteria**: Each graph node with a workstream shows a colored badge. Badges use distinct colors. Filtered-out nodes are hidden (not rendered). Nodes without a workstream (e.g., architect) are always visible.

3. **Modify `dashboard/public/index.html`** — Add a `<div id="workstream-filters">` container in the header area (after the session info, before the graph). This container will be populated dynamically by app.js.
   - **Acceptance criteria**: The filter container exists in the DOM. It's positioned correctly in the header. It's empty by default (populated by JS).

4. **Modify `dashboard/public/styles.css`** — Add styles for workstream badges (`.workstream-badge`), filter buttons (`.workstream-filter-btn`, `.workstream-filter-btn.active`), and workstream-specific colors (`.workstream-backend`, `.workstream-frontend`, `.workstream-infra`, plus a default for unknown workstreams). Maintain dark theme consistency.
   - **Acceptance criteria**: Badges are readable on dark background. Filter buttons have active/inactive states. Colors are visually distinct. Responsive to small window sizes.

5. **Write/update tests** — Manual testing only for frontend (no test framework for vanilla JS SPA). Document test scenarios in the PR description.
   - **Acceptance criteria**: PR description includes manual test scenarios covering: single workstream (backward compat), two workstreams visible, filter toggle, session-start wipe clears workstream UI.

### Technical Decisions (from architecture)
- Language/Framework: Vanilla JS, no build step
- Workstream colors: backend=#4a9eff (blue), frontend=#4aff8a (green), infra=#ffaa4a (orange), default=#aaaaaa (gray)
- Filter buttons use toggle pattern (click to activate/deactivate)
- Architect node has no workstream badge (architect is session-level, not workstream-level)
- Graph filtering hides nodes (removes from SVG) rather than dimming

### Dependencies
- Depends on: core-pipeline (Wave 1) — needs workstream data in /api/state and SSE events
- Depended on by: None

### Interfaces
- Reads `appState.agents[name].workstream` (populated from server state)
- Reads `appState.graph.nodes[i].workstream` (populated from server state)
- Calls `appState.workstreams` (list of active workstreams, derived from agent data)
- No backend API changes needed — all data comes from existing /api/state and SSE

### Out of Scope
- Backend changes (log-event, state, server) — done in Wave 1
- Agent definition updates — that's @infra-lead's workstream
- push-events.js / pull-events.js — done in Wave 1
```

### Payload: Agent Definitions — @infra-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/template/2026-04-20-171154-architecture-multi-workstream-events.md
- **Launch Plan**: .plans/template/2026-04-20-171154-launch-plan-multi-workstream-events.md
- **Execution Mode**: sequential
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Lead MUST confirm:
  1. It has read the architecture plan
  2. It has read the delegation protocol
  3. It will follow the 7-Gate mandatory sequence
  4. It will present its execution plan to the human before starting
  5. It acknowledges its execution mode and wave assignment

---
## Workstream: Agent Definitions — @infra-lead
**Architecture Reference**: `.plans/template/2026-04-20-171154-architecture-multi-workstream-events.md`
**Launch Plan Reference**: `.plans/template/2026-04-20-171154-launch-plan-multi-workstream-events.md`

### Execution Context
- **Mode**: sequential
- **Wave**: 2 of 2
- **Parallel peers**: dashboard-ui (but run sequentially since local mode)
- **Prerequisites**: core-pipeline (Wave 1) must be merged to main
- **Codespace/Session**: sequential — run after dashboard-ui merges
- **Sync point**: Last workstream — merge to main to complete the feature

### Context
The core event pipeline (Wave 1) has added per-workstream event files, push-events.js, and pull-events.js. The dashboard UI (run before this workstream) has added workstream badges and filters. This workstream updates all agent definition files to use the new `--workstream` flag in their event emissions and to call push-events.js for cross-Codespace transport.

### Scope
All agent definition markdown files and copilot-instructions:
- Add `--workstream` flag to emit-event.js calls in lead agents
- Add push-events.js calls after gate completions in lead agents
- Add workstream inheritance in subagent delegation payloads
- Update architect.agent.md with pull-events.js and agent-events branch setup
- Update copilot-instructions.md with multi-workstream protocol documentation

### Tasks

1. **Modify `.github/agents/backend-lead.agent.md`** — Add `--workstream backend` to all `emit-event.js` calls. Add `node dashboard/lib/push-events.js --workstream backend` call after Gate 3 (testing), Gate 4 (review), and Gate 7 (commit). Add instruction to pass `--workstream backend` in all subagent delegation payloads.
   - **Acceptance criteria**: Every emit-event.js call in the file includes `--workstream backend`. push-events.js is called at gates 3, 4, 7. Delegation payloads to @developer, @tester, @code-reviewer, @docs-writer include workstream inheritance.

2. **Modify `.github/agents/frontend-lead.agent.md`** — Same as task 1 but with `--workstream frontend`.
   - **Acceptance criteria**: Same as task 1 with "frontend" replacing "backend".

3. **Modify `.github/agents/infra-lead.agent.md`** — Same as task 1 but with `--workstream infra`.
   - **Acceptance criteria**: Same as task 1 with "infra" replacing "backend".

4. **Modify `.github/agents/developer.agent.md`** — Add instruction to inherit `--workstream` from the lead's delegation payload. Add `--workstream {{WORKSTREAM}}` to all emit-event.js calls (where {{WORKSTREAM}} comes from the delegation payload).
   - **Acceptance criteria**: Developer agent includes workstream in all event emissions. Instruction clearly states workstream comes from the delegation payload.

5. **Modify `.github/agents/tester.agent.md`** — Same pattern as developer.agent.md.
   - **Acceptance criteria**: Same as task 4.

6. **Modify `.github/agents/code-reviewer.agent.md`** — Same pattern as developer.agent.md.
   - **Acceptance criteria**: Same as task 4.

7. **Modify `.github/agents/docs-writer.agent.md`** — Same pattern as developer.agent.md.
   - **Acceptance criteria**: Same as task 4.

8. **Modify `.github/agents/architect.agent.md`** — Add instructions to:
   - Set up the `agent-events` orphan branch at session start if it doesn't exist
   - Call `node dashboard/lib/push-events.js --all` after saving plans and after delegation
   - Call `node dashboard/lib/pull-events.js` to check on workstream progress
   - Document that `DASHBOARD_GIT_POLL=true` enables automatic cross-Codespace monitoring
   - Add `--wipe` flag to push-events.js call when emitting session-start (to clear remote events)
   - **Acceptance criteria**: Architect agent has clear instructions for agent-events branch lifecycle, push/pull-events usage, and cross-Codespace monitoring.

9. **Modify `.github/copilot-instructions.md`** — In the "Agent Monitor Dashboard" section, add documentation about:
   - Multi-workstream event protocol
   - Per-workstream event files (`events-<workstream>.jsonl`)
   - The `--workstream` flag on emit-event.js
   - push-events.js and pull-events.js for cross-Codespace transport
   - The `agent-events` orphan branch
   - `DASHBOARD_GIT_POLL=true` environment variable
   - **Acceptance criteria**: The documentation section is clear, concise, and complete. Existing content preserved.

10. **Validate** — Run `grep -r "emit-event" .github/agents/` to verify all agent files use `--workstream`. Run `grep -r "push-events" .github/agents/` to verify lead agents call push-events.js.
    - **Acceptance criteria**: All lead agents have `--workstream` and `push-events.js`. All subagents have `--workstream` inheritance.

### Technical Decisions (from architecture)
- Workstream names: lowercase, matching launch plan workstream names ("backend", "frontend", "infra")
- Subagents inherit workstream from delegation payload (not auto-detected)
- Architect does not use --workstream (architect events go to events.jsonl)
- push-events.js called at gates 3, 4, 7 (not every event — batch pushes reduce git operations)
- pull-events.js can be run manually or via DASHBOARD_GIT_POLL

### Dependencies
- Depends on: core-pipeline (Wave 1) — push-events.js and pull-events.js must exist
- Depended on by: None

### Interfaces
- References `dashboard/lib/push-events.js` CLI (created in Wave 1)
- References `dashboard/lib/pull-events.js` CLI (created in Wave 1)
- References `dashboard/lib/emit-event.js` CLI (existing, enhanced in Wave 1)
- All changes are markdown/documentation — no code interfaces

### Out of Scope
- Backend/library code changes — done in Wave 1
- Frontend UI changes — done by @frontend-lead
- Test code changes — done in Wave 1
```

## Reproducibility Checksum

- **Architecture Hash**: (computed from architecture document content)
- **Plan Version**: 1
- **Prior Instances**: none
