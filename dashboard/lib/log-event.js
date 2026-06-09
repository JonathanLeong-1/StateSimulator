// dashboard/lib/log-event.js
// Lightweight event logger for agents to write structured events to .agent-events/events.jsonl
// Zero dependencies — uses only Node.js built-in modules.

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_EVENTS_DIR = path.resolve(__dirname, '..', '..', '.agent-events');
const DEFAULT_EVENTS_FILE = path.join(DEFAULT_EVENTS_DIR, 'events.jsonl');
const WORKSTREAM_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Append a structured event to the JSONL event log.
 *
 * @param {object} opts
 * @param {string} opts.agent       - Agent name (e.g. "backend-lead")
 * @param {string} opts.event       - Event type (e.g. "spawned", "task-completed")
 * @param {string} [opts.branch]    - Git branch name
 * @param {string} [opts.plan]      - Path to .plans/ file
 * @param {string} [opts.task]      - Task description
 * @param {number} [opts.taskIndex] - Task number within plan
 * @param {number} [opts.taskTotal] - Total tasks in plan
 * @param {string} [opts.status]    - Status string
 * @param {string} [opts.detail]    - Freeform detail
 * @param {string} [opts.parent]    - Parent agent name (for spawned events)
 * @param {Array}  [opts.todos]     - Todo list array [{id, title, status}]
 * @param {string} [opts.eventsFile] - Override path to events file
 */
function logAgentEvent(opts) {
  if (!opts || !opts.agent || !opts.event) {
    throw new Error('logAgentEvent requires "agent" and "event" fields');
  }

  if (opts.workstream !== undefined && !WORKSTREAM_RE.test(opts.workstream)) {
    throw new Error(`Invalid workstream name "${opts.workstream}" — must match /^[a-z][a-z0-9-]*$/`);
  }

  const filename = opts.workstream
    ? `events-${opts.workstream}.jsonl`
    : 'events.jsonl';
  const eventsFile = opts.eventsFile || path.join(DEFAULT_EVENTS_DIR, filename);
  const eventsDir = path.dirname(eventsFile);

  const entry = {
    ts: new Date().toISOString(),
    agent: opts.agent,
    event: opts.event,
  };

  if (opts.branch !== undefined) entry.branch = opts.branch;
  if (opts.plan !== undefined) entry.plan = opts.plan;
  if (opts.task !== undefined) entry.task = opts.task;
  if (opts.taskIndex !== undefined) entry.taskIndex = opts.taskIndex;
  if (opts.taskTotal !== undefined) entry.taskTotal = opts.taskTotal;
  if (opts.status !== undefined) entry.status = opts.status;
  if (opts.detail !== undefined) entry.detail = opts.detail;
  if (opts.parent !== undefined) entry.parent = opts.parent;
  if (opts.todos !== undefined) entry.todos = opts.todos;
  if (opts.phase !== undefined) entry.phase = opts.phase;
  if (opts.workstream !== undefined) entry.workstream = opts.workstream;

  if (!fs.existsSync(eventsDir)) {
    fs.mkdirSync(eventsDir, { recursive: true });
  }

  fs.appendFileSync(eventsFile, JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

module.exports = { logAgentEvent, DEFAULT_EVENTS_FILE, DEFAULT_EVENTS_DIR, WORKSTREAM_RE };
