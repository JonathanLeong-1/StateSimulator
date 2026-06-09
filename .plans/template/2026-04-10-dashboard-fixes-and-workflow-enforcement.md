# Plan: Dashboard Fixes & Workflow Enforcement

- **Date**: 2026-04-10
- **Designed by**: @architect
- **Status**: approved

## Summary

This plan covers 4 targeted fixes to the agentic-vibe-coding template:

1. **Agent Relationship Graph** — Add a parent-child graph visualization to the dashboard showing delegation relationships between lead agents and subagents.
2. **Agents Stuck as Active After Completion** — Fix the `/api/agents` handler so filesystem-inferred agents never override event-based `completed` status.
3. **Delayed Agent Detection** — Replace the polling + full-file-reread architecture with fs.watch-based caching and a Server-Sent Events (SSE) endpoint for real-time push to the frontend.
4. **Workflow Bypass for Small Fixes** — Tighten the exception clause in `copilot-instructions.md` so even single-line fixes require branch + test + review.

All changes are backward-compatible, use zero external dependencies, and operate within the existing `dashboard/` and `.github/` file structure.

## Design Principles

1. **Backward-compatible** — Existing polling-based frontend continues to work if SSE is unavailable; the graph view is additive alongside the existing agent cards
2. **Zero external runtime dependencies** — Only Node.js built-ins (`fs`, `http`, `path`, `child_process`); frontend is vanilla JS with inline SVG
3. **Minimal footprint** — No new directories, no build steps; fixes are surgical edits to existing files
4. **Convention-driven** — Leverages the existing `subagent-invoked` event schema for graph data

---

## Issue 1: Agent Relationship Graph

### Problem

Agents display as flat cards in a CSS grid. There is no visual representation of the delegation hierarchy (e.g., `architect` → `backend-lead` → `developer`/`tester`/`code-reviewer`/`docs-writer`).

### Data Model

The existing event schema already contains `subagent-invoked` events with a `detail` field formatted as `"@developer: <task>"` or `"developer"`. The graph is built by processing these events to extract parent → child edges.

#### New API Endpoint: `GET /api/graph`

Returns:
```json
{
  "nodes": [
    { "id": "architect", "status": "completed", "icon": "🏗️" },
    { "id": "backend-lead", "status": "working", "icon": "⚙️" },
    { "id": "developer", "status": "completed", "icon": "💻" },
    { "id": "tester", "status": "active", "icon": "🧪" }
  ],
  "edges": [
    { "from": "architect", "to": "backend-lead", "task": "Implement auth service" },
    { "from": "backend-lead", "to": "developer", "task": "Write login endpoint" },
    { "from": "backend-lead", "to": "tester", "task": "Test auth module" }
  ]
}
```

#### Graph Construction Logic (new function in `events.js`)

```
function getAgentGraph(eventsFile):
  1. Parse all events (reuse readEvents)
  2. Build agentState map (reuse getActiveAgents logic for status)
  3. For each "subagent-invoked" event:
     - Extract child agent name from evt.detail (parse "@<name>: <task>" or plain "<name>")
     - Add edge: { from: evt.agent, to: childName, task: extracted task }
  4. Build nodes array from all agents seen in agentState
  5. Return { nodes, edges }
```

#### Parsing `detail` field

The `detail` field has two known formats:
- `"@developer: Implement login"` → child = `developer`, task = `Implement login`
- `"developer"` → child = `developer`, task = `null`

Regex: `/^@?([a-z-]+)(?::\s*(.+))?$/`

### Frontend: SVG Graph Renderer

The graph is rendered as an **inline SVG** element in a new section below the existing agent cards. This avoids Canvas complexity and allows CSS styling consistent with the dashboard theme.

#### Layout Algorithm

Use a simple **top-down tree layout** (no external library needed):

1. Identify root nodes (agents that appear in `nodes` but never as a `to` in any edge, OR the agent with the earliest `spawned` event). Typically `architect`.
2. BFS from each root to assign levels (depth). Each level is a horizontal row.
3. Within each level, distribute nodes evenly across the available width.
4. Draw edges as SVG `<line>` or `<path>` elements (straight lines with arrowheads).
5. Draw nodes as SVG `<g>` groups containing a `<rect>` (rounded, styled by status) and `<text>` (agent name + icon).

#### SVG Sizing

- Container width: 100% of the `.agents-section` width (responsive)
- Row height: 100px (vertical spacing between levels)
- Node size: 140px × 50px
- Arrowheads defined via SVG `<defs><marker>` element

#### Node Styling

Nodes use the same status color variables from `styles.css`:
- `active` → `var(--status-active)` border
- `working` → `var(--status-working)` border with pulse animation
- `completed` → `var(--status-completed)` border
- `idle` → `var(--status-idle)` border

Edge hover shows the task description as an SVG `<title>` tooltip.

### UI Integration

Add a toggle above the agents section: **"Grid View"** | **"Graph View"**. Default to Grid. When Graph is selected, hide `#agents-grid` and show `#agents-graph`. State is stored in `localStorage` so it persists across reloads.

#### HTML Changes (`index.html`)

Add inside `#agents-section`, before `#agents-grid`:

```html
<div class="view-toggle">
  <button id="view-grid" class="view-btn active">Grid</button>
  <button id="view-graph" class="view-btn">Graph</button>
</div>
<div id="agents-graph" class="agents-graph" style="display:none;"></div>
```

#### CSS Changes (`styles.css`)

Add styles for:
- `.view-toggle` — flex container with gap, right-aligned
- `.view-btn` — small button matching dashboard theme
- `.view-btn.active` — highlighted with `var(--accent-blue)`
- `.agents-graph` — container for the SVG
- `.graph-node` — SVG rect styling per status
- `.graph-edge` — SVG line styling
- `.graph-label` — SVG text styling

---

## Issue 2: Agents Stuck as Active After Completion

### Problem

In `server.js`, the `/api/agents` handler calls `getActiveAgents()` (event-based) and then `getActivitySnapshot()` (filesystem-based). The enrichment logic adds inferred agents from `activity.inferredActiveAgents` if they don't already exist in the agents array. After an agent completes and writes its log file, `activity.js` keeps detecting it as active for up to 10 minutes.

### Fix

#### Change 1: `server.js` `/api/agents` handler

Build a set of agents known from events. Only add inferred agents if they have NEVER appeared in any event.

```js
'/api/agents'(_req, res) {
  const agents = getActiveAgents();
  const activity = getActivitySnapshot();

  // Build set of agents known from events (any status)
  const knownAgents = new Set(agents.map(a => a.agent));

  // Only add inferred agents that are NOT already known from events
  const inferredSet = new Set(activity.inferredActiveAgents);
  for (const name of inferredSet) {
    if (!knownAgents.has(name)) {
      agents.push({
        agent: name,
        status: 'active',
        branch: null,
        plan: null,
        tasksCompleted: 0,
        tasksTotal: 0,
        lastEvent: 'inferred-from-logs',
        lastEventTime: activity.timestamp,
      });
    }
  }

  json(res, agents);
},
```

#### Change 2: `server.js` `/api/summary` handler

Apply the same filtering logic to the active count.

---

## Issue 3: Delayed Agent Detection

### Problem

Three sources of delay:

1. **Full file re-read on every request**: `readEvents()` reads the entire JSONL file synchronously on every API call.
2. **Filesystem walk on every request**: `getActivitySnapshot()` walks directories and runs git commands on every call.
3. **Polling latency**: Frontend polls every 3 seconds.

### Solution: Three-Pronged Approach

#### 3A. Event Cache with `fs.watch` (server-side)

New file `dashboard/lib/collectors/event-cache.js`:

- On initialization, reads the full events file once and caches the parsed array + file byte offset
- Sets up `fs.watch` on the events directory
- On file change, reads only new bytes appended since last read
- Exports `getEvents()`, `getActiveAgents()`, `getGraph()` from memory
- Accepts `onNewEvents` callback for SSE broadcast

#### 3B. Activity Snapshot Cache (server-side)

Wrap `getActivitySnapshot()` in a 5-second TTL cache in `server.js`.

#### 3C. Server-Sent Events (SSE) Endpoint

New endpoint `GET /api/stream`:
- Returns SSE stream
- Pushes new events from EventCache to all connected clients
- Frontend connects via `EventSource`, triggers immediate refresh on new events
- Falls back to polling if SSE fails
- Polling interval increases from 3s to 10s when SSE is connected

---

## Issue 4: Workflow Bypass for Small Fixes

### Problem

"Single-line bug fixes with obvious correctness" exception allows pushing directly to main without branch/test/review.

### Fix

Replace the exceptions block in `.github/copilot-instructions.md`:

- Remove "Single-line bug fixes with obvious correctness" exception
- All bug fixes regardless of size require branch + test + review
- Typo fixes in `.md` files still excepted from a full plan but require a branch
- Add gate summary table

---

## Files to Modify

| File | Change | Issue |
|---|---|---|
| `dashboard/lib/collectors/events.js` | Add `getAgentGraph()` function | #1 |
| `dashboard/lib/collectors/event-cache.js` | **New file** — `EventCache` class | #1, #3 |
| `dashboard/server.js` | Add `/api/graph`, `/api/stream`; fix `/api/agents` and `/api/summary`; create `EventCache`; add activity TTL cache | #1, #2, #3 |
| `dashboard/public/index.html` | Add view toggle buttons and `#agents-graph` container | #1 |
| `dashboard/public/app.js` | Add `renderGraph()` SVG renderer; view toggle; SSE client; adjust polling | #1, #3 |
| `dashboard/public/styles.css` | Add graph styles | #1 |
| `dashboard/test/collectors.test.js` | Add tests for `getAgentGraph()` | #1 |
| `dashboard/test/server.test.js` | Add tests for `/api/graph`, `/api/stream`, completed agent fix | #2, #3 |
| `dashboard/test/event-cache.test.js` | **New file** — tests for `EventCache` | #3 |
| `.github/copilot-instructions.md` | Tighten exception clause; add gate summary table | #4 |

## Execution Order

```
Issue #2 (Stuck Active)    — standalone, smallest change
Issue #4 (Workflow Bypass) — standalone, documentation only
Issue #3 (Delay)           — requires event-cache.js, touches server.js and app.js
Issue #1 (Graph)           — depends on event-cache.js from Issue #3
```

## Workstream Decomposition

1. **Workstream A — Backend fixes** (`@backend-lead`): Issues #2, #3, and #1 API/server changes
2. **Workstream B — Frontend features** (`@frontend-lead`): Issue #1 SVG graph renderer, SSE client, view toggle
3. **Workstream C — Workflow policy** (direct edit): Issue #4 copilot-instructions.md update

Workstream B depends on Workstream A (needs `/api/graph` and `/api/stream` endpoints).

## Approval

- Approved by: human user
- Approved at: 2026-04-10
