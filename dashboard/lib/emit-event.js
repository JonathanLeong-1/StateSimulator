#!/usr/bin/env node
// dashboard/lib/emit-event.js
// CLI tool for agents to emit dashboard events with a simple one-liner.
//
// Usage (agents run this in terminal):
//   node dashboard/lib/emit-event.js <agent> <event> [options]
//
// Examples:
//   node dashboard/lib/emit-event.js architect spawned
//   node dashboard/lib/emit-event.js backend-lead task-started --task "Implement auth" --taskIndex 1 --taskTotal 5
//   node dashboard/lib/emit-event.js backend-lead branch-created --branch feature/backend/auth
//   node dashboard/lib/emit-event.js architect question-asked --detail "Asking about tech stack"
//   node dashboard/lib/emit-event.js developer task-completed --task "Write login endpoint" --taskIndex 2 --taskTotal 5 --status done
//   node dashboard/lib/emit-event.js architect spawned --parent ""
//   node dashboard/lib/emit-event.js developer todo-update --todos '[{"id":1,"title":"Write tests","status":"in-progress"}]'

'use strict';

const { logAgentEvent } = require('./log-event');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node emit-event.js <agent> <event> [--branch X] [--plan X] [--task X] [--taskIndex N] [--taskTotal N] [--status X] [--detail X] [--phase X] [--workstream X] [--parent X] [--todos JSON]');
  process.exit(1);
}

const agent = args[0];
const event = args[1];
const opts = { agent, event };

// Parse named arguments
for (let i = 2; i < args.length; i++) {
  const arg = args[i];
  const next = args[i + 1];
  if (!arg.startsWith('--') || next === undefined) continue;

  const key = arg.slice(2);
  if (['taskIndex', 'taskTotal'].includes(key)) {
    opts[key] = parseInt(next, 10);
  } else if (['branch', 'plan', 'task', 'status', 'detail', 'phase', 'workstream', 'parent'].includes(key)) {
    opts[key] = next;
  } else if (key === 'todos') {
    try {
      opts.todos = JSON.parse(next);
    } catch {
      console.error('✗ --todos must be valid JSON');
      process.exit(1);
    }
  }
  i++; // skip the value
}

try {
  const entry = logAgentEvent(opts);
  console.log(`✓ Event logged: ${entry.agent} → ${entry.event}`);
} catch (err) {
  console.error(`✗ Failed to log event: ${err.message}`);
  process.exit(1);
}
