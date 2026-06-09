// dashboard/test/emit-event.test.js
// Tests for emit-event.js CLI argument parsing

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const EMIT_SCRIPT = path.resolve(__dirname, '..', 'lib', 'emit-event.js');

function runEmit(args, eventsFile) {
  const env = { ...process.env };
  // We'll pass the events file via a temp wrapper or check the output
  const cmd = `node ${EMIT_SCRIPT} ${args}`;
  try {
    const output = execSync(cmd, { encoding: 'utf8', env, timeout: 5000 });
    return { output: output.trim(), exitCode: 0 };
  } catch (err) {
    return { output: (err.stderr || err.stdout || '').trim(), exitCode: err.status };
  }
}

describe('emit-event.js CLI', () => {
  it('should fail with no arguments', () => {
    const result = runEmit('');
    assert.notEqual(result.exitCode, 0);
    assert.ok(result.output.includes('Usage'));
  });

  it('should fail with only one argument', () => {
    const result = runEmit('architect');
    assert.notEqual(result.exitCode, 0);
  });

  it('should log a basic event successfully', () => {
    const result = runEmit('test-agent test-event');
    assert.equal(result.exitCode, 0);
    assert.ok(result.output.includes('Event logged'));
    assert.ok(result.output.includes('test-agent'));
  });

  it('should parse --branch flag', () => {
    const result = runEmit('agent1 branch-created --branch feature/test');
    assert.equal(result.exitCode, 0);
    assert.ok(result.output.includes('Event logged'));
  });

  it('should parse --parent flag', () => {
    const result = runEmit('agent1 spawned --parent architect');
    assert.equal(result.exitCode, 0);
    assert.ok(result.output.includes('Event logged'));
  });

  it('should parse --todos flag with valid JSON', () => {
    const todos = JSON.stringify([{ id: 1, title: 'Test', status: 'in-progress' }]);
    const result = runEmit(`agent1 todo-update --todos '${todos}'`);
    assert.equal(result.exitCode, 0);
    assert.ok(result.output.includes('Event logged'));
  });

  it('should fail with invalid --todos JSON', () => {
    const result = runEmit('agent1 todo-update --todos not-json');
    assert.notEqual(result.exitCode, 0);
    assert.ok(result.output.includes('--todos must be valid JSON'));
  });

  it('should parse --taskIndex and --taskTotal as numbers', () => {
    const result = runEmit('agent1 task-started --task "Build" --taskIndex 2 --taskTotal 10');
    assert.equal(result.exitCode, 0);
  });

  it('should parse --plan flag', () => {
    const result = runEmit('arch session-start --plan ".plans/test.md"');
    assert.equal(result.exitCode, 0);
  });
});

// --- logAgentEvent unit tests for workstream routing ---

describe('logAgentEvent workstream routing', () => {
  const { logAgentEvent } = require('../lib/log-event');

  it('should route event to events-<workstream>.jsonl when workstream is present', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emit-ws-'));
    const eventsDir = path.join(tmpDir, '.agent-events');
    fs.mkdirSync(eventsDir, { recursive: true });
    const wsFile = path.join(eventsDir, 'events-backend.jsonl');

    logAgentEvent({ agent: 'dev', event: 'spawned', workstream: 'backend', eventsFile: wsFile });
    const content = fs.readFileSync(wsFile, 'utf8');
    const evt = JSON.parse(content.trim());
    assert.equal(evt.agent, 'dev');
    assert.equal(evt.workstream, 'backend');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should route event to events.jsonl when workstream is absent', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emit-nows-'));
    const eventsFile = path.join(tmpDir, 'events.jsonl');

    logAgentEvent({ agent: 'dev', event: 'spawned', eventsFile });
    assert.ok(fs.existsSync(eventsFile));
    const content = fs.readFileSync(eventsFile, 'utf8');
    const evt = JSON.parse(content.trim());
    assert.equal(evt.agent, 'dev');
    assert.equal(evt.workstream, undefined);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should throw on invalid workstream name', () => {
    assert.throws(
      () => logAgentEvent({ agent: 'dev', event: 'spawned', workstream: 'INVALID' }),
      /Invalid workstream name/
    );
  });

  it('should throw on workstream name with special characters', () => {
    assert.throws(
      () => logAgentEvent({ agent: 'dev', event: 'spawned', workstream: 'my_stream' }),
      /Invalid workstream name/
    );
  });

  it('should accept valid workstream names', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emit-valid-'));
    const eventsFile = path.join(tmpDir, 'events-my-stream.jsonl');

    logAgentEvent({ agent: 'dev', event: 'spawned', workstream: 'my-stream', eventsFile });
    assert.ok(fs.existsSync(eventsFile));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
