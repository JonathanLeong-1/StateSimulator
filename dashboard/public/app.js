// dashboard/public/app.js
// Main frontend: SSE client, state manager, rendering for Dashboard v2.

'use strict';

// ── State ──────────────────────────────────────────────

const appState = {
  agents: {},
  graph: { nodes: [], edges: [] },
  sessionStart: null,
  planPath: null,
  events: [],
  selectedAgent: null,
  eventsExpanded: false,
  workstreamFilter: new Set(),
  workstreams: [],
};

// ── Utility ────────────────────────────────────────────

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDuration(startIso) {
  if (!startIso) return '0s';
  const ms = Date.now() - new Date(startIso).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatTime(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function agentIcon(name) {
  const icons = {
    'architect': '\u{1F3D7}\uFE0F',
    'backend-lead': '\u2699\uFE0F',
    'frontend-lead': '\u{1F3A8}',
    'infra-lead': '\u{1F527}',
    'developer': '\u{1F4BB}',
    'tester': '\u{1F9EA}',
    'code-reviewer': '\u{1F50D}',
    'docs-writer': '\u{1F4DD}',
  };
  return icons[name] || '\u{1F916}';
}

function eventIcon(type) {
  const icons = {
    'session-start': '\u{1F680}',
    'spawned': '\u{1F7E2}',
    'thinking': '\u{1F4AD}',
    'todo-update': '\u{1F4CB}',
    'task-started': '\u25B6\uFE0F',
    'task-completed': '\u2705',
    'branch-created': '\u{1F33F}',
    'subagent-invoked': '\u{1F517}',
    'question-asked': '\u2753',
    'plan-loaded': '\u{1F4C4}',
    'plan-saved': '\u{1F4C4}',
    'session-complete': '\u{1F3C1}',
    'error': '\u274C',
  };
  return icons[type] || '\u{1F4E1}';
}

// ── SSE Connection ─────────────────────────────────────

let eventSource = null;
let reconnectDelay = 1000;

function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource('/api/stream');

  eventSource.addEventListener('connected', () => {
    reconnectDelay = 1000;
    updateConnectionStatus(true);
  });

  eventSource.addEventListener('state', (e) => {
    try {
      const state = JSON.parse(e.data);
      appState.agents = state.agents || {};
      appState.graph = state.graph || { nodes: [], edges: [] };
      appState.sessionStart = state.sessionStart;
      appState.planPath = state.planPath;
      renderAll();
    } catch {
      // ignore malformed state
    }
  });

  eventSource.addEventListener('events', (e) => {
    try {
      const newEvents = JSON.parse(e.data);
      for (const evt of newEvents) {
        processClientEvent(evt);
        appState.events.push(evt);
        if (appState.events.length > 100) {
          appState.events.shift();
        }
      }
      renderAll();
    } catch {
      // ignore
    }
  });

  eventSource.addEventListener('session-reset', (e) => {
    try {
      const data = JSON.parse(e.data);
      appState.agents = {};
      appState.graph = { nodes: [], edges: [] };
      appState.events = [];
      appState.selectedAgent = null;
      appState.sessionStart = data.ts;
      appState.planPath = data.plan || null;
      appState.workstreamFilter.clear();
      appState.workstreams = [];
      renderAll();
    } catch {
      // ignore
    }
  });

  eventSource.onerror = () => {
    updateConnectionStatus(false);
    eventSource.close();
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      connectSSE();
    }, reconnectDelay);
  };
}

function processClientEvent(evt) {
  if (!evt || !evt.agent) return;

  // For spawned events with a parent, use instance ID "role:parent"
  const isSpawned = evt.event === 'spawned';
  const spawnParent = isSpawned ? (evt.parent || '') : '';
  const agentKey = (isSpawned && spawnParent) ? `${evt.agent}:${spawnParent}` : evt.agent;

  // Ensure agent exists
  if (!appState.agents[agentKey]) {
    appState.agents[agentKey] = {
      name: agentKey,
      role: evt.agent,
      status: 'idle',
      branch: null,
      plan: null,
      spawnedAt: null,
      currentTask: null,
      taskIndex: null,
      taskTotal: null,
      todos: [],
      thinkingSummary: null,
      parent: null,
      workstream: null,
    };
  }

  const agent = appState.agents[agentKey];

  // Store workstream from event
  if (evt.workstream && !agent.workstream) {
    agent.workstream = evt.workstream;
  }

  switch (evt.event) {
    case 'spawned':
      {
        agent.role = evt.agent;
        agent.status = 'active';
        agent.spawnedAt = evt.ts;
        agent.parent = spawnParent;
        addGraphNode(agentKey, evt.agent);
        if (spawnParent) addGraphEdge(spawnParent, agentKey);
      }
      break;
    case 'thinking':
      agent.status = 'active';
      agent.thinkingSummary = evt.detail || '';
      break;
    case 'todo-update':
      if (Array.isArray(evt.todos)) agent.todos = evt.todos;
      break;
    case 'task-started':
      agent.status = 'active';
      agent.currentTask = evt.task || '';
      agent.taskIndex = evt.taskIndex;
      agent.taskTotal = evt.taskTotal;
      break;
    case 'task-completed':
      agent.currentTask = null;
      agent.taskIndex = evt.taskIndex;
      agent.taskTotal = evt.taskTotal;
      break;
    case 'branch-created':
      agent.branch = evt.branch || '';
      break;
    case 'plan-loaded':
    case 'plan-saved':
      if (evt.plan) agent.plan = evt.plan;
      break;
    case 'session-complete':
      agent.status = evt.status === 'error' ? 'error' : 'completed';
      break;
    case 'error':
      agent.status = 'error';
      break;
    case 'subagent-invoked':
      agent.status = 'active';
      if (evt.detail) {
        const match = evt.detail.match(/@([\w-]+)/);
        if (match) {
          const childRole = match[1];
          const childInstanceId = `${childRole}:${evt.agent}`;
          addGraphNode(childInstanceId, childRole);
          addGraphEdge(evt.agent, childInstanceId);
        }
      }
      break;
    case 'fallback-mode':
      agent.fallbackMode = evt.detail || 'unknown';
      agent.status = 'active';
      break;
    default:
      break;
  }
}

function addGraphNode(id, label) {
  if (!appState.graph.nodes.find((n) => n.id === id)) {
    appState.graph.nodes.push({ id, label: label || id });
  }
}

function addGraphEdge(from, to) {
  addGraphNode(from);
  addGraphNode(to);
  if (!appState.graph.edges.find((e) => e.from === from && e.to === to)) {
    appState.graph.edges.push({ from, to });
  }
}

// ── Workstream Management ──────────────────────────────

function updateWorkstreams() {
  const wsSet = new Set();
  for (const agent of Object.values(appState.agents)) {
    if (agent.workstream) wsSet.add(agent.workstream);
  }
  appState.workstreams = [...wsSet].sort();
}

function toggleWorkstreamFilter(workstream) {
  if (appState.workstreamFilter.has(workstream)) {
    appState.workstreamFilter.delete(workstream);
  } else {
    appState.workstreamFilter.add(workstream);
  }
  renderAll();
}

function getWorkstreamColorClass(ws) {
  const known = ['backend', 'frontend', 'infra'];
  return known.includes(ws) ? `workstream-${ws}` : 'workstream-default';
}

function renderWorkstreamFilters() {
  const container = document.getElementById('workstream-filters');
  if (!container) return;

  if (appState.workstreams.length === 0) {
    container.innerHTML = '';
    return;
  }

  const wsColors = { backend: '#4a9eff', frontend: '#4aff8a', infra: '#ffaa4a' };
  let html = '<span class="workstream-filters-label">Workstreams:</span>';
  for (const ws of appState.workstreams) {
    const active = appState.workstreamFilter.has(ws) ? ' active' : '';
    const color = wsColors[ws] || '#aaaaaa';
    html += `<button class="workstream-filter-btn${active}" data-workstream="${escapeHtml(ws)}">
      <span class="ws-dot" style="background:${color}"></span>${escapeHtml(ws)}</button>`;
  }
  container.innerHTML = html;

  // Attach click handlers
  for (const btn of container.querySelectorAll('.workstream-filter-btn')) {
    btn.addEventListener('click', () => {
      toggleWorkstreamFilter(btn.getAttribute('data-workstream'));
    });
  }
}

// ── Rendering ──────────────────────────────────────────

function renderAll() {
  updateWorkstreams();
  renderHeader();
  renderWorkstreamFilters();
  renderGraphView();
  renderDetailPanel();
  renderEventsBar();
}

function updateConnectionStatus(connected) {
  const el = document.getElementById('connection-status');
  if (!el) return;
  el.textContent = connected ? '\u25CF Connected' : '\u25CB Disconnected';
  el.className = connected ? 'status-badge connected' : 'status-badge disconnected';
}

function renderHeader() {
  const durationEl = document.getElementById('session-duration');
  const planLinkEl = document.getElementById('plan-link');
  const statusEl = document.getElementById('session-status');

  if (durationEl) {
    durationEl.textContent = formatDuration(appState.sessionStart);
  }

  if (planLinkEl) {
    if (appState.planPath) {
      const filename = appState.planPath.split('/').pop();
      planLinkEl.textContent = filename;
      planLinkEl.href = '#';
      planLinkEl.onclick = (e) => {
        e.preventDefault();
        showPlanViewer(filename);
      };
      planLinkEl.style.display = '';
    } else {
      planLinkEl.style.display = 'none';
    }
  }

  if (statusEl) {
    const agentCount = Object.keys(appState.agents).length;
    const activeCount = Object.values(appState.agents).filter((a) => a.status === 'active').length;
    statusEl.textContent = agentCount > 0 ? `${activeCount} active / ${agentCount} total` : 'Waiting for agents...';
  }
}

function renderGraphView() {
  const container = document.getElementById('graph-container');
  if (!container || typeof window.renderGraph !== 'function') return;
  window.renderGraph(container, appState.graph, appState.agents, appState.workstreamFilter);
}

function renderDetailPanel() {
  const panel = document.getElementById('detail-panel');
  if (!panel) return;

  if (!appState.selectedAgent || !appState.agents[appState.selectedAgent]) {
    panel.classList.remove('visible');
    return;
  }

  panel.classList.add('visible');
  const agent = appState.agents[appState.selectedAgent];
  const name = appState.selectedAgent;
  const displayName = agent.role || name;

  const fallbackBadge = agent.fallbackMode === 'tier-1'
    ? '<span class="fallback-badge tier-1">RELAY</span>'
    : agent.fallbackMode === 'tier-2'
      ? '<span class="fallback-badge tier-2">SELF-EXEC</span>'
      : '';

  let html = `<div class="detail-header">
    <span class="detail-icon">${agentIcon(displayName)}</span>
    <span class="detail-name">${escapeHtml(displayName)}${fallbackBadge}</span>
    <span class="detail-status status-${agent.status || 'idle'}">${agent.status || 'idle'}</span>
    <button class="detail-close" id="detail-close">&times;</button>
  </div>`;

  // Info section
  html += '<div class="detail-info">';
  if (agent.workstream) {
    const wsClass = getWorkstreamColorClass(agent.workstream);
    html += `<div><strong>Workstream:</strong> <span class="workstream-badge ${wsClass}">${escapeHtml(agent.workstream)}</span></div>`;
  }
  if (agent.branch) html += `<div><strong>Branch:</strong> ${escapeHtml(agent.branch)}</div>`;
  if (agent.spawnedAt) html += `<div><strong>Running:</strong> ${formatDuration(agent.spawnedAt)}</div>`;
  if (agent.currentTask) html += `<div><strong>Task:</strong> ${escapeHtml(agent.currentTask)}</div>`;
  if (agent.taskIndex != null && agent.taskTotal) {
    html += `<div><strong>Progress:</strong> ${agent.taskIndex} / ${agent.taskTotal}</div>`;
  }
  html += '</div>';

  // Thinking summary
  if (agent.thinkingSummary) {
    html += `<div class="detail-section">
      <h4>Thinking</h4>
      <p>${escapeHtml(agent.thinkingSummary)}</p>
    </div>`;
  }

  // Todos
  if (agent.todos && agent.todos.length > 0) {
    const completed = agent.todos.filter((t) => t.status === 'completed').length;
    const total = agent.todos.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    html += `<div class="detail-section">
      <h4>Todos (${completed}/${total})</h4>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <ul class="todo-list">`;
    for (const todo of agent.todos) {
      const icon = todo.status === 'completed' ? '\u2705' : todo.status === 'in-progress' ? '\u{1F504}' : '\u2B1C';
      html += `<li class="todo-${todo.status}">${icon} ${escapeHtml(todo.title)}</li>`;
    }
    html += '</ul></div>';
  }

  // Agent events mini-timeline — match by instance ID or by role name
  const agentEvents = appState.events.filter((e) => e.agent === name || e.agent === displayName).slice(-10);
  if (agentEvents.length > 0) {
    html += `<div class="detail-section">
      <h4>Recent Events</h4>
      <ul class="mini-timeline">`;
    for (const evt of agentEvents) {
      html += `<li><span class="evt-time">${formatTime(evt.ts)}</span> ${eventIcon(evt.event)} ${escapeHtml(evt.event)}</li>`;
    }
    html += '</ul></div>';
  }

  panel.innerHTML = html;

  // Close button handler
  const closeBtn = document.getElementById('detail-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      appState.selectedAgent = null;
      renderDetailPanel();
    });
  }
}

function renderEventsBar() {
  const bar = document.getElementById('events-bar');
  const list = document.getElementById('events-list');
  const toggle = document.getElementById('events-toggle');
  if (!list) return;

  // Filter events by workstream if filter is active
  const filterActive = appState.workstreamFilter.size > 0;
  const filteredEvents = filterActive
    ? appState.events.filter((e) => {
      if (!e.workstream) return true; // events without workstream always shown
      return appState.workstreamFilter.has(e.workstream);
    })
    : appState.events;

  const recent = filteredEvents.slice(-10).reverse();
  if (recent.length === 0) {
    list.innerHTML = '<div class="empty-state">No events yet.</div>';
    if (toggle) toggle.textContent = `Events (0)`;
    return;
  }

  if (toggle) toggle.textContent = `Events (${filteredEvents.length})`;

  let html = '';
  for (const evt of recent) {
    const wsBadge = evt.workstream
      ? `<span class="workstream-badge ${getWorkstreamColorClass(evt.workstream)}">${escapeHtml(evt.workstream)}</span>`
      : '';
    html += `<div class="event-item">
      <span class="evt-time">${formatTime(evt.ts)}</span>
      <span class="evt-icon">${eventIcon(evt.event)}</span>
      <span class="evt-agent">${escapeHtml(evt.agent)}</span>
      ${wsBadge}
      <span class="evt-type">${escapeHtml(evt.event)}</span>
      ${evt.detail ? `<span class="evt-detail">${escapeHtml(evt.detail)}</span>` : ''}
    </div>`;
  }
  list.innerHTML = html;
}

// ── Plan Viewer ────────────────────────────────────────

function showPlanViewer(filename) {
  const modal = document.getElementById('plan-modal');
  const content = document.getElementById('plan-content');
  if (!modal || !content) return;

  content.textContent = 'Loading...';
  modal.classList.add('visible');

  fetch(`/api/plan/${encodeURIComponent(filename)}`)
    .then((r) => {
      if (!r.ok) throw new Error('Not found');
      return r.text();
    })
    .then((text) => {
      // Try to use marked if available
      if (typeof window.marked === 'object' && typeof window.marked.parse === 'function') {
        content.innerHTML = window.marked.parse(text);
      } else {
        content.textContent = text;
        content.style.whiteSpace = 'pre-wrap';
      }
    })
    .catch(() => {
      content.textContent = 'Failed to load plan file.';
    });
}

// ── Initialization ─────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Connect SSE
  connectSSE();

  // Graph node click handler
  const graphContainer = document.getElementById('graph-container');
  if (graphContainer) {
    graphContainer.addEventListener('agent-selected', (e) => {
      appState.selectedAgent = e.detail.agent;
      renderDetailPanel();
    });
  }

  // Events bar toggle
  const eventsToggle = document.getElementById('events-toggle');
  const eventsBar = document.getElementById('events-bar');
  if (eventsToggle && eventsBar) {
    eventsToggle.addEventListener('click', () => {
      appState.eventsExpanded = !appState.eventsExpanded;
      eventsBar.classList.toggle('expanded', appState.eventsExpanded);
    });
  }

  // Plan modal close
  const planClose = document.getElementById('plan-modal-close');
  const planModal = document.getElementById('plan-modal');
  if (planClose && planModal) {
    planClose.addEventListener('click', () => {
      planModal.classList.remove('visible');
    });
  }

  // Session duration timer
  setInterval(() => {
    const durationEl = document.getElementById('session-duration');
    if (durationEl && appState.sessionStart) {
      durationEl.textContent = formatDuration(appState.sessionStart);
    }
  }, 1000);

  // Initial render
  renderAll();
});
