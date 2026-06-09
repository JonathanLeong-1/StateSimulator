// dashboard/test/state.test.js
// Tests for SessionState class

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { SessionState } = require('../lib/state');

describe('SessionState', () => {
  it('should initialize with empty state', () => {
    const state = new SessionState();
    const s = state.getState();
    assert.equal(s.sessionStart, null);
    assert.equal(s.planPath, null);
    assert.deepEqual(s.agents, {});
    assert.deepEqual(s.graph.nodes, []);
    assert.deepEqual(s.graph.edges, []);
    assert.equal(s.eventCount, 0);
  });

  it('should process spawned event and add agent to graph', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'architect', event: 'spawned', parent: '' });
    const s = state.getState();
    assert.equal(s.agents.architect.status, 'active');
    assert.equal(s.agents.architect.spawnedAt, '2026-01-01T00:00:00Z');
    assert.equal(s.graph.nodes.length, 1);
    assert.equal(s.graph.nodes[0].id, 'architect');
    assert.equal(s.graph.nodes[0].label, 'architect');
  });

  it('should build parent-child edges from spawned events', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'architect', event: 'spawned', parent: '' });
    state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'frontend-lead', event: 'spawned', parent: 'architect' });
    const g = state.getGraph();
    assert.equal(g.edges.length, 1);
    assert.equal(g.edges[0].from, 'architect');
    // Instance ID format: role:parent
    assert.equal(g.edges[0].to, 'frontend-lead:architect');
  });

  it('should handle session-start by resetting state', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'architect', event: 'spawned' });
    state.processEvent({ ts: '2026-01-01T01:00:00Z', agent: 'architect', event: 'session-start', plan: '.plans/test.md' });
    const s = state.getState();
    assert.equal(s.sessionStart, '2026-01-01T01:00:00Z');
    assert.equal(s.planPath, '.plans/test.md');
    assert.equal(s.eventCount, 1); // only the session-start event remains
  });

  it('should track task-started and task-completed', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev', event: 'task-started', task: 'Build API', taskIndex: 1, taskTotal: 5 });
    let s = state.getState();
    assert.equal(s.agents.dev.currentTask, 'Build API');
    assert.equal(s.agents.dev.taskIndex, 1);
    assert.equal(s.agents.dev.taskTotal, 5);
    assert.equal(s.agents.dev.status, 'active');

    state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'dev', event: 'task-completed', task: 'Build API', taskIndex: 1, taskTotal: 5 });
    s = state.getState();
    assert.equal(s.agents.dev.currentTask, null);
  });

  it('should track todo-update events', () => {
    const state = new SessionState();
    const todos = [
      { id: 1, title: 'Write tests', status: 'in-progress' },
      { id: 2, title: 'Build UI', status: 'not-started' },
    ];
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev', event: 'todo-update', todos });
    const s = state.getState();
    assert.deepEqual(s.agents.dev.todos, todos);
  });

  it('should track branch-created events', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'lead', event: 'branch-created', branch: 'feature/test' });
    const s = state.getState();
    assert.equal(s.agents.lead.branch, 'feature/test');
  });

  it('should track thinking events', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'architect', event: 'thinking', detail: 'Designing API' });
    const s = state.getState();
    assert.equal(s.agents.architect.thinkingSummary, 'Designing API');
    assert.equal(s.agents.architect.status, 'active');
  });

  it('should track session-complete events', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev', event: 'spawned' });
    state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'dev', event: 'session-complete', status: 'done' });
    const s = state.getState();
    assert.equal(s.agents.dev.status, 'completed');
  });

  it('should track error events', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev', event: 'error', detail: 'Build failed' });
    const s = state.getState();
    assert.equal(s.agents.dev.status, 'error');
    assert.equal(s.agents.dev.thinkingSummary, 'Build failed');
  });

  it('should build graph edges from subagent-invoked events', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'lead', event: 'subagent-invoked', detail: '@developer: build feature' });
    const g = state.getGraph();
    // Instance ID format: childRole:parent
    assert.ok(g.edges.find((e) => e.from === 'lead' && e.to === 'developer:lead'));
  });

  it('should return agent detail with filtered events', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev', event: 'spawned' });
    state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'other', event: 'spawned' });
    state.processEvent({ ts: '2026-01-01T00:02:00Z', agent: 'dev', event: 'task-started', task: 'Test' });
    const detail = state.getAgentDetail('dev');
    assert.equal(detail.name, 'dev');
    assert.equal(detail.events.length, 2); // only dev's events
  });

  it('should return null for unknown agent detail', () => {
    const state = new SessionState();
    assert.equal(state.getAgentDetail('nonexistent'), null);
  });

  it('should handle plan-loaded event and set planPath', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'arch', event: 'plan-loaded', plan: '.plans/foo.md' });
    const s = state.getState();
    assert.equal(s.planPath, '.plans/foo.md');
    assert.equal(s.agents.arch.plan, '.plans/foo.md');
  });

  it('should not duplicate graph nodes', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev', event: 'spawned' });
    state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'dev', event: 'task-started', task: 'Test' });
    const g = state.getGraph();
    const devNodes = g.nodes.filter((n) => n.id === 'dev');
    assert.equal(devNodes.length, 1);
  });

  it('should not duplicate graph edges', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'lead', event: 'subagent-invoked', detail: '@dev: task1' });
    state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'lead', event: 'subagent-invoked', detail: '@dev: task2' });
    const g = state.getGraph();
    // Instance ID: dev:lead
    const edges = g.edges.filter((e) => e.from === 'lead' && e.to === 'dev:lead');
    assert.equal(edges.length, 1);
  });

  it('should fully reset on reset()', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev', event: 'spawned' });
    state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'dev', event: 'todo-update', todos: [{ id: 1, title: 'x', status: 'completed' }] });
    state.reset();
    const s = state.getState();
    assert.deepEqual(s.agents, {});
    assert.equal(s.graph.nodes.length, 0);
    assert.equal(s.eventCount, 0);
    assert.equal(s.sessionStart, null);
  });

  it('should ignore events with missing agent or event fields', () => {
    const state = new SessionState();
    state.processEvent(null);
    state.processEvent({});
    state.processEvent({ agent: 'dev' });
    state.processEvent({ event: 'spawned' });
    assert.equal(state.getState().eventCount, 0);
  });

  it('should ignore session-start from non-architect agent', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev', event: 'spawned' });
    state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'infra-lead', event: 'session-start', plan: '.plans/rogue.md' });
    const s = state.getState();
    assert.ok(s.agents.dev, 'dev agent should still exist after non-architect session-start');
    assert.ok(s.eventCount > 1, 'events should not have been wiped');
  });

  it('should reset on session-start from architect', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev', event: 'spawned' });
    state.processEvent({ ts: '2026-01-01T01:00:00Z', agent: 'architect', event: 'session-start', plan: '.plans/new.md' });
    const s = state.getState();
    assert.equal(s.agents.dev, undefined, 'dev agent should be gone after architect session-start');
    assert.ok(s.agents.architect, 'architect agent should exist');
    assert.equal(s.planPath, '.plans/new.md');
    assert.equal(s.eventCount, 1);
  });

  it('should update planPath on plan-saved event', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'arch', event: 'plan-saved', plan: '.plans/old.md' });
    assert.equal(state.getState().planPath, '.plans/old.md');
    state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'arch', event: 'plan-saved', plan: '.plans/new.md' });
    assert.equal(state.getState().planPath, '.plans/new.md');
  });

  it('should create separate graph nodes for same role with different parents', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'architect', event: 'spawned', parent: '' });
    state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'backend-lead', event: 'spawned', parent: 'architect' });
    state.processEvent({ ts: '2026-01-01T00:02:00Z', agent: 'frontend-lead', event: 'spawned', parent: 'architect' });
    state.processEvent({ ts: '2026-01-01T00:03:00Z', agent: 'developer', event: 'spawned', parent: 'backend-lead' });
    state.processEvent({ ts: '2026-01-01T00:04:00Z', agent: 'developer', event: 'spawned', parent: 'frontend-lead' });
    const g = state.getGraph();
    // Two separate developer nodes with different instance IDs
    const devNodes = g.nodes.filter((n) => n.label === 'developer');
    assert.equal(devNodes.length, 2, 'should have 2 developer nodes');
    assert.ok(devNodes.find((n) => n.id === 'developer:backend-lead'));
    assert.ok(devNodes.find((n) => n.id === 'developer:frontend-lead'));
    // Each connected to their parent
    assert.ok(g.edges.find((e) => e.from === 'backend-lead:architect' && e.to === 'developer:backend-lead'));
    assert.ok(g.edges.find((e) => e.from === 'frontend-lead:architect' && e.to === 'developer:frontend-lead'));
  });

  it('should store label on graph nodes', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'developer', event: 'spawned', parent: 'backend-lead' });
    const g = state.getGraph();
    const node = g.nodes.find((n) => n.id === 'developer:backend-lead');
    assert.ok(node, 'node should exist');
    assert.equal(node.label, 'developer');
  });

  // --- Multi-workstream tests ---

  it('should store workstream field on agent from event', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev', event: 'spawned', workstream: 'backend' });
    const s = state.getState();
    assert.equal(s.agents.dev.workstream, 'backend');
  });

  it('should track workstream on non-spawned events', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'lead', event: 'task-started', task: 'Build', workstream: 'frontend' });
    const s = state.getState();
    assert.equal(s.agents.lead.workstream, 'frontend');
  });

  it('should return distinct workstream names from getWorkstreams()', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev1', event: 'spawned', workstream: 'backend' });
    state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'dev2', event: 'spawned', workstream: 'frontend' });
    state.processEvent({ ts: '2026-01-01T00:02:00Z', agent: 'dev3', event: 'spawned', workstream: 'backend' });
    const ws = state.getWorkstreams();
    assert.deepEqual(ws, ['backend', 'frontend']);
  });

  it('should return empty array from getWorkstreams() when no workstreams', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev', event: 'spawned' });
    assert.deepEqual(state.getWorkstreams(), []);
  });

  it('should include workstream in graph nodes', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev', event: 'spawned', parent: 'lead', workstream: 'backend' });
    const g = state.getGraph();
    const node = g.nodes.find((n) => n.id === 'dev:lead');
    assert.ok(node, 'node should exist');
    assert.equal(node.workstream, 'backend');
  });

  it('should reset workstream tracking on session-start', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev', event: 'spawned', workstream: 'backend' });
    assert.deepEqual(state.getWorkstreams(), ['backend']);
    state.processEvent({ ts: '2026-01-01T01:00:00Z', agent: 'architect', event: 'session-start', plan: '.plans/new.md' });
    assert.deepEqual(state.getWorkstreams(), []);
  });

  it('should handle events without workstream field (backward compat)', () => {
    const state = new SessionState();
    state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'dev', event: 'spawned' });
    const s = state.getState();
    assert.equal(s.agents.dev.workstream, null);
    assert.deepEqual(state.getWorkstreams(), []);
  });

  // --- Fallback-mode tests ---

  describe('fallback-mode events', () => {
    it('should set agent fallbackMode to tier-1 when detail is tier-1', () => {
      const state = new SessionState();
      state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'backend-lead', event: 'spawned' });
      state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'backend-lead', event: 'fallback-mode', detail: 'tier-1' });
      const s = state.getState();
      assert.equal(s.agents['backend-lead'].fallbackMode, 'tier-1');
    });

    it('should set agent fallbackMode to tier-2 when detail is tier-2', () => {
      const state = new SessionState();
      state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'backend-lead', event: 'spawned' });
      state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'backend-lead', event: 'fallback-mode', detail: 'tier-2' });
      const s = state.getState();
      assert.equal(s.agents['backend-lead'].fallbackMode, 'tier-2');
    });

    it('should set agent status to active on fallback-mode event', () => {
      const state = new SessionState();
      state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'backend-lead', event: 'spawned' });
      state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'backend-lead', event: 'fallback-mode', detail: 'tier-2' });
      const s = state.getState();
      assert.equal(s.agents['backend-lead'].status, 'active');
    });

    it('should default fallbackMode to unknown when detail is missing', () => {
      const state = new SessionState();
      state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'backend-lead', event: 'spawned' });
      state.processEvent({ ts: '2026-01-01T00:01:00Z', agent: 'backend-lead', event: 'fallback-mode' });
      const s = state.getState();
      assert.equal(s.agents['backend-lead'].fallbackMode, 'unknown');
    });
  });
});
