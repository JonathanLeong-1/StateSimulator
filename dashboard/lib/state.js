// dashboard/lib/state.js
// SessionState — in-memory state machine that processes events and maintains
// agent map, spawn graph, and session metadata.

'use strict';

class SessionState {
  constructor() {
    this.reset();
  }

  reset() {
    this.agents = new Map();
    this.graphNodes = [];
    this.graphEdges = [];
    this.sessionStart = null;
    this.planPath = null;
    this.events = [];
    this.workstreams = new Set();
  }

  processEvent(evt) {
    if (!evt || !evt.agent || !evt.event) return;

    this.events.push(evt);

    // Track workstream
    if (evt.workstream) {
      this.workstreams.add(evt.workstream);
    }

    if (evt.event === 'session-start') {
      if (evt.agent !== 'architect') {
        // Ignore session-start from non-architect agents
        return;
      }
      this.reset();
      this.events.push(evt);
      this.sessionStart = evt.ts;
      this.planPath = evt.plan || null;
      this._ensureAgent(evt.agent);
      this._setAgentField(evt.agent, 'status', 'active');
      return;
    }

    // For spawned events, skip generic _ensureAgent — the spawned handler
    // manages agent creation with instance IDs (role:parent format).
    if (evt.event !== 'spawned') {
      this._ensureAgent(evt.agent);
      this._addGraphNode(evt.agent);
      if (evt.workstream) {
        this._setAgentField(evt.agent, 'workstream', evt.workstream);
      }
    }

    switch (evt.event) {
      case 'spawned':
        {
          // Support multiple instances of the same role (e.g., developer spawned
          // by backend-lead AND frontend-lead). Use "role:parent" as the instance
          // ID so each parent-child relationship gets its own graph node.
          const parent = evt.parent || '';
          const instanceId = parent ? `${evt.agent}:${parent}` : evt.agent;
          this._ensureAgent(instanceId);
          this._setAgentField(instanceId, 'role', evt.agent);
          this._setAgentField(instanceId, 'status', 'active');
          this._setAgentField(instanceId, 'spawnedAt', evt.ts);
          this._setAgentField(instanceId, 'parent', parent);
          this._addGraphNode(instanceId, evt.agent);
          if (evt.workstream) {
            this._setAgentField(instanceId, 'workstream', evt.workstream);
          }
          if (parent) {
            // Resolve parent to its instance ID if it exists (e.g., "backend-lead"
            // might actually be "backend-lead:architect" in the graph).
            const parentNodeId = this._resolveNodeId(parent);
            this._addGraphEdge(parentNodeId, instanceId);
          }
          if (!this.sessionStart) {
            this.sessionStart = evt.ts;
          }
        }
        break;

      case 'thinking':
        this._setAgentField(evt.agent, 'status', 'active');
        this._setAgentField(evt.agent, 'thinkingSummary', evt.detail || '');
        break;

      case 'todo-update':
        if (Array.isArray(evt.todos)) {
          this._setAgentField(evt.agent, 'todos', evt.todos);
        }
        break;

      case 'task-started':
        this._setAgentField(evt.agent, 'status', 'active');
        this._setAgentField(evt.agent, 'currentTask', evt.task || '');
        this._setAgentField(evt.agent, 'taskIndex', evt.taskIndex);
        this._setAgentField(evt.agent, 'taskTotal', evt.taskTotal);
        break;

      case 'task-completed':
        this._setAgentField(evt.agent, 'currentTask', null);
        this._setAgentField(evt.agent, 'taskIndex', evt.taskIndex);
        this._setAgentField(evt.agent, 'taskTotal', evt.taskTotal);
        break;

      case 'branch-created':
        this._setAgentField(evt.agent, 'branch', evt.branch || '');
        break;

      case 'subagent-invoked':
        this._setAgentField(evt.agent, 'status', 'active');
        if (evt.detail) {
          const match = evt.detail.match(/@([\w-]+)/);
          if (match) {
            const childRole = match[1];
            // Use instance ID "role:parent" to match the spawned event
            const childInstanceId = `${childRole}:${evt.agent}`;
            this._addGraphNode(childInstanceId, childRole);
            this._addGraphEdge(evt.agent, childInstanceId);
          }
        }
        break;

      case 'plan-loaded':
      case 'plan-saved':
        if (evt.plan) {
          this._setAgentField(evt.agent, 'plan', evt.plan);
          this.planPath = evt.plan;
        }
        break;

      case 'session-complete':
        this._setAgentField(evt.agent, 'status', evt.status === 'error' ? 'error' : 'completed');
        break;

      case 'error':
        this._setAgentField(evt.agent, 'status', 'error');
        this._setAgentField(evt.agent, 'thinkingSummary', evt.detail || 'Error');
        break;

      case 'question-asked':
        this._setAgentField(evt.agent, 'status', 'active');
        this._setAgentField(evt.agent, 'thinkingSummary', evt.detail || 'Asked a question');
        break;

      case 'fallback-mode':
        this._setAgentField(evt.agent, 'fallbackMode', evt.detail || 'unknown');
        this._setAgentField(evt.agent, 'status', 'active');
        break;

      default:
        break;
    }
  }

  getState() {
    const agents = {};
    for (const [name, data] of this.agents) {
      agents[name] = { ...data };
    }
    return {
      sessionStart: this.sessionStart,
      planPath: this.planPath,
      agents,
      graph: this.getGraph(),
      eventCount: this.events.length,
    };
  }

  getGraph() {
    const nodes = this.graphNodes.map((n) => {
      const agent = this.agents.get(n.id);
      return { ...n, workstream: agent ? agent.workstream : null };
    });
    return {
      nodes,
      edges: [...this.graphEdges],
    };
  }

  getAgentDetail(name) {
    const agent = this.agents.get(name);
    if (!agent) return null;

    // Match events by instance ID or by role name
    const role = agent.role || name;
    const agentEvents = this.events.filter((e) => e.agent === name || e.agent === role);
    return {
      ...agent,
      name,
      events: agentEvents,
    };
  }

  getWorkstreams() {
    return [...this.workstreams].sort();
  }

  _ensureAgent(name) {
    if (!this.agents.has(name)) {
      this.agents.set(name, {
        name,
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
      });
      // Add graph node — for non-spawned events, id and label are the same.
      // For spawned events, the spawned handler calls _addGraphNode with a
      // proper label AFTER _ensureAgent, so we skip here to avoid creating
      // a node with a wrong label (instance ID as label).
    }
  }

  _setAgentField(name, field, value) {
    const agent = this.agents.get(name);
    if (agent) {
      agent[field] = value;
    }
  }

  _addGraphNode(id, label) {
    if (!this.graphNodes.find((n) => n.id === id)) {
      this.graphNodes.push({ id, label: label || id });
    }
  }

  /**
   * Resolve a role name to its instance ID in the graph.
   * E.g., "backend-lead" → "backend-lead:architect" if that node exists.
   * Falls back to the raw name if no instance node is found.
   */
  _resolveNodeId(name) {
    // Exact match first
    if (this.graphNodes.find((n) => n.id === name)) return name;
    // Find an instance node with this role (label matches)
    const instanceNode = this.graphNodes.find((n) => n.label === name);
    return instanceNode ? instanceNode.id : name;
  }

  _addGraphEdge(from, to) {
    const exists = this.graphEdges.find(
      (e) => e.from === from && e.to === to
    );
    if (!exists) {
      this._addGraphNode(from);
      this._addGraphNode(to);
      this.graphEdges.push({ from, to });
    }
  }
}

module.exports = { SessionState };
