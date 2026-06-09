# Architecture: Multi-Workstream Dashboard Event Aggregation

- **Date**: 2026-04-20 17:11:54
- **Architect**: architect
- **Status**: approved
- **Feature Fingerprint**: multi-workstream-dashboard-events

## Feature Fingerprint

- **Canonical Name**: multi-workstream-dashboard-events
- **Aliases**: parallel workstream events, cross-codespace dashboard, multi-stream monitoring
- **Category**: infrastructure

## Project Summary

Enable the Agent Monitor Dashboard to aggregate and display events from multiple parallel workstreams running on isolated filesystems (e.g., separate GitHub Codespaces) or on the same machine. Currently, the dashboard reads from a single `.agent-events/events.jsonl` file, which means only the co-located workstream's events are visible. This change introduces per-workstream event files and a git-based transport mechanism for cross-Codespace event aggregation.

## Architecture Style

Additive enhancement to existing single-process Node.js server + vanilla JS SPA. Two new CLI scripts, modifications to existing event pipeline and dashboard UI. Zero new runtime dependencies.

## Application Layers

### Frontend
- **Type**: SPA (existing — vanilla JS)
- **Framework**: None (existing)
- **Key views (additions)**:
  - Workstream badges on graph nodes (colored tags: "backend", "frontend", etc.)
  - Workstream filter toggle buttons in header
  - Workstream attribution in event feed entries

### Backend / API
- **Type**: REST + SSE (existing)
- **Framework**: Node.js built-in http (existing)
- **Key endpoints**: No new endpoints — existing `/api/stream`, `/api/state` enhanced with workstream data

### Data Layer
- **Storage (enhanced)**:
  - `.agent-events/events.jsonl` — architect events + backward-compatible single-workstream mode
  - `.agent-events/events-<workstream>.jsonl` — per-workstream event files (NEW)
  - Git branch `agent-events` (orphan) — cross-Codespace transport (NEW)
- **In-memory**: `SessionState` enhanced with per-workstream file tracking and workstream field on agents

### Background Processing
- `fs.watch` on `.agent-events/` directory (existing — now watches multiple files)
- Optional git-pull polling (5s interval) when `DASHBOARD_GIT_POLL=true` (NEW)

### External Integrations
- Git CLI for push-events.js and pull-events.js (NEW — uses only `git` which is always available)

## Event File Layout

```
.agent-events/
  events.jsonl                 # architect events + single-workstream backward compat
  events-backend.jsonl         # backend workstream events (NEW)
  events-frontend.jsonl        # frontend workstream events (NEW)
  events-infra.jsonl           # infra workstream events (NEW)
  .gitkeep                     # existing
```

Git branch `agent-events` (orphan):
```
events.jsonl                   # architect events (pushed from architect's environment)
events-backend.jsonl           # pushed from backend-lead's Codespace
events-frontend.jsonl          # pushed from frontend-lead's Codespace
events-infra.jsonl             # pushed from infra-lead's Codespace
```

## Event Schema Changes

### Enhanced Common Fields

All existing fields preserved. One field gains routing significance:

| Field | Type | Required | Change |
|-------|------|----------|--------|
| `workstream` | string | no | **Now used for file routing**. When present, events are written to `events-<workstream>.jsonl` instead of `events.jsonl`. Already in schema but previously unused for routing. |

### New Event Type: None

No new event types. All existing event types are preserved as-is.

## Transport Mechanisms

### Same-Machine Parallel (Shared Filesystem)

Agents in different VS Code windows share the same `.agent-events/` directory. Each workstream writes to its own file (`events-<workstream>.jsonl`), eliminating interleaving. The dashboard server watches all `events-*.jsonl` files via `fs.watch` on the directory.

### Cross-Codespace Parallel (Isolated Filesystems)

Each Codespace has its own local `.agent-events/` directory. Events are transported via a git orphan branch:

1. **push-events.js** — Agents commit their local `events-<workstream>.jsonl` to the `agent-events` orphan branch and force-push. Each workstream owns its file exclusively — no merge conflicts.
2. **pull-events.js** — The dashboard environment fetches the `agent-events` branch and copies all `events-*.jsonl` files to local `.agent-events/`. Called on a poll interval or manually.

### Session Management

- `session-start` from architect wipes **all** local `events-*.jsonl` files and resets state
- `push-events.js` detects session-start as first event and clears the remote branch before pushing
- `pull-events.js` handles the case where remote files are smaller/newer than local (session was reset remotely)

## Infrastructure Components

- **Compute**: Same single Node.js process (existing)
- **Storage**: File-based with git transport (enhanced)
- **Networking**: HTTP server on localhost (existing); git push/pull for cross-Codespace (NEW)
- **Observability**: Console logging (existing)
- **Security**: Path traversal protection (existing); orphan branch avoids polluting main history

## Cross-Cutting Concerns

### Auth
- None — localhost dashboard, git auth handled by existing Codespace/local git credentials

### Error Handling
- push-events.js: Retry once on push failure (conflict from concurrent push), log error on second failure
- pull-events.js: Graceful degradation if `agent-events` branch doesn't exist yet (no events to pull)
- server.js: Continue watching local files if git-pull fails; log warning to console
- Malformed JSONL lines: Skip (existing behavior, preserved)

### Testing Strategy
- **Unit tests**: SessionState multi-file processing, workstream field handling, session-start multi-file wipe
- **Unit tests**: log-event.js workstream file routing
- **Unit tests**: push-events.js argument parsing and git command construction (mocked git)
- **Unit tests**: pull-events.js fetch and file copy logic (mocked git)
- **Integration tests**: server.js multi-file watching, git-poll toggle
- **Test runner**: Node.js built-in `node --test` (existing, zero deps)

### CI/CD
- Tests run with `npm test` in dashboard directory (existing)
- No build step required

## Repository Structure (Changes Only)

```
dashboard/
├── lib/
│   ├── emit-event.js           # MODIFIED: --workstream flag documentation (already works)
│   ├── log-event.js            # MODIFIED: route to events-<workstream>.jsonl when workstream present
│   ├── state.js                # MODIFIED: workstream field on agents, multi-file offset tracking
│   ├── push-events.js          # NEW: CLI to push local events to agent-events git branch
│   └── pull-events.js          # NEW: CLI to pull events from agent-events git branch
├── server.js                   # MODIFIED: multi-file watching, optional git-pull polling
├── public/
│   ├── app.js                  # MODIFIED: workstream filter, badges, event attribution
│   ├── graph.js                # MODIFIED: workstream badges on nodes
│   ├── styles.css              # MODIFIED: workstream badge colors, filter styles
│   └── index.html              # MODIFIED: workstream filter UI container
└── test/
    ├── state.test.js           # MODIFIED: multi-workstream state tests
    ├── server.test.js          # MODIFIED: multi-file watching tests
    ├── emit-event.test.js      # MODIFIED: workstream routing tests
    ├── push-events.test.js     # NEW: push-events tests
    └── pull-events.test.js     # NEW: pull-events tests
```

### Other Files Modified

| File | Change |
|------|--------|
| `.gitignore` | Update: `.agent-events/events*.jsonl` to cover workstream files |
| `.github/agents/backend-lead.agent.md` | Add `--workstream` to emit-event calls; add push-events.js after gates |
| `.github/agents/frontend-lead.agent.md` | Add `--workstream` to emit-event calls; add push-events.js after gates |
| `.github/agents/infra-lead.agent.md` | Add `--workstream` to emit-event calls; add push-events.js after gates |
| `.github/agents/developer.agent.md` | Inherit `--workstream` from delegation payload |
| `.github/agents/tester.agent.md` | Inherit `--workstream` from delegation payload |
| `.github/agents/code-reviewer.agent.md` | Inherit `--workstream` from delegation payload |
| `.github/agents/docs-writer.agent.md` | Inherit `--workstream` from delegation payload |
| `.github/agents/architect.agent.md` | Add pull-events.js instructions; push-events.js for architect events; document agent-events branch setup |
| `.github/copilot-instructions.md` | Document multi-workstream event protocol |

## Naming Conventions

- **Event files**: `events-<workstream>.jsonl` where `<workstream>` is lowercase kebab-case matching launch plan workstream names
- **Git branch**: `agent-events` (orphan, no shared history with main)
- **Environment variable**: `DASHBOARD_GIT_POLL` (boolean, controls git-pull polling in server.js)
- **CLI scripts**: `push-events.js`, `pull-events.js` (in `dashboard/lib/`)
- **Branches**: `feature/template/multi-workstream-events` (this is a template change)
- **Files**: Existing naming conventions preserved
- **Classes/Functions**: camelCase (existing convention)

## Interface Contracts

### log-event.js Enhanced Behavior

```javascript
// When opts.workstream is provided, write to events-<workstream>.jsonl
// When opts.workstream is absent, write to events.jsonl (backward compatible)
function logAgentEvent(opts) {
  // ... existing validation ...
  const filename = opts.workstream
    ? `events-${opts.workstream}.jsonl`
    : 'events.jsonl';
  const eventsFile = opts.eventsFile || path.join(DEFAULT_EVENTS_DIR, filename);
  // ... rest unchanged ...
}
```

### push-events.js CLI Interface

```
Usage: node dashboard/lib/push-events.js --workstream <name> [--all] [--wipe]

Options:
  --workstream <name>   Push events for this workstream (pushes events-<name>.jsonl)
  --all                 Push all events-*.jsonl files (used by architect/orchestrator)
  --wipe                Clear remote files before pushing (used on session-start)

Behavior:
  1. Ensure agent-events orphan branch exists (create if not)
  2. Checkout agent-events branch in a temp worktree
  3. Copy local events file(s) to worktree
  4. Commit and force-push
  5. Clean up worktree
```

### pull-events.js CLI Interface

```
Usage: node dashboard/lib/pull-events.js [--once] [--interval <ms>]

Options:
  --once                Pull once and exit (default)
  --interval <ms>       Poll continuously at this interval

Behavior:
  1. Fetch agent-events branch from origin
  2. Read all events-*.jsonl files from the fetched branch
  3. Write them to local .agent-events/ directory
  4. If --interval, repeat after <ms> milliseconds
```

### SessionState Enhanced Interface

```javascript
class SessionState {
  constructor() { ... }
  reset() { ... }                    // Now also resets per-workstream tracking
  processEvent(evt) { ... }         // Now stores evt.workstream on agent state
  getState() { ... }                // Returns workstream field in agent data
  getGraph() { ... }                // Nodes include workstream field
  getAgentDetail(name) { ... }      // Includes workstream in agent detail
  getWorkstreams() { ... }          // NEW: returns list of active workstreams
}
```

### Server Multi-File Watching

```javascript
// server.js — enhanced file watching
function readNewEventsFromAllFiles() {
  // For each events*.jsonl file in .agent-events/:
  //   Track byte offset per file
  //   Read new bytes since last offset
  //   Parse new lines
  //   Return merged array sorted by timestamp
}
```

### Frontend Workstream Filter API

```javascript
// app.js — workstream filter state
appState.workstreamFilter = new Set();  // empty = show all
appState.workstreams = [];              // list of active workstream names

function toggleWorkstreamFilter(workstream) { ... }
function renderWorkstreamFilters() { ... }
```

## Test Specifications

### Unit Test Requirements

#### state.test.js (additions)
- Multi-workstream events processed correctly (agents get workstream field)
- getWorkstreams() returns distinct workstream names
- session-start wipes all workstream data
- Graph nodes include workstream field
- Events without workstream field still work (backward compat)

#### log-event.test.js / emit-event.test.js (additions)
- Event with workstream routes to `events-<workstream>.jsonl`
- Event without workstream routes to `events.jsonl`
- Workstream field appears in written JSON

#### push-events.test.js (new)
- Correct git commands constructed for single workstream push
- --all flag pushes all events files
- --wipe flag clears remote before pushing
- Handles missing agent-events branch (creates it)
- Handles missing local events file gracefully

#### pull-events.test.js (new)
- Fetches agent-events branch
- Copies all events-*.jsonl to local directory
- Creates .agent-events/ directory if missing
- Handles missing remote branch gracefully (no error)
- --interval flag sets up recurring poll

### Integration Test Requirements

#### server.test.js (additions)
- Server watches multiple events-*.jsonl files
- New events from workstream files are pushed via SSE
- DASHBOARD_GIT_POLL environment variable enables polling
- State includes workstream data in /api/state response

### End-to-End Test Requirements

- Manual: Start dashboard, emit events with different --workstream values, verify all appear in UI
- Manual: In two terminals, emit events to different workstream files simultaneously, verify dashboard shows both

## Expected Output Manifest

| Workstream | Files Created | Exports / Endpoints | Tests |
|------------|--------------|---------------------|-------|
| Core event pipeline | `dashboard/lib/push-events.js`, `dashboard/lib/pull-events.js` | `pushEvents()`, `pullEvents()` CLI | `dashboard/test/push-events.test.js`, `dashboard/test/pull-events.test.js` |
| Event routing | Modified `dashboard/lib/log-event.js` | `logAgentEvent()` (enhanced) | Modified `dashboard/test/emit-event.test.js` |
| State management | Modified `dashboard/lib/state.js` | `SessionState` (enhanced), `getWorkstreams()` | Modified `dashboard/test/state.test.js` |
| Server | Modified `dashboard/server.js` | Multi-file watch, git-poll | Modified `dashboard/test/server.test.js` |
| Frontend | Modified `dashboard/public/app.js`, `graph.js`, `styles.css`, `index.html` | Workstream filter UI, badges | Manual testing |
| Agent definitions | Modified `.github/agents/*.agent.md`, `.github/copilot-instructions.md` | N/A (markdown) | grep validation |
| Config | Modified `.gitignore` | N/A | N/A |

## Reproducibility Notes

- Node.js built-in modules only — no new dependencies
- Git CLI must be available in the environment (standard for all dev environments and Codespaces)
- The `agent-events` orphan branch is created automatically by `push-events.js` if it doesn't exist
- Force-push is safe because each workstream exclusively owns its file on the branch
- `DASHBOARD_GIT_POLL=true` environment variable enables cross-Codespace mode
- Without the env var, dashboard works identically to today (local file watching only)
- Workstream values must be lowercase and match `/^[a-z][a-z0-9-]*$/` (validated in log-event.js)

## Approval
- Approved by: human user
- Approved at: 2026-04-20 17:11:54
