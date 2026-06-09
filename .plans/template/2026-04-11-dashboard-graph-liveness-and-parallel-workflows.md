# Plan: Dashboard Graph Liveness, Activity Heartbeat & Parallel Workflow Support

- **Date**: 2026-04-11
- **Designed by**: @architect
- **Status**: approved
- **Supersedes**: Extends (does not replace) `2026-04-10-dashboard-fixes-and-workflow-enforcement.md`

## Problem Statement

Three related gaps exist in the Agent Monitor Dashboard:

1. **Stale Graph on New Sessions** — When a new agent session starts (e.g. architect begins working), the graph still shows the previous session's completed agents. There is no session boundary reset: `spawned` doesn't clear old state, the graph only accumulates nodes/edges and never prunes them.

2. **No Live Activity Visibility** — A user watching only the dashboard cannot tell that an agent is actively thinking, reading files, writing code, or waiting for a subagent. The graph nodes are static rectangles with no indication of *what* the agent is doing right now. Agents like architect that don't invoke subagents may never appear on the graph at all.

3. **Parallel Workflows Not Depicted** — When multiple Codespaces run parallel workstreams (e.g. backend-lead and frontend-lead working simultaneously), the dashboard cannot distinguish or display concurrent agent trees. All events flatten into one timeline with no visual separation.

## Design Principles

1. **Zero external dependencies** — Only Node.js built-ins + vanilla JS frontend
2. **Backward-compatible** — Existing event formats still work; new fields are optional
3. **Additive** — New event types and display features; no breaking schema changes
4. **Convention-driven** — Leverages existing JSONL event protocol; any agent can emit events via `emit-event.js`

---

## Issue A: Session Lifecycle & Graph Reset

### Root Cause

In `event-cache.js`, the `_updateAgentState()` method handles `spawned` by setting `status = 'active'` but never resets `tasksCompleted`, `tasksTotal`, `branch`, `plan`, or `currentTask`. The `_updateGraph()` method only adds — never removes — nodes and edges. Result: stale completed agents and old delegation edges persist on graph indefinitely.

### Solution: Session-Aware State & Graph

#### A1. Reset agent state on re-spawn (`event-cache.js` `_updateAgentState`)

When a `spawned` event fires for an agent that already exists in `_agentState`, reset accumulators:

```
case 'spawned':
  state.status = 'active';
  state.branch = null;
  state.plan = null;
  state.tasksCompleted = 0;
  state.tasksTotal = 0;
  state.currentTask = null;
  break;
```

#### A2. Prune graph on session start (`event-cache.js` `_updateGraph`)

When `spawned` fires, rebuild the graph to show only the current active session:

1. Remove all nodes with status `completed` or `idle` (they belong to a finished session)
2. Remove all edges whose `from` or `to` references a removed node
3. Ensure the newly-spawned agent's node exists

This preserves any *currently active* agents (parallel workflows) while clearing stale ones.

Implementation in `_updateGraph()`:

```
if (evt.event === 'spawned') {
  // Prune completed/idle nodes and their edges
  this._graph.nodes = this._graph.nodes.filter(n => {
    const s = this._agentState[n.id];
    return s && s.status !== 'completed' && s.status !== 'idle';
  });
  const activeIds = new Set(this._graph.nodes.map(n => n.id));
  this._graph.edges = this._graph.edges.filter(e =>
    activeIds.has(e.from) && activeIds.has(e.to)
  );
}
```

#### A3. Always show the spawned agent on graph even without subagent edges

After the spawn prune, ensure the agent is in the graph as a node. This means standalone agents like `architect` (which may not invoke subagents) still appear. Already handled by the existing "ensure node exists" code, but must fire after the prune.

---

## Issue B: Real-Time Activity Heartbeat System

### Concept: `heartbeat` Event Type

Agents emit periodic `heartbeat` events to signal they are alive and describe what they're doing. This is the primary mechanism for a dashboard-only user to see that "something is happening."

#### New Event Type: `heartbeat`

```json
{
  "ts": "2026-04-11T10:05:23.000Z",
  "agent": "architect",
  "event": "heartbeat",
  "detail": "Reading codebase structure",
  "phase": "thinking"
}
```

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `agent` | yes | Agent name |
| `event` | yes | Always `"heartbeat"` |
| `detail` | yes | Human-readable description of current activity |
| `phase` | no | One of: `thinking`, `coding`, `searching`, `reviewing`, `waiting`, `delegating` |

**Emit cadence:** Agents should emit heartbeats every 15-30 seconds while actively working. This can be done via `emit-event.js` calls in agent prompt instructions.

#### B1. Backend: Process heartbeats in EventCache (`event-cache.js`)

In `_updateAgentState()`, add heartbeat handling:

```
case 'heartbeat':
  state.status = 'working';
  state.currentTask = evt.detail || 'Working...';
  state.phase = evt.phase || null;
  state.lastHeartbeat = evt.ts;
  break;
```

The `phase` field is stored so the frontend can show appropriate indicators.

**Heartbeat staleness detection:** Add a method to EventCache:

```
_isStale(agentName, maxAgeMs = 60000) {
  const state = this._agentState[agentName];
  if (!state || !state.lastHeartbeat) return false;
  return (Date.now() - new Date(state.lastHeartbeat).getTime()) > maxAgeMs;
}
```

When building graph/agent data, if an agent's last heartbeat is >60s old and status is `working`, downgrade to `active` (alive but not actively sending signals).

Add `phase` field to the agent state object initial shape:
```
phase: null,
lastHeartbeat: null,
```

#### B2. Graph node enrichment: Show current task + phase (`event-cache.js` `_updateGraph`)

Extend graph node data to include `currentTask` and `phase`:

```
nodes: [{
  id: "architect",
  status: "working",
  icon: "🏗️",
  currentTask: "Designing session lifecycle fix",
  phase: "thinking"
}]
```

In `_updateGraph`, when updating existing nodes, also copy `currentTask` and `phase`:

```
node.status = this._agentState[name].status;
node.currentTask = this._agentState[name].currentTask || null;
node.phase = this._agentState[name].phase || null;
```

#### B3. Frontend: Animated graph nodes with activity detail (`app.js` `renderGraph`)

Enhance graph node SVG rendering to show:

1. **Phase indicator** — Small icon/emoji in the node based on `phase`:
   - `thinking` → 💭
   - `coding` → ⌨️
   - `searching` → 🔍
   - `reviewing` → 📋
   - `waiting` → ⏳
   - `delegating` → 🔗

2. **Current task text** — Second line of text below agent name, truncated to fit node width. Use smaller font (10px), color = `var(--text-secondary)`.

3. **Working animation** — Already exists (`graph-node-pulse`), but extend to show a shimmer/scanning stripe animation for `working` nodes to give a stronger "something is happening" signal.

4. **Node height adjustment** — Expand node height from 50px to 70px when `currentTask` is present, to accommodate the second text line.

#### B4. Frontend: Activity shimmer CSS (`styles.css`)

Add a new scanning animation for working graph nodes:

```css
@keyframes graph-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.graph-node-working rect {
  animation: graph-pulse 1.5s ease-in-out infinite;
}
```

Also add a subtle glow effect behind working nodes using an SVG filter or drop-shadow.

#### B5. Grid card enhancement: Show phase indicator

In `renderAgents()`, prepend the phase emoji to the current task display:

```
${phaseIcon} ${escapeHtml(currentTask)}
```

#### B6. Heartbeat-based "time since last activity" in summary bar

Add a "Last Signal" indicator to the summary bar showing how recently any agent sent a heartbeat, giving the dashboard user confidence that the system is alive.

---

## Issue C: Parallel Workflow Visualization

### Concept: Workstream Grouping

When multiple agents work in parallel (e.g. in separate Codespaces), each root agent (typically a lead) and its subagent tree forms a **workstream**. The graph should visually group these.

#### C1. Optional `workstream` field on events

Agents may optionally include a `workstream` field on any event:

```json
{
  "agent": "backend-lead",
  "event": "spawned",
  "workstream": "backend"
}
```

If absent, the workstream is inferred from the agent's position in the delegation graph (its root ancestor).

#### C2. Backend: Workstream inference in EventCache

Add logic to `getGraph()` to annotate each node with its workstream:

1. If the event has an explicit `workstream` field, use it
2. Otherwise, trace the parent chain (via edges) to find the root ancestor. The root's name is the workstream.
3. Standalone agents with no edges form their own workstream

Return in graph data:
```json
{
  "nodes": [
    { "id": "backend-lead", "status": "working", ..., "workstream": "backend-lead" },
    { "id": "developer", "status": "working", ..., "workstream": "backend-lead" },
    { "id": "frontend-lead", "status": "active", ..., "workstream": "frontend-lead" }
  ],
  "edges": [...],
  "workstreams": ["backend-lead", "frontend-lead"]
}
```

#### C3. Frontend: Visual workstream grouping (`app.js` `renderGraph`)

When multiple workstreams exist:

1. **Separate layout columns** — Each workstream gets its own horizontal region in the SVG. Add a vertical divider line between workstreams.
2. **Workstream header** — Render workstream name as a subtle label above each group.
3. **Color coding** — Each workstream gets a distinct accent color for its edges (cycle through a palette). Nodes keep their status-based border color.
4. **Responsive layout** — At narrow widths, workstreams stack vertically.

Layout algorithm change:
- First, group nodes by workstream
- Within each workstream, apply the existing BFS level assignment
- Arrange workstream groups side by side horizontally
- Draw inter-workstream edges as dashed lines (if any exist)

#### C4. Frontend: Active workstream count in summary bar

Update `summary-agents` to show: "2 active / 3 workstreams" when parallel workflows are detected.

---

## New Event Types Summary

| Event | Purpose | Required Fields | Optional Fields |
|-------|---------|----------------|-----------------|
| `heartbeat` | Signal agent is alive + what it's doing | `agent`, `event`, `detail` | `phase`, `workstream` |

All existing event types gain an optional `workstream` field.

---

## Files to Modify

| File | Changes | Issue |
|------|---------|-------|
| `dashboard/lib/collectors/event-cache.js` | A1: Reset state on re-spawn; A2: Prune graph on spawn; B1: Handle heartbeat event + staleness; B2: Enrich graph nodes with currentTask/phase; C2: Workstream inference in getGraph | A, B, C |
| `dashboard/lib/collectors/events.js` | A1 mirror: Reset on re-spawn in `getActiveAgents`; B1 mirror: Handle heartbeat | A, B |
| `dashboard/lib/log-event.js` | Add `phase` and `workstream` to allowed fields | B, C |
| `dashboard/lib/emit-event.js` | Add `--phase` and `--workstream` CLI args | B, C |
| `dashboard/public/app.js` | B3: Enriched graph nodes with task/phase; B5: Phase in grid cards; B6: Last signal summary; C3: Workstream grouping layout; C4: Workstream count | B, C |
| `dashboard/public/styles.css` | B4: Shimmer/glow animations for working nodes; C3: Workstream visual dividers | B, C |
| `dashboard/public/index.html` | No changes (existing containers sufficient) | — |
| `dashboard/server.js` | Minor: pass heartbeat staleness check to `/api/agents` response | B |

## New Files

None. All changes are edits to existing files.

## Test Coverage

| Test File | New Tests |
|-----------|-----------|
| `dashboard/test/event-cache.test.js` | Test re-spawn resets state; test graph prune on spawn; test heartbeat processing; test staleness detection; test workstream inference |
| `dashboard/test/collectors.test.js` | Test heartbeat in getActiveAgents; test re-spawn reset in getActiveAgents |

---

## Execution Order

```
A1 + A2 + A3 → Session lifecycle fixes (foundation — blocks everything else)
B1           → Heartbeat event processing (backend)
B2           → Graph node enrichment (backend)
C2           → Workstream inference (backend)
--- backend complete, frontend can start ---
B3 + B4      → Enriched graph rendering + animations (frontend)
B5 + B6      → Grid card phase + summary bar (frontend)
C3 + C4      → Workstream visual grouping (frontend)
--- emit-event / log-event updates can happen in parallel ---
```

## Workstream Decomposition

### Workstream A — Backend (`@backend-lead`)

All changes to `event-cache.js`, `events.js`, `log-event.js`, `emit-event.js`, `server.js`. Deliver:
- Session reset on re-spawn (A1, A2, A3)
- Heartbeat processing + staleness (B1, B2)
- Workstream inference (C2)
- Emit-event CLI updates for new fields
- Tests for all backend changes

### Workstream B — Frontend (`@frontend-lead`)

All changes to `app.js`, `styles.css`. Deliver:
- Enriched graph node rendering with task/phase (B3)
- Working node shimmer animation (B4)
- Phase indicator in grid cards (B5)
- Last signal in summary bar (B6)
- Workstream grouping layout (C3)
- Workstream count in summary (C4)

**Dependency**: Workstream B depends on Workstream A (needs enriched graph API data).

## Approval

- Approved by: human user
- Approved at: 2026-04-11
