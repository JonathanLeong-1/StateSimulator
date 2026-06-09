# Architecture: Agent Monitor Dashboard v2

- **Date**: 2026-04-16 23:37:14
- **Architect**: architect
- **Status**: approved

## Project Summary

Complete redesign of the agent monitoring dashboard. Replaces the existing dashboard with a real-time session viewer featuring an SVG agent spawn graph, per-agent detail panels (thinking chains, todo lists, running time), session isolation, and plan file viewer. Targets ≤3s event-to-display latency with zero/minimal dependencies.

## Architecture Style

Single-process Node.js server + vanilla JS SPA with pure SVG rendering. No framework, no build step.

## Application Layers

### Frontend
- **Type**: SPA (single HTML page, vanilla JS)
- **Framework**: None — vanilla JS + pure SVG for graph rendering
- **Key views**:
  - Header bar: session status, plan link, session duration
  - Agent spawn graph (SVG): hierarchical node-link diagram
  - Agent detail panel: thinking, todos, branch, events (click to expand)
  - Recent events bar (collapsed by default)

### Backend / API
- **Type**: REST + SSE (Server-Sent Events)
- **Framework**: Node.js built-in `http` module (zero deps)
- **Key endpoints**:
  - `GET /api/stream` — SSE push for real-time events and session-reset signals
  - `GET /api/state` — full session state (agents, graph, plan path, session start time)
  - `GET /api/plan/:filename` — raw markdown content of plan files
  - `GET /*` — static files from `public/`

### Data Layer
- **Storage**: `.agent-events/events.jsonl` — append-only JSONL within a session
- **In-memory**: `SessionState` class maintains parsed agent map, spawn graph, and todo lists
- **Schema**: See Event Schema section below

### Background Processing
- `fs.watch` on `.agent-events/` directory with 100ms debounce for file change detection
- Incremental byte-offset reads for new events (no full re-parse)

### External Integrations
- None (self-contained)

## Event Schema (Expanded)

All events are JSON objects appended to `events.jsonl`, one per line.

### Common Fields (all events)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ts` | string (ISO 8601) | yes | Timestamp |
| `agent` | string | yes | Agent name (e.g., "architect", "backend-lead") |
| `event` | string | yes | Event type |

### Event Types

| Event Type | Purpose | Additional Fields |
|------------|---------|-------------------|
| `session-start` | Architect begins new session; **triggers wipe** of all previous data | `plan` (path to approved plan file, optional) |
| `spawned` | Agent has been created/started | `parent` (agent that spawned it, optional — null for architect) |
| `thinking` | Agent is in a reasoning/planning chain | `detail` (brief summary of current thought, max ~100 chars) |
| `todo-update` | Agent's todo list has changed | `todos` (JSON array: `[{id, title, status}]` where status is "not-started", "in-progress", "completed") |
| `task-started` | Agent starts a numbered task | `task`, `taskIndex` (number), `taskTotal` (number) |
| `task-completed` | Agent finishes a numbered task | `task`, `taskIndex`, `taskTotal`, `status` |
| `branch-created` | Agent created a git branch | `branch` (branch name) |
| `subagent-invoked` | Agent is spawning a child agent | `detail` (child agent name, e.g., "@backend-lead") |
| `question-asked` | Agent asked the user a question | `detail` (brief description) |
| `plan-saved` | Agent saved a plan file | `plan` (file path) |
| `session-complete` | Agent finished all work | `status` ("done", "error", etc.) |
| `error` | Agent encountered an error | `detail` (error description) |

### Session Management Protocol

1. When architect starts a new session, it emits `session-start`
2. Server receives `session-start` → truncates `events.jsonl` to only that event → calls `SessionState.reset()` → pushes SSE `session-reset` signal
3. Browser receives `session-reset` → clears all UI state → rebuilds from the `session-start` event
4. All subsequent events within the session are appended normally

## Infrastructure Components

- **Compute**: Single Node.js process, port 4820
- **Storage**: File-based (`.agent-events/events.jsonl`)
- **Networking**: HTTP server on localhost
- **Observability**: Console logging in server.js
- **Security**: Path traversal protection on static file serving and plan file API; no auth needed (localhost only)

## Cross-Cutting Concerns

### Auth
- None — dashboard is localhost-only, no authentication required

### Error Handling
- Server: try/catch around all file operations, graceful degradation if events.jsonl missing
- Client: SSE reconnection with exponential backoff, error state display

### Testing
- **Unit tests**: SessionState (event processing, graph construction, session reset, todo tracking)
- **Unit tests**: emit-event CLI (argument parsing, new fields)
- **Integration tests**: Server API endpoints (SSE, state, plan serving)
- **Test runner**: Node.js built-in `node --test` (zero deps)

### CI/CD
- Tests run with `npm test` in dashboard directory
- No build step required

## Repository Structure

```
dashboard/
├── package.json            # metadata, scripts, optional marked dep
├── server.js               # HTTP server, SSE, static files, plan API
├── start.js                # launcher script (opens browser)
├── lib/
│   ├── emit-event.js       # CLI for agents to emit events (updated)
│   ├── log-event.js        # JSONL writer (updated for new fields)
│   └── state.js            # SessionState class (NEW — replaces collectors/)
├── public/
│   ├── index.html          # single page, dark theme
│   ├── app.js              # main frontend: SSE client, state manager, rendering
│   ├── graph.js            # SVG agent graph renderer (NEW)
│   └── styles.css          # dark theme CSS
└── test/
    ├── state.test.js       # SessionState unit tests
    ├── server.test.js      # API integration tests
    └── emit-event.test.js  # emit-event CLI tests
```

### Files to DELETE (replaced by new architecture)
- `lib/collectors/` entire directory (activity.js, event-cache.js, events.js, git.js, logs.js, plans.js)
- `test/collectors.test.js`
- `test/event-cache.test.js`
- `test/fixtures/` entire directory

## Design Decisions

1. **Pure SVG over Canvas/D3**: User requested zero-dep graph. SVG with manual layout is simpler, inspectable, and supports CSS styling. Adequate for ≤50 nodes.

2. **SessionState replaces collectors/**: The 6-file collectors system was over-engineered for the original polling dashboard. A single SessionState class with `processEvent()` method is simpler, testable, and maintains the graph/agents/todos in memory.

3. **SSE over WebSocket**: SSE is simpler (unidirectional server→client), works with built-in `http`, reconnects automatically. Browser-to-server communication is not needed for a monitoring dashboard.

4. **File-based events with fs.watch**: Keeps the simple CLI-based emit pattern. fs.watch + 100ms debounce + SSE push achieves ~200ms typical latency, well under the 3s requirement.

5. **Session wipe on `session-start`**: Clean UX — each architect invocation is a fresh slate. No historical data accumulation.

6. **Tree layout for graph**: Agents form a natural tree (architect → leads → subagents). Top-down tree layout with horizontal spreading per depth level. No cycles to handle.

7. **`marked` as optional dep**: For inline plan markdown rendering. If not installed, falls back to opening raw file in new tab.

## Approval
- Approved by: human user
- Approved at: 2026-04-16 23:37:14
