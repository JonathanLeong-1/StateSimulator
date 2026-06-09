# Plan: Agent Monitor Dashboard

- **Date**: 2026-04-09
- **Designed by**: @architect
- **Status**: approved

## Summary

Add an opt-in, backward-compatible **Agent Monitor Dashboard** — a lightweight local web UI
that gives the human orchestrator real-time visibility into agent activity: which agents are
spawned, what branches they work on, how many tasks they have completed, and the status of
each workstream.

## Design Principles

1. **Backward-compatible** — existing projects using this template are unaffected; all new
   code lives in `dashboard/` and is opt-in
2. **Zero external runtime dependencies** — the dashboard server uses only Node.js built-in
   modules (`http`, `fs`, `path`, `child_process`); the frontend is vanilla HTML/CSS/JS
3. **Convention-driven data** — reads existing `.agent-logs/` markdown, `.plans/` files,
   and `git` branch info; additionally consumes a new lightweight JSONL event stream
4. **Minimal footprint** — single-command launch, no build step, no bundler

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Browser (localhost:4820)                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               Agent Monitor Dashboard                  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────────────┐ │  │
│  │  │ Agent    │ │ Branch   │ │ Plan/Task Progress     │ │  │
│  │  │ Cards    │ │ Status   │ │ Timeline               │ │  │
│  │  └──────────┘ └──────────┘ └────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ▲  polling GET /api/*                │
│                          │                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Dashboard Server (Node.js)                │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────────────┐ │  │
│  │  │ Static   │ │ REST API │ │ Data Collectors        │ │  │
│  │  │ Files    │ │ Router   │ │ (logs, git, events)    │ │  │
│  │  └──────────┘ └──────────┘ └────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ▲  reads                             │
│           ┌──────────────┼──────────────┐                    │
│     .agent-logs/    .plans/    .agent-events/                │
│     (markdown)     (markdown)  (JSONL — new)                 │
│                                    ▲                         │
│                              agents write                    │
│                          structured events                   │
└──────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Structured Event Log (`.agent-events/`)

A new directory where agents write machine-readable JSONL (one JSON object per line) events.
This is **additive** — agents still write their human-readable markdown to `.agent-logs/`.

**File**: `.agent-events/events.jsonl`

**Event schema**:
```jsonc
{
  "ts": "2026-04-09T14:30:22Z",   // ISO 8601 timestamp
  "agent": "backend-lead",         // agent name
  "event": "spawned",              // event type (see below)
  "branch": "feature/backend/auth",// git branch (optional)
  "plan": ".plans/2026-04-09-auth.md", // plan reference (optional)
  "task": "Implement JWT middleware",   // task description (optional)
  "taskIndex": 1,                  // task number within plan (optional)
  "taskTotal": 5,                  // total tasks in plan (optional)
  "status": "in-progress",        // status (optional)
  "detail": ""                    // freeform detail (optional)
}
```

**Event types**:
| Event | When |
|-------|------|
| `spawned` | Agent session starts |
| `plan-loaded` | Agent reads and locks onto a plan |
| `task-started` | Agent begins a task |
| `task-completed` | Agent finishes a task |
| `branch-created` | Agent creates a feature branch |
| `branch-pushed` | Branch is pushed to remote |
| `subagent-invoked` | Lead invokes a subagent |
| `session-complete` | Agent finishes its session |
| `error` | Agent encounters an error |

### 2. Event Logger Module (`dashboard/lib/event-logger.sh` / `event-logger.ps1`)

Lightweight shell functions that agents can call to append events to `.agent-events/events.jsonl`.
Also provided as a **single-function JavaScript module** (`dashboard/lib/log-event.js`) for
agents running in Node.js contexts.

The key function: `log_agent_event <agent> <event> [--branch X] [--plan X] [--task X] [--status X]`

### 3. Dashboard Server (`dashboard/server.js`)

A zero-dependency Node.js HTTP server providing:

**Static file serving**: Serves `dashboard/public/*` for the frontend.

**REST API endpoints**:

| Endpoint | Description |
|----------|-------------|
| `GET /api/agents` | Active agents (parsed from events + git branches) |
| `GET /api/branches` | All feature/fix branches with status (local + remote) |
| `GET /api/plans` | Plans from `.plans/` with task completion status |
| `GET /api/events` | Recent events from `.agent-events/events.jsonl` |
| `GET /api/logs/:agent` | Parsed markdown log for a specific agent |
| `GET /api/summary` | Aggregated dashboard summary (counts, statuses) |

**Data collectors** (internal modules):
- `collectors/events.js` — Reads/tails `.agent-events/events.jsonl`
- `collectors/git.js` — Runs `git branch`, `git log`, `git status`
- `collectors/plans.js` — Parses `.plans/*.md` for task lists and status
- `collectors/logs.js` — Parses `.agent-logs/*.md` for session history

### 4. Dashboard Frontend (`dashboard/public/`)

Vanilla HTML/CSS/JS single-page application:

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  🤖 Agent Monitor Dashboard              [Auto-refresh] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── Summary Bar ───────────────────────────────────┐  │
│  │ Agents: 3 active │ Branches: 5 │ Tasks: 12/20    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─── Agent Cards ───────────────────────────────────┐  │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │  │
│  │ │ 🏗 architect │ │ ⚙ backend   │ │ 🎨 frontend │  │  │
│  │ │   idle      │ │ lead        │ │    lead     │  │  │
│  │ │             │ │ branch: ... │ │ branch: ... │  │  │
│  │ │ 0 tasks     │ │ 3/5 tasks   │ │ 1/4 tasks   │  │  │
│  │ └─────────────┘ └─────────────┘ └─────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─── Branch Status ────────────────────────────────┐  │
│  │ Branch                    Status    Agent  Tasks  │  │
│  │ feature/backend/auth      active    be-ld  3/5   │  │
│  │ feature/frontend/ui       active    fe-ld  1/4   │  │
│  │ feature/infra/setup       merged    in-ld  4/4   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─── Event Timeline ───────────────────────────────┐  │
│  │ 14:30:22  backend-lead    spawned                │  │
│  │ 14:30:25  backend-lead    plan-loaded  auth.md   │  │
│  │ 14:31:01  backend-lead    task-started JWT mid.. │  │
│  │ ...                                               │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Features**:
- Auto-refresh every 3 seconds via `setInterval` + `fetch()`
- Color-coded status badges (green=complete, blue=active, gray=idle)
- Responsive CSS grid layout
- Dark theme (matches VS Code default)
- No build step — plain `.html`, `.css`, `.js` files

### 5. Launch Script

**`dashboard/start.js`** — Entry point that starts the server and optionally opens the browser.

Launched via:
```bash
node dashboard/start.js           # Start dashboard server
node dashboard/start.js --open    # Start and open in browser
```

Also available via npm script (after `npm init` in dashboard/):
```bash
cd dashboard && npm start
```

## Directory Structure (New Files)

```
dashboard/
├── package.json              # Minimal — no dependencies, just scripts
├── start.js                  # Entry point — starts server, optional browser open
├── server.js                 # HTTP server + API router
├── lib/
│   ├── log-event.js          # Event logging function (for agents)
│   └── collectors/
│       ├── events.js         # Reads .agent-events/events.jsonl
│       ├── git.js            # Reads git branch/log data
│       ├── plans.js          # Parses .plans/*.md
│       └── logs.js           # Parses .agent-logs/*.md
├── public/
│   ├── index.html            # Dashboard SPA
│   ├── styles.css            # Dark-theme styles
│   └── app.js                # Frontend logic (fetch + render)
└── test/
    ├── server.test.js        # Server API tests
    ├── collectors.test.js    # Collector unit tests
    └── fixtures/             # Test fixture files
        ├── sample-events.jsonl
        ├── sample-plan.md
        └── sample-log.md
.agent-events/
├── .gitkeep                  # Ensure directory exists
└── events.jsonl              # Written by agents (gitignored in child projects)
```

## Backward Compatibility Strategy

| Concern | Mitigation |
|---------|-----------|
| Existing projects don't have `dashboard/` | `dashboard/` is purely additive; no existing files change behavior |
| Agents don't write events yet | Dashboard gracefully handles empty/missing `.agent-events/`; still shows git/plan/log data |
| No Node.js in some environments | Dashboard is opt-in; template works without it |
| Template sync might overwrite | `dashboard/` syncs from template (desired); `.agent-events/` added to `.gitattributes` as `merge=ours` |
| Child projects with custom README | `README.md` is already protected via `.gitattributes` `merge=ours` |

## Changes to Existing Files

Only **additive** changes — no removals, no behavioral changes:

1. **`.gitattributes`** — Add `.agent-events/**  merge=ours` to protect project event data
2. **`.github/copilot-instructions.md`** — Add a brief section about the dashboard (no behavioral change)
3. **`TEMPLATE-GUIDE.md`** — Add "Agent Monitor Dashboard" section documenting the feature
4. **`README.md`** — Add brief mention in the Repository Structure section
5. **`.devcontainer/devcontainer.json`** — No changes required (Node.js already available)
6. **Agent `.agent.md` files** — Add optional event-logging instructions (agents still work without them)

## Workstream Decomposition

### Workstream 1: Frontend Lead — Dashboard UI
**Branch**: `feature/frontend/agent-dashboard`
- Create `dashboard/public/index.html` with dashboard layout
- Create `dashboard/public/styles.css` with dark theme
- Create `dashboard/public/app.js` with polling + rendering logic
- Test: dashboard renders correctly with mock API data

### Workstream 2: Backend Lead — Dashboard Server & Collectors  
**Branch**: `feature/backend/dashboard-server`
- Create `dashboard/server.js` with HTTP server and REST API
- Create `dashboard/lib/collectors/events.js` — JSONL event reader
- Create `dashboard/lib/collectors/git.js` — git branch/status reader
- Create `dashboard/lib/collectors/plans.js` — plan parser
- Create `dashboard/lib/collectors/logs.js` — agent log parser
- Create `dashboard/start.js` — entry point
- Create `dashboard/package.json` — scripts only, no dependencies
- Create `dashboard/lib/log-event.js` — event logging module
- Create `.agent-events/.gitkeep`
- Test: all API endpoints return correct data

### Workstream 3: Infra Lead — Integration & Documentation
**Branch**: `feature/infra/dashboard-integration`
- Update `.gitattributes` — add `.agent-events/**  merge=ours`
- Update `TEMPLATE-GUIDE.md` — add dashboard documentation section
- Update `README.md` — add dashboard to repository structure
- Update `.github/copilot-instructions.md` — mention dashboard
- Update agent `.agent.md` files — add optional event logging instructions
- Test: template sync still works; existing functionality unaffected

## Dependencies Between Workstreams

```
Workstream 2 (Backend) ──┐
                          ├──→ Integration (Workstream 3)
Workstream 1 (Frontend) ─┘
```

Workstreams 1 and 2 can run in parallel. Workstream 3 depends on both being complete.

## Acceptance Criteria

1. Running `node dashboard/start.js` launches a web dashboard on `localhost:4820`
2. Dashboard displays: agent cards, branch status table, event timeline, summary stats
3. Dashboard auto-refreshes every 3 seconds
4. Dashboard works with zero events (shows git/plan/log data only)
5. Dashboard works with missing `.agent-events/` directory
6. No existing tests break; no existing agent behavior changes
7. Template sync (`scripts/sync-template.sh`) still works correctly
8. All new code has tests
9. Documentation is updated in TEMPLATE-GUIDE.md
